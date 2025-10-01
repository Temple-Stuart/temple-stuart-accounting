const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');

// Replace the old investmentFilter reference with the new filter logic
const updated = content.replace(
  'investmentTransactions.filter(txn => !investmentFilter || txn.name?.toUpperCase().includes(investmentFilter))',
  `investmentTransactions.filter(txn => {
                    const txnDate = new Date(txn.date).toISOString().split('T')[0];
                    const symbol = txn.name?.split(' ').find(part => part.match(/^[A-Z]+$/)) || '';
                    const position = txn.name?.toLowerCase().includes('close') ? 'close' : 'open';
                    
                    return (!dateFilter || txnDate === dateFilter) &&
                           (!symbolFilter || symbol.includes(symbolFilter)) &&
                           (!positionFilter || position === positionFilter);
                  })`
);

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', updated);
console.log('✅ Fixed filter reference');
