'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { AppLayout, Card, Badge } from '@/components/ui';

const modules = [
  { 
    name: 'Bookkeeping', 
    description: 'Map transactions to your Chart of Accounts', 
    href: '/dashboard', 
    icon: '📒',
    badge: { text: '01', variant: 'success' as const },
    statKey: 'transactions'
  },
  { 
    name: 'Income', 
    description: 'Track earnings from all sources (P-4XXX)', 
    href: '/income', 
    icon: '💵',
    badge: { text: '02', variant: 'success' as const },
    statKey: 'income'
  },
  { 
    name: 'Trading', 
    description: 'Track positions, P&L, and strategies (T-XXXX)', 
    href: '/trading', 
    icon: '📊',
    badge: { text: '03', variant: 'info' as const },
    statKey: 'trading'
  },
  { 
    name: 'Home', 
    description: 'Residence costs - Rent, Utilities, Internet', 
    href: '/home', 
    icon: '🏠',
    badge: { text: '04', variant: 'warning' as const },
    statKey: 'home'
  },
  { 
    name: 'Agenda', 
    description: 'Personal costs - Build, Trading, Fitness, Community', 
    href: '/agenda', 
    icon: '📋',
    badge: { text: '05', variant: 'purple' as const },
    statKey: 'agenda'
  },
  { 
    name: 'Trips', 
    description: 'Plan trips, compare destinations, coordinate crew', 
    href: '/budgets/trips', 
    icon: '✈️',
    badge: { text: '06', variant: 'info' as const },
    statKey: 'trips'
  },
  { 
    name: 'Net Worth', 
    description: 'Assets - Debt = Equity', 
    href: '/net-worth', 
    icon: '💰',
    badge: { text: '07', variant: 'success' as const },
    statKey: 'netWorth'
  },
  { 
    name: 'Budget', 
    description: 'Master view - Home vs Nomad comparison', 
    href: '/hub/itinerary', 
    icon: '📈',
    badge: { text: '08', variant: 'purple' as const },
    statKey: 'budget'
  },
];

interface Stats {
  accounts: number;
  transactions: number;
  chartOfAccounts: number;
  trips: number;
  income?: number;
  trading?: number;
  home?: number;
  agenda?: number;
  netWorth?: number;
  budget?: number;
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
    if (!stats) return '—';
    const value = stats[key as keyof Stats];
    if (value === undefined) return '—';
    return typeof value === 'number' ? value.toLocaleString() : value;
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Welcome back{session?.user?.name ? `, ${session.user.name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-gray-500 mt-1">Financial OS for Digital Nomads</p>
        </div>

        {/* Module Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {modules.map((module) => (
            <Card 
              key={module.name}
              className="p-6 hover:shadow-lg transition-all cursor-pointer border-2 border-transparent hover:border-[#b4b237]/20"
              onClick={() => router.push(module.href)}
            >
              <div className="flex items-start justify-between mb-4">
                <span className="text-3xl">{module.icon}</span>
                <Badge variant={module.badge.variant}>{module.badge.text}</Badge>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{module.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{module.description}</p>
              <div className="text-2xl font-bold text-gray-900">
                {formatStat(module.statKey)}
              </div>
            </Card>
          ))}
        </div>

        {/* Quick Stats Bar */}
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">The Nomad Question</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Home Costs (Monthly)</div>
              <div className="text-2xl font-bold text-gray-900">$—</div>
              <div className="text-xs text-gray-400">Rent + Utilities + Internet</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500 mb-1">Nomad Costs (Monthly)</div>
              <div className="text-2xl font-bold text-gray-900">$—</div>
              <div className="text-xs text-gray-400">Avg from committed trips</div>
            </div>
            <div className="text-center p-4 bg-[#b4b237]/10 rounded-lg">
              <div className="text-sm text-[#8f8c2a] mb-1">Monthly Savings</div>
              <div className="text-2xl font-bold text-[#8f8c2a]">$—</div>
              <div className="text-xs text-[#8f8c2a]/70">Go nomad and save</div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
