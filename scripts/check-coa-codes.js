const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const codes = await prisma.chartOfAccount.findMany({
    where: { 
      code: { startsWith: 'P-' },
      accountType: 'expense'
    },
    select: { code: true, name: true },
    orderBy: { code: 'asc' }
  });
  console.log(JSON.stringify(codes, null, 2));
}
main().finally(() => prisma.$disconnect());
