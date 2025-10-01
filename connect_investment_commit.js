const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');

// Replace the alert with the actual commit function
const updated = content.replace(
  "onClick={() => alert('Investment commit functionality coming soon!')}",
  "onClick={commitSelectedInvestmentRows}"
);

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', updated);
console.log('✅ Connected button to commitSelectedInvestmentRows function');
