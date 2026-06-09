#!/usr/bin/env node
/**
 * assert-showroom-fetch-free — LAYER 1 of the public-Showroom guardrail (PR10).
 *
 * WHY: ProjectsPipelineShowroom renders on the PUBLIC home page ("/", a client
 * component with no server-data access; "/" is in middleware PUBLIC_PATHS). It
 * must NEVER fetch or reach server data logged-out — that would leak data or
 * fire a paid AI call to anonymous visitors. The whole point of the PR5–PR9
 * pure-view + slot refactors was to make the subtree provably fetch-free.
 *
 * This check fails the BUILD (it is wired into the `build` script, so it runs in
 * CI / Vercel) if any showroom-subtree render file regains a fetch, a data-loading
 * hook, an "/api/" string, or an import of a live self-fetching container. It is a
 * plain Node script — no test runner or extra dependency required.
 *
 * Run standalone:  node scripts/assert-showroom-fetch-free.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = 'src/components/workbench/operations/projects';

// The subtree that renders on the public page. EXPLICIT list — every file here
// must stay fetch-free. (The Layer-2 runtime guard lives in src/lib and is
// intentionally NOT in this list.)
const SUBTREE_FILES = [
  `${BASE}/showroom/ProjectsPipelineShowroom.tsx`,
  `${BASE}/showroom/demoData.ts`,
  `${BASE}/showroom/narrativeCopy.ts`,
  `${BASE}/ProjectRowView.tsx`,
  `${BASE}/TaskListView.tsx`,
  `${BASE}/EvolutionTimelineView.tsx`,
  `${BASE}/DependencyListView.tsx`,
  `${BASE}/TaskRowView.tsx`,
];

// Forbidden patterns. Each is a real data-access or live-container signal. The
// "/api/" and container-import patterns are anchored on a quote so prose in doc
// comments (e.g. "no /api/* call") never trips them.
const FORBIDDEN = [
  { name: 'fetch() call', re: /\bfetch\s*\(/ },
  { name: 'useSWR', re: /\buseSWR\b/ },
  { name: 'useEffect', re: /\buseEffect\s*\(/ },
  { name: 'useOperationsEntity', re: /\buseOperationsEntity\s*\(/ },
  { name: "'/api/' path string", re: /['"`]\/api\// },
  {
    name: 'live container import (TaskList/EvolutionTimeline/DependencyList/ProjectRow/TaskRow)',
    re: /from\s+['"][^'"]*\/(TaskList|EvolutionTimeline|DependencyList|ProjectRow|TaskRow)['"]/,
  },
];

const violations = [];

for (const rel of SUBTREE_FILES) {
  const abs = resolve(ROOT, rel);
  let src;
  try {
    src = readFileSync(abs, 'utf8');
  } catch {
    // A missing subtree file is itself a failure — the guardrail must know its
    // exact surface. Fail loud rather than silently skipping.
    violations.push(`${rel}: MISSING (subtree file not found — update the guardrail list)`);
    continue;
  }
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    for (const { name, re } of FORBIDDEN) {
      if (re.test(line)) {
        violations.push(`${rel}:${i + 1}  [${name}]  ${line.trim()}`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error('\n✖ Showroom fetch-free guardrail FAILED — the public Projects');
  console.error('  pipe must never fetch or reach server data. Offending lines:\n');
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    '\n  Fix: keep the subtree on pure views + slots. Live data belongs in the' +
      '\n  authed containers, never in these files. See PR5–PR10.\n'
  );
  process.exit(1);
}

console.log(`✔ Showroom fetch-free guardrail passed — ${SUBTREE_FILES.length} subtree files clean.`);
