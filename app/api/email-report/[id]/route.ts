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
    const campaignId = id;

    if (!campaignId) {
      return NextResponse.json({ error: 'Campaign ID is required' }, { status: 400 });
    }

    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const token = authHeader ? authHeader.replace('Bearer ', '') : null;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      global: {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: campaign, error: campErr } = await supabase
      .from('email_campaigns')
      .select('*')
      .eq('id', campaignId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (campErr) {
      console.error('Error fetching email campaign:', campErr);
      return NextResponse.json({ error: campErr.message }, { status: 400 });
    }

    if (!campaign) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const { data: logs, error: logsErr } = await supabase
      .from('email_logs')
      .select('recipient_email, status, error_message, provider_response')
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: true });

    if (logsErr) {
      console.error('Error fetching email logs:', logsErr);
      return NextResponse.json({ error: logsErr.message }, { status: 400 });
    }

    const recipients = (logs || []).map((r: any) => ({
      email: r.recipient_email,
      status: r.status,
      error: r.error_message || null,
      provider_response: r.provider_response || null,
    }));

    return NextResponse.json({
      success: true,
      campaign: {
        id: campaign.id,
        name: campaign.name,
        subject: campaign.subject,
        status: campaign.status,
        total_recipients: campaign.total_recipients,
        sent_count: campaign.sent_count,
        failed_count: campaign.failed_count,
        created_at: campaign.created_at,
      },
      recipients,
    });
  } catch (error: any) {
    console.error('Email report API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch email report' }, { status: 500 });
  }
}
