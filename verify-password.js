const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function verifyPassword() {
  try {
    const user = await prisma.users.findFirst({
      where: { email: 'Astuart@templestuart.com' }
    });
    
    if (!user) {
      console.log('User not found');
      return;
    }
    
    console.log('User found:', user.email);
    console.log('Testing passwords:');
    
    const test1 = await bcrypt.compare('TestPass123', user.password);
    console.log('TestPass123 matches:', test1);
    
    const test2 = await bcrypt.compare('test', user.password);
    console.log('test matches:', test2);
    
    console.log('Hash starts with:', user.password.substring(0, 10));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyPassword();
