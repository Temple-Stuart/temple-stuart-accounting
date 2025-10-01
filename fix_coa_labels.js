const fs = require('fs');
const file = 'src/components/dashboard/ImportDataSection.tsx';
let content = fs.readFileSync(file, 'utf8');

// Fix the investment tab COA dropdown
const oldInvestmentCOA = `                      <td className="px-2 py-1 bg-yellow-50">
                        <select className="text-xs border rounded px-1 py-0.5 w-20">
                          <option value="">-</option>
                          <option value="1500">1500</option>
                          <option value="4120">4120</option>
                          <option value="4130">4130</option>
                        </select>`;

const newInvestmentCOA = `                      <td className="px-2 py-1 bg-yellow-50">
                        <select className="text-xs border rounded px-1 py-0.5 w-full">
                          <option value="">Select COA</option>
                          <optgroup label="Income">
                            <option value="4120">4120 - Options Premium</option>
                            <option value="4110">4110 - Dividends</option>
                            <option value="4130">4130 - Capital Gains</option>
                            <option value="4140">4140 - Capital Losses</option>
                          </optgroup>
                          <optgroup label="Assets">
                            <option value="1500">1500 - Options Positions</option>
                            <option value="1510">1510 - Stock Holdings</option>
                          </optgroup>
                          <optgroup label="Expenses">
                            <option value="6650">6650 - Trading Fees</option>
                            <option value="6660">6660 - Margin Interest</option>
                          </optgroup>
                        </select>`;

content = content.replace(oldInvestmentCOA, newInvestmentCOA);

// Also update column widths in header to accommodate longer text
content = content.replace(
  '<th className="px-2 py-2 text-left bg-yellow-50">Strategy</th>',
  '<th className="px-2 py-2 text-left bg-yellow-50 min-w-[120px]">Strategy</th>'
);

content = content.replace(
  '<th className="px-2 py-2 text-left bg-yellow-50">COA</th>',
  '<th className="px-2 py-2 text-left bg-yellow-50 min-w-[180px]">COA</th>'
);

// Fix spending tab row COA dropdown width
content = content.replace(
  /className="text-xs border rounded px-1 py-0\.5 w-20">/g,
  'className="text-xs border rounded px-1 py-0.5 w-full">'
);

fs.writeFileSync(file, content);
console.log('COA dropdowns updated with full text labels!');
