require('dotenv').config();

async function testPlaid() {
  console.log('PLAID_CLIENT_ID exists:', !!process.env.PLAID_CLIENT_ID);
  console.log('PLAID_SECRET exists:', !!process.env.PLAID_SECRET);
  
  // Test the link token endpoint
  const response = await fetch('http://localhost:3000/api/plaid/link-token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': 'userEmail=Astuart@templestuart.com' // Simulate being logged in
    }
  });
  
  const data = await response.json();
  console.log('Link token response:', data);
}

testPlaid();
