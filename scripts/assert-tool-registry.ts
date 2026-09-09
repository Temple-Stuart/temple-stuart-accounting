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
 * THE FAMILY MAP LAW (NAV-02): every tool appears in its family's menu exactly
 * once and on its family's page exactly once (familyMenu / familyCards, the
 * registry's one source); each family page route has a page file that names
 * its family; FamilyNav renders familyMenu() and FamilyPage renders
 * familyCards() — never a retyped list.
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
import { EXPECTED_STATUS_COUNTS, FAMILIES, FAMILY_PAGES, FAMILY_READS, TOOL_REGISTRY, familyCards, familyMenu, registryLaw, statusCounts } from '../src/lib/toolRegistry';
import { OWNER_UTILITIES } from '../src/lib/shellMenu';
import { ANSWERS_HOME, ANSWER_READS, ANSWER_ROWS, NET_WORTH_READ, answersLaw } from '../src/lib/answers';
import { ARRIVAL_KINDS, PROVIDERS, PROVIDER_CODES, ROUTING_RULES, RULE_BOOK, providersLaw, ruleFor } from '../src/lib/providers';
import { KIND_VIEWS_HONEST_LINE, KIND_VIEW_CENSUS, STOPPED_TABLES, VIEW_COLUMNS, kindOfTable, kindViewsLaw, latestViews, latestViewsSql, parseViews } from '../src/lib/kindViews';
// SELL-02: the offer law — every sales claim from the registry, every price from one source.
import { FREE_TOOLS, OFFERS, TOOL_GATE, heroCountsLine, offerCard, offerLaw, priceEnvName } from '../src/lib/offer';
import { DYNAMIC_READ_ENV, LIBRARY_READ_ENV } from '../src/lib/envLaw';
import { PURCHASABLE_ENTITLEMENT_KEYS } from '../src/lib/stripe';

/**
 * Routes whose door is outside the app map: the front door and its marketing
 * pages, the auth page, and provider / invite flow entries. Each entry cites
 * where the door is. Anything not listed here must be reached from the family
 * navigation, the utilities menu, or a redirect.
 */
const GUEST_ROUTES: ReadonlyArray<{ route: string; why: string }> = [
  { route: '/', why: 'the front door — src/middleware.ts PUBLIC_PATHS' },
  { route: '/[tab]', why: 'the cockpit paths (/runway /travel /routines /projects /content /trade /books /tax) — every cockpit home in the registry; src/app/[tab]/page.tsx TAB_PATHS' },
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
// NAV-02: the family navigation's doors are what it RENDERS — each family's menu
// (familyMenu: "All of <FAMILY>" → the family page, then each tool's door) and
// each family's page (familyCards: the registry home, the related surfaces, and
// the family's reads). Nothing renders inline under the bar any more.
for (const f of FAMILIES) {
  doors.push({ route: FAMILY_PAGES[f], kind: 'family menu', via: `${f} · "All of ${f}"` });
  for (const item of familyMenu(f)) {
    if (item.kind === 'tool' && item.door.kind !== 'none') doors.push({ route: item.door.href, kind: 'family menu', via: `${f} · ${item.tool.name}` });
  }
  for (const c of familyCards(f)) {
    if (c.home) doors.push({ route: c.home, kind: 'family page', via: `${FAMILY_PAGES[f]} · ${c.tool.name} · Open` });
    for (const l of c.links) if (l.door.kind !== 'none') doors.push({ route: l.door.href, kind: 'family page', via: `${FAMILY_PAGES[f]} · ${c.tool.name} · "${l.label}"` });
  }
  for (const r of FAMILY_READS[f] ?? []) doors.push({ route: r.href as string, kind: 'family page', via: `${FAMILY_PAGES[f]} · read "${r.label}"` });
}
for (const u of OWNER_UTILITIES) doors.push({ route: u.href, kind: 'utilities menu', via: u.label });
for (const g of GUEST_ROUTES) doors.push({ route: g.route, kind: 'listed route', via: g.why });
// NAV-01c: THE ANSWERS is the family navigation's first entry; each card opens its lens's home.
doors.push({ route: ANSWERS_HOME, kind: 'family nav', via: 'THE ANSWERS · first entry' });
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
  if (!d) violations.push(`${p.route} (${p.file}) has no door — not in a family menu, on a family page, in the utilities menu, GUEST_ROUTES, or a redirect`);
}
for (const d of doors) {
  if (d.route.startsWith('/?')) continue;
  if (!pages.some((p) => doorCovers(p.route, d.route) || doorCovers(d.route, p.route))) violations.push(`door ${d.route} (${d.kind}: ${d.via}) points at no page`);
}
console.log(`pages: ${pages.length} · doors: ${doors.length}`);

// ── THE FAMILY MAP LAW (NAV-02) ─────────────────────────────────────────────
const inMenus = new Map<string, string[]>();
const onPages = new Map<string, string[]>();
console.log('FAMILY MENUS — "All of <FAMILY>" first, then the tools in sheet order');
for (const f of FAMILIES) {
  const menu = familyMenu(f);
  const first = menu[0];
  if (!first || first.kind !== 'family' || first.label !== `All of ${f}` || first.href !== FAMILY_PAGES[f]) violations.push(`${f}: the menu's first item must be "All of ${f}" → ${FAMILY_PAGES[f]}`);
  const names: string[] = [];
  for (const item of menu.slice(1)) {
    if (item.kind !== 'tool') { violations.push(`${f}: a second family item in the menu`); continue; }
    names.push(item.tool.name);
    inMenus.set(item.tool.name, [...(inMenus.get(item.tool.name) ?? []), f]);
  }
  const sheet = PROBLEM_SHEET.find((x) => x.header === f)?.tools ?? [];
  if (names.join('|') !== sheet.join('|')) violations.push(`${f}: menu order [${names.join(', ')}] ≠ sheet order [${sheet.join(', ')}]`);
  for (const c of familyCards(f)) onPages.set(c.tool.name, [...(onPages.get(c.tool.name) ?? []), f]);
  console.log(`${f.padEnd(13)} ${menu.map((i) => (i.kind === 'family' ? `[${i.label} → ${i.href}]` : `${i.tool.name}${i.door.kind === 'none' ? ' (no door)' : ` → ${i.door.href}`}`)).join(' · ')}`);
}
for (const t of TOOL_REGISTRY) {
  const m = inMenus.get(t.name) ?? [];
  const c = onPages.get(t.name) ?? [];
  if (m.length !== 1 || m[0] !== t.family) violations.push(`${t.name}: in ${m.length} family menu(s) [${m.join(', ')}] — must be exactly once, in ${t.family}`);
  if (c.length !== 1 || c[0] !== t.family) violations.push(`${t.name}: on ${c.length} family page(s) [${c.join(', ')}] — must be exactly once, on ${FAMILY_PAGES[t.family]}`);
}
console.log('FAMILY PAGES — route → page file (names its family) → cards');
const FAMILY_NAV = 'src/components/home/FamilyNav.tsx';
const FAMILY_PAGE = 'src/components/home/FamilyPage.tsx';
for (const f of FAMILIES) {
  const route = FAMILY_PAGES[f];
  const file = pageFor(route, tabs);
  const expected = `src/app${route}/page.tsx`;
  if (file !== expected) violations.push(`${f}: family page ${route} has no page file (${expected})`);
  const src = file === expected ? readFileSync(resolve(ROOT, expected), 'utf8') : '';
  const names = src.split(`family="${f}"`).length - 1;
  if (file === expected && names !== 1) violations.push(`${expected} must name its family exactly once (family="${f}" ×${names})`);
  if (file === expected && !src.includes("from '@/components/home/FamilyPage'")) violations.push(`${expected} must render FamilyPage`);
  console.log(`${f.padEnd(13)} ${route.padEnd(15)} ${(file ?? 'NO PAGE FILE').padEnd(34)} ${familyCards(f).length} cards`);
}
const navSrc = existsSync(resolve(ROOT, FAMILY_NAV)) ? readFileSync(resolve(ROOT, FAMILY_NAV), 'utf8') : '';
const pageSrc = existsSync(resolve(ROOT, FAMILY_PAGE)) ? readFileSync(resolve(ROOT, FAMILY_PAGE), 'utf8') : '';
if (!navSrc.includes('familyMenu(')) violations.push(`${FAMILY_NAV} must render the menu from familyMenu() — never a retyped list`);
if (!pageSrc.includes('familyCards(')) violations.push(`${FAMILY_PAGE} must render the cards from familyCards() — never a retyped list`);
if (!navSrc.includes('role="menu"')) violations.push(`${FAMILY_NAV} must render the family tabs as menus (role="menu")`);
if (/role="tabpanel"/.test(navSrc)) violations.push(`${FAMILY_NAV} renders a tab panel inline under the bar — the map of a family is its page`);

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

if (violations.length) {
  console.error('\n✖ TOOL REGISTRY LAW FAILED:');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log('✔ Tool registry law passed — 25/25 cells, homes resolve to page files, counts match the census.');
console.log(`✔ Reachability law passed — ${pages.length} pages, every one has a door (family menus and family pages count).`);
console.log(`✔ The family map law passed — ${FAMILIES.length} menus, ${FAMILIES.length} family pages, every tool once in each.`);
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
console.log(`✔ The offer law passed — ${OFFERS.length} offers over ${new Set(OFFERS.flatMap((o) => o.tools)).size} tools (LIVE or PARTIAL only), ${FREE_TOOLS.length} free; the purchasable keys are the offers'; "built and running" typed nowhere but offer.ts; ${SELLING_SURFACES.length} selling surfaces render the offer.`);
