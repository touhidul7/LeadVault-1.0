'use client';

import { useAuth } from '@/lib/auth-context';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Database, Users, Upload, BarChart3, LogOut, Menu, X, UserPlus, Settings, ChevronDown, MessageCircle, Mail } from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [workspaces, setWorkspaces] = useState<Array<{ workspace_id: string; workspace_email: string }>>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<string>('');

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
    { name: 'Leads', href: '/dashboard/leads', icon: Users },
    { name: 'Import', href: '/dashboard/import', icon: Upload },
    { name: 'SMS Log', href: '/dashboard/sms', icon: MessageCircle },
    { name: 'Email Log', href: '/dashboard/email', icon: Mail },
    { name: 'Add', href: '/dashboard/add-lead', icon: UserPlus },
    { name: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  useEffect(() => {
    if (user) fetchWorkspaces();
  }, [user]);

  async function fetchWorkspaces() {
    try {
      // Update member_user_id for invitations matching this user's email
      await supabase
        .from('account_members')
        .update({ member_user_id: user!.id })
        .eq('member_email', user!.email)
        .is('member_user_id', null);

      // Get own workspace
      const own = { workspace_id: user!.id, workspace_email: user!.email || 'My Workspace' };

      // Get shared workspaces
      const { data } = await supabase
        .from('account_members')
        .select('workspace_id, workspace_email')
        .eq('member_user_id', user!.id);

      const shared = (data || []).map(item => ({
        workspace_id: item.workspace_id,
        workspace_email: item.workspace_email || 'Shared Workspace'
      }));

      setWorkspaces([own, ...shared]);
      setActiveWorkspace(localStorage.getItem('activeWorkspace') || user!.id);
    } catch (err) {
      console.error('Error fetching workspaces:', err);
    }
  }


  function handleSwitchWorkspace(workspaceId: string) {
    localStorage.setItem('activeWorkspace', workspaceId);
    setActiveWorkspace(workspaceId);
    // Dispatch custom event so other pages can listen
    window.dispatchEvent(new CustomEvent('workspaceChanged', { detail: { workspaceId } }));
    router.push('/dashboard');
  }

  const isActive = (href: string) => pathname === href;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200">
        <div className=" mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href={"/"} className="flex-shrink-0 flex items-center">
                <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-white" />
                </div>
                <span className="ml-2 text-xl font-bold text-slate-900">LeadVault</span>
              </Link>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-4">
                {navigation.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                        isActive(item.href)
                          ? 'bg-slate-100 text-slate-900'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {item.name}
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="hidden sm:flex sm:items-center sm:gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    Login as: {workspaces.find(w => w.workspace_id === activeWorkspace)?.workspace_email}
                    <ChevronDown className="w-4 h-4 ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {workspaces.map(ws => (
                    <DropdownMenuItem key={ws.workspace_id} onClick={() => handleSwitchWorkspace(ws.workspace_id)}>
                      {ws.workspace_email}
                      {ws.workspace_id === activeWorkspace && ' ✓'}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button variant="outline" size="sm" onClick={signOut}>
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
            <div className="flex items-center sm:hidden">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </Button>
            </div>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center px-3 py-2 text-base font-medium rounded-md ${
                      isActive(item.href)
                        ? 'bg-slate-100 text-slate-900'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
            <div className="border-t border-slate-200 px-4 py-3">
              <div className="text-sm text-slate-600 mb-2">{user?.email}</div>
              <Button variant="outline" size="sm" onClick={signOut} className="w-full">
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </Button>
            </div>
          </div>
        )}
      </nav>

      <main className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
