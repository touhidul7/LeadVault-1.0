'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Database, Loader2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center mb-4">
        <Database className="w-8 h-8 text-white" />
      </div>
      <h1 className="text-3xl font-bold mb-2">LeadVault</h1>
      <Loader2 className="h-6 w-6 animate-spin text-slate-600 mt-4" />
    </div>
  );
}
