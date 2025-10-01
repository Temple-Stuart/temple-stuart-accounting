const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

console.log('Fixing symbol definition...\n');

// Find the investment map function
for (let i = 780; i < 800; i++) {
  if (!lines[i]) continue;
  
  if (lines[i].includes('investmentTransactions.map((txn: any)')) {
    console.log(`Found map at line ${i+1}`);
    
    // Check if symbol is already defined
    let symbolDefined = false;
    for (let j = i; j < i+10; j++) {
      if (lines[j] && lines[j].includes('let symbol') || lines[j] && lines[j].includes('const symbol')) {
        symbolDefined = true;
        break;
      }
    }
    
    if (!symbolDefined) {
      // Add symbol extraction right after the map starts
      if (lines[i].includes('=>')) {
        // Check what comes after =>
        if (lines[i].includes('=> (')) {
          // Direct return - need to convert to block
          lines[i] = lines[i].replace('=> (', '=> {');
          
          // Add symbol extraction
          const symbolCode = `                    const txnId = txn.id || txn.investment_transaction_id;
                    let symbol = '-';
                    const nameParts = txn.name?.split(' ') || [];
                    for (let k = 0; k < nameParts.length; k++) {
                      if (nameParts[k].match(/^[A-Z]+$/)) {
                        symbol = nameParts[k];
                        break;
                      }
                    }
                    return (`;
          
          lines.splice(i+1, 0, symbolCode);
          console.log('Added symbol extraction');
          
          // Find and fix the closing
          for (let j = i+50; j < i+100; j++) {
            if (lines[j] && lines[j].includes('))}')) {
              lines[j] = '                    );\n                  })}';
              console.log(`Fixed closing at line ${j+1}`);
              break;
            }
          }
        }
      }
    } else {
      console.log('Symbol already defined');
    }
    break;
  }
}

// Also ensure ticker_symbol references are replaced with symbol
for (let i = 790; i < 800; i++) {
  if (lines[i] && lines[i].includes('txn.security?.ticker_symbol')) {
    lines[i] = lines[i].replace('txn.security?.ticker_symbol || \'-\'', 'symbol');
    console.log(`Replaced ticker_symbol reference at line ${i+1}`);
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('\n✅ Symbol definition fixed');
