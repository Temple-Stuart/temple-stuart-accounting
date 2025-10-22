import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedTradingCOA() {
  const accounts = [
    { code: 'T-1010', name: 'Trading Cash Account', accountType: 'asset', balanceType: 'D', entityType: 'trading' },
    { code: 'T-1020', name: 'Margin Account Cash', accountType: 'asset', balanceType: 'D', entityType: 'trading' },
    { code: 'T-1100', name: 'Stock Positions - Long', accountType: 'asset', balanceType: 'D', entityType: 'trading' },
    { code: 'T-1200', name: 'Options Positions - Long Calls', accountType: 'asset', balanceType: 'D', entityType: 'trading' },
    { code: 'T-1210', name: 'Options Positions - Long Puts', accountType: 'asset', balanceType: 'D', entityType: 'trading' },
    { code: 'T-1220', name: 'Options Positions - Call Spreads', accountType: 'asset', balanceType: 'D', entityType: 'trading' },
    { code: 'T-1230', name: 'Options Positions - Put Spreads', accountType: 'asset', balanceType: 'D', entityType: 'trading' },
    { code: 'T-1240', name: 'Options Positions - Iron Condors', accountType: 'asset', balanceType: 'D', entityType: 'trading' },
    { code: 'T-1250', name: 'Options Positions - Straddles/Strangles', accountType: 'asset', balanceType: 'D', entityType: 'trading' },
    { code: 'T-1300', name: 'Cryptocurrency Holdings', accountType: 'asset', balanceType: 'D', entityType: 'trading' },
    { code: 'T-1400', name: 'Unrealized Gains (Mark-to-Market)', accountType: 'asset', balanceType: 'D', entityType: 'trading' },
    { code: 'T-1500', name: 'Deferred Loss - Wash Sale', accountType: 'asset', balanceType: 'D', entityType: 'trading' },
    { code: 'T-2010', name: 'Margin Loan Payable', accountType: 'liability', balanceType: 'C', entityType: 'trading' },
    { code: 'T-2100', name: 'Options Positions - Short Calls', accountType: 'liability', balanceType: 'C', entityType: 'trading' },
    { code: 'T-2110', name: 'Options Positions - Short Puts', accountType: 'liability', balanceType: 'C', entityType: 'trading' },
    { code: 'T-2200', name: 'Stock Positions - Short', accountType: 'liability', balanceType: 'C', entityType: 'trading' },
    { code: 'T-2300', name: 'Unrealized Losses (Mark-to-Market)', accountType: 'liability', balanceType: 'C', entityType: 'trading' },
    { code: 'T-3010', name: 'Trading Capital', accountType: 'equity', balanceType: 'C', entityType: 'trading' },
    { code: 'T-3100', name: 'Retained Earnings - Trading', accountType: 'equity', balanceType: 'C', entityType: 'trading' },
    { code: 'T-3200', name: 'Capital Contributions - Trading', accountType: 'equity', balanceType: 'C', entityType: 'trading' },
    { code: 'T-3300', name: 'Capital Withdrawals - Trading', accountType: 'equity', balanceType: 'D', entityType: 'trading' },
    { code: 'T-4010', name: 'Stock Trading Gains - Short Term', accountType: 'revenue', balanceType: 'C', entityType: 'trading' },
    { code: 'T-4020', name: 'Stock Trading Gains - Long Term', accountType: 'revenue', balanceType: 'C', entityType: 'trading' },
    { code: 'T-4100', name: 'Options Income - Credit Spreads', accountType: 'revenue', balanceType: 'C', entityType: 'trading' },
    { code: 'T-4110', name: 'Options Income - Iron Condors', accountType: 'revenue', balanceType: 'C', entityType: 'trading' },
    { code: 'T-4120', name: 'Options Income - Covered Calls', accountType: 'revenue', balanceType: 'C', entityType: 'trading' },
    { code: 'T-4130', name: 'Options Income - Cash Secured Puts', accountType: 'revenue', balanceType: 'C', entityType: 'trading' },
    { code: 'T-4140', name: 'Options Income - Other Strategies', accountType: 'revenue', balanceType: 'C', entityType: 'trading' },
    { code: 'T-4200', name: 'Cryptocurrency Gains', accountType: 'revenue', balanceType: 'C', entityType: 'trading' },
    { code: 'T-4300', name: 'Dividend Income - Trading', accountType: 'revenue', balanceType: 'C', entityType: 'trading' },
    { code: 'T-4400', name: 'Interest Income - Trading', accountType: 'revenue', balanceType: 'C', entityType: 'trading' },
    { code: 'T-4500', name: 'Mark-to-Market Adjustment - Gains', accountType: 'revenue', balanceType: 'C', entityType: 'trading' },
    { code: 'T-5010', name: 'Stock Trading Losses - Short Term', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-5020', name: 'Stock Trading Losses - Long Term', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-5100', name: 'Options Losses - Debit Spreads', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-5110', name: 'Options Losses - Credit Spreads', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-5120', name: 'Options Losses - Iron Condors', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-5130', name: 'Options Losses - Straddles/Strangles', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-5140', name: 'Options Losses - Other Strategies', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-5200', name: 'Cryptocurrency Losses', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-5300', name: 'Mark-to-Market Adjustment - Losses', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-6010', name: 'Brokerage Commissions', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-6020', name: 'Options Contract Fees', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-6030', name: 'Exchange Fees', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-6040', name: 'Regulatory Fees (SEC, FINRA)', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-6050', name: 'Margin Interest Expense', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-6100', name: 'Market Data Subscriptions', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-6110', name: 'Trading Software & Tools', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-6120', name: 'Charting & Analysis Software', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-6200', name: 'Trading Education & Courses', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-6300', name: 'Professional Fees - Trading CPA', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-6400', name: 'Computer & Equipment - Trading', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
    { code: 'T-6500', name: 'Home Office - Trading Allocation', accountType: 'expense', balanceType: 'D', entityType: 'trading' },
  ];

  for (const account of accounts) {
    await prisma.chartOfAccount.upsert({
      where: { code: account.code },
      update: {},
      create: account,
    });
  }

  console.log('Seeded ' + accounts.length + ' Trading (T-) Chart of Accounts');
  console.log('Covers: Stocks, Options (multi-leg), Crypto, Mark-to-Market, TTS compliance');
}

seedTradingCOA()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
