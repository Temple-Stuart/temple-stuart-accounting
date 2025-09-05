'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';

export default function AccountsPage() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);

  // Fetch accounts data
  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAccounts(data.plaidItems);
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
    }
  };

  // Fetch link token from API
  const fetchLinkToken = async () => {
    try {
      const response = await fetch('/api/plaid/link-token', {
        method: 'POST',
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch link token');
      }
      
      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (error) {
      console.error('Error fetching link token:', error);
    } finally {
      setLoading(false);
    }
  };

  // Handle successful Plaid Link
  const onSuccess = useCallback(async (public_token: string, metadata: any) => {
    try {
      const response = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ 
          public_token,
          institution_name: metadata.institution?.name || 'Unknown Bank'
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to exchange token');
      }

      await fetchAccounts(); // Refresh accounts after connecting
      alert('Bank account connected successfully!');
    } catch (error) {
      console.error('Error exchanging token:', error);
      alert('Failed to connect bank account. Please try again.');
    }
  }, []);

  // Plaid Link configuration
  const config = {
    token: linkToken,
    onSuccess,
    onExit: (err: any, metadata: any) => {
      if (err) {
        console.error('Plaid Link exit error:', err);
      }
    },
  };

  const { open, ready } = usePlaidLink(config);

  useEffect(() => {
    fetchLinkToken();
    fetchAccounts();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleConnectClick = () => {
    if (open) {
      open();
    }
  };

  return (
    <div className="accounts-page">
      <style jsx>{`
        .accounts-page {
          min-height: 100vh;
          background: linear-gradient(135deg, 
            rgba(180, 178, 55, 0.03) 0%, 
            rgba(180, 178, 55, 0.08) 50%, 
            rgba(180, 178, 55, 0.03) 100%);
          padding: 40px 20px;
        }

        .container {
          max-width: 1200px;
          margin: 0 auto;
          background: white;
          border-radius: 20px;
          padding: 40px;
          box-shadow: 0 10px 40px rgba(180, 178, 55, 0.1);
        }

        .page-title {
          color: #b4b237;
          font-size: 32px;
          font-weight: 600;
          text-align: center;
          margin-bottom: 30px;
          letter-spacing: 1px;
          text-transform: uppercase;
        }

        .connect-section {
          background: rgba(180, 178, 55, 0.03);
          border: 2px solid rgba(180, 178, 55, 0.2);
          border-radius: 12px;
          padding: 30px;
          text-align: center;
          margin-bottom: 40px;
        }

        .plaid-btn {
          background: linear-gradient(135deg, #b4b237, rgba(180, 178, 55, 0.8));
          color: white;
          border: none;
          padding: 15px 30px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          transition: all 0.3s ease;
        }

        .plaid-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(180, 178, 55, 0.3);
        }

        .plaid-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
          transform: none;
        }

        .accounts-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }

        .accounts-table th,
        .accounts-table td {
          padding: 15px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        .accounts-table th {
          background: #f8f9fa;
          font-weight: 600;
          color: #333;
          text-transform: uppercase;
          font-size: 14px;
          letter-spacing: 0.5px;
        }

        .bank-name {
          font-weight: 600;
          color: #b4b237;
          margin-bottom: 20px;
          font-size: 18px;
        }

        .account-type {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          text-transform: uppercase;
          font-weight: 500;
        }

        .type-investment {
          background: #e3f2fd;
          color: #1976d2;
        }

        .type-depository {
          background: #e8f5e8;
          color: #388e3c;
        }
      `}</style>

      <div className="container">
        <h1 className="page-title">Your Accounts</h1>
        
        <div className="connect-section">
          <button 
            className="plaid-btn" 
            onClick={handleConnectClick}
            disabled={!ready || loading}
          >
            {loading ? 'Loading...' : '+ Connect Another Bank Account'}
          </button>
        </div>

        {accounts.map((item: any) => (
          <div key={item.id}>
            <div className="bank-name">{item.institutionName}</div>
            <table className="accounts-table">
              <thead>
                <tr>
                  <th>Account Name</th>
                  <th>Type</th>
                  <th>Current Balance</th>
                  <th>Available Balance</th>
                </tr>
              </thead>
              <tbody>
                {item.accounts.map((account: any) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td>
                      <span className={`account-type type-${account.type}`}>
                        {account.subtype || account.type}
                      </span>
                    </td>
                    <td>{formatCurrency(account.balanceCurrent || 0)}</td>
                    <td>{formatCurrency(account.balanceAvailable || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </div>
  );
}
