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
    <div style={{
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      width: '100%',
      maxWidth: '800px',
      margin: '0 auto',
      background: 'linear-gradient(135deg, rgba(180, 178, 55, 0.03) 0%, rgba(180, 178, 55, 0.08) 50%, rgba(180, 178, 55, 0.03) 100%)',
      border: '2px solid rgba(180, 178, 55, 0.2)',
      borderRadius: '20px',
      padding: '60px 40px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 10px 40px rgba(180, 178, 55, 0.1), 0 0 80px rgba(180, 178, 55, 0.05) inset',
      boxSizing: 'border-box'
    }}>
      
      <style jsx>{`
        @media (max-width: 768px) {
          .login-container {
            padding: 30px 20px !important;
            margin: 20px auto !important;
          }
          .portal-title {
            font-size: 28px !important;
          }
          .login-form {
            padding: 20px !important;
          }
        }
        
        @media (max-width: 480px) {
          .login-container {
            padding: 20px 15px !important;
            margin: 15px auto !important;
          }
          .portal-title {
            font-size: 24px !important;
          }
        }

        .login-container::before,
        .login-container::after {
          content: '';
          position: absolute;
          width: 100px;
          height: 100px;
          border: 1px solid rgba(180, 178, 55, 0.3);
          pointer-events: none;
        }
        
        .login-container::before {
          top: 20px;
          left: 20px;
          border-right: none;
          border-bottom: none;
        }
        
        .login-container::after {
          bottom: 20px;
          right: 20px;
          border-left: none;
          border-top: none;
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
          fontSize: 20px;
          fontWeight: 300;
          margin: 0 0 40px 0;
          letterSpacing: 3px;
          textTransform: uppercase;
          opacity: 0.9;
          textAlign: center;
        }

        .portal-toggle {
          display: flex;
          gap: 15px;
          margin-bottom: 40px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .toggle-btn {
          background: linear-gradient(135deg, rgba(180, 178, 55, 0.1), rgba(180, 178, 55, 0.05));
          border: 1px solid rgba(180, 178, 55, 0.3);
          padding: 12px 20px;
          border-radius: 25px;
          color: #b4b237;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          transition: all 0.3s ease;
          min-width: 120px;
        }

        .toggle-btn:hover {
          border-color: #b4b237;
          transform: translateY(-2px);
          box-shadow: 0 5px 15px rgba(180, 178, 55, 0.2);
        }

        .toggle-btn.active {
          background: linear-gradient(135deg, #b4b237, rgba(180, 178, 55, 0.8));
          color: white;
          border-color: #b4b237;
          box-shadow: 0 5px 15px rgba(180, 178, 55, 0.3);
        }

        .login-form {
          background: linear-gradient(135deg, rgba(180, 178, 55, 0.05), rgba(180, 178, 55, 0.02));
          padding: 40px;
          border-radius: 16px;
          border: 2px solid rgba(180, 178, 55, 0.2);
          box-shadow: 0 8px 32px rgba(180, 178, 55, 0.1);
          max-width: 400px;
          margin: 0 auto;
        }

        .form-group {
          margin-bottom: 24px;
        }

        .form-group label {
          display: block;
          color: #b4b237;
          font-weight: 600;
          margin-bottom: 8px;
          text-transform: uppercase;
          font-size: 13px;
          letter-spacing: 0.5px;
        }

        .form-group input {
          width: 100%;
          padding: 16px;
          border: 2px solid rgba(180, 178, 55, 0.2);
          border-radius: 8px;
          background: linear-gradient(135deg, rgba(180, 178, 55, 0.02), rgba(180, 178, 55, 0.01));
          font-size: 14px;
          box-sizing: border-box;
          transition: all 0.3s ease;
          font-family: 'Inter, sans-serif';
        }

        .form-group input:focus {
          outline: none;
          border-color: #b4b237;
          background: rgba(180, 178, 55, 0.05);
          box-shadow: 0 4px 16px rgba(180, 178, 55, 0.1);
        }

        .login-btn {
          width: 100%;
          padding: 16px;
          background: linear-gradient(135deg, #b4b237, rgba(180, 178, 55, 0.8));
          color: white;
          border: none;
          border-radius: 25px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          transition: all 0.3s ease;
          opacity: ${isLoading ? '0.7' : '1'};
          box-shadow: 0 4px 16px rgba(180, 178, 55, 0.3);
        }

        .login-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(180, 178, 55, 0.4);
        }

        .login-btn:disabled {
          cursor: not-allowed;
          transform: none;
        }

        .message {
          margin-top: 20px;
          padding: 16px;
          border-radius: 8px;
          font-size: 14px;
          text-align: center;
          font-weight: 500;
        }

        .message.success {
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05));
          color: #16a34a;
          border: 1px solid rgba(34, 197, 94, 0.3);
        }

        .message.error {
          background: linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(239, 68, 68, 0.05));
          color: #dc2626;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }
      `}</style>

      <div className="login-container" style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
        <h1 className="portal-title">Bookkeeping Dashboard</h1>
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
    </div>
  );
}
