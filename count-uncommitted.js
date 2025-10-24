const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function countUncommitted() {
  const uncommitted = await prisma.transactions.count({
    where: { accountCode: null }
  });
  console.log(`Uncommitted transactions: ${uncommitted}`);
  await prisma.$disconnect();
}

countUncommitted();
