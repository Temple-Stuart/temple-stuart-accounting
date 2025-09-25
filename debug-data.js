// Debug script to see exactly what each API returns
console.log('=== DEBUGGING API RESPONSES ===\n');

// Test accounts API
fetch('http://localhost:3000/api/accounts')
  .then(res => res.json())
  .then(data => {
    console.log('ACCOUNTS API RESPONSE:');
    console.log('Type:', typeof data);
    console.log('Keys:', Object.keys(data));
    console.log('Structure:', JSON.stringify(data, null, 2).substring(0, 500) + '...');
    console.log('\n');
  });

// Test investment transactions API  
fetch('http://localhost:3000/api/investment-transactions')
  .then(res => res.json())
  .then(data => {
    console.log('INVESTMENT TRANSACTIONS API RESPONSE:');
    console.log('Type:', typeof data);
    console.log('Keys:', Object.keys(data));
    console.log('Count field:', data.count);
    console.log('Investments array length:', data.investments?.length);
    console.log('Sample investment:', data.investments?.[0]);
    console.log('\n');
  });

// Test regular transactions API
fetch('http://localhost:3000/api/transactions')
  .then(res => res.json())
  .then(data => {
    console.log('TRANSACTIONS API RESPONSE:');
    console.log('Type:', typeof data);
    console.log('Is array:', Array.isArray(data));
    console.log('Length:', data.length);
    console.log('Sample transaction:', data[0]);
  });
