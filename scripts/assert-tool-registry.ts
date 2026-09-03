#!/usr/bin/env tsx
/**
 * assert-tool-registry — THE TOOL REGISTRY LAW at build time (NAV-01a), and
 * THE REACHABILITY LAW (NAV-01b): every page file under src/app must have a
 * door — the family navigation (a registry home, link, or family read), the
 * header/profile utilities menu (src/lib/shellMenu.ts), a listed guest /
 * marketing / flow route (GUEST_ROUTES below, each cited), or a redirect whose
 * target has a door. A child page is reached through its parent (segment-prefix
 * rule: /agenda/[id] through /agenda). A page with no door fails the build.
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
 * THE ARRIVALS LAW (REBUILD-01 PR-1): the provider vocabulary's module-scope
 * law re-run (src/lib/providers.ts — every ROUTING_RULES provider + resource
 * pair resolves, no duplicate word or code), plus what only the texts can
 * answer: the Prisma enum `arrival_provider` (prisma/schema.prisma, read as
 * text) and the migration's CREATE TYPE (prisma/migrations/*_arrivals) carry
 * the code set EXACTLY, alphabetical; and the two Prisma models agree with the
 * migration's two CREATE TABLEs column for column — name, type, nullability,
 * order — so schema.prisma and the SQL can never drift.
 *
 * The assert:showroom pattern: a plain script wired into the `build` script so
 * it runs in CI / Vercel and fails the BUILD. It imports the registry (which
 * runs its module-scope law: sheet cells 25/25 both ways, LIVE/PARTIAL have a
 * home, NOT_BUILT have none, beats agree with status, counts 6/7/12) and adds
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
import { COCKPIT_PATH, EXPECTED_STATUS_COUNTS, FAMILY_READS, TOOL_REGISTRY, registryLaw, statusCounts } from '../src/lib/toolRegistry';
import { OWNER_UTILITIES } from '../src/lib/shellMenu';
import { ANSWERS_HOME, ANSWER_READS, ANSWER_ROWS, NET_WORTH_READ, answersLaw } from '../src/lib/answers';
import { PROVIDERS, PROVIDER_CODES, ROUTING_RULES, providersLaw } from '../src/lib/providers';

/**
 * Routes whose door is outside the app map: the front door and its marketing
 * pages, the auth page, and provider / invite flow entries. Each entry cites
 * where the door is. Anything not listed here must be reached from the family
 * navigation, the utilities menu, or a redirect.
 */
const GUEST_ROUTES: ReadonlyArray<{ route: string; why: string }> = [
  { route: '/', why: 'the front door — src/middleware.ts PUBLIC_PATHS' },
  { route: '/[tab]', why: 'the cockpit paths (/runway /travel /routines /projects /content /trade /books /tax) — every cockpit home in the registry; src/app/[tab]/page.tsx TAB_PATHS' },
  { route: '/login', why: 'the sign-in page — src/app/accounts/page.tsx:37 sends an unauthenticated viewer here' },
  { route: '/pricing', why: 'PUBLIC_PATHS; a permanent redirect to the deck (/#modules)' },
  { route: '/how-pricing-works', why: 'LandingHeader.tsx:52, LandingFooter.tsx:54, the HomeClient header' },
  { route: '/privacy', why: 'LandingFooter.tsx:56, PUBLIC_PATHS' },
  { route: '/terms', why: 'LandingFooter.tsx:55, PUBLIC_PATHS' },
  { route: '/work-with-me', why: 'the deck (Landing.tsx), PUBLIC_PATHS' },
  { route: '/modules/[pillar]', why: 'the deck PILLAR_CARDS and ModulePointerCard.tsx' },
  { route: '/booking/confirm', why: 'the LiteAPI checkout return URL (CheckoutPanel.tsx returnUrl), PUBLIC_PATHS' },
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
for (const t of TOOL_REGISTRY) {
  if (t.home) doors.push({ route: t.home, kind: 'family nav', via: `${t.name} · home` });
  if (t.cockpitKey) doors.push({ route: COCKPIT_PATH[t.cockpitKey], kind: 'family nav', via: `${t.name} · cockpit` });
  for (const l of t.links ?? []) {
    if (l.href) doors.push({ route: l.href, kind: 'family nav', via: `${t.name} · link "${l.label}"` });
    if (l.cockpitKey) doors.push({ route: COCKPIT_PATH[l.cockpitKey], kind: 'family nav', via: `${t.name} · link "${l.label}"` });
  }
}
for (const [family, reads] of Object.entries(FAMILY_READS)) for (const r of reads ?? []) doors.push({ route: r.href as string, kind: 'family read', via: `${family} · "${r.label}"` });
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
  if (!d) violations.push(`${p.route} (${p.file}) has no door — not in the family nav, the utilities menu, GUEST_ROUTES, or a redirect`);
}
for (const d of doors) {
  if (d.route.startsWith('/?')) continue;
  if (!pages.some((p) => doorCovers(p.route, d.route) || doorCovers(d.route, p.route))) violations.push(`door ${d.route} (${d.kind}: ${d.via}) points at no page`);
}
console.log(`pages: ${pages.length} · doors: ${doors.length}`);

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

/** SQL column → { name, type, nullable } from a CREATE TABLE body; constraints and indexes are skipped. */
function sqlColumns(table: string): Array<{ name: string; type: string; nullable: boolean }> {
  const m = migrationSql.match(new RegExp(`CREATE TABLE ${table} \\(\\n([\\s\\S]*?)\\n\\);`));
  if (!m) return [];
  return m[1].split('\n').map((l) => l.trim().replace(/,$/, '')).filter((l) => l && !/^CONSTRAINT /.test(l)).map((l) => {
    const [name, type] = l.split(/\s+/);
    const nullable = !/NOT NULL|PRIMARY KEY/.test(l);
    return { name, type, nullable };
  });
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
    if (rest.some((t) => t.startsWith('@relation')) || /^(users|provider_responses|arrivals)\??(\[\])?$/.test(typeTok)) continue;
    const nullable = typeTok.endsWith('?');
    const base = typeTok.replace(/\?$/, '');
    const native = rest.find((t) => t.startsWith('@db.')) ?? '';
    const key = base + native;
    const type = PRISMA_TO_SQL[key] ?? (['arrival_provider', 'arrival_status', 'their_id_kind'].includes(base) ? base : `?${key}`);
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

if (violations.length) {
  console.error('\n✖ TOOL REGISTRY LAW FAILED:');
  for (const v of violations) console.error(`  ${v}`);
  process.exit(1);
}
console.log('✔ Tool registry law passed — 25/25 cells, homes resolve to page files, counts match the census.');
console.log(`✔ Reachability law passed — ${pages.length} pages, every one has a door.`);
console.log(`✔ The answers law passed — ${ANSWER_ROWS.length}/4 questions on ${ANSWERS_HOME}, every number sourced.`);
console.log(`✔ The arrivals law passed — ${PROVIDERS.length} providers, enum === codes, ${arrivalsRows.length} columns agree with the migration.`);
