import { PrismaClient } from '@prisma/client';

const email = process.argv[2];
if (!email) {
  console.error('Usage: npx tsx scripts/make-admin.ts <email>');
  process.exit(1);
}

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.users.updateMany({
    where: { email: { equals: email, mode: 'insensitive' } },
    data: { role: 'admin' },
  });

  if (result.count === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  console.log(`Granted admin role to ${email}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
