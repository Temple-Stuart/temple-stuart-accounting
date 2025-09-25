'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeveloperDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [prospects, setProspects] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'prospects'>('overview');
  const router = useRouter();

  const DEV_PASSWORD = 'temple2024'; // Password still here!

  useEffect(() => {
    const devAuth = sessionStorage.getItem('devAuth');
    if (devAuth === 'true') {
      setAuthenticated(true);
      loadData();
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === DEV_PASSWORD) {
      sessionStorage.setItem('devAuth', 'true');
      setAuthenticated(true);
      loadData();
    } else {
      alert('Invalid password');
    }
  };

  const loadData = async () => {
    try {
      const prospectsRes = await fetch('/api/developer/prospects');
      if (prospectsRes.ok) {
        const data = await prospectsRes.json();
        setProspects(data);
      }
    } catch (error) {
      console.error('Error loading prospects:', error);
    }
  };

  // Calculate total pipeline value
  const totalPipeline = prospects.reduce((sum, p) => sum + (p.monthlyValue || 0), 0);
  const newProspects = prospects.filter(p => {
    const created = new Date(p.createdAt);
    const daysSince = (Date.now() - created.getTime()) / (1000 * 3600 * 24);
    return daysSince <= 7;
  });

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="bg-white border border-gray-100 rounded-xl p-8 shadow-sm w-full max-w-md">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#b4b237] mb-4">
            Developer Access
          </p>
          <h1 className="text-2xl font-light text-gray-900 mb-6">Authentication Required</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter developer password"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg mb-4 focus:outline-none focus:border-[#b4b237]"
            />
            <button
              type="submit"
              className="w-full py-2 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white rounded-full hover:shadow-xl transition-all"
            >
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-light text-gray-900">Prospect Pipeline</h1>
              <div className="flex space-x-1">
                {['overview', 'prospects'].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab as any)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all capitalize ${
                      activeTab === tab
                        ? 'bg-[#b4b237] text-white'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => router.push('/')}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Back to Site
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Pipeline Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  New This Week
                </p>
                <p className="text-3xl font-light text-gray-900">
                  {newProspects.length}
                </p>
                <p className="text-xs text-gray-500 mt-2">prospects</p>
              </div>
              
              <div className="bg-white p-6 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Total Pipeline Value
                </p>
                <p className="text-3xl font-light text-gray-900">
                  ${totalPipeline.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-2">per month</p>
              </div>
              
              <div className="bg-white p-6 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Hot Leads
                </p>
                <p className="text-3xl font-light text-gray-900">
                  {prospects.filter(p => p.timeline === 'immediate').length}
                </p>
                <p className="text-xs text-red-600 mt-2">need immediate help</p>
              </div>
            </div>

            {/* New Prospects List */}
            <div className="bg-white rounded-xl border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-light text-gray-900">Latest Prospects</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {prospects.slice(0, 5).map((prospect) => (
                  <div key={prospect.id} className="p-6">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-900">{prospect.businessName}</p>
                        <p className="text-sm text-gray-600">{prospect.contactName} • {prospect.email}</p>
                        <p className="text-xs text-gray-500 mt-1">Needs: {prospect.needs}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-light text-gray-900">
                          ${prospect.monthlyValue}/mo
                        </p>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          prospect.timeline === 'immediate' 
                            ? 'bg-red-100 text-red-800'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {prospect.timeline}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Prospects Tab - Full Details */}
        {activeTab === 'prospects' && (
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-light text-gray-900">
                All Prospects ({prospects.length})
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Business
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Pipeline Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Monthly Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timeline
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Files
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {prospects.map((prospect) => (
                    <tr key={prospect.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">
                          {prospect.businessName}
                        </p>
                        <p className="text-xs text-gray-500">
                          {prospect.expenseTier && `Tier: ${prospect.expenseTier}`}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{prospect.contactName}</p>
                        <p className="text-xs text-gray-600">{prospect.email}</p>
                        <p className="text-xs text-gray-600">{prospect.phone}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-xs text-gray-700">
                          Banks: {prospect.numBankAccounts || 'N/A'}<br/>
                          Cards: {prospect.numCreditCards || 'N/A'}<br/>
                          Txns/mo: {prospect.monthlyTransactions || 'N/A'}<br/>
                          Payroll: {prospect.hasPayroll || 'N/A'}<br/>
                          Current: {prospect.currentBookkeeping || 'None'}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Pain: {prospect.biggestPainPoint || 'Not specified'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-lg font-medium text-gray-900">
                          ${prospect.monthlyValue || 0}
                        </p>
                        <p className="text-xs text-gray-500">
                          {prospect.frequency || 'monthly'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          prospect.timeline === 'immediate' 
                            ? 'bg-red-100 text-red-800'
                            : prospect.timeline === 'month'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {prospect.timeline}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {prospect.files && prospect.files.length > 0 ? (
                          <span className="text-xs text-[#b4b237]">
                            {prospect.files.length} files
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
