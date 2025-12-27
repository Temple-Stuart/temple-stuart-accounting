import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.users.update({
    where: { email: 'Astuart@templestuart.com' },
    data: { name: 'Alex Stuart' }
  });
  console.log('✓ Updated Temple Stuart → Alex Stuart');
}
main().finally(() => prisma.$disconnect());
