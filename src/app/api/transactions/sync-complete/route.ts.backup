import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId: user.id },
      include: { accounts: true }
    });

    let totalTransactions = 0;
    let totalInvestmentTransactions = 0;

    for (const item of plaidItems) {
      console.log(`Syncing ${item.institutionName || 'Bank'}...`);
      
      // FIRST: Update account balances
      try {
        console.log(`Fetching balances for ${item.institutionName}...`);
        const balanceResponse = await plaidClient.accountsBalanceGet({
          access_token: item.accessToken
        });

        console.log(`Got ${balanceResponse.data.accounts.length} accounts from Plaid`);
        
        for (const plaidAccount of balanceResponse.data.accounts) {
          const dbAccount = item.accounts.find(acc => acc.accountId === plaidAccount.account_id);
          
          if (dbAccount) {
            console.log(`Updating ${plaidAccount.name}: ${plaidAccount.balances.current}`);
            await prisma.accounts.update({
              where: { id: dbAccount.id },
              data: {
                currentBalance: plaidAccount.balances.current || 0,
                availableBalance: plaidAccount.balances.available || 0
              }
            });
            console.log(`✓ Updated balance for ${plaidAccount.name}`);
          } else {
            console.log(`⚠️ No DB account found for Plaid account ${plaidAccount.account_id}`);
          }
        }
      } catch (error) {
        console.error('Error updating balances:', error);
      }
      
      // THEN: Sync transactions (keeping your existing code)
      try {
        let hasMore = true;
        let offset = 0;
        
        while (hasMore) {
          const response = await plaidClient.transactionsGet({
            access_token: item.accessToken,
            start_date: '2024-01-01',
            end_date: new Date().toISOString().split('T')[0],
            options: {
              offset: offset,
              count: 100,
              include_personal_finance_category: true
            }
          });

          for (const txn of response.data.transactions) {
            const account = item.accounts.find(acc => acc.accountId === txn.account_id);
            if (!account) continue;

            await prisma.transactions.upsert({
              where: { transactionId: txn.transaction_id },
              create: {
                id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                transactionId: txn.transaction_id,
                accountId: account.id,
                amount: txn.amount,
                date: new Date(txn.date),
                name: txn.name,
                merchantName: txn.merchant_name,
                category: txn.category?.join(', '),
                pending: txn.pending || false,
                
                authorized_date: txn.authorized_date ? new Date(txn.authorized_date) : null,
                authorized_datetime: txn.authorized_datetime ? new Date(txn.authorized_datetime) : null,
                counterparties: (txn as any).counterparties || null,
                location: (txn as any).location || null,
                payment_channel: txn.payment_channel,
                payment_meta: (txn as any).payment_meta || null,
                personal_finance_category: (txn as any).personal_finance_category || null,
                personal_finance_category_icon_url: (txn as any).personal_finance_category_icon_url,
                transaction_code: txn.transaction_code,
                transaction_type: (txn as any).transaction_type,
                logo_url: (txn as any).logo_url,
                website: (txn as any).website
              },
              update: {
                amount: txn.amount,
                merchantName: txn.merchant_name,
                personal_finance_category: (txn as any).personal_finance_category || null,
                counterparties: (txn as any).counterparties || null,
                location: (txn as any).location || null,
                payment_channel: txn.payment_channel
              }
            });
            totalTransactions++;
          }

          offset += response.data.transactions.length;
          hasMore = response.data.total_transactions > offset;
          
          if (!hasMore) {
            console.log(`Synced ${response.data.total_transactions} transactions for ${item.institutionName}`);
          }
        }
      } catch (error) {
        console.error('Error syncing transactions:', error);
      }

      // Sync investment transactions (keeping existing code)
      try {
        let offset = 0;
        let hasMore = true;
        
        while (hasMore) {
          const investResponse = await plaidClient.investmentsTransactionsGet({
            access_token: item.accessToken,
            start_date: '2024-01-01',
            end_date: new Date().toISOString().split('T')[0],
            options: {
              offset: offset,
              count: 100
            }
          });

          for (const txn of investResponse.data.investment_transactions) {
            const account = item.accounts.find(acc => acc.accountId === txn.account_id);
            if (!account) continue;

            await prisma.investment_transactions.upsert({
              where: { investment_transaction_id: txn.investment_transaction_id },
              create: {
                id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                investment_transaction_id: txn.investment_transaction_id,
                accountId: account.id,
                amount: txn.amount,
                cancel_transaction_id: txn.cancel_transaction_id,
                date: new Date(txn.date),
                fees: txn.fees,
                iso_currency_code: txn.iso_currency_code,
                name: txn.name,
                price: txn.price,
                quantity: txn.quantity,
                security_id: txn.security_id,
                subtype: txn.subtype,
                type: txn.type,
                unofficial_currency_code: txn.unofficial_currency_code
              },
              update: {}
            });
            totalInvestmentTransactions++;
          }

          offset += investResponse.data.investment_transactions.length;
          hasMore = investResponse.data.total_investment_transactions > offset;
        }
      } catch (error) {
        console.error('Error syncing investment transactions:', error);
      }
    }

    return NextResponse.json({
      success: true,
      synced: {
        transactions: totalTransactions,
        investmentTransactions: totalInvestmentTransactions
      }
    });
  } catch (error) {
    console.error('Complete sync error:', error);
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
  }
}
