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
      if (isLogin) {
        // Login
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
          setMessage('Login successful! Redirecting...');
          setTimeout(() => router.push('/accounts'), 1000);
        } else {
          const data = await response.json();
          setMessage(data.error || 'Login failed');
        }
      } else {
        // Signup
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, password }),
        });

        if (response.ok) {
          setMessage('Account created! Please log in.');
          setIsLogin(true);
        } else {
          const data = await response.json();
          setMessage(data.error || 'Signup failed');
        }
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="client-portal" className="py-20">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent mb-4">
            Client Portal
          </h2>
          <p className="text-xl text-gray-600 uppercase tracking-widest opacity-90">
            Access Your Financial Dashboard
          </p>
        </div>

        <div className="max-w-md mx-auto">
          <div className="bg-white/80 backdrop-blur rounded-2xl shadow-xl p-8 border-2 border-purple-200">
            {/* Toggle buttons */}
            <div className="flex mb-8">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2 font-semibold rounded-l-lg transition-all ${
                  isLogin 
                    ? 'bg-gradient-to-r from-purple-600 to-amber-500 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2 font-semibold rounded-r-lg transition-all ${
                  !isLogin 
                    ? 'bg-gradient-to-r from-purple-600 to-amber-500 text-white' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Set Up Account
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {!isLogin && (
                <div>
                  <label htmlFor="name" className="block text-sm font-semibold text-purple-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="John Doe"
                    required={!isLogin}
                  />
                </div>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-purple-700 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="your@email.com"
                  required
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-purple-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-amber-500 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-amber-600 transform hover:-translate-y-1 transition-all duration-200 shadow-lg disabled:opacity-50"
              >
                {loading ? 'Processing...' : (isLogin ? 'Access Portal' : 'Create Account')}
              </button>
            </form>

            {message && (
              <div className={`mt-4 p-3 rounded-lg text-center ${
                message.includes('successful') || message.includes('created') 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-red-100 text-red-700'
              }`}>
                {message}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
