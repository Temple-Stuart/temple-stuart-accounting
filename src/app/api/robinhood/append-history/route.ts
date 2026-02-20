import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'fs/promises';
import path from 'path';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function POST(request: Request) {
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

    const { historyText } = await request.json();

    if (!historyText?.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    const filePath = path.join(process.cwd(), 'robinhood_history.txt');

    let existingContent = '';
    try {
      existingContent = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      console.log('Creating new robinhood_history.txt file');
    }

    const newContent = `${historyText.trim()}\n\n${existingContent}`;
    await fs.writeFile(filePath, newContent, 'utf-8');

    const newTradeCount = (historyText.match(/Download Trade Confirmation/g) || []).length;

    return NextResponse.json({
      success: true,
      message: `Added ${newTradeCount} trades to history file`,
      tradesAdded: newTradeCount
    });

  } catch (error) {
    console.error('Error appending history:', error);
    return NextResponse.json({
      error: 'Failed to update history file',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
