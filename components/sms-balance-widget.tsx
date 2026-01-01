'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, DollarSign, Loader2 } from 'lucide-react';

interface BalanceData {
  success: boolean;
  balance: number | string;
  currency: string;
  error?: string;
}

export function SMSBalanceWidget() {
  const [balance, setBalance] = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBalance = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch('/api/sms-balance');
        const data = await response.json();

        if (data.success) {
          // Ensure balance is a number (API may return string)
          const numeric = typeof data.balance === 'number' ? data.balance : parseFloat(data.balance);
          setBalance({ ...data, balance: Number.isFinite(numeric) ? numeric : 0 });
        } else {
          setError(data.error || 'Failed to fetch balance');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch balance');
      } finally {
        setLoading(false);
      }
    };

    fetchBalance();
    // Refresh balance every 30 seconds
    const interval = setInterval(fetchBalance, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {/* <DollarSign className="h-5 w-5" /> */}৳ 
          SMS Balance
        </CardTitle>
        <CardDescription>Current account balance for SMS sending</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading balance...
          </div>
        ) : error ? (
          <div className="flex items-start gap-2 text-destructive">
            <AlertCircle className="h-5 w-5 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Error loading balance</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        ) : balance ? (
          <div className="space-y-2">
            <div className="text-3xl font-bold">
              {Number.isFinite(Number(balance.balance)) ? Number(balance.balance).toFixed(2) : '0.00'}
              <span className="text-lg text-muted-foreground ml-2">{balance.currency}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Available for SMS campaigns
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
