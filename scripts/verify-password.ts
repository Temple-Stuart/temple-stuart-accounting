import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const userId = 'm6wf8z6gjmmjp8dawz';
  
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { email: true, password: true }
  });

  if (!user) {
    console.log('User not found!');
    return;
  }

  console.log(`Email: ${user.email}`);
  console.log(`Password hash exists: ${!!user.password}`);
  console.log(`Password hash length: ${user.password?.length || 0}`);
  
  // Test if the password works
  const testPassword = 'TempPassword123!';
  const isValid = await bcrypt.compare(testPassword, user.password);
  console.log(`\nPassword 'TempPassword123!' valid: ${isValid}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
