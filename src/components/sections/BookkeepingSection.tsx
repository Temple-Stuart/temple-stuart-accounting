'use client';

import React from 'react';

export default function BookkeepingSection() {
  return (
    <div className="bookkeeping-services-section">
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Inter:wght@300;400;600;700&display=swap');
        
        .bookkeeping-services-section {
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

        .services-content {
          position: relative !important;
          z-index: 1 !important;
          display: flex !important;
          flex-direction: column !important;
          gap: 35px !important;
        }

        .services-header {
          text-align: center !important;
          margin-bottom: 20px !important;
        }

        .services-title {
          font-family: 'Cinzel', serif !important;
          color: #b4b237 !important;
          font-size: 32px !important;
          font-weight: 600 !important;
          margin: 0 0 10px 0 !important;
          letter-spacing: 1.5px !important;
          text-transform: uppercase !important;
        }

        .services-subtitle {
          color: #b4b237 !important;
          font-size: 14px !important;
          font-weight: 300 !important;
          letter-spacing: 2px !important;
          text-transform: uppercase !important;
          margin: 0 !important;
          opacity: 0.8 !important;
        }

        .services-description {
          background: linear-gradient(135deg, 
            rgba(180, 178, 55, 0.03) 0%, 
            rgba(180, 178, 55, 0.01) 100%) !important;
          border: 1px solid rgba(180, 178, 55, 0.1) !important;
          border-radius: 15px !important;
          padding: 30px !important;
          position: relative !important;
          overflow: hidden !important;
        }

        .description-text {
          color: #666 !important;
          font-size: 16px !important;
          line-height: 1.7 !important;
          margin: 0 !important;
        }

        .services-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)) !important;
          gap: 20px !important;
          margin-top: 10px !important;
        }

        .service-feature {
          background: linear-gradient(135deg, 
            rgba(180, 178, 55, 0.04) 0%, 
            rgba(180, 178, 55, 0.01) 100%) !important;
          border: 1px solid rgba(180, 178, 55, 0.12) !important;
          border-radius: 12px !important;
          padding: 20px !important;
          transition: all 0.3s ease !important;
        }

        .service-feature:hover {
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
      
      <div className="services-content">
        <div className="services-header">
          <h2 className="services-title">Bookkeeping Services</h2>
          <p className="services-subtitle">Precision • Accuracy • Reliability</p>
        </div>
        
        <div className="services-description">
          <p className="description-text">
            I take care of the day-to-day work that keeps your books accurate and current. That includes recording transactions, reconciling bank and credit card accounts, managing payables and receivables, categorizing expenses, and posting payroll. Each month, I prepare financial statements — profit & loss, balance sheet, and cash flow — so you always know where your business stands.
          </p>
        </div>
        
        <div className="services-grid">
          <div className="service-feature">
            <div className="feature-icon">
              <span>📊</span>
            </div>
            <h3 className="feature-title">Transaction Recording</h3>
            <p className="feature-description">Accurate daily transaction entry and categorization</p>
          </div>
          
          <div className="service-feature">
            <div className="feature-icon">
              <span>🏦</span>
            </div>
            <h3 className="feature-title">Account Reconciliation</h3>
            <p className="feature-description">Bank and credit card account matching and balancing</p>
          </div>
          
          <div className="service-feature">
            <div className="feature-icon">
              <span>💰</span>
            </div>
            <h3 className="feature-title">Payables & Receivables</h3>
            <p className="feature-description">Managing what you owe and what's owed to you</p>
          </div>
          
          <div className="service-feature">
            <div className="feature-icon">
              <span>👥</span>
            </div>
            <h3 className="feature-title">Payroll Processing</h3>
            <p className="feature-description">Accurate payroll posting and employee records</p>
          </div>
          
          <div className="service-feature">
            <div className="feature-icon">
              <span>📈</span>
            </div>
            <h3 className="feature-title">Monthly Statements</h3>
            <p className="feature-description">P&L, balance sheet, and cash flow reports</p>
          </div>
          
          <div className="service-feature">
            <div className="feature-icon">
              <span>🎯</span>
            </div>
            <h3 className="feature-title">Expense Categorization</h3>
            <p className="feature-description">Strategic expense tracking and organization</p>
          </div>
        </div>
      </div>
    </div>
  );
}
