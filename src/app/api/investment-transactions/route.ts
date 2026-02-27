import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { 
        email: { equals: userEmail, mode: 'insensitive' } 
      }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const investmentTxns = await prisma.investment_transactions.findMany({
      where: {
        accounts: {
          userId: user.id
        }
      },
      include: {
        security: true
      },
      orderBy: {
        date: 'desc'
      }
    });

    // Fetch JE proof for committed transactions
    const committedIds = investmentTxns
      .filter((t: any) => t.accountCode)
      .map((t: any) => t.id);

    let jeProofMap = new Map<string, any>();

    if (committedIds.length > 0) {
      const journalEntries = await prisma.journal_entries.findMany({
        where: {
          source_type: 'investment_txn',
          source_id: { in: committedIds },
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

    const enrichedTxns = investmentTxns.map((t: any) => ({
      ...t,
      journalProof: jeProofMap.get(t.id) || null,
    }));

    return NextResponse.json(enrichedTxns);
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json([]);
  }
}
