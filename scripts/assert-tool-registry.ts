#!/usr/bin/env tsx
/**
 * assert-tool-registry — THE TOOL REGISTRY LAW at build time (NAV-01a), and
 * THE REACHABILITY LAW (NAV-01b): every page file under src/app must have a
 * door — the family navigation (NAV-02: a family MENU's links — "All of
 * <FAMILY>" opens the family page, each tool item its door — and a family
 * PAGE's cards — the registry home, the related surfaces, the family reads),
 * the header/profile utilities menu (src/lib/shellMenu.ts), a listed guest /
 * marketing / flow route (GUEST_ROUTES below, each cited), or a redirect whose
 * target has a door. A child page is reached through its parent (segment-prefix
 * rule: /agenda/[id] through /agenda). A page with no door fails the build.
 *
 * THE STEPS LAW (SHELL-01): the rail walks the sheet in FLOW ORDER — the
 * module-scope law of src/lib/nav.ts re-run here (every registry job in
 * exactly one step; every step in one family, holding that family's jobs; the
 * families in flow order; steps 1..12 with no gaps; a roomless step holds
 * nothing LIVE), plus what only the filesystem can answer: every step's screen
 * resolves to a page file THAT MOUNTS THE APP SHELL (ACCOUNTS-01: the rail is on
 * every step's screen — the page file, or a layout above it, renders
 * AppLayout / the cockpit; a step whose room drops the navigation fails the
 * build), the roomless steps' one page exists (src/app/step/[slug]/page.tsx), and
 * the rail and the sheet render FROM steps.ts — never a retyped list.
 *
 * THE ANSWERS LAW (NAV-01c): the module-scope law of src/lib/answers.ts re-run
 * here (ANSWER_READS keys === ANSWER_ROWS questions 4/4 in order; a computed
 * read declares its source line — a card with a number and no source fails the
 * build), plus what only the filesystem can answer: /answers has a page file,
 * and its client derives the four cards from ANSWER_ROWS (imports the leaf,
 * maps ANSWER_ROWS, retypes no question). /answers is a door in the family
 * navigation (its first entry); each card's home and the net-worth read are
 * doors on /answers.
 *
 * THE RULE BOOK LAW (RULEBOOK-01): src/lib/providers.ts RULE_BOOK is the rule
 * book the system applies — its module-scope law re-run (every ROUTING_RULES
 * row present with the deck's kind; one kind per pair; six kinds, never
 * posting), plus what only the schema, the migration and the call sites can
 * answer: enum arrival_kind === ARRIVAL_KINDS === the *_arrival_kind
 * migration's CREATE TYPE, in order; every UPDATE that migration applies is a
 * rule the book holds with the same kind; every resource a landing call site
 * names (files under src that call landObjects — the provider and resource
 * they pass, as constants or literals) has a rule. A feed the book does not
 * name cannot be landed: the build fails before the code does.
 *
 * THE KIND-VIEWS LAW (TABLES-01; REBUILD-01 PR-2d): src/lib/kindViews.ts
 * KIND_VIEW_CENSUS is the census of the typed feed tables; the EFFECTIVE text of
 * the six views — each view's newest CREATE VIEW across the migrations in order
 * (the *_kind_views migration created them; a later migration drops and
 * recreates one, as *_holdings_snapshot does the snapshot view) — must be the
 * generator's text verbatim — (a) every census table in exactly one view,
 * (b) that view is the rule book's kind for the table's feed, (c) posting
 * unions nothing, (d) all six views carry the common columns in the same
 * order — and schema.prisma carries the six as `view` models with those
 * columns, under the `views` preview feature. The deck's step-5 honest line
 * is the census's own sentence (the file imports KIND_VIEWS_HONEST_LINE).
 *
 * THE ARRIVALS LAW (REBUILD-01 PR-1): the provider vocabulary's module-scope
 * law re-run (src/lib/providers.ts — every ROUTING_RULES provider + resource
 * pair resolves, no duplicate word or code), plus what only the texts can
 * answer: the Prisma enum `arrival_provider` (prisma/schema.prisma, read as
 * text) and the migration's CREATE TYPE (prisma/migrations/*_arrivals) carry
 * the code set EXACTLY, alphabetical; and the two Prisma models agree with the
 * migration's two CREATE TABLEs column for column — name, type, nullability,
 * order — so schema.prisma and the SQL can never drift. RULEBOOK-01: the SQL
 * side is the CREATE TABLE plus every later migration's ALTER TABLE … ADD
 * COLUMN / ALTER COLUMN … SET NOT NULL on that table, in migration order.
 *
 * THE ENV LAW (ENV-01): every variable the app reads is documented in
 * README.md's "## Self-hosting" section, and nothing documented there is read
 * by nothing. Three kinds of read: a `process.env.X` literal in src (the
 * grep), a variable a DEPENDENCY reads for us (src/lib/envLaw.ts
 * LIBRARY_READ_ENV — name, reading package, where, need, shape; each row must
 * appear in the README with its reader), and a computed key (DYNAMIC_READ_ENV).
 * A name declared library-read that src also reads as a literal is a
 * contradiction and fails. The night next-auth 4.24.15 started obeying
 * NEXTAUTH_URL, the README could not have known the variable existed.
 *
 * The assert:showroom pattern: a plain script wired into the `build` script so
 * it runs in CI / Vercel and fails the BUILD. It imports the registry (which
 * runs its module-scope law: sheet cells 25/25 both ways, LIVE/PARTIAL have a
 * home, NOT_BUILT have none, beats agree with status — TRUTH-01: NOT_BUILT ⇔ no
 * beats, LIVE ⇒ four, a four-beat PARTIAL says why — counts match the dated
 * census) and adds
 * the check only the filesystem can answer: every home and every link resolves
 * to a page file — `src/app/<route>/page.tsx`, or a single segment in the
 * `[tab]` allowlist (src/app/[tab]/page.tsx TAB_PATHS), or `/?tab=` on the root.
 *
 * Run standalone:  npx tsx scripts/assert-tool-registry.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { PROBLEM_SHEET } from '../src/lib/problemSheet';
import { EXPECTED_STATUS_COUNTS, FAMILY_READS, TOOL_REGISTRY, registryLaw, statusCounts } from '../src/lib/toolRegistry';
import { HOME_ANSWER, HOME_OWNER, HOME_PHASES, PHASES_RENDERED_AT, THE_SORT, navFamilies, navLaw, navRows } from '../src/lib/nav';
import { TOOL_GATE } from '../src/lib/offer';
import { PIPE_PHASES } from '../src/lib/pipePhases';
import { OWNER_UTILITIES } from '../src/lib/shellMenu';
import { ANSWERS_HOME, ANSWER_READS, ANSWER_ROWS, NET_WORTH_READ, answersLaw } from '../src/lib/answers';
import { ARRIVAL_KINDS, PROVIDERS, PROVIDER_CODES, ROUTING_RULES, RULE_BOOK, providersLaw, ruleFor } from '../src/lib/providers';
import { KIND_VIEWS_HONEST_LINE, KIND_VIEW_CENSUS, STOPPED_TABLES, VIEW_COLUMNS, kindOfTable, kindViewsLaw, latestViews, latestViewsSql, parseViews } from '../src/lib/kindViews';
// SELL-02: the offer law — every sales claim from the registry, every price from one source.
import { FREE_TOOLS, OFFERS, TOOL_GATE, heroCountsLine, offerCard, offerLaw, priceEnvName } from '../src/lib/offer';
import { DYNAMIC_READ_ENV, LIBRARY_READ_ENV } from '../src/lib/envLaw';
import { EXPECTED_FEED_COUNT, FEED_COST, FEED_IDS, SCAN_COST, feedCostLaw, scanCostLine } from '../src/lib/observatory/feedCost';
import { PURCHASABLE_ENTITLEMENT_KEYS } from '../src/lib/stripe';

/**
 * Routes whose door is outside the app map: the front door and its marketing
 * pages, the auth page, and provider / invite flow entries. Each entry cites
 * where the door is. Anything not listed here must be reached from the family
 * navigation, the utilities menu, or a redirect.
 */
const GUEST_ROUTES: ReadonlyArray<{ route: string; why: string }> = [
  { route: '/', why: 'the front door — src/middleware.ts PUBLIC_PATHS' },
  { route: '/[tab]', why: 'the cockpit paths (/runway /travel /trade /books /tax) — every cockpit home in the registry; src/app/[tab]/page.tsx TAB_PATHS. ROOM-02 took /routines /projects /content out: they are redirect pages into /operations now' },
  { route: '/login', why: 'the sign-in page (the one LoginBox, SELL-03) — src/app/accounts/page.tsx:37 sends an unauthenticated viewer here' },
  { route: '/pricing', why: 'PUBLIC_PATHS; renders THE OFFER (SELL-02) — LandingHeader.tsx, LandingFooter.tsx' },
  { route: '/how-pricing-works', why: 'LandingHeader.tsx:52, LandingFooter.tsx:54, the HomeClient header' },
  { route: '/privacy', why: 'LandingFooter.tsx:56, PUBLIC_PATHS' },
  { route: '/terms', why: 'LandingFooter.tsx:55, PUBLIC_PATHS' },
  { route: '/work-with-me', why: 'the deck (Landing.tsx), PUBLIC_PATHS' },
  { route: '/modules/[pillar]', why: 'the deck PILLAR_CARDS and ModulePointerCard.tsx' },
  { route: '/booking/confirm', why: 'the LiteAPI checkout return URL (CheckoutPanel.tsx returnUrl), PUBLIC_PATHS' },
  { route: '/plaid/oauth-return', why: 'the Plaid OAuth return URL — PLAID_REDIRECT_URI on every link token (src/lib/plaid/oauth.ts), registered in the Plaid Dashboard; the bank sends the signed-in user here, the app never links to it' },
  { route: '/trips/rsvp', why: 'the RSVP invite link sent to participants (src/app/trips/rsvp/RSVPClient.tsx)' },
  { route: '/trips/[id]', why: 'linked from the RSVP flow — RSVPClient.tsx:72, :87, :136' },
];

function pageRoutes(): Array<{ route: string; file: string }> {
  const out: Array<{ route: string; file: string }> = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = `${dir}/${name}`;
      if (statSync(abs).isDirectory()) { if (name !== 'api') walk(abs); continue; }
      if (name === 'page.tsx') {
        const rel = abs.replace(`${ROOT}/`, '');
        const route = '/' + rel.replace(/^src\/app\//, '').replace(/\/?page\.tsx$/, '');
        out.push({ route: route === '/page.tsx' || route === '/' ? '/' : route.replace(/\/$/, ''), file: rel });
      }
    }
  };
  walk(resolve(ROOT, 'src/app'));
  return out.map((p) => ({ ...p, route: p.route === '' ? '/' : p.route })).sort((a, b) => a.route.localeCompare(b.route));
}

/** Segment-wise match: a door equals the route, or is a proper prefix of it (a child is reached through its parent). */
function doorCovers(door: string, route: string): boolean {
  const d = door.split('?')[0].split('/').filter(Boolean);
  const r = route.split('/').filter(Boolean);
  if (d.length === 0) return r.length === 0;
  if (d.length > r.length) return false;
  return d.every((seg, i) => seg === r[i] || r[i].startsWith('['));
}

function redirectTarget(file: string): string | null {
  const src = readFileSync(resolve(ROOT, file), 'utf8');
  const m = src.match(/redirect\(\s*['"`]([^'"`]+)['"`]\s*\)/);
  return m ? m[1] : null;
}

const ROOT = resolve(__dirname, '..');

function tabAllowlist(): Set<string> {
  const src = readFileSync(resolve(ROOT, 'src/app/[tab]/page.tsx'), 'utf8');
  const m = src.match(/const TAB_PATHS = new Set\(\[([\s\S]*?)\]\)/);
  if (!m) throw new Error('assert-tool-registry: TAB_PATHS not found in src/app/[tab]/page.tsx');
  return new Set(Array.from(m[1].matchAll(/'([a-z-]+)'/g), (x) => x[1]));
}

/** Resolve a route to the file that serves it, or null. */
function pageFor(route: string, tabs: Set<string>): string | null {
  const [path, query] = route.split('?');
  if (path === '/' && query?.startsWith('tab=')) return 'src/app/page.tsx';
  const rel = `src/app${path}/page.tsx`;
  if (existsSync(resolve(ROOT, rel))) return rel;
  const seg = path.split('/')[1] ?? '';
  if (path.split('/').length === 2 && tabs.has(seg)) return 'src/app/[tab]/page.tsx';
  return null;
}

const violations = registryLaw({ throwOnFail: false });
const tabs = tabAllowlist();
const rows: string[] = [];

for (const t of TOOL_REGISTRY) {
  const resolved = t.home ? pageFor(t.home, tabs) : null;
  if (t.home && !resolved) violations.push(`${t.name}: home ${t.home} has no page file`);
  for (const l of t.links ?? []) {
    if (l.href && !pageFor(l.href, tabs)) violations.push(`${t.name}: link "${l.label}" → ${l.href} has no page file`);
    if (l.cockpitKey && !(l.cockpitKey === 'compliance' || tabs.has(l.cockpitKey === 'calendar' ? 'runway' : l.cockpitKey))) {
      violations.push(`${t.name}: link "${l.label}" → cockpit key "${l.cockpitKey}" is not a cockpit section`);
    }
  }
  if (t.cockpitKey && !(t.cockpitKey === 'compliance' || tabs.has(t.cockpitKey === 'calendar' ? 'runway' : t.cockpitKey))) {
    violations.push(`${t.name}: cockpitKey "${t.cockpitKey}" is not a cockpit section`);
  }
  const beats = (['discover', 'decide', 'commit', 'record'] as const).map((b) => (t.beats[b] ? b : '—')).join(' · ');
  rows.push(
    `${String(t.order).padStart(2, '0')}  ${t.name.padEnd(13)} ${t.family.padEnd(13)} ${t.status.padEnd(9)} ${beats.padEnd(38)} ${(t.home ?? 'none').padEnd(15)} ${resolved ?? '—'}`,
  );
}

// ── THE REACHABILITY LAW (NAV-01b) ──────────────────────────────────────────
type Door = { route: string; kind: string; via: string };
const doors: Door[] = [];
// SHELL-01: the rail's doors are what it RENDERS — Home first, then every step
// (its room, or /step/<slug> when it has none) and, inside the open step, each
// room it holds (stepLinks — the registry's own doorOf / doorOfLink, so every
// page the retired family navigation opened is opened here). The sheet on HOME
// carries the same steps plus each family's reads (pages that read across a
// family and belong to no single job).
doors.push({ route: ANSWERS_HOME, kind: 'rail', via: 'Home · the rail\'s first entry' });
// NAV-25: the rail's doors are its twenty-five TOOL rows, and under the open
// one, the pages that tool owns. A NOT_BUILT tool has no link, so it opens
// nothing and contributes no door — which is the point: nothing pretends.
for (const tool of navRows(TOOL_GATE)) {
  if (tool.href) doors.push({ route: tool.href, kind: 'rail', via: `${tool.n}. ${tool.name}` });
  for (const sub of tool.subRows) doors.push({ route: sub.door.href, kind: 'rail', via: `${tool.n}. ${tool.name} · "${sub.label}"` });
}
for (const family of navFamilies(TOOL_GATE)) {
  for (const tool of family.tools) {
    if (tool.href) doors.push({ route: tool.href, kind: 'sheet', via: `${family.name} · ${tool.name}` });
  }
  for (const r of FAMILY_READS[family.name] ?? []) doors.push({ route: r.href as string, kind: 'sheet', via: `${family.name} · read "${r.label}"` });
}
for (const u of OWNER_UTILITIES) doors.push({ route: u.href, kind: 'utilities menu', via: u.label });
for (const g of GUEST_ROUTES) doors.push({ route: g.route, kind: 'listed route', via: g.why });
// NAV-01c: each answer card opens its lens's home.
for (const [q, r] of Object.entries(ANSWER_READS)) if (r.computed) doors.push({ route: r.home, kind: 'answers', via: `"${q}" · Open · ${r.home}` });
doors.push({ route: NET_WORTH_READ.home, kind: 'answers', via: `Net worth · Open · ${NET_WORTH_READ.home}` });

const pages = pageRoutes();
const reach = new Map<string, Door | null>();
// Prefer the most specific door: an exact route match first, listed routes before
// prefix matches, so `/` reads as the front door and `/[tab]` as the cockpit paths.
const findDoor = (route: string) => {
  const exact = doors.find((d) => d.route.split('?')[0] === route);
  if (exact) return exact;
  return doors.find((d) => d.kind === 'listed route' && doorCovers(d.route, route))
    ?? doors.find((d) => doorCovers(d.route, route)) ?? null;
};
for (const p of pages) reach.set(p.route, findDoor(p.route));
// redirects: reachable when the target is (fixpoint over the page list)
let changed = true;
while (changed) {
  changed = false;
  for (const p of pages) {
    if (reach.get(p.route)) continue;
    const target = redirectTarget(p.file);
    if (!target) continue;
    const targetDoor = findDoor(target) ?? (pages.some((q) => q.route === target.split('?')[0] && reach.get(q.route)) ? reach.get(target.split('?')[0]) : null);
    if (targetDoor) { reach.set(p.route, { route: target, kind: 'redirect', via: `→ ${target} (${targetDoor.kind}: ${targetDoor.via})` }); changed = true; }
  }
}
console.log('REACHABILITY — every page under src/app and its door');
for (const p of pages) {
  const d = reach.get(p.route);
  console.log(`${p.route.padEnd(48)} ${d ? `${d.kind.padEnd(15)} ${d.via}` : 'NO DOOR'}`);
  if (!d) violations.push(`${p.route} (${p.file}) has no door — not on the rail, on the sheet, in the utilities menu, GUEST_ROUTES, or a redirect`);
}
for (const d of doors) {
  if (d.route.startsWith('/?')) continue;
  if (!pages.some((p) => doorCovers(p.route, d.route) || doorCovers(d.route, p.route))) violations.push(`door ${d.route} (${d.kind}: ${d.via}) points at no page`);
}
console.log(`pages: ${pages.length} · doors: ${doors.length}`);

// ACCOUNTS-01: does this page wear the app shell — in its own file, or in any layout
// above it? The shells that carry the rail: ShellFrame, AppLayout, and the cockpit
// (HomeClient / AnswersClient / ModulePageClient, which mount it themselves).
// SHELL-02: ShellFrame folded into AppLayout — one wrapper, one bar.
const SHELLS = ['AppLayout', 'HomeClient', 'AnswersClient', 'ModulePageClient'];
function mountsShell(pageFile: string): boolean {
  const read = (f: string) => (existsSync(resolve(ROOT, f)) ? readFileSync(resolve(ROOT, f), 'utf8') : '');
  if (SHELLS.some((shell) => read(pageFile).includes(shell))) return true;
  let dir = pageFile.slice(0, pageFile.lastIndexOf('/'));
  while (dir.startsWith('src/app')) {
    if (SHELLS.some((shell) => read(`${dir}/layout.tsx`).includes(shell))) return true;
    dir = dir.slice(0, dir.lastIndexOf('/'));
  }
  return false;
}

// ── THE NAV LAW (NAV-25) ────────────────────────────────────────────────────
const PHASE_TOTAL = Object.values(PIPE_PHASES).reduce((n, ps) => n + ps.length, 0);
// The steps layer is gone: the rail IS the sheet — six families in registry
// order, twenty-five tool rows in registry order, one pipe's phases per tool.
violations.push(...navLaw({ throwOnFail: false, gate: TOOL_GATE }));
console.log('THE SHEET — six families, twenty-five tools, the phases each owns');
for (const family of navFamilies(TOOL_GATE)) {
  console.log(family.name);
  for (const tool of family.tools) {
    const phases = tool.phases.length
      ? tool.phases.map((p) => `${p.pipe}·${p.num}${p.rendersSurface ? '' : '*'}`).join(' ')
      : '—';
    console.log(
      `  ${String(tool.n).padStart(2, '0')}  ${tool.name.padEnd(13)} ${tool.status.padEnd(10)} ${(tool.href ?? '(no link)').padEnd(17)} ${(tool.gate ?? 'free').padEnd(16)} ${phases}`,
    );
    for (const sub of tool.subRows) console.log(`        └ ${sub.label} → ${sub.door.href}`);
  }
}
console.log(`  ${HOME_OWNER.padStart(6)}  (not a tool — "${HOME_ANSWER}")  ${HOME_PHASES.map((p) => `${p.pipe}·${p.num}${p.rendersSurface ? '' : '*'}`).join(' ')}`);
console.log('  * a phase the code declares renders no surface — recorded, not tidied away');
// Every built tool's screen is a page file that wears the shell, so the rail is
// present in the room. A not-built tool has no screen to check — by law.
for (const tool of navRows(TOOL_GATE)) {
  if (!tool.href) continue;
  const file = pageFor(tool.href, tabs);
  if (!file) violations.push(`${tool.name}: screen ${tool.href} has no page file`);
  else if (!mountsShell(file)) violations.push(`${tool.name}: ${tool.href} (${file}) mounts no shell — the rail must be on every tool's screen (AppLayout or the cockpit, in the page or a layout above it)`);
}
// The steps layer must stay gone — its module, its opener and its page.
for (const gone of ['src/lib/steps.ts', 'src/components/shell/StepOpener.tsx', 'src/app/step/[slug]/page.tsx']) {
  if (existsSync(resolve(ROOT, gone))) violations.push(`${gone} is back — NAV-25 deleted the steps layer; the rail renders the twenty-five tools from src/lib/nav.ts`);
}
// The rail and the sheet render FROM nav.ts, never a retyped list.
const RAIL = 'src/components/shell/Rail.tsx';
const SHEET = 'src/components/shell/TheSheet.tsx';
const railSrc = existsSync(resolve(ROOT, RAIL)) ? readFileSync(resolve(ROOT, RAIL), 'utf8') : '';
const sheetSrc = existsSync(resolve(ROOT, SHEET)) ? readFileSync(resolve(ROOT, SHEET), 'utf8') : '';
if (!railSrc) violations.push(`${RAIL} is missing — it is the navigation`);
for (const token of ['navFamilies(', "from '@/lib/nav'"]) {
  if (railSrc && !railSrc.includes(token)) violations.push(`${RAIL} must render from nav.ts (${token}) — never a retyped list`);
}
// Real access, not the word: the file's own comment says it stores nothing.
if (railSrc && /(?:local|session)Storage\s*[.[]/.test(railSrc)) violations.push(`${RAIL} must keep open/collapsed in React state only — no browser storage`);
if (!sheetSrc) violations.push(`${SHEET} is missing — HOME carries the whole sheet`);
for (const token of ['navFamilies(', "from '@/lib/nav'"]) {
  if (sheetSrc && !sheetSrc.includes(token)) violations.push(`${SHEET} must render from nav.ts (${token}) — never a retyped list`);
}
const HOME_CLIENT = 'src/components/answers/AnswersClient.tsx';
const homeSrc = readFileSync(resolve(ROOT, HOME_CLIENT), 'utf8');
if (!homeSrc.includes('<TheSheet />')) violations.push(`${HOME_CLIENT} must render the sheet below the answers (SHELL-01)`);
if (!homeSrc.includes('<Rail ')) violations.push(`${HOME_CLIENT} must render the rail`);

// ── THE ANSWERS LAW (NAV-01c) ───────────────────────────────────────────────
violations.push(...answersLaw({ throwOnFail: false }));
const ANSWERS_PAGE = `src/app${ANSWERS_HOME}/page.tsx`;
const ANSWERS_CLIENT = 'src/components/answers/AnswersClient.tsx';
if (!existsSync(resolve(ROOT, ANSWERS_PAGE))) violations.push(`${ANSWERS_HOME} has no page file (${ANSWERS_PAGE})`);
const clientSrc = existsSync(resolve(ROOT, ANSWERS_CLIENT)) ? readFileSync(resolve(ROOT, ANSWERS_CLIENT), 'utf8') : '';
if (!clientSrc) violations.push(`${ANSWERS_CLIENT} is missing — /answers renders nothing`);
if (clientSrc && !/from '@\/lib\/answers'/.test(clientSrc)) violations.push(`${ANSWERS_CLIENT} must import the answers from src/lib/answers.ts`);
if (clientSrc && !clientSrc.includes('ANSWER_ROWS.map(')) violations.push(`${ANSWERS_CLIENT} must derive its cards from ANSWER_ROWS — never a retyped list`);
for (const [q] of ANSWER_ROWS) {
  if (clientSrc.includes(`'${q}'`) || clientSrc.includes(`"${q}"`)) violations.push(`${ANSWERS_CLIENT} retypes the question "${q}" — the four questions come from ANSWER_ROWS only`);
}
console.log('THE ANSWERS — four cards, ANSWER_ROWS order, then the read');
for (const [q, segs] of ANSWER_ROWS) {
  const r = ANSWER_READS[q];
  console.log(`${q.padEnd(28)} ${segs.map(([t]) => t).join('')}`);
  console.log(`${''.padEnd(28)} ${r === undefined ? 'NO READ' : r.computed ? `NUMBER · ${r.endpoint} → ${r.home}\n${''.padEnd(28)} source: ${r.source}` : `HONEST · ${r.honest}`}`);
}
console.log(`${'Net worth'.padEnd(28)} NUMBER · ${NET_WORTH_READ.endpoint} → ${NET_WORTH_READ.home}\n${''.padEnd(28)} source: ${NET_WORTH_READ.source}`);

console.log('TOOL REGISTRY — 25 rows, sheet order');
console.log('#   tool          family        status    beats                                  home            page file');
for (const r of rows) console.log(r);
const counts = statusCounts();
console.log(`counts: LIVE ${counts.LIVE} · PARTIAL ${counts.PARTIAL} · NOT_BUILT ${counts.NOT_BUILT} (census ${EXPECTED_STATUS_COUNTS.LIVE}/${EXPECTED_STATUS_COUNTS.PARTIAL}/${EXPECTED_STATUS_COUNTS.NOT_BUILT}) · sheet cells ${PROBLEM_SHEET.flatMap((f) => f.tools).length}`);

// ── THE ARRIVALS LAW (REBUILD-01 PR-1) ──────────────────────────────────────
violations.push(...providersLaw({ throwOnFail: false }));
const schemaText = readFileSync(resolve(ROOT, 'prisma/schema.prisma'), 'utf8');
const migrationDir = readdirSync(resolve(ROOT, 'prisma/migrations')).find((d) => d.endsWith('_arrivals'));
const migrationSql = migrationDir ? readFileSync(resolve(ROOT, 'prisma/migrations', migrationDir, 'migration.sql'), 'utf8') : '';
if (!migrationDir) violations.push('arrivals: no prisma/migrations/*_arrivals/migration.sql');

const enumBlock = schemaText.match(/enum arrival_provider \{\n([\s\S]*?)\n\}/);
const enumValues = enumBlock ? enumBlock[1].split('\n').map((l) => l.trim()).filter(Boolean) : [];
if (enumValues.join(',') !== PROVIDER_CODES.join(',')) violations.push(`arrivals: enum arrival_provider [${enumValues.join(' ')}] ≠ providers.ts codes [${PROVIDER_CODES.join(' ')}]`);
const typeValues = migrationSql.match(/CREATE TYPE arrival_provider AS ENUM \((.*?)\);/)?.[1].split(', ').map((v) => v.replace(/^'|'$/g, '')) ?? [];
if (typeValues.join(',') !== PROVIDER_CODES.join(',')) violations.push(`arrivals: migration CREATE TYPE arrival_provider [${typeValues.join(' ')}] ≠ providers.ts codes`);

/** Every migration.sql, in migration order — the ALTER TABLE … ADD COLUMN / SET NOT NULL a table gained after its CREATE TABLE. */
const ALL_MIGRATIONS = readdirSync(resolve(ROOT, 'prisma/migrations')).sort()
  .filter((d) => existsSync(resolve(ROOT, 'prisma/migrations', d, 'migration.sql')))
  .map((d) => ({ dir: d, sql: readFileSync(resolve(ROOT, 'prisma/migrations', d, 'migration.sql'), 'utf8') }));

/** SQL column → { name, type, nullable }: the CREATE TABLE body (constraints and indexes skipped) plus every later ADD COLUMN, with SET NOT NULL applied. */
function sqlColumns(table: string): Array<{ name: string; type: string; nullable: boolean }> {
  const m = migrationSql.match(new RegExp(`CREATE TABLE ${table} \\(\\n([\\s\\S]*?)\\n\\);`));
  if (!m) return [];
  const cols = m[1].split('\n').map((l) => l.trim().replace(/,$/, '')).filter((l) => l && !/^CONSTRAINT /.test(l)).map((l) => {
    const [name, type] = l.split(/\s+/);
    const nullable = !/NOT NULL|PRIMARY KEY/.test(l);
    return { name, type, nullable };
  });
  for (const { sql } of ALL_MIGRATIONS) {
    for (const add of sql.matchAll(new RegExp(`ALTER TABLE ${table} ADD COLUMN (\\w+) ([\\w\\[\\]]+)( NOT NULL| NULL)?`, 'g'))) {
      cols.push({ name: add[1], type: add[2], nullable: add[3] !== ' NOT NULL' });
    }
    for (const set of sql.matchAll(new RegExp(`ALTER TABLE ${table} ALTER COLUMN (\\w+) SET NOT NULL`, 'g'))) {
      const c = cols.find((x) => x.name === set[1]);
      if (c) c.nullable = false;
    }
  }
  return cols;
}
/** Prisma scalar field → the SQL shape it must match. Relation fields (a model type) are skipped. */
const PRISMA_TO_SQL: Record<string, string> = { String: 'text', Int: 'integer', 'Bytes@db.ByteA': 'bytea', 'Json@db.JsonB': 'jsonb', 'DateTime@db.Timestamptz(6)': 'timestamptz', 'String[]': 'text[]' };
function modelColumns(model: string): Array<{ name: string; type: string; nullable: boolean }> {
  const m = schemaText.match(new RegExp(`model ${model} \\{\\n([\\s\\S]*?)\\n\\}`));
  if (!m) return [];
  const out: Array<{ name: string; type: string; nullable: boolean }> = [];
  for (const raw of m[1].split('\n')) {
    const l = raw.trim();
    if (!l || l.startsWith('@@') || l.startsWith('//')) continue;
    const [name, typeTok, ...rest] = l.split(/\s+/);
    // A relation field carries no column: it is declared with @relation, or its type is a model (scalar, optional or list form).
    const relTarget = typeTok.replace(/\[\]$/, '').replace(/\?$/, '');
    if (rest.some((t) => t.startsWith('@relation')) || schemaText.includes(`model ${relTarget} {`)) continue;
    const nullable = typeTok.endsWith('?');
    const base = typeTok.replace(/\?$/, '');
    const native = rest.find((t) => t.startsWith('@db.')) ?? '';
    const key = base + native;
    const type = PRISMA_TO_SQL[key] ?? (['arrival_provider', 'arrival_status', 'their_id_kind', 'arrival_kind'].includes(base) ? base : `?${key}`);
    out.push({ name, type, nullable });
  }
  return out;
}
const arrivalsRows: string[] = [];
for (const [table] of [['provider_responses'], ['arrivals']]) {
  const sql = sqlColumns(table);
  const model = modelColumns(table);
  if (sql.length === 0) violations.push(`arrivals: CREATE TABLE ${table} not found in the migration`);
  if (model.length === 0) violations.push(`arrivals: model ${table} not found in schema.prisma`);
  const n = Math.max(sql.length, model.length);
  for (let i = 0; i < n; i++) {
    const a = sql[i]; const b = model[i];
    const same = a && b && a.name === b.name && a.type === b.type && a.nullable === b.nullable;
    arrivalsRows.push(`${table.padEnd(19)} ${(a ? `${a.name} ${a.type}${a.nullable ? ' NULL' : ' NOT NULL'}` : '—').padEnd(44)} ${(b ? `${b.name} ${b.type}${b.nullable ? ' NULL' : ' NOT NULL'}` : '—').padEnd(44)} ${same ? '=' : '≠'}`);
    if (!same) violations.push(`arrivals: ${table} column ${i + 1} differs — SQL ${a ? `${a.name} ${a.type}${a.nullable ? '' : ' NOT NULL'}` : '(none)'} vs model ${b ? `${b.name} ${b.type}${b.nullable ? '' : ' NOT NULL'}` : '(none)'}`);
  }
}
console.log('THE ARRIVALS STORE — migration SQL vs schema.prisma, column for column');
console.log(`${'table'.padEnd(19)} ${'migration.sql'.padEnd(44)} ${'schema.prisma'.padEnd(44)}`);
for (const r of arrivalsRows) console.log(r);
console.log(`providers: ${PROVIDERS.length} (${PROVIDERS.filter((p) => p.today).length} today) · rule-book pairs ${ROUTING_RULES.length} · enum values ${enumValues.length} · CREATE TYPE values ${typeValues.length}`);

// ── THE RULE BOOK LAW (RULEBOOK-01) ─────────────────────────────────────────
const kindMigration = ALL_MIGRATIONS.find((m) => m.dir.endsWith('_arrival_kind'));
if (!kindMigration) violations.push('rule book: no prisma/migrations/*_arrival_kind/migration.sql');
const kindMigrationSql = kindMigration?.sql ?? '';
const kindEnumBlock = schemaText.match(/enum arrival_kind \{\n([\s\S]*?)\n\}/);
const kindEnumValues = kindEnumBlock ? kindEnumBlock[1].split('\n').map((l) => l.trim()).filter(Boolean) : [];
if (kindEnumValues.join(',') !== ARRIVAL_KINDS.join(',')) violations.push(`rule book: enum arrival_kind [${kindEnumValues.join(' ')}] ≠ providers.ts ARRIVAL_KINDS [${ARRIVAL_KINDS.join(' ')}]`);
const kindTypeValues = kindMigrationSql.match(/CREATE TYPE arrival_kind AS ENUM \((.*?)\);/)?.[1].split(', ').map((v) => v.replace(/^'|'$/g, '')) ?? [];
if (kindTypeValues.join(',') !== ARRIVAL_KINDS.join(',')) violations.push(`rule book: migration CREATE TYPE arrival_kind [${kindTypeValues.join(' ')}] ≠ providers.ts ARRIVAL_KINDS`);
// The migration applies the book, it invents nothing: every UPDATE it runs is a rule the book holds, with the book's kind.
const applied: Array<{ provider: string; resource: string; kind: string }> = [];
for (const m of kindMigrationSql.matchAll(/UPDATE arrivals SET kind = '([a-z]+)'\s+WHERE kind IS NULL AND provider = '([a-z_]+)' AND resource = '([a-z_]+)';/g)) {
  const [, kind, provider, resource] = m;
  applied.push({ provider, resource, kind });
  const rule = ruleFor(provider, resource);
  if (!rule) violations.push(`rule book: the migration applies ${provider} · ${resource} → ${kind} but the book holds no such rule`);
  else if (rule.kind !== kind) violations.push(`rule book: the migration sets ${provider} · ${resource} to ${kind}; the book says ${rule.kind}`);
}
if (kindMigration && applied.length === 0) violations.push('rule book: the arrival_kind migration applies no rule (no UPDATE … SET kind found)');
if (kindMigration && !/ALTER TABLE arrivals ALTER COLUMN kind SET NOT NULL/.test(kindMigrationSql)) violations.push('rule book: the arrival_kind migration never sets kind NOT NULL');
if (kindMigration && !/OR NEW\.kind\s+IS DISTINCT FROM OLD\.kind/.test(kindMigrationSql)) violations.push('rule book: the promise-1 trigger does not freeze kind');
// Every landing call site's (provider, resource) has a rule — the files under src that call landObjects, the words they pass.
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = `${dir}/${name}`;
    if (statSync(abs).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') out.push(...tsFiles(abs)); continue; }
    if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(abs);
  }
  return out;
}
const landingConstants = new Map<string, string>();
const srcFiles = tsFiles(resolve(ROOT, 'src')).map((abs) => ({ file: abs.replace(`${ROOT}/`, ''), src: readFileSync(abs, 'utf8') }));
for (const { src } of srcFiles) for (const m of src.matchAll(/export const ([A-Z_]+) = '([a-z_]+)';/g)) landingConstants.set(m[1], m[2]);
const wordOf = (expr: string): string | undefined => (expr.startsWith("'") ? expr.slice(1, -1) : landingConstants.get(expr));
const callSites: Array<{ file: string; provider: string; resource: string; kind: string }> = [];
for (const { file, src } of srcFiles) {
  if (!src.includes('landObjects(') || file === 'src/lib/arrivals/land.ts') continue;
  const providers = [...new Set([...src.matchAll(/provider: ([A-Z_]+|'[a-z_]+')/g)].map((m) => wordOf(m[1])))];
  const resources = [...new Set([...src.matchAll(/resource: ([A-Z_]+|'[a-z_]+')/g)].map((m) => wordOf(m[1])))];
  if (providers.length !== 1 || providers[0] === undefined) violations.push(`rule book: ${file} calls landObjects and names ${providers.filter(Boolean).length} provider(s) — expected exactly one, as a constant or a literal`);
  for (const resource of resources) {
    if (resource === undefined) { violations.push(`rule book: ${file} names a resource the assert cannot resolve to a word`); continue; }
    const rule = providers[0] ? ruleFor(providers[0], resource) : undefined;
    callSites.push({ file, provider: providers[0] ?? '?', resource, kind: rule?.kind ?? 'NO RULE' });
    if (!rule) violations.push(`rule book: ${file} lands ${providers[0]} · ${resource} and the book holds no rule for it`);
  }
}
if (callSites.length === 0) violations.push('rule book: no landing call site found under src — the scan is broken');
console.log(`THE RULE BOOK — ${RULE_BOOK.length} rows (${RULE_BOOK.filter((r) => r.source === 'deck').length} the deck's, ${RULE_BOOK.filter((r) => r.source === 'added').length} added)`);
for (const r of RULE_BOOK) console.log(`${r.provider.padEnd(18)} ${r.resource.padEnd(24)} ${r.kind.padEnd(10)} ${r.source.padEnd(6)} ${r.means}`);
console.log('LANDING CALL SITES — provider · resource → the rule applied');
for (const c of callSites) console.log(`${c.file.padEnd(48)} ${c.provider} · ${c.resource.padEnd(24)} → ${c.kind}`);
console.log(`the migration applies: ${applied.map((a) => `${a.provider} · ${a.resource} → ${a.kind}`).join(' · ')}`);

// ── THE OFFER LAW (SELL-02) ────────────────────────────────────────────────
// src/lib/offer.ts is the one source of what is sold and what is free; the
// purchasable keys (stripe.ts) are its keys; the literal "built and running"
// is typed nowhere but there; every selling surface renders the offer.
violations.push(...offerLaw({ throwOnFail: false, purchasable: PURCHASABLE_ENTITLEMENT_KEYS }));
for (const { file, src } of srcFiles) {
  if (file !== 'src/lib/offer.ts' && src.includes('built and running')) violations.push(`offer: ${file} types "built and running" — a claim line comes from claimLine() only`);
}
const SELLING_SURFACES = ['src/components/home/LockedTabCard.tsx', 'src/app/modules/[pillar]/ModulePageClient.tsx', 'src/app/pricing/page.tsx', 'src/components/landing/Landing.tsx'];
for (const f of SELLING_SURFACES) {
  if (!existsSync(resolve(ROOT, f))) { violations.push(`offer: ${f} is missing`); continue; }
  const src = readFileSync(resolve(ROOT, f), 'utf8');
  if (!src.includes("from '@/lib/offer'") || !src.includes("from '@/components/OfferCard'")) violations.push(`offer: ${f} must render the offer (import src/lib/offer.ts and OfferCard) — never a typed claim or price`);
}
if (existsSync(resolve(ROOT, 'src/config/pricingModel.ts'))) violations.push('offer: src/config/pricingModel.ts still exists — the offer is the one price source');
if (existsSync(resolve(ROOT, 'docs/FREEMIUM-MODEL.md'))) violations.push('offer: docs/FREEMIUM-MODEL.md still exists — the offer (and /pricing) states the model');
const pricingPage = readFileSync(resolve(ROOT, 'src/app/pricing/page.tsx'), 'utf8');
if (/permanentRedirect|redirect\(/.test(pricingPage)) violations.push('offer: /pricing must render the offer, not redirect');
console.log(`THE OFFER — ${OFFERS.length} offers, ${FREE_TOOLS.length} free tools`);
for (const o of OFFERS) {
  const card = offerCard(o, {});
  console.log(`${o.key.padEnd(12)} ${o.label.padEnd(11)} price ${o.monthlyPrice === null ? 'unset' : `$${o.monthlyPrice}/mo`} · env ${priceEnvName(o.key)} · grants ${o.grants.join(', ')}`);
  for (const t of card.tools) console.log(`${''.padEnd(24)} ${t.name.padEnd(12)} ${t.status.padEnd(9)} ${t.claim}`);
}
console.log(`free with an account: ${FREE_TOOLS.map((t) => `${t.name} (${TOOL_GATE[t.name] ?? 'no gate'})`).join(', ')}`);
console.log(`hero: ${heroCountsLine()}`);

// ── HYG-04: the posting law — no posting path may report success on a rolled-back
// write. Every journal_entries / ledger_entries row is created by
// src/lib/posting/postJournal.ts (SET CONSTRAINTS ALL IMMEDIATE first, the lines
// in one statement, the entry id read back after commit); a create anywhere
// else in src/ (tests excluded) fails the build, and a raw $transaction that
// names those tables fails too.
const POSTING_HOME = 'src/lib/posting/postJournal.ts';
// A word boundary before the table name: trade_journal_entries (a different table) is not the ledger.
const POSTING_WRITES = [/(?<![A-Za-z0-9_])journal_entries\s*\.\s*create(?:Many)?\s*\(/, /(?<![A-Za-z0-9_])ledger_entries\s*\.\s*create(?:Many)?\s*\(/, /(?<![A-Za-z0-9_])ledger_entries\s*:\s*\{\s*create\b/];
const postingPaths = new Set<string>();
for (const { file, src } of srcFiles) {
  if (file === POSTING_HOME) continue;
  for (const re of POSTING_WRITES) {
    if (re.test(src)) violations.push(`posting: ${file} creates a journal or ledger row outside ${POSTING_HOME} — every posting path routes through postJournal()`);
  }
  if (/postJournal\s*\(/.test(src)) postingPaths.add(file);
}
if (!srcFiles.some(({ file }) => file === POSTING_HOME)) violations.push(`posting: ${POSTING_HOME} is missing`);
const postingHome = srcFiles.find(({ file }) => file === POSTING_HOME)?.src ?? '';
if (!postingHome.includes("'SET CONSTRAINTS ALL IMMEDIATE'")) violations.push('posting: postJournal.ts does not issue SET CONSTRAINTS ALL IMMEDIATE');
if (!/ledger_entries\.createMany\(/.test(postingHome)) violations.push('posting: postJournal.ts does not insert the lines in one statement');
if (!/PostingNotLandedError/.test(postingHome)) violations.push('posting: postJournal.ts has no read-back failure');
if (postingPaths.size < 12) violations.push(`posting: only ${postingPaths.size} files route through postJournal() — the audit counted 12`);

// ─── THE ENV LAW (ENV-01) ────────────────────────────────────────────────────
const readmeText = readFileSync(resolve(ROOT, 'README.md'), 'utf8');
const selfHosting = readmeText.split(/^## /m).find((section) => section.startsWith('Self-hosting')) ?? '';
if (!selfHosting) violations.push('env: README.md has no "## Self-hosting" section');
const documentedEnv = new Set([...selfHosting.matchAll(/`([A-Z][A-Z0-9_]+)`/g)].map((m) => m[1]));
const srcEnv = new Set<string>();
for (const { src } of srcFiles) for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) srcEnv.add(m[1]);
const libraryEnv = new Set(LIBRARY_READ_ENV.map((e) => e.name));
const dynamicEnv = new Set(DYNAMIC_READ_ENV.map((e) => e.name));
for (const name of libraryEnv) if (srcEnv.has(name)) violations.push(`env: ${name} is declared library-read (src/lib/envLaw.ts) but src reads process.env.${name} as a literal — not library-read`);
const readKind = (name: string) => (srcEnv.has(name) ? 'a src literal' : libraryEnv.has(name) ? 'a library' : 'a computed key');
for (const name of [...new Set([...srcEnv, ...libraryEnv, ...dynamicEnv])].sort()) {
  if (!documentedEnv.has(name)) violations.push(`env: ${name} is read (${readKind(name)}) but README.md's Self-hosting section does not document it`);
}
for (const name of [...documentedEnv].sort()) {
  if (!srcEnv.has(name) && !libraryEnv.has(name) && !dynamicEnv.has(name)) violations.push(`env: README.md documents ${name} but nothing reads it`);
}
for (const e of LIBRARY_READ_ENV) {
  const row = selfHosting.split('\n').find((line) => line.startsWith(`| \`${e.name}\` |`));
  if (!row) violations.push(`env: README.md has no library row for ${e.name} (src/lib/envLaw.ts)`);
  else if (!row.includes(e.readBy)) violations.push(`env: README.md's row for ${e.name} does not name its reader '${e.readBy}'`);
}

// The FIRST gate: everything checked above this line. Laws below push onto the
// same list and are raised by the second gate at the end of this file.
// OBSERVATORY-01 found that gate missing: the kind-views law (below) pushed
// violations no gate ever read, so it could not fail a build. `raised` marks
// what this gate already reported so the second one does not repeat it.
if (violations.length) {
  console.error('\n✖ TOOL REGISTRY LAW FAILED:');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
// Nothing above survived unreported (the gate exits), so this is 0 — it marks
// where the second gate starts reading, and says so rather than assuming it.
const raised = violations.length;
console.log('✔ Tool registry law passed — 25/25 cells, homes resolve to page files, counts match the census.');
console.log(`✔ Reachability law passed — ${pages.length} pages, every one has a door (the rail, the sheet, the utilities menu, a listed route, or a redirect to one).`);
console.log(`✔ The nav law passed — ${navFamilies(TOOL_GATE).length} families and ${navRows(TOOL_GATE).length} tools, both in TOOL_REGISTRY's order; ${PHASE_TOTAL} phases from pipePhases.ts each owned by exactly one of them or by ${HOME_OWNER}; every built tool's screen is a page file that wears the shell; the rail and the sheet render from nav.ts.`);
console.log(`✔ The answers law passed — ${ANSWER_ROWS.length}/4 questions on ${ANSWERS_HOME}, every number sourced.`);
// ── THE KIND-VIEWS LAW (TABLES-01) ──────────────────────────────────────────
const viewsMigration = ALL_MIGRATIONS.find((m) => m.dir.endsWith('_kind_views'));
if (!viewsMigration) violations.push('kind views: no prisma/migrations/*_kind_views/migration.sql');
// REBUILD-01 PR-2d: a view is redefined by a later migration that drops and recreates it — the law reads each view's NEWEST text.
const effectiveViews = latestViews(ALL_MIGRATIONS);
if (effectiveViews.length !== ARRIVAL_KINDS.length) violations.push(`kind views: ${effectiveViews.length} of ${ARRIVAL_KINDS.length} views have a CREATE VIEW in the migrations`);
violations.push(...kindViewsLaw({ throwOnFail: false, migrationSql: latestViewsSql(ALL_MIGRATIONS) }));
// schema.prisma: the six `view` models, the common columns in order, the views preview on
if (!/previewFeatures\s*=\s*\[[^\]]*"views"/.test(schemaText)) violations.push('kind views: generator client must enable previewFeatures = ["views"]');
const VIEW_FIELD_TYPES: Record<string, string> = { arrival_kind: 'arrival_kind', text: 'String', timestamptz: 'DateTime' };
for (const kind of ARRIVAL_KINDS) {
  const block = schemaText.match(new RegExp(`\\nview ${kind} \\{\\n([\\s\\S]*?)\\n\\}`));
  if (!block) { violations.push(`kind views: schema.prisma has no view ${kind}`); continue; }
  const fields = block[1].split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('@@') && !l.startsWith('//')).map((l) => { const [name, type] = l.split(/\s+/); return { name, type: type.replace(/\?$/, '') }; });
  const want = VIEW_COLUMNS.map(([n, t]) => `${n} ${VIEW_FIELD_TYPES[t]}`).join(', ');
  const have = fields.map((f) => `${f.name} ${f.type}`).join(', ');
  if (want !== have) violations.push(`kind views: view ${kind} in schema.prisma is [${have}], not the common shape [${want}]`);
}
const landingSrc = readFileSync(resolve(ROOT, 'src/components/landing/Landing.tsx'), 'utf8');
if (!landingSrc.includes('{KIND_VIEWS_HONEST_LINE}')) violations.push("kind views: the deck's step 5 must render KIND_VIEWS_HONEST_LINE (never a retyped line)");
console.log('THE KIND VIEWS — the census, each table once, the kind from the rule book');
for (const t of KIND_VIEW_CENSUS) console.log(`${t.table.padEnd(26)} ${kindOfTable(t).padEnd(10)} ${Array.isArray(t.feed) ? `${t.feed[0]} · ${t.feed[1]}` : `by ${t.feed.column}: ${Object.values(t.feed.map).map(([p, r]) => `${p} · ${r}`).join(' | ')}`}`);
for (const v of effectiveViews) { const p = parseViews(v.sql)[0]; console.log(`view ${v.kind.padEnd(10)} ← ${p && p.tables.length ? p.tables.join(', ') : '(nothing)'}  — ${v.dir}`); }
console.log(`stopped (reported, not viewed): ${STOPPED_TABLES.map((s) => s.table).join(' · ')}`);
console.log(`honest line: ${KIND_VIEWS_HONEST_LINE}`);

console.log(`✔ The arrivals law passed — ${PROVIDERS.length} providers, enum === codes, ${arrivalsRows.length} columns agree with the migrations.`);
console.log(`✔ The rule book law passed — ${RULE_BOOK.length} rules, ${callSites.length} landing call sites covered, enum arrival_kind === the six kinds, the migration applies ${applied.length} rules the book holds.`);
console.log(`✔ The kind views law passed — ${ARRIVAL_KINDS.length} views over ${KIND_VIEW_CENSUS.length} feed tables, each once, the kind from the rule book; posting unions nothing; ${STOPPED_TABLES.length} tables reported, not viewed.`);
console.log(`✔ The posting law passed — every journal and ledger row is created by postJournal.ts (SET CONSTRAINTS ALL IMMEDIATE first, one statement for the lines, read back after commit); ${postingPaths.size} files post through it.`);
console.log(`✔ The env law passed — ${srcEnv.size} names read as src literals, ${libraryEnv.size} read by a library (src/lib/envLaw.ts), ${dynamicEnv.size} by a computed key; every one documented in README.md, nothing documented that nothing reads.`);
// ── THE OBSERVATORY LAW (OBSERVATORY-01) ──────────────────────────
// The observatory measures or says nothing. It rendered a 33-row
// HARDCODED_SOURCES array — typed statuses, typed latencies, typed values, dates
// frozen at 2026-03-02 — whenever no check had run, and a spend decision was
// read off it. No file under src/components/data-observatory may hold a typed
// array of statuses, latencies or record counts again: the pattern is banned by
// name, and by shape for a renamed copy.
violations.push(...feedCostLaw({ throwOnFail: false }));
const OBSERVATORY_DIR = 'src/components/data-observatory';
const BANNED_NAMES = /\b(HARDCODED_[A-Z_]+|SAMPLE_[A-Z_]+|MOCK_[A-Z_]+|FALLBACK_[A-Z_]+)\b/;
// A typed measurement: an object literal carrying a status AND a latency or a
// record count, written into source rather than measured.
const TYPED_MEASUREMENT = /status:\s*'(LIVE|BROKEN|PARTIAL|MKT-HRS|SKIPPED)'[^\n]*(latency|records):/;
const NOT_MEASURED_MARK = 'data-not-measured';
const observatoryFiles = existsSync(resolve(ROOT, OBSERVATORY_DIR))
  ? readdirSync(resolve(ROOT, OBSERVATORY_DIR)).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'))
  : [];
if (observatoryFiles.length === 0) violations.push(`observatory: ${OBSERVATORY_DIR} holds no file — the screen is the law's subject`);
let observatoryRowsTyped = 0;
for (const f of observatoryFiles) {
  const rel = `${OBSERVATORY_DIR}/${f}`;
  const src = readFileSync(resolve(ROOT, rel), 'utf8');
  // The doc comment names the deleted array on purpose; only real code counts.
  const code = src.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
  const named = code.match(BANNED_NAMES);
  if (named) {
    observatoryRowsTyped += 1;
    violations.push(`observatory: ${rel} declares ${named[0]} — the observatory measures or says nothing; no typed status, latency or record array`);
  }
  const shaped = code.match(TYPED_MEASUREMENT);
  if (shaped) {
    observatoryRowsTyped += 1;
    violations.push(`observatory: ${rel} writes a status with a latency or record count into source (${shaped[0].slice(0, 60)}…) — a row renders only from a measurement`);
  }
}
const observatorySrc = observatoryFiles.includes('DataObservatory.tsx')
  ? readFileSync(resolve(ROOT, `${OBSERVATORY_DIR}/DataObservatory.tsx`), 'utf8')
  : '';
if (!observatorySrc) violations.push(`observatory: ${OBSERVATORY_DIR}/DataObservatory.tsx is missing — it is the screen`);
else if (!observatorySrc.includes(NOT_MEASURED_MARK)) {
  violations.push(`observatory: DataObservatory.tsx must render the not-measured state (${NOT_MEASURED_MARK}) — with no check run there is nothing to show`);
}
console.log('THE OBSERVATORY — what each feed costs, read from the call sites');
for (const id of FEED_IDS) {
  const c = FEED_COST[id];
  console.log(`${String(id).padStart(2, '0')}  ${c.provider.padEnd(11)} ${(c.billable ? 'METERED' : 'not metered').padEnd(12)} ${String(c.upstreamCalls).padStart(2)} call(s)  probes ${c.probes.padEnd(9)} scan: ${c.usedByScan ? 'yes' : 'NO '}  ${c.scanCitation.slice(0, 72)}`);
}
console.log(scanCostLine());
console.log(`✔ The observatory law passed — ${FEED_IDS.length}/${EXPECTED_FEED_COUNT} feeds each carry provider, metered, calls and scan use; ${observatoryFiles.length} file(s) under ${OBSERVATORY_DIR} hold ${observatoryRowsTyped} typed measurement(s); the screen renders a not-measured state. One scan of one symbol: ${SCAN_COST.filter((c) => (c.callsPerSymbol ?? 0) > 0).map((c) => `${c.callsPerSymbol} ${c.provider}`).join(' · ')}.`);
// ── THE SHELL LAW (SHELL-02) ──────────────────────────────────────────────
// ONE header and ONE band. Two markers, checked over src/app and src/components:
//   · a BRAND BAR or a SIGN-OUT outside ShellBar — the app rendered two design
//     languages at once, a marketing header on the cockpit tabs and ShellBar
//     everywhere else. The deck is a declared exception: the landing, /pricing
//     and the /modules pages are marketing surfaces and mount LandingHeader,
//     which is the guest's language by design.
//   · the purple MODULE BAND — it is the deck's language, and it landed on the
//     app tabs. It belongs to HOME and the deck, nowhere else under src/app.
const DECK_HEADER_FILES = [
  'src/components/landing/LandingHeader.tsx',
  'src/components/landing/Landing.tsx',
  'src/components/landing/GuestLanding.tsx',
  'src/app/pricing/page.tsx',
  'src/app/modules/[pillar]/ModulePageClient.tsx',
  // SHELL-02: the cockpit mounts the DECK's header for a guest only; a signed-in
  // viewer gets AppLayout. One header per audience, neither of them bespoke.
  'src/components/home/HomeClient.tsx',
];
const SHELL_BAR = 'src/components/ui/ShellBar.tsx';
function walkSrc(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(resolve(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walkSrc(rel, out);
    else if (e.name.endsWith('.tsx')) out.push(rel);
  }
  return out;
}
const shellFiles = [...walkSrc('src/app'), ...walkSrc('src/components')];
// A sign-out: the words a viewer clicks to leave. A brand bar: the wordmark
// inside a <header>. Both are ShellBar's alone.
const SIGN_OUT = /(Sign out|Log out)</;
const BRAND_BAR = /<header[\s\S]{0,400}?Temple Stuart/;
const MODULE_BAND = /MODULE_BANDS\s*\[/;
let shellOffenders = 0;
for (const f of shellFiles) {
  if (f === SHELL_BAR) continue;
  const src = readFileSync(resolve(ROOT, f), 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
  if (!DECK_HEADER_FILES.includes(f)) {
    if (SIGN_OUT.test(code)) { shellOffenders += 1; violations.push(`shell: ${f} renders a sign-out — only ${SHELL_BAR} may (SHELL-02: one header)`); }
    if (BRAND_BAR.test(code)) { shellOffenders += 1; violations.push(`shell: ${f} renders a brand bar inside a <header> — only ${SHELL_BAR} may (SHELL-02: one header)`); }
  }
  // The band: HOME's own page may render it; nothing else under src/app.
  if (MODULE_BAND.test(code) && f.startsWith('src/app/') && !f.startsWith(`src/app${ANSWERS_HOME}/`)) {
    shellOffenders += 1;
    violations.push(`shell: ${f} renders the module band — it belongs to HOME (${ANSWERS_HOME}) and the deck (SHELL-02)`);
  }
}
if (existsSync(resolve(ROOT, 'src/components/ui/ShellFrame.tsx'))) {
  violations.push('shell: ShellFrame is back — AppLayout is the ONE wrapper (SHELL-02)');
}

// ── THE SHELL LAW, TIGHTENED: NESTING (ROOM-02) ────────────────────────────
// SHELL-02's checks above are MARKER checks: they look for the rendered markup
// of a header (a sign-out, a wordmark in a <header>, the module band), which
// only ShellBar.tsx contains — and ShellBar is skipped at the top of the loop.
// A component that MOUNTS <AppLayout/> renders none of those markers itself, so
// every one of them passed while six budget pages drew TWO headers and TWO
// rails (ROOM-01's finding: BudgetingPage mounted its own AppLayout inside
// pages that mounted one too, and /api/auth/me was fetched twice per load).
// The existsSync line above was the whole basis of "AppLayout is the one
// wrapper" — it only proves the OTHER wrapper file is gone, never how many
// AppLayouts a page mounts.
//
// So this checks the whole MOUNTED TREE, not the outermost wrapper: for every
// route, the page file plus every layout above it plus everything they import,
// transitively. A tree may hold at most ONE header and at most ONE rail.
//   · <AppLayout>            → one header, and one rail unless rail={false}
//   · <ShellBar>             → one header   (AnswersClient is HOME's own shell)
//   · <Rail>                 → one rail     (ModuleLauncher's select-mode rail)
// AppLayout.tsx itself is not counted: its ShellBar and Rail ARE the header and
// rail that `<AppLayout` already counted.
const APP_LAYOUT_FILE = 'src/components/ui/AppLayout.tsx';
const MOUNT_APP_LAYOUT = /<AppLayout(\s[^>]*)?>/g;
const MOUNT_SHELL_BAR = /<ShellBar[\s/>]/;
const MOUNT_RAIL = /<Rail[\s/>]/;

/** Resolve an import specifier to a file under src/, or null when it leaves the tree. */
function resolveImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith('.')) {
    const dir = fromFile.split('/').slice(0, -1);
    for (const part of spec.split('/')) {
      if (part === '.') continue;
      else if (part === '..') dir.pop();
      else dir.push(part);
    }
    base = dir.join('/');
  } else return null; // a package, not our code
  for (const cand of [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
    if (existsSync(resolve(ROOT, cand))) return cand;
  }
  return null;
}

const IMPORT_SPEC = /(?:^|\n)\s*(?:import|export)[\s\S]{0,400}?from\s+['"]([^'"]+)['"]/g;
const importsOf = new Map<string, string[]>();
function importsFor(file: string): string[] {
  const hit = importsOf.get(file);
  if (hit) return hit;
  let src = '';
  try { src = readFileSync(resolve(ROOT, file), 'utf8'); } catch { src = ''; }
  const out: string[] = [];
  for (const m of src.matchAll(IMPORT_SPEC)) {
    const r = resolveImport(file, m[1]);
    if (r) out.push(r);
  }
  importsOf.set(file, out);
  return out;
}

/**
 * Does this one file mount a header / a rail? At most ONE of each per file, on
 * purpose: a component routinely mounts <AppLayout> twice — once around a
 * loading spinner it returns early, once around its body — and those two are
 * mutually exclusive, never both on screen. The bug this law exists to catch is
 * TWO DIFFERENT FILES in one tree each bringing a shell. AppLayout.tsx is
 * excluded: its ShellBar and Rail ARE what `<AppLayout` already counts.
 */
function mountsOf(file: string): { header: boolean; rail: boolean } {
  if (file === APP_LAYOUT_FILE) return { header: false, rail: false };
  let src = '';
  try { src = readFileSync(resolve(ROOT, file), 'utf8'); } catch { return { header: false, rail: false }; }
  const code = src.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
  let header = false;
  let rail = false;
  for (const m of code.matchAll(MOUNT_APP_LAYOUT)) {
    header = true;
    // rail={false} is the declared opt-out: the child brings its own rail.
    if (!/rail=\{false\}/.test(m[1] ?? '')) rail = true;
  }
  if (MOUNT_SHELL_BAR.test(code)) header = true;
  if (MOUNT_RAIL.test(code)) rail = true;
  return { header, rail };
}

/** The layout files that wrap a page, outermost first. */
function layoutsFor(pageFile: string): string[] {
  const parts = pageFile.split('/');
  const out: string[] = [];
  for (let i = 2; i < parts.length; i += 1) {
    const cand = `${parts.slice(0, i).join('/')}/layout.tsx`;
    if (existsSync(resolve(ROOT, cand))) out.push(cand);
  }
  return out;
}

let nestedShells = 0;
for (const p of pages) {
  const roots = [...layoutsFor(p.file), p.file];
  const seen = new Set<string>();
  const stack = [...roots];
  let headers = 0;
  let rails = 0;
  const headerSites: string[] = [];
  const railSites: string[] = [];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const m = mountsOf(f);
    if (m.header) { headers += 1; headerSites.push(f); }
    if (m.rail) { rails += 1; railSites.push(f); }
    for (const next of importsFor(f)) stack.push(next);
  }
  if (headers > 1) {
    nestedShells += 1;
    violations.push(`shell: ${p.route} mounts ${headers} headers in one tree — ${headerSites.join(', ')}. A page renders ONE shell (ROOM-02: SHELL-02's marker checks could not see nesting)`);
  }
  if (rails > 1) {
    nestedShells += 1;
    violations.push(`shell: ${p.route} mounts ${rails} rails in one tree — ${railSites.join(', ')}. A page renders ONE rail; AppLayout takes rail={false} when the child brings its own (ROOM-02)`);
  }
}
const shellLine = `${shellFiles.length} files scanned, ${shellOffenders} outside ShellBar render a sign-out, a brand bar or the module band; ${DECK_HEADER_FILES.length} declared deck surfaces keep LandingHeader; AppLayout is the one wrapper; ${pages.length} page trees walked (page + every layout above it + everything they import).`;
// Never print a pass over a failure — the gate below exits, but a "✔ passed"
// line above it is the kind of output that reads as green in a build log.
if (shellOffenders || nestedShells) console.log(`✖ The shell law FAILED — ${shellLine} ${nestedShells} tree(s) mount more than one shell.`);
else console.log(`✔ The shell law passed — ${shellLine} Every tree mounts at most one header and one rail.`);

// ── THE TOOL LAW (TOOL-LAW-01) ──────────────────────────────────────────────
// ONE TOOL, ONE PAGE, ITS OWN PIPE. Five navigation PRs each partly undid the
// last on this surface because each fixed a symptom instead of stating the
// model. The disease is GROUPING LAYERS — a room, a step, a phase list invented
// to hold several tools at once. The model, stated:
//
//   1. A tool has ONE page. That page is its registry home and serves no other
//      tool.
//   2. That page renders ONLY that tool's own phases, from src/lib/pipePhases.ts,
//      via the shared StageStrip. NOTE: this does NOT require a PAGE-LEVEL
//      strip. Tasks' projects strip is per project row and behind that row's own
//      pipelineMode toggle (TruthMachineView.tsx:374-376, ProjectRow.tsx:556);
//      that is where the strip already lives and it satisfies this rule. Do not
//      add a page-level strip to satisfy a requirement this rule does not make.
//   3. A tool's page opens with its family, its name and its registry line. No
//      other prose. (ToolOpener is the one opener; a `line` prop is the room's
//      own words about itself, never a second heading for a grouping layer.)
//   4. A phase list defined OUTSIDE pipePhases.ts and rendered as a strip is a
//      violation. This is what killed /operations: six cells named in
//      src/lib/operationsPhases.ts that existed in no pipe.
//   5. A component belonging to tool A may not be mounted on tool B's page. The
//      CALENDAR clause names the MERGED GRID specifically — HubCalendar, the
//      view over trip events, plan blocks and routine occurrences. Only that
//      component may not be mounted outside /calendar. CalendarGrid is a SHARED
//      PRIMITIVE and is excluded: /trading:887 has fed it Trade Log's own P&L
//      rows since long before this law. EXPLICIT NON-VIOLATION: DayCalendarView
//      (src/components/workbench/operations/content/DayCalendarView.tsx) renders
//      the day's blocks as "a dense, ONE-LINE stacked list in clock order (NOT
//      an hour-grid)" — its own words — as the content pipe's phase 03 surface.
//      It is Time's, it is not the merged grid, and it is not a violation.
//
// THE GRANDFATHER LIST is closed. Each entry is named, dated and reasoned, and
// THE ALLOWLIST MAY ONLY SHRINK — the build throws if it grows.
const MULTI_TOOL_ALLOWED: ReadonlyArray<{ route: string; tools: readonly string[]; since: string; why: string; retire: string }> = [
  {
    route: '/trading', tools: ['Brokerage', 'Trade Log'], since: '2026-09-10 (NAV-25)',
    why: 'the trade pipe is ONE StageStrip inside one page; 01-03 are Brokerage\'s and 04-06 Trade Log\'s, split at the existing phase boundary but rendered by one control',
    retire: 'split the trade pipe\'s strip so each tool renders its own three phases — an interior change to src/app/trading/page.tsx',
  },
];
// RULE 2's one exception: a page rendering a phase another tool owns. /books is
// NOT a multi-tool page (Bookkeeping is its only tool — Banking's screen is
// /accounts), so it is not grandfathered above; what it does is render books 01
// Feed, which THE SORT gives Banking. Closed and shrink-only, same as rule 1's.
const FOREIGN_PHASE_ALLOWED: ReadonlyArray<{ route: string; pipe: string; num: string; owner: string; since: string; why: string; retire: string }> = [
  {
    route: '/books', pipe: 'books', num: '01', owner: 'Banking', since: '2026-09-10 (NAV-25)',
    why: 'BooksPipeline renders books 01 Feed (Banking\'s) and 02-06 (Bookkeeping\'s) with one strip and one shared data layer; it takes no phase-range prop',
    retire: 'lift 01 Feed out of BooksPipeline (733 lines) so Banking renders it on /accounts',
  },
];
// The cockpit is the third grandfathered surface and is checked by route below:
// ModuleLauncher renders every cockpit tab as a CSS-hidden section of ONE
// component, so /books, /tax, /travel and /runway are its tabs, not pages.
const COCKPIT_COMPONENT = 'src/components/home/ModuleLauncher.tsx';
// THE MERGED GRID is HubCalendar — the one component that fetches the three
// sources (trip events, daily-plan blocks, routine occurrences) and merges them.
// CalendarGrid is NOT on this list and deliberately so: it is a SHARED
// PRIMITIVE, and Trade Log's P&L calendar has fed it its own rows since long
// before this law (src/app/trading/page.tsx:887 — plCalendarEvents,
// PL_SOURCE_CONFIG). Naming it here would break /trading for no gain: a grid
// component is not a calendar, the three merged sources are.
const MERGED_GRID = ['src/components/hub/HubCalendar.tsx'];
const CALENDAR_HOME = '/calendar';
// /accounts was on NAV-25's list as Banking + Books' Feed; with 01 Feed recorded
// against /books above it serves ONE tool, so it is NOT grandfathered here.

let toolViolations = 0;
const toolRows = navRows(TOOL_GATE);
// 1. one tool, one page
const screenTools = new Map<string, string[]>();
for (const t of toolRows) if (t.href) screenTools.set(t.href, [...(screenTools.get(t.href) ?? []), t.name]);
for (const [route, tools] of screenTools) {
  if (tools.length === 1) continue;
  const entry = MULTI_TOOL_ALLOWED.find((a) => a.route === route);
  if (!entry) {
    toolViolations += 1;
    violations.push(`tool law 1: ${route} is ${tools.length} tools' page (${tools.join(' + ')}) and is not on the grandfather list — one tool, one page (TOOL-LAW-01)`);
  } else if (entry.tools.join('|') !== tools.join('|')) {
    toolViolations += 1;
    violations.push(`tool law 1: ${route} is grandfathered for ${entry.tools.join(' + ')} but now serves ${tools.join(' + ')} — the allowlist may only shrink (TOOL-LAW-01)`);
  }
}
// the allowlist may only SHRINK: every entry must still be a real multi-tool page
for (const a of MULTI_TOOL_ALLOWED) {
  if (!screenTools.has(a.route)) {
    toolViolations += 1;
    violations.push(`tool law 1: ${a.route} is on the grandfather list but is no tool's screen — remove the entry (TOOL-LAW-01)`);
  } else if ((screenTools.get(a.route) ?? []).length < 2) {
    toolViolations += 1;
    violations.push(`tool law 1: ${a.route} is on the grandfather list but serves one tool now — remove the entry; the allowlist may only shrink (TOOL-LAW-01)`);
  }
  for (const f of ['route', 'since', 'why', 'retire'] as const) {
    if (!a[f]?.trim()) { toolViolations += 1; violations.push(`tool law 1: the grandfather entry ${a.route} has no ${f} — each entry is named, dated and reasoned (TOOL-LAW-01)`); }
  }
}
if (MULTI_TOOL_ALLOWED.length > 1) {
  toolViolations += 1;
  violations.push(`tool law 1: the multi-tool grandfather list has ${MULTI_TOOL_ALLOWED.length} entries — TOOL-LAW-01 closed it at 1 and THE ALLOWLIST MAY ONLY SHRINK`);
}
if (FOREIGN_PHASE_ALLOWED.length > 1) {
  toolViolations += 1;
  violations.push(`tool law 2: the foreign-phase grandfather list has ${FOREIGN_PHASE_ALLOWED.length} entries — TOOL-LAW-01 closed it at 1 and THE ALLOWLIST MAY ONLY SHRINK`);
}
for (const a of FOREIGN_PHASE_ALLOWED) {
  for (const f of ['route', 'pipe', 'num', 'owner', 'since', 'why', 'retire'] as const) {
    if (!a[f]?.trim()) { toolViolations += 1; violations.push(`tool law 2: the foreign-phase entry ${a.route} has no ${f} — each entry is named, dated and reasoned (TOOL-LAW-01)`); }
  }
  if (!THE_SORT.some((x) => x.pipe === a.pipe && x.num === a.num && x.owner === a.owner)) {
    toolViolations += 1;
    violations.push(`tool law 2: the foreign-phase entry ${a.route} says ${a.pipe} ${a.num} is ${a.owner}'s, which THE SORT does not — the exception must describe the real world (TOOL-LAW-01)`);
  }
}
// 2 + 4. every StageStrip reads pipePhases.ts, and no other phase list is a strip
const stripFiles = shellFiles.filter((f) => readFileSync(resolve(ROOT, f), 'utf8').includes('<StageStrip'));
console.log('THE TOOL LAW — every phase strip and the pipe it reads');
for (const f of stripFiles.sort()) {
  const src = readFileSync(resolve(ROOT, f), 'utf8');
  const pipes = [...new Set([...src.matchAll(/PIPE_PHASES\.([a-z]+)/g)].map((m) => m[1]))];
  console.log(`  ${f.padEnd(62)} ${pipes.length ? pipes.join(' · ') : 'NO PIPE'}`);
  if (pipes.length === 0) {
    toolViolations += 1;
    violations.push(`tool law 4: ${f} renders a StageStrip from a phase list that is not in src/lib/pipePhases.ts — an invented phase list is a grouping layer (TOOL-LAW-01)`);
  }
}
// the room must stay gone
for (const gone of ['src/lib/operationsPhases.ts', 'src/app/operations/OperationsRoom.tsx', 'src/app/operations/page.tsx']) {
  if (existsSync(resolve(ROOT, gone))) {
    toolViolations += 1;
    violations.push(`tool law 4: ${gone} is back — /operations was six invented cells holding four tools' components; one tool, one page (TOOL-LAW-01)`);
  }
}
// 2. a tool's page renders only ITS OWN phases (the strip may be page-level or
// per row — this rule does not care which, only whose the phases are).
for (const [route, tools] of screenTools) {
  const page = pages.find((p) => p.route === route);
  if (!page) continue;
  const seen = new Set<string>();
  const stack = [page.file];
  const pipesHere = new Set<string>();
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const body = existsSync(resolve(ROOT, f)) ? readFileSync(resolve(ROOT, f), 'utf8') : '';
    if (body.includes('<StageStrip')) for (const m of body.matchAll(/PIPE_PHASES\.([a-z]+)/g)) pipesHere.add(m[1]);
    for (const next of importsFor(f)) stack.push(next);
  }
  for (const pipe of pipesHere) {
    for (const a of THE_SORT.filter((x) => x.pipe === pipe)) {
      if (tools.includes(a.owner)) continue;
      if (FOREIGN_PHASE_ALLOWED.some((x) => x.route === route && x.pipe === pipe && x.num === a.num && x.owner === a.owner)) continue;
      toolViolations += 1;
      violations.push(`tool law 2: ${route} (${tools.join(' + ')}) renders ${pipe} ${a.num}, which is ${a.owner}'s — a tool's page renders only its own phases (TOOL-LAW-01)`);
    }
  }
}

// 5. the merged grid mounts in exactly ONE place: Calendar's page
const calendarPage = pages.find((p) => p.route === CALENDAR_HOME);
for (const p of pages) {
  if (p.route === CALENDAR_HOME) continue;
  const tools = screenTools.get(p.route);
  if (!tools) continue; // not a tool's page — the cockpit and legacy pages are checked by their own laws
  const seen = new Set<string>();
  const stack = [p.file];
  let mountsGrid: string | null = null;
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    if (MERGED_GRID.includes(f)) { mountsGrid = f; break; }
    for (const next of importsFor(f)) stack.push(next);
  }
  if (mountsGrid) {
    toolViolations += 1;
    violations.push(`tool law 5: ${p.route} (${tools.join(' + ')}) pulls in ${mountsGrid} — the merged grid is Calendar's and mounts only on ${CALENDAR_HOME} (TOOL-LAW-01)`);
  }
}
if (!calendarPage) { toolViolations += 1; violations.push(`tool law 5: ${CALENDAR_HOME} has no page — the merged grid has nowhere to be (TOOL-LAW-01)`); }
if (!existsSync(resolve(ROOT, COCKPIT_COMPONENT))) { toolViolations += 1; violations.push(`tool law: ${COCKPIT_COMPONENT} is missing — the cockpit's grandfathered tabs are checked against it`); }
// ── THE CITATION LAW (BOOKS-PIPE-01) ────────────────────────────────────────
// A registry `citation` is INTERNAL EVIDENCE for these laws — a list of
// file:line pairs proving a tool's beats. It is not customer copy, and it must
// never reach a rendered surface. It did: nav.ts's `line` fell back to it when
// a tool had no `why`, and ToolOpener printed it verbatim on SEVEN tool pages
// (Travel, Banking, Brokerage, Trade Log, Bookkeeping, Tax, Compliance), while
// TheSheet printed it on HOME. Both now read `why` or nothing.
//
// The registry itself, its tests and these scripts may read the field; nothing
// that renders may.
const CITATION_ALLOWED = [
  'src/lib/toolRegistry.ts',   // the field's own home
  'src/lib/problemSheet.ts',
];
// Compliance renders LEGAL citations of its own — citation_string, citation_key,
// a TaskCitation's `.citation`, a `citations` array from the discovery API. A
// different thing entirely, and none of it is the registry's field. The
// discriminator is not the word: it is whether a ToolEntry can be in scope at
// all, which requires importing the registry or the nav model. Compliance's
// pages import neither.
const REGISTRY_IMPORT = /from '@\/lib\/(toolRegistry|nav)'|from '\.\.?\/(toolRegistry|nav)'/;
let citationLeaks = 0;
for (const f of shellFiles) {
  if (CITATION_ALLOWED.includes(f)) continue;
  const body = readFileSync(resolve(ROOT, f), 'utf8');
  if (!REGISTRY_IMPORT.test(body)) continue;
  const code = body.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
  // Any read of the field, however it is reached: `t.citation`, `x?.citation`,
  // `find(...)?.citation`, `['citation']`. The import guard above already
  // excludes Compliance's legal citations, so this can be as wide as it needs.
  const hits = [...code.matchAll(/\??\.citation\b|\['citation'\]|\["citation"\]/g)].map((m) => m[0]);
  if (!hits.length) continue;
  citationLeaks += 1;
  violations.push(`citation law: ${f} reads a registry citation (${hits.join(', ')}) — a citation is file:line evidence for these laws, never customer copy (BOOKS-PIPE-01)`);
}
// nav.ts must not hand it on either.
const NAV_FILE = 'src/lib/nav.ts';
const navBody = readFileSync(resolve(ROOT, NAV_FILE), 'utf8');
if (/line:\s*tool\.why[^\n]*tool\.citation/.test(navBody)) {
  citationLeaks += 1;
  violations.push(`citation law: ${NAV_FILE} falls back to the citation for a tool's rendered line — a tool with no \`why\` gets no line (BOOKS-PIPE-01)`);
}
if (citationLeaks) console.log(`✖ The citation law FAILED — ${citationLeaks} file(s) can render a registry citation.`);
else console.log(`✔ The citation law passed — ${shellFiles.length} rendered files scanned, 0 read a registry citation; ${CITATION_ALLOWED.length} declared holders of the field.`);

// ── THE OPENER LAW (BOOKS-PIPE-01) ──────────────────────────────────────────
// An opener lists only the phases ITS PAGE DRAWS. nav.ts declares that per
// route (PHASES_RENDERED_AT); this checks every entry against the real strip
// census, so the declaration cannot drift from the code.
console.log('THE OPENER — what each tool page advertises vs what it draws');
let openerViolations = 0;
for (const [route, tools] of screenTools) {
  const page = pages.find((p) => p.route === route);
  if (!page) continue;
  const seen = new Set<string>();
  const stack = [page.file];
  const drawn = new Set<string>();
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const body = existsSync(resolve(ROOT, f)) ? readFileSync(resolve(ROOT, f), 'utf8') : '';
    if (body.includes('<StageStrip')) for (const m of body.matchAll(/PIPE_PHASES\.([a-z]+)/g)) drawn.add(m[1]);
    for (const next of importsFor(f)) stack.push(next);
  }
  const declared = [...(PHASES_RENDERED_AT[route] ?? [])].sort();
  const real = [...drawn].sort();
  const owned = [...new Set(toolRows.filter((t) => t.href === route).flatMap((t) => t.phases.map((p) => p.pipe)))].sort();
  const elsewhere = owned.filter((p) => !real.includes(p));
  console.log(`  ${route.padEnd(13)} ${tools.join(' + ').padEnd(24)} draws [${real.join(' ') || '—'}]  owns [${owned.join(' ') || '—'}]${elsewhere.length ? `  drawn elsewhere: ${elsewhere.join(' ')}` : ''}`);
  if (declared.join('|') !== real.join('|')) {
    openerViolations += 1;
    violations.push(`opener law: ${route} declares it draws [${declared.join(' ') || '—'}] but its tree draws [${real.join(' ') || '—'}] — nav.ts PHASES_RENDERED_AT must match the code (BOOKS-PIPE-01)`);
  }
}
for (const route of Object.keys(PHASES_RENDERED_AT)) {
  if (!screenTools.has(route)) {
    openerViolations += 1;
    violations.push(`opener law: PHASES_RENDERED_AT names ${route}, which is no tool's screen (BOOKS-PIPE-01)`);
  }
}
if (openerViolations) console.log(`✖ The opener law FAILED — ${openerViolations} route(s) advertise a pipeline they do not draw.`);
else console.log(`✔ The opener law passed — ${screenTools.size} tool pages, every one advertising only the phases it draws.`);

if (toolViolations) console.log(`✖ The tool law FAILED — ${toolViolations} violation(s).`);
else console.log(`✔ The tool law passed — ${screenTools.size} tool pages, ${MULTI_TOOL_ALLOWED.length} grandfathered (closed, shrink-only); ${stripFiles.length} phase strips, every one reading src/lib/pipePhases.ts; the merged grid mounts only on ${CALENDAR_HOME}.`);

// ── THE LOCK LAW (LOCK-01) ────────────────────────────────────────────────
// (a) EVERY page that mounts a paid module's root component asks for its key
//     first. src/app/dashboard/tax-filing/page.tsx mounted the FULL filing
//     wizard with no check at all: an account holding nothing got the whole
//     wizard at that URL. The table below is the component → key map; a page
//     that mounts one of them without naming a gate fails the build.
// (b) NO offer inside the app. The offer card, its price line and its billing
//     copy belong at /pricing and on the deck; a locked step shows its room.
const PAID_COMPONENTS: ReadonlyArray<{ component: string; key: string }> = [
  { component: 'TaxFilingWizard', key: 'tab:tax' },
  { component: 'BooksPipeline', key: 'tab:books' },
  { component: 'ConvergenceIntelligence', key: 'tab:trade' },
  { component: 'TradeLabPanel', key: 'tab:trade' },
  { component: 'COAManagementTable', key: 'tab:books' },
  { component: 'BookkeepingSection', key: 'tab:books' },
  { component: 'ComplianceWorkbench', key: 'tab:compliance' },
];
// The gate is one of the two twins — the server's roomGate/hasTabAccess or the
// client's useTabLock/isTabLocked — and both resolve through keysGranting.
const GATE_MARK = /(roomGate|useTabLock|hasTabAccess|isTabLocked)\s*\(/;
const OFFER_ALLOWLIST = [
  'src/app/pricing/',
  'src/components/landing/',
  'src/app/modules/',
  // The offer card itself and the tab card that renders it — leaves the deck imports.
  'src/components/OfferCard.tsx',
  'src/components/home/LockedTabCard.tsx',
  'src/components/home/TabShowcases.tsx',
  'src/components/home/TabShowcaseTemplate.tsx',
  'src/components/home/ComplianceShowcaseSections.tsx',
];
const BILLING_COPY = /(BILLED MONTHLY|CANCEL ANYTIME|Billed monthly|Cancel anytime)/;
const OFFER_MOUNT = /<LockedTabCard\b/;
let ungated = 0;
let offerInApp = 0;
for (const f of shellFiles) {
  const src = readFileSync(resolve(ROOT, f), 'utf8');
  const code = src.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
  if (f.endsWith('/page.tsx')) {
    for (const { component, key } of PAID_COMPONENTS) {
      if (!new RegExp(`<${component}\\b`).test(code)) continue;
      if (!GATE_MARK.test(code)) {
        ungated += 1;
        violations.push(`lock: ${f} mounts ${component} (${key}) with no entitlement check — every paid surface asks for its key (LOCK-01)`);
      }
    }
  }
  if (OFFER_ALLOWLIST.some((a) => f.startsWith(a))) continue;
  if (BILLING_COPY.test(code)) {
    offerInApp += 1;
    violations.push(`lock: ${f} carries billing copy — the offer lives at /pricing and on the deck, never inside the app (LOCK-01)`);
  }
  if (OFFER_MOUNT.test(code)) {
    offerInApp += 1;
    violations.push(`lock: ${f} renders LockedTabCard — a locked step shows its room, not a sales pitch (LOCK-01)`);
  }
}
console.log(`✔ The lock law passed — ${PAID_COMPONENTS.length} paid components mapped to their keys, ${ungated} page(s) mount one without a check; ${offerInApp} file(s) outside /pricing and the deck carry an offer or billing copy.`);
console.log(`✔ The offer law passed — ${OFFERS.length} offers over ${new Set(OFFERS.flatMap((o) => o.tools)).size} tools (LIVE or PARTIAL only), ${FREE_TOOLS.length} free; the purchasable keys are the offers'; "built and running" typed nowhere but offer.ts; ${SELLING_SURFACES.length} selling surfaces render the offer.`);

// ── THE SECOND GATE ─────────────────────────────────────────────────────────
// Every law below the first gate — kind views, arrivals, the rule book,
// posting, env, the observatory, the offer — pushes onto `violations`. Without
// this, those pushes were printed by nothing and failed nothing. A law that
// cannot fail the build is not a law.
if (violations.length > raised) {
  console.error('\n✖ BUILD LAW FAILED:');
  for (const v of violations.slice(raised)) console.error(`  ${v}`);
  process.exit(1);
}
