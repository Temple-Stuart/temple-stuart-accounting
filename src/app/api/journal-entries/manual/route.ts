import { NextResponse } from 'next/server';
import { journalEntryService } from '@/lib/journal-entry-service';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { date, description, lines } = await request.json();

    if (!date || !description || !lines || lines.length < 2) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const totalDebits = lines.filter((l: any) => l.entryType === 'D').reduce((sum: number, l: any) => sum + l.amount, 0);
    const totalCredits = lines.filter((l: any) => l.entryType === 'C').reduce((sum: number, l: any) => sum + l.amount, 0);

    if (Math.abs(totalDebits - totalCredits) > 1) {
      return NextResponse.json({ error: 'Debits must equal credits' }, { status: 400 });
    }

    await journalEntryService.createJournalEntry({
      date: new Date(date),
      description,
      lines: lines.map((l: any) => ({
        accountCode: l.accountCode,
        entryType: l.entryType,
        amount: l.amount
      }))
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Manual journal entry error:', error);
    return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 500 });
  }
}
