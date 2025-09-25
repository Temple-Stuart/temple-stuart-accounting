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
      <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-600 to-purple-900">
      {/* Navigation Header - matching homepage style */}
      <nav className="bg-white/10 backdrop-blur-sm border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-bold text-white">Temple Stuart Accounting</h1>
              <div className="flex space-x-2">
                <button
                  onClick={() => setSelectedEntity('personal')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedEntity === 'personal'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  Personal
                </button>
                <button
                  onClick={() => setSelectedEntity('business')}
                  className={`px-4 py-2 rounded-lg font-medium transition-all ${
                    selectedEntity === 'business'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white/10 text-white/80 hover:bg-white/20'
                  }`}
                >
                  Business
                </button>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - matching homepage card style */}
          <div className="lg:col-span-1">
            <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Accounting Pipeline</h2>
              <nav className="space-y-2">
                {[
                  { icon: '📊', label: 'Import Data', active: true },
                  { icon: '📈', label: 'Chart of Accounts' },
                  { icon: '📝', label: 'Journal Entries' },
                  { icon: '📚', label: 'Post to Ledger' },
                  { icon: '✅', label: 'Reconciliation' },
                  { icon: '🔧', label: 'Adjusting Entries' },
                  { icon: '📑', label: 'Financial Statements' },
                  { icon: '📊', label: '3-Statement Analysis' },
                  { icon: '📊', label: 'Metrics & Projections' },
                  { icon: '📕', label: 'Close Books' },
                ].map((item, idx) => (
                  <button
                    key={idx}
                    className={`w-full text-left px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                      item.active
                        ? 'bg-purple-500 text-white'
                        : 'text-gray-700 hover:bg-purple-50'
                    }`}
                  >
                    <span>{item.icon}</span>
                    <span className="text-sm font-medium">{idx + 1}. {item.label}</span>
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
