'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LoginBoxProps {
  onClose?: () => void;
  showToggle?: boolean;
}

export default function LoginBox({ onClose, showToggle = true }: LoginBoxProps) {
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
        setMessage('Success! Redirecting...');
        setTimeout(() => router.push('/hub'), 1000);
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
    <div className="bg-white rounded-2xl border border-gray-200 p-8 w-full max-w-md">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <div className="text-center mb-8">
        <h2 className="text-2xl font-light text-gray-900 mb-2">Temple Stuart OS</h2>
        <p className="text-gray-600">Your personal finance operating system</p>
      </div>

      {showToggle && (
        <div className="flex border-b border-gray-100 mb-6">
          <button
            onClick={() => {setIsLogin(true); setMessage('');}}
            className={`flex-1 py-3 text-sm font-medium transition-all ${
              isLogin 
                ? 'text-[#b4b237] border-b-2 border-[#b4b237]' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Sign In
          </button>
          <button
            onClick={() => {setIsLogin(false); setMessage('');}}
            className={`flex-1 py-3 text-sm font-medium transition-all ${
              !isLogin 
                ? 'text-[#b4b237] border-b-2 border-[#b4b237]' 
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Create Account
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#b4b237]"
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
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#b4b237]"
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
            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-[#b4b237]"
            required
            minLength={8}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white font-medium rounded-xl hover:shadow-xl transition-all disabled:opacity-50"
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
  );
}
