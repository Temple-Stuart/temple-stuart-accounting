interface RobinhoodTransaction {
  symbol: string;
  strike: number | null;
  expiry: string | null;
  contractType: string | null;
  action: string;
  quantity: number;
  price: number;
  principal: number;
  fees: number;
  tranFee: number;
  contrFee: number;
  netAmount: number;
  tradeDate: string;
}

export function parseRobinhoodPDF(text: string): RobinhoodTransaction[] {
  const transactions: RobinhoodTransaction[] = [];
  
  console.log('🔎 DEBUG: Starting parse...');
  console.log('📄 Total text length:', text.length);
  
  // Split into lines
  const lines = text.split('\n').map(l => l.trim()).filter(l => l);
  console.log('📊 Total lines:', lines.length);
  
  // Find lines that contain key transaction markers
  const potentialLines = lines.filter(l => 
    (l.includes('CALL') || l.includes('PUT')) && 
    (l.includes('B ') || l.includes('S ') || l.includes('BTC') || l.includes('STO'))
  );
  
  console.log('🎯 Potential transaction lines:', potentialLines.length);
  potentialLines.slice(0, 3).forEach((line, idx) => {
    console.log(`Line ${idx}:`, line.substring(0, 150));
  });
  
  // Find the transaction table section
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Look for pattern - more flexible matching
    const match = line.match(/([A-Z]{2,5})\s+(\d{2}\/\d{2}\/\d{4})\s+(CALL|PUT)\s+\$?([\d.]+)\s+(B|S|BTC|STO)\s+(\d{2}\/\d{2}\/\d{4})/);
    
    if (match) {
      console.log('✅ MATCH FOUND:', line.substring(0, 100));
      const [_, symbol, expiry, contractType, strike, action, tradeDate] = match;
      
      // Continue parsing from this point to get remaining fields
      const remainingText = line.substring(match[0].length);
      const parts = remainingText.trim().split(/\s+/);
      
      console.log('📦 Remaining parts:', parts.slice(0, 10));
      
      // Expected: settleDate acctType price qty principal comm contrFee tranFee netAmount
      if (parts.length >= 9) {
        const price = parseFloat(parts[1].replace(/[$,]/g, ''));
        const quantity = parseInt(parts[2]);
        const principal = parseFloat(parts[3].replace(/[$,]/g, ''));
        const comm = parseFloat(parts[4].replace(/[$,]/g, ''));
        const contrFee = parseFloat(parts[5].replace(/[$,]/g, ''));
        const tranFee = parseFloat(parts[6].replace(/[$,]/g, ''));
        const netAmount = parseFloat(parts[7].replace(/[$,]/g, ''));
        
        transactions.push({
          symbol,
          strike: parseFloat(strike),
          expiry,
          contractType: contractType.toUpperCase(),
          action: action.toUpperCase(),
          quantity,
          price,
          principal,
          fees: comm + contrFee + tranFee,
          tranFee,
          contrFee,
          netAmount,
          tradeDate
        });
        
        console.log('💚 Transaction added:', symbol, action, quantity);
      } else {
        console.log('❌ Not enough parts:', parts.length);
      }
    }
  }
  
  console.log('✅ Total transactions parsed:', transactions.length);
  return transactions;
}
