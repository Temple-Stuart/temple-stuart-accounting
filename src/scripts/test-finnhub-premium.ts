/**
 * One-time verification script: does our Finnhub API key ($550/mo Package 1)
 * actually have access to premium endpoints?
 *
 * Tests 3 premium endpoints + 1 free endpoint for AAPL:
 *   - /stock/eps-estimate      (premium)
 *   - /stock/revenue-estimate  (premium)
 *   - /stock/price-target      (premium)
 *   - /stock/metric            (free — confirms 52WeekHigh data for Phase 1B)
 *
 * Usage: npx tsx src/scripts/test-finnhub-premium.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Load API key: process.env first, then .env.local fallback
// ---------------------------------------------------------------------------
function loadApiKey(): string | null {
  if (process.env.FINNHUB_API_KEY) return process.env.FINNHUB_API_KEY;

  // Try .env.local (Next.js convention)
  for (const name of ['.env.local', '.env']) {
    try {
      const text = readFileSync(resolve(process.cwd(), name), 'utf-8');
      const match = text.match(/^FINNHUB_API_KEY=["']?([^"'\r\n]+)["']?/m);
      if (match?.[1]) return match[1];
    } catch { /* file not found, continue */ }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Fetch helper with timeout
// ---------------------------------------------------------------------------
async function probe(label: string, url: string): Promise<void> {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${label}`);
  console.log(`  ${url.replace(/token=[^&]+/, 'token=***')}`);
  console.log('='.repeat(70));

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    const text = await res.text();
    let parsed: unknown;
    try { parsed = JSON.parse(text); } catch { parsed = null; }

    console.log(`  HTTP status : ${res.status} ${res.statusText}`);
    console.log(`  Content-Type: ${res.headers.get('content-type')}`);

    // Check for empty / error responses
    const isEmpty = !text || text === '{}' || text === '[]' || text === 'null';
    const isError = typeof parsed === 'object' && parsed !== null && 'error' in parsed;
    const hasData = !isEmpty && !isError;
    console.log(`  Has data    : ${hasData ? 'YES' : 'NO'}${isError ? ` (error: ${(parsed as { error: string }).error})` : ''}${isEmpty ? ' (empty response)' : ''}`);

    // Field names
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const keys = Object.keys(parsed as Record<string, unknown>);
      console.log(`  Top-level fields (${keys.length}): ${keys.join(', ')}`);

      // For nested objects, show one level deeper
      for (const k of keys) {
        const v = (parsed as Record<string, unknown>)[k];
        if (Array.isArray(v)) {
          console.log(`    ${k}: Array[${v.length}]${v.length > 0 ? ` — first item keys: ${Object.keys(v[0] as object).join(', ')}` : ''}`);
        } else if (v && typeof v === 'object') {
          const subKeys = Object.keys(v as object);
          console.log(`    ${k}: Object(${subKeys.length} fields)${subKeys.length <= 20 ? ` — ${subKeys.join(', ')}` : ''}`);
        }
      }
    } else if (Array.isArray(parsed)) {
      console.log(`  Response is Array[${parsed.length}]${parsed.length > 0 ? ` — first item keys: ${Object.keys(parsed[0] as object).join(', ')}` : ''}`);
    }

    // First 500 chars of raw body
    console.log(`  Body (first 500 chars):`);
    console.log(`  ${text.slice(0, 500)}`);
  } catch (err) {
    console.log(`  FETCH ERROR: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  Finnhub Premium Endpoint Verification                     ║');
  console.log('║  Package 1 ($550/mo) — testing AAPL                        ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');

  const key = loadApiKey();
  if (!key) {
    console.error('\n  FINNHUB_API_KEY not found in env or .env.local / .env');
    console.error('  Set it via: export FINNHUB_API_KEY=your_key');
    process.exit(1);
  }
  console.log(`\n  API key loaded: ${key.slice(0, 4)}...${key.slice(-4)} (${key.length} chars)`);

  const base = 'https://finnhub.io/api/v1';
  const symbol = 'AAPL';

  // Premium endpoints
  await probe(
    '1. EPS Estimate (PREMIUM)',
    `${base}/stock/eps-estimate?symbol=${symbol}&freq=quarterly&token=${key}`,
  );

  await probe(
    '2. Revenue Estimate (PREMIUM)',
    `${base}/stock/revenue-estimate?symbol=${symbol}&freq=quarterly&token=${key}`,
  );

  await probe(
    '3. Price Target (PREMIUM)',
    `${base}/stock/price-target?symbol=${symbol}&token=${key}`,
  );

  // Free endpoint — confirm 52WeekHigh exists
  await probe(
    '4. Basic Financials / Metric (FREE — confirming 52WeekHigh)',
    `${base}/stock/metric?symbol=${symbol}&metric=all&token=${key}`,
  );

  // Summary for the free endpoint
  console.log(`\n${'='.repeat(70)}`);
  console.log('  SUMMARY — 52WeekHigh check');
  console.log('='.repeat(70));
  try {
    const res = await fetch(`${base}/stock/metric?symbol=${symbol}&metric=all&token=${key}`);
    const data = await res.json() as { metric?: Record<string, unknown> };
    const metric = data?.metric;
    if (metric) {
      const has52High = '52WeekHigh' in metric;
      const has52Low = '52WeekLow' in metric;
      console.log(`  52WeekHigh present: ${has52High ? 'YES' : 'NO'}${has52High ? ` (value: ${metric['52WeekHigh']})` : ''}`);
      console.log(`  52WeekLow  present: ${has52Low ? 'YES' : 'NO'}${has52Low ? ` (value: ${metric['52WeekLow']})` : ''}`);
      console.log(`  Total metric fields: ${Object.keys(metric).length}`);
    } else {
      console.log('  metric object missing from response');
    }
  } catch (err) {
    console.log(`  Error: ${err instanceof Error ? err.message : String(err)}`);
  }

  console.log('\nDone.\n');
}

main();
