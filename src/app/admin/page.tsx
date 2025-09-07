'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const [password, setPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('rfps');
  const [rfps, setRfps] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sortField, setSortField] = useState('createdAt');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filterText, setFilterText] = useState('');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const router = useRouter();

  useEffect(() => {
    const auth = sessionStorage.getItem('adminAuth');
    if (auth === 'true') {
      setIsAuthenticated(true);
      loadData();
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const response = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    
    if (response.ok) {
      setIsAuthenticated(true);
      sessionStorage.setItem('adminAuth', 'true');
      loadData();
    } else {
      alert('Wrong password');
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const rfpResponse = await fetch('/api/rfp');
      const rfpData = await rfpResponse.json();
      setRfps(rfpData);

      const userResponse = await fetch('/api/auth/users');
      const userData = await userResponse.json();
      setUsers(userData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortData = (data: any[]) => {
    return [...data].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (sortField === 'createdAt') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      }
      
      if (sortDirection === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  const filterData = (data: any[]) => {
    if (!filterText) return data;
    
    return data.filter(item => {
      const searchStr = JSON.stringify(item).toLowerCase();
      return searchStr.includes(filterText.toLowerCase());
    });
  };

  const getExpenseTierLabel = (tier: string) => {
    const tierLabels: any = {
      'tier1': 'Under $25k/mo',
      'tier2': '$25k-$75k/mo',
      'tier3': '$75k-$150k/mo',
      'tier4': 'Over $150k/mo'
    };
    return tierLabels[tier] || tier || 'N/A';
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50/30 via-white to-amber-50/20 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6 text-center bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent">
            Admin Access
          </h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="w-full px-4 py-2 border border-purple-200 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              type="submit"
              className="w-full py-2 bg-gradient-to-r from-purple-600 to-amber-500 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-amber-600"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-amber-50/30 via-white to-amber-50/20 p-8">
        <div className="text-center">Loading data...</div>
      </div>
    );
  }

  const displayData = sortData(filterData(activeTab === 'rfps' ? rfps : users));

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/30 via-white to-amber-50/20 p-8">
      <div className="max-w-full mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <button
            onClick={() => {
              sessionStorage.removeItem('adminAuth');
              router.push('/');
            }}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
          >
            Logout
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => setActiveTab('rfps')}
            className={`px-6 py-2 rounded-lg font-semibold ${
              activeTab === 'rfps'
                ? 'bg-gradient-to-r from-purple-600 to-amber-500 text-white'
                : 'bg-white text-gray-700'
            }`}
          >
            RFP Submissions ({rfps.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2 rounded-lg font-semibold ${
              activeTab === 'users'
                ? 'bg-gradient-to-r from-purple-600 to-amber-500 text-white'
                : 'bg-white text-gray-700'
            }`}
          >
            User Signups ({users.length})
          </button>
        </div>

        {/* Filter */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Filter data..."
            value={filterText}
            onChange={(e) => setFilterText(e.target.value)}
            className="px-4 py-2 border border-purple-200 rounded-lg w-full max-w-md focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            {activeTab === 'rfps' ? (
              <table className="w-full">
                <thead className="bg-gradient-to-r from-purple-600 to-amber-500 text-white">
                  <tr>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-purple-700"
                      onClick={() => handleSort('createdAt')}
                    >
                      Date {sortField === 'createdAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-purple-700"
                      onClick={() => handleSort('businessName')}
                    >
                      Business {sortField === 'businessName' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-purple-700"
                      onClick={() => handleSort('contactName')}
                    >
                      Contact {sortField === 'contactName' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-purple-700"
                      onClick={() => handleSort('email')}
                    >
                      Email {sortField === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-left">Expense Tier</th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-purple-700"
                      onClick={() => handleSort('timeline')}
                    >
                      Timeline {sortField === 'timeline' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-purple-700"
                      onClick={() => handleSort('oneTimeTotal')}
                    >
                      One-Time {sortField === 'oneTimeTotal' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-purple-700"
                      onClick={() => handleSort('monthlyTotal')}
                    >
                      Monthly {sortField === 'monthlyTotal' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((rfp: any, index: number) => (
                    <>
                      <tr key={rfp.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                        <td className="px-4 py-3 text-sm">
                          {new Date(rfp.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-semibold">{rfp.businessName}</td>
                        <td className="px-4 py-3">{rfp.contactName}</td>
                        <td className="px-4 py-3">
                          <a href={`mailto:${rfp.email}`} className="text-purple-600 hover:underline">
                            {rfp.email}
                          </a>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-semibold">
                            {getExpenseTierLabel(rfp.expenseTier)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                            rfp.timeline === 'immediate' ? 'bg-red-100 text-red-700' :
                            rfp.timeline === 'month' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            {rfp.timeline}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-bold">${rfp.oneTimeTotal.toLocaleString()}</td>
                        <td className="px-4 py-3 font-bold">${rfp.monthlyTotal.toLocaleString()}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => setExpandedRow(expandedRow === rfp.id ? null : rfp.id)}
                            className="text-purple-600 hover:text-purple-800 text-sm font-semibold"
                          >
                            {expandedRow === rfp.id ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>
                      {expandedRow === rfp.id && (
                        <tr className="bg-purple-50">
                          <td colSpan={9} className="px-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <h4 className="font-semibold text-purple-700 mb-2">Selected Services:</h4>
                                {rfp.services && Array.isArray(rfp.services) ? (
                                  <ul className="space-y-1">
                                    {rfp.services.map((service: any, idx: number) => (
                                      <li key={idx} className="text-sm">
                                        <span className="font-medium">{service.name}</span> - 
                                        <span className="text-purple-600 ml-2">{service.price}</span>
                                        <span className="text-gray-500 ml-2">({service.frequency})</span>
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="text-gray-500">No services selected</p>
                                )}
                              </div>
                              <div>
                                <h4 className="font-semibold text-purple-700 mb-2">Client Needs:</h4>
                                <p className="text-sm text-gray-700 bg-white p-3 rounded">{rfp.needs || 'Not specified'}</p>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full">
                <thead className="bg-gradient-to-r from-purple-600 to-amber-500 text-white">
                  <tr>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-purple-700"
                      onClick={() => handleSort('createdAt')}
                    >
                      Signup Date {sortField === 'createdAt' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-purple-700"
                      onClick={() => handleSort('name')}
                    >
                      Name {sortField === 'name' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th 
                      className="px-4 py-3 text-left cursor-pointer hover:bg-purple-700"
                      onClick={() => handleSort('email')}
                    >
                      Email {sortField === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-3 text-left">Accounts Connected</th>
                  </tr>
                </thead>
                <tbody>
                  {displayData.map((user: any, index: number) => (
                    <tr key={user.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="px-4 py-3">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 font-semibold">{user.name}</td>
                      <td className="px-4 py-3">
                        <a href={`mailto:${user.email}`} className="text-purple-600 hover:underline">
                          {user.email}
                        </a>
                      </td>
                      <td className="px-4 py-3">{user.accounts?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
