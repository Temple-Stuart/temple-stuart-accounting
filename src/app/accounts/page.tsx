'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';

export default function AccountsPage() {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch link token from API
  const fetchLinkToken = async () => {
    try {
      const response = await fetch('/api/plaid/link-token', {
        method: 'POST',
        credentials: 'include',
      });
      
      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response text:', responseText);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch link token: ${response.status} - ${responseText}`);
      }
      
      const data = JSON.parse(responseText);
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

      const data = await response.json();
      console.log('Successfully connected bank:', data);
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
  }, []);

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
          max-width: 800px;
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
        }

        .connect-title {
          color: #b4b237;
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 15px;
        }

        .connect-description {
          color: #666;
          font-size: 16px;
          margin-bottom: 30px;
          line-height: 1.6;
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
      `}</style>

      <div className="container">
        <h1 className="page-title">Your Accounts</h1>
        
        <div className="connect-section">
          <h2 className="connect-title">Connect Your Bank Accounts</h2>
          <p className="connect-description">
            Securely link your bank accounts to get started with automated bookkeeping 
            and financial insights. Your data is encrypted and protected.
          </p>
          <button 
            className="plaid-btn" 
            onClick={open}
            disabled={!ready || loading}
          >
            {loading ? 'Loading...' : 'Connect Bank Account'}
          </button>
        </div>
      </div>
    </div>
  );
}
