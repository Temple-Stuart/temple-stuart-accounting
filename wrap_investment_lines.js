const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Wrapping investment lines with tab check...\n');

// Line 773: Investment Transactions counter - wrap it
for (let i = 770; i < 775; i++) {
  if (lines[i] && lines[i].includes('Investment Transactions: {investme')) {
    // Find the containing div
    for (let j = i-1; j >= i-5; j--) {
      if (lines[j] && lines[j].includes('<div')) {
        lines[j] = `          {activeTab === 'investments' && (\n${lines[j]}`;
        // Find closing div
        for (let k = i; k < i+10; k++) {
          if (lines[k] && lines[k].includes('</div>')) {
            lines[k] = lines[k] + '\n          )}';
            console.log('✅ Wrapped investment counter');
            break;
          }
        }
        break;
      }
    }
    break;
  }
}

// Line 801: Investment transactions table - wrap it
for (let i = 798; i < 805; i++) {
  if (lines[i] && lines[i].includes('investmentTransactions.filter(txn =>')) {
    // Find the containing div (overflow-auto)
    for (let j = i-1; j >= i-10; j--) {
      if (lines[j] && lines[j].includes('<div') && lines[j].includes('overflow')) {
        lines[j] = `          {activeTab === 'investments' && (\n${lines[j]}`;
        // Find the closing div after the table
        for (let k = i; k < i+130; k++) {
          if (lines[k] && lines[k].includes('</table>')) {
            for (let m = k; m < k+5; m++) {
              if (lines[m] && lines[m].includes('</div>')) {
                lines[m] = lines[m] + '\n          )}';
                console.log('✅ Wrapped investment table');
                break;
              }
            }
            break;
          }
        }
        break;
      }
    }
    break;
  }
}

// Line 921: Total Investment Transactions - wrap it
for (let i = 918; i < 925; i++) {
  if (lines[i] && lines[i].includes('Total Investment Transactions:')) {
    // Find containing div
    for (let j = i-1; j >= i-3; j--) {
      if (lines[j] && lines[j].includes('<div')) {
        lines[j] = `          {activeTab === 'investments' && (\n${lines[j]}`;
        // Find closing div
        for (let k = i; k < i+3; k++) {
          if (lines[k] && lines[k].includes('</div>')) {
            lines[k] = lines[k] + '\n          )}';
            console.log('✅ Wrapped investment total');
            break;
          }
        }
        break;
      }
    }
    break;
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('\n✅ All investment content now only shows in investments tab');
