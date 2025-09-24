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
    <section id="portal" className="py-24 bg-gray-50">
      <div className="max-w-md mx-auto px-8">
        <div className="text-center mb-12">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#b4b237] mb-4">
            Client Access
          </p>
          <h2 className="text-4xl font-light text-gray-900 mb-4">
            Your Dashboard
          </h2>
          <p className="text-lg text-gray-600">
            View your books anytime, anywhere
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg border border-gray-100">
          {/* Toggle */}
          <div className="flex border-b border-gray-100">
            <button
              onClick={() => {setIsLogin(true); setMessage('');}}
              className={`flex-1 py-4 text-sm font-medium transition-all ${
                isLogin 
                  ? 'text-[#b4b237] border-b-2 border-[#b4b237]' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {setIsLogin(false); setMessage('');}}
              className={`flex-1 py-4 text-sm font-medium transition-all ${
                !isLogin 
                  ? 'text-purple-600 border-b-2 border-purple-600' 
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-8 space-y-6">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Full Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                required
                minLength={8}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white font-medium rounded-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
            </button>
            
            {message && (
              <div className={`text-center text-sm ${
                message.includes('Success') 
                  ? 'text-green-600' 
                  : 'text-red-600'
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
