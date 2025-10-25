const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const codes = await prisma.chartOfAccounts.findMany({
    where: { code: { startsWith: 'P-' } },
    select: { code: true, name: true },
    orderBy: { code: 'asc' },
    take: 30
  });
  console.log(JSON.stringify(codes, null, 2));
}

main().finally(() => prisma.$disconnect());
