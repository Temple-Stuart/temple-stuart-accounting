import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export const maxDuration = 300; // 5 minutes for Pro plan

export async function POST() {
  try {
    const userEmail = await getVerifiedEmail();

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
    let totalSecurities = 0;
    let skippedTransactions = 0;
    let skippedInvestmentTransactions = 0;

    for (const item of plaidItems) {
      console.log(`Syncing ${item.institutionName || 'Bank'}...`);

      // Sync regular transactions
      try {
        // Batch lookup: fetch all existing transactions for this item's accounts
        const accountIds = item.accounts.map(acc => acc.id);
        const existingTxns = await prisma.transactions.findMany({
          where: { accountId: { in: accountIds } },
          select: {
            transactionId: true,
            personal_finance_category: true,
            amount: true,
            name: true,
            date: true
          }
        });
        const existingMap = new Map(
          existingTxns.map(t => [t.transactionId, t])
        );

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

          // Update balances (first iteration only)
          if (offset === 0 && response.data.accounts) {
            for (const plaidAccount of response.data.accounts) {
              const dbAccount = item.accounts.find(acc => acc.accountId === plaidAccount.account_id);
              if (dbAccount) {
                await prisma.accounts.update({
                  where: { id: dbAccount.id },
                  data: {
                    currentBalance: plaidAccount.balances.current || 0,
                    availableBalance: plaidAccount.balances.available || 0
                  }
                });
              }
            }
          }

          for (const txn of response.data.transactions) {
            const account = item.accounts.find(acc => acc.accountId === txn.account_id);
            if (!account) continue;

            const existing = existingMap.get(txn.transaction_id);

            if (existing && existing.personal_finance_category !== null) {
              // Already has complete data — skip expensive update
              skippedTransactions++;
              totalTransactions++;
              continue;
            }

            const txnData = {
              amount: txn.amount,
              date: new Date(txn.date),
              name: txn.name,
              merchantName: txn.merchant_name,
              category: txn.category?.join(', ') || null,
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
              website: (txn as any).website,
              updatedAt: new Date()
            };

            await prisma.transactions.upsert({
              where: { transactionId: txn.transaction_id },
              create: {
                id: `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                transactionId: txn.transaction_id,
                accountId: account.id,
                ...txnData
              },
              update: txnData
            });
            totalTransactions++;

            // If this is a posted transaction, delete any matching pending duplicates
            if (!txn.pending) {
              const twoDaysAgo = new Date(txn.date);
              twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
              const twoDaysAfter = new Date(txn.date);
              twoDaysAfter.setDate(twoDaysAfter.getDate() + 2);

              await prisma.transactions.deleteMany({
                where: {
                  accountId: account.id,
                  amount: txn.amount,
                  pending: true,
                  date: { gte: twoDaysAgo, lte: twoDaysAfter },
                  transactionId: { not: txn.transaction_id }
                }
              });
            }
          }

          offset += response.data.transactions.length;
          hasMore = response.data.total_transactions > offset;

          if (!hasMore) {
            console.log(`Synced ${response.data.total_transactions} transactions for ${item.institutionName} (${skippedTransactions} skipped — already complete)`);
          }
        }
      } catch (error) {
        console.error('Error syncing transactions:', error);
      }

      // Sync investment transactions + securities
      try {
        // Batch lookup: fetch all existing investment transaction IDs for this item's accounts
        const accountIds = item.accounts.map(acc => acc.id);
        const existingInvTxns = await prisma.investment_transactions.findMany({
          where: { accountId: { in: accountIds } },
          select: { investment_transaction_id: true }
        });
        const existingInvSet = new Set(
          existingInvTxns.map(t => t.investment_transaction_id)
        );

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

          // STORE SECURITIES DATA (includes option contract details)
          for (const security of investResponse.data.securities) {
            const optionContract = (security as any).option_contract;

            await prisma.securities.upsert({
              where: { securityId: security.security_id },
              create: {
                securityId: security.security_id,
                isin: security.isin,
                cusip: security.cusip,
                sedol: security.sedol,
                ticker_symbol: security.ticker_symbol,
                name: security.name,
                type: security.type,
                close_price: security.close_price,
                close_price_as_of: security.close_price_as_of ? new Date(security.close_price_as_of) : null,
                option_contract_type: optionContract?.contract_type || null,
                option_strike_price: optionContract?.strike_price || null,
                option_expiration_date: optionContract?.expiration_date ? new Date(optionContract.expiration_date) : null,
                option_underlying_ticker: optionContract?.underlying_security_ticker || null,
                id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                updatedAt: new Date()
              },
              update: {
                close_price: security.close_price,
                close_price_as_of: security.close_price_as_of ? new Date(security.close_price_as_of) : null,
                option_contract_type: optionContract?.contract_type || null,
                option_strike_price: optionContract?.strike_price || null,
                option_expiration_date: optionContract?.expiration_date ? new Date(optionContract.expiration_date) : null,
                option_underlying_ticker: optionContract?.underlying_security_ticker || null
              }
            });
            totalSecurities++;
          }

          // STORE INVESTMENT TRANSACTIONS
          for (const txn of investResponse.data.investment_transactions) {
            const account = item.accounts.find(acc => acc.accountId === txn.account_id);
            if (!account) continue;

            if (existingInvSet.has(txn.investment_transaction_id)) {
              // Already exists — the original update clause was empty anyway, skip
              skippedInvestmentTransactions++;
              totalInvestmentTransactions++;
              continue;
            }

            await prisma.investment_transactions.create({
              data: {
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
                unofficial_currency_code: txn.unofficial_currency_code,
                updatedAt: new Date()
              }
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
        investmentTransactions: totalInvestmentTransactions,
        securities: totalSecurities
      },
      skipped: {
        transactions: skippedTransactions,
        investmentTransactions: skippedInvestmentTransactions
      }
    });
  } catch (error) {
    console.error('Complete sync error:', error);
    return NextResponse.json({ error: 'Failed to sync' }, { status: 500 });
  }
}
