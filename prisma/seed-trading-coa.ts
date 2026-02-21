import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TRADING_ACCOUNTS = [
  { code: 'T-1010', name: 'Trading Cash Account', account_type: 'asset', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-1020', name: 'Margin Account Cash', account_type: 'asset', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-1100', name: 'Stock Positions - Long', account_type: 'asset', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-1200', name: 'Options Positions - Long Calls', account_type: 'asset', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-1210', name: 'Options Positions - Long Puts', account_type: 'asset', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-1220', name: 'Options Positions - Call Spreads', account_type: 'asset', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-1230', name: 'Options Positions - Put Spreads', account_type: 'asset', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-1240', name: 'Options Positions - Iron Condors', account_type: 'asset', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-1250', name: 'Options Positions - Straddles/Strangles', account_type: 'asset', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-1300', name: 'Cryptocurrency Holdings', account_type: 'asset', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-1400', name: 'Unrealized Gains (Mark-to-Market)', account_type: 'asset', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-1500', name: 'Deferred Loss - Wash Sale', account_type: 'asset', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-2010', name: 'Margin Loan Payable', account_type: 'liability', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-2100', name: 'Options Positions - Short Calls', account_type: 'liability', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-2110', name: 'Options Positions - Short Puts', account_type: 'liability', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-2200', name: 'Stock Positions - Short', account_type: 'liability', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-2300', name: 'Unrealized Losses (Mark-to-Market)', account_type: 'liability', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-3010', name: 'Trading Capital', account_type: 'equity', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-3100', name: 'Retained Earnings - Trading', account_type: 'equity', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-3200', name: 'Capital Contributions - Trading', account_type: 'equity', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-3300', name: 'Capital Withdrawals - Trading', account_type: 'equity', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-4010', name: 'Stock Trading Gains - Short Term', account_type: 'revenue', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-4020', name: 'Stock Trading Gains - Long Term', account_type: 'revenue', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-4100', name: 'Options Income - Credit Spreads', account_type: 'revenue', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-4110', name: 'Options Income - Iron Condors', account_type: 'revenue', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-4120', name: 'Options Income - Covered Calls', account_type: 'revenue', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-4130', name: 'Options Income - Cash Secured Puts', account_type: 'revenue', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-4140', name: 'Options Income - Other Strategies', account_type: 'revenue', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-4200', name: 'Cryptocurrency Gains', account_type: 'revenue', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-4300', name: 'Dividend Income - Trading', account_type: 'revenue', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-4400', name: 'Interest Income - Trading', account_type: 'revenue', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-4500', name: 'Mark-to-Market Adjustment - Gains', account_type: 'revenue', balance_type: 'C', entity_type: 'trading' },
  { code: 'T-5010', name: 'Stock Trading Losses - Short Term', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-5020', name: 'Stock Trading Losses - Long Term', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-5100', name: 'Options Losses - Debit Spreads', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-5110', name: 'Options Losses - Credit Spreads', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-5120', name: 'Options Losses - Iron Condors', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-5130', name: 'Options Losses - Straddles/Strangles', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-5140', name: 'Options Losses - Other Strategies', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-5200', name: 'Cryptocurrency Losses', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-5300', name: 'Mark-to-Market Adjustment - Losses', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-6010', name: 'Brokerage Commissions', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-6020', name: 'Options Contract Fees', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-6030', name: 'Exchange Fees', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-6040', name: 'Regulatory Fees (SEC, FINRA)', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-6050', name: 'Margin Interest Expense', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-6100', name: 'Market Data Subscriptions', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-6110', name: 'Trading Software & Tools', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-6120', name: 'Charting & Analysis Software', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-6200', name: 'Trading Education & Courses', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-6300', name: 'Professional Fees - Trading CPA', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-6400', name: 'Computer & Equipment - Trading', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
  { code: 'T-6500', name: 'Home Office - Trading Allocation', account_type: 'expense', balance_type: 'D', entity_type: 'trading' },
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

  let created = 0;
  let skipped = 0;

  for (const account of TRADING_ACCOUNTS) {
    const existing = await prisma.chart_of_accounts.findUnique({
      where: { code: account.code }
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

  console.log(`Seeded ${created} new, ${skipped} existing Trading (T-) Chart of Accounts for ${email}`);
}

seedTradingCOA()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
