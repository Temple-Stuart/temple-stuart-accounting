'use client';

import React, { useState } from 'react';

export default function HeroSection() {
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
          // Redirect to dashboard or refresh page
          window.location.reload();
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
    <div className="temple-hero-enhanced">
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Inter:wght@300;400;600;700&display=swap');
        
        .temple-hero-enhanced {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif !important;
          width: 100% !important;
          max-width: 800px !important;
          margin: 0 auto !important;
          background: linear-gradient(135deg, 
            rgba(180, 178, 55, 0.03) 0%, 
            rgba(180, 178, 55, 0.08) 50%, 
            rgba(180, 178, 55, 0.03) 100%) !important;
          border: 2px solid rgba(180, 178, 55, 0.2) !important;
          border-radius: 20px !important;
          padding: 60px 40px !important;
          position: relative !important;
          overflow: hidden !important;
          box-shadow: 
            0 10px 40px rgba(180, 178, 55, 0.1),
            0 0 80px rgba(180, 178, 55, 0.05) inset !important;
          box-sizing: border-box !important;
        }

        .temple-hero-enhanced::before,
        .temple-hero-enhanced::after {
          content: '' !important;
          position: absolute !important;
          width: 100px !important;
          height: 100px !important;
          border: 1px solid rgba(180, 178, 55, 0.3) !important;
          pointer-events: none !important;
        }
        
        .temple-hero-enhanced::before {
          top: 20px !important;
          left: 20px !important;
          border-right: none !important;
          border-bottom: none !important;
        }
        
        .temple-hero-enhanced::after {
          bottom: 20px !important;
          right: 20px !important;
          border-left: none !important;
          border-top: none !important;
        }

        .hero-content {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          gap: 40px !important;
          position: relative !important;
          z-index: 1 !important;
          width: 100% !important;
          text-align: center !important;
        }

        .royal-visual {
          flex-shrink: 0 !important;
          position: relative !important;
          width: 200px !important;
          height: 240px !important;
          margin: 0 auto !important;
          order: 1 !important;
        }

        .hero-text {
          flex: none !important;
          width: 100% !important;
          max-width: 600px !important;
          margin: 0 auto !important;
          order: 2 !important;
        }

        .data-particle {
          position: absolute;
          width: 4px;
          height: 4px;
          background: rgba(180, 178, 55, 0.6);
          border-radius: 50%;
          animation: float 8s infinite ease-in-out;
        }

        .data-particle:nth-child(1) {
          top: 10%;
          left: 10%;
          animation-delay: 0s;
        }

        .data-particle:nth-child(2) {
          top: 80%;
          right: 15%;
          animation-delay: 2s;
        }

        .data-particle:nth-child(3) {
          bottom: 10%;
          left: 20%;
          animation-delay: 4s;
        }

        @keyframes float {
          0%, 100% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          50% {
            transform: translateY(-30px) translateX(20px);
            opacity: 1;
          }
          90% {
            opacity: 1;
          }
        }

        .visualization-container {
          position: absolute;
          width: 200px;
          height: 200px;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          perspective: 1000px;
        }

        .data-cube {
          width: 100px;
          height: 100px;
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotateX(25deg) rotateY(45deg);
          transform-style: preserve-3d;
          animation: cubeRotate 15s linear infinite;
        }

        @keyframes cubeRotate {
          0% { transform: translate(-50%, -50%) rotateX(25deg) rotateY(45deg); }
          100% { transform: translate(-50%, -50%) rotateX(25deg) rotateY(405deg); }
        }

        .cube-face {
          position: absolute;
          width: 100px;
          height: 100px;
          border: 2px solid #b4b237;
          background: linear-gradient(135deg, 
            rgba(180, 178, 55, 0.1) 0%, 
            rgba(180, 178, 55, 0.05) 50%, 
            rgba(180, 178, 55, 0.1) 100%);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .cube-face.front { transform: translateZ(50px); }
        .cube-face.back { transform: rotateY(180deg) translateZ(50px); }
        .cube-face.left { transform: rotateY(-90deg) translateZ(50px); }
        .cube-face.right { transform: rotateY(90deg) translateZ(50px); }
        .cube-face.top { transform: rotateX(90deg) translateZ(50px); }
        .cube-face.bottom { transform: rotateX(-90deg) translateZ(50px); }

        .metric-value {
          color: #b4b237;
          font-size: 40px;
          font-weight: 300;
          opacity: 0.8;
        }

        .hero-name {
          font-family: 'Cinzel', serif !important;
          color: #b4b237 !important;
          font-size: 42px !important;
          font-weight: 600 !important;
          margin: 0 0 12px 0 !important;
          letter-spacing: 2px !important;
          text-transform: uppercase !important;
        }

        .hero-title {
          color: #b4b237 !important;
          font-size: 20px !important;
          font-weight: 300 !important;
          margin: 0 0 20px 0 !important;
          letter-spacing: 3px !important;
          text-transform: uppercase !important;
          opacity: 0.9 !important;
        }

        .hero-description {
          color: #666 !important;
          font-size: 16px !important;
          line-height: 1.6 !important;
          margin: 0 0 30px 0 !important;
          max-width: 500px !important;
          text-align: center !important;
          margin-left: auto !important;
          margin-right: auto !important;
        }

        .expertise-badges {
          display: flex !important;
          gap: 15px !important;
          flex-wrap: wrap !important;
          justify-content: center !important;
        }

        .badge {
          background: linear-gradient(135deg, 
            rgba(180, 178, 55, 0.1), 
            rgba(180, 178, 55, 0.05)) !important;
          border: 1px solid rgba(180, 178, 55, 0.3) !important;
          padding: 10px 16px !important;
          border-radius: 25px !important;
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          transition: all 0.3s ease !important;
        }

        .badge:hover {
          border-color: #b4b237 !important;
          transform: translateY(-2px) !important;
          box-shadow: 0 5px 15px rgba(180, 178, 55, 0.2) !important;
        }

        .badge-text {
          color: #b4b237 !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          letter-spacing: 0.5px !important;
          text-transform: uppercase !important;
          margin: 0 !important;
        }

        .client-portal-section {
          margin-top: 40px !important;
          padding-top: 30px !important;
          border-top: 1px solid rgba(180, 178, 55, 0.15) !important;
        }

        .portal-title {
          color: #b4b237 !important;
          font-size: 24px !important;
          font-weight: 600 !important;
          margin: 0 0 20px 0 !important;
          letter-spacing: 1px !important;
          text-transform: uppercase !important;
          text-align: center !important;
        }

        .portal-toggle {
          display: flex !important;
          gap: 0 !important;
          margin-bottom: 25px !important;
          background: rgba(180, 178, 55, 0.1) !important;
          border-radius: 8px !important;
          padding: 4px !important;
        }

        .toggle-btn {
          flex: 1 !important;
          padding: 10px 16px !important;
          background: transparent !important;
          color: #b4b237 !important;
          border: none !important;
          border-radius: 6px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          transition: all 0.3s ease !important;
        }

        .toggle-btn.active {
          background: #b4b237 !important;
          color: white !important;
          box-shadow: 0 2px 8px rgba(180, 178, 55, 0.3) !important;
        }

        .login-form {
          max-width: 100% !important;
          background: rgba(180, 178, 55, 0.03) !important;
          padding: 25px !important;
          border-radius: 12px !important;
          border: 1px solid rgba(180, 178, 55, 0.1) !important;
        }

        .form-group {
          margin-bottom: 20px !important;
        }

        .form-group label {
          display: block !important;
          color: #b4b237 !important;
          font-weight: 500 !important;
          margin-bottom: 6px !important;
          text-transform: uppercase !important;
          font-size: 12px !important;
          letter-spacing: 0.5px !important;
        }

        .form-group input {
          width: 100% !important;
          padding: 12px 14px !important;
          border: 1px solid rgba(180, 178, 55, 0.2) !important;
          border-radius: 6px !important;
          background: rgba(180, 178, 55, 0.02) !important;
          font-size: 14px !important;
          box-sizing: border-box !important;
        }

        .form-group input:focus {
          outline: none !important;
          border-color: #b4b237 !important;
          background: rgba(180, 178, 55, 0.05) !important;
        }

        .login-btn {
          width: 100% !important;
          padding: 12px !important;
          background: linear-gradient(135deg, #b4b237, rgba(180, 178, 55, 0.8)) !important;
          color: white !important;
          border: none !important;
          border-radius: 6px !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          transition: all 0.3s ease !important;
          opacity: ${isLoading ? '0.7' : '1'} !important;
        }

        .login-btn:hover {
          transform: translateY(-2px) !important;
          box-shadow: 0 6px 20px rgba(180, 178, 55, 0.3) !important;
        }

        .login-btn:disabled {
          cursor: not-allowed !important;
          transform: none !important;
        }

        .message {
          margin-top: 15px !important;
          padding: 10px !important;
          border-radius: 6px !important;
          font-size: 14px !important;
          text-align: center !important;
        }

        .message.success {
          background: rgba(34, 197, 94, 0.1) !important;
          color: #16a34a !important;
          border: 1px solid rgba(34, 197, 94, 0.2) !important;
        }

        .message.error {
          background: rgba(239, 68, 68, 0.1) !important;
          color: #dc2626 !important;
          border: 1px solid rgba(239, 68, 68, 0.2) !important;
        }
      `}</style>

      <div className="hero-content">
        <div className="royal-visual">
          <div className="data-particle"></div>
          <div className="data-particle"></div>
          <div className="data-particle"></div>
          
          <div className="visualization-container">
            <div className="data-cube">
              <div className="cube-face front">
                <div className="metric-value">∑</div>
              </div>
              <div className="cube-face back">
                <div className="metric-value">📊</div>
              </div>
              <div className="cube-face left">
                <div className="metric-value">⚡</div>
              </div>
              <div className="cube-face right">
                <div className="metric-value">🔮</div>
              </div>
              <div className="cube-face top">
                <div className="metric-value">♔</div>
              </div>
              <div className="cube-face bottom">
                <div className="metric-value">$</div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="hero-text">
          <h1 className="hero-name">Temple Stuart</h1>
          <p className="hero-title">Bookkeeping, Data Architecture & Engineering</p>
          <p className="hero-description">
            Building tools that merges traditional accounting with automation. Transforming complex data into strategic insights through AI and data integrations.
          </p>
          
          <div className="expertise-badges">
            <div className="badge">
              <p className="badge-text">Bookkeeping</p>
            </div>
            <div className="badge">
              <p className="badge-text">Data Automation</p>
            </div>
            <div className="badge">
              <p className="badge-text">Data Integrations</p>
            </div>
          </div>

          <div className="client-portal-section">
            <h3 className="portal-title">Client Portal</h3>
            
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
      </div>
    </div>
  );
}
