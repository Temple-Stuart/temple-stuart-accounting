import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const types = await prisma.chart_of_accounts.findMany({
    select: { account_type: true },
    distinct: ['account_type']
  });
  console.log(types.map((t: any) => t.account_type));
}
main().then(() => prisma.$disconnect());
