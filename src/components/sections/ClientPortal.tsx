'use client';

import React, { useState } from 'react';

export default function ClientPortal() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="data-integrations-section">
      <style jsx>{`
        .data-integrations-section {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
          width: 100% !important;
          max-width: 800px !important;
          margin: 40px auto 0 auto !important;
          background: linear-gradient(135deg, 
            rgba(180, 178, 55, 0.02) 0%, 
            rgba(180, 178, 55, 0.05) 50%, 
            rgba(180, 178, 55, 0.02) 100%) !important;
          border: 1px solid rgba(180, 178, 55, 0.15) !important;
          border-radius: 20px !important;
          padding: 50px 40px !important;
          box-shadow: 
            0 8px 32px rgba(180, 178, 55, 0.08),
            0 0 60px rgba(180, 178, 55, 0.03) inset !important;
        }

        .portal-title {
          font-family: 'Cinzel', serif !important;
          color: #b4b237 !important;
          font-size: 32px !important;
          font-weight: 600 !important;
          margin: 0 0 10px 0 !important;
          letter-spacing: 1.5px !important;
          text-transform: uppercase !important;
          text-align: center !important;
        }

        .portal-subtitle {
          color: #b4b237 !important;
          font-size: 14px !important;
          letter-spacing: 2px !important;
          text-transform: uppercase !important;
          margin: 0 0 30px 0 !important;
          opacity: 0.8 !important;
          text-align: center !important;
        }

        .login-form {
          max-width: 400px !important;
          margin: 0 auto !important;
          background: rgba(180, 178, 55, 0.03) !important;
          padding: 30px !important;
          border-radius: 15px !important;
          border: 1px solid rgba(180, 178, 55, 0.1) !important;
        }

        .form-group {
          margin-bottom: 20px !important;
        }

        .form-group label {
          display: block !important;
          color: #b4b237 !important;
          font-weight: 500 !important;
          margin-bottom: 8px !important;
          text-transform: uppercase !important;
          font-size: 14px !important;
          letter-spacing: 0.5px !important;
        }

        .form-group input {
          width: 100% !important;
          padding: 14px 16px !important;
          border: 1px solid rgba(180, 178, 55, 0.2) !important;
          border-radius: 8px !important;
          background: rgba(180, 178, 55, 0.02) !important;
          font-size: 16px !important;
          box-sizing: border-box !important;
        }

        .form-group input:focus {
          outline: none !important;
          border-color: #b4b237 !important;
          background: rgba(180, 178, 55, 0.05) !important;
        }

        .login-btn {
          width: 100% !important;
          padding: 14px !important;
          background: linear-gradient(135deg, #b4b237, rgba(180, 178, 55, 0.8)) !important;
          color: white !important;
          border: none !important;
          border-radius: 8px !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
        }

        .login-btn:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 20px rgba(180, 178, 55, 0.3) !important;
        }
      `}</style>
      
      <h2 className="portal-title">Client Portal</h2>
      <p className="portal-subtitle">Secure • Encrypted • Professional</p>
      
      <form className="login-form">
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input 
            type="email" 
            id="email" 
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required 
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input 
            type="password" 
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required 
          />
        </div>
        
        <button type="submit" className="login-btn">
          Access Portal
        </button>
      </form>
    </div>
  );
}
