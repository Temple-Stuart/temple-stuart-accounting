'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeveloperDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [prospects, setProspects] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'prospects' | 'clients'>('overview');
  const router = useRouter();

  const DEV_PASSWORD = 'temple2024';

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

    try {
      const clientsRes = await fetch('/api/developer/clients');
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const updateProspectStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/developer/prospects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      loadData();
    } catch (error) {
      console.error('Error updating status:', error);
    }
  };

  const deleteProspect = async (id: string) => {
    if (confirm('Delete this prospect?')) {
      try {
        await fetch(`/api/developer/prospects/${id}`, {
          method: 'DELETE'
        });
        loadData();
      } catch (error) {
        console.error('Error deleting prospect:', error);
      }
    }
  };

  const pipelineStages = {
    new: prospects.filter(p => p.status === 'new').length,
    contacted: prospects.filter(p => p.status === 'contacted').length,
    qualified: prospects.filter(p => p.status === 'qualified').length,
    proposal: prospects.filter(p => p.status === 'proposal').length,
    won: prospects.filter(p => p.status === 'won').length,
    lost: prospects.filter(p => p.status === 'lost').length
  };

  const totalPipeline = prospects.reduce((sum, p) => sum + (p.monthlyValue || 0), 0);
  const hotLeads = prospects.filter(p => p.timeline === 'immediate');

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
      <nav className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-2xl font-light text-gray-900">Business Dashboard</h1>
              <div className="flex space-x-1">
                {['overview', 'prospects', 'clients'].map((tab) => (
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
            <div className="bg-white rounded-xl border border-gray-100 p-6">
              <h3 className="text-lg font-light text-gray-900 mb-4">Sales Pipeline</h3>
              <div className="grid grid-cols-6 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-light">{pipelineStages.new}</p>
                  <p className="text-xs text-gray-500">New</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-light">{pipelineStages.contacted}</p>
                  <p className="text-xs text-gray-500">Contacted</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-light">{pipelineStages.qualified}</p>
                  <p className="text-xs text-gray-500">Qualified</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-light">{pipelineStages.proposal}</p>
                  <p className="text-xs text-gray-500">Proposal</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-light text-green-600">{pipelineStages.won}</p>
                  <p className="text-xs text-gray-500">Won</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-light text-red-600">{pipelineStages.lost}</p>
                  <p className="text-xs text-gray-500">Lost</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Total Prospects
                </p>
                <p className="text-3xl font-light text-gray-900">{prospects.length}</p>
              </div>
              
              <div className="bg-white p-6 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Pipeline Value
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
                <p className="text-3xl font-light text-gray-900">{hotLeads.length}</p>
                <p className="text-xs text-red-600 mt-2">immediate timeline</p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-light text-gray-900">Active Clients</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {clients.slice(0, 10).map((client) => (
                  <div key={client.id} className="p-4 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{client.name}</p>
                      <p className="text-sm text-gray-600">{client.email}</p>
                    </div>
                    <p className="text-sm text-gray-500">
                      Joined {new Date(client.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
                {clients.length === 0 && (
                  <div className="p-6 text-center text-gray-500">
                    No clients registered yet
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Prospects Tab */}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Business
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Pipeline Info
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {prospects.map((prospect) => (
                    <tr key={prospect.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{prospect.businessName}</p>
                        <p className="text-xs text-gray-500">{prospect.expenseTier}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm">{prospect.contactName}</p>
                        <p className="text-xs text-gray-600">{prospect.email}</p>
                        <p className="text-xs text-gray-600">{prospect.phone}</p>
                      </td>
                      <td className="px-6 py-4 text-xs">
                        <p>Banks: {prospect.numBankAccounts || 'N/A'}</p>
                        <p>Cards: {prospect.numCreditCards || 'N/A'}</p>
                        <p>Txns: {prospect.monthlyTransactions || 'N/A'}</p>
                        <p>Current: {prospect.currentBookkeeping || 'None'}</p>
                        <p>Pain: {prospect.biggestPainPoint || 'None'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-lg font-medium">${prospect.monthlyValue || 0}</p>
                        <p className="text-xs text-gray-500">{prospect.timeline}</p>
                      </td>
                      <td className="px-6 py-4">
                        <select 
                          value={prospect.status}
                          onChange={(e) => updateProspectStatus(prospect.id, e.target.value)}
                          className="text-xs border rounded px-2 py-1"
                        >
                          <option value="new">New</option>
                          <option value="contacted">Contacted</option>
                          <option value="qualified">Qualified</option>
                          <option value="proposal">Proposal</option>
                          <option value="won">Won</option>
                          <option value="lost">Lost</option>
                        </select>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => deleteProspect(prospect.id)}
                          className="text-xs text-red-600 hover:text-red-800"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Clients Tab */}
        {activeTab === 'clients' && (
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-light text-gray-900">
                Active Clients ({clients.length})
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Accounts
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Joined
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="text-sm font-medium text-gray-900">{client.name}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">{client.email}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm">{client._count?.accounts || 0}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-600">
                          {new Date(client.createdAt).toLocaleDateString()}
                        </p>
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
