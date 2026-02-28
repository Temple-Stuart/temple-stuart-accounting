'use client';

import React, { useState } from 'react';

export default function RFPSection() {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    businessType: '',
    monthlyTransactions: '',
    numberOfAccounts: '',
    currentSoftware: '',
    needsBookkeeping: false,
    needsPayroll: false,
    needsTaxPrep: false,
    needsReporting: false,
    startDate: '',
    urgency: '',
    message: ''
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    });
  };

  const handleNext = () => {
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitMessage('');

    try {
      const response = await fetch('/api/rfp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        setSubmitMessage('Request submitted successfully! Check your email for confirmation.');
        setStep(1);
        setFormData({
          businessName: '', contactName: '', email: '', phone: '',
          businessType: '', monthlyTransactions: '', numberOfAccounts: '',
          currentSoftware: '', needsBookkeeping: false, needsPayroll: false,
          needsTaxPrep: false, needsReporting: false, startDate: '',
          urgency: '', message: ''
        });
      } else {
        setSubmitMessage('Something went wrong. Please try again.');
      }
    } catch (error) {
      setSubmitMessage('Error submitting request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="rfp" className="py-20 bg-bg-row">
      <div className="max-w-3xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-text-primary mb-4">
            Request for Proposal
          </h2>
          <p className="text-sm text-text-secondary">
            Let's understand your bookkeeping needs
          </p>
        </div>

        <div className="bg-white rounded shadow-sm p-8">
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              {[1, 2, 3, 4].map(i => (
                <div
                  key={i}
                  className={`w-1/4 h-2 mx-1 rounded-full transition-all ${
                    i <= step ? 'bg-brand-accent' : 'bg-border'
                  }`}
                />
              ))}
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-6">
              <h3 className="text-sm font-semibold mb-6">Contact Information</h3>
              
              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">
                  Business Name *
                </label>
                <input
                  type="text"
                  name="businessName"
                  value={formData.businessName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  name="contactName"
                  value={formData.contactName}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-brand-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">
                  Phone
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>

              <button
                onClick={handleNext}
                disabled={!formData.businessName || !formData.contactName || !formData.email}
                className="w-full py-3 bg-brand-accent text-white font-semibold rounded hover:bg-brand-accent-dark transition-colors disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <h3 className="text-sm font-semibold mb-6">Business Information</h3>
              
              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">
                  Business Type
                </label>
                <select
                  name="businessType"
                  value={formData.businessType}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-brand-accent"
                >
                  <option value="">Select...</option>
                  <option value="service">Service Business</option>
                  <option value="retail">Retail</option>
                  <option value="ecommerce">E-commerce</option>
                  <option value="consulting">Consulting</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">
                  Monthly Transaction Volume
                </label>
                <select
                  name="monthlyTransactions"
                  value={formData.monthlyTransactions}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-brand-accent"
                >
                  <option value="">Select...</option>
                  <option value="0-50">0-50</option>
                  <option value="51-200">51-200</option>
                  <option value="201-500">201-500</option>
                  <option value="501-1000">501-1000</option>
                  <option value="1000+">1000+</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">
                  Number of Bank/Credit Accounts
                </label>
                <select
                  name="numberOfAccounts"
                  value={formData.numberOfAccounts}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-brand-accent"
                >
                  <option value="">Select...</option>
                  <option value="1-2">1-2</option>
                  <option value="3-5">3-5</option>
                  <option value="6-10">6-10</option>
                  <option value="10+">10+</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">
                  Current Bookkeeping Software
                </label>
                <select
                  name="currentSoftware"
                  value={formData.currentSoftware}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-brand-accent"
                >
                  <option value="">Select...</option>
                  <option value="none">None</option>
                  <option value="quickbooks">QuickBooks</option>
                  <option value="xero">Xero</option>
                  <option value="excel">Excel</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleBack}
                  className="flex-1 py-3 border-2 border-brand-accent text-brand-accent font-semibold rounded hover:bg-brand-accent hover:text-white transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 py-3 bg-brand-accent text-white font-semibold rounded hover:bg-brand-accent-dark transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <h3 className="text-sm font-semibold mb-6">What Services Do You Need?</h3>
              
              <div className="space-y-4">
                <label className="flex items-center p-4 border border-border rounded hover:bg-bg-row cursor-pointer">
                  <input
                    type="checkbox"
                    name="needsBookkeeping"
                    checked={formData.needsBookkeeping}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-brand-accent rounded focus:ring-brand-accent"
                  />
                  <div className="ml-3">
                    <div className="font-semibold">Full Bookkeeping</div>
                    <div className="text-sm text-text-secondary">Transaction recording, reconciliation, monthly reports</div>
                  </div>
                </label>

                <label className="flex items-center p-4 border border-border rounded hover:bg-bg-row cursor-pointer">
                  <input
                    type="checkbox"
                    name="needsPayroll"
                    checked={formData.needsPayroll}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-brand-accent rounded focus:ring-brand-accent"
                  />
                  <div className="ml-3">
                    <div className="font-semibold">Payroll Processing</div>
                    <div className="text-sm text-text-secondary">Employee payments, tax withholdings, filings</div>
                  </div>
                </label>

                <label className="flex items-center p-4 border border-border rounded hover:bg-bg-row cursor-pointer">
                  <input
                    type="checkbox"
                    name="needsTaxPrep"
                    checked={formData.needsTaxPrep}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-brand-accent rounded focus:ring-brand-accent"
                  />
                  <div className="ml-3">
                    <div className="font-semibold">Tax Preparation</div>
                    <div className="text-sm text-text-secondary">Annual business tax returns and planning</div>
                  </div>
                </label>

                <label className="flex items-center p-4 border border-border rounded hover:bg-bg-row cursor-pointer">
                  <input
                    type="checkbox"
                    name="needsReporting"
                    checked={formData.needsReporting}
                    onChange={handleInputChange}
                    className="w-5 h-5 text-brand-accent rounded focus:ring-brand-accent"
                  />
                  <div className="ml-3">
                    <div className="font-semibold">Advanced Reporting</div>
                    <div className="text-sm text-text-secondary">Custom dashboards, KPI tracking, forecasting</div>
                  </div>
                </label>
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleBack}
                  className="flex-1 py-3 border-2 border-brand-accent text-brand-accent font-semibold rounded hover:bg-brand-accent hover:text-white transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleNext}
                  className="flex-1 py-3 bg-brand-accent text-white font-semibold rounded hover:bg-brand-accent-dark transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <h3 className="text-sm font-semibold mb-6">Timeline & Additional Information</h3>
              
              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">
                  When do you need to start?
                </label>
                <select
                  name="urgency"
                  value={formData.urgency}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-brand-accent"
                >
                  <option value="">Select...</option>
                  <option value="immediate">Immediately</option>
                  <option value="week">Within a week</option>
                  <option value="month">Within a month</option>
                  <option value="planning">Just planning</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-text-secondary mb-2">
                  Additional Information
                </label>
                <textarea
                  name="message"
                  value={formData.message}
                  onChange={handleInputChange}
                  rows={4}
                  placeholder="Tell us about any specific needs or questions..."
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:ring-2 focus:ring-brand-accent"
                />
              </div>

              <div className="flex gap-4">
                <button
                  onClick={handleBack}
                  className="flex-1 py-3 border-2 border-brand-accent text-brand-accent font-semibold rounded hover:bg-brand-accent hover:text-white transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-3 bg-brand-accent text-white font-semibold rounded hover:bg-brand-accent-dark transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>

              {submitMessage && (
                <div className={`mt-4 p-3 rounded text-center ${
                  submitMessage.includes('successfully') 
                    ? 'bg-green-100 text-brand-green' 
                    : 'bg-red-100 text-brand-red'
                }`}>
                  {submitMessage}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
