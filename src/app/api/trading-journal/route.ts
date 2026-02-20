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

    const entries = await prisma.trade_journal_entries.findMany({
      where: { userId: user.id },
      orderBy: { entryDate: 'desc' }
    });

    return NextResponse.json({ entries });
  } catch (error) {
    console.error('Trading journal GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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
    const { tradeNum, entryType, thesis, setup, emotion, mistakes, lessons, rating, tags } = body;

    if (!tradeNum) {
      return NextResponse.json({ error: 'tradeNum is required' }, { status: 400 });
    }

    // Upsert - update if exists, create if not
    const existing = await prisma.trade_journal_entries.findFirst({
      where: { userId: user.id, tradeNum }
    });

    let entry;
    if (existing) {
      entry = await prisma.trade_journal_entries.update({
        where: { id: existing.id },
        data: {
          entryType: entryType || existing.entryType,
          thesis: thesis ?? existing.thesis,
          setup: setup ?? existing.setup,
          emotion: emotion ?? existing.emotion,
          mistakes: mistakes ?? existing.mistakes,
          lessons: lessons ?? existing.lessons,
          rating: rating ?? existing.rating,
          tags: tags ?? existing.tags,
          updatedAt: new Date()
        }
      });
    } else {
      entry = await prisma.trade_journal_entries.create({
        data: {
          userId: user.id,
          tradeNum,
          entryType: entryType || 'post-trade',
          thesis: thesis || null,
          setup: setup || null,
          emotion: emotion || 'neutral',
          mistakes: mistakes || null,
          lessons: lessons || null,
          rating: rating || null,
          tags: tags || []
        }
      });
    }

    return NextResponse.json({ entry });
  } catch (error) {
    console.error('Trading journal POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    await prisma.trade_journal_entries.deleteMany({
      where: { id, userId: user.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Trading journal DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
