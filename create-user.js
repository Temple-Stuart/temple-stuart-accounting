const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createUser() {
  const hashedPassword = await bcrypt.hash('password123', 12);
  
  const user = await prisma.user.create({
    data: {
      email: 'test@example.com',
      password: hashedPassword,
      name: 'Test User'
    }
  });
  
  console.log('User created:', user.email);
}

createUser().catch(console.error).finally(() => prisma.$disconnect());
