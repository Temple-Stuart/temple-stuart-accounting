import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const journalEntries = await prisma.journal_transactions.findMany({
      include: {
        ledger_entries: {
          include: {
            chart_of_accounts: true
          }
        }
      },
      orderBy: { transaction_date: 'desc' }
    });

    // Convert BigInt to number for JSON serialization
    const entries = journalEntries.map(je => ({
      id: je.id,
      date: je.transaction_date,
      description: je.description || 'No description',
      createdAt: je.created_at,
      ledger_entries: je.ledger_entries.map(le => ({
        id: le.id,
        accountCode: le.chart_of_accounts.code,
        entryType: le.entry_type,
        amount: Number(le.amount),
        chart_of_accounts: {
          code: le.chart_of_accounts.code,
          name: le.chart_of_accounts.name
        }
      }))
    }));

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Journal entries fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch journal entries' }, { status: 500 });
  }
}
