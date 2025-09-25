'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ImportDataSection } from '@/components/dashboard/ImportDataSection';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [selectedEntity, setSelectedEntity] = useState('personal');
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        router.push('/');
      }
    } catch (error) {
      router.push('/');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Header - matching homepage style */}
      <nav className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-light text-gray-900">Temple Stuart Accounting</h1>
              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedEntity('personal')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                    selectedEntity === 'personal'
                      ? 'bg-[#b4b237] text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Personal
                </button>
                <button
                  onClick={() => setSelectedEntity('business')}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                    selectedEntity === 'business'
                      ? 'bg-[#b4b237] text-white'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Business
                </button>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-1.5 text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - matching homepage minimal style */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-gray-100 rounded-xl p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b4b237] mb-4">
                Accounting Pipeline
              </p>
              <nav className="space-y-1">
                {[
                  { num: '1', label: 'Import Data', active: true },
                  { num: '2', label: 'Chart of Accounts' },
                  { num: '3', label: 'Journal Entries' },
                  { num: '4', label: 'Post to Ledger' },
                  { num: '5', label: 'Reconciliation' },
                  { num: '6', label: 'Adjusting Entries' },
                  { num: '7', label: 'Financial Statements' },
                  { num: '8', label: '3-Statement Analysis' },
                  { num: '9', label: 'Metrics & Projections' },
                  { num: '10', label: 'Close Books' },
                ].map((item) => (
                  <button
                    key={item.num}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all flex items-center gap-3 ${
                      item.active
                        ? 'bg-[#b4b237]/10 text-gray-900 font-medium'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                      item.active ? 'bg-[#b4b237] text-white' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {item.num}
                    </span>
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            <ImportDataSection entityId={selectedEntity} />
          </div>
        </div>
      </div>
    </div>
  );
}
