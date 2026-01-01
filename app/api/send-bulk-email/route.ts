import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Using Resend as the email service (you can replace with your preferred service)
// Install: npm install resend
// Sign up at: https://resend.com

let emailService: any = null;

// Initialize email service based on environment variables
async function initializeEmailService() {
  if (emailService) return emailService;

  // Try to use Resend if API key is available
  if (process.env.RESEND_API_KEY) {
    try {
      // Use runtime require via eval to avoid Next.js static analysis
      // and bundler errors when the optional package isn't installed.
      // @ts-ignore
      const req: any = eval("require");
      const resendModule = req('resend');
      const ResendCtor = resendModule?.Resend || resendModule?.default?.Resend || resendModule?.default || resendModule;
      emailService = new ResendCtor(process.env.RESEND_API_KEY);
      console.log('Using Resend for email service');
      return emailService;
    } catch (e) {
      console.log('Resend not installed. Install with: npm install resend');
    }
  }

  // Try SendGrid if configured
  if (process.env.SENDGRID_API_KEY) {
    try {
      // Use runtime require via eval to avoid Next.js static analysis
      // and bundler errors when the optional package isn't installed.
      // @ts-ignore
      const req: any = eval("require");
      const sgMail = req('@sendgrid/mail');
      sgMail.setApiKey(process.env.SENDGRID_API_KEY);
      console.log('Using SendGrid for email service');
      return {
        emails: {
          send: async (email: any) => {
            return sgMail.send({
              to: email.to,
              from: email.from,
              subject: email.subject,
              html: email.html,
            });
          },
        },
      };
    } catch (e) {
      console.log('SendGrid not installed. Install with: npm install @sendgrid/mail');
    }
  }

  // Try SMTP if configured
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      // Import nodemailer dynamically
      const nodemailer = await import('nodemailer').then((m: any) => m.default || m);
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_PORT === '465', // true for 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });
      console.log('Using SMTP for email service');
      return {
        emails: {
          send: async (email: any) => {
            const info = await transporter.sendMail({
              from: email.from,
              to: email.to,
              subject: email.subject,
              html: email.html,
              replyTo: email.replyTo,
            });
            return { id: info.messageId || info.response };
          },
        },
      };
    } catch (e) {
      console.log('SMTP configuration invalid or nodemailer not installed:', e);
    }
  }

  // Fallback: console logging (for development/testing)
  console.log('⚠️  MOCK EMAIL MODE - No email service configured.');
  console.log('To use a real email service, configure one of:');
  console.log('  - SendGrid: Set SENDGRID_API_KEY in .env');
  console.log('  - SMTP: Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in .env');
  console.log('  - Note: Resend does not support Vercel deployments.');
  return {
    emails: {
      send: async (email: any) => {
        console.log('[MOCK MODE] Email would be sent:', {
          to: email.to,
          from: email.from,
          subject: email.subject,
        });
        return { id: `mock_${Math.random().toString(36).substr(2, 9)}` };
      },
    },
  };
}

// Replace template variables with actual values
function replaceTemplateVariables(
  template: string,
  lead: Record<string, any>
): string {
  let result = template;

  // Common field mappings
  const fieldMappings: Record<string, string[]> = {
    name: ['first_name', 'name'],
    firstName: ['first_name'],
    lastName: ['last_name'],
    company: ['company'],
    title: ['title'],
    email: ['email'],
    phone: ['phone'],
  };

  // Replace all template variables
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

  // Replace any remaining undefined variables with empty string
  result = result.replace(/\{[\w]+\}/g, '');

  return result;
}

interface BulkEmailRequest {
  leads: Array<{
    id: string;
    first_name?: string;
    last_name?: string;
    email: string;
    [key: string]: any;
  }>;
  subject: string;
  message: string;
  senderEmail?: string;
  senderName?: string;
  userId: string;
}

export async function POST(req: Request) {
  try {
    // Validate environment variables
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration:', {
        url: supabaseUrl ? 'present' : 'MISSING',
        key: supabaseServiceKey ? 'present' : 'MISSING',
      });
      return NextResponse.json(
        { 
          error: 'Server configuration error: Missing Supabase credentials. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment variables.' 
        },
        { status: 500 }
      );
    }

    const body: BulkEmailRequest = await req.json();
    const {
      leads,
      subject,
      message,
      senderEmail = process.env.SMTP_USER || 'noreply@leadvault.app',
      senderName = 'LeadVault',
      userId,
    } = body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return NextResponse.json(
        { error: 'No leads provided' },
        { status: 400 }
      );
    }

    if (!subject || !message) {
      return NextResponse.json(
        { error: 'Subject and message are required' },
        { status: 400 }
      );
    }

    // Initialize Supabase client with service role for better permissions
    const sb = createClient(supabaseUrl, supabaseServiceKey);

    // Create campaign record
    const { data: campaign, error: campaignError } = await sb
      .from('email_campaigns')
      .insert({
        user_id: userId,
        name: `Email Campaign - ${new Date().toLocaleString()}`,
        subject,
        message_template: message,
        status: 'sent',
        total_recipients: leads.length,
        sent_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (campaignError) throw campaignError;

    // Initialize email service
    const service = await initializeEmailService();

    if (!service || !service.emails || !service.emails.send) {
      return NextResponse.json(
        { 
          error: 'Email service not properly configured. Please set RESEND_API_KEY or SENDGRID_API_KEY in environment variables.' 
        },
        { status: 500 }
      );
    }

    let successCount = 0;
    let failureCount = 0;
    const logs: any[] = [];

    // Send emails
    for (const lead of leads) {
      try {
        if (!lead.email) {
          logs.push({
            campaign_id: campaign.id,
            lead_id: lead.id,
            recipient_email: '',
            recipient_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
            status: 'failed',
            error_message: 'No email address provided',
          });
          failureCount++;
          continue;
        }

        // Replace template variables
        const personalizedMessage = replaceTemplateVariables(message, lead);
        const recipientName = `${lead.first_name || ''} ${lead.last_name || ''}`.trim();

        // Send email via service
        try {
          const result = await service.emails.send({
            from: `${senderName} <${senderEmail}>`,
            to: lead.email,
            subject,
            html: `<p>${personalizedMessage.replace(/\n/g, '<br>')}</p>`,
            replyTo: senderEmail,
          });

          // Accept a variety of provider responses as success:
          // - result is falsy (some libs return undefined on success)
          // - result has an id/messageId
          // - SendGrid returns an array response
          // - result.status in 2xx
          let sentOk = false;
          try {
            if (!result) sentOk = true;
            else if (Array.isArray(result) && result.length > 0) sentOk = true;
            else if (result.id || result.messageId || result.message_id) sentOk = true;
            else if (result.status && String(result.status).startsWith('2')) sentOk = true;
          } catch (chkErr) {
            // ignore
          }

          if (sentOk) {
            logs.push({
              campaign_id: campaign.id,
              lead_id: lead.id,
              recipient_email: lead.email,
              recipient_name: recipientName,
              status: 'sent',
              sent_at: new Date().toISOString(),
            });
            successCount++;
          } else {
            // Log provider response for debugging and include in failure log
            try {
              console.error('Email provider returned unexpected response for lead', { leadId: lead.id, email: lead.email, response: result });
            } catch (e) {
              console.error('Error logging provider response:', e);
            }

            logs.push({
              campaign_id: campaign.id,
              lead_id: lead.id,
              recipient_email: lead.email,
              recipient_name: recipientName,
              status: 'failed',
              error_message: 'Unexpected response from email provider',
              provider_response: result ? (typeof result === 'string' ? result : JSON.stringify(result)) : null,
            });
            failureCount++;
            continue;
          }
        } catch (emailError: any) {
          // Log detailed error for server-side debugging
          try {
            console.error('Email send error for lead', { leadId: lead.id, email: lead.email, error: emailError });
          } catch (logErr) {
            console.error('Error logging email send error:', logErr);
          }

          logs.push({
            campaign_id: campaign.id,
            lead_id: lead.id,
            recipient_email: lead.email,
            recipient_name: recipientName,
            status: 'failed',
            error_message: (emailError && (emailError.message || JSON.stringify(emailError))) || 'Failed to send email',
            provider_response: (emailError && (emailError.response || emailError.body || emailError.data)) ? JSON.stringify(emailError.response || emailError.body || emailError.data) : (emailError ? JSON.stringify(emailError) : null),
          });
          failureCount++;
        }
      } catch (error: any) {
        logs.push({
          campaign_id: campaign.id,
          lead_id: lead.id,
          recipient_email: lead.email || '',
          recipient_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
          status: 'failed',
          error_message: error.message || 'Unknown error',
        });
        failureCount++;
      }
    }

    // Batch insert email logs
    if (logs.length > 0) {
      const { error: logsError } = await sb.from('email_logs').insert(logs);
      if (logsError) console.error('Error logging emails:', logsError);
    }

    // Update campaign with final counts
    const finalStatus = failureCount === 0 ? 'sent' : 'failed';
    await sb
      .from('email_campaigns')
      .update({
        sent_count: successCount,
        failed_count: failureCount,
        status: finalStatus,
      })
      .eq('id', campaign.id);

    const failures = logs.filter((l) => l.status === 'failed').map((l) => ({
      lead_id: l.lead_id,
      email: l.recipient_email,
      name: l.recipient_name,
      error: l.error_message,
      provider_response: l.provider_response || null,
    }));

    const successes = logs.filter((l) => l.status === 'sent').map((l) => ({
      lead_id: l.lead_id,
      email: l.recipient_email,
      name: l.recipient_name,
      sent_at: l.sent_at,
    }));

    return NextResponse.json({
      success: true,
      campaignId: campaign.id,
      sent: successCount,
      failed: failureCount,
      total: leads.length,
      message: `${successCount} email${successCount !== 1 ? 's' : ''} sent successfully${failureCount > 0 ? `, ${failureCount} failed` : ''}`,
      failures,
      successes,
    });
  } catch (err: any) {
    console.error('Bulk email error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to send bulk emails' },
      { status: 500 }
    );
  }
}
