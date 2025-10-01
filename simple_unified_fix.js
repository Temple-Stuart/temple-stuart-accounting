const fs = require('fs');
let content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');

console.log('Creating simple unified dashboard...\n');

// 1. Fix calculations to include investments
content = content.replace(
  'const totalTransactions = transactions.length + committedTransactions.length;',
  'const totalTransactions = transactions.length + committedTransactions.length + investmentTransactions.length + committedInvestments.length;'
);

content = content.replace(
  'const progressPercent = totalTransactions > 0 ? (committedTransactions.length / totalTransactions * 100) : 0;',
  'const progressPercent = totalTransactions > 0 ? ((committedTransactions.length + committedInvestments.length) / totalTransactions * 100) : 0;'
);

// 2. Remove tab switching - show everything
content = content.replace(
  "{activeTab === 'spending' && (",
  "{true && ("
);

content = content.replace(
  "{activeTab === 'investments' && (",
  "{true && ("
);

// 3. Update tab buttons to just be labels
content = content.replace(
  'onClick={() => setActiveTab(\'spending\')}',
  'disabled'
);

content = content.replace(
  'onClick={() => setActiveTab(\'investments\')}',
  'disabled'
);

// 4. Change tab button text to section headers
content = content.replace(
  'Spending (542 uncommitted, 0 committed)',
  'Banking & Spending'
);

content = content.replace(
  'Investments (746)',
  'Investments & Trading'
);

// 5. Style the sections
content = content.replace(
  'className="px-6 py-3 font-medium',
  'className="px-6 py-3 font-bold text-lg bg-gray-50'
);

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', content);
console.log('✅ Simple unified dashboard created!');
