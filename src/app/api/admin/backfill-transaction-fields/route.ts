import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { getVerifiedEmail } from '@/lib/cookie-auth';

/**
 * POST /api/admin/backfill-transaction-fields
 *
 * Admin-only endpoint that re-fetches all Plaid transactions and backfills
 * the 12 rich fields that older sync pipelines left null:
 *   authorized_date, authorized_datetime, counterparties, location,
 *   payment_channel, payment_meta, personal_finance_category,
 *   personal_finance_category_icon_url, transaction_code,
 *   transaction_type, logo_url, website
 *
 * Also standardizes category format to join(', ') for any records
 * that used the old first-element-only format.
 */
export async function POST() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId: user.id },
      include: { accounts: true }
    });

    if (plaidItems.length === 0) {
      return NextResponse.json({ error: 'No connected accounts' }, { status: 400 });
    }

    let totalUpdated = 0;
    let totalFieldsBackfilled = 0;

    for (const item of plaidItems) {
      try {
        let hasMore = true;
        let offset = 0;

        while (hasMore) {
          const response = await plaidClient.transactionsGet({
            access_token: item.accessToken,
            start_date: '2024-01-01',
            end_date: new Date().toISOString().split('T')[0],
            options: {
              offset,
              count: 100,
              include_personal_finance_category: true
            }
          });

          for (const txn of response.data.transactions) {
            const account = item.accounts.find(acc => acc.accountId === txn.account_id);
            if (!account) continue;

            // Find existing record
            const existing = await prisma.transactions.findUnique({
              where: { transactionId: txn.transaction_id }
            });
            if (!existing) continue;

            // Build update with all 18 fields
            const updateData: Record<string, unknown> = {
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

            // Count how many fields we're backfilling (were null, now have values)
            let fieldsFixed = 0;
            if (!existing.authorized_date && updateData.authorized_date) fieldsFixed++;
            if (!existing.authorized_datetime && updateData.authorized_datetime) fieldsFixed++;
            if (!existing.counterparties && updateData.counterparties) fieldsFixed++;
            if (!existing.location && updateData.location) fieldsFixed++;
            if (!existing.payment_channel && updateData.payment_channel) fieldsFixed++;
            if (!existing.payment_meta && updateData.payment_meta) fieldsFixed++;
            if (!existing.personal_finance_category && updateData.personal_finance_category) fieldsFixed++;
            if (!existing.personal_finance_category_icon_url && updateData.personal_finance_category_icon_url) fieldsFixed++;
            if (!existing.transaction_code && updateData.transaction_code) fieldsFixed++;
            if (!existing.transaction_type && updateData.transaction_type) fieldsFixed++;
            if (!existing.logo_url && updateData.logo_url) fieldsFixed++;
            if (!existing.website && updateData.website) fieldsFixed++;

            // Also count category format fix (first-element vs joined)
            if (existing.category && updateData.category &&
                existing.category !== updateData.category) {
              fieldsFixed++;
            }

            await prisma.transactions.update({
              where: { transactionId: txn.transaction_id },
              data: updateData
            });

            totalUpdated++;
            totalFieldsBackfilled += fieldsFixed;
          }

          offset += response.data.transactions.length;
          hasMore = response.data.total_transactions > offset;
        }
      } catch (error) {
        console.error(`Error backfilling item ${item.id}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      updated: totalUpdated,
      fieldsBackfilled: totalFieldsBackfilled
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return NextResponse.json({ error: 'Failed to backfill' }, { status: 500 });
  }
}
