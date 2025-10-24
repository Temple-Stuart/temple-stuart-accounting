const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkBreakdown() {
  const all = await prisma.investment_transactions.findMany();
  
  console.log('Total in DB: ' + all.length);
  
  const after2025 = all.filter(t => new Date(t.date) >= new Date('2025-01-01'));
  console.log('After 2025-01-01: ' + after2025.length);
  
  const afterJune = all.filter(t => new Date(t.date) >= new Date('2025-06-10'));
  console.log('After 2025-06-10: ' + afterJune.length);
  
  await prisma.$disconnect();
}

checkBreakdown();
