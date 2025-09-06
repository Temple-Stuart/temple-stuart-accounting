'use client';

import { useState, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';

interface Account {
  id: string;
  name: string;
  type: string;
  subtype: string;
  balance: number;
}

interface PlaidItem {
  id: string;
  institutionName: string;
  accounts: Account[];
}

export default function AccountsPage() {
  const [plaidItems, setPlaidItems] = useState<PlaidItem[]>([]);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLinkToken();
    fetchAccounts();
  }, []);

  const fetchLinkToken = async () => {
    try {
      const response = await fetch('/api/plaid/link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();
      setLinkToken(data.link_token);
    } catch (error) {
      console.error('Error fetching link token:', error);
    }
  };

  const fetchAccounts = async () => {
    try {
      const response = await fetch('/api/accounts');
      const data = await response.json();
      setPlaidItems(data.plaidItems || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
    } finally {
      setLoading(false);
    }
  };

  const onSuccess = async (public_token: string) => {
    try {
      await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_token }),
      });
      await fetchAccounts();
    } catch (error) {
      console.error('Error exchanging token:', error);
    }
  };

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: (err) => {
      if (err) console.error('Plaid Link exited with error:', err);
    },
    onEvent: (eventName, metadata) => {
      console.log('Plaid event:', eventName, metadata);
    },
  });

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontFamily: 'Inter, sans-serif'
      }}>
        <div>Loading accounts...</div>
      </div>
    );
  }

  return (
    <div style={{
      fontFamily: 'Inter, sans-serif',
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '40px 20px'
    }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{
          color: '#b4b237',
          fontSize: '32px',
          fontWeight: '600',
          marginBottom: '10px'
        }}>
          Connected Accounts
        </h1>
        <p style={{ color: '#666', fontSize: '16px' }}>
          Manage your connected bank accounts and view balances
        </p>
      </div>

      <div style={{ marginBottom: '30px' }}>
        <button
          onClick={() => open()}
          disabled={!ready || loading}
          style={{
            backgroundColor: '#b4b237',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: ready ? 'pointer' : 'not-allowed',
            opacity: ready ? 1 : 0.6
          }}
        >
          {loading ? 'Loading...' : '+ Connect Another Bank Account'}
        </button>
      </div>

      {plaidItems.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '60px 20px',
          color: '#666'
        }}>
          <h3>No accounts connected yet</h3>
          <p>Click the button above to connect your first bank account</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {plaidItems.map((item) => (
            <div
              key={item.id}
              style={{
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                padding: '20px',
                backgroundColor: 'white'
              }}
            >
              <h3 style={{
                color: '#2d3748',
                fontSize: '18px',
                marginBottom: '15px'
              }}>
                {item.institutionName}
              </h3>
              
              <div style={{ display: 'grid', gap: '10px' }}>
                {item.accounts.map((account) => (
                  <div
                    key={account.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px',
                      backgroundColor: '#f7fafc',
                      borderRadius: '4px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '600', color: '#2d3748' }}>
                        {account.name}
                      </div>
                      <div style={{ fontSize: '14px', color: '#718096' }}>
                        {account.type} • {account.subtype}
                      </div>
                    </div>
                    <div style={{
                      fontWeight: '600',
                      color: '#2d3748',
                      fontSize: '16px'
                    }}>
                      ${account.balance.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
