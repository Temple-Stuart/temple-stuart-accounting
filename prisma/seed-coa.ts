import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedChartOfAccounts() {
  const accounts = [
    // Personal Assets (P-prefix)
    { code: 'P-1010', name: 'Personal Checking', accountType: 'asset', balanceType: 'D', entityType: 'personal' },
    { code: 'P-1020', name: 'Personal Savings', accountType: 'asset', balanceType: 'D', entityType: 'personal' },
    { code: 'P-1200', name: 'Brokerage Cash Account', accountType: 'asset', balanceType: 'D', entityType: 'personal' },
    { code: 'P-1210', name: 'Options Positions - Open', accountType: 'asset', balanceType: 'D', entityType: 'personal' },
    { code: 'P-1240', name: 'Deferred Loss - Wash Sale', accountType: 'asset', balanceType: 'D', entityType: 'personal' },
    
    // Personal Liabilities
    { code: 'P-2100', name: 'Options Positions - Written', accountType: 'liability', balanceType: 'C', entityType: 'personal' },
    
    // Personal Equity
    { code: 'P-3010', name: 'Personal Net Worth', accountType: 'equity', balanceType: 'C', entityType: 'personal' },
    
    // Personal Income
    { code: 'P-4100', name: 'Options Trading Income', accountType: 'revenue', balanceType: 'C', entityType: 'personal' },
    
    // Personal Expenses
    { code: 'P-5100', name: 'Options Trading Losses', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-5200', name: 'Brokerage Commissions & Fees', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-6100', name: 'Meals Expense', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    
    // Business Assets (B-prefix)
    { code: 'B-1010', name: 'Business Checking', accountType: 'asset', balanceType: 'D', entityType: 'business' },
    { code: 'B-1020', name: 'Business Savings', accountType: 'asset', balanceType: 'D', entityType: 'business' },
    
    // Business Liabilities
    { code: 'B-2020', name: 'Credit Card Payable', accountType: 'liability', balanceType: 'C', entityType: 'business' },
    { code: 'B-2110', name: 'Due to Owner', accountType: 'liability', balanceType: 'C', entityType: 'business' },
    
    // Business Equity
    { code: 'B-3110', name: "Owner's Capital", accountType: 'equity', balanceType: 'C', entityType: 'business' },
    { code: 'B-3120', name: "Owner's Draw", accountType: 'equity', balanceType: 'D', entityType: 'business' },
    { code: 'B-3130', name: 'Retained Earnings', accountType: 'equity', balanceType: 'C', entityType: 'business' },
    
    // Business Revenue
    { code: 'B-4010', name: 'Service Revenue', accountType: 'revenue', balanceType: 'C', entityType: 'business' },
    
    // Business Expenses
    { code: 'B-6000', name: 'Rent Expense', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6100', name: 'Office Supplies', accountType: 'expense', balanceType: 'D', entityType: 'business' },
  ];

  for (const account of accounts) {
    await prisma.chartOfAccount.upsert({
      where: { code: account.code },
      update: {},
      create: account,
    });
  }

  console.log(`✅ Seeded ${accounts.length} chart of accounts`);
}

seedChartOfAccounts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
