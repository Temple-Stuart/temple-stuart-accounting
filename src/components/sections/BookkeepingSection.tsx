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
    <div style={{
      fontFamily: 'Inter, sans-serif',
      maxWidth: '900px',
      margin: '40px auto',
      padding: '30px',
      background: 'linear-gradient(135deg, rgba(180, 178, 55, 0.02) 0%, rgba(180, 178, 55, 0.05) 50%, rgba(180, 178, 55, 0.02) 100%)',
      border: '1px solid rgba(180, 178, 55, 0.15)',
      borderRadius: '16px',
      boxShadow: '0 8px 32px rgba(180, 178, 55, 0.08)'
    }}>
      
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h2 style={{
          fontFamily: 'Cinzel, serif',
          color: '#b4b237',
          fontSize: '28px',
          fontWeight: '600',
          margin: '0 0 12px 0',
          letterSpacing: '1px',
          textTransform: 'uppercase'
        }}>
          Services & Pricing
        </h2>
        <p style={{
          color: '#b4b237',
          fontSize: '13px',
          fontWeight: '300',
          letterSpacing: '1.5px',
          textTransform: 'uppercase',
          opacity: '0.8'
        }}>
          What • Why • Value
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '25px', justifyContent: 'center' }}>
        {Object.keys(serviceCategories).map(category => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category as keyof ServiceCategories)}
            style={{
              padding: '10px 16px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: selectedCategory === category ? '#b4b237' : 'rgba(180, 178, 55, 0.1)',
              color: selectedCategory === category ? 'white' : '#b4b237',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              transition: 'all 0.3s ease'
            }}
          >
            {category}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' }}>
        <div>
          {serviceCategories[selectedCategory].map(service => {
            const isSelected = selectedServices.find(s => s.name === service.name);
            return (
              <div
                key={service.name}
                onClick={() => toggleService(service)}
                style={{
                  padding: '20px',
                  marginBottom: '15px',
                  border: `1px solid ${isSelected ? '#b4b237' : 'rgba(180, 178, 55, 0.1)'}`,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  backgroundColor: isSelected ? 'rgba(180, 178, 55, 0.05)' : 'rgba(180, 178, 55, 0.01)',
                  transition: 'all 0.3s ease'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <h3 style={{ margin: 0, color: '#333', fontSize: '16px', fontWeight: '600' }}>
                    {service.name}
                  </h3>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: '700', color: '#b4b237' }}>
                      {service.price}
                    </div>
                    <div style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {service.frequency}
                    </div>
                  </div>
                </div>
                
                <div style={{ marginBottom: '8px' }}>
                  <strong style={{ color: '#666', fontSize: '13px' }}>Problem: </strong>
                  <span style={{ color: '#666', fontSize: '13px' }}>{service.why}</span>
                </div>
                
                <div>
                  <strong style={{ color: '#666', fontSize: '13px' }}>Value: </strong>
                  <span style={{ color: '#666', fontSize: '13px' }}>{service.value}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ position: 'sticky', top: '20px', height: 'fit-content' }}>
          <div style={{
            padding: '20px',
            backgroundColor: 'rgba(180, 178, 55, 0.08)',
            borderRadius: '10px',
            border: '1px solid rgba(180, 178, 55, 0.15)'
          }}>
            <h3 style={{ margin: '0 0 15px 0', color: '#b4b237', fontSize: '18px', fontWeight: '600' }}>
              Your Quote
            </h3>
            
            {selectedServices.length === 0 ? (
              <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>Select services to see total</p>
            ) : (
              <>
                {totals.oneTime > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <span style={{ color: '#333', fontSize: '16px', fontWeight: '600' }}>
                      Setup: ${totals.oneTime.toLocaleString()}
                    </span>
                  </div>
                )}
                
                {totals.monthly > 0 && (
                  <div style={{ marginBottom: '15px' }}>
                    <span style={{ color: '#333', fontSize: '16px', fontWeight: '600' }}>
                      Monthly: ${totals.monthly.toLocaleString()}
                    </span>
                  </div>
                )}

                <button style={{
                  width: '100%',
                  padding: '12px',
                  backgroundColor: '#b4b237',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  cursor: 'pointer'
                }}>
                  Get Quote
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
