'use client';

import React from 'react';

export default function HeroSection() {
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

        .badge-icon {
          font-size: 16px !important;
        }

        .badge-text {
          color: #b4b237 !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          letter-spacing: 0.5px !important;
          text-transform: uppercase !important;
          margin: 0 !important;
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
          <p className="hero-title">Accounting, Data Architecture & Engineering</p>
          <p className="hero-description">
            I'm building tools that merge traditional accounting with automation. Transforming complex data into strategic insights through AI, Coding and API integrations.
            <br/><br/>
            For now, I will focus on: (a) Bookkeeping and (b) Data Integrations
            <br/><br/>
            Once I'm CPA licensed in 2026, I'll add tax and audit services to the mix.
          </p>
          
          <div className="expertise-badges">
            <div className="badge">
              <span className="badge-icon">👑</span>
              <p className="badge-text">Elite Bookkeeping</p>
            </div>
            <div className="badge">
              <span className="badge-icon">⚡</span>
              <p className="badge-text">Data Automation</p>
            </div>
            <div className="badge">
              <span className="badge-icon">🎯</span>
              <p className="badge-text">CPA Track 2026</p>
            </div>
            <div className="badge">
              <span className="badge-icon">🔮</span>
              <p className="badge-text">AI Integration</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
