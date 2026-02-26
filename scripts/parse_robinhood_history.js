const fs = require('fs');

const history = fs.readFileSync('robinhood_history.txt', 'utf-8');

const lines = history.split('\n');
let tradeNum = 1;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];

  if (line.includes('Call Credit Spread') || line.includes('Put Credit Spread') ||
      line.includes('Call Debit Spread') || line.includes('Put Debit Spread') ||
      line.includes('Iron Condor')) {

    const symbol = line.split(' ')[0];
    const strategy = line.match(/(Call Credit Spread|Put Credit Spread|Call Debit Spread|Put Debit Spread|Iron Condor)/)[0];

    const date = lines[i+1].trim();

    let j = i;
    while (j < i + 50 && !lines[j].includes('Status')) j++;

    if (lines[j+1] && lines[j+1].includes('Filled')) {
      console.log('Trade ' + tradeNum + ': ' + date + ' ' + symbol + ' ' + strategy);
      tradeNum++;
    }
  }
}
