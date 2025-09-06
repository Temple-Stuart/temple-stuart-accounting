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
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      width: '100%',
      maxWidth: '900px',
      margin: '40px auto',
      background: 'linear-gradient(135deg, rgba(180, 178, 55, 0.03) 0%, rgba(180, 178, 55, 0.08) 50%, rgba(180, 178, 55, 0.03) 100%)',
      border: '2px solid rgba(180, 178, 55, 0.2)',
      borderRadius: '20px',
      padding: '60px 40px',
      position: 'relative',
      overflow: 'hidden',
      boxShadow: '0 10px 40px rgba(180, 178, 55, 0.1), 0 0 80px rgba(180, 178, 55, 0.05) inset',
      boxSizing: 'border-box'
    }}>
      
      <style jsx>{`
        @media (max-width: 768px) {
          .bookkeeping-container {
            padding: 30px 20px !important;
            margin: 20px auto !important;
          }
          .category-buttons {
            flex-wrap: wrap !important;
            gap: 6px !important;
          }
          .category-button {
            padding: 8px 12px !important;
            font-size: 11px !important;
          }
          .services-grid {
            grid-template-columns: 1fr !important;
            gap: 20px !important;
          }
          .service-item {
            padding: 15px !important;
          }
          .service-header {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 8px !important;
          }
        }
        
        @media (max-width: 480px) {
          .bookkeeping-container {
            padding: 20px 15px !important;
            margin: 15px auto !important;
          }
          .hero-title {
            font-size: 24px !important;
          }
          .category-button {
            padding: 6px 8px !important;
            font-size: 10px !important;
          }
        }
      `}</style>

      <div className="bookkeeping-container" style={{ position: 'relative', zIndex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <h2 className="hero-title" style={{
            fontFamily: 'Cinzel, serif',
            color: '#b4b237',
            fontSize: '42px',
            fontWeight: '600',
            margin: '0 0 12px 0',
            letterSpacing: '2px',
            textTransform: 'uppercase'
          }}>
            Services & Pricing
          </h2>
          <p style={{
            color: '#b4b237',
            fontSize: '20px',
            fontWeight: '300',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            opacity: '0.9',
            margin: '0'
          }}>
            What • Why • Value
          </p>
        </div>

        <div className="category-buttons" style={{ 
          display: 'flex', 
          gap: '15px', 
          marginBottom: '40px', 
          justifyContent: 'center',
          flexWrap: 'wrap'
        }}>
          {Object.keys(serviceCategories).map(category => (
            <button
              key={category}
              className="category-button"
              onClick={() => setSelectedCategory(category as keyof ServiceCategories)}
              style={{
                background: selectedCategory === category 
                  ? 'linear-gradient(135deg, #b4b237, rgba(180, 178, 55, 0.8))'
                  : 'linear-gradient(135deg, rgba(180, 178, 55, 0.1), rgba(180, 178, 55, 0.05))',
                border: `1px solid ${selectedCategory === category ? '#b4b237' : 'rgba(180, 178, 55, 0.3)'}`,
                padding: '12px 20px',
                borderRadius: '25px',
                color: selectedCategory === category ? 'white' : '#b4b237',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                transition: 'all 0.3s ease',
                boxShadow: selectedCategory === category ? '0 5px 15px rgba(180, 178, 55, 0.2)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (selectedCategory !== category) {
                  e.currentTarget.style.borderColor = '#b4b237';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 5px 15px rgba(180, 178, 55, 0.2)';
                }
              }}
              onMouseLeave={(e) => {
                if (selectedCategory !== category) {
                  e.currentTarget.style.borderColor = 'rgba(180, 178, 55, 0.3)';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              {category}
            </button>
          ))}
        </div>

        <div className="services-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: '1fr 1fr', 
          gap: '40px',
          alignItems: 'start'
        }}>
          <div style={{ height: '100%' }}>
            {serviceCategories[selectedCategory].map(service => {
              const isSelected = selectedServices.find(s => s.name === service.name);
              return (
                <div
                  key={service.name}
                  className="service-item"
                  onClick={() => toggleService(service)}
                  style={{
                    padding: '24px',
                    marginBottom: '20px',
                    border: `2px solid ${isSelected ? '#b4b237' : 'rgba(180, 178, 55, 0.2)'}`,
                    borderRadius: '16px',
                    cursor: 'pointer',
                    background: isSelected 
                      ? 'linear-gradient(135deg, rgba(180, 178, 55, 0.08), rgba(180, 178, 55, 0.05))'
                      : 'linear-gradient(135deg, rgba(180, 178, 55, 0.02), rgba(180, 178, 55, 0.01))',
                    transition: 'all 0.3s ease',
                    boxShadow: isSelected ? '0 8px 32px rgba(180, 178, 55, 0.15)' : '0 4px 16px rgba(180, 178, 55, 0.05)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 12px 40px rgba(180, 178, 55, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = isSelected ? '0 8px 32px rgba(180, 178, 55, 0.15)' : '0 4px 16px rgba(180, 178, 55, 0.05)';
                  }}
                >
                  <div className="service-header" style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start', 
                    marginBottom: '16px' 
                  }}>
                    <h3 style={{ 
                      margin: 0, 
                      color: '#333', 
                      fontSize: '18px', 
                      fontWeight: '600',
                      maxWidth: '60%'
                    }}>
                      {service.name}
                    </h3>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ 
                        fontSize: '20px', 
                        fontWeight: '700', 
                        color: '#b4b237',
                        marginBottom: '4px'
                      }}>
                        {service.price}
                      </div>
                      <div style={{ 
                        fontSize: '11px', 
                        color: '#b4b237', 
                        textTransform: 'uppercase', 
                        letterSpacing: '0.5px',
                        opacity: '0.8'
                      }}>
                        {service.frequency}
                      </div>
                    </div>
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <strong style={{ color: '#b4b237', fontSize: '13px', fontWeight: '600' }}>Problem: </strong>
                    <span style={{ color: '#666', fontSize: '13px', lineHeight: '1.5' }}>{service.why}</span>
                  </div>
                  
                  <div>
                    <strong style={{ color: '#b4b237', fontSize: '13px', fontWeight: '600' }}>Value: </strong>
                    <span style={{ color: '#666', fontSize: '13px', lineHeight: '1.5' }}>{service.value}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ position: 'sticky', top: '20px', height: 'fit-content' }}>
            <div style={{
              padding: '32px',
              background: 'linear-gradient(135deg, rgba(180, 178, 55, 0.1), rgba(180, 178, 55, 0.05))',
              borderRadius: '16px',
              border: '2px solid rgba(180, 178, 55, 0.2)',
              boxShadow: '0 8px 32px rgba(180, 178, 55, 0.1)'
            }}>
              <h3 style={{ 
                margin: '0 0 24px 0', 
                color: '#b4b237', 
                fontSize: '24px', 
                fontWeight: '600',
                textAlign: 'center',
                letterSpacing: '1px'
              }}>
                Your Quote
              </h3>
              
              {selectedServices.length === 0 ? (
                <p style={{ 
                  margin: 0, 
                  color: '#666', 
                  fontSize: '16px',
                  textAlign: 'center',
                  fontStyle: 'italic'
                }}>
                  Select services to see total
                </p>
              ) : (
                <>
                  {totals.oneTime > 0 && (
                    <div style={{ 
                      marginBottom: '16px',
                      padding: '16px',
                      background: 'rgba(180, 178, 55, 0.05)',
                      borderRadius: '8px',
                      border: '1px solid rgba(180, 178, 55, 0.2)'
                    }}>
                      <div style={{ color: '#b4b237', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                        One-time Setup
                      </div>
                      <span style={{ color: '#333', fontSize: '20px', fontWeight: '700' }}>
                        ${totals.oneTime.toLocaleString()}
                      </span>
                    </div>
                  )}
                  
                  {totals.monthly > 0 && (
                    <div style={{ 
                      marginBottom: '24px',
                      padding: '16px',
                      background: 'rgba(180, 178, 55, 0.05)',
                      borderRadius: '8px',
                      border: '1px solid rgba(180, 178, 55, 0.2)'
                    }}>
                      <div style={{ color: '#b4b237', fontSize: '14px', fontWeight: '600', marginBottom: '4px' }}>
                        Monthly Service
                      </div>
                      <span style={{ color: '#333', fontSize: '20px', fontWeight: '700' }}>
                        ${totals.monthly.toLocaleString()}
                      </span>
                    </div>
                  )}

                  <button style={{
                    width: '100%',
                    padding: '16px',
                    background: 'linear-gradient(135deg, #b4b237, rgba(180, 178, 55, 0.8))',
                    color: 'white',
                    border: 'none',
                    borderRadius: '25px',
                    fontSize: '14px',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    cursor: 'pointer',
                    transition: 'all 0.3s ease',
                    boxShadow: '0 4px 16px rgba(180, 178, 55, 0.3)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 8px 24px rgba(180, 178, 55, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(180, 178, 55, 0.3)';
                  }}
                  >
                    Get Quote
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
