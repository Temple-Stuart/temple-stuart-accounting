'use client';

import React, { useState } from 'react';

interface Service {
  name: string;
  why: string;
  value: string;
  price: string;
  frequency: string;
}

type ServiceCategories = {
  'Monthly Essentials': Service[];
  'Automation Setup': Service[];
  'Data Integration': Service[];
  'Business Intelligence': Service[];
};

export default function BookkeepingSection() {
  const [selectedCategory, setSelectedCategory] = useState<keyof ServiceCategories>('Monthly Essentials');
  const [selectedServices, setSelectedServices] = useState<Service[]>([]);

  const serviceCategories: ServiceCategories = {
    'Monthly Essentials': [
      {
        name: "Complete Bookkeeping",
        why: "68% of small businesses spend 25+ hours weekly on manual data entry",
        value: "Get back 20 hours per week + accurate financial reports",
        price: "$400",
        frequency: "monthly"
      },
      {
        name: "Bank Reconciliation", 
        why: "Unreconciled accounts hide cash flow problems until it's too late",
        value: "Catch errors before they compound, know your real cash position",
        price: "$150",
        frequency: "monthly"
      },
      {
        name: "Bill Management",
        why: "Late payments cost 2% per month in fees and damage credit",
        value: "Never miss a payment, optimize cash flow timing",
        price: "$250",
        frequency: "monthly"
      },
      {
        name: "Customer Payment Tracking",
        why: "Businesses lose 5% revenue annually to uncollected invoices",
        value: "Reduce collection time by 30 days, improve cash flow",
        price: "$300",
        frequency: "monthly"
      }
    ],
    'Automation Setup': [
      {
        name: "QuickBooks Setup & Training",
        why: "82% of businesses use outdated or incorrectly configured systems",
        value: "Reduce errors by 90%, cut monthly bookkeeping time in half",
        price: "$800",
        frequency: "one-time"
      },
      {
        name: "Bank Feed Integration",
        why: "Manual transaction entry creates 15-20 errors per 100 transactions",
        value: "99.7% accuracy, instant transaction import from all accounts",
        price: "$300",
        frequency: "one-time"
      },
      {
        name: "Receipt Scanner Setup",
        why: "Lost receipts cost businesses $4,800 annually in missed deductions",
        value: "Capture 100% of expenses, automatic categorization",
        price: "$400",
        frequency: "one-time"
      }
    ],
    'Data Integration': [
      {
        name: "CRM to Accounting Sync",
        why: "Disconnected systems create data silos and duplicate work",
        value: "Sales data flows automatically, no double entry",
        price: "$1,200",
        frequency: "one-time"
      },
      {
        name: "E-commerce Integration",
        why: "Manual sales entry delays reporting by 2-3 weeks",
        value: "Real-time sales data, instant profit margins by product",
        price: "$900",
        frequency: "one-time"
      },
      {
        name: "Payment Processing Sync",
        why: "Payment fees and timing discrepancies mess up cash flow",
        value: "Automatic fee tracking, accurate cash flow projections",
        price: "$600",
        frequency: "one-time"
      }
    ],
    'Business Intelligence': [
      {
        name: "Financial Dashboard",
        why: "87% of small businesses can't access real-time financial data",
        value: "See profit margins, cash flow, trends updated daily",
        price: "$2,000",
        frequency: "one-time"
      },
      {
        name: "Cash Flow Forecasting",
        why: "82% of business failures are due to poor cash flow management",
        value: "Predict cash needs 3-6 months ahead, prevent shortfalls",
        price: "$1,500",
        frequency: "one-time"
      }
    ]
  };

  const toggleService = (service: Service) => {
    if (selectedServices.find(s => s.name === service.name)) {
      setSelectedServices(selectedServices.filter(s => s.name !== service.name));
    } else {
      setSelectedServices([...selectedServices, service]);
    }
  };

  const calculateTotal = () => {
    const oneTime = selectedServices
      .filter(s => s.frequency === 'one-time')
      .reduce((sum, s) => sum + parseInt(s.price.replace('$', '').replace(',', '')), 0);
    
    const monthly = selectedServices
      .filter(s => s.frequency === 'monthly')
      .reduce((sum, s) => sum + parseInt(s.price.replace('$', '').replace(',', '')), 0);

    return { oneTime, monthly };
  };

  const totals = calculateTotal();

  return (
    <section className="py-20">
      <div className="max-w-7xl mx-auto px-6">
        
        {/* Category Buttons */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {Object.keys(serviceCategories).map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category as keyof ServiceCategories)}
              className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${
                selectedCategory === category 
                  ? 'bg-gradient-to-r from-purple-600 to-amber-500 text-white shadow-lg transform -translate-y-1'
                  : 'bg-white/70 backdrop-blur text-purple-700 hover:bg-white/90 border border-purple-200'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          
          {/* Services List */}
          <div className="space-y-6">
            {serviceCategories[selectedCategory].map(service => {
              const isSelected = selectedServices.find(s => s.name === service.name);
              return (
                <div
                  key={service.name}
                  onClick={() => toggleService(service)}
                  className={`p-6 rounded-2xl cursor-pointer transition-all duration-300 transform hover:-translate-y-2 ${
                    isSelected 
                      ? 'bg-gradient-to-r from-purple-100 to-amber-100 border-2 border-amber-400 shadow-xl'
                      : 'bg-white/70 backdrop-blur border-2 border-purple-200 hover:shadow-lg'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-semibold text-gray-900 max-w-xs">
                      {service.name}
                    </h3>
                    <div className="text-right">
                      <div className="text-xl font-bold bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent">
                        {service.price}
                      </div>
                      <div className="text-xs text-purple-600 uppercase tracking-wide">
                        {service.frequency}
                      </div>
                    </div>
                  </div>
                  
                  <div className="mb-3">
                    <span className="font-semibold bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent text-sm">Problem: </span>
                    <span className="text-gray-600 text-sm">{service.why}</span>
                  </div>
                  
                  <div>
                    <span className="font-semibold bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent text-sm">Value: </span>
                    <span className="text-gray-600 text-sm">{service.value}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quote Section */}
          <div className="sticky top-8">
            <div className="bg-gradient-to-br from-purple-100 to-amber-100 rounded-2xl p-8 border-2 border-purple-200 shadow-xl">
              <h3 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent">
                Your Quote
              </h3>
              
              {selectedServices.length === 0 ? (
                <p className="text-center text-gray-600 italic">
                  Select services to see total
                </p>
              ) : (
                <div className="space-y-4">
                  {totals.oneTime > 0 && (
                    <div className="bg-white rounded-lg p-4 border border-purple-200">
                      <div className="text-sm font-semibold text-purple-600 mb-1">One-time Setup</div>
                      <div className="text-2xl font-bold text-gray-900">${totals.oneTime.toLocaleString()}</div>
                    </div>
                  )}
                  
                  {totals.monthly > 0 && (
                    <div className="bg-white rounded-lg p-4 border border-purple-200">
                      <div className="text-sm font-semibold text-purple-600 mb-1">Monthly Service</div>
                      <div className="text-2xl font-bold text-gray-900">${totals.monthly.toLocaleString()}</div>
                    </div>
                  )}

                  <button className="w-full py-4 bg-gradient-to-r from-purple-600 to-amber-500 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-amber-600 transform hover:-translate-y-1 transition-all duration-200 shadow-lg">
                    Get Quote
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
