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
    
    // FIX: Extract accounts from the items array
    const allAccounts = accountsData.items?.flatMap(item => 
      item.accounts?.map(account => ({
        id: account.id,
        name: account.name,
        institution: item.institutionName,
        type: account.type,
        subtype: account.subtype,
        balance: account.balance,
        lastSync: new Date().toISOString(),
        investment_transactions: account.investment_transactions || [],
        transactions: account.transactions || []
      })) || []
    ) || [];
    
    setAccounts(allAccounts);

    // Also get investment transactions for the count
    const investmentsRes = await fetch('/api/investment-transactions');
    if (investmentsRes.ok) {
      const investmentsData = await investmentsRes.json();
      setInvestmentTransactions(investmentsData.investments || []);
    }

    const transactionsRes = await fetch('/api/transactions');
    if (transactionsRes.ok) {
      const transactionsData = await transactionsRes.json();
      setTransactions(transactionsData);
    }
    
  } catch (err) {
    setError('Failed to load accounts');
  } finally {
    setLoading(false);
  }
};
