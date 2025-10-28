import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const journalEntries = await prisma.journalTransaction.findMany({
      include: {
        ledgerEntries: {
          include: {
            account: true
          }
        }
      },
      orderBy: { transactionDate: 'desc' }
    });

    // Convert BigInt to number for JSON serialization
    const entries = journalEntries.map(je => ({
      id: je.id,
      date: je.transactionDate,
      description: je.description || 'No description',
      createdAt: je.created_at,
      ledgerEntries: je.ledgerEntries.map(le => ({
        id: le.id,
        accountCode: le.account.code,
        entryType: le.entryType,
        amount: Number(le.amount),
        chart_of_accounts: {
          code: le.account.code,
          name: le.account.name
        }
      }))
    }));

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Journal entries fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch journal entries' }, { status: 500 });
  }
}
