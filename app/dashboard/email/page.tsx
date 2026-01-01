'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, Loader2, Mail } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface EmailCampaign {
  id: string;
  name: string;
  subject: string;
  message_template: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  created_at: string;
}

interface EmailReport {
  success: boolean;
  campaign: {
    id: string;
    name: string;
    subject: string;
    status: string;
    total_recipients: number;
    sent_count: number;
    failed_count: number;
    created_at: string;
  };
  recipients: Array<{
    email: string;
    status: string;
    error?: string | null;
    provider_response?: string | null;
  }>;
}

export default function EmailCampaignsPage() {
  const router = useRouter();
  const authContext = useAuth();
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<EmailCampaign | null>(null);
  const [reportData, setReportData] = useState<EmailReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setLoading(true);
        setError(null);

        const { user } = authContext;
        if (!user) {
          if (!authContext.loading) router.push('/login');
          return;
        }

        const workspace = localStorage.getItem('activeWorkspace') || user.id;

        const { data, error } = await supabase
          .from('email_campaigns')
          .select('*')
          .eq('user_id', workspace)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setCampaigns((data as any) || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load campaigns');
      } finally {
        setLoading(false);
      }
    };

    fetchCampaigns();
  }, [router, authContext.loading, authContext.user]);

  const fetchReport = async (campaign: EmailCampaign) => {
    try {
      setReportLoading(true);
      setReportError(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(`/api/email-report/${campaign.id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json();

      if (data.success) {
        setReportData(data as EmailReport);
      } else {
        setReportError(data.error || 'Failed to fetch report');
      }
    } catch (err) {
      setReportError(err instanceof Error ? err.message : 'Failed to fetch report');
    } finally {
      setReportLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: { [key: string]: any } = {
      'sent': 'default',
      'draft': 'secondary',
      'failed': 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Campaigns</h1>
          <p className="text-muted-foreground mt-2">View your email campaign history and delivery reports</p>
        </div>

        {loading ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading campaigns...
              </div>
            </CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Error loading campaigns</p>
                  <p className="text-sm">{error}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : campaigns.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground py-8">
                <Mail className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No Email campaigns yet</p>
                <p className="text-sm">Send your first bulk Email from the Leads page</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {campaigns.map((campaign) => (
              <Card key={campaign.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5" />
                        {campaign.name}
                      </CardTitle>
                    </div>
                    {getStatusBadge(campaign.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground line-clamp-2">{campaign.subject}</p>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Total Recipients</p>
                      <p className="text-2xl font-bold">{campaign.total_recipients ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Sent</p>
                      <p className="text-2xl font-bold">{campaign.sent_count ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Failed</p>
                      <p className="text-2xl font-bold text-destructive">{campaign.failed_count ?? 0}</p>
                    </div>
                  </div>

                  {/* <Button
                    onClick={() => {
                      setSelectedCampaign(campaign);
                      fetchReport(campaign);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    View Delivery Report
                  </Button> */}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Delivery Report</DialogTitle>
              <DialogDescription>
                {selectedCampaign?.name} - {new Date(selectedCampaign?.created_at || '').toLocaleString()}
              </DialogDescription>
            </DialogHeader>

            {reportLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground py-8">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading report...
              </div>
            ) : reportError ? (
              <div className="flex items-start gap-2 text-destructive">
                <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Error loading report</p>
                  <p className="text-sm">{reportError}</p>
                </div>
              </div>
            ) : reportData ? (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-medium">{reportData.campaign.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="font-medium">{reportData.campaign.total_recipients}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Sent / Failed</p>
                    <p className="font-medium">{reportData.campaign.sent_count} / {reportData.campaign.failed_count}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Recipient Delivery Status</h4>
                  <div className="space-y-2">
                    {reportData.recipients.map((r, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="font-mono text-sm">{r.email}</p>
                          {r.error && <p className="text-xs text-destructive">{r.error}</p>}
                        </div>
                        <Badge variant={r.status === 'sent' ? 'default' : r.status === 'failed' ? 'destructive' : 'secondary'}>{r.status}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog> */}
      </div>
    </DashboardLayout>
  );
}
