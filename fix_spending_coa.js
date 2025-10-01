const fs = require('fs');
const file = 'src/components/dashboard/ImportDataSection.tsx';
let content = fs.readFileSync(file, 'utf8');

// Find and replace the spending tab COA dropdown (in row changes section)
// This is where individual rows get COA assigned
const oldPattern = `                            {coaOptions.map(group => (
                              <optgroup key={group.group} label={group.group}>
                                {group.options.map(opt => (
                                  <option key={opt.code} value={opt.code}>{opt.code}</option>
                                ))}
                              </optgroup>
                            ))}`;

const newPattern = `                            {coaOptions.map(group => (
                              <optgroup key={group.group} label={group.group}>
                                {group.options.map(opt => (
                                  <option key={opt.code} value={opt.code}>{opt.code} - {opt.name}</option>
                                ))}
                              </optgroup>
                            ))}`;

// Replace all occurrences
content = content.replace(oldPattern, newPattern);

// Also fix the column header width for COA in spending tab
content = content.replace(
  '<th className="px-2 py-2 text-left bg-yellow-50">COA</th>',
  '<th className="px-2 py-2 text-left bg-yellow-50 min-w-[180px]">COA</th>'
);

// Make sure spending tab COA select is wide enough
content = content.replace(
  'className="text-xs border rounded px-1 py-0.5 w-20">',
  'className="text-xs border rounded px-1 py-0.5 w-full">'
);

fs.writeFileSync(file, content);
console.log('Spending tab COA labels fixed!');
