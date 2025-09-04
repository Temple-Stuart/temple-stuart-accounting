'use client';

import React from 'react';

export default function DataIntegrationsSection() {
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
          position: relative !important;
          overflow: hidden !important;
          box-shadow: 
            0 8px 32px rgba(180, 178, 55, 0.08),
            0 0 60px rgba(180, 178, 55, 0.03) inset !important;
          box-sizing: border-box !important;
        }

        .integrations-title {
          font-family: 'Cinzel', serif !important;
          color: #b4b237 !important;
          font-size: 32px !important;
          font-weight: 600 !important;
          margin: 0 0 10px 0 !important;
          letter-spacing: 1.5px !important;
          text-transform: uppercase !important;
          text-align: center !important;
        }

        .integrations-subtitle {
          color: #b4b237 !important;
          font-size: 14px !important;
          font-weight: 300 !important;
          letter-spacing: 2px !important;
          text-transform: uppercase !important;
          margin: 0 0 30px 0 !important;
          opacity: 0.8 !important;
          text-align: center !important;
        }

        .integrations-description {
          background: linear-gradient(135deg, 
            rgba(180, 178, 55, 0.03) 0%, 
            rgba(180, 178, 55, 0.01) 100%) !important;
          border: 1px solid rgba(180, 178, 55, 0.1) !important;
          border-radius: 15px !important;
          padding: 30px !important;
          margin-bottom: 35px !important;
        }

        .description-text {
          color: #666 !important;
          font-size: 16px !important;
          line-height: 1.7 !important;
          margin: 0 !important;
        }

        .integrations-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)) !important;
          gap: 20px !important;
        }

        .integration-feature {
          background: linear-gradient(135deg, 
            rgba(180, 178, 55, 0.04) 0%, 
            rgba(180, 178, 55, 0.01) 100%) !important;
          border: 1px solid rgba(180, 178, 55, 0.12) !important;
          border-radius: 12px !important;
          padding: 20px !important;
          transition: all 0.3s ease !important;
        }

        .integration-feature:hover {
          border-color: rgba(180, 178, 55, 0.25) !important;
          transform: translateY(-3px) !important;
          box-shadow: 0 6px 20px rgba(180, 178, 55, 0.1) !important;
        }

        .feature-icon {
          width: 40px !important;
          height: 40px !important;
          background: linear-gradient(135deg, #b4b237, rgba(180, 178, 55, 0.8)) !important;
          border-radius: 50% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          margin: 0 0 15px 0 !important;
          box-shadow: 0 4px 12px rgba(180, 178, 55, 0.2) !important;
        }

        .feature-icon span {
          color: white !important;
          font-size: 18px !important;
        }

        .feature-title {
          color: #b4b237 !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          margin: 0 0 8px 0 !important;
          letter-spacing: 0.5px !important;
          text-transform: uppercase !important;
        }

        .feature-description {
          color: #777 !important;
          font-size: 13px !important;
          line-height: 1.5 !important;
          margin: 0 !important;
        }
      `}</style>
      
      <h2 className="integrations-title">Data Integrations</h2>
      <p className="integrations-subtitle">Automation • Efficiency • Seamless Flow</p>
      
      <div className="integrations-description">
        <p className="description-text">
          I set up the connections that keep your systems talking and cut out manual work. That might mean linking banks, payroll, and CRMs to your accounting software, syncing data across platforms, or building dashboards for real-time reporting. I also automate recurring reports, fix sync issues, and design custom workflows so your data flows securely and efficiently — without you having to touch it.
        </p>
      </div>

      <div className="integrations-grid">
        <div className="integration-feature">
          <div className="feature-icon">
            <span>🔗</span>
          </div>
          <h3 className="feature-title">System Connections</h3>
          <p className="feature-description">Link banks, payroll, CRMs to accounting software</p>
        </div>

        <div className="integration-feature">
          <div className="feature-icon">
            <span>🔄</span>
          </div>
          <h3 className="feature-title">Data Syncing</h3>
          <p className="feature-description">Seamless data flow across all platforms</p>
        </div>

        <div className="integration-feature">
          <div className="feature-icon">
            <span>📊</span>
          </div>
          <h3 className="feature-title">Real-time Dashboards</h3>
          <p className="feature-description">Custom dashboards for instant insights</p>
        </div>

        <div className="integration-feature">
          <div className="feature-icon">
            <span>⚡</span>
          </div>
          <h3 className="feature-title">Report Automation</h3>
          <p className="feature-description">Automated recurring reports and workflows</p>
        </div>

        <div className="integration-feature">
          <div className="feature-icon">
            <span>🔧</span>
          </div>
          <h3 className="feature-title">Sync Issue Resolution</h3>
          <p className="feature-description">Fix data sync problems and optimize flows</p>
        </div>

        <div className="integration-feature">
          <div className="feature-icon">
            <span>🛡️</span>
          </div>
          <h3 className="feature-title">Secure Workflows</h3>
          <p className="feature-description">Custom workflows with enterprise-grade security</p>
        </div>
      </div>
    </div>
  );
}
