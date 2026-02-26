import { prisma } from '../src/lib/prisma';

async function main() {
  const users = await prisma.users.findMany({
    select: { id: true, email: true, name: true, createdAt: true }
  });

  console.log('All users in database:\n');
  users.forEach(u => {
    console.log(`ID: ${u.id}`);
    console.log(`Email: "${u.email}"`);
    console.log(`Name: ${u.name}`);
    console.log(`Created: ${u.createdAt}\n`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
