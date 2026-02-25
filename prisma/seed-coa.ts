import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedChartOfAccounts() {
  // Find user and their entities
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: npx tsx prisma/seed-coa.ts <user-email>');
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
    // Personal Assets
    { code: '1010', name: 'Personal Checking', account_type: 'asset', balance_type: 'D', entity_id: personalEntity.id },
    { code: '1020', name: 'Personal Savings', account_type: 'asset', balance_type: 'D', entity_id: personalEntity.id },
    { code: '1200', name: 'Brokerage Cash Account', account_type: 'asset', balance_type: 'D', entity_id: personalEntity.id },
    { code: '1210', name: 'Options Positions - Open', account_type: 'asset', balance_type: 'D', entity_id: personalEntity.id },
    { code: '1240', name: 'Deferred Loss - Wash Sale', account_type: 'asset', balance_type: 'D', entity_id: personalEntity.id },

    // Personal Liabilities
    { code: '2100', name: 'Options Positions - Written', account_type: 'liability', balance_type: 'C', entity_id: personalEntity.id },

    // Personal Equity
    { code: '3010', name: 'Personal Net Worth', account_type: 'equity', balance_type: 'C', entity_id: personalEntity.id },

    // Personal Income
    { code: '4100', name: 'Options Trading Income', account_type: 'revenue', balance_type: 'C', entity_id: personalEntity.id },

    // Personal Expenses
    { code: '5100', name: 'Options Trading Losses', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '5200', name: 'Brokerage Commissions & Fees', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },
    { code: '6100', name: 'Meals Expense', account_type: 'expense', balance_type: 'D', entity_id: personalEntity.id },

    // Business Assets
    { code: '1010', name: 'Business Checking', account_type: 'asset', balance_type: 'D', entity_id: businessEntity.id },
    { code: '1020', name: 'Business Savings', account_type: 'asset', balance_type: 'D', entity_id: businessEntity.id },

    // Business Liabilities
    { code: '2020', name: 'Credit Card Payable', account_type: 'liability', balance_type: 'C', entity_id: businessEntity.id },
    { code: '2110', name: 'Due to Owner', account_type: 'liability', balance_type: 'C', entity_id: businessEntity.id },

    // Business Equity
    { code: '3110', name: "Owner's Capital", account_type: 'equity', balance_type: 'C', entity_id: businessEntity.id },
    { code: '3120', name: "Owner's Draw", account_type: 'equity', balance_type: 'D', entity_id: businessEntity.id },
    { code: '3130', name: 'Retained Earnings', account_type: 'equity', balance_type: 'C', entity_id: businessEntity.id },

    // Business Revenue
    { code: '4010', name: 'Service Revenue', account_type: 'revenue', balance_type: 'C', entity_id: businessEntity.id },

    // Business Expenses
    { code: '6000', name: 'Rent Expense', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
    { code: '6100', name: 'Office Supplies', account_type: 'expense', balance_type: 'D', entity_id: businessEntity.id },
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

  console.log(`Seeded ${created} new, ${skipped} existing chart of accounts for ${email}`);
}

seedChartOfAccounts()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
