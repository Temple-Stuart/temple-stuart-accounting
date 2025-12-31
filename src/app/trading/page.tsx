'use client';

import AppLayout from '@/components/ui/AppLayout';

export default function TradingPage() {
  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-4xl">📊</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Trading</h1>
            <p className="text-gray-500">Track positions, P&L, and strategies (T-XXXX)</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">Coming soon...</p>
        </div>
      </div>
    </AppLayout>
  );
}
