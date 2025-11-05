export function debugRobinhoodHistory(historyText: string) {
  const lines = historyText.split('\n');
  
  console.log('=== HISTORY DEBUG ===');
  console.log('Total lines:', lines.length);
  
  // Find filled spreads
  let filledCount = 0;
  let pendingCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === 'Filled') filledCount++;
    if (line === 'Pending' || line === 'Placed') pendingCount++;
  }
  
  console.log('Filled entries:', filledCount);
  console.log('Pending/Placed entries:', pendingCount);
  
  // Show first filled spread
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'Filled') {
      console.log('\nFirst filled spread starts at line', i - 10);
      console.log(lines.slice(i - 10, i + 30).join('\n'));
      break;
    }
  }
}
