const fs = require('fs');
const file = 'src/components/dashboard/ImportDataSection.tsx';
const content = fs.readFileSync(file, 'utf8');

// Find the investment section
const startMarker = "activeTab === 'investments'";
const startIndex = content.indexOf(startMarker);

if (startIndex === -1) {
  console.log("ERROR: Could not find investment tab section");
} else {
  // Get 50 characters before and 500 after to see context
  const snippet = content.substring(startIndex - 50, startIndex + 500);
  console.log("Found investment section at position:", startIndex);
  console.log("\nHere's what's there:");
  console.log("================");
  console.log(snippet);
  console.log("================");
}
