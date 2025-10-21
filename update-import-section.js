const fs = require('fs');
let content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');

const updateEntityFunc =    const updateEntityType = async (accountId: string, entityType: string) => {     await fetch('/api/accounts/update-entity', {       method: 'POST',       headers: { 'Content-Type': 'application/json' },       body: JSON.stringify({ accountId, entityType })     });     setAccounts(accounts.map(acc =>        acc.id === accountId ? {...acc, entityType} : acc     ));   };;
content = content.replace(
/(const loadChartOfAccounts = async[^}]+}\s+};)/,
'$1\n' + updateEntityFunc
);
const newAccountCard = <div key={account.id} className="border rounded-lg p-3 mb-4">                 <div className="flex justify-between mb-2">;
content = content.replace(
/<div key={account\.id} className="border rounded-lg p-3 mb-4 flex justify-between">/,
newAccountCard
);
fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', content);
console.log('✅ Added entity dropdown to dashboard');
