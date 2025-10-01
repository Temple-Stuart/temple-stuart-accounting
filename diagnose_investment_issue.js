const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');

console.log('=== INVESTMENT FUNCTIONALITY DIAGNOSIS ===\n');

// 1. Check if states exist
console.log('1. CHECKING STATES:');
console.log('   committedInvestments state:', content.includes('const [committedInvestments') ? '✅ EXISTS' : '❌ MISSING');
console.log('   investmentRowChanges state:', content.includes('const [investmentRowChanges') ? '✅ EXISTS' : '❌ MISSING');

// 2. Check if functions exist
console.log('\n2. CHECKING FUNCTIONS:');
console.log('   commitSelectedInvestmentRows:', content.includes('const commitSelectedInvestmentRows') ? '✅ EXISTS' : '❌ MISSING');
console.log('   massUncommitInvestments:', content.includes('const massUncommitInvestments') ? '✅ EXISTS' : '❌ MISSING');

// 3. Check if loadData splits investments
console.log('\n3. CHECKING DATA LOADING:');
console.log('   Splits committed/uncommitted:', content.includes('const committedInv =') ? '✅ YES' : '❌ NO');
console.log('   Sets committedInvestments:', content.includes('setCommittedInvestments(committedInv)') ? '✅ YES' : '❌ NO');

// 4. Check if UI uses these states
console.log('\n4. CHECKING UI CONNECTIONS:');
console.log('   Investment tab shows count:', content.includes('investmentTransactions.length} uncommitted') ? '✅ YES' : '❌ NO');
console.log('   Dropdowns use investmentRowChanges:', content.includes('investmentRowChanges[txn.id]') ? '✅ YES' : '❌ NO');
console.log('   Commit button exists:', content.includes('onClick={commitSelectedInvestmentRows}') ? '✅ YES' : '❌ NO');
console.log('   Investment tab wrapped in activeTab check:', /activeTab === 'investments'.*\{[\s\S]*investmentTransactions\.map/m.test(content) ? '✅ YES' : '❌ NO');

// 5. Find the actual problem
console.log('\n5. ACTUAL PROBLEMS:');
const problems = [];

if (!content.includes('setCommittedInvestments(committedInv)')) {
  problems.push('• Investments are NOT being split into committed/uncommitted in loadData');
}

if (!content.includes('investmentRowChanges[txn.id]')) {
  problems.push('• Dropdowns are NOT connected to track changes');
}

if (!content.includes('onClick={commitSelectedInvestmentRows}')) {
  problems.push('• No commit button in investment tab');
}

if (!content.includes('{activeTab === \'investments\' && (')) {
  problems.push('• Investment content not properly wrapped in tab conditional');
}

if (problems.length > 0) {
  console.log(problems.join('\n'));
} else {
  console.log('   All connections appear correct - check browser console for runtime errors');
}

