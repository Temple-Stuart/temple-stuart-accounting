'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import AppLayout from '@/components/AppLayout';

const modules = [
  { 
    name: 'Bookkeeping', 
    description: 'Double-entry ledger & financial statements', 
    href: '/dashboard', 
    icon: '📒',
    color: 'green',
    number: '01'
  },
  { 
    name: 'Agenda & Budget', 
    description: 'Plan trips, split expenses, track costs', 
    href: '/budgets/trips', 
    icon: '✈️',
    color: 'blue',
    number: '02'
  },
  { 
    name: 'Budget Review', 
    description: 'Budget by category, plan your year', 
    href: '/hub/itinerary', 
    icon: '📅',
    color: 'purple',
    number: '03'
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
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="text-center mb-16">
          <h1 className="text-4xl sm:text-5xl font-extralight text-gray-900 tracking-tight mb-4">
            What would you like to do?
          </h1>
          <p className="text-lg text-gray-500 font-light">
            Welcome back, {session?.user?.name || session?.user?.email?.split('@')[0]}
          </p>
        </div>

        <div className="grid gap-6">
          {modules.map((module) => (
            <button
              key={module.name}
              onClick={() => router.push(module.href)}
              className="group bg-white rounded-2xl border border-gray-200 p-8 text-left hover:border-[#b4b237] hover:shadow-2xl hover:shadow-[#b4b237]/10 transition-all duration-300"
            >
              <div className="flex items-center gap-6">
                <div className="text-5xl">{module.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${colorClasses[module.color]}`}>
                      {module.number}
                    </span>
                  </div>
                  <h2 className="text-2xl font-light text-gray-900 group-hover:text-[#b4b237] transition-colors">
                    {module.name}
                  </h2>
                  <p className="text-gray-500 font-light mt-1">{module.description}</p>
                </div>
                <div className="text-gray-300 group-hover:text-[#b4b237] group-hover:translate-x-2 transition-all">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
