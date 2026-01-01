'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertCircle, Loader2, MessageCircle, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SMSCampaign {
  id: string;
  name: string;
  message: string;
  status: string;
  total_recipients: number;
  sent_count: number;
  failed_count: number;
  request_id: string | null;
  created_at: string;
}

interface DeliveryReport {
  success: boolean;
  requestId: string;
  status: string;
  charge: number;
  recipients: Array<{
    number: string;
    status: string;
    charge: number;
  }>;
  error?: string;
}

export default function SMSReportPage() {
  const router = useRouter();
  const authContext = useAuth();
  const [campaigns, setCampaigns] = useState<SMSCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<SMSCampaign | null>(null);
  const [reportData, setReportData] = useState<DeliveryReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        setLoading(true);
        setError(null);

        // Use client-side supabase + auth to fetch campaigns for active workspace
        const { user } = authContext;
        if (!user) {
          // if auth is still loading do nothing; otherwise redirect
          if (!authContext.loading) router.push('/login');
          return;
        }

        const workspace = localStorage.getItem('activeWorkspace') || user.id;

        const { data, error } = await supabase
          .from('sms_campaigns')
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

  const fetchReport = async (campaign: SMSCampaign) => {
    if (!campaign.request_id) {
      setReportError('No delivery report available for this campaign');
      return;
    }

    try {
      setReportLoading(true);
      setReportError(null);

      // include current user's access token so server can validate the request
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;

      const response = await fetch(`/api/sms-report/${campaign.request_id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      const data = await response.json();

      if (data.success) {
        setReportData(data);
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
      'completed': 'default',
      'pending': 'secondary',
      'failed': 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  const getDeliveryStatusBadge = (status: string) => {
    const variants: { [key: string]: any } = {
      'Delivered': 'default',
      'Pending': 'secondary',
      'Failed': 'destructive',
      'Rejected': 'destructive',
    };
    return <Badge variant={variants[status] || 'default'}>{status}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">SMS Campaigns</h1>
          <p className="text-muted-foreground mt-2">
            View your SMS campaign history and delivery reports
          </p>
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
                <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No SMS campaigns yet</p>
                <p className="text-sm">Send your first bulk SMS from the Leads page</p>
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
                        <MessageCircle className="h-5 w-5" />
                        {campaign.name}
                      </CardTitle>
                      {/* <CardDescription className="mt-2">
                        {new Date(campaign.created_at).toLocaleString()}
                      </CardDescription> */}
                    </div>
                    {getStatusBadge(campaign.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {campaign.message}
                  </p>

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

                  {campaign.request_id && (
                    <Button
                      onClick={() => {
                        setSelectedCampaign(campaign);
                        fetchReport(campaign);
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      View Delivery Report
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
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
                    <p className="font-medium">{reportData.status}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Charge</p>
                    <p className="font-medium">{reportData.charge} BDT</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Recipients</p>
                    <p className="font-medium">{reportData.recipients.length}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-3">Recipient Delivery Status</h4>
                  <div className="space-y-2">
                    {reportData.recipients.map((recipient, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 bg-muted rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="font-mono text-sm">{recipient.number}</p>
                            <p className="text-xs text-muted-foreground">
                              Charge: {recipient.charge} BDT
                            </p>
                          </div>
                        </div>
                        {getDeliveryStatusBadge(recipient.status)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
