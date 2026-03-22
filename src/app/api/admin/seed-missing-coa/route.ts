import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

// Accounts that should exist in the trading entity COA
// From prisma/seed-trading-coa.ts
const REQUIRED_TRADING_ACCOUNTS = [
  { code: '1010', name: 'Trading Cash Account', account_type: 'asset', balance_type: 'D' },
  { code: '1100', name: 'Stock Positions - Long', account_type: 'asset', balance_type: 'D' },
  { code: '1200', name: 'Options Positions - Long Calls', account_type: 'asset', balance_type: 'D' },
  { code: '1210', name: 'Options Positions - Long Puts', account_type: 'asset', balance_type: 'D' },
  { code: '2100', name: 'Options Positions - Short Calls', account_type: 'liability', balance_type: 'C' },
  { code: '2110', name: 'Options Positions - Short Puts', account_type: 'liability', balance_type: 'C' },
  { code: '4100', name: 'Options Income - Credit Spreads', account_type: 'revenue', balance_type: 'C' },
  { code: '4300', name: 'Dividend Income - Trading', account_type: 'revenue', balance_type: 'C' },
  { code: '5100', name: 'Options Losses - Debit Spreads', account_type: 'expense', balance_type: 'D' },
];

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

    // Find the trading entity
    const tradingEntity = await prisma.entities.findFirst({
      where: { userId: user.id, entity_type: 'trading' },
    });
    if (!tradingEntity) {
      return NextResponse.json({ error: 'No trading entity found for user' }, { status: 404 });
    }

    const created: string[] = [];
    const alreadyExisted: string[] = [];

    for (const acct of REQUIRED_TRADING_ACCOUNTS) {
      const existing = await prisma.chart_of_accounts.findFirst({
        where: {
          userId: user.id,
          entity_id: tradingEntity.id,
          code: acct.code,
        },
      });

      if (existing) {
        alreadyExisted.push(acct.code);
      } else {
        await prisma.chart_of_accounts.create({
          data: {
            id: randomUUID(),
            userId: user.id,
            entity_id: tradingEntity.id,
            code: acct.code,
            name: acct.name,
            account_type: acct.account_type,
            balance_type: acct.balance_type,
            entity_type: 'trading',
          },
        });
        created.push(acct.code);
      }
    }

    return NextResponse.json({
      success: true,
      entity: tradingEntity.name,
      created,
      already_existed: alreadyExisted,
    });
  } catch (error) {
    console.error('Seed missing COA error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to seed COA',
    }, { status: 500 });
  }
}
