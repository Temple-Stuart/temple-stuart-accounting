'use client';

import { useState, useEffect } from 'react';

interface Transaction {
  transaction_id: string;
  account_id: string;
  amount: number;
  date: string;
  merchant_name: string;
  name: string;
  institution_name: string;
  personal_finance_category: {
    primary: string;
    detailed: string;
  };
  location: {
    city: string;
    region: string;
  };
  pending: boolean;
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    try {
      const response = await fetch('/api/transactions');
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, rgba(180, 178, 55, 0.03) 0%, rgba(180, 178, 55, 0.08) 50%, rgba(180, 178, 55, 0.03) 100%)'
      }}>
        <div style={{ color: '#b4b237', fontSize: '18px', fontWeight: '600' }}>Loading transactions...</div>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, rgba(180, 178, 55, 0.03) 0%, rgba(180, 178, 55, 0.08) 50%, rgba(180, 178, 55, 0.03) 100%)',
      padding: '40px 20px'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '40px', textAlign: 'center' }}>
          <h1 style={{
            color: '#b4b237',
            fontSize: '42px',
            fontWeight: '600',
            margin: '0 0 12px 0',
            letterSpacing: '2px',
            textTransform: 'uppercase',
            fontFamily: 'Cinzel, serif'
          }}>
            Your Transactions
          </h1>
          <p style={{
            color: '#666',
            fontSize: '16px',
            margin: '0',
            letterSpacing: '0.5px'
          }}>
            Complete transaction history from all connected accounts
          </p>
        </div>
        
        <div style={{
          background: 'linear-gradient(135deg, rgba(180, 178, 55, 0.03) 0%, rgba(180, 178, 55, 0.08) 50%, rgba(180, 178, 55, 0.03) 100%)',
          border: '2px solid rgba(180, 178, 55, 0.2)',
          borderRadius: '20px',
          padding: '0',
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(180, 178, 55, 0.1), 0 0 80px rgba(180, 178, 55, 0.05) inset'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ 
                  background: 'linear-gradient(135deg, rgba(180, 178, 55, 0.1), rgba(180, 178, 55, 0.05))',
                  borderBottom: '1px solid rgba(180, 178, 55, 0.3)'
                }}>
                  <th style={{
                    padding: '20px 24px',
                    textAlign: 'left',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#b4b237',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase'
                  }}>
                    Date
                  </th>
                  <th style={{
                    padding: '20px 24px',
                    textAlign: 'left',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#b4b237',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase'
                  }}>
                    Institution
                  </th>
                  <th style={{
                    padding: '20px 24px',
                    textAlign: 'left',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#b4b237',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase',
                    maxWidth: '200px'
                  }}>
                    Merchant
                  </th>
                  <th style={{
                    padding: '20px 24px',
                    textAlign: 'left',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#b4b237',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase'
                  }}>
                    Amount
                  </th>
                  <th style={{
                    padding: '20px 24px',
                    textAlign: 'left',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#b4b237',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase'
                  }}>
                    Category
                  </th>
                  <th style={{
                    padding: '20px 24px',
                    textAlign: 'left',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#b4b237',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase'
                  }}>
                    Location
                  </th>
                  <th style={{
                    padding: '20px 24px',
                    textAlign: 'left',
                    fontSize: '13px',
                    fontWeight: '600',
                    color: '#b4b237',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase'
                  }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((transaction, index) => (
                  <tr key={transaction.transaction_id} style={{
                    borderBottom: index < transactions.length - 1 ? '1px solid rgba(180, 178, 55, 0.1)' : 'none',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(180, 178, 55, 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}>
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: '#333' }}>
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: '#666', fontWeight: '600' }}>
                      {transaction.institution_name === 'Robinhood' ? 'RH' : 
                       transaction.institution_name === 'Wells Fargo' ? 'WF' : 
                       transaction.institution_name}
                    </td>
                    <td style={{
                      padding: '16px 24px',
                      fontSize: '14px',
                      maxWidth: '200px',
                      wordWrap: 'break-word',
                      overflowWrap: 'break-word',
                      whiteSpace: 'normal'
                    }}>
                      <div style={{ fontWeight: '600', color: '#333' }}>
                        {transaction.merchant_name || transaction.name}
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '14px' }}>
                      <span style={{
                        color: transaction.amount > 0 ? '#dc2626' : '#16a34a',
                        fontWeight: '600'
                      }}>
                        ${Math.abs(transaction.amount).toFixed(2)}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: '#666' }}>
                      {transaction.personal_finance_category?.primary?.replace(/_/g, ' ') || 'Other'}
                    </td>
                    <td style={{ padding: '16px 24px', fontSize: '14px', color: '#666' }}>
                      {transaction.location?.city && transaction.location?.region 
                        ? `${transaction.location.city}, ${transaction.location.region}`
                        : 'N/A'
                      }
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        display: 'inline-flex',
                        padding: '6px 12px',
                        fontSize: '12px',
                        fontWeight: '600',
                        borderRadius: '25px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        background: transaction.pending 
                          ? 'linear-gradient(135deg, rgba(180, 178, 55, 0.1), rgba(180, 178, 55, 0.05))' 
                          : 'linear-gradient(135deg, rgba(34, 197, 94, 0.1), rgba(34, 197, 94, 0.05))',
                        border: transaction.pending 
                          ? '1px solid rgba(180, 178, 55, 0.3)' 
                          : '1px solid rgba(34, 197, 94, 0.3)',
                        color: transaction.pending ? '#b4b237' : '#16a34a'
                      }}>
                        {transaction.pending ? 'Pending' : 'Completed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        
        <div style={{
          marginTop: '30px',
          textAlign: 'center',
          fontSize: '14px',
          color: '#666',
          background: 'linear-gradient(135deg, rgba(180, 178, 55, 0.1), rgba(180, 178, 55, 0.05))',
          border: '1px solid rgba(180, 178, 55, 0.3)',
          padding: '16px 24px',
          borderRadius: '25px',
          display: 'inline-block'
        }}>
          Total transactions: <span style={{ color: '#b4b237', fontWeight: '600' }}>{transactions.length}</span>
        </div>
      </div>
    </div>
  );
}
