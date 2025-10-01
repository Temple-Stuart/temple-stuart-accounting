const fs = require('fs');
const content = fs.readFileSync('src/components/dashboard/ImportDataSection.tsx', 'utf8');
const lines = content.split('\n');

// Find line 529 and fix the unclosed button
for (let i = 528; i < 531; i++) {
  if (lines[i] && lines[i].includes('setActiveTab(\'investments\')')) {
    // This button needs to be properly closed
    lines[i] = '            <button onClick={() => setActiveTab(\'investments\')} className={`px-6 py-3 font-medium ${activeTab === \'investments\' ? \'border-b-2 border-[#b4b237] text-[#b4b237]\' : \'text-gray-600\'}`}>';
    lines[i+1] = '              Investments ({investmentTransactions.length} uncommitted, {committedInvestments.length} committed)';
    lines[i+2] = '            </button>';
    lines[i+3] = '          </div>';
    lines[i+4] = '';
    break;
  }
}

fs.writeFileSync('src/components/dashboard/ImportDataSection.tsx', lines.join('\n'));
console.log('✅ Fixed button tag');
