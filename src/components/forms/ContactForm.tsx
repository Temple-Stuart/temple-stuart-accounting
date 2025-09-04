'use client';

import React, { useState } from 'react';

export default function ContactForm() {
  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
    monthlyExpenses: '',
    services: [] as string[],
    message: ''
  });

  const handleServiceChange = (service: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        services: [...prev.services, service]
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        services: prev.services.filter(s => s !== service)
      }));
    }
  };

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

        .form-title {
          font-family: 'Cinzel', serif !important;
          color: #b4b237 !important;
          font-size: 32px !important;
          font-weight: 600 !important;
          margin: 0 0 10px 0 !important;
          letter-spacing: 1.5px !important;
          text-transform: uppercase !important;
          text-align: center !important;
        }

        .form-subtitle {
          color: #b4b237 !important;
          font-size: 14px !important;
          letter-spacing: 2px !important;
          text-transform: uppercase !important;
          margin: 0 0 30px 0 !important;
          opacity: 0.8 !important;
          text-align: center !important;
        }

        .contact-form {
          background: rgba(180, 178, 55, 0.03) !important;
          padding: 30px !important;
          border-radius: 15px !important;
          border: 1px solid rgba(180, 178, 55, 0.1) !important;
        }

        .form-section {
          margin-bottom: 30px !important;
        }

        .section-title {
          color: #b4b237 !important;
          font-size: 18px !important;
          font-weight: 600 !important;
          margin: 0 0 15px 0 !important;
          text-transform: uppercase !important;
          letter-spacing: 1px !important;
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

        .form-group input,
        .form-group select,
        .form-group textarea {
          width: 100% !important;
          padding: 14px 16px !important;
          border: 1px solid rgba(180, 178, 55, 0.2) !important;
          border-radius: 8px !important;
          background: rgba(180, 178, 55, 0.02) !important;
          font-size: 16px !important;
          box-sizing: border-box !important;
        }

        .form-group input:focus,
        .form-group select:focus,
        .form-group textarea:focus {
          outline: none !important;
          border-color: #b4b237 !important;
          background: rgba(180, 178, 55, 0.05) !important;
        }

        .checkbox-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)) !important;
          gap: 12px !important;
        }

        .checkbox-item {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          padding: 12px !important;
          background: rgba(180, 178, 55, 0.02) !important;
          border: 1px solid rgba(180, 178, 55, 0.1) !important;
          border-radius: 8px !important;
          cursor: pointer !important;
        }

        .checkbox-item:hover {
          background: rgba(180, 178, 55, 0.04) !important;
          border-color: rgba(180, 178, 55, 0.2) !important;
        }

        .checkbox-item input {
          width: auto !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        .checkbox-item label {
          margin: 0 !important;
          font-size: 14px !important;
          cursor: pointer !important;
          text-transform: none !important;
          letter-spacing: 0 !important;
          color: #333 !important;
        }

        .submit-btn {
          width: 100% !important;
          max-width: 300px !important;
          margin: 30px auto 0 auto !important;
          padding: 16px 24px !important;
          background: linear-gradient(135deg, #b4b237, rgba(180, 178, 55, 0.8)) !important;
          color: white !important;
          border: none !important;
          border-radius: 8px !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          letter-spacing: 1px !important;
          text-transform: uppercase !important;
          cursor: pointer !important;
          display: block !important;
        }

        .submit-btn:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 8px 25px rgba(180, 178, 55, 0.3) !important;
        }
      `}</style>
      
      <h2 className="form-title">Get Started</h2>
      <p className="form-subtitle">Professional • Tailored • Comprehensive</p>
      
      <form className="contact-form">
        <div className="form-section">
          <h3 className="section-title">Business Information</h3>
          
          <div className="form-group">
            <label htmlFor="companyName">Company Name</label>
            <input 
              type="text" 
              id="companyName"
              value={formData.companyName}
              onChange={(e) => setFormData(prev => ({...prev, companyName: e.target.value}))}
              required 
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <input 
              type="email" 
              id="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
              required 
            />
          </div>
        </div>

        <div className="form-section">
          <h3 className="section-title">Services Needed</h3>
          <div className="checkbox-grid">
            {[
              'Bookkeeping & Transaction Recording',
              'Bank & Credit Card Reconciliation', 
              'Accounts Payable/Receivable',
              'Payroll Support',
              'Financial Statements (P&L, Balance Sheet)',
              'Data Integration & Automation',
              'Custom Reporting Dashboards',
              'API Integrations'
            ].map((service) => (
              <div key={service} className="checkbox-item">
                <input 
                  type="checkbox"
                  id={service}
                  onChange={(e) => handleServiceChange(service, e.target.checked)}
                />
                <label htmlFor={service}>{service}</label>
              </div>
            ))}
          </div>
        </div>

        <div className="form-section">
          <div className="form-group">
            <label htmlFor="message">Additional Details</label>
            <textarea 
              id="message"
              rows={4}
              value={formData.message}
              onChange={(e) => setFormData(prev => ({...prev, message: e.target.value}))}
              placeholder="Tell me about your specific needs and requirements..."
            />
          </div>
        </div>
        
        <button type="submit" className="submit-btn">
          Submit Request
        </button>
      </form>
    </div>
  );
}
