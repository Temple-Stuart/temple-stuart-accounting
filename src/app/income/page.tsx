'use client';

import AppLayout from '@/components/ui/AppLayout';

export default function IncomePage() {
  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center gap-3 mb-8">
          <span className="text-4xl">💵</span>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Income</h1>
            <p className="text-gray-500">Track earnings from all sources (P-4XXX)</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500">Coming soon...</p>
        </div>
      </div>
    </AppLayout>
  );
}
