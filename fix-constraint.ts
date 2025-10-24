import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function fixConstraint() {
  await prisma.$executeRawUnsafe(`
    ALTER TABLE chart_of_accounts DROP CONSTRAINT IF EXISTS chart_of_accounts_entity_type_check;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE chart_of_accounts ADD CONSTRAINT chart_of_accounts_entity_type_check 
      CHECK (entity_type IN ('personal', 'business', 'trading'));
  `);
  console.log('✅ Constraint updated to allow trading entity');
}

fixConstraint()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
