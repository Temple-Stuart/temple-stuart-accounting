import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find your user
  const user = await prisma.users.findUnique({
    where: { email: 'Astuart@templestuart.com' }
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log('Found user:', user.id, user.email);

  // Update all existing COA records to belong to this user
  const result = await prisma.chart_of_accounts.updateMany({
    where: { userId: null },
    data: { userId: user.id }
  });

  console.log('Updated', result.count, 'chart of accounts records');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
