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
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readdirSync, statSync } from 'node:fs';
import { code as codeOf, comments as commentsOf, rejoin } from '../src/lib/sourceText';
import { CHAIN_STATES, KIND_FACTS, EVENT_SOURCE_OWNER, buildChain } from '../src/lib/calendar/chain';
import { LINKABLE_KINDS, requiresInstant } from '../src/lib/calendar/linkKeys';
import { sumLinks } from '../src/lib/calendar/links';
import { routinePlanned } from '../src/lib/operations/routineLines';
import { MARKER_MINUTES, assignLanes, blockExtent, unverifiedDurationExtent } from '../src/lib/calendar/extent';
import { clockOfTime, overlayTripItems, type TripItemRow, type TripOverlayEvent } from '../src/lib/calendar/tripItem';
import { BOOKING_FLOW_BASE, BOOKING_FLOW_FILES, bookingFlowSha256 } from '../src/lib/travelBookingFlow';
import { classifyCadence, compileFormToRRule, expandBetween, expandForward, scheduleAnchor } from '../src/lib/operations/rruleHelpers';
import { DEFAULT_ROUTINE_FORM } from '../src/components/workbench/operations/routines/types';
import { PROBLEM_SHEET } from '../src/lib/problemSheet';
import { EXPECTED_STATUS_COUNTS, FAMILY_READS, TOOL_REGISTRY, registryLaw, statusCounts } from '../src/lib/toolRegistry';
import { HOME_ANSWER, HOME_OWNER, HOME_PHASES, PHASES_RENDERED_AT, THE_SORT, navFamilies, navLaw, navRows } from '../src/lib/nav';
import { TOOL_GATE } from '../src/lib/offer';
import { PIPE_PHASES } from '../src/lib/pipePhases';
import { INPUT_SIGNS, buyerAdmittedInputs } from '../src/lib/convergence/input-signs';
import { GATE_CARDS, NOT_BUILT_STRATEGIES, README_GATE_CARDS_END, README_GATE_CARDS_START, gateCardsMarkdown } from '../src/lib/convergence/gateCards';
import { AVAILABLE_STRATEGIES } from '../src/lib/convergence/filter-types';
import { CALENDAR_SOURCES, EXCLUDED_CALENDAR_SOURCES, MANUAL_EVENT_SOURCE } from '../src/lib/calendar/sources';
import { EVENT_CATEGORIES } from '../src/lib/calendar/manualEvent';
import { buildCboeRegimeInputs } from '../src/lib/convergence/regime';
import { SNAPSHOT_SUGGESTED_STRATEGY_MAX } from '../src/lib/convergence/snapshot-logger';
import { ETF_UNIVERSE_SYMBOLS } from '../src/lib/convergence/etf-universe';
import { DEEP_FETCH_MULTIPLIER, SCAN_LIMIT_DEFAULT, STRUCTURE_CUT } from '../src/lib/convergence/funnel';
import { structureCutEligibility } from '../src/lib/convergence/structure-cut';
import { MODEL_NUMBER_TOOLTIP } from '../src/lib/convergence/modelLabels';
import { OWNER_UTILITIES } from '../src/lib/shellMenu';
import { ANSWERS_HOME, ANSWER_READS, ANSWER_ROWS, NET_WORTH_READ, answersLaw } from '../src/lib/answers';
import { ARRIVAL_KINDS, PROVIDERS, PROVIDER_CODES, ROUTING_RULES, RULE_BOOK, providersLaw, ruleFor } from '../src/lib/providers';
import { KIND_VIEWS_HONEST_LINE, KIND_VIEW_CENSUS, STOPPED_TABLES, VIEW_COLUMNS, kindOfTable, kindViewsLaw, latestViews, latestViewsSql, parseViews } from '../src/lib/kindViews';
// SELL-02: the offer law — every sales claim from the registry, every price from one source.
import { FREE_TOOLS, OFFERS, TOOL_GATE, heroCountsLine, offerCard, offerLaw, priceEnvName } from '../src/lib/offer';
import { DYNAMIC_READ_ENV, LIBRARY_READ_ENV } from '../src/lib/envLaw';
import { EXPECTED_FEED_COUNT, FEED_COST, FEED_IDS, SCAN_COST, feedCostLaw, scanCostLine } from '../src/lib/observatory/feedCost';
import { FINNHUB_TTL, finnhubCallsPerSymbol, finnhubTtlLaw, slowTierEndpoints } from '../src/lib/convergence/finnhub-ttl';
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
  const src = codeOf(file);
  const m = src.match(/redirect\(\s*['"`]([^'"`]+)['"`]\s*\)/);
  return m ? m[1] : null;
}

const ROOT = resolve(__dirname, '..');

function tabAllowlist(): Set<string> {
  const src = codeOf('src/app/[tab]/page.tsx');
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
  const read = (f: string) => (existsSync(resolve(ROOT, f)) ? codeOf(f) : '');
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
const railSrc = existsSync(resolve(ROOT, RAIL)) ? codeOf(RAIL) : '';
const sheetSrc = existsSync(resolve(ROOT, SHEET)) ? codeOf(SHEET) : '';
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
const homeSrc = codeOf(HOME_CLIENT);
if (!homeSrc.includes('<TheSheet />')) violations.push(`${HOME_CLIENT} must render the sheet below the answers (SHELL-01)`);
if (!homeSrc.includes('<Rail ')) violations.push(`${HOME_CLIENT} must render the rail`);

// ── THE ANSWERS LAW (NAV-01c) ───────────────────────────────────────────────
violations.push(...answersLaw({ throwOnFail: false }));
const ANSWERS_PAGE = `src/app${ANSWERS_HOME}/page.tsx`;
const ANSWERS_CLIENT = 'src/components/answers/AnswersClient.tsx';
if (!existsSync(resolve(ROOT, ANSWERS_PAGE))) violations.push(`${ANSWERS_HOME} has no page file (${ANSWERS_PAGE})`);
const clientSrc = existsSync(resolve(ROOT, ANSWERS_CLIENT)) ? codeOf(ANSWERS_CLIENT) : '';
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
const schemaText = codeOf('prisma/schema.prisma');
const migrationDir = readdirSync(resolve(ROOT, 'prisma/migrations')).find((d) => d.endsWith('_arrivals'));
const migrationSql = migrationDir ? codeOf(`prisma/migrations/${migrationDir}/migration.sql`) : '';
if (!migrationDir) violations.push('arrivals: no prisma/migrations/*_arrivals/migration.sql');

const enumBlock = schemaText.match(/enum arrival_provider \{\n([\s\S]*?)\n\}/);
const enumValues = enumBlock ? enumBlock[1].split('\n').map((l) => l.trim()).filter(Boolean) : [];
if (enumValues.join(',') !== PROVIDER_CODES.join(',')) violations.push(`arrivals: enum arrival_provider [${enumValues.join(' ')}] ≠ providers.ts codes [${PROVIDER_CODES.join(' ')}]`);
const typeValues = migrationSql.match(/CREATE TYPE arrival_provider AS ENUM \((.*?)\);/)?.[1].split(', ').map((v) => v.replace(/^'|'$/g, '')) ?? [];
if (typeValues.join(',') !== PROVIDER_CODES.join(',')) violations.push(`arrivals: migration CREATE TYPE arrival_provider [${typeValues.join(' ')}] ≠ providers.ts codes`);

/** Every migration.sql, in migration order — the ALTER TABLE … ADD COLUMN / SET NOT NULL a table gained after its CREATE TABLE. */
const ALL_MIGRATIONS = readdirSync(resolve(ROOT, 'prisma/migrations')).sort()
  .filter((d) => existsSync(resolve(ROOT, 'prisma/migrations', d, 'migration.sql')))
  // TEST-TRUTH-01: the kind-views law compares the WHOLE artefact (the generator
  // emits `-- kind: tables` headers), so the two halves are read and rejoined.
  .map((d) => ({ dir: d, sql: rejoin(codeOf(`prisma/migrations/${d}/migration.sql`), commentsOf(`prisma/migrations/${d}/migration.sql`)) }));

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
const srcFiles = tsFiles(resolve(ROOT, 'src')).map((abs) => ({ file: abs.replace(`${ROOT}/`, ''), src: codeOf(abs.replace(`${ROOT}/`, '')) }));
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
  const src = codeOf(f);
  if (!src.includes("from '@/lib/offer'") || !src.includes("from '@/components/OfferCard'")) violations.push(`offer: ${f} must render the offer (import src/lib/offer.ts and OfferCard) — never a typed claim or price`);
}
if (existsSync(resolve(ROOT, 'src/config/pricingModel.ts'))) violations.push('offer: src/config/pricingModel.ts still exists — the offer is the one price source');
if (existsSync(resolve(ROOT, 'docs/FREEMIUM-MODEL.md'))) violations.push('offer: docs/FREEMIUM-MODEL.md still exists — the offer (and /pricing) states the model');
const pricingPage = codeOf('src/app/pricing/page.tsx');
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
const readmeText = codeOf('README.md');
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
const landingSrc = codeOf('src/components/landing/Landing.tsx');
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
  const src = codeOf(rel);
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
  ? codeOf(`${OBSERVATORY_DIR}/DataObservatory.tsx`)
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
// ── THE FINNHUB CACHE LAW (TRADE-COST-01) ──────────────────────────────────
// Slow data is fetched once. Every slow-tier Finnhub endpoint named in the TTL
// const (src/lib/convergence/finnhub-ttl.ts) is called ONLY through the cache
// helper (src/lib/convergence/finnhub-cache.ts): a URL for one of them built
// anywhere else under src — `…/api/v1/<endpoint>?`, `${BASE}/<endpoint>?` — is
// a metered call the store cannot see, and the build throws naming the file.
// Comment lines are stripped first (a citation is not a call). The helper
// itself must be the one place the base URL and the path are joined, or the
// law guards nothing. The cost line prints COLD and WARM, both read from the
// census.
const FINNHUB_CACHE_HELPER = 'src/lib/convergence/finnhub-cache.ts';
violations.push(...finnhubTtlLaw({ throwOnFail: false }).map((v) => `finnhub cache law (ttl const): ${v}`));
const helperSrc = existsSync(resolve(ROOT, FINNHUB_CACHE_HELPER)) ? codeOf(FINNHUB_CACHE_HELPER) : '';
if (!helperSrc) violations.push(`finnhub cache law: ${FINNHUB_CACHE_HELPER} is missing — the one place a Finnhub URL is built`);
else {
  if (!/FINNHUB_BASE = 'https:\/\/finnhub\.io\/api\/v1'/.test(helperSrc)) violations.push(`finnhub cache law: ${FINNHUB_CACHE_HELPER} does not declare FINNHUB_BASE — the base and the path join here or nowhere`);
  if (!/\$\{FINNHUB_BASE\}\/\$\{endpoint\}\?/.test(helperSrc)) violations.push(`finnhub cache law: ${FINNHUB_CACHE_HELPER} does not build the URL from FINNHUB_BASE and the endpoint`);
  for (const must of ['export async function finnhubCached', 'export async function finnhubDirect', 'store.get(', 'store.put(', 'stale']) {
    if (!helperSrc.includes(must)) violations.push(`finnhub cache law: ${FINNHUB_CACHE_HELPER} lacks ${must}`);
  }
}
const escapeRe = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
let slowTierUrlsOutside = 0;
for (const { file, src } of srcFiles) {
  if (file === FINNHUB_CACHE_HELPER) continue;
  const bare = src.split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
  for (const endpoint of slowTierEndpoints()) {
    // a URL for this endpoint: the vendor host path, or a base constant, then the path, then the query
    const url = new RegExp(`(finnhub\\.io\\/api\\/v1|\\$\\{[A-Za-z_]+\\}|\\})\\/${escapeRe(endpoint)}\\?`);
    if (url.test(bare)) {
      slowTierUrlsOutside += 1;
      violations.push(`finnhub cache law: ${file} builds a URL for ${endpoint} outside ${FINNHUB_CACHE_HELPER} — a slow-tier call the store cannot see (TRADE-COST-01)`);
    }
  }
}
if (slowTierUrlsOutside === 0) {
  const warm = SCAN_COST.find((c) => c.provider === 'Finnhub');
  console.log(`✔ The Finnhub cache law passed — ${slowTierEndpoints().length} slow-tier endpoints (${FINNHUB_TTL.filter((r) => r.ttlMs > 0).map((r) => r.tier).filter((t, i, a) => a.indexOf(t) === i).join(' · ')}) are called only through ${FINNHUB_CACHE_HELPER}; ${srcFiles.length} files checked. One symbol, one scan: COLD ${finnhubCallsPerSymbol('cold')} Finnhub · WARM ${finnhubCallsPerSymbol('warm')} Finnhub (${warm?.callsPerSymbol}/${warm?.warmCallsPerSymbol} in SCAN_COST).`);
}
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
  const src = codeOf(f);
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
  try { src = codeOf(file); } catch { src = ''; }
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
  try { src = codeOf(file); } catch { return { header: false, rail: false }; }
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

// ── THE FOUNDER-BROKER LAW (TT-01) ──────────────────────────────────────────
// The convergence scanner's TastyTrade client is the ENV client — the founder's
// own OAuth grant (src/lib/tastytrade.ts:7-13). No per-user credential exists
// (connect/route.ts:59-60 stores the literal 'oauth'). Until TT-02 lands a real
// per-user flow, NO NON-ADMIN PATH MAY REACH getTastytradeClient() THROUGH THE
// SCAN: every route that drives the pipeline gates on requireAdmin() BEFORE its
// cache read and BEFORE runPipeline, and the scan cache is keyed by the user.
//
// DEFERRED (TT-02): the ruled import law — "no file under src/lib/convergence
// may import the env-backed factory" — CANNOT pass today: chain-fetcher.ts:142,
// data-fetchers.ts:2347, pipeline.ts:381 and outcome-tracker.ts:160 have no
// per-user client to import instead, because none exists. Enforcing it now
// would fail every build with no legal fix. It lands with TT-02's client.
// walkSrc collects .tsx only; API routes are .ts, so walk them here.
function walkRoutes(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(resolve(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walkRoutes(rel, out);
    else if (e.name === 'route.ts' || e.name === 'route.tsx') out.push(rel);
  }
  return out;
}
const SCAN_DRIVERS: string[] = [];
for (const f of walkRoutes('src/app/api')) {
  const body = codeOf(f);
  if (/from '@\/lib\/convergence\/pipeline'/.test(body) && /runPipeline\(/.test(body.split('\n').filter((l) => !/^\s*(\*|\/\/)/.test(l)).join('\n'))) SCAN_DRIVERS.push(f);
}
let brokerViolations = 0;
for (const f of SCAN_DRIVERS) {
  const code = codeOf(f);
  const gateAt = code.indexOf('requireAdmin()');
  const runAt = code.indexOf('runPipeline(');
  const cacheAt = code.search(/(?<!function )getFromCache\(/);
  if (gateAt < 0) { brokerViolations += 1; violations.push(`founder-broker law: ${f} drives the scan without requireAdmin() — a non-admin would spend the founder's broker (TT-01)`); continue; }
  if (runAt >= 0 && gateAt > runAt) { brokerViolations += 1; violations.push(`founder-broker law: ${f} calls runPipeline before requireAdmin() — the gate must come first (TT-01)`); }
  if (cacheAt >= 0 && gateAt > cacheAt) { brokerViolations += 1; violations.push(`founder-broker law: ${f} reads the scan cache before requireAdmin() — a refused viewer must get nothing computed (TT-01)`); }
  if (/function getCacheKey\(/.test(code) && !/function getCacheKey\(userId/.test(code)) { brokerViolations += 1; violations.push(`founder-broker law: ${f} keys the scan cache without the user — one user's scan_snapshots-derived rows were served to another (TT-01)`); }
}
if (SCAN_DRIVERS.length === 0) { brokerViolations += 1; violations.push('founder-broker law: no route drives runPipeline — the scan entry moved and this law no longer watches it (TT-01)'); }
if (brokerViolations) console.log(`✖ The founder-broker law FAILED — ${brokerViolations} violation(s).`);
else console.log(`✔ The founder-broker law passed — ${SCAN_DRIVERS.length} scan driver(s) gate on requireAdmin() before the cache and the pipeline, and key the cache by user. The convergence-import law is DEFERRED to TT-02 (no per-user client exists to import).`);


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
//      CAL-OPEN-01 (2026-09-18): /calendar mounts NO opener. The founder ruled
//      the tab self-evident and its two paragraphs — the registry `why` and a
//      `line` prop — gone. This rule's enforced check is THE OPENER LAW below,
//      which compares PHASES_RENDERED_AT with the phases a page's tree draws;
//      it never required an opener to be mounted, and still does not.
//   4. A phase list defined OUTSIDE pipePhases.ts and rendered as a strip is a
//      violation. This is what killed /operations: six cells named in
//      src/lib/operationsPhases.ts that existed in no pipe.
//   5. A component belonging to tool A may not be mounted on tool B's page. The
//      CALENDAR clause names the MERGED GRID specifically — HubCalendar, the
//      view over trip events, plan blocks and routine occurrences. Only that
//      component may not be mounted outside /calendar. CalendarGrid is a SHARED
//      PRIMITIVE and is excluded: Trade Log's own P&L rows have fed it since
//      long before this law (TRADE-SPLIT moved that mount from /trading:887 to
//      src/app/trade-log/page.tsx, phase 05 RECORD). EXPLICIT NON-VIOLATION: DayCalendarView
//      (src/components/workbench/operations/content/DayCalendarView.tsx) renders
//      the day's blocks as "a dense, ONE-LINE stacked list in clock order (NOT
//      an hour-grid)" — its own words — as the content pipe's phase 03 surface.
//      It is Time's, it is not the merged grid, and it is not a violation.
//
// THE GRANDFATHER LIST is closed. Each entry is named, dated and reasoned, and
// THE ALLOWLIST MAY ONLY SHRINK — the build throws if it grows.
// TRADE-SPLIT (2026-09-16): THE LIST IS EMPTY. Its last entry was /trading —
// Brokerage (17) + Trade Log (18) on one page — and it retired the way its own
// `retire` note said it would: each tool renders its own three phases, now on
// its own page (src/app/brokerage/page.tsx trade 01-03, src/app/trade-log/page.tsx
// trade 04-06). TOOL-LAW-01 has NO exceptions to rule 1 any more, and the law
// below asserts the list stays empty — it may only shrink, and it cannot.
const MULTI_TOOL_ALLOWED: ReadonlyArray<{ route: string; tools: readonly string[]; since: string; why: string; retire: string }> = [];
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
// before this law (src/app/trade-log/page.tsx — plCalendarEvents,
// PL_SOURCE_CONFIG). Naming it here would break Trade Log for no gain: a grid
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
// TRADE-SPLIT: closed AND EMPTY. One tool, one page, no exceptions.
if (MULTI_TOOL_ALLOWED.length > 0) {
  toolViolations += 1;
  violations.push(`tool law 1: the multi-tool grandfather list has ${MULTI_TOOL_ALLOWED.length} entr${MULTI_TOOL_ALLOWED.length === 1 ? 'y' : 'ies'} — TRADE-SPLIT emptied it on 2026-09-16 and THE ALLOWLIST MAY ONLY SHRINK; a two-tool page is a violation, never a new entry`);
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
const stripFiles = shellFiles.filter((f) => codeOf(f).includes('<StageStrip'));
console.log('THE TOOL LAW — every phase strip and the pipe it reads');
for (const f of stripFiles.sort()) {
  const src = codeOf(f);
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
// TRADE-SPLIT: which phase NUMBERS of a pipe does one file's strip draw?
// Before the split every page that drew a pipe drew all of it, so rule 2 could
// work pipe-granular. /brokerage draws trade 01-03 and /trade-log 04-06, so the
// rule now reads the numbers. The idiom it parses is the ratified one
// (ModuleLauncher.tsx:50): destructure the pipe into named consts, then feed
// `num: CONST.num` to StageStrip. A file that draws a pipe in some OTHER shape
// is read conservatively as drawing ALL of that pipe's phases — a new idiom
// never silently escapes the rule.
function drawnNumsIn(body: string, pipe: string): Set<string> {
  const all = new Set((PIPE_PHASES[pipe as keyof typeof PIPE_PHASES] as readonly { num: string }[]).map((p) => p.num));
  const destructure = body.match(new RegExp(`const\\s*\\[([^\\]]*)\\]\\s*=\\s*PIPE_PHASES\\.${pipe}\\b`));
  if (!destructure) return all;
  const names = destructure[1].split(',').map((n) => n.trim());
  const phases = PIPE_PHASES[pipe as keyof typeof PIPE_PHASES] as readonly { num: string }[];
  const drawn = new Set<string>();
  names.forEach((name, i) => {
    if (!name || !phases[i]) return;
    const bare = name.replace(/:.*$/, '').trim();
    if (!/^[A-Za-z_$][\w$]*$/.test(bare)) return;
    if (new RegExp(`\\b${bare}\\.num\\b`).test(body)) drawn.add(phases[i].num);
  });
  // A destructure that named nothing the strip uses tells us nothing — be conservative.
  return drawn.size > 0 ? drawn : all;
}

// 2. a tool's page renders only ITS OWN phases (the strip may be page-level or
// per row — this rule does not care which, only whose the phases are).
for (const [route, tools] of screenTools) {
  const page = pages.find((p) => p.route === route);
  if (!page) continue;
  const seen = new Set<string>();
  const stack = [page.file];
  const pipesHere = new Map<string, Set<string>>();
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const body = existsSync(resolve(ROOT, f)) ? codeOf(f) : '';
    if (body.includes('<StageStrip')) {
      for (const m of body.matchAll(/PIPE_PHASES\.([a-z]+)/g)) {
        const pipe = m[1];
        const into = pipesHere.get(pipe) ?? new Set<string>();
        for (const n of drawnNumsIn(body, pipe)) into.add(n);
        pipesHere.set(pipe, into);
      }
    }
    for (const next of importsFor(f)) stack.push(next);
  }
  for (const [pipe, nums] of pipesHere) {
    for (const a of THE_SORT.filter((x) => x.pipe === pipe && nums.has(x.num))) {
      if (tools.includes(a.owner)) continue;
      if (FOREIGN_PHASE_ALLOWED.some((x) => x.route === route && x.pipe === pipe && x.num === a.num && x.owner === a.owner)) continue;
      toolViolations += 1;
      violations.push(`tool law 2: ${route} (${tools.join(' + ')}) renders ${pipe} ${a.num}, which is ${a.owner}'s — a tool's page renders only its own phases (TOOL-LAW-01)`);
    }
  }
}

// ── TOOL-LAW-01 · AMENDMENT (PLAN-01, 2026-09-17) ───────────────────────────
// WHAT IT PERMITS. A page may draw MORE THAN ONE pipe — but only when THE SORT
// (src/lib/nav.ts:118-119, the one place pipe ownership is declared) names that
// page's tool as the owner of every pipe it draws, and only when each strip is
// LABELLED with its pipe's name so a reader knows which body of work it belongs
// to. /tasks is the first: PLAN-01 gave Tasks the routines pipe beside the
// projects pipe, because a routine and a project are one act of planning — a
// recurring commitment that generates recurring spend, and a body of work whose
// tasks generate spend. The calendar authors nothing; everything logs to it.
//
// WHAT IT STILL FORBIDS, unchanged:
//   · a FOREIGN pipe — a page drawing a pipe its tool does not own still fails
//     (rule 2 above, which this amendment does not relax by one line);
//   · a page serving two TOOLS (rule 1, grandfather list closed and empty);
//   · an invented phase list rendered as a strip (rule 4);
//   · UNLABELLED multi-pipe — two strips on one page with nothing saying which
//     is which is exactly the "grouping layer" TOOL-LAW-01 deleted /operations
//     for. Drawing two pipes is a privilege that costs a label.
//
// WHY NO SECOND AMENDMENT WAS NEEDED FOR /calendar (the STEP 0.1 answer). No
// rule REQUIRES a tool's page to draw a pipe: rule 2 iterates the pipes a page
// DRAWS (empty ⇒ the loop body never runs), rule 4 iterates files CONTAINING a
// StageStrip, and the opener law only asks that PHASES_RENDERED_AT match the
// code. /calendar drawing nothing is legal and is declared as [].
const MULTI_PIPE_MIN = 2;
for (const [route, tools] of screenTools) {
  const page = pages.find((p) => p.route === route);
  if (!page) continue;
  const pipesDrawn = new Set<string>();
  const seenMp = new Set<string>();
  const stackMp = [page.file];
  while (stackMp.length) {
    const f = stackMp.pop()!;
    if (seenMp.has(f)) continue;
    seenMp.add(f);
    const body = existsSync(resolve(ROOT, f)) ? codeOf(f) : '';
    if (body.includes('<StageStrip')) for (const m of body.matchAll(/PIPE_PHASES\.([a-z]+)/g)) pipesDrawn.add(m[1]);
    for (const next of importsFor(f)) stackMp.push(next);
  }
  // EVERY pipe drawn here is owned by THIS page's tool — the amendment's
  // condition, stated over the whole page rather than phase by phase.
  for (const pipe of pipesDrawn) {
    const owners = [...new Set(THE_SORT.filter((x) => x.pipe === pipe).map((x) => x.owner))];
    if (!owners.some((o) => tools.includes(o))) {
      toolViolations += 1;
      violations.push(`tool law 2 (PLAN-01 amendment): ${route} (${tools.join(' + ')}) draws the ${pipe} pipe, which THE SORT gives to ${owners.join(' / ')} — a page may draw a second pipe only when its tool owns it (TOOL-LAW-01)`);
    }
  }
  // A page drawing two or more pipes must LABEL each one.
  if (pipesDrawn.size >= MULTI_PIPE_MIN) {
    const pageBody = codeOf(page.file);
    for (const pipe of pipesDrawn) {
      if (!new RegExp(`data-pipe-label="${pipe}"`).test(pageBody)) {
        toolViolations += 1;
        violations.push(`tool law 2 (PLAN-01 amendment): ${route} draws ${pipesDrawn.size} pipes and does not label the ${pipe} strip — two strips on one page with nothing saying which is which is the grouping layer TOOL-LAW-01 deleted /operations for (TOOL-LAW-01)`);
      }
    }
    if (!pageBody.includes('PIPE_LABEL')) {
      toolViolations += 1;
      violations.push(`tool law 2 (PLAN-01 amendment): ${route} labels its strips with typed text rather than PIPE_LABEL from src/lib/pipePhases.ts — a pipe's name comes from the pipe (TOOL-LAW-01)`);
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
  const body = codeOf(f);
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
const navBody = codeOf(NAV_FILE);
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
    const body = existsSync(resolve(ROOT, f)) ? codeOf(f) : '';
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
  const src = codeOf(f);
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

// ── THE CANDIDATE LOG LAW (LOG-01) ──────────────────────────────────────────
// Every scored candidate the scan returns was persisted first: the write and
// the response come from ONE list. pipeline.ts must (1) await
// persistScanCandidates — never void it, (2) assign the PERSISTED list back to
// fullTradeCardsPerTicker, the variable the response is built from, (3) keep
// the withhold branch (a failed write returns NO candidates, declared), and
// (4) the scan route may not touch the candidate list on its way out. The
// runtime half — every returned card carries candidate_id — is thrown by
// candidate-log.ts itself.
const LOG_PIPELINE = 'src/lib/convergence/pipeline.ts';
const LOG_ROUTE = 'src/app/api/trading/convergence/route.ts';
const LOG_MODULE = 'src/lib/convergence/candidate-log.ts';
const logPipeline = existsSync(resolve(ROOT, LOG_PIPELINE)) ? codeOf(LOG_PIPELINE) : '';
const logRoute = existsSync(resolve(ROOT, LOG_ROUTE)) ? codeOf(LOG_ROUTE) : '';
const logModule = existsSync(resolve(ROOT, LOG_MODULE)) ? codeOf(LOG_MODULE) : '';
let logViolations = 0;
const logFail = (msg: string) => { logViolations += 1; violations.push(`candidate log law: ${msg} (LOG-01)`); };
if (!logModule) logFail(`${LOG_MODULE} is missing — nothing persists the scored candidates`);
if (!/await persistScanCandidates\(/.test(logPipeline)) logFail(`${LOG_PIPELINE} does not await persistScanCandidates — the scan must persist every candidate before it returns`);
if (/void persistScanCandidates\(/.test(logPipeline)) logFail(`${LOG_PIPELINE} fires persistScanCandidates and forgets it — a candidate the write lost would still be returned`);
if (!/fullTradeCardsPerTicker = persisted\.cards;/.test(logPipeline)) logFail(`${LOG_PIPELINE} does not assign the PERSISTED list back to fullTradeCardsPerTicker — the write and the response must be one list`);
if (!/full_trade_cards_per_ticker: fullTradeCardsPerTicker,/.test(logPipeline)) logFail(`${LOG_PIPELINE} builds full_trade_cards_per_ticker from something other than fullTradeCardsPerTicker`);
if (!/LOG-01: candidate persistence FAILED/.test(logPipeline) || !/fullTradeCardsPerTicker = \{\};/.test(logPipeline)) logFail(`${LOG_PIPELINE} has no withhold branch — a failed write must return NO candidates and declare it`);
if (/full_trade_cards_per_ticker/.test(logRoute)) logFail(`${LOG_ROUTE} touches the candidate list on its way out — the response is the pipeline's persisted list, untouched`);
if (!/a card left the log without a candidate_id/.test(logModule)) logFail(`${LOG_MODULE} no longer throws when a returned card has no candidate_id — the runtime half of the law is gone`);
const logBuilders = (logPipeline.match(/full_trade_cards_per_ticker: (?!Record<)/g) ?? []).length; // the type line declares, it does not build
if (logBuilders !== 1) logFail(`${LOG_PIPELINE} builds full_trade_cards_per_ticker ${logBuilders} times — exactly one list leaves the pipeline`);
if (logViolations === 0) console.log('✔ The candidate log law passed — the scan persists every scored candidate before it returns it, from one list; a failed write withholds and declares.');

// ── THE TWO-SCORES LAWS (MODEL-01) ──────────────────────────────────────────
// (1) A card's score_model and model era are never null: the composite sets
//     both from the model that ran; trade-cards.ts and candidate-log.ts throw
//     without them. (2) The input-sign table drives both scores: buyerScore
//     admits exactly the rows the table admits, by name, and the seller
//     composite is the renamed original. (3) No surface prints "win rate" or
//     a bare PoP/EV outside the leaf: every model-number surface renders the
//     labels and the one tooltip from modelLabels.ts. (4) A BUY candidate
//     always carries a non-empty catalyst — the builder refuses to build one
//     without, the card builder and the candidate log refuse to pass one.
//     (5) An unbounded structure never exists without the cap check recorded.
//     (6) The gate cards: one per gate per side, every field said, README's
//     block byte-equal to the generator, the tooltips rendering from the cards.
//     (7) The pre-filter splits by side and every symbol is scored on ITS side.
const M01 = (f: string) => (existsSync(resolve(ROOT, f)) ? codeOf(f) : '');
const m01Composite = M01('src/lib/convergence/composite.ts');
const m01Cards = M01('src/lib/convergence/trade-cards.ts');
const m01Log = M01('src/lib/convergence/candidate-log.ts');
const m01Types = M01('src/lib/convergence/types.ts');
const m01Builder = M01('src/lib/strategy-builder.ts');
const m01Pipeline = M01('src/lib/convergence/pipeline.ts');
const m01Rules = M01('src/lib/convergence/side-rules.ts');
const m01Cap = M01('src/lib/convergence/undefined-risk.ts');
const m01Filters = M01('src/lib/convergence/filter-types.ts');
const m01Leaf = M01('src/lib/convergence/modelLabels.ts');
const m01Explainers = M01('src/components/trading/metricExplainers.ts');
let m01Violations = 0;
const m01Fail = (law: string, msg: string) => { m01Violations += 1; violations.push(`${law}: ${msg} (MODEL-01)`); };

// (1) score_model and era never null
if (!/score_model: model\.model,/.test(m01Composite) || !/model_era: CURRENT_MODEL_ERA\.id,/.test(m01Composite)) m01Fail('model law', 'composite.ts no longer stamps score_model and model_era from the model that ran');
if (!/^\s+score_model: ScoreModel;$/m.test(m01Types) || !/^\s+model_era: string;$/m.test(m01Types)) m01Fail('model law', 'types.ts lets score_model or model_era be optional — a card records both, never null');
if (!/carries no score_model/.test(m01Cards) || !/carries no model_era/.test(m01Cards)) m01Fail('model law', 'trade-cards.ts no longer throws when the scoring carries no score_model / model_era');
if (!/carries no score_model/.test(m01Log) || !/carries no model_era/.test(m01Log)) m01Fail('model law', 'candidate-log.ts no longer throws when a card carries no score_model / model_era');
if (!/was built on the \$\{card\.side\} side but scored by the/.test(m01Cards)) m01Fail('model law', 'trade-cards.ts no longer refuses a card built on one side and scored by the other\'s model');

// (2) the table drives both scores
if (!/import \{ INPUT_SIGNS, MODEL_WEIGHTS_SET_ON, applyBuyerSign, signFor \} from '\.\/input-signs';/.test(m01Composite)) m01Fail('sign-table law', 'composite.ts does not read the input-sign table');
if (!/admittedRows !== components\.length/.test(m01Composite)) m01Fail('sign-table law', 'buyerScore no longer checks that it admitted exactly the rows the table admits');
if (!/export function sellerScore\(/.test(m01Composite) || !/export function buyerScore\(/.test(m01Composite)) m01Fail('sign-table law', 'composite.ts must export sellerScore() and buyerScore()');
const m01Admitted = buyerAdmittedInputs();
if (m01Admitted.length === 0) m01Fail('sign-table law', 'the input-sign table admits nothing to the buy score');
for (const row of m01Admitted) {
  const re = new RegExp(`admit\\('${row.gate}', '${row.input}'`);
  if (!re.test(m01Composite)) m01Fail('sign-table law', `buyerScore does not read ${row.gate}.${row.input}, which the table admits with sign '${row.buyer}'`);
}
for (const row of INPUT_SIGNS) {
  if (!/\.ts:\d+/.test(`${row.why} ${row.sellerWeight}`)) m01Fail('sign-table law', `${row.gate}.${row.input} carries no file:line citation`);
  if (row.seller !== '+') m01Fail('sign-table law', `${row.gate}.${row.input} seller sign is '${row.seller}' — the seller model is today's composite, every input reads '+' for the seller`);
  if (!row.directionNeutral && row.buyer !== '0') m01Fail('sign-table law', `${row.gate}.${row.input} is direction-bearing but enters the buy score — direction-bearing inputs feed the overlay, never the buy score`);
}

// (3) the label law — the leaf, and every model-number surface
const M01_TOOLTIP_RULED = 'breakeven-d2 probability under a lognormal model at scan-time IV — a pricing quantity, not a forecast; realized frequency is measured in EDGE-01.';
if (MODEL_NUMBER_TOOLTIP !== M01_TOOLTIP_RULED) m01Fail('label law', 'modelLabels.ts MODEL_NUMBER_TOOLTIP is not the ruled sentence verbatim');
if (!/export const POP_MODEL_LABEL = 'PoP \(model\)';/.test(m01Leaf) || !/export const EV_MODEL_LABEL = 'EV \(model\)';/.test(m01Leaf)) m01Fail('label law', 'modelLabels.ts no longer defines PoP (model) / EV (model)');
const M01_SURFACES = [
  'src/components/convergence/ConvergenceIntelligence.tsx',
  'src/components/convergence/ScannerResultsTable.tsx',
  'src/components/convergence/FilterPanel.tsx',
  'src/components/trading/TradeLabPanel.tsx',
  'src/components/trading/ScanFilterForm.tsx',
  'src/components/trading/metricExplainers.ts',
  'src/components/home/TradeShowcaseSections.tsx',
  'src/components/landing/glimpses.tsx',
  'src/lib/convergence/filter-engine.ts',
  'src/lib/convergence/trade-cards.ts',
  'src/lib/strategy-builder.ts',
  'src/lib/walkthroughLedger.ts',
];
const M01_BARE = [
  /Est\.\s*(PoP|EV)\b/,
  />\s*(PoP|POP|EV|EV\/RISK|EV\/Risk|EV\/risk|HV\s*PoP|HV\s*POP)\s*</,
  /['"`]\s*(PoP|POP|EV|EV\/RISK|EV\/Risk|EV\/risk|HV\s*PoP|HV\s*POP|Min PoP|Min EV|Min EV\/Risk|PoP method|Probability of Profit|Expected Value \(EV\))\s*['"`]/,
  /·\s*(POP|EV|EV\/RISK|HV POP)\s/,
  /\bwin rate\b/i,
];
for (const f of M01_SURFACES) {
  const body = M01(f);
  if (!body) { m01Fail('label law', `${f} is missing — it is a model-number surface the law scans`); continue; }
  if (!/modelLabels'/.test(body)) m01Fail('label law', `${f} shows a model number but does not import its labels from modelLabels.ts`);
  for (const re of M01_BARE) {
    const hit = body.match(re);
    if (hit) m01Fail('label law', `${f} prints "${hit[0].trim()}" — a model number is labelled PoP (model) / EV (model) from the leaf, and "win rate" leaves every surface that shows one`);
  }
}
// bare PoP labels anywhere else a customer reads
const m01Walk = (dir: string): string[] => readdirSync(resolve(ROOT, dir)).flatMap((n) => {
  const p = `${dir}/${n}`;
  if (statSync(resolve(ROOT, p)).isDirectory()) return m01Walk(p);
  return /\.(tsx?|md)$/.test(n) && !/__tests__/.test(p) ? [p] : [];
});
for (const f of [...m01Walk('src/components'), ...m01Walk('src/app')]) {
  if (M01_SURFACES.includes(f) || f === 'src/lib/convergence/modelLabels.ts') continue;
  const body = M01(f);
  const hit = body.match(/Est\.\s*PoP|>\s*(PoP|POP)\s*<|['"]\s*(PoP|POP|HV PoP|HV POP)\s*['"]/);
  if (hit) m01Fail('label law', `${f} prints a bare "${hit[0].trim()}" — PoP is a model number and is labelled from the leaf`);
}

// (4) the catalyst law
if (!/export const BUY_CATALYST_HV_OVER_IV_PTS = 5\.0;/.test(m01Rules) || !/export const BUY_PREFILTER_HV_OVER_IV_MIN_PTS = 1\.0;/.test(m01Rules)) m01Fail('catalyst law', 'side-rules.ts no longer names the BUY thresholds as dated consts');
if (!/\} else if \(catalysts\.length === 0\) \{/.test(m01Builder) || !/noCatalystReason\(/.test(m01Builder)) m01Fail('catalyst law', 'strategy-builder.ts builds a BUY structure without checking for a catalyst, or without saying why it did not');
if (!/is a BUY candidate with no catalyst/.test(m01Cards)) m01Fail('catalyst law', 'trade-cards.ts no longer refuses a BUY card with no catalyst');
if (!/is a BUY candidate with no catalyst/.test(m01Log)) m01Fail('catalyst law', 'candidate-log.ts no longer refuses a BUY row with no catalyst');
if (!/sellerEarningsHazard\(/.test(m01Cards)) m01Fail('catalyst law', 'trade-cards.ts no longer flags a seller structure whose window holds an earnings date');

// (5) the cap law
if (!/export const UNDEFINED_RISK_OPEN_POSITION_CAP = 1;/.test(m01Cap)) m01Fail('cap law', 'undefined-risk.ts no longer names the cap (default 1 open undefined-risk position)');
if (!/if \(params\.undefinedRisk\.allowed\) \{/.test(m01Builder) || !/card\.undefinedRiskCap = card\.isUnlimited \? params\.undefinedRisk\.reason : null;/.test(m01Builder)) m01Fail('cap law', 'strategy-builder.ts builds an unbounded structure without the cap check, or without recording it on the card');
if (!/is unbounded with no cap check recorded/.test(m01Cards) || !/is unbounded with no cap check recorded/.test(m01Log)) m01Fail('cap law', 'the card builder or the candidate log no longer refuses an unbounded structure with no cap check');
if (!/checkUndefinedRiskCap\(options\.allowUndefinedRisk, openUndefinedRisk\)/.test(m01Pipeline)) m01Fail('cap law', 'pipeline.ts no longer checks the cap against the user\'s open positions before building');
if (!/riskType: 'DEFINED_ONLY',/.test(m01Filters)) m01Fail('cap law', 'filter-types.ts DEFAULT_FILTERS is no longer defined-risk — defined risk is the default filter state');

// (6) the gate cards
if (GATE_CARDS.length !== 8) m01Fail('gate-cards law', `gateCards.ts holds ${GATE_CARDS.length} cards — one per gate per side is 8`);
for (const g of ['vol_edge', 'quality', 'regime', 'info_edge'] as const) for (const m of ['seller', 'buyer'] as const) {
  const c = GATE_CARDS.find((x) => x.gate === g && x.model === m);
  if (!c) { m01Fail('gate-cards law', `no gate card for ${g} / ${m}`); continue; }
  for (const k of ['purpose', 'inputs', 'weight', 'evidence', 'isNot'] as const) if (!c[k]?.trim()) m01Fail('gate-cards law', `gate card ${g}/${m} has no ${k}`);
  if (!/\d{4}-\d{2}-\d{2}|#1082/.test(c.weight)) m01Fail('gate-cards law', `gate card ${g}/${m} weight carries no date`);
}
const m01Readme = M01('README.md');
const m01Start = m01Readme.indexOf(README_GATE_CARDS_START);
const m01End = m01Readme.indexOf(README_GATE_CARDS_END);
if (m01Start < 0 || m01End < m01Start) m01Fail('gate-cards law', 'README.md has no gate-cards block');
else if (m01Readme.slice(m01Start, m01End + README_GATE_CARDS_END.length) !== `${README_GATE_CARDS_START}\n${gateCardsMarkdown()}\n${README_GATE_CARDS_END}`) m01Fail('gate-cards law', 'README.md gate-cards block differs from gateCards.ts — run npx tsx scripts/regen-gate-cards-readme.ts (byte-stable)');
if (!/gateCard\(/.test(m01Explainers)) m01Fail('gate-cards law', 'metricExplainers.ts no longer renders the gate tooltips from the gate cards');

// (7) the funnel splits by side; every symbol scores on its side
if (!/stepCReason\(|sideOf\(/.test(m01Pipeline)) m01Fail('side law', 'pipeline.ts Step C no longer applies the side\'s rule');
if (/scoreAll\(convergenceInput\)/.test(m01Pipeline)) m01Fail('side law', 'pipeline.ts scores a symbol without its side — scoreAll(input, side) is the only call');
if (!/scoreAll\(convergenceInput, side\)/.test(m01Pipeline) || (m01Pipeline.match(/scoreAll\(convergenceInput, ticker\.side\)/g) ?? []).length !== 2) m01Fail('side law', 'pipeline.ts must score every symbol (first pass and both re-scores) on the side it came through Step C on');
if (!/rankAndDiversifyBySide\(/.test(m01Pipeline)) m01Fail('side law', 'pipeline.ts ranks the two sides as one book — a seller score and a buyer score are not comparable');
if (m01Violations === 0) console.log(`✔ The two-scores laws passed — score_model and era stamped on every card; the sign table admits ${m01Admitted.length} components to the buy score and buyerScore reads each by name; ${M01_SURFACES.length} model-number surfaces label from the leaf; a BUY candidate needs a catalyst; an unbounded structure needs the cap; ${GATE_CARDS.length} gate cards, README byte-stable; every symbol scored on its side.`);

// ── THE INPUTS-AND-FUNNEL LAWS (MODEL-02) ───────────────────────────────────
// (1) The log never lies: no bare catch in any src/lib/convergence file that
//     writes a table — a catch records the failure on its result or rethrows,
//     never logs and moves on; the pipeline AWAITS the snapshot write and the
//     scan response carries its result; the column is as wide as the longest
//     producible line plus margin, the schema and the migration agree with the
//     const. (2) The inputs are real: VVIX comes from Cboe (FRED VVIXCLS is
//     deleted), every Cboe input on the regime trace carries fetched_at and
//     weight 0, a missing read is declared. (3) The funnel constants are named
//     and dated in one leaf and no site carries a bare number. (4) The ETF
//     layer is one dated const of the 15 ruled symbols, selectable, reported
//     when TastyTrade returns nothing. (5) No phantoms: the panel offers
//     exactly the strategies with a builder; every builder is offered.
const M02_WRITE = /prisma\.[a-z_]+\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\(/;
let m02Violations = 0;
const m02Fail = (law: string, msg: string) => { m02Violations += 1; violations.push(`${law}: ${msg} (MODEL-02)`); };

// (1) the log never lies
const m02Writers = m01Walk('src/lib/convergence').filter((f) => /\.ts$/.test(f) && M02_WRITE.test(M01(f)));
if (m02Writers.length === 0) m02Fail('snapshot law', 'no file under src/lib/convergence writes a table — the scan no longer records anything');
for (const f of m02Writers) {
  const body = M01(f);
  const re = /catch\s*(?:\(\s*(\w+)[^)]*\))?\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    const bound = m[1] ?? null;
    let depth = 1; let i = re.lastIndex;
    while (i < body.length && depth > 0) { if (body[i] === '{') depth += 1; else if (body[i] === '}') depth -= 1; i += 1; }
    const inner = body.slice(re.lastIndex, i - 1).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const withoutConsole = inner.replace(/console\.\w+\([^;]*\);?/g, '');
    const uses = bound !== null && new RegExp(`\\b${bound}\\b`).test(withoutConsole);
    const rethrows = /\bthrow\b/.test(inner);
    if (!uses && !rethrows) m02Fail('snapshot law', `${f} has a bare catch at line ${body.slice(0, m.index).split('\n').length} — a table writer records the failure on its result or rethrows; it never logs and moves on`);
  }
}
if (/void logScanSnapshotBatch\(/.test(m01Pipeline)) m02Fail('snapshot law', 'pipeline.ts fires the snapshot write and forgets it — the scan must await the write and carry its result');
if (!/snapshot = await logScanSnapshotBatch\(/.test(m01Pipeline)) m02Fail('snapshot law', 'pipeline.ts does not await logScanSnapshotBatch into `snapshot`');
if (!/^\s+snapshot: SnapshotWriteResult;$/m.test(m01Pipeline) || !/^\s+snapshot,$/m.test(m01Pipeline)) m02Fail('snapshot law', 'PipelineResult.pipeline_summary no longer carries the snapshot write result');
if (!/errors\.push\(`Step T \(snapshot\): \$\{snapshot\.reason\}`\)/.test(m01Pipeline)) m02Fail('snapshot law', 'pipeline.ts no longer puts a failed snapshot write on errors[]');
if (!/saved: snapshot\.written,/.test(m01Pipeline)) m02Fail('snapshot law', 'step_t reports `saved` from something other than the write\'s own result');
const m02Ui = M01('src/components/convergence/ConvergenceIntelligence.tsx');
if (!/tData\.snapshot\.rows_failed/.test(m02Ui) || !/tData\.snapshot\.reason/.test(m02Ui)) m02Fail('snapshot law', 'ConvergenceIntelligence.tsx step T no longer shows a failed snapshot write (rows failed, reason)');
const m02Schema = M01('prisma/schema.prisma');
const m02Width = m02Schema.match(/suggestedStrategy String\? @db\.VarChar\((\d+)\)/);
if (!m02Width || Number(m02Width[1]) !== SNAPSHOT_SUGGESTED_STRATEGY_MAX) m02Fail('snapshot law', `schema.prisma scan_snapshots.suggestedStrategy is VarChar(${m02Width?.[1] ?? '?'}) — the const SNAPSHOT_SUGGESTED_STRATEGY_MAX is ${SNAPSHOT_SUGGESTED_STRATEGY_MAX}; they move together`);
const m02Migration = M01('prisma/migrations/20260916000000_model_02_snapshot_width/migration.sql');
if (!new RegExp(`ALTER TABLE "scan_snapshots" ALTER COLUMN "suggestedStrategy" TYPE VARCHAR\\(${SNAPSHOT_SUGGESTED_STRATEGY_MAX}\\);`).test(m02Migration)) m02Fail('snapshot law', `the MODEL-02 migration does not widen suggestedStrategy to VARCHAR(${SNAPSHOT_SUGGESTED_STRATEGY_MAX})`);

// (2) the inputs are real
const m02Fetchers = M01('src/lib/convergence/data-fetchers.ts');
const m02Regime = M01('src/lib/convergence/regime.ts');
const m02Cboe = M01('src/lib/convergence/cboe-daily.ts');
if (/id: 'VVIXCLS'/.test(m02Fetchers) || /VVIXCLS'\)/.test(m02Fetchers)) m02Fail('inputs law', 'data-fetchers.ts still reads VVIXCLS from FRED — FRED has no such series; VVIX comes from Cboe');
if (!/export async function fetchCboeDaily\(/.test(m02Cboe) || !/CBOE_TTL_MS = 24 \* 60 \* 60 \* 1000/.test(m02Cboe)) m02Fail('inputs law', 'cboe-daily.ts no longer fetches the Cboe daily files through a 24h in-process cache');
if (!/cboeDailyUrl\(index: CboeIndex\): string \{\s*return `\$\{CBOE_BASE\}\/\$\{index\}_History\.csv`;/.test(m02Cboe)) m02Fail('inputs law', 'cboe-daily.ts no longer reads the sibling files of PUT_History.csv under CBOE_BASE');
if (!/const cboe = input\.cboeDaily \?\? null;/.test(m02Regime) || !/computeSurvivalBrake\(vixTermStructureRatio, vvixRaw, vvixNullReason\)/.test(m02Regime)) m02Fail('inputs law', 'regime.ts no longer reads VVIX from the Cboe read, or the brake no longer carries the null reason');
if (!/fetchCboeDaily\(\)/.test(m01Pipeline)) m02Fail('inputs law', 'pipeline.ts Step H no longer fetches the Cboe daily files');
const m02Threaded = (m01Pipeline.match(/^\s+cboeDaily,$/gm) ?? []).length;
if (m02Threaded < 4) m02Fail('inputs law', `pipeline.ts threads cboeDaily into ${m02Threaded} ConvergenceInput literal(s) — every scoring input carries the Cboe read (4)`);
// TEST-TRUTH-01: this slice used to END at the comment `// ===== MAIN REGIME
// SCORER =====`. Reading regime.ts comment-stripped made that marker vanish and
// the slice ran to the end of the file, so the law failed against weights that
// were never in this builder. A law may not use a comment as a structural
// boundary: delete or reword the banner and the law silently changes what it
// reads. The boundary is now CODE — the next exported function.
const m02BuilderAt = m02Regime.indexOf('export function buildCboeRegimeInputs(');
const m02BuilderEnd = m02Regime.indexOf('export function ', m02BuilderAt + 1);
if (m02BuilderAt < 0) m02Fail('inputs law', 'regime.ts no longer exports buildCboeRegimeInputs');
if (m02BuilderEnd < 0) m02Fail('inputs law', 'regime.ts has no export after buildCboeRegimeInputs — the law cannot bound the builder in code');
const m02BuilderBody = m02Regime.slice(m02BuilderAt, m02BuilderEnd);
if ((m02BuilderBody.match(/weight: 0,/g) ?? []).length !== 4 || /weight: (?!0,)/.test(m02BuilderBody)) m02Fail('inputs law', 'regime.ts buildCboeRegimeInputs puts a weight other than 0 on a new Cboe input — the term structure and SKEW are present and logged, tuned by nobody');
for (const fx of [null, { vvix: null, vix9d: null, vix: null, vix3m: null, vix6m: null, skew: null, errors: ['VVIX: HTTP 404 from x'], fetched_at: '2026-09-16T00:00:00.000Z' }]) {
  const rows = buildCboeRegimeInputs(fx);
  if (rows.length !== 4) m02Fail('inputs law', `buildCboeRegimeInputs returns ${rows.length} inputs — four (three term-structure ratios and SKEW)`);
  for (const r of rows) {
    if (!('fetched_at' in r)) m02Fail('inputs law', `Cboe input ${r.key} carries no fetched_at`);
    if (r.weight !== 0) m02Fail('inputs law', `Cboe input ${r.key} has weight ${r.weight} — 0`);
    if (r.raw_value === null && !r.null_reason) m02Fail('inputs law', `Cboe input ${r.key} is null with no reason — a missing read is declared`);
  }
}
const m02RegimeSeller = GATE_CARDS.find((c) => c.gate === 'regime' && c.model === 'seller');
if (!m02RegimeSeller || !/Cboe/.test(m02RegimeSeller.inputs) || !/WEIGHT 0/.test(m02RegimeSeller.inputs) || !/restored 2026-09-16 from Cboe/.test(m02RegimeSeller.isNot)) m02Fail('inputs law', 'the regime seller gate card no longer names the Cboe VVIX source, the weight-0 inputs, or the restoration date');
if (/VVIX leg has been dead/.test(gateCardsMarkdown())) m02Fail('inputs law', 'the gate cards still say the VVIX leg is dead');

// (3) the funnel constants
const m02Funnel = M01('src/lib/convergence/funnel.ts');
const m02Route = M01('src/app/api/trading/convergence/route.ts');
if (!/export const STRUCTURE_CUT = 40;/.test(m02Funnel) || !/export const DEEP_FETCH_MULTIPLIER = 2;/.test(m02Funnel) || !/export const SCAN_LIMIT_DEFAULT = 20;/.test(m02Funnel) || !/export const FUNNEL_SET_ON = '\d{4}-\d{2}-\d{2}';/.test(m02Funnel)) m02Fail('funnel law', 'funnel.ts no longer names and dates STRUCTURE_CUT 40, DEEP_FETCH_MULTIPLIER 2 and SCAN_LIMIT_DEFAULT 20');
if (STRUCTURE_CUT !== 40 || DEEP_FETCH_MULTIPLIER !== 2 || SCAN_LIMIT_DEFAULT !== 20) m02Fail('funnel law', 'the funnel constants moved — a new value needs a new date and a report');
if (!/const TOP_N = STRUCTURE_CUT;/.test(m01Pipeline)) m02Fail('funnel law', 'pipeline.ts rankAndDiversify no longer cuts at STRUCTURE_CUT');
if (/TOP_N = \d/.test(m01Pipeline) || /limit \* 2\b/.test(m01Pipeline)) m02Fail('funnel law', 'pipeline.ts carries a bare funnel number — every cut reads funnel.ts');
if ((m01Pipeline.match(/limit \* DEEP_FETCH_MULTIPLIER/g) ?? []).length < 1) m02Fail('funnel law', 'pipeline.ts deep-fetch cut no longer reads DEEP_FETCH_MULTIPLIER');
if (/limit=\d/.test(m02Ui) || (m02Ui.match(/limit=\$\{SCAN_LIMIT_DEFAULT\}/g) ?? []).length !== 2) m02Fail('funnel law', 'ConvergenceIntelligence.tsx sends a bare limit — both scan URLs read SCAN_LIMIT_DEFAULT');
if (/\|\| '\d+'/.test(m02Route) || !/String\(SCAN_LIMIT_DEFAULT\)/.test(m02Route)) m02Fail('funnel law', 'the convergence route defaults limit from a bare number — it reads SCAN_LIMIT_DEFAULT');

// (4) the ETF layer
const M02_ETF_RULED = ['SPY', 'QQQ', 'IWM', 'DIA', 'XLF', 'XLE', 'XLK', 'XLV', 'XLY', 'XLI', 'XLP', 'XLU', 'XLB', 'XLRE', 'XLC'];
if (ETF_UNIVERSE_SYMBOLS.length !== 15 || new Set(ETF_UNIVERSE_SYMBOLS).size !== 15 || M02_ETF_RULED.some((sym) => !ETF_UNIVERSE_SYMBOLS.includes(sym))) m02Fail('etf law', `etf-universe.ts is not the 15 ruled symbols, unique (${ETF_UNIVERSE_SYMBOLS.join(', ')})`);
if (!/case ETF_UNIVERSE_KEY: return \[\.\.\.new Set\(ETF_UNIVERSE_SYMBOLS\)\];/.test(m01Pipeline)) m02Fail('etf law', 'pipeline.ts getUniverseSymbols no longer offers the ETF universe by its key, deduplicated');
if (!/stepAMissing = allSymbols\.filter/.test(m01Pipeline) || !/TastyTrade returned no market-metrics row for \$\{etfMissing\.join/.test(m01Pipeline)) m02Fail('etf law', 'pipeline.ts Step A no longer reports the ETF members TastyTrade returned no row for');
if (!/t\.marketCap == null && isEtfUniverseSymbol\(t\.symbol\)/.test(m01Pipeline)) m02Fail('etf law', 'pipeline.ts hard filter 1 no longer declares the issuer-size floor not applicable to an ETF member (with the warning on the record)');
const m02Chain = M01('src/lib/convergence/chain-fetcher.ts');
if (!/TastyTrade returned no option chain for \$\{failedSymbol\}/.test(m02Chain)) m02Fail('etf law', 'chain-fetcher.ts drops a symbol whose chain fetch failed without a rejection on the record');
const m02Form = M01('src/components/trading/ScanFilterForm.tsx');
if (!/ETF_UNIVERSE_KEY/.test(m02Ui) || !/ETF_UNIVERSE_KEY/.test(m02Form)) m02Fail('etf law', 'the universe selectors no longer offer the ETF universe (ConvergenceIntelligence.tsx, ScanFilterForm.tsx)');
const m02Table = M01('src/components/convergence/ScannerResultsTable.tsx');
if (!/why\.scored_by\.map/.test(m02Ui) || !/why\.scored_by\.map/.test(m02Table)) m02Fail('etf law', 'a card no longer names the gates that scored it (why.scored_by) on both card surfaces');
if (!/Scored on \{why\.scored_by\.length\} of 4 gates/.test(m02Ui) || !/Scored on \{why\.scored_by\.length\} of 4 gates/.test(m02Table)) m02Fail('etf law', 'a card no longer states "scored on N of 4 gates" on both card surfaces (addendum, ruled 2026-09-16)');
// the addendum: Step G reads the pure rule; single names unchanged; an ETF member judged on the gates that can score
const m02Cut = M01('src/lib/convergence/structure-cut.ts');
if (!/export const STRUCTURE_CUT_CONVERGENCE_MIN = 3;/.test(m02Cut) || !/export const STRUCTURE_CUT_QUALITY_FLOOR = 40;/.test(m02Cut) || !/export const ETF_STRUCTURE_CUT_SET_ON = '\d{4}-\d{2}-\d{2}';/.test(m02Cut)) m02Fail('etf law', 'structure-cut.ts no longer names the single-name rules (3 of 4, floor 40) and the dated ETF amendment');
if (!/structureCutEligibility\(row, isEtfUniverseSymbol\(row\.symbol\)\)/.test(m01Pipeline)) m02Fail('etf law', 'pipeline.ts rankAndDiversify no longer reads the structure-cut rule from structure-cut.ts with the ETF membership from the const');
if (/catAbove50 < 3/.test(m01Pipeline) || /row\.convergence\.split/.test(m01Pipeline)) m02Fail('etf law', 'pipeline.ts still judges the cut inline from the convergence string');
for (const [sym, etf, expect] of [['SPY', true, true], ['AAPL', false, false]] as const) {
  const v = structureCutEligibility({ symbol: sym, rank: 1, composite: 61, quality: null, beat_streak: 'UNKNOWN', categories_above_50: 2, scored_gates: 2 }, etf);
  if (v.eligible !== expect) m02Fail('etf law', `structureCutEligibility: ${sym} with Quality and Info-Edge null and 2 of 2 scored gates above 50 should be ${expect ? 'admitted (ETF member)' : 'excluded (single name)'}`);
}

// (5) no phantoms
const m02Built = [...new Set([...m01Builder.matchAll(/buildCard\('([^']+)'/g)].map((m) => m[1]))].sort();
const m02Offered = [...AVAILABLE_STRATEGIES].sort();
if (m02Built.join('|') !== m02Offered.join('|')) m02Fail('phantom law', `the panel offers [${m02Offered.join(', ')}] but the builder makes [${m02Built.join(', ')}] — every strategy offered has a builder and every builder is offered`);
for (const n of NOT_BUILT_STRATEGIES) {
  if (AVAILABLE_STRATEGIES.includes(n.name)) m02Fail('phantom law', `${n.name} is offered AND listed as not built`);
  if (m02Built.includes(n.name)) m02Fail('phantom law', `${n.name} has a builder AND is listed as not built`);
  if (!n.reason || n.reason.length < 40) m02Fail('phantom law', `${n.name} is listed as not built with no reason`);
}
// The scanner's panels and the selling surfaces. src/components/dashboard is
// the Trade Log's manual commit forms — the user logs a position opened
// anywhere (a call credit spread included); that list is not the scanner's.
for (const f of [...m01Walk('src/components'), ...m01Walk('src/app')].filter((f) => !f.startsWith('src/components/dashboard/'))) {
  const body = M01(f);
  for (const n of NOT_BUILT_STRATEGIES) if (body.includes(`'${n.name}'`) || body.includes(`"${n.name}"`)) m02Fail('phantom law', `${f} offers or names "${n.name}" — no builder makes it; the scanner's panels render AVAILABLE_STRATEGIES from filter-types.ts`);
}
for (const f of ['src/components/convergence/FilterPanel.tsx', 'src/components/trading/ScanFilterForm.tsx', 'src/components/home/TradeShowcaseSections.tsx', 'src/components/landing/glimpses.tsx']) {
  if (!/AVAILABLE_STRATEGIES/.test(M01(f))) m02Fail('phantom law', `${f} no longer renders the strategy list from AVAILABLE_STRATEGIES`);
}
if (m02Violations === 0) console.log(`✔ The inputs-and-funnel laws passed — ${m02Writers.length} table writer(s) under src/lib/convergence carry no bare catch and the scan awaits its snapshot write (column ${SNAPSHOT_SUGGESTED_STRATEGY_MAX}); VVIX from Cboe with the term structure and SKEW at weight 0, every input dated; structure cut ${STRUCTURE_CUT} per side, deep fetch limit × ${DEEP_FETCH_MULTIPLIER} at limit ${SCAN_LIMIT_DEFAULT}; ${ETF_UNIVERSE_SYMBOLS.length} ETF members selectable and reported; ${m02Offered.length} strategies offered = ${m02Built.length} built, ${NOT_BUILT_STRATEGIES.length} named not built.`);

// ── THE TRADE-SPLIT LAW (TRADE-SPLIT, 2026-09-16) ───────────────────────────
// /trading was the last entry on the tool law's grandfather list: Brokerage (17)
// and Trade Log (18) on one page. It retired the way its own `retire` note said
// it would — each tool renders its own three phases on its own page. This law
// holds the split in place so it cannot quietly re-merge:
//   1. the grandfather list is EMPTY (asserted in the tool law above too);
//   2. /brokerage draws trade 01-03 and NOTHING else; /trade-log draws 04-06;
//   3. each is exactly one tool's registry home, and /trading is a redirect
//      that renders no surface of its own;
//   4. phase 06's hand-off to Books survives the move.
const TS_BROKERAGE = '/brokerage';
const TS_TRADE_LOG = '/trade-log';
const TS_EXPECT: ReadonlyArray<{ route: string; tool: string; file: string; nums: readonly string[] }> = [
  { route: TS_BROKERAGE, tool: 'Brokerage', file: 'src/app/brokerage/page.tsx', nums: ['01', '02', '03'] },
  { route: TS_TRADE_LOG, tool: 'Trade Log', file: 'src/app/trade-log/page.tsx', nums: ['04', '05', '06'] },
];
let tsViolations = 0;
const tsFail = (msg: string) => { tsViolations += 1; violations.push(`trade-split law: ${msg} (TRADE-SPLIT)`); };

if (MULTI_TOOL_ALLOWED.length !== 0) tsFail(`the multi-tool grandfather list is not empty (${MULTI_TOOL_ALLOWED.length}) — TOOL-LAW-01 has no exceptions to rule 1 any more`);

for (const e of TS_EXPECT) {
  const body = existsSync(resolve(ROOT, e.file)) ? codeOf(e.file) : '';
  if (!body) { tsFail(`${e.file} is missing — ${e.tool} has no page`); continue; }
  if (!body.includes('<StageStrip')) tsFail(`${e.file} renders no StageStrip — a tool's page renders its own phases through the shared strip`);
  const drawn = [...drawnNumsIn(body, 'trade')].sort();
  if (drawn.join('|') !== [...e.nums].sort().join('|')) tsFail(`${e.route} draws trade [${drawn.join(' ') || '—'}] but ${e.tool} owns [${e.nums.join(' ')}] — each tool renders its own three phases, no more and no less`);
  const home = TOOL_REGISTRY.find((t) => t.name === e.tool)?.home;
  if (home !== e.route) tsFail(`the registry home for ${e.tool} is ${home ?? 'null'}, not ${e.route}`);
  const served = screenTools.get(e.route) ?? [];
  if (served.join('|') !== e.tool) tsFail(`${e.route} serves [${served.join(' + ') || '—'}] — one tool, one page`);
}
// THE SORT still draws the line this split was made on.
for (const n of ['01', '02', '03']) if (!THE_SORT.some((x) => x.pipe === 'trade' && x.num === n && x.owner === 'Brokerage')) tsFail(`THE SORT no longer gives trade ${n} to Brokerage — the split follows THE SORT, never the other way round`);
for (const n of ['04', '05', '06']) if (!THE_SORT.some((x) => x.pipe === 'trade' && x.num === n && x.owner === 'Trade Log')) tsFail(`THE SORT no longer gives trade ${n} to Trade Log`);
// /trading is a redirect and renders nothing of its own.
const tsOld = existsSync(resolve(ROOT, 'src/app/trading/page.tsx')) ? codeOf('src/app/trading/page.tsx') : '';
if (tsOld) {
  if (!/redirect\('\/brokerage'\)/.test(tsOld)) tsFail('src/app/trading/page.tsx is not a redirect to /brokerage — the two tools moved out of it');
  if (/<StageStrip|<ToolOpener|<ConvergenceIntelligence|<TradeLabPanel/.test(tsOld)) tsFail('src/app/trading/page.tsx still renders a tool surface — it is a redirect now');
}
if (screenTools.has('/trading')) tsFail('/trading is still a tool\'s registry home — Brokerage is /brokerage and Trade Log is /trade-log');
// phase 06's hand-off to Books survives the move.
const tsCommit = PIPE_PHASES.trade.find((p) => p.num === '06');
if (!tsCommit?.link || tsCommit.link.target !== 'books') tsFail('trade 06 no longer hands off to books — phase 06\'s link is the pipe\'s own');
const tsLogBody = existsSync(resolve(ROOT, 'src/app/trade-log/page.tsx')) ? codeOf('src/app/trade-log/page.tsx') : '';
if (tsLogBody && !/href="\/books"/.test(tsLogBody)) tsFail('/trade-log does not carry phase 06\'s hand-off to Books');
if (tsLogBody && !/data-empty-room/.test(tsLogBody)) tsFail('/trade-log has no empty-room line — a room with no trade says what it needs, never a blank page');
const tsBrokerBody = existsSync(resolve(ROOT, 'src/app/brokerage/page.tsx')) ? codeOf('src/app/brokerage/page.tsx') : '';
if (tsBrokerBody && !/FOUNDER_BROKER_LINE/.test(tsBrokerBody)) tsFail('/brokerage no longer states TT-01\'s line — the scan phase is the founder\'s broker only and says so');

if (tsViolations === 0) console.log(`✔ The trade-split law passed — the grandfather list is EMPTY; ${TS_BROKERAGE} draws trade 01-03 and ${TS_TRADE_LOG} draws 04-06, one tool each, both registry homes; /trading is a redirect; phase 06 still hands to Books.`);

// ── TRADE-LOG-01 — A TRADE CAN BE LOGGED BY HAND ────────────────────────────
// Trade Log's work is a trade. Before this, a trading_positions row existed
// only at the end of a three-tool chain — connect a brokerage in Banking, sync
// it, commit its legs in Books — so the tool could not do its job for a
// customer who had none of that. A trade can now be entered by hand, and it is
// a FIRST-CLASS row: graded, linked, posted to Books, counted by EDGE-01.
//
// Three laws hold that in place:
//   1. EVERY writer that CREATES a trading_positions row names its source. A
//      row that falls through to the column's DEFAULT says "I predate the
//      column" when it does not — provenance you cannot read is provenance you
//      do not have.
//   2. NO reader branches on source for CAPABILITY. Provenance decides how a
//      row is DISPLAYED and how a read is SPLIT — never what the row can do.
//      Ownership is the one predicate (src/lib/tradeLog/ownership.ts), and it
//      never looks at source.
//   3. The form's strategy list IS the builders' const (AVAILABLE_STRATEGIES).
//      A strategy the scanner cannot build is one nothing can ever grade
//      against, so the form offers no way to type one.
const TL_OWNERSHIP = 'src/lib/tradeLog/ownership.ts';
const TL_WRITER = 'src/app/api/trade-log/manual/route.ts';
const TL_BUILDER = 'src/lib/tradeLog/manualTrade.ts';
const TL_PNL = 'src/lib/tradeLog/optionPnl.ts';
const TL_TRACKER = 'src/lib/position-tracker-service.ts';
const TL_FORM = 'src/components/trading/LogTradeForm.tsx';
const TL_PAGE = 'src/app/trade-log/page.tsx';
// The readers whose answer must not depend on where a row came from. Each one
// scopes through the ownership predicate and asks nothing about source.
const TL_CAPABILITY_READERS: readonly string[] = [
  'src/app/api/trade-card-links/route.ts',
  'src/app/api/trading/route.ts',
  'src/app/api/trading-positions/open/route.ts',
  'src/app/api/trading/coverage/route.ts',
  'src/app/api/positions/summary/route.ts',
  'src/lib/convergence/undefined-risk.prisma.ts',
];
let tlViolations = 0;
const tlFail = (msg: string) => { tlViolations += 1; violations.push(`trade-log law: ${msg} (TRADE-LOG-01)`); };
const tlRead = (f: string) => (existsSync(resolve(ROOT, f)) ? codeOf(f) : '');
// Comment lines are stripped: a citation in a comment can never satisfy a law.
const tlCode = (f: string) => tlRead(f).split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');

// LAW 1 — every CREATE of a trading_positions row names its source.
const tlSrcFiles = tsFiles(resolve(ROOT, 'src'));
const tlCreateRe = /trading_positions\.(create|createMany|upsert)\s*\(/g;
let tlCreators = 0;
for (const abs of tlSrcFiles) {
  const rel = abs.replace(`${ROOT}/`, '');
  const body = tlCode(rel);
  let m: RegExpExecArray | null;
  tlCreateRe.lastIndex = 0;
  while ((m = tlCreateRe.exec(body)) !== null) {
    tlCreators += 1;
    // The statement's own body: from the call to the end of its data object.
    const window = body.slice(m.index, m.index + 1400);
    if (!/source:/.test(window)) {
      tlFail(`${rel} creates a trading_positions row without naming its source — a row that takes the column's DEFAULT cannot say where it came from`);
    }
  }
}
if (tlCreators === 0) tlFail('no trading_positions writer found at all — the law has nothing to hold');
// The two values are named once, in the leaf, and the writers read them there.
const tlOwn = tlCode(TL_OWNERSHIP);
for (const name of ['MANUAL_SOURCE', 'SYNCED_SOURCE']) {
  if (!new RegExp(`export const ${name} = '`).test(tlOwn)) tlFail(`${TL_OWNERSHIP} does not export ${name} — the source values are named once`);
}
if (!/SYNCED_SOURCE/.test(tlCode(TL_TRACKER))) tlFail(`${TL_TRACKER} does not name SYNCED_SOURCE — the synced writer reads the value from the leaf, never a retyped string`);
if (!/MANUAL_SOURCE/.test(tlCode(TL_BUILDER))) tlFail(`${TL_BUILDER} does not name MANUAL_SOURCE`);

// LAW 2 — no reader branches on source for capability.
const tlSourceBranch = /source:\s*MANUAL_SOURCE|source:\s*SYNCED_SOURCE|source:\s*'(manual|plaid)'|isManualSource\s*\(/;
for (const f of TL_CAPABILITY_READERS) {
  const body = tlCode(f);
  if (!body) { tlFail(`${f} is missing — it is one of the readers the law holds`); continue; }
  if (!/positionOwnershipWhere\s*\(|ownsEveryLeg\s*\(|ownsPosition\s*\(/.test(body)) {
    tlFail(`${f} does not scope trading_positions through src/lib/tradeLog/ownership.ts — ownership is one predicate, not a retyped where`);
  }
  if (tlSourceBranch.test(body)) {
    tlFail(`${f} branches on source — provenance is display and the read's split, never what a row is allowed to do`);
  }
}
// The predicate itself never reads source, and the ownership OR is both shapes.
if (/\bsource\b/.test(tlOwn.split('MANUAL_SOURCE')[0] ?? '')) tlFail(`${TL_OWNERSHIP}'s ownership predicate reads source — ownership is provenance-blind`);
if (!/OR: \[\{ userId \}, \{ open_investment_txn_id: \{ in: \[\.\.\.arrivalTxnIds\] \} \}\]/.test(tlOwn)) {
  tlFail(`${TL_OWNERSHIP} no longer ORs the explicit owner with the arrivals chain — a hand-entered row has no arrival and an old row has no userId`);
}

// LAW 3 — the form's strategy list is the builders' const.
const tlForm = tlCode(TL_FORM);
if (!tlForm) tlFail(`${TL_FORM} is missing — phase 04 has no "Log a trade" surface`);
else {
  if (!/import \{ AVAILABLE_STRATEGIES \} from '@\/lib\/convergence\/filter-types'/.test(tlForm)) {
    tlFail(`${TL_FORM} does not read AVAILABLE_STRATEGIES from filter-types — the form offers the strategies the scanner BUILDS, never a typed list`);
  }
  if (!/AVAILABLE_STRATEGIES\.map\(/.test(tlForm)) tlFail(`${TL_FORM} does not render AVAILABLE_STRATEGIES as its options`);
  if (/<input[^>]*(id="ltf-strategy"|name="strategy")/.test(tlForm)) tlFail(`${TL_FORM} takes the strategy as free text — it is a select over the builders' const`);
  // The server validates against the same const: a form is not a gate.
  if (!/AVAILABLE_STRATEGIES/.test(tlCode(TL_WRITER))) tlFail(`${TL_WRITER} does not validate the strategy against AVAILABLE_STRATEGIES — the browser is not the gate`);
}
// The arithmetic is shared, not copied: the manual builder and the synced
// tracker both call the same leaf, so a hand-entered close cannot drift.
const tlPnl = tlCode(TL_PNL);
for (const fn of ['openCostBasisCents', 'closeProceedsCents', 'realizedPlCents', 'proportionalCostCents']) {
  if (!new RegExp(`export function ${fn}`).test(tlPnl)) tlFail(`${TL_PNL} does not export ${fn} — the shared P&L path is one leaf`);
  if (!new RegExp(fn).test(tlCode(TL_TRACKER))) tlFail(`${TL_TRACKER} does not call ${fn} — the synced close must use the SAME function the hand-entered close does`);
}
// A hand-entered trade is visible AS hand-entered, and is the only kind that
// can be corrected or removed here.
for (const marker of ['data-hand-entered', 'data-correct-trade', 'data-delete-trade', 'data-log-trade-form']) {
  if (!tlRead(TL_PAGE).includes(marker) && !tlRead(TL_FORM).includes(marker)) {
    tlFail(`neither ${TL_PAGE} nor ${TL_FORM} carries ${marker} — provenance must be visible and a correction offered only on a hand-entered trade`);
  }
}
// A delete never cascades: the linked card is named and the caller decides.
const tlWriter = tlCode(TL_WRITER);
if (!/status: 409/.test(tlWriter) || !/linked_card_id/.test(tlWriter)) {
  tlFail(`${TL_WRITER} does not refuse a delete that would orphan a trade card — a cascade is silent data loss`);
}

if (tlViolations === 0) console.log(`✔ The trade-log laws passed — ${tlCreators} trading_positions creator(s), every one naming its source from ${TL_OWNERSHIP}; ${TL_CAPABILITY_READERS.length} readers scope through the one ownership predicate and none branches on provenance; the form's strategies ARE the builders' const, validated again server-side; the synced and the hand-entered close share one P&L leaf.`);

// ── DAY-01 — THE DAY, WHOLE ─────────────────────────────────────────────────
// HubCalendar held `raw.filter((e) => e.source === 'trip')`: one bare string
// against one column, which threw away every home bill, planned purchase,
// budget line and agenda item the app writes. Two laws stop that returning:
//
//   1. THE ALLOWLIST IS A NAMED CONST WITH A REASON PER ENTRY. No component
//      filters calendar_events on a bare source string. A source renders
//      because src/lib/calendar/sources.ts names it, cites its writer at
//      file:line and says why; a source that does not render is named there
//      too, with its reason. Exclusion by silence is what let the trip filter
//      survive unexamined.
//
//   2. NO TOTAL WITHOUT ITS COVERAGE. A day's expected total is summed over the
//      events that carried an amount; the ones that did not are counted, and the
//      count ships with the number ("$340 planned across 5 of 8 events"). A bare
//      total would read as the whole day, which it is not.
const DAY_SOURCES = 'src/lib/calendar/sources.ts';
const DAY_LEAF = 'src/lib/calendar/day.ts';
const DAY_ACTUALS = 'src/lib/calendar/actuals.ts';
const DAY_VIEW_FILE = 'src/components/hub/DayView.tsx';
const DAY_HUB = 'src/components/hub/HubCalendar.tsx';
let dayViolations = 0;
const dayFail = (msg: string) => { dayViolations += 1; violations.push(`day law: ${msg} (DAY-01)`); };
const dayRead = (f: string) => (existsSync(resolve(ROOT, f)) ? codeOf(f) : '');
const dayCode = (f: string) => dayRead(f).split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');

// LAW 1 — the allowlist is the only thing that decides, and it is not bare.
const dayList = dayCode(DAY_SOURCES);
if (!dayList) dayFail(`${DAY_SOURCES} is missing — the calendar has no named source list`);
else {
  if (!/export const CALENDAR_SOURCES/.test(dayList)) dayFail(`${DAY_SOURCES} does not export CALENDAR_SOURCES`);
  if (!/export const EXCLUDED_CALENDAR_SOURCES/.test(dayList)) dayFail(`${DAY_SOURCES} names nothing as EXCLUDED — a source that does not render is named, never omitted`);
  if (!/calendarSourcesLaw\(\);/.test(dayList)) dayFail(`${DAY_SOURCES} does not run its own law at module scope`);
}
// The rendered set, read from the leaf itself so this law and the app agree.
if (CALENDAR_SOURCES.length === 0) dayFail('the calendar renders no source at all');
for (const r of CALENDAR_SOURCES) {
  if (!/:\d+/.test(r.writtenBy)) dayFail(`${r.source} cites no writer at file:line`);
  if (!r.why) dayFail(`${r.source} renders for no stated reason`);
  // A tailwind class built from a template never reaches the stylesheet — the
  // chip would render unstyled and nobody would be told.
  for (const cls of Object.values(r.tint)) if (cls.includes('${')) dayFail(`${r.source} builds the class "${cls}" — Tailwind reads source text, so it would ship unstyled`);
}
for (const e of EXCLUDED_CALENDAR_SOURCES) if (!e.why) dayFail(`${e.source} is excluded with no reason`);

// NO BARE SOURCE FILTER anywhere a calendar_events row is SELECTED for render.
// The allowlist is the one place a source string decides WHETHER a row is drawn.
//
// This is deliberately about SELECTION, not about styling or geometry. A branch
// that decides HOW an already-admitted row is drawn — CalendarGrid.tsx:266 draws
// a flight's block from its true elapsed duration, because only trip rows carry
// duration_minutes/start_at/start_zone — is not what threw the day away, and is
// not caught here. What threw the day away was a `.filter(e => e.source === ...)`
// deciding which rows survived, so that is exactly the shape this law hunts.
const DAY_KNOWN_SOURCES = CALENDAR_SOURCES.map((r) => r.source).join('|');
const dayBareFilter = new RegExp(`\\.filter\\([^;\\n]{0,160}?\\.source\\s*===\\s*'(${DAY_KNOWN_SOURCES})'`);
for (const rel of walkSrc('src/components').concat(walkSrc('src/app'))) {
  const body = dayCode(rel);
  if (!body.includes('calendar')) continue;
  const m = dayBareFilter.exec(body);
  if (m) dayFail(`${rel} selects calendar events with a bare .filter on source '${m[1]}' — a source renders because ${DAY_SOURCES} names it with a reason, not because one component typed its name`);
}
const dayHubBody = dayCode(DAY_HUB);
if (dayHubBody && !/isRenderedCalendarSource\(/.test(dayHubBody)) dayFail(`${DAY_HUB} does not ask the allowlist which sources render`);

// LAW 2 — no total without its coverage.
const dayLeaf = dayCode(DAY_LEAF);
if (!dayLeaf) dayFail(`${DAY_LEAF} is missing — the day has no pure builder`);
else {
  if (!/covered: number;/.test(dayLeaf) || !/of: number;/.test(dayLeaf)) dayFail(`${DAY_LEAF}'s total carries no coverage count — a total that does not say what it covers reads as the whole day`);
  if (!/export function coverageLine/.test(dayLeaf)) dayFail(`${DAY_LEAF} exports no coverageLine — the total and its coverage are one string, so they cannot be rendered apart`);
}
const dayViewBody = dayCode(DAY_VIEW_FILE);
if (!dayViewBody) dayFail(`${DAY_VIEW_FILE} is missing — a day does not open`);
else {
  // Every total the day view prints goes through coverageLine.
  // ROUTINE-01: every total in the day view is NAMED and carries the coverage
  // that earned it. DAY-01 checked that each total went through coverageLine;
  // now each also has to say WHICH PART it is, because an unlabelled figure was
  // exactly the defect — "Events" silently contained the routines too.
  const totalsRendered = (dayViewBody.match(/data-day-total-part|data-day-total\b|data-day-task-total/g) ?? []).length;
  const namedLines = (dayViewBody.match(/partLine\(|dayTotalLine\(/g) ?? []).length;
  if (totalsRendered === 0) dayFail(`${DAY_VIEW_FILE} renders no day total at all`);
  if (namedLines < totalsRendered) dayFail(`${DAY_VIEW_FILE} renders ${totalsRendered} total(s) through ${namedLines} named line(s) — every total names its part and ships with its coverage count`);
  // ONE SUMMATION. The parts and the grand total come from dayParts; a direct
  // expectedTotal here would be a second sweep that could disagree with them.
  if (/expectedTotal\(/.test(dayViewBody)) dayFail(`${DAY_VIEW_FILE} sums the day itself — the parts and their sum come from dayParts(), so they cannot disagree`);
  if (!/dayParts\(rows, tasks\)/.test(dayViewBody)) dayFail(`${DAY_VIEW_FILE} does not build its totals from dayParts(rows, tasks)`);
  // The parts are RENDERED FROM THE LIST, never three hand-written rows that
  // could drift from what dayParts computed.
  if (!/totals\.parts\.map\(/.test(dayViewBody)) dayFail(`${DAY_VIEW_FILE} does not render its parts from the parts list`);
  // WHAT THE DAY MAY WRITE. DAY-01 shipped it read-only. EVENT-01 STEP 5 added
  // exactly ONE write: deleting a HAND-ENTERED event, through the manual-event
  // route, which refuses every other source itself. Nothing else — it still
  // creates nothing, updates nothing, and never writes daily_plans (Tasks owns
  // that row) or calendar_events directly.
  const dayViewMethods = [...dayViewBody.matchAll(/method:\s*'(\w+)'/g)].map((m) => m[1]);
  const dayViewExtra = dayViewMethods.filter((m) => m !== 'DELETE');
  if (dayViewExtra.length > 0) dayFail(`${DAY_VIEW_FILE} issues ${dayViewExtra.join(', ')} — the day creates and updates nothing (Trips, Budget, Agenda and Tasks own these rows)`);
  if (dayViewMethods.length > 1) dayFail(`${DAY_VIEW_FILE} carries ${dayViewMethods.length} writes — the only one allowed is deleting a hand-entered event`);
  if (dayViewMethods.length === 1 && !/\/api\/calendar\/events\?id=/.test(dayViewBody)) {
    dayFail(`${DAY_VIEW_FILE} writes somewhere other than the manual-event route`);
  }
  if (/daily-plan[^)]*method:/.test(dayViewBody)) dayFail(`${DAY_VIEW_FILE} writes daily_plans — Tasks owns that row, the day only reads it`);
  // NO PROVIDER, NO GEOCODING (the ruling's FORBIDDEN): the map plots what is stored.
  if (/googleapis|mapbox|openstreetmap|tile\.|geocod/i.test(dayViewBody)) dayFail(`${DAY_VIEW_FILE} reaches a map or geocoding provider — the day plots only the coordinates already stored`);
  // The actuals finding is STATED, not silently omitted.
  if (!/ACTUALS_JOIN_SOUND/.test(dayViewBody) || !/ACTUALS_NOT_JOINABLE_LINE/.test(dayViewBody)) {
    dayFail(`${DAY_VIEW_FILE} does not state why an actual cost is missing — an empty column is a question the reader answers with a guess`);
  }
}
const dayActuals = dayCode(DAY_ACTUALS);
if (!dayActuals) dayFail(`${DAY_ACTUALS} is missing — the Books-join verdict is not recorded`);
else if (!/export const ACTUALS_JOIN_SOUND/.test(dayActuals) || !/ACTUALS_JOIN_BLOCKERS/.test(dayActuals)) {
  dayFail(`${DAY_ACTUALS} records no verdict and no blockers`);
}

if (dayViolations === 0) console.log(`✔ The day laws passed — ${CALENDAR_SOURCES.length} calendar sources rendered by name (${CALENDAR_SOURCES.map((s) => s.source).join(' · ')}), ${EXCLUDED_CALENDAR_SOURCES.length} excluded by name; no component filters a calendar event on a bare source; every day total names its part and ships with its coverage count, summed once in dayParts(); the day view creates and updates nothing (its one write deletes a hand-entered event) and reaches no map provider.`);

// ── EVENT-01 — AN EVENT CAN BE ADDED BY HAND ────────────────────────────────
// DAY-01's audit found /api/calendar GET-only: no form, no route, no path wrote
// a calendar_event by hand, so a trip could be planned and a Tuesday could not.
// Three laws hold the hand-entered path honest:
//
//   1. EVERY calendar_events WRITER SETS user_id AND source. A row with a null
//      user_id is invisible to every reader (all three SELECTs in
//      api/calendar/route.ts are `WHERE user_id = …`), so it exists and nobody
//      can ever see it — written and lost. A row with no source cannot be
//      admitted by the allowlist and would never render either.
//   2. THE MANUAL SOURCE IS IN THE ALLOWLIST. A source the writer invents but
//      the allowlist does not name writes rows nothing draws — the exact shape
//      of the agenda dead write DAY-01 reported.
//   3. NO WRITER SETS A CATEGORY OUTSIDE THE CENSUS. The census is what the
//      existing writers already put in the column; a category outside it has no
//      icon and no colour anyone chose, and renders as a blank tile.
//
// ONEOFF-01 (2026-09-18): THE CALENDAR AUTHORS NOTHING. The add form became the
// edit-only correction form and POST left the route: no writer INSERTS a
// 'manual' row any more. The three laws hold on what remains — the correction
// and the removal of a row entered by hand before the ruling.
const EV_CENSUS = 'src/lib/calendar/manualEvent.ts';
const EV_ROUTE = 'src/app/api/calendar/events/route.ts';
const EV_FORM = 'src/components/hub/CorrectEventForm.tsx';
let evViolations = 0;
const evFail = (msg: string) => { evViolations += 1; violations.push(`event law: ${msg} (EVENT-01)`); };

// LAW 1 — every INSERT INTO calendar_events sets user_id and source.
const evInsertRe = /INSERT INTO calendar_events\s*\(([\s\S]{0,600}?)\)/g;
let evWriters = 0;
for (const abs of tsFiles(resolve(ROOT, 'src'))) {
  const rel = abs.replace(`${ROOT}/`, '');
  const body = dayCode(rel);
  evInsertRe.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = evInsertRe.exec(body)) !== null) {
    evWriters += 1;
    const cols = m[1];
    if (!/\buser_id\b/.test(cols)) evFail(`${rel} writes a calendar_event with no user_id — every reader scopes on it, so the row would exist and be invisible to everyone`);
    if (!/\bsource\b/.test(cols)) evFail(`${rel} writes a calendar_event with no source — the allowlist could never admit it, so nothing would draw it`);
    // ONEOFF-01: no writer inserts a hand-entered row — the calendar authors nothing.
    if (/MANUAL_EVENT_SOURCE|source:\s*'manual'/.test(body)) evFail(`${rel} inserts a calendar_event with the manual source — the calendar authors nothing; a one-off is a routine planned in Tasks (ONEOFF-01)`);
  }
}
if (evWriters === 0) evFail('no calendar_events writer found at all — the law has nothing to hold');

// LAW 2 — the manual source is named in the allowlist, and the writer reads it
// from there rather than typing the string a second time.
if (!CALENDAR_SOURCES.some((r) => r.source === MANUAL_EVENT_SOURCE)) {
  evFail(`the allowlist does not name '${MANUAL_EVENT_SOURCE}' — a hand-entered event would be written and never drawn (the agenda dead write, again)`);
}
const evRouteBody = dayCode(EV_ROUTE);
if (!evRouteBody) evFail(`${EV_ROUTE} is missing — there is no way to add an event by hand`);
else {
  if (!/MANUAL_EVENT_SOURCE/.test(evRouteBody)) evFail(`${EV_ROUTE} does not read MANUAL_EVENT_SOURCE from the allowlist — the source value is named once`);
  for (const verb of ['PATCH', 'DELETE']) {
    if (!new RegExp(`export async function ${verb}`).test(evRouteBody)) evFail(`${EV_ROUTE} has no ${verb} — a row entered by hand before ONEOFF-01 stays correctable and removable`);
  }
  // ONEOFF-01: and NO POST. A method the route does not export answers 405.
  if (/export async function POST\b/.test(evRouteBody)) evFail(`${EV_ROUTE} exports POST — the calendar authors nothing; a one-off is a routine planned in Tasks (ONEOFF-01)`);
  if (/INSERT INTO calendar_events/.test(evRouteBody)) evFail(`${EV_ROUTE} inserts a calendar_event — no new hand-entered row is written by the calendar (ONEOFF-01)`);
  // USER-SCOPED, always: the caller is resolved first and every statement that
  // reaches a row carries the caller's id.
  const evStatements = evRouteBody.match(/(SELECT|UPDATE|DELETE)[\s\S]{0,400}?calendar_events[\s\S]{0,400}?(?=`)/g) ?? [];
  for (const st of evStatements) {
    if (/WHERE/.test(st) && !/user_id = \$?\{?\w*user/.test(st.replace(/\$\d+/g, 'user'))) {
      evFail(`${EV_ROUTE} reaches a calendar_event without the caller's user_id — another user's row must simply not be found`);
    }
  }
  if ((evRouteBody.match(/status: 401/g) ?? []).length < 2) evFail(`${EV_ROUTE} does not answer 401 on every verb before touching the store`);
  // A row another path owns is REFUSED WITH ITS REASON, never edited or deleted.
  if (!/status: 409/.test(evRouteBody) || !/which owns it/.test(evRouteBody)) {
    evFail(`${EV_ROUTE} does not refuse a row belonging to another source with its reason — a trip or budget row is its owner path's record`);
  }
  // NO RECURRENCE in this PR — the columns exist and stay false/null (EVENT-02).
  if (/recurrence_rule\s*=\s*[^n]/.test(evRouteBody)) evFail(`${EV_ROUTE} writes a recurrence rule — a recurring hand-entered event is EVENT-02, and no reader expands occurrences today`);
  // NO GEOCODER, NO METERED CALL.
  if (/googleFetch\s*\(|maps\.googleapis|GOOGLE_PLACES_API_KEY|geocode\s*\(|nominatim|mapbox|opencage/i.test(evRouteBody)) evFail(`${EV_ROUTE} reaches a geocoder — EVENT-01 adds no provider and no metered call`);
}
// The form must never call Google DIRECTLY — the API key stays on the server.
// GEO-01 gave it a lookup, and that lookup is the app's own route
// (/api/calendar/find-place), which is where the metered call lives.
if (/googleFetch\s*\(|maps\.googleapis|GOOGLE_PLACES_API_KEY|geocode\s*\(|nominatim|mapbox|opencage/i.test(dayCode(EV_FORM))) evFail(`${EV_FORM} calls a geocoding provider directly — the key stays on the server, behind the app's own route`);

// LAW 3 — no writer sets a category outside the census.
const evCensusBody = dayCode(EV_CENSUS);
if (!evCensusBody) evFail(`${EV_CENSUS} is missing — there is no category census`);
else if (!/export const EVENT_CATEGORIES/.test(evCensusBody)) evFail(`${EV_CENSUS} does not export EVENT_CATEGORIES`);
// THE CENSUS IS COMPLETE. The categories the other writers actually put in the
// column are read back out of their own files and held against the list, so the
// census cannot silently fall behind a writer that grows a new one.
const EV_CATEGORY_NAMES = new Set(EVENT_CATEGORIES.map((c) => c.category));
const EV_CENSUS_SOURCES: ReadonlyArray<{ file: string; re: RegExp }> = [
  // budget/[module]/[id]/route.ts MODULE_MARK — the source IS the category.
  { file: 'src/app/api/budget/[module]/[id]/route.ts', re: /^\s*(\w+): \{ icon: '/gm },
  // agenda/[id]/route.ts categoryIcons — the agenda item's own categories.
  { file: 'src/app/api/agenda/[id]/route.ts', re: /(\w+): '\p{Extended_Pictographic}/gu },
];
for (const { file, re } of EV_CENSUS_SOURCES) {
  const body = dayCode(file);
  if (!body) { evFail(`${file} is missing — the census cannot be checked against its writer`); continue; }
  for (const m of body.matchAll(re)) {
    const name = m[1];
    if (!EV_CATEGORY_NAMES.has(name)) {
      evFail(`${file} writes the category '${name}', which ${EV_CENSUS} does not hold — a category outside the census has no icon and no colour anyone chose`);
    }
  }
}
for (const c of EVENT_CATEGORIES) {
  if (!/:\d+/.test(c.evidence)) evFail(`the category '${c.category}' cites no writer at file:line — the census is gathered, not invented`);
  if (!c.icon) evFail(`the category '${c.category}' has no icon — it would render as a blank tile`);
}
// The builder may only ever produce a census category, and the form may only
// ever offer one: both read EVENT_CATEGORIES rather than a list of their own.
if (evCensusBody && !/categoryOf\(input\?\.category\)/.test(evCensusBody)) {
  evFail(`${EV_CENSUS} does not resolve the category through the census before building the row`);
}
const evFormBody = dayCode(EV_FORM);
if (!evFormBody) evFail(`${EV_FORM} is missing — there is no form`);
else {
  if (!/EVENT_CATEGORIES\.map\(/.test(evFormBody)) evFail(`${EV_FORM} does not offer the census as its category options`);
  // The category is the one field with no blank; a cost or a time left empty
  // must post NOTHING rather than a zero or a midnight nobody chose.
  if (!/typedNumber/.test(evFormBody)) evFail(`${EV_FORM} does not guard an empty number box — Number('') is 0, and a defaulted cost is a fabricated one`);
  if (/value=\{0\}|\?\?\s*0\b/.test(evFormBody)) evFail(`${EV_FORM} defaults a number to 0 — an empty box is not a zero`);
}
// A hand-entered event is MARKED where it renders.
const evDayView = dayCode(DAY_VIEW_FILE);
if (evDayView && !/isManualEvent\(/.test(evDayView)) evFail(`${DAY_VIEW_FILE} does not mark a hand-entered event — provenance is visible, as TRADE-LOG-01 rules for a hand-entered trade`);
if (evDayView && !/data-correct-event/.test(evDayView)) evFail(`${DAY_VIEW_FILE} offers no correction on a hand-entered event`);

if (evViolations === 0) console.log(`✔ The event laws passed — ${evWriters} calendar_events writer(s), every one setting user_id and source, none of them the manual source (ONEOFF-01: the calendar authors nothing, POST is gone); '${MANUAL_EVENT_SOURCE}' stays in the allowlist for its pre-ruling rows; ${EVENT_CATEGORIES.length} categories in the census, each citing the writer it was gathered from; the correction route is user-scoped on both verbs, refuses another source's row with its reason, writes no recurrence and never calls a provider directly.`);

// ── GEO-01 — ONE GEOCODE, ON PURPOSE ────────────────────────────────────────
// EVENT-01 left the geocoder decision with the founder rather than wire a
// daily-use form to a metered endpoint unasked. The answer was yes — ONE call,
// only when the person presses the button. The whole risk of that answer is
// that the call quietly migrates somewhere it fires without a press: an effect,
// a debounce, an onBlur, the submit path, a render. This law is that boundary.
//
//   THE CALENDAR'S GEOCODE HAS EXACTLY ONE CALL SITE, and the form reaches it
//   only from an onClick handler. No effect, no submit, no render, no typing.
const GEO_ROUTE = 'src/app/api/calendar/find-place/route.ts';
const GEO_LEAF = 'src/lib/calendar/findPlace.ts';
// ONEOFF-01: the button MOVED to Tasks, intact — its own component, mounted by
// the routine creator and the row's edit form. The same one-press rule, the
// same cap, the same laws; only the home changed.
const GEO_FORM = 'src/components/workbench/operations/routines/FindThisPlace.tsx';
let geoViolations = 0;
const geoFail = (msg: string) => { geoViolations += 1; violations.push(`geo law: ${msg} (GEO-01)`); };

const geoRouteBody = dayCode(GEO_ROUTE);
if (!geoRouteBody) geoFail(`${GEO_ROUTE} is missing — the calendar has no place lookup`);
else {
  // ONE call, through the quota guard, per request.
  const googleCalls = (geoRouteBody.match(/googleFetch\s*\(/g) ?? []).length;
  if (googleCalls !== 1) geoFail(`${GEO_ROUTE} makes ${googleCalls} googleFetch call(s) — the ruling is ONE per press`);
  if (/fetch\s*\(\s*['"`]https:\/\/maps\.googleapis/.test(geoRouteBody)) {
    geoFail(`${GEO_ROUTE} calls Google outside googleFetch — every outbound Google call is counted against the monthly cap`);
  }
  // The cap is READ and REPORTED, and refused at with its reset date.
  if (!/getGoogleUsage\(/.test(geoRouteBody)) geoFail(`${GEO_ROUTE} never reads the cap — the person cannot see what they are spending`);
  if (!/status: 429/.test(geoRouteBody) || !/capResetsOn\(/.test(geoRouteBody)) {
    geoFail(`${GEO_ROUTE} does not refuse at the cap with its reset date`);
  }
  if (!/GooglePlacesQuotaError/.test(geoRouteBody)) geoFail(`${GEO_ROUTE} does not handle the quota guard's own throw`);
  // A refusal is NAMED — never returned as an empty match list.
  if (!/GooglePlacesApiError/.test(geoRouteBody) || !/status: 502/.test(geoRouteBody)) {
    geoFail(`${GEO_ROUTE} does not name a provider refusal — a REQUEST_DENIED must never read as "no matches"`);
  }
  // ONE PROVIDER. No second geocoding service, paid or free.
  for (const other of ['nominatim', 'openstreetmap', 'mapbox', 'opencage', 'positionstack', 'here.com', 'locationiq']) {
    if (geoRouteBody.toLowerCase().includes(other)) geoFail(`${GEO_ROUTE} reaches ${other} — GEO-01 adds no second provider`);
  }
}

// THE FORM: the lookup is reached ONLY from a press.
const geoFormBody = dayCode(GEO_FORM);
if (!geoFormBody) geoFail(`${GEO_FORM} is missing`);
else {
  const geoHits = [...geoFormBody.matchAll(/\/api\/calendar\/find-place/g)];
  if (geoHits.length !== 1) geoFail(`${GEO_FORM} reaches the lookup from ${geoHits.length} place(s) — there is one handler`);
  // The one fetch must sit inside the named handler, and that handler must be
  // wired to an onClick and to nothing else.
  const handlerAt = geoFormBody.indexOf('const findThisPlace = async () =>');
  if (handlerAt === -1) geoFail(`${GEO_FORM} has no named findThisPlace handler to hold the call in`);
  else if (geoHits.length === 1 && geoHits[0].index! < handlerAt) {
    geoFail(`${GEO_FORM} reaches the lookup before its handler — the call must live inside findThisPlace`);
  }
  const wiredFrom = [...geoFormBody.matchAll(/(\w+)=\{findThisPlace\}/g)].map((m) => m[1]);
  if (wiredFrom.length === 0) geoFail(`${GEO_FORM} never wires findThisPlace to anything`);
  for (const prop of wiredFrom) {
    if (prop !== 'onClick') geoFail(`${GEO_FORM} wires findThisPlace to ${prop} — a metered call is spent by a press, not by ${prop}`);
  }
  // NO EFFECT may reach it: a useEffect that calls it fires without a press.
  for (const m of geoFormBody.matchAll(/useEffect\(\(\)\s*=>\s*\{([\s\S]*?)\n  \}/g)) {
    if (/findThisPlace|find-place/.test(m[1])) geoFail(`${GEO_FORM} calls the lookup from a useEffect — that fires without a press`);
  }
  // NOR the submit path, NOR a debounce/timer.
  const submitAt = geoFormBody.indexOf('const submit = async () =>');
  if (submitAt > -1) {
    const submitBody = geoFormBody.slice(submitAt, geoFormBody.indexOf('\n  };', submitAt));
    if (/findThisPlace|find-place/.test(submitBody)) geoFail(`${GEO_FORM} looks the place up on submit — saving must never spend a call`);
  }
  if (/setTimeout[\s\S]{0,120}findThisPlace|debounce/i.test(geoFormBody)) {
    geoFail(`${GEO_FORM} debounces or delays the lookup — that is typing spending the call`);
  }
  // NOTHING IS AUTO-SELECTED: a pick is always a press.
  if (/matches\[0\]|results\[0\]/.test(geoFormBody)) geoFail(`${GEO_FORM} reaches for the first match — nothing is auto-selected`);
  if (!/data-find-place-match/.test(geoFormBody)) geoFail(`${GEO_FORM} renders no pickable match`);
  // The typed-name-only path stays first-class, and the cap is visible.
  if (!/data-find-place-clear/.test(geoFormBody)) geoFail(`${GEO_FORM} offers no way back to the typed name with no coordinates`);
  if (!/atCapLine\(/.test(geoFormBody)) geoFail(`${GEO_FORM} does not state the cap and its reset date`);
  if (!/disabled=\{finding \|\| atCap/.test(geoFormBody)) geoFail(`${GEO_FORM} does not disable the button at the cap`);
}

// NO OTHER calendar surface looks a place up.
for (const rel of walkSrc('src/components').concat(walkSrc('src/app'))) {
  if (rel === GEO_FORM || rel === GEO_ROUTE) continue;
  const body = dayCode(rel);
  if (/\/api\/calendar\/find-place/.test(body)) {
    geoFail(`${rel} reaches the calendar's place lookup — it has one call site, the form's button`);
  }
}
if (dayCode(GEO_LEAF) && /fetch\s*\(/.test(dayCode(GEO_LEAF))) {
  geoFail(`${GEO_LEAF} fetches — the leaf is pure so a test can check the query and the cap without a network`);
}
// ONEOFF-01: ONE component in the repo renders the button, and it is Tasks'.
const geoButtonFiles = walkSrc('src/components').concat(walkSrc('src/app')).filter((rel) => /data-find-place(?![\w-])/.test(dayCode(rel)));
if (geoButtonFiles.length !== 1 || geoButtonFiles[0] !== GEO_FORM) {
  geoFail(`Find this place is rendered by ${geoButtonFiles.join(', ') || 'nothing'} — exactly one component renders it, ${GEO_FORM} (ONEOFF-01)`);
}
if (!/<FindThisPlace/.test(dayCode('src/components/workbench/operations/routines/RoutineCreateForm.tsx'))) {
  geoFail('the routine creator does not mount FindThisPlace — a one-off is planned in Tasks, and its place is found there (ONEOFF-01)');
}

if (geoViolations === 0) console.log(`✔ The geo law passed — the place lookup has ONE call site (${GEO_ROUTE}, one googleFetch), reached only from the onClick of the one component that renders the button (${GEO_FORM}, in Tasks since ONEOFF-01); no effect, submit, debounce or render spends a call; nothing is auto-selected; the cap is read, reported and refused at with its reset date.`);

// ── ORPHAN-01 — NO PAGE OUTSIDE THE REGISTRY ────────────────────────────────
// TOOL-LAW-01 deleted /operations as a ROOM-02 invention, and TRADE-SPLIT closed
// the last grandfather entry — yet pages under src/app/operations/ survived the
// room's deletion. The tool law could not see them: EVERY one of its checks gates
// on `screenTools.get(route)`, and `screenTools` is built ONLY from registry rows
// that carry an href (:1013-1014). Tool law 5 says so out loud —
// "if (!tools) continue; // not a tool's page". An UNREGISTERED page is therefore
// never selected, and the law has nothing to say about it.
//
// The reachability law walks every page, but it asks a different question: does
// this page have a DOOR? A survivor with a door passes it honestly. Neither law
// asked the question this one asks:
//
//   IS THIS PAGE ACCOUNTED FOR BY THE REGISTRY?
//
// A page is accounted for when it is, in this order:
//   0. named on ORPHAN_EXCEPTIONS below, with a reason and the ruling that will
//      resolve it — checked FIRST so a declared survivor is governed by its
//      entry and cannot drift into passing by some other branch;
//   1. a registered tool home, or a page beneath one (/compliance/citations);
//   2. a page a registry entry LINKS to, or beneath one — a tool naming a page
//      is the registry accounting for it;
//   3. a dated redirect — one hop to the owner, carrying no UI (the /trading
//      idiom from TRADE-SPLIT);
//   4. a listed guest / marketing / flow route (GUEST_ROUTES above, each cited);
//   5. NAMED on SHELL_PAGES below — a page the shell itself doors (the rail,
//      the sheet's family reads, the utilities menu, an answer card) that
//      belongs to no tool. These are legitimate and permanent, so they carry a
//      cited door and no TODO. They are LISTED rather than waved through: being
//      doored is not the same as being accounted for, and a blanket "the shell
//      doors it" branch would swallow the very case this law exists to catch.
// Anything else fails the build.
//
// WHAT THIS LAW CATCHES THAT THE REACHABILITY LAW DOES NOT. Reachability asks
// "does this page have a door?" and fires at the FIRST gate (:589), so a page
// with NO door never reaches this law at all. The gap it leaves is a page that
// HAS a door and belongs to nobody — doored, working, and owned by no tool and
// no ruling. That is precisely what the /operations survivors were, and it is
// what this law refuses: every such page is named, on one list or the other.
interface OrphanException { route: string; why: string; todo: string }
/**
 * THE EXCEPTION LIST. Like the tool law's grandfather list it is CLOSED and may
 * only SHRINK — the build throws if it grows. Each entry names the page, why it
 * still exists, and the ruling that will resolve it.
 *
 * Both entries are the last real pages of the deleted /operations room. They
 * would pass branch 2 on their own (toolRegistry.ts:120 — Tasks links both), but
 * ORPHAN-01 names them here deliberately: a survivor should be declared, not
 * merely tolerated by a branch that happens to cover it.
 */
const ORPHAN_EXCEPTIONS: readonly OrphanException[] = [
  {
    route: '/operations/audit-log',
    why: 'the operations-filtered hash-chained audit tail (SectionK_AuditTail) — real, working content, and the source phase 06 read before the room was deleted. Tasks links it (src/lib/toolRegistry.ts:120) and src/lib/__tests__/nav.test.ts:110 already records that ownership.',
    todo: 'ORPHAN-02 decides whether it earns a home of its own, moves under /tasks, or belongs to Compliance beside /compliance/audit-log.',
  },
  {
    route: '/operations/issues',
    why: 'an UNBUILT PlaceholderCard ("ISSUE LOG", PR-Ops-6) — it renders no tool and holds no state. Tasks links it (src/lib/toolRegistry.ts:120).',
    todo: 'ORPHAN-02 decides whether the issue log is built under a tool or the page is deleted; a placeholder is not a tool.',
  },
] as const;
const ORPHAN_EXCEPTIONS_SET_ON = '2026-09-17';
const ORPHAN_EXCEPTIONS_MAX = 2; // shrink-only, exactly as MULTI_TOOL_ALLOWED is

let orphanViolations = 0;
const orphanFail = (msg: string) => { orphanViolations += 1; violations.push(`orphan law: ${msg} (ORPHAN-01)`); };

if (ORPHAN_EXCEPTIONS.length > ORPHAN_EXCEPTIONS_MAX) {
  orphanFail(`the exception list grew to ${ORPHAN_EXCEPTIONS.length} (set ${ORPHAN_EXCEPTIONS_SET_ON} at ${ORPHAN_EXCEPTIONS_MAX}) — it may only shrink, like the tool law's grandfather list`);
}
for (const e of ORPHAN_EXCEPTIONS) {
  if (!e.why) orphanFail(`${e.route} is excepted with no reason`);
  if (!e.todo) orphanFail(`${e.route} is excepted with no ruling named to resolve it — an exception without an end is a permanent one`);
  if (!pages.some((p) => p.route === e.route)) orphanFail(`${e.route} is on the exception list but no such page exists — the list may only shrink, so remove it`);
}

/**
 * Pages the SHELL doors that are no tool's — the app map's own. Each names the
 * door that opens it, verified below against the reachability law's `reach` map
 * so a listing cannot claim a door the shell does not actually provide.
 * Permanent and legitimate: no TODO, and this list MAY grow when the shell
 * genuinely gains a page. ORPHAN_EXCEPTIONS is the one that may only shrink.
 */
const SHELL_PAGES: ReadonlyArray<{ route: string; door: string }> = [
  { route: '/home', door: 'rail — Home, the rail\'s first entry' },
  { route: '/owner', door: 'utilities menu — Owner · proposals inbox (src/lib/shellMenu.ts OWNER_UTILITIES)' },
  { route: '/developer', door: 'utilities menu — Developer console' },
  { route: '/data-observatory', door: 'utilities menu — Data observatory' },
  { route: '/income', door: 'sheet — MONEY IN · read "Income · a read" (nav.ts FAMILY_READS)' },
  { route: '/net-worth', door: 'sheet — WHAT YOU OWN · read "Net worth · a read"' },
];
const SHELL_DOOR_KINDS = ['rail', 'sheet', 'utilities menu', 'answers'];

// A SHELL_PAGES entry must name a page that exists and that the shell REALLY
// doors — a listing cannot invent a door the app map does not provide.
for (const sp of SHELL_PAGES) {
  const page = pages.find((p) => p.route === sp.route);
  if (!page) { orphanFail(`${sp.route} is on SHELL_PAGES but no such page exists`); continue; }
  const d = reach.get(sp.route);
  if (!d || !SHELL_DOOR_KINDS.includes(d.kind)) {
    orphanFail(`${sp.route} is on SHELL_PAGES claiming "${sp.door}", but the shell doors it ${d ? `as a ${d.kind}` : 'nowhere'} — the list may not invent a door`);
  }
  if (!sp.door) orphanFail(`${sp.route} is on SHELL_PAGES with no door cited`);
}

// The registry's own anchors: every home, and every page a tool LINKS to.
const orphanHomes = TOOL_REGISTRY.map((t) => t.home).filter((h): h is string => !!h);
const orphanLinks = TOOL_REGISTRY.flatMap((t) => (t.links ?? []).map((l) => l.href)).filter((h): h is string => !!h);
/** A page whose whole body is one hop to another route. */
const isDatedRedirect = (file: string): boolean => {
  const body = existsSync(resolve(ROOT, file)) ? codeOf(file) : '';
  return /redirect\(['"`]\//.test(body);
};

const orphanCounts = { exception: 0, home: 0, link: 0, redirect: 0, guest: 0, shell: 0 };
for (const p of pages) {
  if (ORPHAN_EXCEPTIONS.some((e) => e.route === p.route)) { orphanCounts.exception += 1; continue; }
  if (orphanHomes.some((h) => doorCovers(h, p.route))) { orphanCounts.home += 1; continue; }
  if (orphanLinks.some((l) => doorCovers(l, p.route))) { orphanCounts.link += 1; continue; }
  if (isDatedRedirect(p.file)) { orphanCounts.redirect += 1; continue; }
  if (GUEST_ROUTES.some((g) => doorCovers(g.route, p.route))) { orphanCounts.guest += 1; continue; }
  if (SHELL_PAGES.some((sp) => sp.route === p.route)) { orphanCounts.shell += 1; continue; }
  const shellDoor = reach.get(p.route);
  const doored = shellDoor && SHELL_DOOR_KINDS.includes(shellDoor.kind)
    ? ` The shell does door it (${shellDoor.kind}: ${shellDoor.via}) — if it is the app map's own page, name it on SHELL_PAGES with that door.`
    : '';
  orphanFail(`${p.route} (${p.file}) is outside the registry — it is no tool's home, no tool links it, it is not a redirect and it is not a listed guest route, and it is on neither SHELL_PAGES nor ORPHAN_EXCEPTIONS.${doored} Give it a home, redirect it to its owner, or name it with its reason`);
}

// The two duplicates of the deleted room point at their owners, not at a survivor.
const ORPHAN_REPOINTED: ReadonlyArray<{ file: string; gone: string; home: string }> = [
  // PLAN-01 (2026-09-17): the routine BUILDER moved to /tasks, but this href is
  // an OCCURRENCE TILE on the grid — a routine's occurrence lives on the
  // calendar, so a click on one stays there. The two legacy /routines URLs (the
  // authoring surface) were repointed at /tasks instead; see those pages.
  { file: 'src/lib/hub/mapOperationsRoutines.ts', gone: '/operations/routines', home: '/calendar' },
  { file: 'src/components/hub/HubEventCard.tsx', gone: '/operations/projects', home: '/tasks' },
];
for (const r of ORPHAN_REPOINTED) {
  const body = dayCode(r.file);
  if (!body) { orphanFail(`${r.file} is missing`); continue; }
  if (body.includes(`'${r.gone}'`)) orphanFail(`${r.file} still sends a click to ${r.gone} — that page is a redirect, so the click takes two hops to reach ${r.home}, which owns it`);
  if (!body.includes(`'${r.home}'`)) orphanFail(`${r.file} no longer points at ${r.home} — the owner's home is where the click goes`);
}

if (orphanViolations === 0) console.log(`✔ The orphan law passed — ${pages.length} pages, every one accounted for by the registry: ${orphanCounts.home} home-or-beneath, ${orphanCounts.link} registry-linked, ${orphanCounts.redirect} dated redirect(s), ${orphanCounts.guest} listed guest route(s), ${orphanCounts.shell} shell-doored, ${orphanCounts.exception} named exception(s) (closed, shrink-only, each naming the ruling that resolves it); the deleted room's two duplicate hops now point at ${ORPHAN_REPOINTED.map((r) => r.home).join(' and ')}.`);

// ── THE DRILL LAW (DRILL-01, 2026-09-17) ────────────────────────────────────
// THE PANEL SHOWS A CHAIN STATE FROM THE NAMED SET AND NO OTHER, AND NO AMOUNT
// IS RENDERED WITHOUT SAYING WHERE IT CAME FROM.
//
// Clicking a row on the day says what was budgeted and what actually hit Books.
// The objects know different parts of that chain, so the temptation is to fill
// the gap — to match an event to a posting by date and code, or to print $0 for
// an unknown. DAY-01 ruled that join unsound for four independent reasons and
// this law keeps the ruling: the panel may render PLANNED, PLANNED AND SETTLED
// or NOT LINKED, each from src/lib/calendar/chain.ts, and nothing else.
const DRILL_PANEL = 'src/components/hub/EventDetailPanel.tsx';
const DRILL_DAYVIEW = 'src/components/hub/DayView.tsx';
let drillViolations = 0;
const drillFail = (m: string) => { drillViolations += 1; violations.push(`drill law: ${m} (DRILL-01)`); };
const drillPanel = codeOf(DRILL_PANEL);

// 1. The state on the screen is the LEAF'S state, not a string typed here.
if (!/data-drill-chain-state=\{chain\.state\}/.test(drillPanel)) drillFail(`${DRILL_PANEL} does not render the state from the chain leaf`);
if (!/\{chain\.label\}/.test(drillPanel)) drillFail(`${DRILL_PANEL} does not render the leaf's label`);
// LINK-01: and that `chain` is the LEAF'S, whether the row's own or rebuilt from
// its links — never a chain literal assembled in the component.
if (!/buildChain\(\{ kind: row\.kind/.test(drillPanel)) drillFail(`${DRILL_PANEL} does not rebuild its chain through buildChain when links supply the actual`);
if (/state:\s*'(PLANNED|NOT_LINKED|PLANNED_AND_SETTLED)'/.test(drillPanel)) drillFail(`${DRILL_PANEL} assembles a chain literal instead of asking the leaf`);
// 2. Its per-state styling map may name the three states and NO fourth.
const styleKeys = [...(/const STATE_CLASS[^=]*= \{([\s\S]*?)\};/.exec(drillPanel)?.[1] ?? '').matchAll(/^\s*([A-Z_]+):/gm)].map((m) => m[1]);
for (const k of styleKeys) if (!(CHAIN_STATES as readonly string[]).includes(k)) drillFail(`${DRILL_PANEL} styles a state "${k}" that is not one of ${CHAIN_STATES.join(' · ')}`);
for (const st of CHAIN_STATES) if (!styleKeys.includes(st)) drillFail(`${DRILL_PANEL} does not style ${st}`);
// 3. An actual is never printed without its source label beside it.
if (!/ACTUAL_SOURCE_LABEL\[shownSource\]/.test(drillPanel)) drillFail(`${DRILL_PANEL} renders an actual with no source label — a hand-typed number and a posted one must never look alike`);
// 4. LINK-01 narrowed this rather than dropping it: the panel may reach exactly
// ONE route — its own links — and may create or delete a link there and nothing
// else. It still alters no posting, no journal entry and no typed actual.
for (const m of drillPanel.matchAll(/fetch\(\s*['"`]([^'"`]*)/g)) {
  if (/^\/api\/calendar\/links/.test(m[1])) continue;
  // ONEOFF-01: ONE other route — removing a row entered by hand before the
  // ruling, the same DELETE DAY-01's day view was already allowed, behind
  // isManualEvent. The route refuses every other source itself.
  if (/^\/api\/calendar\/events\?id=/.test(m[1])) continue;
  drillFail(`${DRILL_PANEL} reaches ${m[1]} — the only routes it may touch are its own links and the manual-event remove (ONEOFF-01)`);
}
if (/method:\s*'(PATCH|PUT)'/.test(drillPanel)) drillFail(`${DRILL_PANEL} edits an existing row — it may only create and delete its own links`);
if (/\/api\/calendar\/events\?id=/.test(drillPanel)) {
  if (!/\/api\/calendar\/events\?id=[^\n]*method: 'DELETE'/.test(drillPanel)) drillFail(`${DRILL_PANEL} reaches the manual-event route with something other than DELETE (ONEOFF-01)`);
  if (!/isManualEvent\(row\.source\) && \(/.test(drillPanel)) drillFail(`${DRILL_PANEL} offers Correct/Remove without checking the row is hand-entered — a trip or budget row is its owner path's record (ONEOFF-01)`);
  if (!/data-drill-correct/.test(drillPanel) || !/data-drill-remove\b/.test(drillPanel)) drillFail(`${DRILL_PANEL} does not offer both Correct and Remove on a hand-entered row (ONEOFF-01)`);
}
for (const forbidden of ['actual_cost_usd', 'journal-entries', 'ledger_entries']) {
  if (drillPanel.includes(forbidden)) drillFail(`${DRILL_PANEL} touches ${forbidden} — a link is written, a posting never is`);
}
// 5. Its door comes from the registry, never a typed href.
if (!/navToolByName\(row\.owner, TOOL_GATE\)/.test(drillPanel)) drillFail(`${DRILL_PANEL} does not resolve its owner door from the registry`);
// 6. Every row on the day opens it — a row that did nothing was a promise unkept.
const drillDay = codeOf(DRILL_DAYVIEW);
// The ROW'S OWN click must open it — a keyboard handler alone is not a click,
// and a stub that swallows the click is exactly the inert row this law forbids.
if (!/onClick:\s*\(\)\s*=>\s*onRowOpen\(r\.id\)/.test(drillDay)) drillFail(`${DRILL_DAYVIEW} has a row whose click opens nothing`);
if (!/onKeyDown[\s\S]{0,160}onRowOpen\(r\.id\)/.test(drillDay)) drillFail(`${DRILL_DAYVIEW}'s row cannot be opened from the keyboard`);
for (const btn of ['data-correct-event', 'data-delete-event']) {
  if (!new RegExp(`${btn}[\\s\\S]{0,140}stopPropagation\\(\\)`).test(drillDay)) drillFail(`${DRILL_DAYVIEW}'s ${btn} would also open the drill — it must stop the row's click`);
}
// 7. Every owner the census names has a door in the registry.
const drillOwners = new Set<string>([...Object.values(EVENT_SOURCE_OWNER), ...KIND_FACTS.map((f) => f.owner).filter((o) => o !== 'by source')]);
for (const name of drillOwners) {
  const tool = navRows(TOOL_GATE).find((t) => t.name === name);
  if (!tool?.href) drillFail(`the census sends a row to "${name}", which has no door`);
}
// 8. Nothing claims a link to a posted transaction, because nothing has one.
for (const f of KIND_FACTS) if (f.postedLink !== null) drillFail(`${f.kind} claims a posted link — DAY-01's verdict stands until a ruling overturns it`);
// 9. The leaf refuses an unlabelled amount, here, at build time.
try { buildChain({ kind: 'project_task', planned: 1, actual: 1 }); drillFail('the chain leaf accepted an actual with no source'); } catch { /* the throw is the law working */ }
if (drillViolations === 0) console.log(`✔ The drill law passed — ${CHAIN_STATES.length} chain states and no fourth; every amount names its source; ${drillOwners.size} owner door(s) resolve; 0 claimed links to a posting.`);
else console.log(`✖ The drill law FAILED — ${drillViolations} violation(s).`);

// ── THE LINK LAW (LINK-01, 2026-09-17) ──────────────────────────────────────
// THE ACTUAL IS LINKED, NOT GUESSED — AND NOTHING SUMS AN UNKNOWN AS ZERO.
//
// DAY-01 ruled the automatic event→Books join unsound. The answer is not a
// better matcher: it is a link the founder makes by hand. This law holds the
// three things that would quietly turn it back into a guess — a suggested
// match, a link row that cannot say whose or what it is, and a null amount
// counted as zero (the exact EDGE-01 bug in the trade link route).
const LINK_ROUTE = 'src/app/api/calendar/links/route.ts';
const LINK_MIGRATION = 'prisma/migrations/20260917120000_link_01_planned_item_links/migration.sql';
let linkViolations = 0;
const linkFail = (m: string) => { linkViolations += 1; violations.push(`link law: ${m} (LINK-01)`); };
const linkRoute = codeOf(LINK_ROUTE);

// 1. NO MATCHER. The candidate list may not score, rank by amount, or pre-select.
for (const banned of ['confidence', 'matchRationale', 'score', 'probable', 'suggest', 'bestMatch', 'autoMatch']) {
  if (new RegExp(`\\b${banned}`, 'i').test(linkRoute)) linkFail(`${LINK_ROUTE} carries "${banned}" — a candidate list is a convenience, never a guess; transaction_reservation_links is the shape this deliberately does NOT copy`);
}
// The candidates come back in DATE order, never ordered by closeness of amount.
if (!/orderBy:\s*\{ date: 'desc' \}/.test(linkRoute)) linkFail(`${LINK_ROUTE} does not return candidates in date order`);
if (/orderBy[\s\S]{0,80}amount/.test(linkRoute)) linkFail(`${LINK_ROUTE} orders candidates by amount — that is a ranked guess`);

// 2. EVERY VERB IS USER-SCOPED, and a stranger's row is a defensive 404.
for (const verb of ['GET', 'POST', 'DELETE']) {
  const at = linkRoute.indexOf(`export async function ${verb}(`);
  if (at < 0) { linkFail(`${LINK_ROUTE} has no ${verb}`); continue; }
  const body = linkRoute.slice(at, linkRoute.indexOf('export async function', at + 1) < 0 ? undefined : linkRoute.indexOf('export async function', at + 1));
  if (!/const user = await caller\(\)/.test(body)) linkFail(`${LINK_ROUTE} ${verb} does not identify the caller`);
  if (!/status: 401/.test(body)) linkFail(`${LINK_ROUTE} ${verb} does not refuse an anonymous caller`);
  if (!/user_id: user\.id|userId: user\.id/.test(body)) linkFail(`${LINK_ROUTE} ${verb} runs a query that is not user-scoped`);
  if (/status: 403/.test(body)) linkFail(`${LINK_ROUTE} ${verb} answers 403 — a cross-user read is a defensive 404, which does not confirm the row exists`);
}

// 3. NOTHING SUMS A NULL. EDGE-01 found `sum + (p.realized_pl ?? 0)` in the
// trade link route, twice. The pattern may not reappear here or in the leaf.
for (const f of [LINK_ROUTE, 'src/lib/calendar/links.ts']) {
  if (/\?\?\s*0\s*\)/.test(codeOf(f))) linkFail(`${f} coerces a null amount to 0 — an unknown is reported, never summed (the EDGE-01 bug at src/app/api/trade-card-links/route.ts:80)`);
}
// And the leaf proves it here, at build time.
const linkProbe = sumLinks([
  { journalEntryId: 'a', date: '2026-01-01', description: 'x', amountCents: 30000 },
  { journalEntryId: 'b', date: '2026-01-02', description: 'y', amountCents: null },
]);
if (linkProbe.actual !== 300) linkFail(`the link leaf summed ${linkProbe.actual} — the readable posting alone is 300`);
if (linkProbe.complete) linkFail('the link leaf called a sum complete while a posting carried no readable amount');
if (!linkProbe.unreadable.includes('b')) linkFail('the link leaf did not name the posting it could not read');
if (sumLinks([]).actual !== null) linkFail('the link leaf returned a number for zero links — zero links is NOT LINKED, never $0');

// 4. THE ROW ALWAYS SAYS WHOSE IT IS AND WHAT IT POINTS AT.
const linkMigration = codeOf(LINK_MIGRATION);
for (const col of ['"user_id"', '"target_kind"', '"target_id"', '"journal_entry_id"']) {
  if (!new RegExp(`${col}\\s+\\w+[^,]*NOT NULL`).test(linkMigration)) linkFail(`${LINK_MIGRATION} lets ${col} be null — a link that cannot say whose or what it is`);
}
// 5. THE OCCURRENCE KEY is the INSTANT, mandatory for a routine and forbidden otherwise.
if (!/CHECK \(\("target_kind" = 'routine'\) = \("target_instant" IS NOT NULL\)\)/.test(linkMigration)) {
  linkFail(`${LINK_MIGRATION} does not make target_instant mandatory for a routine and forbidden for everything else — a routine link keyed on a date silently misses`);
}
// LINES-01 added 'routine_line' and TRAVEL-01 'trip_item', each in its OWN migration; LINK-01's names the original three.
if (!LINKABLE_KINDS.filter((k) => k !== 'routine_line' && k !== 'trip_item').every((k) => linkMigration.includes(`'${k}'`))) linkFail(`${LINK_MIGRATION}'s kind CHECK does not name ${LINKABLE_KINDS.join(', ')}`);
if (!requiresInstant('routine')) linkFail('the key leaf no longer requires an instant for a routine');
// 6. THE CARDINALITY IS THE DATABASE'S, not a convention.
if (!/CREATE UNIQUE INDEX "planned_item_links_one_item_per_posting"[\s\S]{0,120}\("journal_entry_id"\)/.test(linkMigration)) {
  linkFail(`${LINK_MIGRATION} does not enforce one item per posting — two items would each claim the whole amount`);
}
if (!/ON DELETE RESTRICT/.test(linkMigration)) linkFail(`${LINK_MIGRATION} lets a linked posting be deleted — financial attribution never vanishes`);
if (linkViolations === 0) console.log(`✔ The link law passed — ${LINKABLE_KINDS.length} linkable kinds, the occurrence keyed on its instant, one item per posting enforced in SQL; no matcher, no score, and no null summed as zero.`);
else console.log(`✖ The link law FAILED — ${linkViolations} violation(s).`);

// ── THE LINES LAW (LINES-01, 2026-09-18) ────────────────────────────────────
// A ROUTINE'S FIGURE IS THE SUM OF ITS LINES, OR ITS OWN WHEN IT HAS NONE — AND
// NO READER ADDS THE TWO.
//
// The founder's morning is a gym line, a coffee line and a dining line. The
// rule lives in ONE leaf (src/lib/operations/routineLines.ts): when any active
// line carries an amount, the routine's planned figure is the sum of its lines
// and the routine-level budget_amount is set aside — reported, never added. A
// second summation anywhere, or a reader that reaches for the routine-level
// column directly, would let the month and the day disagree.
const LINES_LEAF = 'src/lib/operations/routineLines.ts';
const LINES_READERS = [
  'src/lib/operations/routineBudget.ts',
  'src/lib/hub/mapOperationsRoutines.ts',
  'src/components/workbench/operations/routines/RoutineRow.tsx',
  'src/components/workbench/operations/routines/TodaysStrip.tsx',
  'src/components/hub/HubCalendar.tsx',
];
let linesViolations = 0;
const linesFail = (m: string) => { linesViolations += 1; violations.push(`lines law: ${m} (LINES-01)`); };

// 0. The leaf itself still states the rule and exports it — and it is the ONLY
//    file that reads both grains' columns to decide a figure.
const linesLeaf = codeOf(LINES_LEAF);
if (!/export function routinePlanned\(/.test(linesLeaf)) linesFail(`${LINES_LEAF} no longer exports routinePlanned() — the one leaf every reader depends on`);
if (!/ignoredRoutineLevel: routineLevel/.test(linesLeaf)) linesFail(`${LINES_LEAF} no longer reports the routine-level figure it sets aside`);
// 1. Every planned figure for a routine comes from the leaf.
for (const f of LINES_READERS) {
  const body = codeOf(f);
  if (!/routinePlanned\(/.test(body)) linesFail(`${f} does not read routinePlanned() — every planned figure for a routine comes from the one leaf`);
}
// The bridge reads it through routinesMonthlyByCoa, and may not pre-filter on the routine-level column.
const linesBridge = codeOf('src/app/api/hub/business-budget/route.ts');
if (!/routinesMonthlyByCoa\(/.test(linesBridge)) linesFail('the HB-4d bridge no longer reads the monthly figure through routineBudget.ts');
if (/budget_amount:\s*\{\s*not:\s*null\s*\}/.test(linesBridge)) linesFail('the HB-4d bridge filters routines on the routine-level budget_amount — that hides a lined routine with blank routine-level fields');
if (!/steps:\s*\{\s*where:\s*\{\s*is_active:\s*true\s*\}/.test(linesBridge)) linesFail('the HB-4d bridge does not hand the leaf the routine\'s active lines');

// 2. No reader adds routine-level and line-level amounts. The only place the two
//    columns meet is the leaf, and the leaf itself is probed here.
for (const f of LINES_READERS) {
  const body = codeOf(f);
  if (/routine\.budget_amount\s*\+|budget_amount\s*\+\s*[\w.]*steps/.test(body)) linesFail(`${f} adds a routine-level amount to something — the two grains are never added`);
}
const linesProbe = routinePlanned({ budget_amount: 15, coa_code: '5200', steps: [
  { id: 'gym', budget_amount: null, coa_code: null },
  { id: 'coffee', budget_amount: 80, coa_code: '5200' },
  { id: 'dine', budget_amount: 200, coa_code: null },
] });
if (linesProbe.amount !== 280) linesFail(`the leaf summed ${linesProbe.amount} for a three-line routine — 80 + 200 is 280, and the routine-level 15 is never added`);
if (linesProbe.ignoredRoutineLevel !== 15) linesFail('the leaf silently dropped the routine-level figure instead of reporting it as set aside');
if (linesProbe.coverage.counted !== 2 || linesProbe.coverage.of !== 3) linesFail('the leaf miscounted the coverage — an uncosted line is counted OUT, never as $0');
if (linesProbe.lines.find((l) => l.id === 'gym')?.amount !== null) linesFail('the leaf turned a blank line into a number');
const steplessProbe = routinePlanned({ budget_amount: 15, coa_code: '5200', steps: [] });
if (steplessProbe.amount !== 15 || steplessProbe.from !== 'routine') linesFail('the leaf dropped a stepless routine\'s own figure');

// 3. A routine_line link always carries an instant — the leaf, the route and the migration agree.
if (!requiresInstant('routine_line')) linesFail('a routine_line link may be made without an instant — it would silently miss the occurrence');
const linesMigration = codeOf('prisma/migrations/20260918090000_lines_01_step_cost_and_coa/migration.sql');
if (!/CHECK \(\("target_kind" IN \('routine', 'routine_line'\)\) = \("target_instant" IS NOT NULL\)\)/.test(linesMigration)) linesFail('the migration does not make the instant mandatory for a routine_line link');
if (!/'routine_line'/.test(linesMigration)) linesFail('the migration does not admit the routine_line kind');
// No line amount is imputed and nothing is dropped.
if (/DEFAULT 0/.test(linesMigration)) linesFail('the migration defaults a line amount to 0 — blank is blank');
if (/DROP COLUMN/.test(linesMigration)) linesFail('the migration drops a column — the routine-level field stays for a stepless routine');
if (/(^|\n)\s*UPDATE\s+"/.test(linesMigration)) linesFail('the migration rewrites rows — no link is migrated and no amount is imputed');

// 4. The panel lists lines with per-line links, and drops the routine-level category for a lined routine.
const linesPanel = codeOf('src/components/hub/EventDetailPanel.tsx');
if (!/data-drill-lines-total/.test(linesPanel)) linesFail('the panel does not print a lined routine\'s total with its coverage');
if (!/data-drill-line-link-open/.test(linesPanel)) linesFail('a line in the panel carries no Link');
if (!/!\(row\.lines && row\.lines\.length > 0\) && \(\s*<Row label="Category \(COA\)"/.test(linesPanel)) linesFail('the panel keeps a routine-level Category row for a routine that has one per line');
if (!/if \(row\.lines && row\.lines\.length > 0\) return null;/.test(linesPanel)) linesFail('a lined occurrence can still be linked at the routine grain — the coffee posting must link to the coffee LINE');
if (linesViolations === 0) console.log(`✔ The lines law passed — ${LINES_READERS.length + 1} readers read the one leaf; $280 across 2 of 3 with the routine-level $15 set aside, never added; a stepless routine keeps its own; a routine_line link carries its instant.`);
else console.log(`✖ The lines law FAILED — ${linesViolations} violation(s).`);

// ── THE ONE-OFF LAW (ONEOFF-01, 2026-09-18) ─────────────────────────────────
// A ONE-OFF IS A ROUTINE THAT HAPPENS ONCE — AUTHORED IN TASKS, LIKE EVERYTHING
// ELSE. The calendar is the view; nothing is authored there. Three laws:
//
//   1. /calendar IMPORTS NO AUTHORING FORM. Nothing in the page's import tree
//      mounts the old add-event form, POSTs to the events route, renders an
//      add-event control or mounts the place lookup; the route exports no POST.
//   2. ONLY ONE COMPONENT RENDERS "FIND THIS PLACE" (held in the geo law above,
//      and it is Tasks' FindThisPlace).
//   3. A ROUTINE WITH CADENCE "ONCE" EXPANDS TO EXACTLY ONE OCCURRENCE — on its
//      date, never again — through the SAME expansion every cadence uses, which
//      is anchored on the routine's start_date at EVERY call site. No second
//      RRULE path, no reader-side bound logic.
//   + the migration is additive and nothing moves; no merged chart on either tree.
const ONEOFF_CAL_PAGE = 'src/app/calendar/page.tsx';
const ONEOFF_EV_ROUTE = 'src/app/api/calendar/events/route.ts';
const ONEOFF_HELPERS = 'src/lib/operations/rruleHelpers.ts';
const ONEOFF_MIGRATION = 'prisma/migrations/20260918150000_oneoff_01_a_routine_that_happens_once/migration.sql';
const ONEOFF_CALLERS = [
  'src/app/api/operations/routines/route.ts',
  'src/app/api/operations/routines/[id]/route.ts',
  'src/app/api/operations/routines/[id]/completions/route.ts',
  'src/app/api/operations/routines/[id]/upcoming/route.ts',
  'src/app/api/operations/routines/today/route.ts',
  'src/app/api/hub/operations-routines/route.ts',
  'src/inngest/functions/routine-evaluator.ts',
  'src/lib/operations/routineBudget.ts',
];
let oneoffViolations = 0;
const oneoffFail = (m: string) => { oneoffViolations += 1; violations.push(`one-off law: ${m} (ONEOFF-01)`); };

// 1. The calendar's import tree authors nothing.
{
  const seen = new Set<string>();
  const stack = [ONEOFF_CAL_PAGE];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const body = existsSync(resolve(ROOT, f)) ? codeOf(f) : '';
    if (/AddEventForm/.test(body)) oneoffFail(`${f} still names the add-event form — the calendar authors nothing`);
    if (/data-add-event/.test(body)) oneoffFail(`${f} renders an add-event control`);
    if (/<FindThisPlace/.test(body)) oneoffFail(`${f} mounts the place lookup — that press belongs to planning a one-off in Tasks`);
    for (const m of body.matchAll(/fetch\(\s*['"`]\/api\/calendar\/events['"`][\s\S]{0,200}?method:\s*'(\w+)'/g)) {
      if (m[1] === 'POST') oneoffFail(`${f} POSTs to the events route — no new hand-entered row is written by the calendar`);
    }
    if (/fetch\(\s*['"`]\/api\/chart-of-accounts['"`]/.test(body)) oneoffFail(`${f} reads every entity's chart merged — a picker is entity-scoped (CoaSelect), and the calendar picks nothing`);
    for (const next of importsFor(f)) stack.push(next);
  }
  if (existsSync(resolve(ROOT, 'src/components/hub/AddEventForm.tsx'))) oneoffFail('src/components/hub/AddEventForm.tsx is back — the calendar authors nothing');
  const evRoute = codeOf(ONEOFF_EV_ROUTE);
  if (/export async function POST\b/.test(evRoute)) oneoffFail(`${ONEOFF_EV_ROUTE} exports POST`);
  if (/INSERT INTO calendar_events/.test(evRoute)) oneoffFail(`${ONEOFF_EV_ROUTE} inserts a row`);
}
// The routines surface picks from ONE entity's chart, never a merged list.
for (const rel of walkSrc('src/components/workbench/operations/routines')) {
  if (/fetch\(\s*['"`]\/api\/chart-of-accounts['"`]/.test(codeOf(rel))) oneoffFail(`${rel} reads every entity's chart merged — the picker is entity-scoped`);
}

// 3. Cadence "once" is one occurrence, on its date, through the one expansion.
{
  const localDay = (d: Date, tz: string) => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
  const onceForm = { ...DEFAULT_ROUTINE_FORM, cadence_mode: 'once' as const, start_date: '2026-09-24', byhour: '14', byminute: '00', timezone: 'Asia/Bangkok' };
  let onceRule = '';
  try { onceRule = compileFormToRRule(onceForm); } catch (e) { oneoffFail(`cadence once does not compile: ${e instanceof Error ? e.message : String(e)}`); }
  if (onceRule && !/(^|;)COUNT=1(;|$)/.test(onceRule)) oneoffFail(`cadence once compiled to "${onceRule}" — a one-off is COUNT=1`);
  if (onceRule && classifyCadence(onceRule) !== 'once') oneoffFail(`classifyCadence("${onceRule}") is ${classifyCadence(onceRule)}, not once`);
  if (onceRule) {
    const anchor = scheduleAnchor(onceForm.start_date);
    const decade = expandBetween(onceRule, onceForm.timezone, new Date(Date.UTC(2020, 0, 1)), new Date(Date.UTC(2031, 0, 1)), anchor);
    if (decade.length !== 1) oneoffFail(`a once rule expanded to ${decade.length} occurrence(s) over a decade — exactly one`);
    else if (localDay(decade[0], onceForm.timezone) !== '2026-09-24') oneoffFail(`the one occurrence fell on ${localDay(decade[0], onceForm.timezone)}, not on its date`);
    const after = expandForward(onceRule, onceForm.timezone, new Date(Date.UTC(2026, 8, 25)), 5, anchor);
    if (after.length !== 0) oneoffFail(`a once rule has ${after.length} occurrence(s) after its date — never again`);
    // Without the anchor the occurrence is nowhere: that is the defect the anchor closes.
    const unanchored = expandBetween(onceRule, onceForm.timezone, new Date(Date.UTC(2020, 0, 1)), new Date(Date.UTC(2031, 0, 1)));
    if (unanchored.length !== 0) oneoffFail('a once rule expanded WITHOUT its anchor — the anchor is what puts the occurrence on its date; a second path is forming');
  }
  try { compileFormToRRule({ ...onceForm, start_date: '' }); oneoffFail('a one-off with no date compiled — the count would run from 1971'); } catch { /* the refusal is the law working */ }
  // The helper's anchor is the routine's own start_date, and every call site passes it.
  const helpers = codeOf(ONEOFF_HELPERS);
  if (!/export function scheduleAnchor\(/.test(helpers)) oneoffFail(`${ONEOFF_HELPERS} exports no scheduleAnchor`);
  if (!/dtstart: anchor \?\? FLOATING_ANCHOR/.test(helpers)) oneoffFail(`${ONEOFF_HELPERS} does not build the rule on the routine's anchor`);
  const callerSet = new Set(ONEOFF_CALLERS);
  for (const rel of ONEOFF_CALLERS) {
    const body = codeOf(rel);
    const calls = [...body.matchAll(/expand(?:Forward|Between)\([^;]*;/g)].map((m) => m[0]);
    if (calls.length === 0) oneoffFail(`${rel} no longer expands a schedule — remove it from ONEOFF_CALLERS or restore the call`);
    for (const c of calls) if (!/scheduleAnchor\(/.test(c)) oneoffFail(`${rel} expands a schedule without the routine's anchor: ${c.slice(0, 80)} — a one-off would fall in 1971 for this reader (a second path)`);
  }
  // .ts AND .tsx — the budget bridge leaf is a .ts file, and it expands too.
  for (const abs of tsFiles(resolve(ROOT, 'src'))) {
    const rel = abs.replace(`${ROOT}/`, '');
    if (callerSet.has(rel) || rel === ONEOFF_HELPERS || rel.includes('__tests__')) continue;
    if (/\bexpand(?:Forward|Between)\(/.test(codeOf(rel))) oneoffFail(`${rel} expands a schedule outside the anchored call sites — add it to ONEOFF_CALLERS and pass scheduleAnchor(start_date)`);
  }
}

// + The migration is additive and nothing moves.
{
  const m = existsSync(resolve(ROOT, ONEOFF_MIGRATION)) ? codeOf(ONEOFF_MIGRATION) : '';
  if (!m) oneoffFail(`${ONEOFF_MIGRATION} is missing — the routine has no place columns`);
  else {
    for (const col of ['"location"', '"latitude"', '"longitude"']) {
      if (!new RegExp(`ADD COLUMN\\s+${col.replace(/"/g, '\\"')}`).test(m)) oneoffFail(`the migration does not add ${col} to operations_routines`);
    }
    if (!/CHECK \(\("latitude" IS NULL\) = \("longitude" IS NULL\)\)/.test(m)) oneoffFail('the migration does not make the coordinate pair all-or-nothing');
    if (!/COUNT=1/.test(m) || !/"start_date" IS NOT NULL/.test(m)) oneoffFail('the migration does not require a date on a COUNT=1 routine');
    if (/DEFAULT 0/.test(m)) oneoffFail('the migration defaults a coordinate to 0 — 0,0 is the Atlantic');
    if (/(^|\n)\s*(UPDATE|DELETE|INSERT)\s/.test(m)) oneoffFail('the migration moves or deletes rows — no manual event is migrated and none is deleted');
    if (/DROP (COLUMN|TABLE)/.test(m)) oneoffFail('the migration drops something — it is additive');
  }
  const schema = codeOf('prisma/schema.prisma');
  const model = schema.slice(schema.indexOf('model operations_routines {'), schema.indexOf('@@map("operations_routines")'));
  for (const col of ['location', 'latitude', 'longitude']) {
    if (!new RegExp(`\\n\\s+${col}\\s`).test(model)) oneoffFail(`schema.prisma's operations_routines has no ${col} — the schema and the migration move together`);
  }
}

if (oneoffViolations === 0) console.log(`✔ The one-off law passed — /calendar's tree mounts no add form, no add control, no place lookup and no POST to the events route, and the route exports none; the routines surface picks from one entity's chart; cadence once compiles to COUNT=1 and expands to exactly one occurrence on its date through the one anchored expansion, passed at ${ONEOFF_CALLERS.length} call sites and nowhere else; the migration adds three place columns with the pair and the date CHECKs and moves nothing.`);
else console.log(`✖ The one-off law FAILED — ${oneoffViolations} violation(s).`);

// ── THE TWO-LISTS LAW (TASKS-01, 2026-09-18) ────────────────────────────────
// TASKS IS TWO LISTS — PROJECTS AND ROUTINES — AND EVERYTHING ELSE COMES OFF.
// Five laws:
//
//   1. /tasks RENDERS NO STAGESTRIP. Nothing in the page's import tree mounts
//      one, and the page carries no pipe label — the two lists and the daily
//      plan, each with its plain controls. (What each phase held survives as a
//      control; a phase only filtered the same list.)
//   2. NO STREAK RENDERS ON A CUSTOMER SURFACE. No component and no page reads
//      consecutive_completion_streak / consecutive_miss_streak, and none draws
//      the 🔥 counter — while the columns stay and the two writers (the
//      completions route and the nightly evaluator) are untouched.
//   3. A PROJECT DELETE REFUSES ON ANY LIVE LINK. The route re-runs the one
//      deletion leaf INSIDE its transaction, the leaf names the four link kinds
//      the ruling lists, the refusal is 409 naming the task, and the row asks
//      for the preview before it confirms. Cross-user stays a defensive 404.
//   4. NO LETTERED HEADER. The room's letters (B · / C · / K · / G ·) are gone
//      from every operations section header; the registry link says trail.
//   5. THE REGISTRY WHY IS A CUSTOMER'S LINE — no founder note, no build note.
const TWO_LISTS_PAGE = 'src/app/tasks/page.tsx';
const TWO_LISTS_LEAF = 'src/lib/operations/projectDeletion.ts';
const TWO_LISTS_ROUTE = 'src/app/api/operations/projects/[id]/route.ts';
const TWO_LISTS_PREVIEW = 'src/app/api/operations/projects/[id]/deletion/route.ts';
const TWO_LISTS_ROW = 'src/components/workbench/operations/projects/ProjectRow.tsx';
const STREAK_WRITERS = [
  'src/app/api/operations/routines/[id]/completions/route.ts',
  'src/inngest/functions/routine-evaluator.ts',
];
let twoListsViolations = 0;
const twoListsFail = (m: string) => { twoListsViolations += 1; violations.push(`two-lists law: ${m} (TASKS-01)`); };

// 1. no strip in the page's tree, no pipe label on the page.
{
  const seen = new Set<string>();
  const stack = [TWO_LISTS_PAGE];
  while (stack.length) {
    const f = stack.pop()!;
    if (seen.has(f)) continue;
    seen.add(f);
    const body = existsSync(resolve(ROOT, f)) ? codeOf(f) : '';
    if (body.includes('<StageStrip')) twoListsFail(`${f} renders a StageStrip inside /tasks' tree — Tasks is two lists, and a phase is a filter over a list it already shows`);
    if (body.includes('<ProofStrip')) twoListsFail(`${f} renders a ProofStrip inside /tasks' tree — the receipts repeated counts the surfaces already show`);
    for (const next of importsFor(f)) stack.push(next);
  }
  const page = codeOf(TWO_LISTS_PAGE);
  if (/data-pipe-label|PIPE_LABEL|PIPE_PHASES/.test(page)) twoListsFail(`${TWO_LISTS_PAGE} labels a pipe — there is no strip to label`);
  for (const section of ['<SectionD_ProjectBacklog />', '<SectionE_Routines />', '<SectionC_DailyPlan />']) {
    if (!page.includes(section)) twoListsFail(`${TWO_LISTS_PAGE} no longer mounts ${section} — the page is the projects list, the routines list and the daily plan`);
  }
  if ((PHASES_RENDERED_AT['/tasks'] ?? ['?']).length !== 0) twoListsFail(`nav.ts declares /tasks draws [${(PHASES_RENDERED_AT['/tasks'] ?? []).join(' ')}] — it draws nothing`);
  // Every control the strips held is still a control: the list headers' create
  // buttons, the row's edit/archive/delete and its pipeline door, Today's mark-done.
  const controls: Array<[string, RegExp, string]> = [
    ['src/components/workbench/operations/SectionD_ProjectBacklog.tsx', /\+ new project/, 'the projects list has no "+ new project"'],
    ['src/components/workbench/operations/SectionD_ProjectBacklog.tsx', /show archived/, 'the projects list has no "show archived"'],
    ['src/components/workbench/operations/projects/ProjectRowView.tsx', /onClick=\{onEnterEdit\}/, 'the project row has no edit control'],
    ['src/components/workbench/operations/projects/ProjectRowView.tsx', /onClick=\{onDelete\}/, 'the project row has no delete control'],
    ['src/components/workbench/operations/projects/ProjectRowView.tsx', /onClick=\{onEnterPipeline\}/, 'the project row has no door to its pipeline — the capability the strip held must survive as a control'],
    ['src/components/workbench/operations/projects/TruthMachineView.tsx', /onClick=\{onRunResearch\}/, 'the pipeline lost "run deep research"'],
    ['src/components/workbench/operations/projects/TruthMachineView.tsx', /onClick=\{onGenerateTasks\}/, 'the pipeline lost "generate tasks"'],
    ['src/components/workbench/operations/projects/TruthMachineView.tsx', /onClick=\{onRunPipe\}/, 'the pipeline lost "run pipe"'],
    ['src/components/workbench/operations/projects/TruthMachineView.tsx', /onClick=\{onEvolveStart\}/, 'the pipeline lost "evolve"'],
    ['src/components/workbench/operations/routines/RoutineList.tsx', /\+ new routine/, 'the routines list has no "+ new routine"'],
    ['src/components/workbench/operations/routines/RoutineList.tsx', /show inactive/, 'the routines list has no "show inactive"'],
    ['src/components/workbench/operations/routines/TodaysStrip.tsx', /✓ mark done/, 'Today lost "mark done"'],
    ['src/components/workbench/operations/routines/TodaysStrip.tsx', /\{totalDone\} done · \{totalDue\} due · \{totalMissed\} missed/, 'Today lost its done · due · missed line'],
    ['src/components/workbench/operations/SectionE_Routines.tsx', /<TodaysStrip/, 'the routines section no longer mounts Today'],
    ['src/components/workbench/operations/SectionE_Routines.tsx', /<RoutineList/, 'the routines section no longer mounts the list'],
  ];
  for (const [f, re, why] of controls) if (!re.test(codeOf(f))) twoListsFail(`${f}: ${why}`);
}

// 2. no streak on a customer surface; the writers stay.
{
  const surfaces = [...tsFiles(resolve(ROOT, 'src/app')), ...tsFiles(resolve(ROOT, 'src/components'))]
    .map((abs) => abs.replace(`${ROOT}/`, ''))
    .filter((f) => !f.startsWith('src/app/api/'));
  for (const f of surfaces) {
    const body = codeOf(f);
    if (/\.consecutive_(completion|miss)_streak\b/.test(body)) twoListsFail(`${f} reads a streak counter — no streak renders on a customer surface; the columns and the evaluator stay`);
    if (body.includes('🔥')) twoListsFail(`${f} draws the 🔥 counter — no streak renders on a customer surface`);
  }
  for (const f of STREAK_WRITERS) {
    if (!/consecutive_completion_streak/.test(codeOf(f))) twoListsFail(`${f} no longer writes the streak columns — TASKS-01 removes the RENDER, never the record`);
  }
  const schema = codeOf('prisma/schema.prisma');
  for (const col of ['consecutive_completion_streak', 'consecutive_miss_streak']) {
    if (!schema.includes(col)) twoListsFail(`schema.prisma lost ${col} — no data is deleted by the streak change`);
  }
}

// 3. delete refuses on any live link, inside the transaction, naming the task.
{
  const leaf = codeOf(TWO_LISTS_LEAF);
  for (const [needle, why] of [
    ['ledger_line_links', 'a ledger line allocated to the project'],
    ["target_kind: 'project_task'", 'a posting linked to a task (planned_item_links)'],
    ['actual_cost_usd', 'a posted actual on a task'],
    ['operations_calendar_blocks', 'a calendar block on a task'],
    ['hub_scheduled_items', 'a hub schedule line on the project or a task'],
  ] as const) {
    if (!leaf.includes(needle)) twoListsFail(`${TWO_LISTS_LEAF} no longer checks ${why} — the delete would cascade through a live link`);
  }
  if (!/export function assessDeletion\(/.test(leaf)) twoListsFail(`${TWO_LISTS_LEAF} no longer exports assessDeletion() — the decision must be a pure function the tests can probe`);
  if (!/task "\$\{/.test(leaf)) twoListsFail(`${TWO_LISTS_LEAF} no longer names the task in a blocker — the 409 names the reason`);
  if (!/Archive it instead/.test(leaf)) twoListsFail(`${TWO_LISTS_LEAF} no longer points at archive — the refusal names the door that stays open`);
  const route = codeOf(TWO_LISTS_ROUTE);
  const del = route.slice(route.indexOf('export async function DELETE('));
  if (!/prisma\.\$transaction\(/.test(del)) twoListsFail(`${TWO_LISTS_ROUTE} DELETE runs outside a transaction — the check and the delete are one`);
  const txAt = del.indexOf('prisma.$transaction(');
  const checkAt = del.indexOf('projectDeletionCheck(tx');
  const deleteAt = del.indexOf('tx.operations_projects.delete(');
  if (checkAt < 0 || deleteAt < 0 || !(txAt < checkAt && checkAt < deleteAt)) twoListsFail(`${TWO_LISTS_ROUTE} DELETE does not run projectDeletionCheck(tx) before tx.operations_projects.delete() inside the transaction`);
  if (!/status: 409/.test(del)) twoListsFail(`${TWO_LISTS_ROUTE} DELETE has no 409 — a live link refuses with its reason (the TRADE-LOG-01 precedent, trade-log/manual/route.ts)`);
  if (!/describeBlockers\(/.test(del)) twoListsFail(`${TWO_LISTS_ROUTE} DELETE does not name the blockers in its refusal`);
  if (!/loadAuthorizedProject\(id, user\.id\)/.test(del) || !/status: 404/.test(del)) twoListsFail(`${TWO_LISTS_ROUTE} DELETE is not user-scoped to a defensive 404`);
  if (/status: 403/.test(del)) twoListsFail(`${TWO_LISTS_ROUTE} DELETE answers 403 — cross-user is a defensive 404, never a 403`);
  const preview = codeOf(TWO_LISTS_PREVIEW);
  if (!/projectDeletionCheck\(prisma, id, user\.id\)/.test(preview)) twoListsFail(`${TWO_LISTS_PREVIEW} does not read the same leaf the delete runs — the dialog and the delete could disagree`);
  if (/method:\s*'(POST|PATCH|PUT|DELETE)'|\.delete\(|\.update\(|\.create\(/.test(preview)) twoListsFail(`${TWO_LISTS_PREVIEW} writes — the preview is read-only`);
  const row = codeOf(TWO_LISTS_ROW);
  const del2 = row.slice(row.indexOf('const handleDelete'));
  const previewAt = del2.indexOf('/deletion`');
  const confirmAt = del2.indexOf('confirm(preview.summary)');
  const fireAt = del2.indexOf("method: 'DELETE'");
  if (previewAt < 0 || confirmAt < 0 || fireAt < 0 || !(previewAt < confirmAt && confirmAt < fireAt)) twoListsFail(`${TWO_LISTS_ROW} does not fetch the preview, confirm with what will go, and only then DELETE — in that order`);
  if (!/preview\.blockers\.length > 0\) \{\s*setError\(preview\.message\)/.test(del2)) twoListsFail(`${TWO_LISTS_ROW} does not surface a refused delete's reason on the row`);
}

// 4. no lettered header; the link says trail.
{
  const sections = tsFiles(resolve(ROOT, 'src/components/workbench/operations')).map((abs) => abs.replace(`${ROOT}/`, ''));
  for (const f of sections) {
    const m = codeOf(f).match(/<h2[^>]*>\s*[A-Z] · [A-Z][A-Z ]+/);
    if (m) twoListsFail(`${f} still wears the deleted room's letter in its header ("${m[0].replace(/<h2[^>]*>\s*/, '')}") — every lettered header loses its letter`);
  }
  const tasksRow = TOOL_REGISTRY.find((t) => t.name === 'Tasks');
  if (!tasksRow?.links?.some((l) => l.label === 'Audit trail' && l.href === '/operations/audit-log')) twoListsFail(`the Tasks registry row does not link "Audit trail" → /operations/audit-log`);
  if (tasksRow?.links?.some((l) => /tail/i.test(l.label))) twoListsFail(`the Tasks registry row still says "tail"`);
}

// 5. the why is a customer's line.
{
  const why = TOOL_REGISTRY.find((t) => t.name === 'Tasks')?.why ?? '';
  if (/founder|Claude Code|paid|build pipeline/i.test(why)) twoListsFail(`the Tasks registry why carries the founder's build note — it is a customer's line; the note is a code comment beside the row`);
  if (!why.trim()) twoListsFail('the Tasks registry why is empty — a four-beat PARTIAL says what is not done for a customer');
}

if (twoListsViolations === 0) console.log(`✔ The two-lists law passed — /tasks' tree mounts no StageStrip and no ProofStrip, and the page labels no pipe; ${STREAK_WRITERS.length} streak writers untouched while no page or component reads or draws a streak; a project delete runs the one deletion leaf inside its transaction, refuses 409 naming the task on any of five live links, and the row previews before it confirms; no operations header wears a letter; the Tasks why is a customer's line.`);
else console.log(`✖ The two-lists law FAILED — ${twoListsViolations} violation(s).`);

// ── THE EXTENT LAW (GRID-01, 2026-09-18) ─────────────────────────────────────
// A BLOCK IS AS LONG AS IT SAYS, AND TWO BLOCKS NEVER HIDE EACH OTHER.
//
//   1. THE LEAF IS THE ONLY PLACE AN EXTENT IS DECIDED, AND IT NEVER INVENTS ONE.
//      src/lib/calendar/extent.ts: an end is drawn exactly; no end is a flagged
//      marker of MARKER_MINUTES; an end before its start is a flagged marker.
//   2. NO EXPRESSION IN CalendarGrid ADDS MINUTES TO A START TO PRODUCE AN END.
//      The block builder holds no Math.max and adds no literal minutes to a
//      minute value; both the trip path and the non-trip path call the leaf.
//      The render floor is one text line, compared against pixels only.
//   3. BLOCKS ARE LAID OUT IN LANES — the leaf's interval partition, positioned
//      by lane, each block naming its lane; a lane never changes a block's data.
//   4. NOTHING ELSE DECIDES AN EXTENT: no mapper, the day view and the panel
//      print a start-only row with no derived end, and no writer defaults an end.
const EXTENT_LEAF = 'src/lib/calendar/extent.ts';
const EXTENT_GRID = 'src/components/shared/CalendarGrid.tsx';
const EXTENT_READERS = [
  'src/lib/hub/mapOperationsRoutines.ts',
  'src/lib/hub/mapOperationsBlocks.ts',
  'src/components/hub/HubCalendar.tsx',
  'src/components/hub/DayView.tsx',
  'src/components/hub/EventDetailPanel.tsx',
  'src/lib/calendar/day.ts',
];
let extentViolations = 0;
const extentFail = (m: string) => { extentViolations += 1; violations.push(`extent law: ${m} (GRID-01)`); };

// 1. the leaf: exports, and probed on plain numbers.
{
  const leaf = codeOf(EXTENT_LEAF);
  for (const fn of ['export function blockExtent(', 'export function unverifiedDurationExtent(', 'export function assignLanes<', 'export const MARKER_MINUTES = 30;']) {
    if (!leaf.includes(fn)) extentFail(`${EXTENT_LEAF} no longer holds ${fn.replace('export ', '').replace(/[(<=].*$/, '')} — the one leaf every extent comes from`);
  }
  const exact = blockExtent(600, 645);
  if (exact.endMin !== 645 || exact.flag !== null) extentFail(`the leaf changed a real end — blockExtent(600, 645) gave ${exact.endMin} with flag ${exact.flag}`);
  const none = blockExtent(600, null);
  if (none.endMin !== 600 + MARKER_MINUTES || none.flag !== 'no-end') extentFail(`the leaf invented a length for a row with no end — blockExtent(600, null) gave ${none.endMin} with flag ${none.flag}`);
  const trip = unverifiedDurationExtent(540);
  if (trip.endMin !== 570 || trip.flag !== 'duration-unverified') extentFail('the trip marker is no longer the same flagged 30-minute marker');
  const two = assignLanes([{ s: 360, e: 660 }, { s: 420, e: 600 }], (b) => b.s, (b) => b.e);
  if (two[0].lane !== 0 || two[1].lane !== 1 || two[0].lanes !== 2 || two[1].lanes !== 2) extentFail('two overlapping blocks do not land in two lanes');
  const three = assignLanes([{ s: 360, e: 600 }, { s: 420, e: 700 }, { s: 620, e: 680 }], (b) => b.s, (b) => b.e);
  if (three[2].lane !== 0) extentFail('a block that starts after the first has ended does not reuse the first lane');
  const floor = assignLanes([{ s: 600, e: 600 }, { s: 600, e: 600 }], (b) => b.s, (b) => b.e, 30);
  if (floor[1].lane !== 1) extentFail('two slivers that would overlap on screen share a lane — the drawn floor is ignored');
  for (const f of tsFiles(resolve(ROOT, 'src')).map((abs) => abs.replace(`${ROOT}/`, ''))) {
    if (f === EXTENT_LEAF) continue;
    if (/\bMARKER_MINUTES\s*=/.test(codeOf(f))) extentFail(`${f} defines its own marker length — MARKER_MINUTES lives in ${EXTENT_LEAF} alone`);
  }
}

// 2. the grid adds no minutes to a start; both paths call the leaf; the floor is pixels.
{
  const grid = codeOf(EXTENT_GRID);
  if (!/from '@\/lib\/calendar\/extent'/.test(grid)) extentFail(`${EXTENT_GRID} does not read the extent leaf`);
  const from = grid.indexOf('function getBlocksForDay(');
  const to = grid.indexOf('export default function CalendarGrid(');
  if (from < 0 || to < from) extentFail(`${EXTENT_GRID} no longer has getBlocksForDay before the component — the builder this law reads`);
  const builder = from >= 0 && to > from ? grid.slice(from, to) : grid;
  const adds = [...builder.matchAll(/\b\w*Min\s*\+\s*\d+\b/g)].map((m) => m[0]);
  if (adds.length) extentFail(`${EXTENT_GRID} adds literal minutes to a start to produce an end: ${adds.join(', ')} — an extent is read, never invented`);
  if (/Math\.max\(/.test(builder)) extentFail(`${EXTENT_GRID}'s block builder clamps a minute value — a clamp that adds time is an invented duration`);
  if (!/blockExtent\(startMin, storedEndMin\)/.test(builder)) extentFail(`${EXTENT_GRID}'s non-trip path does not read blockExtent() — the two-hour default is the bug`);
  if (!/blockExtent\(0, storedEndMin\)/.test(builder)) extentFail(`${EXTENT_GRID}'s arrival day does not read blockExtent()`);
  if (!/unverifiedDurationExtent\(tripStartMin\)/.test(builder)) extentFail(`${EXTENT_GRID}'s trip path does not read the leaf's marker`);
  if (!/endMin: segEnd, flag: null/.test(builder)) extentFail(`${EXTENT_GRID} stretches a flight segment — it is as long as its duration says`);
  if (/HOUR_HEIGHT \* 1\.5|MIN_EVENT_HEIGHT/.test(grid)) extentFail(`${EXTENT_GRID} floors a block at 1.5 hours again — the floor is one text line`);
  if (!/Math\.max\(\(\(block\.endMin - block\.startMin\) \/ 60\) \* HOUR_HEIGHT, MIN_BLOCK_PX\)/.test(grid)) extentFail(`${EXTENT_GRID}'s render floor is not a pixel floor against MIN_BLOCK_PX`);
  if (!/data-block-flag=\{block\.flag \?\? undefined\}/.test(grid)) extentFail(`${EXTENT_GRID} does not mark a flagged block`);
  if (!/⚠ \$\{title\} · \$\{FLAG_TEXT\[ext\.flag\]\}/.test(grid)) extentFail(`${EXTENT_GRID} does not say "no end time" on a no-end marker the way the trip marker is flagged`);
  // 3. lanes.
  if (!/assignLanes\(blocks, \(b\) => b\.startMin, \(b\) => b\.endMin, MIN_BLOCK_MINUTES\)/.test(grid)) extentFail(`${EXTENT_GRID} does not lay blocks out in lanes through the leaf`);
  if (!/data-block-lane=\{lane\}/.test(grid) || !/data-block-lanes=\{laneCount\}/.test(grid)) extentFail(`${EXTENT_GRID} does not name each block's lane`);
  if (!/left: `calc\(\$\{\(lane \/ laneCount\) \* 100\}% \+ 2px\)`, width: `calc\(\$\{100 \/ laneCount\}% - 4px\)`/.test(grid)) extentFail(`${EXTENT_GRID} does not position a block by its lane`);
  if (/className=\{`absolute left-0\.5 right-0\.5/.test(grid)) extentFail(`${EXTENT_GRID} still draws every block across the whole column — a second block hides the first`);
  if (!/title=\{hoverTitle\}/.test(grid)) extentFail(`${EXTENT_GRID}'s block carries no hover title — a marker too short for its title would be an empty block`);
}

// 4. nothing else decides an extent.
for (const f of EXTENT_READERS) {
  const body = codeOf(f);
  if (/\bMARKER_MINUTES\b|blockExtent\(|\+\s*120\b|\+\s*60\b/.test(body)) extentFail(`${f} decides an extent — only the grid, through the leaf, draws one`);
}
if (!/\$\{clock\(r\.startTime\)\}\$\{r\.endTime \? ` – \$\{clock\(r\.endTime\)\}` : ''\}/.test(codeOf('src/components/hub/DayView.tsx'))) extentFail('the day view no longer prints a start-only row with the start alone (DAY-01)');
if (!/\$\{clock\(row\.startTime\)\}\$\{row\.endTime \? ` – \$\{clock\(row\.endTime\)\}` : ''\}/.test(codeOf('src/components/hub/EventDetailPanel.tsx'))) extentFail('the panel no longer prints a start-only row with the start alone (DAY-01)');
if (!/if \(endTime !== null && startTime === null\) return/.test(codeOf('src/lib/calendar/manualEvent.ts'))) extentFail('the manual writer no longer admits a start without an end as it did — or defaults one');
if (/end_time: startTime|end_time:\s*\w+\s*\?\?\s*\w*start/i.test(codeOf('src/app/api/operations/routines/route.ts'))) extentFail('the routine writer defaults an end time from the start — no default end is written anywhere');

if (extentViolations === 0) console.log(`✔ The extent law passed — one leaf decides every extent and invents none (an end exact, no end a flagged ${MARKER_MINUTES}-minute marker); the grid's builder adds no minutes and holds no clamp, both paths read the leaf, the floor is one text line in pixels; blocks are laid out in lanes by the leaf's partition and each names its lane; ${EXTENT_READERS.length} readers decide no extent and the day view prints a start-only row with the start alone.`);
else console.log(`✖ The extent law FAILED — ${extentViolations} violation(s).`);

// ── THE TRAVEL LAW (TRAVEL-01, 2026-09-19) ───────────────────────────────────
// TRAVEL READS TOP-DOWN, AND EVERY PLANNED ITEM TAKES ITS TIME ON THE DAY.
//
//   1. /travel RENDERS NO STAGESTRIP. The cockpit's travel tab is plain sections
//      in one order — header · trips · itinerary · search · booked · ledger ·
//      unattached — holding no travel phase state; PHASES_RENDERED_AT['/travel']
//      is empty and every travel phase is declared drawn nowhere. The itinerary
//      is mounted, and the booking surfaces still mount under Search.
//   2. THE BOOKING FLOW IS BYTE-IDENTICAL. Every file of search → prebook → pay
//      (src/lib/travelBookingFlow.ts) hashes, its whole text through the
//      reader's two halves rejoined, to its pin from main — and every route
//      under src/app/api/travel is in that census.
//   3. AN ITEM WITH TIMES DRAWS START-TO-END. The overlay leaf copies a date-only
//      item's block window onto its calendar row and nothing else's — probed: an
//      activity 14:00–16:00 lands at that extent with vendor and place; a start
//      alone stays a start alone (GRID-01's marker); a flight and a stay are
//      untouched; the leaf holds no literal clock and copies no amount; the
//      calendar feed applies it, scoped to the caller's trips, joining no posting.
//   4. A TRIP ITEM IS A KIND. KIND_FACTS and LINKABLE_KINDS name 'trip_item' with
//      no instant and no actual of its own; its migration names it in the kind
//      CHECK and leaves the instant CHECK alone; the block-time migration records
//      columns with IF NOT EXISTS and defaults no clock; neither touches a row;
//      the panel opens a trip block as that kind with its vendor and its source.
const TRAVEL_LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const TRAVEL_SECTIONS = ['header', 'trips', 'itinerary', 'search', 'booked', 'ledger', 'unattached'];
const TRAVEL_LEAF = 'src/lib/calendar/tripItem.ts';
const TRAVEL_FEED = 'src/app/api/calendar/route.ts';
const TRAVEL_ITINERARY = 'src/components/trips/TripItinerarySection.tsx';
const TRAVEL_PANEL = 'src/components/hub/EventDetailPanel.tsx';
const TRAVEL_HUB = 'src/components/hub/HubCalendar.tsx';
const TRAVEL_LINK_MIGRATION = 'prisma/migrations/20260919100100_travel_01_trip_item_link_kind/migration.sql';
const TRAVEL_BLOCK_MIGRATION = 'prisma/migrations/20260919100000_travel_01_block_times_recorded/migration.sql';
let travelViolations = 0;
const travelFail = (m: string) => { travelViolations += 1; violations.push(`travel law: ${m} (TRAVEL-01)`); };

// 1. no strip: the sections, in order, holding what the phases held.
{
  const launcher = codeOf(TRAVEL_LAUNCHER);
  const sections = [...launcher.matchAll(/data-travel-section="([a-z]+)"/g)].map((m) => m[1]);
  if (sections.join(' · ') !== TRAVEL_SECTIONS.join(' · ')) travelFail(`${TRAVEL_LAUNCHER} renders the travel sections as [${sections.join(', ')}] — the order is ${TRAVEL_SECTIONS.join(' · ')}`);
  for (const banned of ['PIPE_PHASES.travel', 'travelPhase', 'PIPE_TRIP']) {
    if (launcher.includes(banned)) travelFail(`${TRAVEL_LAUNCHER} holds "${banned}" — the travel tab has no phase`);
  }
  const at = (name: string) => launcher.indexOf(`data-travel-section="${name}"`);
  const from = at('header');
  const to = at('unattached') >= 0 ? launcher.indexOf('</section>', at('unattached')) : -1;
  const region = from >= 0 && to > from ? launcher.slice(from, to) : '';
  if (!region) travelFail(`${TRAVEL_LAUNCHER} has no travel region from the header to the unattached section`);
  if (/<StageStrip|<ProofStrip/.test(region)) travelFail(`${TRAVEL_LAUNCHER} draws a StageStrip or a ProofStrip on the travel tab — it is plain sections`);
  const slice = (a: string, b: string) => (at(a) >= 0 && at(b) > at(a) ? launcher.slice(at(a), at(b)) : '');
  if (!/<ToolOpener tools=\{\[navToolByName\('Travel', TOOL_GATE\)\]\}/.test(slice('header', 'trips'))) travelFail(`${TRAVEL_LAUNCHER}'s travel header is not the registry's own Travel opener`);
  if (!/<AllTripsList/.test(slice('trips', 'itinerary'))) travelFail(`${TRAVEL_LAUNCHER}'s Trips section lost the trip list`);
  if (!/<TripItinerarySection/.test(slice('itinerary', 'search'))) travelFail(`${TRAVEL_LAUNCHER} does not mount the itinerary on the travel tab`);
  const search = slice('search', 'booked');
  if (!/travelStripModes\(\{/.test(search) || !/<PublicCategorySearch/.test(search)) travelFail(`${TRAVEL_LAUNCHER}'s Search section no longer mounts the booking surfaces (travelStripModes + PublicCategorySearch)`);
  if (!/<TripBookings/.test(slice('booked', 'ledger'))) travelFail(`${TRAVEL_LAUNCHER}'s Booked section lost TripBookings`);
  if (!/<TripBudgetActual/.test(slice('ledger', 'unattached'))) travelFail(`${TRAVEL_LAUNCHER}'s Ledger section lost TripBudgetActual`);
  if (!/<UnattachedBookings/.test(region.slice(region.indexOf('data-travel-section="unattached"')))) travelFail(`${TRAVEL_LAUNCHER}'s Unattached section lost UnattachedBookings`);
  const travelDrawn = PHASES_RENDERED_AT['/travel'] ?? [];
  if (travelDrawn.length !== 0) travelFail(`PHASES_RENDERED_AT['/travel'] names ${travelDrawn.length} phase(s) — the travel tab draws none`);
  const travelPhases = THE_SORT.filter((a) => a.pipe === 'travel');
  if (travelPhases.length !== 5) travelFail(`THE_SORT holds ${travelPhases.length} travel phases — Travel still owns all five`);
  for (const a of travelPhases) {
    if (a.rendersSurface || !/TRAVEL-01 \(2026-09-19\): drawn nowhere/.test(a.surfaceNote ?? '')) travelFail(`travel ${a.num} is not declared drawn nowhere by TRAVEL-01`);
    if (a.owner !== 'Travel') travelFail(`travel ${a.num} is ${a.owner}'s — the five stay Travel's`);
  }
}

// 2. the booking flow is byte-identical to main.
{
  if (BOOKING_FLOW_FILES.length < 49) travelFail(`the booking-flow census names ${BOOKING_FLOW_FILES.length} files — the audit named 49; the list may not shrink`);
  const pinned = new Set<string>();
  for (const pin of BOOKING_FLOW_FILES) {
    if (pinned.has(pin.file)) travelFail(`${pin.file} is pinned twice`);
    pinned.add(pin.file);
    if (!/^[0-9a-f]{64}$/.test(pin.sha256)) travelFail(`${pin.file}'s pin is not a sha256`);
    if (!existsSync(resolve(ROOT, pin.file))) { travelFail(`${pin.file} is gone — a booking-flow file was deleted`); continue; }
    const whole = rejoin(codeOf(pin.file), commentsOf(pin.file));
    const h = bookingFlowSha256(whole);
    if (h !== pin.sha256) travelFail(`${pin.file} is not byte-identical to ${BOOKING_FLOW_BASE} — sha256 ${h}, pinned ${pin.sha256}; a change to the booking flow needs its own ruling and a dated re-pin`);
  }
  for (const f of tsFiles(resolve(ROOT, 'src/app/api/travel')).map((abs) => abs.replace(`${ROOT}/`, ''))) {
    if (!pinned.has(f)) travelFail(`${f} is a travel provider route the booking-flow census does not pin`);
  }
}

// 3. an item with times draws start-to-end — the overlay, probed on the demo's three items.
{
  const clockAt = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
  const items: TripItemRow[] = [
    { id: 'ti-act', tripId: 't1', vendorOptionId: 'act-1', vendorOptionType: 'activity', category: 'activities', vendor: 'Ubud rice walk', vendor_name: 'Viator', location: 'Tegallalang', block_start_time: clockAt('14:00'), block_end_time: clockAt('16:00') },
    { id: 'ti-open', tripId: 't1', vendorOptionId: 'act-2', vendorOptionType: 'activity', category: 'activities', vendor: 'Sunrise trek', vendor_name: 'Viator', location: 'Batur', block_start_time: clockAt('04:00'), block_end_time: null },
    { id: 'ti-fl', tripId: 't1', vendorOptionId: 'fl-1', vendorOptionType: 'flight', category: 'flights', vendor: 'SIN → DPS', vendor_name: 'Singapore Airlines', location: null, block_start_time: null, block_end_time: null },
    { id: 'ti-lo', tripId: 't1', vendorOptionId: 'ho-1', vendorOptionType: 'lodging', category: 'accommodation', vendor: 'Alila Ubud', vendor_name: 'Alila', location: 'Ubud', block_start_time: clockAt('15:00'), block_end_time: clockAt('11:00') },
  ];
  const rows: Array<TripOverlayEvent & { id: string }> = [
    { id: 'e-act', source: 'trip', source_id: 'trip:t1:vendor:act-1', start_time: null, end_time: null, location: null },
    { id: 'e-open', source: 'trip', source_id: 'trip:t1:vendor:act-2', start_time: null, end_time: null, location: null },
    { id: 'e-fl', source: 'trip', source_id: 'trip:t1:vendor:fl-1', start_time: '08:00:00', end_time: '13:00:00', location: null },
    { id: 'e-lo', source: 'trip', source_id: 'trip:t1:vendor:ho-1', start_time: null, end_time: null, location: null },
    { id: 'e-trip', source: 'trip', source_id: 'trip:t1', start_time: null, end_time: null, location: null },
    { id: 'e-man', source: 'manual', source_id: null, start_time: '10:00:00', end_time: null, location: 'Home' },
  ];
  const before = JSON.stringify(rows);
  const out = overlayTripItems(rows, items);
  if (JSON.stringify(rows) !== before) travelFail('the overlay mutated its input — it is pure');
  const rowOf = (id: string) => out.find((e) => e.id === id)!;
  const act = rowOf('e-act');
  if (act.start_time !== '14:00' || act.end_time !== '16:00') travelFail(`an activity with a 14:00–16:00 window drew ${act.start_time}–${act.end_time} — it takes its time on the day`);
  if (act.trip_item_id !== 'ti-act' || act.vendor_name !== 'Viator' || act.location !== 'Tegallalang' || act.item_category !== 'activities' || act.item_type !== 'activity' || act.provider !== 'Viator') travelFail('an activity row does not carry its item, vendor, place, category, type and provider');
  // The grid draws it by the NON-TRIP path — exactly as stored — and a flight by its duration still.
  const travelGrid = codeOf('src/components/shared/CalendarGrid.tsx');
  if (!/if \(event\.source === 'trip' && !isDateOnlyTripType\(event\.itemType\)\) \{/.test(travelGrid)) travelFail("CalendarGrid takes every timed trip row for a flight — a date-only item's window must draw exactly as stored, not as an unverified-duration marker");
  if (!/itemType: e\.item_type \?\? null/.test(codeOf(TRAVEL_HUB))) travelFail(`${TRAVEL_HUB} does not carry the item's type to the grid`);
  const ext = blockExtent(14 * 60, 16 * 60);
  if (ext.endMin - ext.startMin !== 120 || ext.flag !== null) travelFail('GRID-01 no longer draws a 14:00–16:00 window as exactly two hours');
  const open = rowOf('e-open');
  if (open.start_time !== '04:00' || open.end_time !== null) travelFail(`a window with a start and no end drew ${open.start_time}–${open.end_time} — a start alone stays a start alone`);
  if (blockExtent(4 * 60, null).flag !== 'no-end') travelFail('GRID-01 no longer flags a start-only block as a marker');
  const fl = rowOf('e-fl');
  if (fl.start_time !== '08:00:00' || fl.end_time !== '13:00:00') travelFail(`a flight's own clock changed to ${fl.start_time}–${fl.end_time} — a flight keeps its duration geometry`);
  if (fl.provider !== 'LiteAPI flights' || fl.trip_item_id !== 'ti-fl') travelFail('a flight row does not name the provider it was booked through');
  const lo = rowOf('e-lo');
  if (lo.start_time !== null || lo.end_time !== null) travelFail(`a stay was given a clock (${lo.start_time}–${lo.end_time}) — lodging stays all-day`);
  if (lo.location !== 'Ubud' || lo.provider !== 'LiteAPI') travelFail('a stay row does not carry its place and provider');
  if ('trip_item_id' in rowOf('e-trip') || 'trip_item_id' in rowOf('e-man')) travelFail('the overlay touched a row that is not a trip vendor row');
  if (clockOfTime('1970-01-01T09:30:00.000Z') !== '09:30' || clockOfTime(null) !== null) travelFail('clockOfTime no longer reads a @db.Time value to HH:MM');
  const leaf = codeOf(TRAVEL_LEAF);
  if (/'\d{1,2}:\d{2}'|"\d{1,2}:\d{2}"/.test(leaf)) travelFail(`${TRAVEL_LEAF} holds a literal clock — no default time, ever`);
  if (/\bcost\b|budget_amount|\bamount\b/.test(leaf)) travelFail(`${TRAVEL_LEAF} copies money — the overlay carries time, vendor and place, never an amount`);
  const feed = codeOf(TRAVEL_FEED);
  if (!/events = overlayTripItems\(events, items\)/.test(feed)) travelFail(`${TRAVEL_FEED} does not apply the overlay`);
  const q = feed.slice(feed.indexOf('prisma.trip_itinerary.findMany('), feed.indexOf('events = overlayTripItems'));
  if (!/trip: \{ userId: user\.id \}/.test(q)) travelFail(`${TRAVEL_FEED} reads trip items that are not scoped to the caller's trips`);
  if (/planned_item_links|transaction_reservation_links|journal_entries/.test(feed)) travelFail(`${TRAVEL_FEED} joins a trip row to a posting or a reservation — no automatic match`);
}

// 4. a trip item is a kind.
{
  const facts = KIND_FACTS.find((f) => f.kind === 'trip_item');
  if (!facts) travelFail("KIND_FACTS does not name 'trip_item'");
  else {
    if (!facts.linkable) travelFail("'trip_item' is not linkable — the chain closes only through LINK-01");
    if (facts.actualColumn !== null || facts.actualSource !== null || facts.postedLink !== null) travelFail("'trip_item' claims an actual or a posted link — the reservation lens is a bank transaction against a reservation, not this kind's actual");
    if (!/trip_itinerary\.cost/.test(facts.plannedColumn ?? '')) travelFail("'trip_item' does not cite trip_itinerary.cost as its planned column");
    if (facts.owner !== 'Travel') travelFail("'trip_item' is not Travel's");
  }
  if (!LINKABLE_KINDS.includes('trip_item')) travelFail("LINKABLE_KINDS does not name 'trip_item'");
  if (requiresInstant('trip_item')) travelFail('a trip_item link requires an instant — a trip item is a stored row, keyed on its id');
  const chain = buildChain({ kind: 'trip_item', planned: 45, actual: null });
  if (!chain || chain.state !== 'NOT_LINKED') travelFail(`a trip item with a planned amount and no link reads ${chain?.state} — it is NOT LINKED until a posting is linked by hand`);
  const link = codeOf(TRAVEL_LINK_MIGRATION);
  if (!/CHECK \("target_kind" IN \('calendar_event', 'project_task', 'routine', 'routine_line', 'trip_item'\)\)/.test(link)) travelFail(`${TRAVEL_LINK_MIGRATION} does not admit the trip_item kind beside the four`);
  if (/planned_item_links_instant_iff_routine/.test(link)) travelFail(`${TRAVEL_LINK_MIGRATION} touches the instant CHECK — LINES-01's stands`);
  const block = codeOf(TRAVEL_BLOCK_MIGRATION);
  const adds = (block.match(/ADD COLUMN/g) ?? []).length;
  if (adds === 0 || adds !== (block.match(/ADD COLUMN IF NOT EXISTS/g) ?? []).length) travelFail(`${TRAVEL_BLOCK_MIGRATION} adds a column without IF NOT EXISTS — it records columns production may already hold`);
  if (!/"block_start_time"\s+TIME\(6\),/.test(block) || !/"block_end_time"\s+TIME\(6\),/.test(block)) travelFail(`${TRAVEL_BLOCK_MIGRATION} gives a block time a default — blank is blank, never midnight`);
  for (const m of [TRAVEL_LINK_MIGRATION, TRAVEL_BLOCK_MIGRATION]) {
    const body = codeOf(m);
    if (/(^|\n)\s*(UPDATE|INSERT INTO|DELETE FROM)\s/.test(body) || /DROP COLUMN|DROP TABLE/.test(body)) travelFail(`${m} rewrites or drops rows — a TRAVEL-01 migration is additive and touches no row`);
  }
  const panel = codeOf(TRAVEL_PANEL);
  if (!/if \(row\.kind === 'trip_item'\) return row\.tripItemId \? \{ kind: 'trip_item', id: row\.tripItemId, instant: null \} : null;/.test(panel)) travelFail(`${TRAVEL_PANEL} does not open a trip item as the 'trip_item' link target`);
  if (!/testId="vendor"/.test(panel) || !/testId="source"/.test(panel)) travelFail(`${TRAVEL_PANEL} does not show a trip item's vendor and its booking source`);
  if (!/booked through \$\{row\.provider\}/.test(panel)) travelFail(`${TRAVEL_PANEL} does not name the provider an item was booked through`);
  const hub = codeOf(TRAVEL_HUB);
  if (!/tripItemId: e\.trip_item_id \?\? null/.test(hub) || !/tripItemId: e\.tripItemId \?\? null/.test(hub)) travelFail(`${TRAVEL_HUB} does not carry the trip item id from the feed to the panel`);
  if (!/details: \[\[e\.vendor_name, e\.item_category\]\.filter\(Boolean\)\.join\(' · '\)\]/.test(hub)) travelFail(`${TRAVEL_HUB} does not put a trip item's vendor and category on its block`);
  const section = codeOf(TRAVEL_ITINERARY);
  const calls = [...section.matchAll(/fetch\(`([^`]+)`/g)].map((m) => m[1]);
  if (calls.join(' ') !== '/api/trips/${trip.id}/itinerary /api/trips/${trip.id}/vendor-commit') travelFail(`${TRAVEL_ITINERARY} calls [${calls.join(', ')}] — it reads the itinerary and uncommits, and books nothing`);
}
if (travelViolations === 0) console.log(`✔ The travel law passed — /travel is ${TRAVEL_SECTIONS.length} plain sections and no strip; ${BOOKING_FLOW_FILES.length} booking-flow files byte-identical to ${BOOKING_FLOW_BASE}; an activity's window draws start-to-end, a start alone stays a marker, a flight and a stay untouched; 'trip_item' is a linkable kind with no instant, NOT LINKED until linked by hand.`);
else console.log(`✖ The travel law FAILED — ${travelViolations} violation(s).`);

// ── THE READER LAW (TEST-TRUTH-01, 2026-09-17) ──────────────────────────────
// NO TEST AND NO LAW MAY READ A SOURCE FILE RAW.
//
// TRUTH-CAL found calendarRoom.test.ts asserting that HubCalendar still held the
// `source === 'trip'` filter DAY-01 had DELETED. It was green: the string lives
// on in DAY-01's comments saying the filter is gone, and the assertion read the
// raw file. A test that passes on a comment is worse than no test — it certifies
// deleted behaviour as present, and every audit that cited it stood on nothing.
//
// So there are exactly two readers, both from src/lib/sourceText.ts:
//   · code(file)     — comments stripped. Every assertion about BEHAVIOUR.
//   · comments(file) — comments only. An assertion about PROSE, saying so.
// A third way is the hole the whole law exists to close, so `readFileSync` (and
// `readFile`, and `fs.promises.readFile`) is a build violation in any test or any
// assert-*.ts law. Reading a DIRECTORY or asking whether a file EXISTS is not
// reading source text: readdirSync, existsSync and statSync are untouched.
//
// sourceText.ts itself is the one file that calls readFileSync, because it is the
// reader. It is neither a test nor a law, so it is out of scope by construction —
// there is no allowlist here to grow.
const READER_HELPER = 'src/lib/sourceText.ts';
const RAW_READ = /\breadFileSync\s*\(|\breadFile\s*\(|fs\.promises\.readFile\b/;
const readerFiles: string[] = [
  ...tsFiles(resolve(ROOT, 'src/lib/__tests__')).map((abs) => abs.replace(`${ROOT}/`, '')),
  ...readdirSync(resolve(ROOT, 'scripts')).filter((f) => /^assert-.*\.ts$/.test(f)).map((f) => `scripts/${f}`),
];
let readerViolations = 0;
for (const f of readerFiles) {
  // Read the reader law's own subjects through the reader, of course: a
  // readFileSync NAMED IN A COMMENT (this block names several) is prose.
  const body = codeOf(f);
  for (const [i, line] of body.split('\n').entries()) {
    if (!RAW_READ.test(line)) continue;
    readerViolations += 1;
    violations.push(`reader law: ${f}:${i + 1} reads a source file raw — a test or a law reads through code() or comments() from ${READER_HELPER}, never readFileSync, or it can pass on a comment (TEST-TRUTH-01)`);
  }
}
// And the helper it all rests on must still export both halves.
const helperBody = codeOf(READER_HELPER);
for (const fn of ['export function code(', 'export function comments(', 'export function splitSource(']) {
  if (!helperBody.includes(fn)) {
    readerViolations += 1;
    violations.push(`reader law: ${READER_HELPER} no longer exports ${fn.replace('export function ', '').replace('(', '')}() — every test and law reads through it (TEST-TRUTH-01)`);
  }
}
if (readerViolations === 0) console.log(`✔ The reader law passed — ${readerFiles.length} tests and laws, every one reading source through code() or comments(); 0 raw reads.`);
else console.log(`✖ The reader law FAILED — ${readerViolations} violation(s).`);

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
