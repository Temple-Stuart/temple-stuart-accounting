import { prisma } from '../src/lib/prisma';

async function main() {
  // NextAuth users (OAuth logins)
  const authUsers = await prisma.user.findMany({
    include: { accounts: true }
  });
  
  console.log('\n=== NEXTAUTH USERS (OAuth) ===');
  authUsers.forEach(u => {
    console.log(`ID: ${u.id} | Email: ${u.email}`);
    u.accounts.forEach(a => console.log(`  → Provider: ${a.provider}`));
  });
  
  // Custom users (Plaid data)
  const customUsers = await prisma.users.findMany();
  
  console.log('\n=== CUSTOM USERS (Plaid) ===');
  for (const u of customUsers) {
    const plaidCount = await prisma.plaid_items.count({ where: { userId: u.id } });
    console.log(`ID: ${u.id} | Email: ${u.email} | Plaid: ${plaidCount}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
