const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function updatePassword() {
  try {
    // Hash the new password
    const hashedPassword = await bcrypt.hash('test', 12);
    
    // Update the user's password
    const user = await prisma.users.update({
      where: { 
        email: 'Astuart@templestuart.com'  // Using exact case from database
      },
      data: {
        password: hashedPassword
      }
    });

    console.log('Password updated successfully!');
    console.log('Email: astuart@templestuart.com');
    console.log('New Password: test');
    
  } catch (error) {
    console.error('Error updating password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePassword();
