'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ClientPortalSection() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
      const body = isLogin 
        ? { email, password }
        : { email, password, name };

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

  return (
    <section id="portal" className="py-24 bg-bg-row">
      <div className="max-w-md mx-auto px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-accent mb-4">
            Client Access
          </p>
          <h2 className="text-4xl font-light text-text-primary mb-4">
            Your Dashboard
          </h2>
          <p className="text-terminal-lg text-text-secondary">
            View your books anytime, anywhere
          </p>
        </div>

        <div className="bg-white rounded shadow-sm border border-border-light">
          {/* Toggle */}
          <div className="flex border-b border-border-light">
            <button
              onClick={() => {setIsLogin(true); setMessage('');}}
              className={`flex-1 py-4 text-sm font-medium transition-all ${
                isLogin 
                  ? 'text-brand-accent border-b-2 border-brand-accent' 
                  : 'text-text-faint hover:text-text-secondary'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {setIsLogin(false); setMessage('');}}
              className={`flex-1 py-4 text-sm font-medium transition-all ${
                !isLogin 
                  ? 'text-purple-600 border-b-2 border-purple-600' 
                  : 'text-text-faint hover:text-text-secondary'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:border-brand-accent"
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
                className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:border-brand-accent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:border-brand-accent"
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-brand-accent to-brand-accent-dark text-white font-medium rounded hover:shadow-sm transition-all disabled:opacity-50"
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
    </section>
  );
}
