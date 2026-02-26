const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const txns = await prisma.transactions.findMany({
    select: { 
      name: true, 
      predictedCoaCode: true, 
      predictionConfidence: true,
      reviewStatus: true,
      accountCode: true
    },
    take: 5
  });
  console.log(JSON.stringify(txns, null, 2));
}
main().finally(() => prisma.$disconnect());
