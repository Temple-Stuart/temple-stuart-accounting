const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const transactions = await prisma.investment_transactions.findMany({
    where: { tradeNum: { not: null } },
    orderBy: { tradeNum: 'asc' }
  });
  
  const trades = {};
  
  for (const txn of transactions) {
    if (!trades[txn.tradeNum]) {
      trades[txn.tradeNum] = { pl: 0, symbol: txn.symbol || 'N/A', count: 0 };
    }
    trades[txn.tradeNum].pl += Number(txn.amount) * -1 * 100;
    trades[txn.tradeNum].count++;
  }
  
  console.log('Trade# | Symbol | Txns | P/L');
  console.log('='.repeat(50));
  
  const sorted = Object.entries(trades).sort((a,b) => parseInt(a[0]) - parseInt(b[0]));
  
  for (const [num, trade] of sorted.slice(0, 30)) {
    const symbol = (trade.symbol || 'N/A').padEnd(6);
    console.log(num.padStart(3) + ' | ' + symbol + ' | ' + trade.count.toString().padStart(4) + ' | $' + trade.pl.toFixed(2));
  }
  
  await prisma.$disconnect();
})();
