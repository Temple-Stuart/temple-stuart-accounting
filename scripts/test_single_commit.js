const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const axios = require('axios');
const fs = require('fs');

(async () => {
  console.log('🧪 Testing single trade commit...\n');
  
  const csv = fs.readFileSync('trade_review_irs_compliant.csv', 'utf-8');
  const lines = csv.split('\n').slice(1);
  
  // Find first valid open trade
  for (const line of lines) {
    if (!line.trim() || line.startsWith('NON_OPT')) continue;
    const parts = line.split(',');
    const strategy = parts[3].replace(/"/g, '');
    const match = parts[13];
    
    if (match === 'YES' && !strategy.toLowerCase().includes('closing')) {
      const plaidId = parts[12];
      console.log('Attempting to commit:', parts[0], '-', strategy);
      console.log('Plaid ID:', plaidId);
      
      try {
        const response = await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
          transactionIds: [plaidId],
          strategy: strategy,
          tradeNum: 'TEST_1'
        });
        console.log('✅ SUCCESS:', response.data);
      } catch (error) {
        console.error('❌ FULL ERROR:');
        console.error(error.response?.data || error.message);
      }
      break;
    }
  }
  
  await prisma.$disconnect();
})();
