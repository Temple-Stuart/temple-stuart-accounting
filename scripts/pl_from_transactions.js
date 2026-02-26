const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  console.log('🎯 P&L Direct from Transactions\n');
  
  const transactions = await prisma.investment_transactions.findMany({
    where: { 
      tradeNum: { not: null }
    },
    orderBy: { tradeNum: 'asc' }
  });
  
  const trades = {};
  
  for (const txn of transactions) {
    const tradeNum = txn.tradeNum;
    
    if (!trades[tradeNum]) {
      trades[tradeNum] = { 
        pl: 0, 
        symbol: txn.symbol, 
        date: txn.transaction_date,
        count: 0
      };
    }
    
    trades[tradeNum].pl += Number(txn.amount) * -1 * 100;
    trades[tradeNum].count++;
  }
  
  console.log('Trade# | Symbol | Date | Txns | P&L');
  console.log('='.repeat(60));
  
  const sorted = Object.entries(trades).sort((a,b) => parseInt(a[0]) - parseInt(b[0]));
  
  for (const [num, trade] of sorted.slice(0, 30)) {
    const date = trade.date ? trade.date.toISOString().split('T')[0] : 'N/A';
    console.log(\`\${num.padStart(3)} | \${trade.symbol.padEnd(6)} | \${date} | \${String(trade.count).padStart(4)} | $\${trade.pl.toFixed(2)}\`);
  }
  
  console.log('='.repeat(60));
  
  await prisma.$disconnect();
})();
