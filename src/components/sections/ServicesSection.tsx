'use client';

import React, { useState } from 'react';

export default function ServicesSection() {
  const [activeService, setActiveService] = useState('bookkeeping');

  const services = {
    bookkeeping: {
      title: 'AI-Powered Bookkeeping',
      description: 'Automated transaction categorization with expert oversight',
      features: [
        'Real-time bank reconciliation',
        '99.7% accuracy guarantee',
        'Monthly financial statements',
        'Expense management automation',
        'Multi-entity consolidation'
      ],
      pricing: 'Starting at $400/month',
      highlight: 'Save 20+ hours weekly'
    },
    tax: {
      title: 'Strategic Tax Planning',
      description: 'Proactive planning to minimize your tax burden',
      features: [
        'Year-round tax strategy',
        'Quarterly tax projections',
        'Entity structure optimization',
        'R&D credit identification',
        'Multi-state compliance'
      ],
      pricing: 'Starting at $250/month',
      highlight: 'Average $15K savings'
    },
    automation: {
      title: 'Business Automation',
      description: 'Streamline operations with intelligent workflows',
      features: [
        'Invoice automation',
        'Payment processing setup',
        'Financial dashboard creation',
        'Integration with 200+ apps',
        'Custom workflow design'
      ],
      pricing: 'Starting at $800 setup',
      highlight: '40% efficiency gain'
    }
  };

  return (
    <section className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Premium Financial Services
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Combining cutting-edge automation with human expertise to deliver exceptional results for discerning businesses.
          </p>
        </div>

        {/* Service Tabs */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {Object.entries(services).map(([key, service]) => (
            <button
              key={key}
              onClick={() => setActiveService(key)}
              className={`px-8 py-3 rounded-full font-semibold transition-all duration-300 ${
                activeService === key
                  ? 'bg-gradient-to-r from-purple-600 to-amber-500 text-white shadow-lg transform -translate-y-1'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {service.title}
            </button>
          ))}
        </div>

        {/* Active Service Display */}
        <div className="bg-gradient-to-br from-purple-50 to-amber-50 rounded-2xl p-8 lg:p-12">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            
            {/* Service Content */}
            <div className="space-y-6">
              <div>
                <h3 className="text-3xl font-bold text-gray-900 mb-4">
                  {services[activeService].title}
                </h3>
                <p className="text-lg text-gray-600 mb-6">
                  {services[activeService].description}
                </p>
              </div>

              {/* Features List */}
              <div className="space-y-3">
                {services[activeService].features.map((feature, index) => (
                  <div key={index} className="flex items-center">
                    <div className="w-5 h-5 bg-gradient-to-r from-purple-500 to-amber-500 rounded-full flex items-center justify-center mr-3">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Pricing & CTA */}
              <div className="flex items-center justify-between pt-6 border-t border-gray-200">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    {services[activeService].pricing}
                  </div>
                  <div className="text-purple-600 font-semibold">
                    {services[activeService].highlight}
                  </div>
                </div>
                <button className="px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200">
                  Get Started
                </button>
              </div>
            </div>

            {/* Visual Element */}
            <div className="relative">
              <div className="bg-white rounded-xl shadow-xl p-6">
                {/* Mock interface based on active service */}
                {activeService === 'bookkeeping' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900">Account Reconciliation</h4>
                      <span className="text-green-600 text-sm font-medium">✓ Complete</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Checking Account</span>
                        <span className="text-green-600">$47,293.82</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Savings Account</span>
                        <span className="text-green-600">$15,847.23</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Credit Card</span>
                        <span className="text-red-600">($3,192.45)</span>
                      </div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <div className="text-sm text-purple-700">
                        AI detected 3 potential duplicates - reviewed and resolved
                      </div>
                    </div>
                  </div>
                )}

                {activeService === 'tax' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900">Tax Savings Opportunities</h4>
                      <span className="text-amber-600 text-sm font-medium">3 Found</span>
                    </div>
                    <div className="space-y-3">
                      <div className="bg-amber-50 p-3 rounded-lg">
                        <div className="font-medium text-amber-900">R&D Tax Credit</div>
                        <div className="text-sm text-amber-700">Potential savings: $12,500</div>
                      </div>
                      <div className="bg-amber-50 p-3 rounded-lg">
                        <div className="font-medium text-amber-900">Equipment Depreciation</div>
                        <div className="text-sm text-amber-700">Potential savings: $8,200</div>
                      </div>
                      <div className="bg-amber-50 p-3 rounded-lg">
                        <div className="font-medium text-amber-900">Home Office Deduction</div>
                        <div className="text-sm text-amber-700">Potential savings: $3,600</div>
                      </div>
                    </div>
                  </div>
                )}

                {activeService === 'automation' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-gray-900">Workflow Automation</h4>
                      <span className="text-purple-600 text-sm font-medium">5 Active</span>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span>Invoice Generation</span>
                        <span className="text-green-600">Running</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Payment Reminders</span>
                        <span className="text-green-600">Running</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span>Expense Categorization</span>
                        <span className="text-green-600">Running</span>
                      </div>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <div className="text-sm text-purple-700">
                        Automation saved 47 hours this month
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Floating badges */}
              <div className="absolute -top-3 -right-3 bg-gradient-to-r from-purple-600 to-amber-500 text-white px-3 py-1 rounded-full text-xs font-semibold">
                Premium
              </div>
            </div>
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16">
          <div className="bg-gradient-to-r from-purple-600 to-amber-500 rounded-2xl p-8 text-white">
            <h3 className="text-2xl font-bold mb-4">
              Ready to Transform Your Finances?
            </h3>
            <p className="text-purple-100 mb-6 max-w-2xl mx-auto">
              Join 500+ businesses who trust Temple Stuart for their accounting and automation needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="px-8 py-3 bg-white text-purple-600 font-semibold rounded-lg hover:bg-gray-50 transition-all duration-200">
                Schedule Consultation
              </button>
              <button className="px-8 py-3 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-purple-600 transition-all duration-200">
                View Case Studies
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
