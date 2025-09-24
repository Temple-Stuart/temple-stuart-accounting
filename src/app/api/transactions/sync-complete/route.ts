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
      console.log(`Syncing item ${item.id}...`);
      
      // Sync regular transactions with ALL fields
      try {
        const response = await plaidClient.transactionsGet({
          access_token: item.accessToken,
          start_date: '2023-01-01',
          end_date: new Date().toISOString().split('T')[0],
          options: {
            count: 500,
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
              
              // ALL new fields
              authorized_date: txn.authorized_date ? new Date(txn.authorized_date) : null,
              authorized_datetime: txn.authorized_datetime ? new Date(txn.authorized_datetime) : null,
              counterparties: txn.counterparties || null,
              location: txn.location || null,
              payment_channel: txn.payment_channel,
              payment_meta: txn.payment_meta || null,
              personal_finance_category: txn.personal_finance_category || null,
              personal_finance_category_icon_url: txn.personal_finance_category_icon_url,
              transaction_code: txn.transaction_code,
              transaction_type: txn.transaction_type,
              logo_url: txn.logo_url,
              website: txn.website
            },
            update: {
              amount: txn.amount,
              date: new Date(txn.date),
              name: txn.name,
              merchantName: txn.merchant_name,
              pending: txn.pending || false,
              
              // Update all fields
              authorized_date: txn.authorized_date ? new Date(txn.authorized_date) : null,
              authorized_datetime: txn.authorized_datetime ? new Date(txn.authorized_datetime) : null,
              counterparties: txn.counterparties || null,
              location: txn.location || null,
              payment_channel: txn.payment_channel,
              payment_meta: txn.payment_meta || null,
              personal_finance_category: txn.personal_finance_category || null,
              personal_finance_category_icon_url: txn.personal_finance_category_icon_url,
              transaction_code: txn.transaction_code,
              transaction_type: txn.transaction_type,
              logo_url: txn.logo_url,
              website: txn.website
            }
          });
          totalTransactions++;
        }
      } catch (error) {
        console.error('Error syncing transactions:', error);
      }

      // Sync investment transactions
      try {
        const investResponse = await plaidClient.investmentsTransactionsGet({
          access_token: item.accessToken,
          start_date: '2023-01-01',
          end_date: new Date().toISOString().split('T')[0]
        });

        for (const txn of investResponse.data.investment_transactions) {
          const account = item.accounts.find(acc => acc.accountId === txn.account_id);
          if (!account) continue;

          await prisma.investment_transactions.upsert({
            where: { investment_transaction_id: txn.investment_transaction_id },
            create: {
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
            update: {
              amount: txn.amount,
              date: new Date(txn.date),
              fees: txn.fees,
              name: txn.name,
              price: txn.price,
              quantity: txn.quantity
            }
          });
          totalInvestmentTransactions++;
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
