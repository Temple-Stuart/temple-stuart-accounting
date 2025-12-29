'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import AppLayout from '@/components/AppLayout';
import AppFrame from '@/components/AppFrame';

const modules = [
  { 
    name: 'Bookkeeping', 
    description: 'Double-entry ledger & financial statements', 
    href: '/dashboard', 
    icon: '📒',
    color: 'green',
    number: '01',
    features: ['Bank sync via Plaid', 'Double-entry ledger', 'Income statement & balance sheet']
  },
  { 
    name: 'Agenda & Budget', 
    description: 'Plan trips, split expenses, track costs', 
    href: '/budgets/trips', 
    icon: '✈️',
    color: 'blue',
    number: '02',
    features: ['Activity-based destination search', 'Group RSVP & availability', 'Shared expense tracking']
  },
  { 
    name: 'Budget Review', 
    description: 'Budget by category, plan your year', 
    href: '/hub/itinerary', 
    icon: '📅',
    color: 'purple',
    number: '03',
    features: ['Monthly targets by category', 'YTD actuals vs budget', 'Visual progress bars']
  },
];

const colorClasses: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
};

export default function HubPage() {
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.user?.email) {
      document.cookie = `userEmail=${session.user.email}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    }
  }, [session]);

  return (
    <AppLayout showBack={false}>
      <div className="text-center mb-12">
        <h1 className="text-4xl sm:text-5xl font-extralight text-gray-900 tracking-tight mb-4">
          What would you like to do?
        </h1>
        <p className="text-lg text-gray-500 font-light">
          Welcome back, {session?.user?.name || session?.user?.email?.split('@')[0]}
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {modules.map((module) => (
          <AppFrame key={module.name} title={module.name}>
            <button
              onClick={() => router.push(module.href)}
              className="w-full text-left group"
            >
              <div className="bg-white rounded-xl border border-gray-200 p-6 hover:border-[#b4b237] hover:shadow-lg transition-all">
                <div className="flex items-center gap-4 mb-4">
                  <div className="text-4xl">{module.icon}</div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colorClasses[module.color]}`}>
                    {module.number}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-gray-900 group-hover:text-[#b4b237] transition-colors mb-2">
                  {module.name}
                </h2>
                <p className="text-gray-500 text-sm mb-4">{module.description}</p>
                <ul className="space-y-2">
                  {module.features.map((feature, i) => (
                    <li key={i} className="flex items-center text-sm text-gray-600">
                      <div className="w-4 h-4 rounded-full bg-[#b4b237]/10 flex items-center justify-center mr-2">
                        <svg className="w-2.5 h-2.5 text-[#b4b237]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      {feature}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 flex items-center text-[#b4b237] font-medium text-sm group-hover:translate-x-1 transition-transform">
                  Open
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>
            </button>
          </AppFrame>
        ))}
      </div>
    </AppLayout>
  );
}
