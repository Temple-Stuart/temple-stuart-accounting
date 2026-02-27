import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { ensureBookkeepingInitialized } from '@/lib/ensure-bookkeeping';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Case-insensitive user lookup
    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await ensureBookkeepingInitialized(user);

    // Get transactions for accounts owned by this user
    const transactions = await prisma.transactions.findMany({
      where: {
        accounts: {
          userId: user.id
        }
      },
      include: {
        accounts: {
          select: {
            name: true,
            type: true,
            entityType: true,
            plaid_items: {
              select: {
                institutionName: true
              }
            }
          }
        }
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Fetch JE proof for committed spending transactions
    const committedTxnIds = transactions
      .filter((t: any) => t.accountCode && t.transactionId)
      .map((t: any) => t.transactionId);

    let jeProofMap = new Map<string, any>();

    if (committedTxnIds.length > 0) {
      const journalEntries = await prisma.journal_entries.findMany({
        where: {
          source_type: 'plaid_txn',
          source_id: { in: committedTxnIds },
          is_reversal: false,
          reversed_by_entry_id: null,
        },
        include: {
          entity: { select: { name: true } },
          ledger_entries: {
            include: {
              account: { select: { code: true, name: true } }
            }
          }
        }
      });

      for (const je of journalEntries) {
        if (!je.source_id) continue;
        jeProofMap.set(je.source_id, {
          jeId: je.id,
          createdBy: je.created_by,
          createdAt: je.created_at,
          requestId: je.request_id,
          status: je.status,
          entityName: je.entity?.name || null,
          ledgerEntries: je.ledger_entries.map((le: any) => ({
            entryType: le.entry_type,
            amount: le.amount.toString(),
            accountCode: le.account.code,
            accountName: le.account.name,
          })),
        });
      }
    }

    const transformedTransactions = transactions.map(txn => ({
      id: txn.id,
      transactionId: txn.transactionId,
      date: txn.date,
      name: txn.name,
      merchantName: txn.merchantName,
      amount: txn.amount,
      category: txn.category,
      pending: txn.pending,
      authorized_date: txn.authorized_date,
      payment_channel: txn.payment_channel,
      personal_finance_category: txn.personal_finance_category,
      personal_finance_category_icon_url: txn.personal_finance_category_icon_url,
      transaction_code: txn.transaction_code,
      transaction_type: txn.transaction_type,
      logo_url: txn.logo_url,
      website: txn.website,
      counterparties: txn.counterparties,
      location: txn.location,
      accountId: txn.accountId,
      accountName: txn.accounts?.name,
      accountType: txn.accounts?.type,
      entityType: txn.accounts?.entityType,
      institutionName: txn.accounts?.plaid_items?.institutionName,
      accountCode: txn.accountCode,
      subAccount: txn.subAccount,
      entity_id: txn.entity_id || null,
      predicted_coa_code: txn.predicted_coa_code,
      prediction_confidence: txn.prediction_confidence ? Number(txn.prediction_confidence) : null,
      review_status: txn.review_status,
      manually_overridden: txn.manually_overridden,
      createdAt: txn.createdAt,
      updatedAt: txn.updatedAt,
      journalProof: txn.transactionId ? (jeProofMap.get(txn.transactionId) || null) : null,
    }));

    return NextResponse.json({ transactions: transformedTransactions });
  } catch (error) {
    console.error('Transactions error:', error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}
