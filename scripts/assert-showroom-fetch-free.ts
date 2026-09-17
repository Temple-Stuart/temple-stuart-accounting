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
 * TEST-TRUTH-01 (2026-09-17): this was a .mjs reading each file RAW, and the
 * FORBIDDEN patterns carried hand-tuned quote anchors "so prose in doc comments
 * (e.g. \"no /api/* call\") never trips them" — a workaround for reading
 * comments as if they were code. It is a .ts now so it can use the one reader
 * every test and law uses, and it reads code(). The anchors stay (they are also
 * what keeps a *View import from matching its live container), but they are no
 * longer load-bearing against prose: a comment cannot trip this law at all.
 *
 * Run standalone:  npx tsx scripts/assert-showroom-fetch-free.ts
 */

import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { code as codeOf } from '../src/lib/sourceText';

const ROOT = resolve(__dirname, '..');
const BASE = 'src/components/workbench/operations/projects';
const OPS = 'src/components/workbench/operations';

// The subtree that renders on the public page. EXPLICIT list — every file here
// must stay fetch-free. (The Layer-2 runtime guard lives in src/lib and is
// intentionally NOT in this list.)
const SUBTREE_FILES = [
  // PR E wrapper — the full 3-panel Operations story root.
  `${OPS}/showroom/OperationsPipelineShowroom.tsx`,
  // Projects pipe (PR5–PR9).
  `${BASE}/showroom/ProjectsPipelineShowroom.tsx`,
  `${BASE}/showroom/demoData.ts`,
  `${BASE}/showroom/narrativeCopy.ts`,
  `${BASE}/ProjectRowView.tsx`,
  `${BASE}/TaskListView.tsx`,
  `${BASE}/EvolutionTimelineView.tsx`,
  `${BASE}/DependencyListView.tsx`,
  `${BASE}/TaskRowView.tsx`,
  // Day + Script panels (PR B/C views, PR D seed) — now public via PR E.
  `${OPS}/content/DayCalendarView.tsx`,
  `${OPS}/content/ScriptGeneratorView.tsx`,
  `${OPS}/content/showroom/demoData.ts`,
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
    name: 'live container import (TaskList/EvolutionTimeline/DependencyList/ProjectRow/TaskRow/DayCalendar/ScriptGenerator)',
    // Trailing quote anchors the exact module name, so the pure *View imports
    // (DayCalendarView / ScriptGeneratorView / TaskListView …) never match.
    re: /from\s+['"][^'"]*\/(TaskList|EvolutionTimeline|DependencyList|ProjectRow|TaskRow|DayCalendar|ScriptGenerator)['"]/,
  },
];

const violations: string[] = [];

for (const rel of SUBTREE_FILES) {
  if (!existsSync(resolve(ROOT, rel))) {
    // A missing subtree file is itself a failure — the guardrail must know its
    // exact surface. Fail loud rather than silently skipping.
    violations.push(`${rel}: MISSING (subtree file not found — update the guardrail list)`);
    continue;
  }
  // TEST-TRUTH-01: comments stripped. A forbidden pattern quoted in a comment is
  // prose, not a call — it cannot leak data, and it may not fail the build.
  const src = codeOf(rel);
  const lines = src.split('\n');
  lines.forEach((line: string, i: number) => {
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
