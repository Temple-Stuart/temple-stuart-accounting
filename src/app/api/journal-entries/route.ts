import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const entries = await prisma.journal_entries.findMany({
      where: { userId: user.id },
      include: { lines: true },
      orderBy: { date: 'desc' }
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to fetch journal entries' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json();
    const { date, type, memo, lines, status } = body;

    // Validate debits = credits
    const totalDebits = lines.reduce((sum: number, l: any) => sum + (parseFloat(l.debit) || 0), 0);
    const totalCredits = lines.reduce((sum: number, l: any) => sum + (parseFloat(l.credit) || 0), 0);
    
    if (Math.abs(totalDebits - totalCredits) > 0.01) {
      return NextResponse.json({ error: 'Entry must be balanced (debits must equal credits)' }, { status: 400 });
    }

    // Get next entry number
    const lastEntry = await prisma.journal_entries.findFirst({
      where: { userId: user.id },
      orderBy: { entryNumber: 'desc' }
    });
    const entryNumber = (lastEntry?.entryNumber || 0) + 1;

    const entry = await prisma.journal_entries.create({
      data: {
        userId: user.id,
        entryNumber,
        date: new Date(date),
        type,
        memo,
        status: status || 'draft',
        postedAt: status === 'posted' ? new Date() : null,
        lines: {
          create: lines.map((l: any) => ({
            accountCode: l.accountCode,
            description: l.description || null,
            debit: l.debit ? parseFloat(l.debit) : null,
            credit: l.credit ? parseFloat(l.credit) : null
          }))
        }
      },
      include: { lines: true }
    });

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to create journal entry' }, { status: 500 });
  }
}
