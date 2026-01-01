import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SMS_API_BASE = 'https://api.mimsms.com';
const SMS_USERNAME = process.env.SMS_USERNAME || '';
const SMS_API_KEY = process.env.SMS_API_KEY || '';
const SMS_SENDER_ID = process.env.SMS_SENDER_ID || '';

// Replace template variables with actual values
function replaceTemplateVariables(
  template: string,
  lead: Record<string, any>
): string {
  let result = template;

  const fieldMappings: Record<string, string[]> = {
    name: ['first_name', 'name'],
    firstName: ['first_name'],
    lastName: ['last_name'],
    company: ['company'],
    title: ['title'],
    phone: ['phone'],
  };

  Object.entries(fieldMappings).forEach(([templateKey, leadKeys]) => {
    const regex = new RegExp(`\\{${templateKey}\\}`, 'gi');
    let value = '';

    for (const leadKey of leadKeys) {
      if (lead[leadKey]) {
        value = String(lead[leadKey]);
        break;
      }
    }

    if (value) {
      result = result.replace(regex, value);
    }
  });

  result = result.replace(/\{[\w]+\}/g, '');
  return result;
}

// Normalize phone numbers to international format using configured prefix
function normalizePhoneNumber(raw: string): string {
  if (!raw) return '';
  // Keep only digits
  let digits = String(raw).replace(/\D/g, '');
  const defaultPrefix = process.env.DEFAULT_PHONE_COUNTRY_PREFIX || '880';

  // If already starts with the desired prefix, return as-is
  if (digits.startsWith(defaultPrefix)) return digits;

  // If local format starts with 0 (e.g., 01518999578), replace leading 0 with prefix
  if (digits.startsWith('0')) {
    return defaultPrefix + digits.slice(1);
  }

  // If number looks like local without leading zero (10 or 11 digits), prepend prefix
  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith('00')) {
    return defaultPrefix + digits;
  }

  // Otherwise, return digits unchanged (could be other country code)
  return digits;
}

interface BulkSMSRequest {
  leads: Array<{
    id: string;
    first_name?: string;
    last_name?: string;
    phone: string;
    [key: string]: any;
  }>;
  message: string;
  userId: string;
  senderName?: string;
}

export async function POST(req: Request) {
  try {
    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        { error: 'Server configuration error: Missing Supabase credentials.' },
        { status: 500 }
      );
    }

    if (!SMS_USERNAME || !SMS_API_KEY) {
      return NextResponse.json(
        { error: 'SMS service not configured. Please set SMS_USERNAME and SMS_API_KEY in environment variables.' },
        { status: 500 }
      );
    }

    const body: BulkSMSRequest = await req.json();
    const { leads, message, userId, senderName } = body;
    const configuredSenderName = process.env.SMS_SENDER_NAME || 'LeadVault';
    const finalSenderName = (typeof senderName === 'string' && senderName.trim().length > 0) ? senderName.trim() : configuredSenderName;

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: 'No leads provided' },
        { status: 400 }
      );
    }

    if (!message || message.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Create campaign record (store sender name)
    const { data: campaign, error: campaignError } = await sb
      .from('sms_campaigns')
      .insert({
        user_id: userId,
        name: `SMS Campaign - ${new Date().toLocaleString()}`,
        message,
        sender_name: finalSenderName,
        status: 'sent',
        total_recipients: leads.length,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    let successCount = 0;
    let failureCount = 0;
    const logs: any[] = [];
    let providerError: any = null;
    let providerErrorMessage: string | null = null;
    // Auto-switch: if message contains no template placeholders, use OneToMany to send in one request
    const hasPlaceholders = /\{[\w]+\}/.test(message);
    if (!hasPlaceholders) {
      // Batch send identical message to multiple recipients via OneToMany
      const recipients = leads.filter(l => l.phone).map(l => ({ ...l, normalized: normalizePhoneNumber(l.phone) }));
      const numbers = recipients.map(r => r.normalized).filter(Boolean);

      if (numbers.length === 0) {
        return NextResponse.json({ error: 'Selected leads do not have phone numbers' }, { status: 400 });
      }

      const oneToManyPayload = {
        UserName: SMS_USERNAME,
        Apikey: SMS_API_KEY,
        MobileNumber: numbers.join(','),
        SenderName: finalSenderName,
        TransactionType: 'T',
        Message: message,
          CampaignId: '',
      };

      console.log(`[SMS-${campaign.id}] Sending OneToMany to ${numbers.length} recipients`, { endpoint: `${SMS_API_BASE}/api/SmsSending/OneToMany`, payload: { ...oneToManyPayload, Apikey: '***' } });

      const oneResp = await fetch(`${SMS_API_BASE}/api/SmsSending/OneToMany`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(oneToManyPayload),
      });

      let oneData: any = null;
      const oneContentType = oneResp.headers.get('content-type');
      const oneStatusText = oneResp.statusText;
      try {
        if (oneContentType && oneContentType.toLowerCase().includes('json')) {
          try { oneData = await oneResp.json(); } catch (e) { oneData = { raw: await oneResp.text(), httpStatus: oneResp.status, contentType: oneContentType, statusText: oneStatusText, headers: Object.fromEntries(oneResp.headers) }; }
        } else { oneData = { raw: await oneResp.text(), httpStatus: oneResp.status, contentType: oneContentType, statusText: oneStatusText, headers: Object.fromEntries(oneResp.headers) }; }
      } catch (e) {
        console.error(`[SMS-${campaign.id}] OneToMany response parse error:`, e);
        oneData = { exception: String(e) };
      }

      console.log(`[SMS-${campaign.id}] OneToMany response:`, { status: oneData?.statusCode || oneData?.status || oneData?.httpStatus, raw: oneData });

      // If Invalid Sender ID (208) and a numeric SMS_SENDER_ID is configured, retry with that ID
      if ((oneData?.statusCode === '208' || oneData?.status === '208') && SMS_SENDER_ID && finalSenderName !== SMS_SENDER_ID) {
        console.log(`[SMS-${campaign.id}] OneToMany: Invalid Sender ID '${finalSenderName}', retrying with numeric sender id '${SMS_SENDER_ID}'`);
        const retryPayload = { ...oneToManyPayload, SenderName: SMS_SENDER_ID };
        try {
          const retryResp = await fetch(`${SMS_API_BASE}/api/SmsSending/OneToMany`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify(retryPayload),
          });
          let retryData: any = null;
          const retryCt = retryResp.headers.get('content-type') || '';
          if (retryCt.toLowerCase().includes('json')) {
            try { retryData = await retryResp.json(); } catch (e) { retryData = { raw: await retryResp.text(), httpStatus: retryResp.status, contentType: retryCt }; }
          } else { retryData = { raw: await retryResp.text(), httpStatus: retryResp.status, contentType: retryCt }; }

          console.log(`[SMS-${campaign.id}] OneToMany retry response:`, { status: retryData?.statusCode || retryData?.status || retryData?.httpStatus, raw: retryData });

          if (retryData?.statusCode === '200' || retryData?.status === 'Success' || retryResp.status === 200) {
            for (const r of recipients) {
              logs.push({
                campaign_id: campaign.id,
                lead_id: r.id,
                recipient_phone: r.phone,
                recipient_name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
                sender_name: SMS_SENDER_ID,
                status: 'sent',
                api_response: { ...(retryData || {}), attemptedNumber: r.normalized },
                sent_at: new Date().toISOString(),
              });
              successCount++;
            }
            // skip the original failure handling
            oneData = retryData;
          } else {
            providerError = retryData;
            providerErrorMessage = retryData?.responseResult || retryData?.raw || `Status: ${retryData?.status || retryData?.httpStatus || retryResp.status}`;
            for (const r of recipients) {
              logs.push({
                campaign_id: campaign.id,
                lead_id: r.id,
                recipient_phone: r.phone,
                recipient_name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
                sender_name: SMS_SENDER_ID,
                status: 'failed',
                error_message: providerErrorMessage,
                api_response: { ...(retryData || {}), attemptedNumber: r.normalized },
              });
              failureCount++;
            }
            // skip original handling
            oneData = retryData;
          }
        } catch (retryErr) {
          console.error(`[SMS-${campaign.id}] OneToMany retry error:`, retryErr);
          providerError = { exception: String(retryErr) };
          providerErrorMessage = (retryErr instanceof Error ? retryErr.message : String(retryErr)) || String(retryErr);
          for (const r of recipients) {
            logs.push({
              campaign_id: campaign.id,
              lead_id: r.id,
              recipient_phone: r.phone,
              recipient_name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
              sender_name: SMS_SENDER_ID,
              status: 'failed',
              error_message: providerErrorMessage,
              api_response: { exception: String(retryErr), attemptedNumber: r.normalized },
            });
            failureCount++;
          }
        }
      }

      if (oneData?.statusCode === '200' || oneData?.status === 'Success' || oneResp.status === 200) {
        // Mark all recipients as sent
        for (const r of recipients) {
          logs.push({
            campaign_id: campaign.id,
            lead_id: r.id,
            recipient_phone: r.phone,
            recipient_name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
            sender_name: finalSenderName,
            status: 'sent',
            api_response: { ...(oneData || {}), attemptedNumber: r.normalized },
            sent_at: new Date().toISOString(),
          });
          successCount++;
        }
      } else {
        // Treat as failure for all
        providerError = oneData;
        providerErrorMessage = oneData?.responseResult || oneData?.raw || `Status: ${oneData?.status || oneData?.httpStatus || oneResp.status}`;
        for (const r of recipients) {
          logs.push({
            campaign_id: campaign.id,
            lead_id: r.id,
            recipient_phone: r.phone,
            recipient_name: `${r.first_name || ''} ${r.last_name || ''}`.trim(),
            sender_name: finalSenderName,
            status: 'failed',
            error_message: providerErrorMessage,
            api_response: { ...(oneData || {}), attemptedNumber: r.normalized },
          });
          failureCount++;
        }
      }

      // Batch insert logs and update campaign below (skip per-recipient loop)
    } else {
      // Send SMS to each lead individually (MiMSMS handles per-number basis better)
      for (const lead of leads) {
      if (!lead.phone) {
            logs.push({
                campaign_id: campaign.id,
                lead_id: lead.id,
                recipient_phone: '',
                recipient_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
                sender_name: finalSenderName,
                status: 'failed',
                error_message: 'No phone number provided',
              });
        failureCount++;
        continue;
      }

      try {
        const personalizedMessage = replaceTemplateVariables(message, lead);
        
        // MiMSMS API request body
        const normalizedPhone = normalizePhoneNumber(lead.phone);
        const requestPayload = {
          UserName: SMS_USERNAME,
          Apikey: SMS_API_KEY,
          MobileNumber: normalizedPhone,
          SenderName: finalSenderName,
          TransactionType: 'T', // T = Transactional, P = Promotional, D = Dynamic
          Message: personalizedMessage,
            CampaignId: '',
        };

        console.log(`[SMS-${campaign.id}] Sending to ${lead.phone}:`, {
          endpoint: `${SMS_API_BASE}/api/SmsSending/SMS`,
          usedSender: finalSenderName,
          payload: { ...requestPayload, Apikey: '***' },
        });

        const smsResponse = await fetch(`${SMS_API_BASE}/api/SmsSending/SMS`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify(requestPayload),
        });

        let smsData: any = null;
        const contentType = smsResponse.headers.get('content-type');
        const statusText = smsResponse.statusText;

        try {
          // Accept any content-type that contains 'json' (covers application/problem+json)
          if (contentType && contentType.toLowerCase().includes('json')) {
            try {
              smsData = await smsResponse.json();
            } catch (jsonErr) {
              const rawText = await smsResponse.text();
              console.error(`[SMS-${campaign.id}] JSON parse failed but content-type indicates JSON (${smsResponse.status}):`, rawText.slice(0, 500));
              smsData = { raw: rawText, httpStatus: smsResponse.status, contentType, statusText, headers: Object.fromEntries(smsResponse.headers) };
            }
          } else {
            const rawText = await smsResponse.text();
            console.error(`[SMS-${campaign.id}] Non-JSON response (${smsResponse.status} ${statusText}):`, rawText.slice(0, 500));
            smsData = { raw: rawText, httpStatus: smsResponse.status, contentType, statusText, headers: Object.fromEntries(smsResponse.headers) };
          }
        } catch (parseErr) {
          console.error(`[SMS-${campaign.id}] Response handling error:`, parseErr);
          throw parseErr;
        }

        console.log(`[SMS-${campaign.id}] Response from MiMSMS:`, {
          statusCode: smsData?.statusCode,
          status: smsData?.status,
          httpStatus: smsResponse.status,
        });

        if (smsData?.statusCode === '200' && smsData?.status === 'Success') {
          logs.push({
            campaign_id: campaign.id,
            lead_id: lead.id,
            recipient_phone: lead.phone,
            recipient_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
            sender_name: finalSenderName,
            status: 'sent',
            api_response: {
              trxnId: smsData.trxnId,
              statusCode: smsData.statusCode,
              responseResult: smsData.responseResult,
            },
            sent_at: new Date().toISOString(),
          });
          successCount++;
        } else {
          // MiMSMS returned error response or non-standard payload
          const errorMsg = smsData?.responseResult || smsData?.raw || `Status: ${smsData?.status || smsData?.httpStatus}`;
          // If Invalid Sender ID (208) and a numeric SMS_SENDER_ID is configured, retry once with that ID
          if (smsData?.statusCode === '208' && SMS_SENDER_ID && finalSenderName !== SMS_SENDER_ID) {
            console.log(`[SMS-${campaign.id}] Per-recipient send: Invalid Sender ID '${finalSenderName}', retrying with numeric sender id '${SMS_SENDER_ID}' for ${lead.phone}`);
            const retryPayload = { ...requestPayload, SenderName: SMS_SENDER_ID };
            try {
              const retryResp = await fetch(`${SMS_API_BASE}/api/SmsSending/SMS`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify(retryPayload),
              });
              let retryData: any = null;
              const retryCt = retryResp.headers.get('content-type') || '';
              try {
                if (retryCt.toLowerCase().includes('json')) retryData = await retryResp.json();
                else retryData = { raw: await retryResp.text(), httpStatus: retryResp.status, contentType: retryCt };
              } catch (e) { retryData = { raw: await retryResp.text(), httpStatus: retryResp.status, contentType: retryCt, exception: String(e) }; }

              if (retryData?.statusCode === '200' && retryData?.status === 'Success') {
                logs.push({
                  campaign_id: campaign.id,
                  lead_id: lead.id,
                  recipient_phone: lead.phone,
                  recipient_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
                  sender_name: SMS_SENDER_ID,
                  status: 'sent',
                  api_response: { trxnId: retryData.trxnId, statusCode: retryData.statusCode, responseResult: retryData.responseResult, attemptedNumber: normalizedPhone },
                  sent_at: new Date().toISOString(),
                });
                successCount++;
                continue;
              } else {
                const retryMsg = retryData?.responseResult || retryData?.raw || `Status: ${retryData?.status || retryData?.httpStatus}`;
                providerError = retryData;
                providerErrorMessage = retryMsg;
                logs.push({
                  campaign_id: campaign.id,
                  lead_id: lead.id,
                  recipient_phone: lead.phone,
                  recipient_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
                  sender_name: SMS_SENDER_ID,
                  status: 'failed',
                  error_message: retryMsg,
                  api_response: { ...(retryData || {}), attemptedNumber: normalizedPhone },
                });
                failureCount++;
                continue;
              }
            } catch (retryErr: any) {
              providerErrorMessage = retryErr.message || String(retryErr);
              logs.push({
                campaign_id: campaign.id,
                lead_id: lead.id,
                recipient_phone: lead.phone,
                recipient_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
                sender_name: SMS_SENDER_ID,
                status: 'failed',
                error_message: providerErrorMessage,
                api_response: { exception: String(retryErr), attemptedNumber: normalizedPhone },
              });
              failureCount++;
              continue;
            }
          }

          providerError = smsData;
          providerErrorMessage = errorMsg;

          logs.push({
            campaign_id: campaign.id,
            lead_id: lead.id,
            recipient_phone: lead.phone,
            recipient_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
            sender_name: finalSenderName,
            status: 'failed',
            error_message: errorMsg,
            api_response: { ...smsData, attemptedNumber: normalizedPhone },
          });
          failureCount++;
        }
      } catch (smsError: any) {
        const errorMsg = smsError.message || 'Failed to send SMS';
        providerErrorMessage = errorMsg;

        logs.push({
          campaign_id: campaign.id,
          lead_id: lead.id,
          recipient_phone: lead.phone,
          recipient_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
          sender_name: finalSenderName,
          status: 'failed',
          error_message: errorMsg,
          api_response: { exception: String(smsError) },
        });
        failureCount++;
      }
      }
    }

    // Batch insert SMS logs
    if (logs.length > 0) {
      const { error: logsError } = await sb.from('sms_logs').insert(logs);
      if (logsError) console.error('Error logging SMS:', logsError);
    }

    // Update campaign with final counts
    const finalStatus = failureCount === 0 ? 'sent' : failureCount > 0 && successCount > 0 ? 'sent' : 'failed';
    await sb
      .from('sms_campaigns')
      .update({
        sent_count: successCount,
        failed_count: failureCount,
        status: finalStatus,
      })
      .eq('id', campaign.id);

    const failures = logs
      .filter((l) => l.status === 'failed')
      .map((l) => ({
        lead_id: l.lead_id,
        phone: l.recipient_phone,
        name: l.recipient_name,
        sender_name: l.sender_name || finalSenderName,
        error: l.error_message,
        api_response: l.api_response || null,
      }));

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      senderName: finalSenderName,
      sent: successCount,
      failed: failureCount,
      total: leads.length,
      message: `${successCount} SMS${successCount !== 1 ? 's' : ''} sent successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      failures,
      providerError,
      providerErrorMessage,
    });
  } catch (err: any) {
    console.error('Bulk SMS error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to send bulk SMS' },
      { status: 500 }
    );
  }
}
