'use client';

import React, { useState } from 'react';

export default function BookkeepingServicesForm() {
  const [formData, setFormData] = useState({
    companyName: '',
    email: '',
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
    <div className="bookkeeping-services-form">
      <style jsx>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=Inter:wght@300;400;600;700&display=swap');
        
        .bookkeeping-services-form {
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

        .form-header {
          text-align: center !important;
          margin-bottom: 30px !important;
        }

        .form-title {
          font-family: 'Cinzel', serif !important;
          color: #b4b237 !important;
          font-size: 32px !important;
          font-weight: 600 !important;
          margin: 0 0 10px 0 !important;
          letter-spacing: 1.5px !important;
          text-transform: uppercase !important;
        }

        .form-subtitle {
          color: #b4b237 !important;
          font-size: 14px !important;
          font-weight: 300 !important;
          letter-spacing: 2px !important;
          text-transform: uppercase !important;
          margin: 0 0 20px 0 !important;
          opacity: 0.8 !important;
        }

        .form-description {
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
          margin: 0 0 15px 0 !important;
        }

        .contact-form {
          background: rgba(180, 178, 55, 0.03) !important;
          padding: 30px !important;
          border-radius: 15px !important;
          border: 1px solid rgba(180, 178, 55, 0.1) !important;
        }

        .form-section {
          margin-bottom: 35px !important;
        }

        .section-title {
          color: #b4b237 !important;
          font-size: 18px !important;
          font-weight: 600 !important;
          margin: 0 0 20px 0 !important;
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
        .form-group textarea:focus {
          outline: none !important;
          border-color: #b4b237 !important;
          background: rgba(180, 178, 55, 0.05) !important;
        }

        .services-grid {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) !important;
          gap: 15px !important;
        }

        .service-category {
          background: linear-gradient(135deg, 
            rgba(180, 178, 55, 0.02) 0%, 
            rgba(180, 178, 55, 0.005) 100%) !important;
          border: 1px solid rgba(180, 178, 55, 0.08) !important;
          border-radius: 10px !important;
          padding: 20px !important;
          margin-bottom: 20px !important;
        }

        .category-title {
          color: #b4b237 !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          margin: 0 0 15px 0 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.5px !important;
          border-bottom: 1px solid rgba(180, 178, 55, 0.2) !important;
          padding-bottom: 8px !important;
        }

        .service-item {
          display: flex !important;
          align-items: center !important;
          gap: 12px !important;
          padding: 10px 0 !important;
          cursor: pointer !important;
        }

        .service-item:hover {
          background: rgba(180, 178, 55, 0.02) !important;
          border-radius: 6px !important;
          margin: 0 -10px !important;
          padding: 10px !important;
        }

        .service-item input {
          width: auto !important;
          margin: 0 !important;
          padding: 0 !important;
          cursor: pointer !important;
        }

        .service-item label {
          margin: 0 !important;
          font-size: 14px !important;
          cursor: pointer !important;
          text-transform: none !important;
          letter-spacing: 0 !important;
          color: #333 !important;
          font-weight: 400 !important;
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
          transition: all 0.3s ease !important;
        }

        .submit-btn:hover {
          transform: translateY(-3px) !important;
          box-shadow: 0 8px 25px rgba(180, 178, 55, 0.3) !important;
        }
      `}</style>
      
      <div className="form-header">
        <h2 className="form-title">Request for Proposal</h2>
        <p className="form-subtitle">Professional • Accurate • Reliable</p>
      </div>
      
      <div className="form-description">
        <p className="description-text">
          I handle the day-to-day bookkeeping that keeps your business running smoothly. From transaction recording and account reconciliation to financial statements and custom reporting, I ensure your books are accurate, current, and compliant.
        </p>
        <p className="description-text">
          I also set up the connections that keep your systems talking and cut out manual work. That might mean linking banks, payroll, and CRMs to your accounting software, syncing data across platforms, or building dashboards for real-time reporting. I automate recurring reports, fix sync issues, and design custom data pipelines and workflows that run on your servers — so your data flows securely and efficiently without you having to touch it.
        </p>
      </div>
      
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
          <h3 className="section-title">Select Your Services</h3>
          
          <div className="service-category">
            <h4 className="category-title">Core Bookkeeping</h4>
            {[
              'Transaction Recording & Categorization',
              'Bank & Credit Card Reconciliation',
              'Financial Statements (P&L, Balance Sheet, Cash Flow)',
              'Monthly & Quarterly Closing',
              'General Ledger Maintenance',
              'Payroll Processing & Recording'
            ].map((service) => (
              <div key={service} className="service-item">
                <input 
                  type="checkbox"
                  id={service}
                  onChange={(e) => handleServiceChange(service, e.target.checked)}
                />
                <label htmlFor={service}>{service}</label>
              </div>
            ))}
          </div>

          <div className="service-category">
            <h4 className="category-title">Accounts Management</h4>
            {[
              'Accounts Payable Management',
              'Accounts Receivable Management',
              'Invoice Processing & Tracking',
              'Vendor Management',
              'Customer Payment Processing'
            ].map((service) => (
              <div key={service} className="service-item">
                <input 
                  type="checkbox"
                  id={service}
                  onChange={(e) => handleServiceChange(service, e.target.checked)}
                />
                <label htmlFor={service}>{service}</label>
              </div>
            ))}
          </div>

          <div className="service-category">
            <h4 className="category-title">Data Pipeline Setup</h4>
            {[
              'Database Design & Setup',
              'ETL Pipeline Development',
              'API Integration & Development',
              'Automated Data Sync Systems',
              'Custom Workflow Automation',
              'Server-Side Data Processing'
            ].map((service) => (
              <div key={service} className="service-item">
                <input 
                  type="checkbox"
                  id={service}
                  onChange={(e) => handleServiceChange(service, e.target.checked)}
                />
                <label htmlFor={service}>{service}</label>
              </div>
            ))}
          </div>

          <div className="service-category">
            <h4 className="category-title">Analysis & Reporting</h4>
            {[
              'Custom Financial Reports',
              'Budget vs Actual Analysis',
              'Cash Flow Forecasting',
              'KPI Dashboards',
              'Automated Report Generation'
            ].map((service) => (
              <div key={service} className="service-item">
                <input 
                  type="checkbox"
                  id={service}
                  onChange={(e) => handleServiceChange(service, e.target.checked)}
                />
                <label htmlFor={service}>{service}</label>
              </div>
            ))}
          </div>

          <div className="service-category">
            <h4 className="category-title">Support & Consultation</h4>
            {[
              'Regular Business Consultations',
              'System Setup & Training',
              'Ongoing Technical Support',
              'Process Optimization'
            ].map((service) => (
              <div key={service} className="service-item">
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
            <label htmlFor="message">Additional Details & Requirements</label>
            <textarea 
              id="message"
              rows={4}
              value={formData.message}
              onChange={(e) => setFormData(prev => ({...prev, message: e.target.value}))}
              placeholder="Tell me about your business, current systems, specific data engineering needs, or any questions you have..."
            />
          </div>
        </div>
        
        <button type="submit" className="submit-btn">
          Get Started Today
        </button>
      </form>
    </div>
  );
}
