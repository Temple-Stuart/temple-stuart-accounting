'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DeveloperDashboard() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [prospects, setProspects] = useState<any[]>([]);
  const [selectedProspect, setSelectedProspect] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'prospects' | 'clients'>('prospects');
  
  // Client login state
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [clientPassword, setClientPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const DEV_PASSWORD = 'temple2024';

  useEffect(() => {
    const devAuth = sessionStorage.getItem('devAuth');
    if (devAuth === 'true') {
      setAuthenticated(true);
      loadProspects();
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === DEV_PASSWORD) {
      sessionStorage.setItem('devAuth', 'true');
      setAuthenticated(true);
      loadProspects();
    } else {
      alert('Invalid password');
    }
  };

  const loadProspects = async () => {
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

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/developer/prospects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      loadProspects();
      if (selectedProspect?.id === id) {
        setSelectedProspect({ ...selectedProspect, status });
      }
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
        loadProspects();
        setSelectedProspect(null);
      } catch (error) {
        console.error('Error deleting:', error);
      }
    }
  };

  const handleClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const body = isLogin 
        ? { email, password: clientPassword }
        : { email, password: clientPassword, name };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Success! Redirecting to dashboard...');
        setTimeout(() => router.push('/dashboard'), 1000);
      } else {
        setMessage(data.error || 'Something went wrong');
      }
    } catch (error) {
      setMessage('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-bg-row flex items-center justify-center p-4">
        <div className="bg-white rounded p-8 shadow-sm w-full max-w-md">
          <h1 className="text-sm font-light text-text-primary mb-6">Developer Access</h1>
          <form onSubmit={handleLogin}>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-4 py-3 border border-border rounded mb-4 focus:outline-none focus:border-brand-accent"
            />
            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-brand-accent to-brand-accent-dark text-white rounded hover:shadow-sm transition-all"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-row">
      <nav className="bg-white border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <h1 className="text-sm font-light text-text-primary">Developer Dashboard</h1>
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('prospects')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === 'prospects'
                    ? 'bg-brand-accent text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Prospects ({prospects.length})
              </button>
              <button
                onClick={() => setActiveTab('clients')}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === 'clients'
                    ? 'bg-purple-600 text-white'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                Client Login
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {activeTab === 'prospects' && (
          <div className="grid grid-cols-3 gap-6">
            
            {/* Prospects List */}
            <div className="col-span-1 bg-white rounded border border-border overflow-hidden">
              <div className="p-4 border-b border-border">
                <h2 className="font-medium text-text-primary">All Prospects</h2>
              </div>
              <div className="divide-y divide-border max-h-[calc(100vh-200px)] overflow-y-auto">
                {prospects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProspect(p)}
                    className={`w-full p-4 text-left hover:bg-bg-row transition-all ${
                      selectedProspect?.id === p.id ? 'bg-brand-accent/5 border-l-4 border-brand-accent' : ''
                    }`}
                  >
                    <p className="font-medium text-text-primary">{p.contactName}</p>
                    <p className="text-sm text-text-secondary">{p.businessName || 'Personal'}</p>
                    <div className="flex justify-between items-center mt-2">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        p.status === 'new' ? 'bg-brand-purple-wash text-brand-purple' :
                        p.status === 'contacted' ? 'bg-yellow-100 text-yellow-700' :
                        p.status === 'qualified' ? 'bg-green-100 text-brand-green' :
                        p.status === 'proposal' ? 'bg-purple-100 text-purple-700' :
                        p.status === 'won' ? 'bg-green-600 text-white' :
                        'bg-red-100 text-brand-red'
                      }`}>
                        {p.status}
                      </span>
                      <span className="text-xs text-text-muted">{p.expenseTier || 'No budget'}</span>
                    </div>
                  </button>
                ))}
                {prospects.length === 0 && (
                  <div className="p-8 text-center text-text-muted">
                    No prospects yet
                  </div>
                )}
              </div>
            </div>

            {/* Prospect Details */}
            <div className="col-span-2 bg-white rounded border border-border">
              {selectedProspect ? (
                <div>
                  <div className="p-6 border-b border-border">
                    <div className="flex justify-between items-start">
                      <div>
                        <h2 className="text-sm font-light text-text-primary">{selectedProspect.contactName}</h2>
                        <p className="text-text-secondary">{selectedProspect.businessName || 'Personal Project'}</p>
                        <p className="text-sm text-text-muted mt-1">{selectedProspect.email}</p>
                      </div>
                      <button
                        onClick={() => deleteProspect(selectedProspect.id)}
                        className="text-sm text-brand-red hover:text-red-800"
                      >
                        Delete
                      </button>
                    </div>
                    
                    <div className="mt-4">
                      <label className="text-xs text-text-muted uppercase">Status</label>
                      <select
                        value={selectedProspect.status}
                        onChange={(e) => updateStatus(selectedProspect.id, e.target.value)}
                        className="mt-1 w-full px-3 py-2 border border-border rounded focus:outline-none focus:border-brand-accent"
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="qualified">Qualified</option>
                        <option value="proposal">Proposal Sent</option>
                        <option value="won">Won</option>
                        <option value="lost">Lost</option>
                      </select>
                    </div>
                  </div>

                  <div className="p-6 space-y-6 max-h-[calc(100vh-300px)] overflow-y-auto">
                    
                    {/* Investment & Timeline */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-text-muted uppercase">Budget</label>
                        <p className="text-terminal-lg font-medium text-text-primary">{selectedProspect.expenseTier || 'Not specified'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-text-muted uppercase">Timeline</label>
                        <p className="text-terminal-lg font-medium text-text-primary">{selectedProspect.timeline || 'Not specified'}</p>
                      </div>
                    </div>

                    {/* Problem */}
                    {selectedProspect.problem && (
                      <div>
                        <label className="text-xs text-text-muted uppercase font-semibold">What's NOT Working</label>
                        <p className="mt-2 text-text-primary whitespace-pre-wrap">{selectedProspect.problem}</p>
                      </div>
                    )}

                    {/* Dream System */}
                    {selectedProspect.dreamSystem && (
                      <div>
                        <label className="text-xs text-text-muted uppercase font-semibold">Dream System</label>
                        <p className="mt-2 text-text-primary whitespace-pre-wrap">{selectedProspect.dreamSystem}</p>
                      </div>
                    )}

                    {/* Enablement */}
                    {selectedProspect.enablement && (
                      <div>
                        <label className="text-xs text-text-muted uppercase font-semibold">What It Enables</label>
                        <p className="mt-2 text-text-primary whitespace-pre-wrap">{selectedProspect.enablement}</p>
                      </div>
                    )}

                    {/* System Type */}
                    {selectedProspect.systemType && (
                      <div>
                        <label className="text-xs text-text-muted uppercase font-semibold">System Type</label>
                        <p className="mt-2 text-text-primary">{selectedProspect.systemType}</p>
                      </div>
                    )}

                    {/* Current Tools */}
                    {selectedProspect.currentTools && (
                      <div>
                        <label className="text-xs text-text-muted uppercase font-semibold">Current Tools</label>
                        <p className="mt-2 text-text-primary whitespace-pre-wrap">{selectedProspect.currentTools}</p>
                      </div>
                    )}

                    {/* Has Data */}
                    {selectedProspect.hasData && (
                      <div>
                        <label className="text-xs text-text-muted uppercase font-semibold">Data Status</label>
                        <p className="mt-2 text-text-primary">{selectedProspect.hasData}</p>
                      </div>
                    )}

                    {/* Why Now */}
                    {selectedProspect.whyNow && (
                      <div>
                        <label className="text-xs text-text-muted uppercase font-semibold">Why Now</label>
                        <p className="mt-2 text-text-primary whitespace-pre-wrap">{selectedProspect.whyNow}</p>
                      </div>
                    )}

                    {/* Additional Info */}
                    {selectedProspect.additionalInfo && (
                      <div>
                        <label className="text-xs text-text-muted uppercase font-semibold">Additional Details</label>
                        <p className="mt-2 text-text-primary whitespace-pre-wrap">{selectedProspect.additionalInfo}</p>
                      </div>
                    )}

                    {/* Submission Date */}
                    <div>
                      <label className="text-xs text-text-muted uppercase">Submitted</label>
                      <p className="text-sm text-text-secondary">{new Date(selectedProspect.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 text-center text-text-muted">
                  Select a prospect to view details
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'clients' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white rounded border border-border p-8">
              <div className="text-center mb-8">
                <h2 className="text-sm font-light text-text-primary mb-2">Client Portal</h2>
                <p className="text-text-secondary">Access your bookkeeping dashboard</p>
              </div>

              {/* Toggle */}
              <div className="flex border-b border-border-light mb-6">
                <button
                  onClick={() => {setIsLogin(true); setMessage('');}}
                  className={`flex-1 py-3 text-sm font-medium transition-all ${
                    isLogin 
                      ? 'text-purple-600 border-b-2 border-purple-600' 
                      : 'text-text-faint hover:text-text-secondary'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => {setIsLogin(false); setMessage('');}}
                  className={`flex-1 py-3 text-sm font-medium transition-all ${
                    !isLogin 
                      ? 'text-purple-600 border-b-2 border-purple-600' 
                      : 'text-text-faint hover:text-text-secondary'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <form onSubmit={handleClientSubmit} className="space-y-4">
                {!isLogin && (
                  <div>
                    <label className="block text-sm font-medium text-text-secondary mb-2">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:border-purple-600"
                      required={!isLogin}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:border-purple-600"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    Password
                  </label>
                  <input
                    type="password"
                    value={clientPassword}
                    onChange={(e) => setClientPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:border-purple-600"
                    required
                    minLength={8}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-medium rounded hover:shadow-sm transition-all disabled:opacity-50"
                >
                  {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                </button>
                
                {message && (
                  <div className={`text-center text-sm ${
                    message.includes('Success') 
                      ? 'text-brand-green' 
                      : 'text-brand-red'
                  }`}>
                    {message}
                  </div>
                )}
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
