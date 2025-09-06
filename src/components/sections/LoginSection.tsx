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
    <div className="login-section">
      <style jsx>{`
        .login-section {
          width: 100%;
          max-width: 800px;
          margin: 40px auto;
          background: linear-gradient(135deg, 
            rgba(180, 178, 55, 0.03) 0%, 
            rgba(180, 178, 55, 0.08) 50%, 
            rgba(180, 178, 55, 0.03) 100%);
          border: 2px solid rgba(180, 178, 55, 0.2);
          border-radius: 20px;
          padding: 60px 40px;
          box-shadow: 0 10px 40px rgba(180, 178, 55, 0.1);
          box-sizing: border-box;
        }

        .portal-title {
          color: #b4b237;
          font-size: 42px;
          font-weight: 600;
          margin: 0 0 12px 0;
          letter-spacing: 2px;
          text-transform: uppercase;
          text-align: center;
          font-family: 'Cinzel', serif;
        }

        .portal-subtitle {
          color: #b4b237;
          font-size: 20px;
          font-weight: 300;
          margin: 0 0 40px 0;
          letter-spacing: 3px;
          text-transform: uppercase;
          opacity: 0.9;
          text-align: center;
        }

        .portal-toggle {
          display: flex;
          gap: 0;
          margin-bottom: 25px;
          background: rgba(180, 178, 55, 0.1);
          border-radius: 8px;
          padding: 4px;
          max-width: 400px;
          margin: 0 auto 25px auto;
        }

        .toggle-btn {
          flex: 1;
          padding: 12px 16px;
          background: transparent;
          color: #b4b237;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          transition: all 0.3s ease;
        }

        .toggle-btn.active {
          background: #b4b237;
          color: white;
          box-shadow: 0 2px 8px rgba(180, 178, 55, 0.3);
        }

        .login-form {
          background: rgba(180, 178, 55, 0.03);
          padding: 25px;
          border-radius: 12px;
          border: 1px solid rgba(180, 178, 55, 0.1);
          max-width: 400px;
          margin: 0 auto;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          color: #b4b237;
          font-weight: 500;
          margin-bottom: 6px;
          text-transform: uppercase;
          font-size: 12px;
          letter-spacing: 0.5px;
        }

        .form-group input {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid rgba(180, 178, 55, 0.2);
          border-radius: 6px;
          background: rgba(180, 178, 55, 0.02);
          font-size: 14px;
          box-sizing: border-box;
        }

        .form-group input:focus {
          outline: none;
          border-color: #b4b237;
          background: rgba(180, 178, 55, 0.05);
        }

        .login-btn {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #b4b237, rgba(180, 178, 55, 0.8));
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          transition: all 0.3s ease;
          opacity: ${isLoading ? '0.7' : '1'};
        }

        .login-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(180, 178, 55, 0.3);
        }

        .login-btn:disabled {
          cursor: not-allowed;
          transform: none;
        }

        .message {
          margin-top: 15px;
          padding: 10px;
          border-radius: 6px;
          font-size: 14px;
          text-align: center;
        }

        .message.success {
          background: rgba(34, 197, 94, 0.1);
          color: #16a34a;
          border: 1px solid rgba(34, 197, 94, 0.2);
        }

        .message.error {
          background: rgba(239, 68, 68, 0.1);
          color: #dc2626;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }
      `}</style>

      <h3 className="portal-title">Bookkeeping Dashboard</h3>
      <p className="portal-subtitle">Secure Client Portal</p>
      
      <div className="portal-toggle">
        <button 
          type="button"
          className={`toggle-btn ${!isSignup ? 'active' : ''}`}
          onClick={() => setIsSignup(false)}
        >
          Login
        </button>
        <button 
          type="button"
          className={`toggle-btn ${isSignup ? 'active' : ''}`}
          onClick={() => setIsSignup(true)}
        >
          Sign Up
        </button>
      </div>
      
      <form className="login-form" onSubmit={handleAuth}>
        {isSignup && (
          <div className="form-group">
            <label htmlFor="name">Company Name</label>
            <input type="text" id="name" name="name" required />
          </div>
        )}
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input type="email" id="email" name="email" required />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input type="password" id="password" name="password" required />
        </div>
        <button type="submit" className="login-btn" disabled={isLoading}>
          {isLoading ? 'Processing...' : (isSignup ? 'Create Account' : 'Access Portal')}
        </button>
        
        {message && (
          <div className={`message ${message.includes('successful') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </form>
    </div>
  );
}
