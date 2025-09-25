'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeveloperDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [prospects, setProspects] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'clients' | 'prospects'>('clients');
  const router = useRouter();

  const DEV_PASSWORD = 'temple2024'; // Change this to your preferred password

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
    // Load registered users (clients)
    try {
      const res = await fetch('/api/developer/clients');
      if (res.ok) {
        const data = await res.json();
        setClients(data);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    }

    // Load RFP submissions (prospects)
    try {
      const res = await fetch('/api/developer/prospects');
      if (res.ok) {
        const data = await res.json();
        setProspects(data);
      }
    } catch (error) {
      console.error('Error loading prospects:', error);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="bg-white border border-gray-100 rounded-xl p-8 shadow-sm w-full max-w-md">
          <h1 className="text-2xl font-light text-gray-900 mb-6">Developer Access</h1>
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
              className="w-full py-2 bg-[#b4b237] text-white rounded-lg hover:bg-[#9a9630] transition-colors"
            >
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <nav className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-2xl font-light text-gray-900">Developer Dashboard</h1>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-900 font-medium"
            >
              Back to Site
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="border-b border-gray-100 mb-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('clients')}
              className={`pb-4 text-sm font-medium transition-all ${
                activeTab === 'clients'
                  ? 'border-b-2 border-[#b4b237] text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Clients ({clients.length})
            </button>
            <button
              onClick={() => setActiveTab('prospects')}
              className={`pb-4 text-sm font-medium transition-all ${
                activeTab === 'prospects'
                  ? 'border-b-2 border-[#b4b237] text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Prospects ({prospects.length})
            </button>
          </div>
        </div>

        {/* Clients Table */}
        {activeTab === 'clients' && (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Accounts
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {client.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {client.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(client.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {client._count?.accounts || 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                        Active
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Prospects Table */}
        {activeTab === 'prospects' && (
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Business
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Services
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timeline
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {prospects.map((prospect) => (
                  <tr key={prospect.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {prospect.businessName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {prospect.contactName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {prospect.email}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {prospect.selectedServices?.length || 0} services
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {prospect.timeline}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(prospect.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
