import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const userId = 'm6wf8z6gjmmjp8dawz';
  const newPassword = 'TempPassword123!'; // Change after login

  const hash = await bcrypt.hash(newPassword, 10);

  const updated = await prisma.users.update({
    where: { id: userId },
    data: { password: hash }
  });

  console.log(`Password reset for: ${updated.email}`);
  console.log(`New password: ${newPassword}`);
  console.log('\nChange this after logging in!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
