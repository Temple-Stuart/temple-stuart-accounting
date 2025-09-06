'use client';

import React, { useState } from 'react';

export default function PricingSection() {
  const [billingCycle, setBillingCycle] = useState('monthly');

  const plans = [
    {
      name: 'Foundation',
      description: 'Perfect for startups and small businesses',
      monthlyPrice: 400,
      yearlyPrice: 4320, // 10% discount
      features: [
        'Monthly bookkeeping',
        'Bank reconciliation',
        'Financial statements',
        'Basic automation setup',
        'Email support',
        'QuickBooks integration'
      ],
      highlight: false,
      cta: 'Start Foundation'
    },
    {
      name: 'Growth',
      description: 'Ideal for scaling businesses',
      monthlyPrice: 800,
      yearlyPrice: 8640, // 10% discount
      features: [
        'Everything in Foundation',
        'Tax planning & preparation',
        'Advanced automation',
        'Custom financial dashboards',
        'Priority phone support',
        'Multi-entity management',
        'Cash flow forecasting'
      ],
      highlight: true,
      badge: 'Most Popular',
      cta: 'Choose Growth'
    },
    {
      name: 'Enterprise',
      description: 'For established companies needing full CFO services',
      monthlyPrice: 1500,
      yearlyPrice: 16200, // 10% discount
      features: [
        'Everything in Growth',
        'Dedicated CFO services',
        'Strategic business planning',
        'Board-ready financial reports',
        'M&A transaction support',
        'Custom integrations',
        '24/7 priority support',
        'Quarterly business reviews'
      ],
      highlight: false,
      cta: 'Contact Sales'
    }
  ];

  const getPrice = (plan) => {
    return billingCycle === 'monthly' ? plan.monthlyPrice : Math.floor(plan.yearlyPrice / 12);
  };

  const getSavings = (plan) => {
    if (billingCycle === 'yearly') {
      const monthlyCost = plan.monthlyPrice * 12;
      const savings = monthlyCost - plan.yearlyPrice;
      return savings;
    }
    return 0;
  };

  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 to-purple-50">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            No hidden fees. No surprises. Choose the plan that fits your business needs and scale as you grow.
          </p>
          
          {/* Billing Toggle */}
          <div className="inline-flex bg-white rounded-full p-1 shadow-lg">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-6 py-2 rounded-full font-semibold transition-all duration-200 ${
                billingCycle === 'monthly'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-6 py-2 rounded-full font-semibold transition-all duration-200 relative ${
                billingCycle === 'yearly'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Yearly
              <span className="absolute -top-2 -right-2 bg-amber-500 text-white text-xs px-2 py-1 rounded-full">
                Save 10%
              </span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-8 mb-16">
          {plans.map((plan, index) => (
            <div
              key={plan.name}
              className={`relative bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden ${
                plan.highlight ? 'ring-2 ring-purple-600 transform scale-105' : ''
              }`}
            >
              {/* Popular Badge */}
              {plan.badge && (
                <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                  <div className="bg-gradient-to-r from-purple-600 to-amber-500 text-white px-4 py-1 rounded-full text-sm font-semibold">
                    {plan.badge}
                  </div>
                </div>
              )}

              <div className="p-8">
                {/* Plan Header */}
                <div className="text-center mb-8">
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {plan.description}
                  </p>
                  
                  {/* Pricing */}
                  <div className="mb-4">
                    <div className="flex items-baseline justify-center">
                      <span className="text-5xl font-bold text-gray-900">
                        ${getPrice(plan).toLocaleString()}
                      </span>
                      <span className="text-gray-600 ml-2">
                        /{billingCycle === 'monthly' ? 'month' : 'month'}
                      </span>
                    </div>
                    {billingCycle === 'yearly' && getSavings(plan) > 0 && (
                      <div className="text-green-600 text-sm font-medium mt-2">
                        Save ${getSavings(plan)} annually
                      </div>
                    )}
                  </div>
                </div>

                {/* Features */}
                <div className="space-y-4 mb-8">
                  {plan.features.map((feature, featureIndex) => (
                    <div key={featureIndex} className="flex items-start">
                      <div className="w-5 h-5 bg-gradient-to-r from-purple-500 to-amber-500 rounded-full flex items-center justify-center mr-3 mt-0.5 flex-shrink-0">
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <span className="text-gray-700 text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <button
                  className={`w-full py-4 rounded-lg font-semibold transition-all duration-200 ${
                    plan.highlight
                      ? 'bg-gradient-to-r from-purple-600 to-amber-500 text-white hover:from-purple-700 hover:to-amber-600 shadow-lg'
                      : 'border-2 border-purple-600 text-purple-600 hover:bg-purple-50'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Additional Info */}
        <div className="grid md:grid-cols-3 gap-8 text-center">
          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">30-Day Guarantee</h3>
            <p className="text-gray-600 text-sm">Not satisfied? Get a full refund within 30 days, no questions asked.</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Quick Setup</h3>
            <p className="text-gray-600 text-sm">Get started in under 24 hours with our streamlined onboarding process.</p>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-lg">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a2.25 2.25 0 012.25 2.25v15a2.25 2.25 0 01-4.5 0v-15A2.25 2.25 0 0112 2.25z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Flexible Plans</h3>
            <p className="text-gray-600 text-sm">Upgrade, downgrade, or cancel anytime. No long-term contracts required.</p>
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="mt-16 text-center">
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-purple-200">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Need Something Custom?
            </h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Large enterprise or unique requirements? Let's discuss a custom solution tailored to your specific needs.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="px-8 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200">
                Schedule Enterprise Call
              </button>
              <button className="px-8 py-3 border-2 border-purple-600 text-purple-600 font-semibold rounded-lg hover:bg-purple-50 transition-all duration-200">
                Request Custom Quote
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
