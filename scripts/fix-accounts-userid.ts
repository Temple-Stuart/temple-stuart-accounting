import { prisma } from '../src/lib/prisma';

async function main() {
  const githubUserId = 'cmfi3rcrl0000zcj0ajbj4za5';  // stuart.alexander.phi@gmail.com
  
  // Update all accounts to point to GitHub user
  const result = await prisma.accounts.updateMany({
    data: { userId: githubUserId }
  });
  
  console.log(`✅ Updated ${result.count} accounts to GitHub user`);
  
  // Verify
  const accounts = await prisma.accounts.findMany();
  accounts.forEach(a => {
    console.log(`${a.name} | userId: ${a.userId}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
