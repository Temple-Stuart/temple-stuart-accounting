'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface Account {
  id: string;
  name: string;
  institution: string;
  type: string;
  subtype: string;
  balance: number;
  lastSync: string;
}

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  accountId: string;
}

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    fetchAccountsAndTransactions();
  }, []);

  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  const fetchAccountsAndTransactions = async () => {
    try {
      const accountsRes = await fetch('/api/accounts');
      if (!accountsRes.ok) {
        if (accountsRes.status === 401) {
          router.push('/login');
          return;
        }
        throw new Error('Failed to fetch accounts');
      }
      const accountsData = await accountsRes.json();
      
      // FIX: Extract accounts from the nested structure
      const allAccounts = accountsData.items?.flatMap(item => 
        item.accounts?.map(account => ({
          id: account.id,
          name: account.name,
          institution: item.institutionName,
          type: account.type,
          subtype: account.subtype,
          balance: account.balance,
          lastSync: new Date().toISOString()
        })) || []
      ) || [];
      
      setAccounts(allAccounts);

      const transactionsRes = await fetch('/api/transactions');
      if (transactionsRes.ok) {
        const transactionsData = await transactionsRes.json();
        setTransactions(transactionsData);
      }
    } catch (err) {
      setError('Failed to load data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your accounts...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <button 
            onClick={() => router.push('/login')}
            className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-900">Your Accounts</h1>
            <button
              onClick={() => {
                document.cookie = 'auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
                router.push('/');
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900"
            >
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Accounts Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {accounts.map((account) => (
            <div key={account.id} className="bg-white rounded-lg shadow p-6">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{account.name}</h3>
                  <p className="text-sm text-gray-500">{account.institution}</p>
                </div>
                <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded">
                  {account.type}
                </span>
              </div>
              <p className="text-2xl font-bold text-gray-900">
                ${account.balance.toLocaleString()}
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Last synced: {new Date(account.lastSync).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>

        {/* Recent Transactions */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent Transactions</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.slice(0, 10).map((transaction) => (
                  <tr key={transaction.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(transaction.date).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {transaction.description}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {transaction.category}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-medium ${
                      transaction.amount > 0 ? 'text-green-600' : 'text-gray-900'
                    }`}>
                      ${Math.abs(transaction.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
