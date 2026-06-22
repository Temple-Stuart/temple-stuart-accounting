// THROWAWAY DISCOVERY — run: VIATOR test, then DELETE this file.
//   Command:  npx tsx scripts/discover-viator-tags.ts            (default city: Lisbon)
//             npx tsx scripts/discover-viator-tags.ts "Bali"     (override the test city)
//
// PURPOSE (read-only investigation, NOT a feature): learn the REAL Viator
// "Transfers & Ground Transport" tag id from the live tags endpoint and PROVE that
// searchV2Products(destId, n, [TAG]) returns actual transfer products — so the
// ground-transit build can be scoped from a VERIFIED tag id, not a guess. This file
// is throwaway; it adds no route, touches no app code, and is deleted after the run.
//
// It mirrors src/lib/viatorClient.ts EXACTLY so auth/base/version match the app:
//   - VIATOR_V2_BASE = 'https://api.viator.com/partner'        (viatorClient.ts:12)
//   - v2Headers: exp-api-key + Accept: application/json;version=2.0 (viatorClient.ts:21-27)
//   - /destinations GET           (viatorClient.ts:84)
//   - /products/search POST body  (viatorClient.ts:250-257) + filtering.tags (:258-259)
//
// Reads the SAME env var the app uses: VIATOR_API_KEY. NEVER prints the key.
// NO FALLBACK: if the key is missing or a call fails, it STOPS and prints the real
// error — it never fabricates a tag id or substitutes sample data.

const VIATOR_V2_BASE = 'https://api.viator.com/partner';
const KEYWORDS = ['transfer', 'transport', 'ground', 'shuttle', 'airport'];

function getApiKey(): string {
  const key = process.env.VIATOR_API_KEY;
  if (!key) {
    console.error(
      '\n[STOP] VIATOR_API_KEY is not set in this environment.\n' +
      'This script CANNOT run without the key, and it will NOT guess a tag id.\n' +
      'Run it where the key is available, e.g.:\n' +
      '  VIATOR_API_KEY=*** npx tsx scripts/discover-viator-tags.ts "Lisbon"\n'
    );
    process.exit(1);
  }
  return key;
}

function v2Headers(): Record<string, string> {
  return {
    'Accept-Language': 'en-US',
    'Content-Type': 'application/json',
    'Accept': 'application/json;version=2.0',
    'exp-api-key': getApiKey(), // never logged
  };
}

// Defensive array extraction (the freetext response was a non-array wrapper — see
// the freetext parse fix). Try plausible locations; return the first real array.
function firstArray(obj: any, paths: string[]): any[] {
  for (const p of paths) {
    const v = p.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
    if (Array.isArray(v)) return v;
  }
  return [];
}

// Viator V2 tag names live under a locale map; try the documented shapes.
function tagName(t: any): string {
  return (
    t?.allNamesByLocale?.en ||
    t?.nameByLocale?.en ||
    t?.name ||
    (Array.isArray(t?.names) ? t.names[0]?.name : undefined) ||
    JSON.stringify(t).slice(0, 120)
  );
}

async function getJson(url: string, init: RequestInit): Promise<{ status: number; data: any }> {
  const res = await fetch(url, init);
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

async function main() {
  const testCity = (process.argv[2] || 'Lisbon').trim();
  console.log(`\n=== Viator transfers tag discovery — test city: "${testCity}" ===\n`);

  // ── STEP A: the tags taxonomy ────────────────────────────────────────────
  console.log('STEP A — GET /partner/products/tags');
  const tagsRes = await getJson(`${VIATOR_V2_BASE}/products/tags`, { method: 'GET', headers: v2Headers() });
  if (tagsRes.status !== 200) {
    console.error(`[STOP] tags endpoint returned ${tagsRes.status}. Raw (truncated):`,
      JSON.stringify(tagsRes.data).slice(0, 400));
    process.exit(1);
  }
  const tags = firstArray(tagsRes.data, ['tags', 'data', 'data.tags']);
  console.log(`  response top-level keys: ${tagsRes.data && typeof tagsRes.data === 'object' ? Object.keys(tagsRes.data).join(',') : typeof tagsRes.data}`);
  console.log(`  total tags returned: ${tags.length}`);
  if (tags.length === 0) {
    console.error('[STOP] No tags array found — inspect the raw shape (truncated):',
      JSON.stringify(tagsRes.data).slice(0, 500));
    process.exit(1);
  }

  const matches = tags.filter((t) => {
    const n = String(tagName(t)).toLowerCase();
    return KEYWORDS.some((k) => n.includes(k));
  });
  console.log(`\n  TRANSFER/TRANSPORT TAG MATCHES (${matches.length}):`);
  for (const t of matches) {
    console.log(`    tagId=${t.tagId ?? t.id ?? '?'}  name="${tagName(t)}"`);
  }
  if (matches.length === 0) {
    console.error('\n[STOP] No tag name matched transfer/transport/ground/shuttle/airport.\n' +
      'Print a sample of tag names to inspect the taxonomy:');
    console.log('  sample names:', tags.slice(0, 20).map(tagName));
    process.exit(1);
  }

  // ── STEP B: resolve the test destination → destId ────────────────────────
  console.log('\nSTEP B — GET /partner/destinations → resolve city → destId');
  const destRes = await getJson(`${VIATOR_V2_BASE}/destinations`, { method: 'GET', headers: v2Headers() });
  if (destRes.status !== 200) {
    console.error(`[STOP] destinations returned ${destRes.status}.`, JSON.stringify(destRes.data).slice(0, 300));
    process.exit(1);
  }
  const dests = firstArray(destRes.data, ['destinations', 'data']);
  const cityLower = testCity.toLowerCase();
  const dest =
    dests.find((d) => typeof d?.destinationName === 'string' && d.destinationName.toLowerCase() === cityLower && d.destinationType === 'CITY') ||
    dests.find((d) => typeof d?.destinationName === 'string' && d.destinationName.toLowerCase().includes(cityLower) && d.destinationType === 'CITY') ||
    dests.find((d) => typeof d?.destinationName === 'string' && d.destinationName.toLowerCase().includes(cityLower));
  if (!dest) {
    console.error(`[STOP] No destination match for "${testCity}". Try another city arg.`);
    process.exit(1);
  }
  const destId: number = dest.destinationId;
  console.log(`  matched "${testCity}" → destId=${destId} (${dest.destinationName}, ${dest.destinationType})`);

  // ── STEP C: PROVE transfer products come back for each matched tag ────────
  console.log('\nSTEP C — POST /partner/products/search filtered by each transfer tag');
  for (const t of matches) {
    const tagId = t.tagId ?? t.id;
    const body = {
      filtering: { destination: String(destId), tags: [tagId] }, // mirrors viatorClient.ts:252,258-259
      sorting: { sort: 'DEFAULT' },
      pagination: { start: 1, count: 10 },
      currency: 'USD',
    };
    const sr = await getJson(`${VIATOR_V2_BASE}/products/search`, {
      method: 'POST', headers: v2Headers(), body: JSON.stringify(body),
    });
    const products = firstArray(sr.data, ['products', 'data', 'products.results']);
    console.log(`\n  tagId=${tagId} ("${tagName(t)}") → status=${sr.status}, products=${products.length}`);
    for (const p of products.slice(0, 3)) {
      console.log(`     • ${p.title ?? p.productCode ?? JSON.stringify(p).slice(0, 80)}`);
    }
    if (products.length === 0 && sr.status !== 200) {
      console.log(`     (non-200 — raw truncated: ${JSON.stringify(sr.data).slice(0, 200)})`);
    }
  }

  console.log('\n=== DONE. Use the tagId whose products are clearly airport/ground transfers. ===');
  console.log('=== Then DELETE this throwaway script. ===\n');
}

main().catch((e) => {
  console.error('[STOP] Unhandled error (real failure, not fabricated):', e?.message || e);
  process.exit(1);
});
