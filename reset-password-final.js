const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetPassword() {
  try {
    // Create a simple password hash
    const hashedPassword = await bcrypt.hash('Password123', 12);
    
    // Update the user's password
    const user = await prisma.users.update({
      where: { 
        email: 'Astuart@templestuart.com'
      },
      data: {
        password: hashedPassword
      }
    });

    console.log('Password reset successfully!');
    console.log('Email: Astuart@templestuart.com');
    console.log('New Password: Password123');
    
    // Verify it works
    const isValid = await bcrypt.compare('Password123', hashedPassword);
    console.log('Password verification:', isValid);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

resetPassword();
