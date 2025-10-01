const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');

// Fix the type annotation for the filter function
const updated = content.replace(
  "const symbol = txn.name?.split(' ').find(part => part.match(/^[A-Z]+$/)) || '';",
  "const symbol = txn.name?.split(' ').find((part: string) => part.match(/^[A-Z]+$/)) || '';"
);

// Also fix any other similar instances in the investment count filter
const updated2 = updated.replace(
  "const symbol = txn.name?.split(' ').find(part => part.match(/^[A-Z]+$/)) || '';",
  "const symbol = txn.name?.split(' ').find((part: string) => part.match(/^[A-Z]+$/)) || '';"
);

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', updated2);
console.log('✅ Fixed TypeScript type annotations');
