'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard-layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/hooks/use-toast';
import { Trash2, UserPlus, Loader2, AlertCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';

export default function SettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [members, setMembers] = useState<Array<{ id: string; member_email: string; created_at: string }>>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOwnWorkspace, setIsOwnWorkspace] = useState(true);

  useEffect(() => {
    if (user) {
      const activeWorkspace = localStorage.getItem('activeWorkspace') || user.id;
      // Settings can only be accessed in your own workspace
      if (activeWorkspace !== user.id) {
        setIsOwnWorkspace(false);
        toast({ title: 'Access Denied', description: 'You can only manage members in your own workspace', variant: 'destructive' });
        router.push('/dashboard/leads');
        return;
      }
      setIsOwnWorkspace(true);
      fetchMembers();
    }
  }, [user]);

  async function fetchMembers() {
    try {
      const { data, error } = await supabase
        .from('account_members')
        .select('id, member_email, created_at')
        .eq('workspace_id', user!.id);

      if (error) throw error;
      setMembers(data || []);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to fetch members', variant: 'destructive' });
    }
  }

  async function handleAddMember() {
    if (!newMemberEmail?.trim()) {
      return toast({ title: 'Error', description: 'Email is required', variant: 'destructive' });
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('account_members')
        .insert({
          workspace_id: user!.id,
          workspace_email: user!.email,
          member_email: newMemberEmail.trim(),
          role: 'member',
          created_by: user!.id,
        });

      if (error) throw error;

      toast({ title: 'Added', description: `User ${newMemberEmail} invited to workspace` });
      setNewMemberEmail('');
      fetchMembers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to add member', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  async function handleRemoveMember(id: string) {
    try {
      const { error } = await supabase
        .from('account_members')
        .delete()
        .eq('id', id)
        .eq('workspace_id', user!.id);

      if (error) throw error;

      toast({ title: 'Removed', description: 'Member removed from workspace' });
      fetchMembers();
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to remove member', variant: 'destructive' });
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600 mt-1">Manage workspace access and members</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Workspace Members</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter email to invite"
                value={newMemberEmail}
                onChange={e => setNewMemberEmail(e.target.value)}
                disabled={loading}
              />
              <Button onClick={handleAddMember} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4 mr-2" />}
                Invite
              </Button>
            </div>

            {members.length > 0 ? (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Added</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map(member => (
                      <TableRow key={member.id}>
                        <TableCell>{member.member_email}</TableCell>
                        <TableCell className="text-sm text-slate-600">
                          {new Date(member.created_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id)}
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-slate-600 py-4">No members invited yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
