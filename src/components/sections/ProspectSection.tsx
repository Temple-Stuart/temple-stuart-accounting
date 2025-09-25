'use client';

import React, { useState } from 'react';

export default function ProspectSection() {
  const [expenseTier, setExpenseTier] = useState('tier1');
  const [frequency, setFrequency] = useState('monthly');
  const [formData, setFormData] = useState({
    businessName: '',
    contactName: '',
    email: '',
    phone: '',
    
    // Pipeline-specific questions
    numBankAccounts: '',
    numCreditCards: '',
    monthlyTransactions: '',
    hasPayroll: 'no',
    hasInventory: 'no',
    currentBookkeeping: '',
    biggestPainPoint: '',
    
    // Meeting
    preferredTime: '',
    additionalInfo: ''
  });
  
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');

  // Pricing tiers based on monthly expenses
  const pricingTiers = {
    tier1: { range: 'Under $10k/month', basePrice: 299, name: 'Starter' },
    tier2: { range: '$10k - $25k/month', basePrice: 499, name: 'Growing' },
    tier3: { range: '$25k - $50k/month', basePrice: 799, name: 'Established' },
    tier4: { range: '$50k - $100k/month', basePrice: 1299, name: 'Scale' }
  };

  // Frequency adjustments
  const frequencyMultipliers = {
    monthly: { label: 'Monthly', multiplier: 1 },
    weekly: { label: 'Weekly', multiplier: 1.5 },
    daily: { label: 'Daily', multiplier: 2 }
  };

  const currentTier = pricingTiers[expenseTier as keyof typeof pricingTiers];
  const currentFrequency = frequencyMultipliers[frequency as keyof typeof frequencyMultipliers];
  const finalPrice = Math.round(currentTier.basePrice * currentFrequency.multiplier);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage('');

    // Actually save to database
    
    try {
      const response = await fetch("/api/rfp", {
        method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        expenseTier,
        frequency,
        totals: { monthly: finalPrice },
        needs: formData.additionalInfo,
        timeline: formData.preferredTime
      })
    });
    const result = await response.json();
    if (response.ok) {
      setSubmitMessage("Thanks! I will review everything and reach out within 24 hours to schedule our consultation.");
      // Clear form
      setFormData({
        businessName: "",
        contactName: "",
        email: "",
        phone: "",
        numBankAccounts: "",
        numCreditCards: "",
        monthlyTransactions: "",
        hasPayroll: "no",
        hasInventory: "no",
        currentBookkeeping: "",
        biggestPainPoint: "",
        preferredTime: "",
        additionalInfo: ""
      });
    } else {
      setSubmitMessage("Something went wrong. Please try again.");
      console.error("API Error:", result);
    }
  } catch (error) {
    setSubmitMessage("Error submitting request. Please try again.");
    console.error("Submit error:", error);
  } finally {
    setIsSubmitting(false);
  }
    
  };

  return (
    <section id="pricing" className="py-24 bg-white">
      <div className="max-w-6xl mx-auto px-8">
        
        {/* Header */}
        <div className="text-center mb-16">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#b4b237] mb-4">
            Transparent Pricing
          </p>
          <h2 className="text-4xl font-light text-gray-900 mb-4">
            Full Pipeline Bookkeeping
          </h2>
          <p className="text-lg text-gray-600">
            One complete service. Price based on your business size.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          
          {/* Left - Pricing Calculator */}
          <div>
            <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
              <h3 className="text-xl font-semibold text-gray-900 mb-6">Calculate Your Price</h3>
              
              {/* Expense Tier Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Monthly Business Expenses
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(pricingTiers).map(([key, tier]) => (
                    <button
                      key={key}
                      onClick={() => setExpenseTier(key)}
                      className={`p-4 rounded-lg border-2 transition-all ${
                        expenseTier === key 
                          ? 'border-[#b4b237] bg-[#b4b237]/5' 
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900">{tier.range}</div>
                      <div className="text-xs text-gray-500 mt-1">{tier.name} Plan</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Frequency Selector */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  How Often You Need Updates
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {Object.entries(frequencyMultipliers).map(([key, freq]) => (
                    <button
                      key={key}
                      onClick={() => setFrequency(key)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        frequency === key 
                          ? 'border-purple-600 bg-purple-50' 
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                    >
                      <div className="text-sm font-medium text-gray-900">{freq.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Display */}
              <div className="bg-white rounded-xl p-6 border border-gray-200">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">Your Monthly Investment</p>
                  <p className="text-5xl font-light text-gray-900">
                    ${finalPrice.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500 mt-2">per month</p>
                </div>
                
                <div className="mt-6 pt-6 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-900 mb-3">This Includes:</p>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-start">
                      <span className="text-[#b4b237] mr-2">✓</span>
                      Complete 10-step bookkeeping pipeline
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#b4b237] mr-2">✓</span>
                      All accounts connected & reconciled
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#b4b237] mr-2">✓</span>
                      Financial statements delivered {currentFrequency.label.toLowerCase()}
                    </li>
                    <li className="flex items-start">
                      <span className="text-[#b4b237] mr-2">✓</span>
                      Dashboard access 24/7
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Right - Consultation Form */}
          <div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="bg-gray-50 rounded-2xl p-8 border border-gray-100">
                <h3 className="text-xl font-semibold text-gray-900 mb-6">Schedule Consultation</h3>
                
                {/* Contact Info */}
                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Business Name *
                    </label>
                    <input
                      type="text"
                      name="businessName"
                      value={formData.businessName}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Your Name *
                      </label>
                      <input
                        type="text"
                        name="contactName"
                        value={formData.contactName}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                        required
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                      required
                    />
                  </div>
                </div>

                {/* Pipeline Questions */}
                <div className="space-y-4 mb-6 pb-6 border-t border-gray-200">
                  <h4 className="font-medium text-gray-900">Quick Pipeline Assessment</h4>
                  
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Bank Accounts
                      </label>
                      <input
                        type="number"
                        name="numBankAccounts"
                        value={formData.numBankAccounts}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                        placeholder="e.g., 3"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Credit Cards
                      </label>
                      <input
                        type="number"
                        name="numCreditCards"
                        value={formData.numCreditCards}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                        placeholder="e.g., 2"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Monthly Transactions
                      </label>
                      <input
                        type="text"
                        name="monthlyTransactions"
                        value={formData.monthlyTransactions}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                        placeholder="e.g., 200"
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Do you have payroll?
                      </label>
                      <select
                        name="hasPayroll"
                        value={formData.hasPayroll}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">
                        Do you track inventory?
                      </label>
                      <select
                        name="hasInventory"
                        value={formData.hasInventory}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                      >
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Current bookkeeping situation
                    </label>
                    <input
                      type="text"
                      name="currentBookkeeping"
                      value={formData.currentBookkeeping}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                      placeholder="e.g., DIY in Excel, QuickBooks, nothing"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Biggest pain point
                    </label>
                    <input
                      type="text"
                      name="biggestPainPoint"
                      value={formData.biggestPainPoint}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-[#b4b237]"
                      placeholder="e.g., Takes too long, don't understand reports"
                    />
                  </div>
                </div>

                {/* File Upload */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Attach Documents (Optional)
                  </label>
                  <input
                    type="file"
                    multiple
                    onChange={handleFileChange}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                    accept=".pdf,.xls,.xlsx,.csv,.doc,.docx"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Recent statements, reports, or examples
                  </p>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3 bg-gradient-to-r from-[#b4b237] to-[#9a9630] text-white font-medium rounded-lg hover:shadow-xl transition-all disabled:opacity-50"
                >
                  {isSubmitting ? 'Sending...' : 'Schedule Free Consultation'}
                </button>

                {submitMessage && (
                  <div className="mt-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
                    {submitMessage}
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
}
