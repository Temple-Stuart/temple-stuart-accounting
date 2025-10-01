const fs = require('fs');
const file = 'src/components/dashboard/ImportDataSection.tsx';
let content = fs.readFileSync(file, 'utf8');

// Find the investment section
const startMarker = '{activeTab === \'investments\' && (';
const startIndex = content.indexOf(startMarker);

// Find where the investment section ends (before the closing div)
const endMarker = '</div>\n          )}';
const searchFrom = startIndex + startMarker.length;
const endIndex = content.indexOf(endMarker, searchFrom) + endMarker.length;

// New investment section with Strategy dropdown
const newInvestmentSection = `{activeTab === 'investments' && (
            <>
              <div className="p-4 bg-gray-50 border-b flex justify-between">
                <span className="text-sm text-gray-600">
                  Total: {investmentTransactions.length} trades
                </span>
                <button className="px-4 py-1 bg-blue-600 text-white rounded text-sm">
                  Commit Selected COAs
                </button>
              </div>
              
              <div className="overflow-auto" style={{maxHeight: '600px'}}>
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left">Date</th>
                      <th className="px-2 py-2 text-left">Description</th>
                      <th className="px-2 py-2 text-left">Type</th>
                      <th className="px-2 py-2 text-right">Qty</th>
                      <th className="px-2 py-2 text-right">Price</th>
                      <th className="px-2 py-2 text-right">Amount</th>
                      <th className="px-2 py-2 text-left bg-yellow-50">Strategy</th>
                      <th className="px-2 py-2 text-left bg-yellow-50">COA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {investmentTransactions.map((txn: any) => (
                      <tr key={txn.id || txn.investment_transaction_id}>
                        <td className="px-2 py-2">{new Date(txn.date).toLocaleDateString()}</td>
                        <td className="px-2 py-2 text-xs">{txn.name}</td>
                        <td className="px-2 py-2">{txn.type}/{txn.subtype}</td>
                        <td className="px-2 py-2 text-right">{txn.quantity || '-'}</td>
                        <td className="px-2 py-2 text-right">${txn.price || 0}</td>
                        <td className="px-2 py-2 text-right">${Math.abs(txn.amount || 0).toFixed(2)}</td>
                        <td className="px-2 py-1 bg-yellow-50">
                          <select className="text-xs border rounded px-1 py-0.5 w-full">
                            <option value="">Select Strategy</option>
                            <optgroup label="Credit (Income)">
                              <option value="call-credit-spread">Call Credit Spread</option>
                              <option value="put-credit-spread">Put Credit Spread</option>
                              <option value="iron-condor">Iron Condor</option>
                              <option value="short-straddle">Short Straddle</option>
                              <option value="short-strangle">Short Strangle</option>
                              <option value="covered-call">Covered Call</option>
                              <option value="cash-secured-put">Cash Secured Put</option>
                              <option value="short-call">Naked Short Call</option>
                              <option value="short-put">Naked Short Put</option>
                            </optgroup>
                            <optgroup label="Debit (Investment)">
                              <option value="call-debit-spread">Call Debit Spread</option>
                              <option value="put-debit-spread">Put Debit Spread</option>
                              <option value="long-straddle">Long Straddle</option>
                              <option value="long-strangle">Long Strangle</option>
                              <option value="long-call">Long Call</option>
                              <option value="long-put">Long Put</option>
                              <option value="butterfly">Butterfly</option>
                              <option value="calendar">Calendar Spread</option>
                              <option value="diagonal">Diagonal Spread</option>
                            </optgroup>
                            <optgroup label="Stock">
                              <option value="buy-stock">Buy Stock</option>
                              <option value="sell-stock">Sell Stock</option>
                              <option value="dividend">Dividend</option>
                            </optgroup>
                            <optgroup label="Adjustments">
                              <option value="roll">Roll Position</option>
                              <option value="close">Close Position</option>
                              <option value="assignment">Assignment</option>
                              <option value="exercise">Exercise</option>
                            </optgroup>
                          </select>
                        </td>
                        <td className="px-2 py-1 bg-yellow-50">
                          <select className="text-xs border rounded px-1 py-0.5 w-20">
                            <option value="">Select</option>
                            <optgroup label="Income">
                              <option value="4120">4120 - Premium</option>
                              <option value="4110">4110 - Divs</option>
                              <option value="4130">4130 - Gains</option>
                            </optgroup>
                            <optgroup label="Assets">
                              <option value="1500">1500 - Options</option>
                              <option value="1510">1510 - Stock</option>
                            </optgroup>
                            <optgroup label="Losses">
                              <option value="4140">4140 - Losses</option>
                            </optgroup>
                            <optgroup label="Expenses">
                              <option value="6650">6650 - Fees</option>
                              <option value="6660">6660 - Interest</option>
                            </optgroup>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="p-4 bg-gray-50 text-sm">
                  Total Investment Transactions: {investmentTransactions.length}
                </div>
              </div>
            </>
          )}`;

// Replace the section
content = content.substring(0, startIndex) + newInvestmentSection + content.substring(endIndex);

fs.writeFileSync(file, content);
console.log('Investment tab updated with Strategy dropdowns!');
