'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';

const modules = [
  { name: 'Bookkeeping', description: 'Double-entry ledger & financial statements', href: '/dashboard', icon: '📒' },
  { name: 'Agenda & Budget', description: 'Plan trips, split expenses, track costs', href: '/budgets/trips', icon: '✈️' },
  { name: 'Budget Review', description: 'Budget by category, plan your year', href: '/hub/itinerary', icon: '📅' },
];

export default function HubPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    // Set cookie when session is available
    if (session?.user?.email) {
      document.cookie = `userEmail=${session.user.email}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
    }
  }, [session]);

  // Redirect to home if not logged in
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#b4b237] rounded-lg flex items-center justify-center">
              <span className="text-white font-bold">TS</span>
            </div>
            <div className="hidden sm:block">
              <div className="font-semibold text-gray-900">Temple Stuart OS</div>
              <div className="text-xs text-gray-400">Welcome, {session?.user?.name || session?.user?.email}</div>
            </div>
          </div>
          <button 
            onClick={() => router.push('/')}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← Back
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-light text-gray-900 mb-8 text-center">
          What would you like to do?
        </h1>

        <div className="grid gap-4">
          {modules.map((module) => (
            <button
              key={module.name}
              onClick={() => router.push(module.href)}
              className="bg-white rounded-xl border border-gray-200 p-6 text-left hover:border-[#b4b237] hover:shadow-lg transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="text-4xl">{module.icon}</div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 group-hover:text-[#b4b237] transition-colors">
                    {module.name}
                  </h2>
                  <p className="text-gray-500">{module.description}</p>
                </div>
                <div className="ml-auto text-gray-300 group-hover:text-[#b4b237] transition-colors">
                  →
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
