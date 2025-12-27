'use client';

import { useRouter } from 'next/navigation';

const modules = [
  { name: 'Bookkeeping', description: 'Double-entry ledger & financial statements', href: '/dashboard', icon: '📒' },
  { name: 'Trip Budget', description: 'Plan trips, split expenses, track costs', href: '/budgets/trips', icon: '✈️' },
  { name: 'Itinerary Builder', description: 'Budget by category, plan your year', href: '/hub/itinerary', icon: '📅' },
];

export default function HubPage() {
  const router = useRouter();

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
              <div className="text-xs text-gray-400">Command Hub</div>
            </div>
          </div>
          <button 
            onClick={() => router.push('/')}
            className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
          >
            ← Home
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="space-y-3">
          {modules.map((mod) => (
            <button
              key={mod.name}
              onClick={() => router.push(mod.href)}
              className="w-full text-left px-6 py-5 rounded-xl border bg-white border-gray-200 hover:border-[#b4b237] hover:shadow-md cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-4">
                <span className="text-3xl">{mod.icon}</span>
                <div className="flex-1">
                  <span className="font-semibold text-gray-900 group-hover:text-[#b4b237] text-lg">
                    {mod.name}
                  </span>
                  <p className="text-sm text-gray-500">{mod.description}</p>
                </div>
                <span className="text-gray-400 group-hover:text-[#b4b237] transition-colors text-xl">→</span>
              </div>
            </button>
          ))}
        </div>
        <div className="mt-12 text-center">
          <p className="text-xs text-gray-400">More modules coming soon</p>
        </div>
      </main>
    </div>
  );
}
