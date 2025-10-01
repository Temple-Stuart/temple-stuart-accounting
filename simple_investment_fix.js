const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');

// Just update the investment tab button text to use the state variables
const updated = content.replace(
  'Investments (746)',
  'Investments ({investmentTransactions.length + committedInvestments.length})'
);

// Update total transactions calculation
const updated2 = updated.replace(
  'const totalTransactions = transactions.length + committedTransactions.length;',
  'const totalTransactions = transactions.length + committedTransactions.length + investmentTransactions.length + committedInvestments.length;'
);

// Update progress calculation  
const updated3 = updated2.replace(
  'const progressPercent = totalTransactions > 0 ? (committedTransactions.length / totalTransactions * 100) : 0;',
  'const progressPercent = totalTransactions > 0 ? ((committedTransactions.length + committedInvestments.length) / totalTransactions * 100) : 0;'
);

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', updated3);
console.log('✅ Simple fix applied - investment counts now show in UI');
