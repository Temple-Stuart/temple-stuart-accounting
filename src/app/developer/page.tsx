'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeveloperDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [prospects, setProspects] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'clients' | 'prospects'>('overview');
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedProspect, setSelectedProspect] = useState<any>(null);
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
      const clientsRes = await fetch('/api/developer/clients');
      if (clientsRes.ok) {
        const data = await clientsRes.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    }

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

  // Calculate metrics
  const totalRevenue = clients.reduce((sum, client) => {
    const accountCount = client._count?.accounts || 0;
    const transactionCount = client._count?.transactions || 0;
    // Estimate monthly revenue based on activity
    return sum + (accountCount * 50) + (transactionCount * 0.1);
  }, 0);

  const activeClients = clients.filter(c => c._count?.accounts > 0).length;
  const totalAccounts = clients.reduce((sum, c) => sum + (c._count?.accounts || 0), 0);
  const totalTransactions = clients.reduce((sum, c) => sum + (c._count?.transactions || 0), 0);

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
              <h1 className="text-2xl font-light text-gray-900">Business Intelligence</h1>
              <div className="flex space-x-1">
                {['overview', 'clients', 'prospects'].map((tab) => (
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
            {/* Metrics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Monthly Revenue
                </p>
                <p className="text-3xl font-light text-gray-900">
                  ${totalRevenue.toFixed(0)}
                </p>
                <p className="text-xs text-green-600 mt-2">+12% from last month</p>
              </div>
              
              <div className="bg-white p-6 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Active Clients
                </p>
                <p className="text-3xl font-light text-gray-900">{activeClients}</p>
                <p className="text-xs text-gray-500 mt-2">of {clients.length} total</p>
              </div>
              
              <div className="bg-white p-6 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Connected Accounts
                </p>
                <p className="text-3xl font-light text-gray-900">{totalAccounts}</p>
                <p className="text-xs text-gray-500 mt-2">across all clients</p>
              </div>
              
              <div className="bg-white p-6 rounded-xl border border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
                  Total Transactions
                </p>
                <p className="text-3xl font-light text-gray-900">
                  {totalTransactions.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-2">this month</p>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl border border-gray-100">
              <div className="p-6 border-b border-gray-100">
                <h3 className="text-lg font-light text-gray-900">Recent Activity</h3>
              </div>
              <div className="divide-y divide-gray-100">
                {clients.slice(0, 5).map((client) => (
                  <div key={client.id} className="p-6 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-900">{client.name}</p>
                      <p className="text-sm text-gray-500">{client.email}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {client._count?.accounts || 0} accounts
                      </p>
                      <p className="text-xs text-gray-500">
                        Joined {new Date(client.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Clients Tab */}
        {activeTab === 'clients' && (
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-light text-gray-900">
                  Registered Clients ({clients.length})
                </h3>
                <button className="text-sm text-[#b4b237] hover:text-[#9a9630]">
                  Export CSV
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Client
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Accounts
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Transactions
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Last Active
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clients.map((client) => (
                    <tr key={client.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{client.name}</p>
                          <p className="text-xs text-gray-500">{client.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">
                          {client._count?.accounts || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-900">
                          {client._count?.transactions || 0}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm text-gray-500">
                          {client.updatedAt 
                            ? new Date(client.updatedAt).toLocaleDateString()
                            : 'Never'
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">
                          ${((client._count?.accounts || 0) * 50).toFixed(0)}/mo
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => setSelectedClient(client)}
                          className="text-xs text-[#b4b237] hover:text-[#9a9630]"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Prospects Tab */}
        {activeTab === 'prospects' && (
          <div className="bg-white rounded-xl border border-gray-100">
            <div className="p-6 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-light text-gray-900">
                  Sales Pipeline ({prospects.length})
                </h3>
                <button className="text-sm text-[#b4b237] hover:text-[#9a9630]">
                  Export CSV
                </button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Business
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Services Needed
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Est. Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timeline
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
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
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm text-gray-900">{prospect.contactName}</p>
                          <p className="text-xs text-gray-500">{prospect.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-gray-900">{prospect.needs || 'Not specified'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-gray-900">
                          ${prospect.totals?.monthly || 0}/mo
                        </span>
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
                        <select className="text-xs border border-gray-200 rounded px-2 py-1">
                          <option>New</option>
                          <option>Contacted</option>
                          <option>Qualified</option>
                          <option>Proposal</option>
                          <option>Won</option>
                          <option>Lost</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Client Details Modal */}
        {selectedClient && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 w-full max-w-2xl">
              <h3 className="text-xl font-light text-gray-900 mb-4">{selectedClient.name}</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    <p className="text-sm">{selectedClient.email}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Joined</p>
                    <p className="text-sm">{new Date(selectedClient.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                {/* Add more client details here */}
              </div>
              <button
                onClick={() => setSelectedClient(null)}
                className="mt-6 px-4 py-2 bg-gray-100 rounded-lg text-sm"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
