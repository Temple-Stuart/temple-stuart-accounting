const fs = require('fs');
const file = 'src/components/dashboard/ImportDataSection.tsx';
let content = fs.readFileSync(file, 'utf8');

// Find the header row and add Strategy column
const oldHeader = `                    <th className="px-2 py-2 text-right">Fees</th>
                    <th className="px-2 py-2 text-left bg-yellow-50">COA</th>`;

const newHeader = `                    <th className="px-2 py-2 text-right">Fees</th>
                    <th className="px-2 py-2 text-left bg-yellow-50">Strategy</th>
                    <th className="px-2 py-2 text-left bg-yellow-50">COA</th>`;

content = content.replace(oldHeader, newHeader);

// Find the investment tbody section
const findStr = "investmentTransactions.map((txn: any) => (";
const mapIndex = content.indexOf(findStr);

// Find where we currently have the COA select in investment rows
const oldCOASection = `                      <td className="px-2 py-2 text-right">\${txn.fees || 0}</td>
                      <td className="px-2 py-1 bg-yellow-50">
                        <select className="text-xs border rounded px-1 py-0.5 w-20">`;

const newCOASection = `                      <td className="px-2 py-2 text-right">\${txn.fees || 0}</td>
                      <td className="px-2 py-1 bg-yellow-50">
                        <select className="text-xs border rounded px-1 py-0.5 w-24">
                          <option value="">Select</option>
                          <optgroup label="Credit Spreads">
                            <option value="call-credit">Call Credit</option>
                            <option value="put-credit">Put Credit</option>
                            <option value="iron-condor">Iron Condor</option>
                          </optgroup>
                          <optgroup label="Debit Spreads">
                            <option value="call-debit">Call Debit</option>
                            <option value="put-debit">Put Debit</option>
                          </optgroup>
                          <optgroup label="Volatility">
                            <option value="straddle">Straddle</option>
                            <option value="strangle">Strangle</option>
                          </optgroup>
                          <optgroup label="Single Options">
                            <option value="long-call">Long Call</option>
                            <option value="long-put">Long Put</option>
                            <option value="short-call">Short Call</option>
                            <option value="short-put">Short Put</option>
                            <option value="covered-call">Covered Call</option>
                            <option value="csp">Cash Secured Put</option>
                          </optgroup>
                          <optgroup label="Stock">
                            <option value="buy">Buy Stock</option>
                            <option value="sell">Sell Stock</option>
                          </optgroup>
                        </select>
                      </td>
                      <td className="px-2 py-1 bg-yellow-50">
                        <select className="text-xs border rounded px-1 py-0.5 w-20">`;

content = content.replace(oldCOASection, newCOASection);

fs.writeFileSync(file, content);
console.log('Strategy dropdown added to investment table!');
