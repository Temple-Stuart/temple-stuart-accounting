// Run this script to add COA columns to your database
// Usage: node add-coa-columns.js

const { prisma } = require('./src/lib/prisma');

async function addCOAColumns() {
  try {
    console.log('Adding COA columns to transactions table...');
    
    // Add columns to transactions table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE transactions 
      ADD COLUMN IF NOT EXISTS "accountCode" VARCHAR(10),
      ADD COLUMN IF NOT EXISTS "subAccount" VARCHAR(50)
    `);
    
    console.log('✅ Added accountCode and subAccount to transactions table');
    
    // Add columns to investment_transactions table
    await prisma.$executeRawUnsafe(`
      ALTER TABLE investment_transactions 
      ADD COLUMN IF NOT EXISTS "accountCode" VARCHAR(10),
      ADD COLUMN IF NOT EXISTS "subAccount" VARCHAR(50)
    `);
    
    console.log('✅ Added accountCode and subAccount to investment_transactions table');
    
    // Create indexes for better performance
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_transactions_accountCode 
      ON transactions("accountCode")
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_investment_transactions_accountCode 
      ON investment_transactions("accountCode")
    `);
    
    console.log('✅ Created indexes for better query performance');
    
    console.log('\n✅ Database migration complete!');
    console.log('Your transactions can now be assigned COA codes.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

addCOAColumns();
