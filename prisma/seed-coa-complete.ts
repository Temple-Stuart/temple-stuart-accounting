import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCompleteCOA() {
  const accounts = [
    // PERSONAL ASSETS (1000-1999)
    { code: 'P-1010', name: 'Personal Checking', accountType: 'asset', balanceType: 'D', entityType: 'personal' },
    { code: 'P-1020', name: 'Personal Savings', accountType: 'asset', balanceType: 'D', entityType: 'personal' },
    { code: 'P-1030', name: 'Emergency Fund', accountType: 'asset', balanceType: 'D', entityType: 'personal' },
    { code: 'P-1100', name: 'Due from Business', accountType: 'asset', balanceType: 'D', entityType: 'personal' },
    { code: 'P-1200', name: 'Brokerage Cash Account', accountType: 'asset', balanceType: 'D', entityType: 'personal' },
    { code: 'P-1210', name: 'Options Positions - Open', accountType: 'asset', balanceType: 'D', entityType: 'personal' },
    { code: 'P-1230', name: 'Unrealized Gains/Losses', accountType: 'asset', balanceType: 'D', entityType: 'personal' },
    { code: 'P-1240', name: 'Deferred Loss - Wash Sale', accountType: 'asset', balanceType: 'D', entityType: 'personal' },
    { code: 'P-1250', name: 'Stock Investment', accountType: 'asset', balanceType: 'D', entityType: 'personal' },
    { code: 'P-1300', name: 'Cryptocurrency', accountType: 'asset', balanceType: 'D', entityType: 'personal' },
    { code: 'P-1400', name: 'Vehicle', accountType: 'asset', balanceType: 'D', entityType: 'personal' },
    
    // PERSONAL LIABILITIES (2000-2999) - EXPANDED
    { code: 'P-2010', name: 'Credit Card - Main', accountType: 'liability', balanceType: 'C', entityType: 'personal' },
    { code: 'P-2011', name: 'Credit Card - Secondary', accountType: 'liability', balanceType: 'C', entityType: 'personal' },
    { code: 'P-2012', name: 'Credit Card - Business Expenses', accountType: 'liability', balanceType: 'C', entityType: 'personal' },
    { code: 'P-2100', name: 'Options Positions - Written', accountType: 'liability', balanceType: 'C', entityType: 'personal' },
    { code: 'P-2200', name: 'Student Loan - Federal', accountType: 'liability', balanceType: 'C', entityType: 'personal' },
    { code: 'P-2210', name: 'Student Loan - Private', accountType: 'liability', balanceType: 'C', entityType: 'personal' },
    { code: 'P-2300', name: 'Auto Loan', accountType: 'liability', balanceType: 'C', entityType: 'personal' },
    { code: 'P-2400', name: 'Personal Loan', accountType: 'liability', balanceType: 'C', entityType: 'personal' },
    { code: 'P-2500', name: 'Mortgage Payable', accountType: 'liability', balanceType: 'C', entityType: 'personal' },
    { code: 'P-2600', name: 'Medical Bills Payable', accountType: 'liability', balanceType: 'C', entityType: 'personal' },
    
    // PERSONAL EQUITY (3000-3999)
    { code: 'P-3010', name: 'Personal Net Worth', accountType: 'equity', balanceType: 'C', entityType: 'personal' },
    { code: 'P-3210', name: 'Personal Capital/Opening Balance', accountType: 'equity', balanceType: 'C', entityType: 'personal' },
    
    // PERSONAL INCOME (4000-4999)
    { code: 'P-4100', name: 'Options Trading Income', accountType: 'revenue', balanceType: 'C', entityType: 'personal' },
    { code: 'P-4200', name: 'Other Income', accountType: 'revenue', balanceType: 'C', entityType: 'personal' },
    { code: 'P-4300', name: 'Interest Income', accountType: 'revenue', balanceType: 'C', entityType: 'personal' },
    { code: 'P-4400', name: 'Dividend Income', accountType: 'revenue', balanceType: 'C', entityType: 'personal' },
    { code: 'P-4500', name: 'Side Hustle Income', accountType: 'revenue', balanceType: 'C', entityType: 'personal' },
    
    // PERSONAL EXPENSES (5000-8999) - EXPANDED
    { code: 'P-5100', name: 'Options Trading Losses', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-5200', name: 'Brokerage Commissions & Fees', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-5300', name: 'Market Data Subscriptions', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-6100', name: 'Meals & Dining Out', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-6200', name: 'Travel Expense', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-6300', name: 'Bank Fees', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-6400', name: 'Gas & Fuel', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-6500', name: 'Vehicle Maintenance', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-6600', name: 'Auto Insurance', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-6700', name: 'Student Loan Interest', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-6710', name: 'Credit Card Interest', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-8100', name: 'Rent/Mortgage Payment', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-8110', name: 'Home Utilities', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-8120', name: 'Groceries', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-8130', name: 'Healthcare & Medical', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-8140', name: 'Health Insurance', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-8150', name: 'Clothing & Personal Care', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-8160', name: 'Education & Courses', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-8170', name: 'Entertainment & Hobbies', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-8180', name: 'Gifts & Donations', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-8190', name: 'Subscriptions (Netflix, etc)', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-8200', name: 'Phone & Internet', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    { code: 'P-8900', name: 'Other Personal Expense', accountType: 'expense', balanceType: 'D', entityType: 'personal' },
    
    // BUSINESS ASSETS (1000-1999)
    { code: 'B-1010', name: 'Business Checking', accountType: 'asset', balanceType: 'D', entityType: 'business' },
    { code: 'B-1020', name: 'Business Savings', accountType: 'asset', balanceType: 'D', entityType: 'business' },
    { code: 'B-1100', name: 'Accounts Receivable', accountType: 'asset', balanceType: 'D', entityType: 'business' },
    { code: 'B-1400', name: 'Equipment', accountType: 'asset', balanceType: 'D', entityType: 'business' },
    { code: 'B-1450', name: 'Accumulated Depreciation', accountType: 'asset', balanceType: 'C', entityType: 'business' },
    
    // BUSINESS LIABILITIES (2000-2999)
    { code: 'B-2010', name: 'Accounts Payable', accountType: 'liability', balanceType: 'C', entityType: 'business' },
    { code: 'B-2020', name: 'Credit Card Payable', accountType: 'liability', balanceType: 'C', entityType: 'business' },
    { code: 'B-2100', name: 'Wages Payable', accountType: 'liability', balanceType: 'C', entityType: 'business' },
    { code: 'B-2110', name: 'Due to Owner', accountType: 'liability', balanceType: 'C', entityType: 'business' },
    { code: 'B-2120', name: 'Sales Tax Payable', accountType: 'liability', balanceType: 'C', entityType: 'business' },
    
    // BUSINESS EQUITY (3000-3999)
    { code: 'B-3110', name: "Owner's Capital", accountType: 'equity', balanceType: 'C', entityType: 'business' },
    { code: 'B-3120', name: "Owner's Draw", accountType: 'equity', balanceType: 'D', entityType: 'business' },
    { code: 'B-3130', name: 'Retained Earnings', accountType: 'equity', balanceType: 'C', entityType: 'business' },
    
    // BUSINESS REVENUE (4000-4999)
    { code: 'B-4010', name: 'Service Revenue', accountType: 'revenue', balanceType: 'C', entityType: 'business' },
    { code: 'B-4020', name: 'Consulting Revenue', accountType: 'revenue', balanceType: 'C', entityType: 'business' },
    
    // BUSINESS OPERATING EXPENSES (6000-6999)
    { code: 'B-6010', name: 'Salaries & Wages', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6100', name: 'Rent Expense', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6110', name: 'Utilities', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6120', name: 'Telephone & Internet', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6200', name: 'Office Supplies', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6210', name: 'Software & Subscriptions', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6300', name: 'Advertising & Marketing', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6400', name: 'Travel', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6410', name: 'Meals & Entertainment (50%)', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6500', name: 'Professional Fees', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6510', name: 'Legal Fees', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6520', name: 'Accounting Fees', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6600', name: 'Bank Service Charges', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6620', name: 'Interest Expense', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6700', name: 'Depreciation', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6800', name: 'Repairs & Maintenance', accountType: 'expense', balanceType: 'D', entityType: 'business' },
    { code: 'B-6900', name: 'Insurance', accountType: 'expense', balanceType: 'D', entityType: 'business' },
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
