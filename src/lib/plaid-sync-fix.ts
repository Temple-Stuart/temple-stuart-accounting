// Debug function to check and fix transaction categories
export async function fixTransactionCategories() {
  const { prisma } = await import('./prisma');
  const { plaidClient } = await import('./plaid');
  
  const plaidItems = await prisma.plaid_items.findMany({
    include: { accounts: true }
  });
  
  let fixed = 0;
  
  for (const item of plaidItems) {
    try {
      // Get last 30 days of transactions from Plaid
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const response = await plaidClient.transactionsGet({
        access_token: item.accessToken,
        start_date: startDate,
        end_date: endDate,
        options: { count: 500, offset: 0 }
      });
      
      // Update each transaction with its category
      for (const plaidTxn of response.data.transactions) {
        const account = item.accounts.find(a => a.accountId === plaidTxn.account_id);
        if (!account) continue;
        
        await prisma.transactions.updateMany({
          where: { transactionId: plaidTxn.transaction_id },
          data: { 
            category: plaidTxn.category || [],
            merchantName: plaidTxn.merchant_name
          }
        });
        fixed++;
      }
    } catch (error) {
      console.error(`Failed to fix categories for ${item.institutionName}:`, error);
    }
  }
  
  return fixed;
}
