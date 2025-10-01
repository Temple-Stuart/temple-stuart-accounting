const fs = require('fs');

// Read the current file
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');

// Find where to add the investment commit functions
// We need to add after line 15 where state variables are defined
const lines = content.split('\n');

// Find the line with investmentTransactions state
let investmentStateLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const [investmentTransactions')) {
    investmentStateLine = i;
    break;
  }
}

// Add new state variables for investment tracking
const newStates = `  const [committedInvestments, setCommittedInvestments] = useState<any[]>([]);
  const [investmentRowChanges, setInvestmentRowChanges] = useState<{[key: string]: {strategy: string, coa: string, sub: string}}>({});
  const [selectedCommittedInvestments, setSelectedCommittedInvestments] = useState<string[]>([]);`;

// Insert after investmentTransactions state
lines.splice(investmentStateLine + 1, 0, newStates);

// Now find the loadData function and update it to load committed investments
const loadDataStart = lines.findIndex(line => line.includes('const loadData = async'));
const loadDataEnd = lines.findIndex((line, idx) => idx > loadDataStart && line.trim() === '};');

// Add investment committed loading in loadData
for (let i = loadDataStart; i < loadDataEnd; i++) {
  if (lines[i].includes('setInvestmentTransactions(investments)')) {
    lines[i] = `        const committedInv = investments.filter((t: any) => t.accountCode);
        const uncommittedInv = investments.filter((t: any) => !t.accountCode);
        setCommittedInvestments(committedInv);
        setInvestmentTransactions(uncommittedInv);`;
    break;
  }
}

// Add commit functions for investments (after the commitSelectedRows function)
const commitRowsEnd = lines.findIndex(line => line.includes('const commitSelectedRows')) + 30;
const investmentCommitFunctions = `
  const commitSelectedInvestmentRows = async () => {
    const updates = Object.entries(investmentRowChanges).filter(([id, values]) => values.coa && values.strategy);
    if (updates.length === 0) {
      alert('Investments need both Strategy and COA assigned');
      return;
    }
    try {
      for (const [txnId, values] of updates) {
        await fetch('/api/transactions/assign-coa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionIds: [txnId],
            accountCode: values.coa,
            subAccount: values.sub || null,
            strategy: values.strategy
          })
        });
      }
      await loadData();
      setInvestmentRowChanges({});
      alert(\`✅ Committed \${updates.length} investment transactions\`);
    } catch (error) {
      alert('Failed to commit investment transactions');
    }
  };

  const massUncommitInvestments = async () => {
    if (selectedCommittedInvestments.length === 0) {
      alert('Select investment transactions to uncommit');
      return;
    }
    try {
      for (const txnId of selectedCommittedInvestments) {
        await fetch('/api/transactions/assign-coa', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transactionIds: [txnId],
            accountCode: null,
            subAccount: null,
            strategy: null
          })
        });
      }
      await loadData();
      setSelectedCommittedInvestments([]);
      alert(\`✅ Uncommitted \${selectedCommittedInvestments.length} investment transactions\`);
    } catch (error) {
      alert('Failed to uncommit');
    }
  };`;

lines.splice(commitRowsEnd, 0, investmentCommitFunctions);

// Write the updated file
fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Added investment commit state and functions');
