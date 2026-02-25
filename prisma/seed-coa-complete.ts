import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedCompleteCOA() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx tsx prisma/seed-coa-complete.ts <user-email>');
    process.exit(1);
  }

  const user = await prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } }
  });
  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  // Find or create personal and business entities
  let personalEntity = await prisma.entities.findFirst({
    where: { userId: user.id, entity_type: 'personal' }
  });
  if (!personalEntity) {
    personalEntity = await prisma.entities.create({
      data: { id: randomUUID(), userId: user.id, name: 'Personal', entity_type: 'personal' }
    });
  }

  let businessEntity = await prisma.entities.findFirst({
    where: { userId: user.id, entity_type: 'sole_prop' }
  });
  if (!businessEntity) {
    businessEntity = await prisma.entities.create({
      data: { id: randomUUID(), userId: user.id, name: 'Business', entity_type: 'sole_prop' }
    });
  }

  const accounts = [
    // PERSONAL ASSETS (1000-1999)
    { code: '1010', name: 'Personal Checking', account_type: 'asset', balance_type: 'D', entity_id: personalEntity.id },
    { code: '1020', name: 'Personal Savings', account_type: 'asset', balance_type: 'D', entity_id: personalEntity.id },
    { code: '1030', name: 'Emergency Fund', account_type: 'asset', balance_type: 'D', entity_id: personalEntity.id },
    { code: '1100', name: 'Due from Business', account_type: 'asset', balance_type: 'D', entity_id: personalEntity.id },
    { code: '1200', name: 'Brokerage Cash Account', account_type: 'asset', balance_type: 'D', entity_id: personalEntity.id },
    { code: '1210', name: 'Options Positions - Open', account_type: 'asset', balance_type: 'D', entity_id: personalEntity.id },
    { code: '1230', name: 'Unrealized Gains/Losses', account_type: 'asset', balance_type: 'D', entity_id: personalEntity.id },
    { code: '1240', name: 'Deferred Loss - Wash Sale', account_type: 'asset', balance_type: 'D', entity_id: personalEntity.id },
    { code: '1250', name: 'Stock Investment', account_type: 'asset', balance_type: 'D', entity_id: personalEntity.id },
    { code: '1300', name: 'Cryptocurrency', account_type: 'asset', balance_type: 'D', entity_id: personalEntity.id },
    { code: '1400', name: 'Vehicle', account_type: 'asset', balance_type: 'D', entity_id: personalEntity.id },

    // PERSONAL LIABILITIES (2000-2999) - EXPANDED
    { code: '2010', name: 'Credit Card - Main', account_type: 'liability', balance_type: 'C', entity_id: personalEntity.id },
    { code: '2011', name: 'Credit Card - Secondary', account_type: 'liability', balance_type: 'C', entity_id: personalEntity.id },
    { code: '2012', name: 'Credit Card - Business Expenses', account_type: 'liability', balance_type: 'C', entity_id: personalEntity.id },
    { code: '2100', name: 'Options Positions - Written', account_type: 'liability', balance_type: 'C', entity_id: personalEntity.id },
    { code: '2200', name: 'Student Loan - Federal', account_type: 'liability', balance_type: 'C', entity_id: personalEntity.id },
    { code: '2210', name: 'Student Loan - Private', account_type: 'liability', balance_type: 'C', entity_id: personalEntity.id },
    { code: '2300', name: 'Auto Loan', account_type: 'liability', balance_type: 'C', entity_id: personalEntity.id },
    { code: '2400', name: 'Personal Loan', account_type: 'liability', balance_type: 'C', entity_id: personalEntity.id },
    { code: '2500', name: 'Mortgage Payable', account_type: 'liability', balance_type: 'C', entity_id: personalEntity.id },
    { code: '2600', name: 'Medical Bills Payable', account_type: 'liability', balance_type: 'C', entity_id: personalEntity.id },

    // PERSONAL EQUITY (3000-3999)
    { code: '3010', name: 'Personal Net Worth', account_type: 'equity', balance_type: 'C', entity_id: personalEntity.id },
    { code: '3210', name: 'Personal Capital/Opening Balance', account_type: 'equity', balance_type: 'C', entity_id: personalEntity.id },

    // PERSONAL INCOME (4000-4999)
    { code: '4100', name: 'Options Trading Income', account_type: 'revenue', balance_type: 'C', entity_id: personalEntity.id },
    { code: '4200', name: 'Other Income', account_type: 'revenue', balance_type: 'C', entity_id: personalEntity.id },
    { code: '4300', name: 'Interest Income', account_type: 'revenue', balance_type: 'C', entity_id: personalEntity.id },
    { code: '4400', name: 'Dividend Income', account_type: 'revenue', balance_type: 'C', entity_id: personalEntity.id },
    { code: '4500', name: 'Side Hustle Income', account_type: 'revenue', balance_type: 'C', entity_id: personalEntity.id },

    // PERSONAL EXPENSES (5000-8999) - EXPANDED
    { code: '5100', name: 'Options Trading Losses', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '5200', name: 'Brokerage Commissions & Fees', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '5300', name: 'Market Data Subscriptions', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '6100', name: 'Meals & Dining Out', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '6200', name: 'Travel Expense', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '6300', name: 'Bank Fees', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '6400', name: 'Gas & Fuel', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '6500', name: 'Vehicle Maintenance', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '6600', name: 'Auto Insurance', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '6700', name: 'Student Loan Interest', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '6710', name: 'Credit Card Interest', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '8100', name: 'Rent/Mortgage Payment', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '8110', name: 'Home Utilities', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '8120', name: 'Groceries', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '8130', name: 'Healthcare & Medical', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '8140', name: 'Health Insurance', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '8150', name: 'Clothing & Personal Care', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '8160', name: 'Education & Courses', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '8170', name: 'Entertainment & Hobbies', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '8180', name: 'Gifts & Donations', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '8190', name: 'Subscriptions (Netflix, etc)', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '8200', name: 'Phone & Internet', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '8900', name: 'Other Personal Expense', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },

    // BUSINESS ASSETS (1000-1999)
    { code: '1010', name: 'Business Checking', account_type: 'asset', balance_type: 'D', entity_id: businessEntity.id },
    { code: '1020', name: 'Business Savings', account_type: 'asset', balance_type: 'D', entity_id: businessEntity.id },
    { code: '1100', name: 'Accounts Receivable', account_type: 'asset', balance_type: 'D', entity_id: businessEntity.id },
    { code: '1400', name: 'Equipment', account_type: 'asset', balance_type: 'D', entity_id: businessEntity.id },
    { code: '1450', name: 'Accumulated Depreciation', account_type: 'asset', balance_type: 'C', entity_id: businessEntity.id },

    // BUSINESS LIABILITIES (2000-2999)
    { code: '2010', name: 'Accounts Payable', account_type: 'liability', balance_type: 'C', entity_id: businessEntity.id },
    { code: '2020', name: 'Credit Card Payable', account_type: 'liability', balance_type: 'C', entity_id: businessEntity.id },
    { code: '2100', name: 'Wages Payable', account_type: 'liability', balance_type: 'C', entity_id: businessEntity.id },
    { code: '2110', name: 'Due to Owner', account_type: 'liability', balance_type: 'C', entity_id: businessEntity.id },
    { code: '2120', name: 'Sales Tax Payable', account_type: 'liability', balance_type: 'C', entity_id: businessEntity.id },

    // BUSINESS EQUITY (3000-3999)
    { code: '3110', name: "Owner's Capital", account_type: 'equity', balance_type: 'C', entity_id: businessEntity.id },
    { code: '3120', name: "Owner's Draw", account_type: 'equity', balance_type: 'D', entity_id: businessEntity.id },
    { code: '3130', name: 'Retained Earnings', account_type: 'equity', balance_type: 'C', entity_id: businessEntity.id },

    // BUSINESS REVENUE (4000-4999)
    { code: '4010', name: 'Service Revenue', account_type: 'revenue', balance_type: 'C', entity_id: businessEntity.id },
    { code: '4020', name: 'Consulting Revenue', account_type: 'revenue', balance_type: 'C', entity_id: businessEntity.id },

    // BUSINESS OPERATING EXPENSES (6000-6999)
    { code: '6010', name: 'Salaries & Wages', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6100', name: 'Rent Expense', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6110', name: 'Utilities', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6120', name: 'Telephone & Internet', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6200', name: 'Office Supplies', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6210', name: 'Software & Subscriptions', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6300', name: 'Advertising & Marketing', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6400', name: 'Travel', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6410', name: 'Meals & Entertainment (50%)', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6500', name: 'Professional Fees', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6510', name: 'Legal Fees', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6520', name: 'Accounting Fees', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6600', name: 'Bank Service Charges', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6620', name: 'Interest Expense', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6700', name: 'Depreciation', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6800', name: 'Repairs & Maintenance', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6900', name: 'Insurance', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
  ];

  let created = 0;
  let skipped = 0;

  for (const account of accounts) {
    const existing = await prisma.chart_of_accounts.findFirst({
      where: { userId: user.id, entity_id: account.entity_id, code: account.code }
    });

    if (existing) {
      skipped++;
    } else {
      await prisma.chart_of_accounts.create({
        data: {
          id: randomUUID(),
          ...account,
          userId: user.id,
        }
      });
      created++;
    }
  }

  console.log(`Seeded ${created} new, ${skipped} existing chart of accounts (complete) for ${email}`);
}

seedCompleteCOA()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
