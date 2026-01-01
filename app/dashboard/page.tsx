'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/lib/supabase';
import { Users, FileSpreadsheet, AlertCircle, TrendingUp } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SMSBalanceWidget } from '@/components/sms-balance-widget';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalImports: 0,
    duplicates: 0,
    recentLeads: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState<string>('');

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    } else if (user) {
      const workspace = localStorage.getItem('activeWorkspace') || user.id;
      setActiveWorkspace(workspace);
      fetchStats(workspace);
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const handleWorkspaceChange = (e: any) => {
      if (user) {
        const workspace = e.detail?.workspaceId || localStorage.getItem('activeWorkspace') || user.id;
        setActiveWorkspace(workspace);
        fetchStats(workspace);
      }
    };
    window.addEventListener('workspaceChanged', handleWorkspaceChange);
    return () => window.removeEventListener('workspaceChanged', handleWorkspaceChange);
  }, [user]);

  async function fetchStats(workspaceId: string) {
    try {
      // Fetch counts and all emails to compute duplicates reliably
      const [leadsResult, importsResult, recentResult, emailsResult] = await Promise.all([
        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', workspaceId),
        supabase
          .from('imports')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', workspaceId),
        supabase
          .from('leads')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', workspaceId)
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        // retrieve emails so we can compute duplicate groups (normalizing client-side)
        supabase
          .from('leads')
          .select('email')
          .eq('user_id', workspaceId),
      ]);

      // compute duplicate count by normalized email (counts of duplicates beyond the first)
      let dupCount = 0;
      try {
        const rows = (emailsResult && (emailsResult as any).data) || [];
        const map = new Map<string, number>();
        for (const r of rows) {
          const e = (r.email || '').toString().trim().toLowerCase();
          if (!e) continue;
          map.set(e, (map.get(e) || 0) + 1);
        }
        for (const v of map.values()) {
          if (v > 1) dupCount += v - 1;
        }
      } catch (e) {
        // fallback: keep dupCount 0
      }

      setStats({
        totalLeads: (leadsResult as any).count || 0,
        totalImports: (importsResult as any).count || 0,
        duplicates: dupCount,
        recentLeads: (recentResult as any).count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading || !user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600 mt-1">Overview of your lead database</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center">
                <Users className="w-4 h-4 mr-2" />
                Total Leads
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <div className="text-3xl font-bold">{stats.totalLeads.toLocaleString()}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center">
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Total Imports
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <div className="text-3xl font-bold">{stats.totalImports.toLocaleString()}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Duplicates
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <div className="text-3xl font-bold">{stats.duplicates.toLocaleString()}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center">
                <TrendingUp className="w-4 h-4 mr-2" />
                Last 7 Days Uploaded
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-10 w-24" />
              ) : (
                <div className="text-3xl font-bold">{stats.recentLeads.toLocaleString()}</div>
              )}
            </CardContent>
          </Card>
        </div>

        <SMSBalanceWidget />

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Get started with your lead management</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => router.push('/dashboard/import')}
                className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-left"
              >
                <FileSpreadsheet className="w-8 h-8 text-slate-700 mb-2" />
                <h3 className="font-semibold text-slate-900">Import Leads</h3>
                <p className="text-sm text-slate-600">Upload CSV files to add new leads</p>
              </button>
              <button
                onClick={() => router.push('/dashboard/leads')}
                className="p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors text-left"
              >
                <Users className="w-8 h-8 text-slate-700 mb-2" />
                <h3 className="font-semibold text-slate-900">View Leads</h3>
                <p className="text-sm text-slate-600">Search and manage your lead database</p>
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
