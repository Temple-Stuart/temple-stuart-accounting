function classifyOptionsStrategy(transactions) {
  // Group by security_id and date to identify spreads
  const groupedTrades = {};
  
  transactions.forEach(txn => {
    const key = `${txn.security_id}_${txn.date}`;
    if (!groupedTrades[key]) groupedTrades[key] = [];
    groupedTrades[key].push(txn);
  });
  
  return transactions.map(txn => {
    const security = txn.security_id;
    const name = txn.name.toLowerCase();
    const type = txn.type; // buy/sell
    const subtype = txn.subtype;
    
    // Identify option type from name
    let optionType = 'stock';
    if (name.includes('put')) optionType = 'put';
    if (name.includes('call')) optionType = 'call';
    
    // Identify strategy based on patterns
    let strategy = 'single';
    
    // Check for spreads (multiple transactions on same underlying)
    const sameUnderlying = transactions.filter(t => 
      t.name.includes(name.split(' ')[0]) && // Same underlying
      t.date === txn.date &&
      t.id !== txn.id
    );
    
    if (sameUnderlying.length > 0) {
      if (optionType === 'put' && name.includes('open')) strategy = 'bull put spread';
      if (optionType === 'call' && name.includes('open')) strategy = 'bear call spread';
      if (sameUnderlying.some(t => t.name.includes('put')) && 
          sameUnderlying.some(t => t.name.includes('call'))) {
        strategy = 'iron condor';
      }
    } else {
      if (type === 'sell' && name.includes('open')) {
        strategy = optionType === 'put' ? 'naked put' : 'covered call';
      } else if (type === 'buy' && name.includes('open')) {
        strategy = optionType === 'put' ? 'long put' : 'long call';
      }
    }
    
    return {
      ...txn,
      optionType,
      strategy,
      underlying: name.split(' ')[0].toUpperCase()
    };
  });
}
