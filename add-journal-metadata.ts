import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function addColumns() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE journal_transactions ADD COLUMN IF NOT EXISTS account_code VARCHAR(20);
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE journal_transactions ADD COLUMN IF NOT EXISTS amount INTEGER;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE journal_transactions ADD COLUMN IF NOT EXISTS strategy VARCHAR(50);
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE journal_transactions ADD COLUMN IF NOT EXISTS trade_num VARCHAR(20);
  `);
  console.log('✅ Added metadata columns to journal_transactions table');
}

addColumns()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
