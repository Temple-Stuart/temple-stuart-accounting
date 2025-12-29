'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AppLayout, Card, Badge } from '@/components/ui';

const modules = [
  { 
    name: 'Bookkeeping', 
    description: 'Double-entry ledger, financial statements, CPA-ready exports', 
    href: '/dashboard', 
    icon: '📒',
    badge: { text: '01', variant: 'success' as const },
    statKey: 'transactions'
  },
  { 
    name: 'Trips & Agenda', 
    description: 'Plan trips, compare trips, coordinate with your crew', 
    href: '/budgets/trips', 
    icon: '✈️',
    badge: { text: '02', variant: 'info' as const },
    statKey: 'trips'
  },
  { 
    name: 'Budget Review', 
    description: 'Track spending vs targets, visualize your financial health', 
    href: '/hub/itinerary', 
    icon: '📊',
    badge: { text: '03', variant: 'purple' as const },
    statKey: 'chartOfAccounts'
  },
];

interface Stats {
  accounts: number;
  transactions: number;
  chartOfAccounts: number;
  trips: number;
}

export default function HubPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (!data.error) setStats(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const formatStat = (key: string) => {
    if (loading) return '...';
    if (!stats) return '0';
    const value = stats[key as keyof Stats] || 0;
    return value.toLocaleString();
  };

  const getStatLabel = (key: string) => {
    switch (key) {
      case 'transactions': return 'transactions';
      case 'trips': return 'trips';
      case 'chartOfAccounts': return 'accounts';
      default: return '';
    }
  };

  return (
    <AppLayout>
      <div className="px-4 lg:px-8 py-12">
        {/* Welcome Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 tracking-tight mb-3">
            Welcome back, {session?.user?.name?.split(' ')[0] || 'there'}
          </h1>
          <p className="text-lg text-gray-500">
            What would you like to work on today?
          </p>
        </div>

        {/* Module Cards */}
        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {modules.map((module) => (
            <button
              key={module.name}
              onClick={() => router.push(module.href)}
              className="group text-left"
            >
              <Card className="h-full hover:border-[#b4b237] hover:shadow-lg transition-all duration-200">
                <div className="flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <span className="text-4xl">{module.icon}</span>
                    <Badge variant={module.badge.variant}>{module.badge.text}</Badge>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 group-hover:text-[#b4b237] transition-colors mb-2">
                    {module.name}
                  </h2>
                  <p className="text-gray-500 text-sm flex-grow mb-4">
                    {module.description}
                  </p>
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <span className="text-xs text-gray-400 font-medium">
                      {formatStat(module.statKey)} {getStatLabel(module.statKey)}
                    </span>
                    <span className="text-[#b4b237] group-hover:translate-x-1 transition-transform">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                      </svg>
                    </span>
                  </div>
                </div>
              </Card>
            </button>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mt-16 max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <div className="text-3xl font-bold text-gray-900">{formatStat('accounts')}</div>
              <div className="text-sm text-gray-500 mt-1">Connected Accounts</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <div className="text-3xl font-bold text-[#b4b237]">{formatStat('transactions')}</div>
              <div className="text-sm text-gray-500 mt-1">Transactions</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <div className="text-3xl font-bold text-gray-900">{formatStat('chartOfAccounts')}</div>
              <div className="text-sm text-gray-500 mt-1">Chart of Accounts</div>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6 text-center">
              <div className="text-3xl font-bold text-purple-600">{formatStat('trips')}</div>
              <div className="text-sm text-gray-500 mt-1">Trips</div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
