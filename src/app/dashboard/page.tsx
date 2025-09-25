'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ImportDataSection } from '@/components/dashboard/ImportDataSection';
import { DataDebugSection } from "@/components/dashboard/DataDebugSection";import { ChartOfAccountsSection } from '@/components/dashboard/ChartOfAccountsSection';
import { JournalEntriesSection } from '@/components/dashboard/JournalEntriesSection';

// Placeholder components for now
function LedgerSection({ entityId }: { entityId: string }) {
  return <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-lg font-medium mb-4">General Ledger</h2>
    <p>View posted entries in the ledger.</p>
  </div>;
}

function ReconciliationSection({ entityId }: { entityId: string }) {
  return <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-lg font-medium mb-4">Reconciliation</h2>
    <p>Match bank statements with ledger entries.</p>
  </div>;
}

function AdjustingEntriesSection({ entityId }: { entityId: string }) {
  return <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-lg font-medium mb-4">Adjusting Entries</h2>
    <p>Make period-end adjustments.</p>
  </div>;
}

function FinancialStatementsSection({ entityId }: { entityId: string }) {
  return <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-lg font-medium mb-4">Financial Statements</h2>
    <p>Generate Income Statement, Balance Sheet, Cash Flow.</p>
  </div>;
}

function ThreeStatementSection({ entityId }: { entityId: string }) {
  return <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-lg font-medium mb-4">3-Statement Analysis</h2>
    <p>Link and analyze the three statements.</p>
  </div>;
}

function MetricsSection({ entityId }: { entityId: string }) {
  return <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-lg font-medium mb-4">Metrics & Projections</h2>
    <p>Calculate ratios and project future performance.</p>
  </div>;
}

function CloseBooksSection({ entityId }: { entityId: string }) {
  return <div className="bg-white rounded-lg shadow p-6">
    <h2 className="text-lg font-medium mb-4">Close Books</h2>
    <p>Close the accounting period.</p>
  </div>;
}

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [entities, setEntities] = useState<any[]>([]);
  const [activeEntity, setActiveEntity] = useState<string>('default');
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        // For now, create a default entity
        setEntities([
          { id: 'personal', name: 'Personal', type: 'personal' },
          // { id: 'business', name: 'My Business', type: 'business' }
        ]);
        setActiveEntity('personal');
      } else {
        router.push('/');
      }
    } catch (error) {
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  };

  const pipelineSteps = [
    { id: 'import', name: '1. Import Data', icon: '📥' },
    { id: 'coa', name: '2. Chart of Accounts', icon: '📊' },
    { id: 'journal', name: '3. Journal Entries', icon: '📝' },
    { id: 'ledger', name: '4. Post to Ledger', icon: '📚' },
    { id: 'reconcile', name: '5. Reconciliation', icon: '✅' },
    { id: 'adjusting', name: '6. Adjusting Entries', icon: '🔧' },
    { id: 'statements', name: '7. Financial Statements', icon: '📈' },
    { id: 'analysis', name: '8. 3-Statement Analysis', icon: '🔗' },
    { id: 'metrics', name: '9. Metrics & Projections', icon: '📊' },
    { id: 'close', name: '10. Close Books', icon: '🔒' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">Temple Stuart Accounting</h1>
              {/* Entity Tabs */}
              <div className="flex space-x-2 ml-8">
                {entities.map(entity => (
                  <button
                    key={entity.id}
                    onClick={() => setActiveEntity(entity.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeEntity === entity.id 
                        ? 'bg-purple-600 text-white' 
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {entity.name}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar - Pipeline Steps */}
        <aside className="w-64 bg-white h-[calc(100vh-4rem)] border-r">
          <div className="p-4">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
              Accounting Pipeline
            </h3>
            <nav className="space-y-1">
              {pipelineSteps.map(step => (
                <button
                  key={step.id}
                  onClick={() => setActiveTab(step.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center space-x-2 ${
                    activeTab === step.id 
                      ? 'bg-purple-50 text-purple-700 font-medium' 
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span>{step.icon}</span>
                  <span>{step.name}</span>
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-6">
          {activeTab === 'import' && <ImportDataSection entityId={activeEntity} />}
          {activeTab === 'coa' && <ChartOfAccountsSection entityId={activeEntity} />}
          {activeTab === 'journal' && <JournalEntriesSection entityId={activeEntity} />}
          {activeTab === 'ledger' && <LedgerSection entityId={activeEntity} />}
          {activeTab === 'reconcile' && <ReconciliationSection entityId={activeEntity} />}
          {activeTab === 'adjusting' && <AdjustingEntriesSection entityId={activeEntity} />}
          {activeTab === 'statements' && <FinancialStatementsSection entityId={activeEntity} />}
          {activeTab === 'analysis' && <ThreeStatementSection entityId={activeEntity} />}
          {activeTab === 'metrics' && <MetricsSection entityId={activeEntity} />}
          {activeTab === 'close' && <CloseBooksSection entityId={activeEntity} />}
          
          {activeTab === 'overview' && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Welcome back, {user?.name}!
              </h2>
              <p className="text-gray-600 mb-4">
                Select a step from the pipeline to begin your accounting workflow.
              </p>
              <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
                <div className="flex">
                  <div className="ml-3">
                    <p className="text-sm text-blue-700">
                      <strong>Getting Started:</strong> Begin with "1. Import Data" to connect your bank accounts via Plaid, 
                      then set up your Chart of Accounts before creating journal entries.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
