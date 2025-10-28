import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedChartOfAccounts() {
  const accounts = [
    // Personal Assets (P-prefix)
    { id: randomUUID(), code: 'P-1010', name: 'Personal Checking', account_type: 'asset', balance_type: 'D', entity_type: 'personal' },
    { id: randomUUID(), code: 'P-1020', name: 'Personal Savings', account_type: 'asset', balance_type: 'D', entity_type: 'personal' },
    { id: randomUUID(), code: 'P-1200', name: 'Brokerage Cash Account', account_type: 'asset', balance_type: 'D', entity_type: 'personal' },
    { id: randomUUID(), code: 'P-1210', name: 'Options Positions - Open', account_type: 'asset', balance_type: 'D', entity_type: 'personal' },
    { id: randomUUID(), code: 'P-1240', name: 'Deferred Loss - Wash Sale', account_type: 'asset', balance_type: 'D', entity_type: 'personal' },
    
    // Personal Liabilities
    { id: randomUUID(), code: 'P-2100', name: 'Options Positions - Written', account_type: 'liability', balance_type: 'C', entity_type: 'personal' },
    
    // Personal Equity
    { id: randomUUID(), code: 'P-3010', name: 'Personal Net Worth', account_type: 'equity', balance_type: 'C', entity_type: 'personal' },
    
    // Personal Income
    { id: randomUUID(), code: 'P-4100', name: 'Options Trading Income', account_type: 'revenue', balance_type: 'C', entity_type: 'personal' },
    
    // Personal Expenses
    { id: randomUUID(), code: 'P-5100', name: 'Options Trading Losses', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { id: randomUUID(), code: 'P-5200', name: 'Brokerage Commissions & Fees', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { id: randomUUID(), code: 'P-6100', name: 'Meals Expense', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    
    // Business Assets (B-prefix)
    { id: randomUUID(), code: 'B-1010', name: 'Business Checking', account_type: 'asset', balance_type: 'D', entity_type: 'business' },
    { id: randomUUID(), code: 'B-1020', name: 'Business Savings', account_type: 'asset', balance_type: 'D', entity_type: 'business' },
    
    // Business Liabilities
    { id: randomUUID(), code: 'B-2020', name: 'Credit Card Payable', account_type: 'liability', balance_type: 'C', entity_type: 'business' },
    { id: randomUUID(), code: 'B-2110', name: 'Due to Owner', account_type: 'liability', balance_type: 'C', entity_type: 'business' },
    
    // Business Equity
    { id: randomUUID(), code: 'B-3110', name: "Owner's Capital", account_type: 'equity', balance_type: 'C', entity_type: 'business' },
    { id: randomUUID(), code: 'B-3120', name: "Owner's Draw", account_type: 'equity', balance_type: 'D', entity_type: 'business' },
    { id: randomUUID(), code: 'B-3130', name: 'Retained Earnings', account_type: 'equity', balance_type: 'C', entity_type: 'business' },
    
    // Business Revenue
    { id: randomUUID(), code: 'B-4010', name: 'Service Revenue', account_type: 'revenue', balance_type: 'C', entity_type: 'business' },
    
    // Business Expenses
    { id: randomUUID(), code: 'B-6000', name: 'Rent Expense', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { id: randomUUID(), code: 'B-6100', name: 'Office Supplies', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
  ];

  for (const account of accounts) {
    await prisma.chart_of_accounts.upsert({
      where: { id: randomUUID(), code: account.code },
      update: {},
      create: account,
    });
  }

  console.log(`✅ Seeded ${accounts.length} chart of accounts`);
}

seedChartOfAccounts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
