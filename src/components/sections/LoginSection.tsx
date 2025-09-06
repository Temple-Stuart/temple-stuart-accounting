'use client';

import React, { useState } from 'react';

export default function LoginSection() {
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    const formData = new FormData(e.target as HTMLFormElement);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;

    const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login';
    const payload = isSignup ? { email, password, name } : { email, password };

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(isSignup ? 'Account created successfully!' : 'Login successful!');
        if (!isSignup) {
          window.location.href = '/accounts';
        }
      } else {
        setMessage(data.error || 'An error occurred');
      }
    } catch (error) {
      setMessage('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="py-20 bg-gradient-to-br from-amber-50 via-white to-purple-50">
      <div className="max-w-4xl mx-auto px-6">
        
        <div className="bg-gradient-to-br from-purple-100 to-amber-100 rounded-2xl p-12 border-2 border-purple-200 shadow-2xl">
          
          {/* Header */}
          <div className="text-center mb-8">
            <h3 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent mb-4">
              Bookkeeping Dashboard
            </h3>
            <p className="text-xl text-gray-600 uppercase tracking-widest">
              Secure Client Portal
            </p>
          </div>

          {/* Toggle */}
          <div className="flex bg-white rounded-full p-1 mb-8 max-w-md mx-auto shadow-lg">
            <button 
              type="button"
              onClick={() => setIsSignup(false)}
              className={`flex-1 py-3 px-6 rounded-full font-semibold transition-all duration-300 ${
                !isSignup 
                  ? 'bg-gradient-to-r from-purple-600 to-amber-500 text-white shadow-md' 
                  : 'text-purple-600 hover:text-purple-700'
              }`}
            >
              Login
            </button>
            <button 
              type="button"
              onClick={() => setIsSignup(true)}
              className={`flex-1 py-3 px-6 rounded-full font-semibold transition-all duration-300 ${
                isSignup 
                  ? 'bg-gradient-to-r from-purple-600 to-amber-500 text-white shadow-md' 
                  : 'text-purple-600 hover:text-purple-700'
              }`}
            >
              Sign Up
            </button>
          </div>
          
          {/* Form */}
          <div className="max-w-md mx-auto">
            <form onSubmit={handleAuth} className="space-y-6">
              
              {isSignup && (
                <div>
                  <label className="block text-sm font-semibold text-purple-700 mb-2 uppercase tracking-wide">
                    Company Name
                  </label>
                  <input 
                    type="text" 
                    name="name" 
                    required 
                    className="w-full px-4 py-3 bg-white border-2 border-purple-200 rounded-lg focus:border-purple-500 focus:outline-none transition-all duration-200"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-semibold text-purple-700 mb-2 uppercase tracking-wide">
                  Email
                </label>
                <input 
                  type="email" 
                  name="email" 
                  required 
                  className="w-full px-4 py-3 bg-white border-2 border-purple-200 rounded-lg focus:border-purple-500 focus:outline-none transition-all duration-200"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-purple-700 mb-2 uppercase tracking-wide">
                  Password
                </label>
                <input 
                  type="password" 
                  name="password" 
                  required 
                  className="w-full px-4 py-3 bg-white border-2 border-purple-200 rounded-lg focus:border-purple-500 focus:outline-none transition-all duration-200"
                />
              </div>
              
              <button 
                type="submit" 
                disabled={isLoading}
                className="w-full py-4 bg-gradient-to-r from-purple-600 to-amber-500 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-amber-600 transform hover:-translate-y-1 transition-all duration-200 shadow-lg disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
              >
                {isLoading ? 'Processing...' : (isSignup ? 'Create Account' : 'Access Portal')}
              </button>
              
              {message && (
                <div className={`p-4 rounded-lg text-center font-medium ${
                  message.includes('successful') 
                    ? 'bg-green-100 text-green-700 border border-green-200' 
                    : 'bg-red-100 text-red-700 border border-red-200'
                }`}>
                  {message}
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
