const axios = require('axios');

(async () => {
  console.log('🧪 Testing API with full error details...\n');
  
  try {
    const response = await axios.post('http://localhost:3000/api/investment-transactions/commit-to-ledger', {
      transactionIds: ['inv_1761116098052_stnkqu9jm'],
      strategy: 'Bear Call Spread',
      tradeNum: 'TEST_1'
    }, {
      timeout: 5000,
      validateStatus: () => true // Accept any status
    });
    
    console.log('Status:', response.status);
    console.log('Data:', JSON.stringify(response.data, null, 2));
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error('❌ Server not running! Start with: npm run dev');
    } else {
      console.error('❌ Error:', error.message);
      console.error('Full error:', error);
    }
  }
})();
