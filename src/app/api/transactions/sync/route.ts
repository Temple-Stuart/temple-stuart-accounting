import { NextRequest, NextResponse } from 'next/server';
import { plaidClient } from '@/lib/plaid';
import { verifyAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const userId = await verifyAuth(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { months = 24 } = await request.json();

    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId },
      include: { accounts: true }
    });

    if (!plaidItems.length) {
      return NextResponse.json({ 
        error: 'No connected accounts',
        synced: 0 
      });
    }

    const results = [];
    let totalSynced = 0;

    // Calculate date range based on months parameter
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - months);

    console.log(`Syncing ${months} months of transactions from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    for (const item of plaidItems) {
      try {
        console.log(`Fetching transactions for ${item.institutionName}...`);
        
        let hasMore = true;
        let offset = 0;
        const batchSize = 500;
        let itemTransactions = 0;
        
        while (hasMore) {
          const response = await plaidClient.transactionsGet({
            access_token: item.accessToken,
            start_date: startDate.toISOString().split('T')[0],
            end_date: endDate.toISOString().split('T')[0],
            options: {
              count: batchSize,
              offset: offset,
              include_personal_finance_category: true,
            }
          });
          
          // Store each transaction
          for (const txn of response.data.transactions) {
            const account = item.accounts.find(a => a.accountId === txn.account_id);
            if (!account) continue;

            await prisma.transactions.upsert({
              where: { transactionId: txn.transaction_id },
              update: {
                amount: txn.amount,
                name: txn.name,
                merchantName: txn.merchant_name,
                pending: txn.pending,
                updatedAt: new Date(),
              },
              create: {
                id: crypto.randomUUID(),
                accountId: account.id,
                transactionId: txn.transaction_id,
                amount: txn.amount,
                date: new Date(txn.date),
                name: txn.name,
                merchantName: txn.merchant_name,
                category: txn.category || [],
                pending: txn.pending,
                updatedAt: new Date(),
              }
            });
            itemTransactions++;
          }
          
          const totalTransactions = response.data.total_transactions;
          offset += response.data.transactions.length;
          hasMore = offset < totalTransactions;
          
          console.log(`Progress: ${offset}/${totalTransactions} for ${item.institutionName}`);
          
          if (offset > 10000) break; // Safety limit
        }
        
        totalSynced += itemTransactions;
        
        // Update last synced time
        await prisma.plaid_items.update({
          where: { id: item.id },
          data: { 
            last_synced_at: new Date(),
            updatedAt: new Date()
          }
        });
        
        results.push({
          institution: item.institutionName,
          synced: itemTransactions,
          status: 'success'
        });
        
      } catch (error: any) {
        console.error(`Sync failed for ${item.institutionName}:`, error.message);
        results.push({
          institution: item.institutionName,
          error: error.response?.data?.error_message || error.message,
          status: 'failed'
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalSynced,
      months,
      results,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    });

  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync transactions', details: error.message },
      { status: 500 }
    );
  }
}
