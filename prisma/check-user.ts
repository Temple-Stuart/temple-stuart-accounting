import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const users = await prisma.users.findMany({ select: { id: true, name: true, email: true } });
  console.log(users);
}
main().finally(() => prisma.$disconnect());
