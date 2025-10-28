import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCompleteCOA() {
  const accounts = [
    // PERSONAL ASSETS (1000-1999)
    { code: 'P-1010', name: 'Personal Checking', account_type: 'asset', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-1020', name: 'Personal Savings', account_type: 'asset', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-1030', name: 'Emergency Fund', account_type: 'asset', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-1100', name: 'Due from Business', account_type: 'asset', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-1200', name: 'Brokerage Cash Account', account_type: 'asset', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-1210', name: 'Options Positions - Open', account_type: 'asset', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-1230', name: 'Unrealized Gains/Losses', account_type: 'asset', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-1240', name: 'Deferred Loss - Wash Sale', account_type: 'asset', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-1250', name: 'Stock Investment', account_type: 'asset', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-1300', name: 'Cryptocurrency', account_type: 'asset', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-1400', name: 'Vehicle', account_type: 'asset', balance_type: 'D', entity_type: 'personal' },
    
    // PERSONAL LIABILITIES (2000-2999) - EXPANDED
    { code: 'P-2010', name: 'Credit Card - Main', account_type: 'liability', balance_type: 'C', entity_type: 'personal' },
    { code: 'P-2011', name: 'Credit Card - Secondary', account_type: 'liability', balance_type: 'C', entity_type: 'personal' },
    { code: 'P-2012', name: 'Credit Card - Business Expenses', account_type: 'liability', balance_type: 'C', entity_type: 'personal' },
    { code: 'P-2100', name: 'Options Positions - Written', account_type: 'liability', balance_type: 'C', entity_type: 'personal' },
    { code: 'P-2200', name: 'Student Loan - Federal', account_type: 'liability', balance_type: 'C', entity_type: 'personal' },
    { code: 'P-2210', name: 'Student Loan - Private', account_type: 'liability', balance_type: 'C', entity_type: 'personal' },
    { code: 'P-2300', name: 'Auto Loan', account_type: 'liability', balance_type: 'C', entity_type: 'personal' },
    { code: 'P-2400', name: 'Personal Loan', account_type: 'liability', balance_type: 'C', entity_type: 'personal' },
    { code: 'P-2500', name: 'Mortgage Payable', account_type: 'liability', balance_type: 'C', entity_type: 'personal' },
    { code: 'P-2600', name: 'Medical Bills Payable', account_type: 'liability', balance_type: 'C', entity_type: 'personal' },
    
    // PERSONAL EQUITY (3000-3999)
    { code: 'P-3010', name: 'Personal Net Worth', account_type: 'equity', balance_type: 'C', entity_type: 'personal' },
    { code: 'P-3210', name: 'Personal Capital/Opening Balance', account_type: 'equity', balance_type: 'C', entity_type: 'personal' },
    
    // PERSONAL INCOME (4000-4999)
    { code: 'P-4100', name: 'Options Trading Income', account_type: 'revenue', balance_type: 'C', entity_type: 'personal' },
    { code: 'P-4200', name: 'Other Income', account_type: 'revenue', balance_type: 'C', entity_type: 'personal' },
    { code: 'P-4300', name: 'Interest Income', account_type: 'revenue', balance_type: 'C', entity_type: 'personal' },
    { code: 'P-4400', name: 'Dividend Income', account_type: 'revenue', balance_type: 'C', entity_type: 'personal' },
    { code: 'P-4500', name: 'Side Hustle Income', account_type: 'revenue', balance_type: 'C', entity_type: 'personal' },
    
    // PERSONAL EXPENSES (5000-8999) - EXPANDED
    { code: 'P-5100', name: 'Options Trading Losses', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-5200', name: 'Brokerage Commissions & Fees', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-5300', name: 'Market Data Subscriptions', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-6100', name: 'Meals & Dining Out', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-6200', name: 'Travel Expense', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-6300', name: 'Bank Fees', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-6400', name: 'Gas & Fuel', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-6500', name: 'Vehicle Maintenance', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-6600', name: 'Auto Insurance', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-6700', name: 'Student Loan Interest', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-6710', name: 'Credit Card Interest', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-8100', name: 'Rent/Mortgage Payment', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-8110', name: 'Home Utilities', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-8120', name: 'Groceries', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-8130', name: 'Healthcare & Medical', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-8140', name: 'Health Insurance', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-8150', name: 'Clothing & Personal Care', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-8160', name: 'Education & Courses', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-8170', name: 'Entertainment & Hobbies', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-8180', name: 'Gifts & Donations', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-8190', name: 'Subscriptions (Netflix, etc)', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-8200', name: 'Phone & Internet', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    { code: 'P-8900', name: 'Other Personal Expense', account_type: 'expense', balance_type: 'D', entity_type: 'personal' },
    
    // BUSINESS ASSETS (1000-1999)
    { code: 'B-1010', name: 'Business Checking', account_type: 'asset', balance_type: 'D', entity_type: 'business' },
    { code: 'B-1020', name: 'Business Savings', account_type: 'asset', balance_type: 'D', entity_type: 'business' },
    { code: 'B-1100', name: 'Accounts Receivable', account_type: 'asset', balance_type: 'D', entity_type: 'business' },
    { code: 'B-1400', name: 'Equipment', account_type: 'asset', balance_type: 'D', entity_type: 'business' },
    { code: 'B-1450', name: 'Accumulated Depreciation', account_type: 'asset', balance_type: 'C', entity_type: 'business' },
    
    // BUSINESS LIABILITIES (2000-2999)
    { code: 'B-2010', name: 'Accounts Payable', account_type: 'liability', balance_type: 'C', entity_type: 'business' },
    { code: 'B-2020', name: 'Credit Card Payable', account_type: 'liability', balance_type: 'C', entity_type: 'business' },
    { code: 'B-2100', name: 'Wages Payable', account_type: 'liability', balance_type: 'C', entity_type: 'business' },
    { code: 'B-2110', name: 'Due to Owner', account_type: 'liability', balance_type: 'C', entity_type: 'business' },
    { code: 'B-2120', name: 'Sales Tax Payable', account_type: 'liability', balance_type: 'C', entity_type: 'business' },
    
    // BUSINESS EQUITY (3000-3999)
    { code: 'B-3110', name: "Owner's Capital", account_type: 'equity', balance_type: 'C', entity_type: 'business' },
    { code: 'B-3120', name: "Owner's Draw", account_type: 'equity', balance_type: 'D', entity_type: 'business' },
    { code: 'B-3130', name: 'Retained Earnings', account_type: 'equity', balance_type: 'C', entity_type: 'business' },
    
    // BUSINESS REVENUE (4000-4999)
    { code: 'B-4010', name: 'Service Revenue', account_type: 'revenue', balance_type: 'C', entity_type: 'business' },
    { code: 'B-4020', name: 'Consulting Revenue', account_type: 'revenue', balance_type: 'C', entity_type: 'business' },
    
    // BUSINESS OPERATING EXPENSES (6000-6999)
    { code: 'B-6010', name: 'Salaries & Wages', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { code: 'B-6100', name: 'Rent Expense', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { code: 'B-6110', name: 'Utilities', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { code: 'B-6120', name: 'Telephone & Internet', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { code: 'B-6200', name: 'Office Supplies', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { code: 'B-6210', name: 'Software & Subscriptions', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { code: 'B-6300', name: 'Advertising & Marketing', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { code: 'B-6400', name: 'Travel', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { code: 'B-6410', name: 'Meals & Entertainment (50%)', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { code: 'B-6500', name: 'Professional Fees', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { code: 'B-6510', name: 'Legal Fees', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { code: 'B-6520', name: 'Accounting Fees', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { code: 'B-6600', name: 'Bank Service Charges', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { code: 'B-6620', name: 'Interest Expense', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { code: 'B-6700', name: 'Depreciation', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { code: 'B-6800', name: 'Repairs & Maintenance', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
    { code: 'B-6900', name: 'Insurance', account_type: 'expense', balance_type: 'D', entity_type: 'business' },
  ];

  for (const account of accounts) {
    await prisma.chart_of_accounts.upsert({
      where: { code: account.code },
      update: {},
      create: account,
    });
  }

  console.log(`✅ Seeded ${accounts.length} chart of accounts (complete with student loans, credit cards, all personal liabilities)`);
}

seedCompleteCOA()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
