// Minimal xAI API test — log the full raw response

// Test 1: Basic request (no tools)
console.log('=== TEST 1: Basic request (no tools) ===');
const res1 = await fetch('https://api.x.ai/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'grok-4-1-fast',
    input: [{ role: 'user', content: 'Say hello' }],
  }),
});

console.log('Status:', res1.status);
console.log('Headers:', Object.fromEntries(res1.headers));
const text1 = await res1.text();
console.log('Body:', text1.substring(0, 3000));

// Test 2: With search tools (what production uses)
console.log('\n=== TEST 2: With web_search + x_search tools ===');
const res2 = await fetch('https://api.x.ai/v1/responses', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
  },
  body: JSON.stringify({
    model: 'grok-4-1-fast',
    input: [{ role: 'user', content: 'Search X for reviews of Blue Door Coffee in Canggu Bali. Return JSON: {"score":8,"summary":"..."}' }],
    tools: [
      { type: 'web_search' },
      { type: 'x_search' },
    ],
  }),
});

console.log('Status:', res2.status);
console.log('Headers:', Object.fromEntries(res2.headers));
const text2 = await res2.text();
console.log('Body:', text2.substring(0, 3000));
