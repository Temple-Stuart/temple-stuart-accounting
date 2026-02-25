import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TRADING_ACCOUNTS = [
  { code: '1010', name: 'Trading Cash Account', account_type: 'asset', balance_type: 'D' },
  { code: '1020', name: 'Margin Account Cash', account_type: 'asset', balance_type: 'D' },
  { code: '1100', name: 'Stock Positions - Long', account_type: 'asset', balance_type: 'D' },
  { code: '1200', name: 'Options Positions - Long Calls', account_type: 'asset', balance_type: 'D' },
  { code: '1210', name: 'Options Positions - Long Puts', account_type: 'asset', balance_type: 'D' },
  { code: '1220', name: 'Options Positions - Call Spreads', account_type: 'asset', balance_type: 'D' },
  { code: '1230', name: 'Options Positions - Put Spreads', account_type: 'asset', balance_type: 'D' },
  { code: '1240', name: 'Options Positions - Iron Condors', account_type: 'asset', balance_type: 'D' },
  { code: '1250', name: 'Options Positions - Straddles/Strangles', account_type: 'asset', balance_type: 'D' },
  { code: '1300', name: 'Cryptocurrency Holdings', account_type: 'asset', balance_type: 'D' },
  { code: '1400', name: 'Unrealized Gains (Mark-to-Market)', account_type: 'asset', balance_type: 'D' },
  { code: '1500', name: 'Deferred Loss - Wash Sale', account_type: 'asset', balance_type: 'D' },
  { code: '2010', name: 'Margin Loan Payable', account_type: 'liability', balance_type: 'C' },
  { code: '2100', name: 'Options Positions - Short Calls', account_type: 'liability', balance_type: 'C' },
  { code: '2110', name: 'Options Positions - Short Puts', account_type: 'liability', balance_type: 'C' },
  { code: '2200', name: 'Stock Positions - Short', account_type: 'liability', balance_type: 'C' },
  { code: '2300', name: 'Unrealized Losses (Mark-to-Market)', account_type: 'liability', balance_type: 'C' },
  { code: '3010', name: 'Trading Capital', account_type: 'equity', balance_type: 'C' },
  { code: '3100', name: 'Retained Earnings - Trading', account_type: 'equity', balance_type: 'C' },
  { code: '3200', name: 'Capital Contributions - Trading', account_type: 'equity', balance_type: 'C' },
  { code: '3300', name: 'Capital Withdrawals - Trading', account_type: 'equity', balance_type: 'D' },
  { code: '4010', name: 'Stock Trading Gains - Short Term', account_type: 'revenue', balance_type: 'C' },
  { code: '4020', name: 'Stock Trading Gains - Long Term', account_type: 'revenue', balance_type: 'C' },
  { code: '4100', name: 'Options Income - Credit Spreads', account_type: 'revenue', balance_type: 'C' },
  { code: '4110', name: 'Options Income - Iron Condors', account_type: 'revenue', balance_type: 'C' },
  { code: '4120', name: 'Options Income - Covered Calls', account_type: 'revenue', balance_type: 'C' },
  { code: '4130', name: 'Options Income - Cash Secured Puts', account_type: 'revenue', balance_type: 'C' },
  { code: '4140', name: 'Options Income - Other Strategies', account_type: 'revenue', balance_type: 'C' },
  { code: '4200', name: 'Cryptocurrency Gains', account_type: 'revenue', balance_type: 'C' },
  { code: '4300', name: 'Dividend Income - Trading', account_type: 'revenue', balance_type: 'C' },
  { code: '4400', name: 'Interest Income - Trading', account_type: 'revenue', balance_type: 'C' },
  { code: '4500', name: 'Mark-to-Market Adjustment - Gains', account_type: 'revenue', balance_type: 'C' },
  { code: '5010', name: 'Stock Trading Losses - Short Term', account_type: 'expense', balance_type: 'D' },
  { code: '5020', name: 'Stock Trading Losses - Long Term', account_type: 'expense', balance_type: 'D' },
  { code: '5100', name: 'Options Losses - Debit Spreads', account_type: 'expense', balance_type: 'D' },
  { code: '5110', name: 'Options Losses - Credit Spreads', account_type: 'expense', balance_type: 'D' },
  { code: '5120', name: 'Options Losses - Iron Condors', account_type: 'expense', balance_type: 'D' },
  { code: '5130', name: 'Options Losses - Straddles/Strangles', account_type: 'expense', balance_type: 'D' },
  { code: '5140', name: 'Options Losses - Other Strategies', account_type: 'expense', balance_type: 'D' },
  { code: '5200', name: 'Cryptocurrency Losses', account_type: 'expense', balance_type: 'D' },
  { code: '5300', name: 'Mark-to-Market Adjustment - Losses', account_type: 'expense', balance_type: 'D' },
  { code: '6010', name: 'Brokerage Commissions', account_type: 'expense', balance_type: 'D' },
  { code: '6020', name: 'Options Contract Fees', account_type: 'expense', balance_type: 'D' },
  { code: '6030', name: 'Exchange Fees', account_type: 'expense', balance_type: 'D' },
  { code: '6040', name: 'Regulatory Fees (SEC, FINRA)', account_type: 'expense', balance_type: 'D' },
  { code: '6050', name: 'Margin Interest Expense', account_type: 'expense', balance_type: 'D' },
  { code: '6100', name: 'Market Data Subscriptions', account_type: 'expense', balance_type: 'D' },
  { code: '6110', name: 'Trading Software & Tools', account_type: 'expense', balance_type: 'D' },
  { code: '6120', name: 'Charting & Analysis Software', account_type: 'expense', balance_type: 'D' },
  { code: '6200', name: 'Trading Education & Courses', account_type: 'expense', balance_type: 'D' },
  { code: '6300', name: 'Professional Fees - Trading CPA', account_type: 'expense', balance_type: 'D' },
  { code: '6400', name: 'Computer & Equipment - Trading', account_type: 'expense', balance_type: 'D' },
  { code: '6500', name: 'Home Office - Trading Allocation', account_type: 'expense', balance_type: 'D' },
];

/**
 * Seed trading COA for a specific user.
 * Usage: npx tsx prisma/seed-trading-coa.ts <user-email>
 */
async function seedTradingCOA() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx tsx prisma/seed-trading-coa.ts <user-email>');
    process.exit(1);
  }

  const user = await prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
  });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  // Find or create trading entity
  let tradingEntity = await prisma.entities.findFirst({
    where: { userId: user.id, entity_type: 'trading' }
  });
  if (!tradingEntity) {
    tradingEntity = await prisma.entities.create({
      data: { id: randomUUID(), userId: user.id, name: 'Trading', entity_type: 'trading' }
    });
  }

  let created = 0;
  let skipped = 0;

  for (const account of TRADING_ACCOUNTS) {
    const existing = await prisma.chart_of_accounts.findFirst({
      where: { userId: user.id, entity_id: tradingEntity.id, code: account.code }
    });

    if (existing) {
      // If account exists but has no userId, assign it
      if (!existing.userId) {
        await prisma.chart_of_accounts.update({
          where: { id: existing.id },
          data: { userId: user.id }
        });
        console.log(`  Assigned userId to existing ${account.code}`);
      }
      skipped++;
    } else {
      await prisma.chart_of_accounts.create({
        data: {
          id: randomUUID(),
          ...account,
          entity_id: tradingEntity.id,
          userId: user.id,
          settled_balance: 0,
          pending_balance: 0,
          version: 0,
          is_archived: false,
        }
      });
      created++;
    }
  }

  console.log(`Seeded ${created} new, ${skipped} existing Trading Chart of Accounts for ${email}`);
}

seedTradingCOA()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
