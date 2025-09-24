const bcrypt = require('bcryptjs');

async function testPassword() {
  const testPassword = "Test123!";  // Replace with your actual password
  
  // This is the hash from your database for Astuart@templestuart.com
  const hashFromDB = "$2a$10$USxT1zHD7DcSHXavI1X48uJ4OT6Zpr2RGI9uqbJjh2lUc6AMVu4.y";
  
  const isValid = await bcrypt.compare(testPassword, hashFromDB);
  console.log(`Password match: ${isValid}`);
  
  // Let's also create a new hash to test
  const newHash = await bcrypt.hash(testPassword, 12);
  console.log(`New hash would be: ${newHash}`);
}

testPassword();
