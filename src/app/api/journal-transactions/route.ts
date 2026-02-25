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
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const journalEntries = await prisma.journal_entries.findMany({
      where: { userId: user.id },
      include: {
        ledger_entries: {
          include: {
            account: {
              select: { code: true, name: true, account_type: true }
            }
          }
        }
      },
      orderBy: [
        { date: 'desc' },
        { created_at: 'desc' }
      ]
    });

    const reversalCount = journalEntries.filter(t => t.is_reversal).length;

    const entries = journalEntries.map(t => ({
      id: t.id,
      date: t.date,
      description: t.description,
      source_type: t.source_type,
      source_id: t.source_id,
      status: t.status,
      is_reversal: t.is_reversal,
      reverses_entry_id: t.reverses_entry_id,
      reversed_by_entry_id: t.reversed_by_entry_id,
      metadata: t.metadata,
      created_at: t.created_at,
      ledger_entries: t.ledger_entries.map(entry => ({
        id: entry.id,
        account_id: entry.account_id,
        amount: Number(entry.amount),
        entry_type: entry.entry_type,
        account: entry.account
      }))
    }));

    return NextResponse.json({
      entries,
      totalCount: entries.length,
      reversalCount
    });
  } catch (error) {
    console.error('Journal entries fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch journal entries' }, { status: 500 });
  }
}
