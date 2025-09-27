// Run this to check what your accounts API returns
fetch('http://localhost:3000/api/accounts')
  .then(res => res.json())
  .then(data => {
    console.log('Accounts API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.items) {
      console.log('\nFound nested structure with items');
      data.items.forEach(item => {
        console.log(`Institution: ${item.institutionName}`);
        console.log(`Accounts: ${item.accounts?.length || 0}`);
      });
    } else if (Array.isArray(data)) {
      console.log(`\nFound ${data.length} accounts directly`);
      data.forEach(acc => {
        console.log(`- ${acc.name} (${acc.institution || 'unknown institution'})`);
      });
    }
  });
