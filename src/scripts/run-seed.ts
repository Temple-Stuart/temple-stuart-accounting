import { PrismaClient } from '@prisma/client';
import { seedCoaTemplates } from '../lib/seed-coa-templates';
import { seedEntities } from '../lib/seed-entities';

const ALEX_USER_ID = 'cmfi3rcrl0000zcj0ajbj4za5';

async function main() {
  const prisma = new PrismaClient({ log: ['error'] });

  try {
    console.log('=== Seeding COA Templates ===');
    const templateResults = await seedCoaTemplates(prisma);
    for (const t of templateResults) {
      console.log(`  ✓ ${t.name}: ${t.accountCount} accounts`);
    }

    console.log('\n=== Seeding Entities for Alex ===');
    const entityResults = await seedEntities(prisma, ALEX_USER_ID);
    for (const e of entityResults) {
      console.log(`  ✓ ${e.entity}: ${e.coaCount} new COA accounts, ${e.taxMappings} tax mappings`);
    }

    console.log('\n=== Seed Complete ===');
  } catch (error) {
    console.error('Seed failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
