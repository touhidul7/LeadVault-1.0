import { createClient } from '@supabase/supabase-js';
import { NextResponse, NextRequest } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const requestId = id;

    if (!requestId) {
      return NextResponse.json({ error: 'Request ID is required' }, { status: 400 });
    }

    // read Authorization header (Bearer token) from the incoming request
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    });

    // verify user using the provided bearer token
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // find the campaign for this user with the given request_id
    const { data: campaigns, error: campErr } = await supabase
      .from('sms_campaigns')
      .select('*')
      .eq('request_id', requestId)
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    if (campErr) {
      console.error('Error fetching campaign for report:', campErr);
      return NextResponse.json({ error: campErr.message }, { status: 400 });
    }

    const campaign = campaigns as any;
    if (!campaign) {
      return NextResponse.json({ error: 'No campaign found for this request id' }, { status: 404 });
    }

    // fetch logs for the campaign
    const { data: logs, error: logsErr } = await supabase
      .from('sms_logs')
      .select('recipient_phone, status, api_response, error_message')
      .eq('campaign_id', campaign.id)
      .order('created_at', { ascending: true });

    if (logsErr) {
      console.error('Error fetching sms logs:', logsErr);
      return NextResponse.json({ error: logsErr.message }, { status: 400 });
    }

    const recipients = (logs || []).map((r: any) => {
      let charge = 0;
      try {
        if (r.api_response && typeof r.api_response === 'object') {
          charge = Number(r.api_response.charge || 0) || 0;
        }
      } catch (e) {
        charge = 0;
      }

      return {
        number: r.recipient_phone,
        status: r.status,
        charge,
        error: r.error_message || null,
      };
    });

    const totalCharge = recipients.reduce((s: number, r: any) => s + (r.charge || 0), 0);

    return NextResponse.json({
      success: true,
      requestId,
      status: campaign.status,
      charge: totalCharge,
      recipients,
    });
  } catch (error: any) {
    console.error('SMS report API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch SMS report' }, { status: 500 });
  }
}
