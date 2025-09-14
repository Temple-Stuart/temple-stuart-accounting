const requiredVars = [
  'DATABASE_URL',
  'JWT_SECRET', 
  'PLAID_CLIENT_ID',
  'PLAID_SECRET',
  'PLAID_ENV'
];

requiredVars.forEach(varName => {
  console.log(`${varName}: ${process.env[varName] ? '✓ SET' : '✗ MISSING'}`);
});
