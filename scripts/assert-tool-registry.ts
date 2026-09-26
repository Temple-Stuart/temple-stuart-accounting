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
import { code as codeOf, comments as commentsOf, functionBody, rejoin } from '../src/lib/sourceText';
import { CHAIN_STATES, KIND_FACTS, EVENT_SOURCE_OWNER, buildChain } from '../src/lib/calendar/chain';
import { LINKABLE_KINDS, requiresInstant } from '../src/lib/calendar/linkKeys';
import { sumLinks } from '../src/lib/calendar/links';
import { routinePlanned } from '../src/lib/operations/routineLines';
import { MARKER_MINUTES, assignLanes, blockExtent, unverifiedDurationExtent } from '../src/lib/calendar/extent';
import { clockOfTime, overlayTripItems, type TripItemRow, type TripOverlayEvent } from '../src/lib/calendar/tripItem';
import { BOOKING_FLOW_BASE, BOOKING_FLOW_FILES, bookingFlowSha256 } from '../src/lib/travelBookingFlow';
import { PANEL_TOKEN_ALLOWLIST, SECTION_HEADER, WHITE_INK_ON_DARK_ANCESTOR } from '../src/lib/ds';
import { FILTER_KEYS, SORT_BY, parseFilters, parseSort } from '../src/lib/flights/searchContract';
import { DEFAULT_UI_FILTERS, NOT_STATED, carrierLineOf, countLine, fareDifference, filtersStatement, groupFlights, lowestFare, lowestFareLine, searchRequestOf } from '../src/lib/flights/fares';
import { liteApiResultsToFlightOffers } from '../src/lib/liteapiFlightAdapter';
import { BKK_HKT_EXPECTED, BKK_HKT_RATES } from '../src/lib/__tests__/fixtureFlightRatesBkkHkt';
import { DEFAULT_HOTEL_FILTERS, NOT_STATED as HOTEL_NOT_STATED, countLine as hotelCountLine, hotelCardsOf, hotelFiltersStatement, hotelSearchParamsOf, lowestRate, lowestRateLine, rateDifference } from '../src/lib/hotels/rates';
// HOTEL-02 (2026-09-22): the vendor's 12-hour clock reader and the property's clock live with the stay's times.
import { hhmmOf, propertyClockOf, propertyClockStatement } from '../src/lib/hotels/stayTimes';
// ACTIVITY-01 (2026-09-22): the Things-to-do contract and leaf, probed on the captured Phuket answer.
import { ACTIVITY_FILTER_PARAMS, ACTIVITY_SEARCH_CURRENCY, activitySearchBodyOf, parseActivityFilters } from '../src/lib/activities/searchContract';
import { DEFAULT_ACTIVITY_FILTERS, NOT_STATED as ACTIVITY_NOT_STATED, activityCardOf, activityCardsOf, activitySearchParamsOf, cancellationText, countLine as activityCountLine, lowestPrice, lowestPriceLine, priceDifference, ratingText, type RawProductSearch } from '../src/lib/activities/products';
import { validatedAffiliateUrl } from '../src/config/affiliates';
import { cityForViatorDestId } from '../src/lib/destinations';
import PHUKET_ACTIVITIES from '../src/lib/__tests__/fixtureViatorSearch.phuket-thailand.json';
import { optionTitleOf, partyMeetsProduct, productFactsOf, type RawProduct } from '../src/lib/activities/product';
import { extraChargesFor, partyCost, startTimesOn, type RawSchedule } from '../src/lib/activities/schedule';
import { CALCULATED, convert, isExpired, rateOf, type RawExchangeRates } from '../src/lib/activities/fx';
import { activitySaveNoteOf, endTimeOf, totalOf } from '../src/lib/activities/save';
import { QUOTE_MAX_AGE_MINUTES, endOfQuote, priceQuote, quoteAgeMinutes, quotesForOption, readViatorQuote, saveFromQuote, type ViatorQuote } from '../src/lib/activities/quote';
// ACTIVITY-01 STEP 4c (2026-09-22): the law seals under a PROBE key of its own
// (quoteKeyFrom + sealWith/sealHoldsWith). It never calls sealOf/sealHolds, which
// read JWT_SECRET — no law reads a deployment secret, and the build needs none.
import { QUOTE_SEAL_DOMAIN, canonicalJson, quoteKeyFrom, sealHoldsWith, sealWith } from '../src/lib/activities/quoteSeal';
import PHUKET_PRODUCT from '../src/lib/__tests__/fixtureViatorProduct.27424p2.json';
import PHUKET_SCHEDULE from '../src/lib/__tests__/fixtureViatorSchedule.27424p2.json';
import THB_USD from '../src/lib/__tests__/fixtureViatorExchangeRates.thb-usd.json';
import { parseHotelFilters } from '../src/lib/hotels/searchContract';
import { PHUKET_EXPECTED, PHUKET_RATES } from '../src/lib/__tests__/fixtureHotelRatesPhuket';
import { DATE_ONLY_TRIP_TYPES, TIMED_BY_THEMSELVES } from '../src/lib/calendar/tripItem';
import { createHash } from 'crypto';
import { classifyCadence, compileFormToRRule, expandBetween, expandForward, scheduleAnchor } from '../src/lib/operations/rruleHelpers';
import { DEFAULT_ROUTINE_FORM } from '../src/components/workbench/operations/routines/types';
import { PROBLEM_SHEET } from '../src/lib/problemSheet';
import { EXPECTED_STATUS_COUNTS, FAMILY_READS, TOOL_REGISTRY, registryLaw, statusCounts } from '../src/lib/toolRegistry';
import { HOME_ANSWER, HOME_OWNER, HOME_PHASES, PHASES_RENDERED_AT, THE_SORT, navFamilies, navLaw, navRows } from '../src/lib/nav';
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
// OFFER-01: the plans leaf — the public offer's one source.
import { BEST_VALUE_WORDS, CAPABILITY_GROUPS, CELL_LABEL, EARLY_ACCESS_CTA, LAUNCH_PLACEHOLDER, MODULES, PLANS, PLANS_HEADLINE, PLANS_SUBHEAD, PLAN_ORDER, STATUS_TO_CELL, capabilityNotes, cellState, planLaw, priceSlot, travelFreeLine, weakestStatus } from '../src/lib/offer/plans';
// DRILL-01: where an entry came from — the pure mapping the book surfaces render.
import { NO_SOURCE_WORDS, SOURCE_RULES, coverageOf, documentOf, entrySourceOf, statedFacts } from '../src/lib/books/entrySource';
import { documentFromLinks, documentsForBatch } from '../src/lib/posting/documentGate';
import { DYNAMIC_READ_ENV, LIBRARY_READ_ENV } from '../src/lib/envLaw';
import { EXPECTED_FEED_COUNT, FEED_COST, FEED_IDS, SCAN_COST, feedCostLaw, scanCostLine } from '../src/lib/observatory/feedCost';
import { FINNHUB_TTL, finnhubCallsPerSymbol, finnhubTtlLaw, slowTierEndpoints } from '../src/lib/convergence/finnhub-ttl';
import { PURCHASABLE_ENTITLEMENT_KEYS } from '../src/lib/stripe';
import { dailyCap } from '../src/lib/travelSearchQuota';

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
  { route: '/booking/flight-confirm', why: 'FL-4c: the FLIGHTS checkout return URL (LiteApiFlightCheckoutPanel.tsx returnUrl) — the documented LiteAPI payment rail redirects on success, so a guest who just paid lands here; PUBLIC_PATHS' },
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

// ─── EACH LAW IN ITS OWN GUARD (ACTIVITY-01 STEP 4c, 2026-09-22) ─────────────
// Before this, a law that THREW took the whole suite with it. STEP 4b's seal
// probe called sealOf(); src/lib/activities/quoteSeal.ts threw for want of
// JWT_SECRET; the process died after 38 verdicts and the remaining laws never
// ran — so `npm run build`, which runs the laws before it builds, could not
// build at all in an environment without that DEPLOYMENT secret. Two fixes: no
// law reads a credential any more (the seal probes derive under a key of the
// law's own, below), and a throw is now that law's own FAILURE — named, with
// its message, pushed onto `violations` like any other — so every remaining law
// still runs and the gate at the foot of the file still exits non-zero. The
// suite's exit code and its verdict lines are otherwise unchanged.
//
// The granularity is the file's own: 30 regions, each ending in the verdict
// line(s) it prints (the four earliest laws share one region — their bodies
// interleave above the first gate).
function lawGuard(name: string, run: () => void): void {
  try {
    run();
  } catch (error) {
    const first = (error instanceof Error ? (error.stack ?? error.message) : String(error)).split('\n')[0];
    violations.push(`${name}: THREW — ${first}`);
    console.log(`✖ ${name} FAILED — it threw: ${first}`);
  }
}

type Door = { route: string; kind: string; via: string };
// Declared here, above the guards, because more than one law reads them: a
// guarded region is a scope, and a reader declared inside one is invisible to
// the next. Nothing about what they do changed — only where they are declared.
const pages = pageRoutes();
const ALL_MIGRATIONS = readdirSync(resolve(ROOT, 'prisma/migrations')).sort()
  .filter((d) => existsSync(resolve(ROOT, 'prisma/migrations', d, 'migration.sql')))
  // TEST-TRUTH-01: the kind-views law compares the WHOLE artefact (the generator
  // emits `-- kind: tables` headers), so the two halves are read and rejoined.
  .map((d) => ({ dir: d, sql: rejoin(codeOf(`prisma/migrations/${d}/migration.sql`), commentsOf(`prisma/migrations/${d}/migration.sql`)) }));
function tsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = `${dir}/${name}`;
    if (statSync(abs).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') out.push(...tsFiles(abs)); continue; }
    if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(abs);
  }
  return out;
}
const srcFiles = tsFiles(resolve(ROOT, 'src')).map((abs) => ({ file: abs.replace(`${ROOT}/`, ''), src: codeOf(abs.replace(`${ROOT}/`, '')) }));
function walkSrc(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(resolve(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walkSrc(rel, out);
    else if (e.name.endsWith('.tsx')) out.push(rel);
  }
  return out;
}
const shellFiles = [...walkSrc('src/app'), ...walkSrc('src/components')];
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
const MULTI_TOOL_ALLOWED: ReadonlyArray<{ route: string; tools: readonly string[]; since: string; why: string; retire: string }> = [];
const screenTools = new Map<string, string[]>();
const m01Walk = (dir: string): string[] => readdirSync(resolve(ROOT, dir)).flatMap((n) => {
  const p = `${dir}/${n}`;
  if (statSync(resolve(ROOT, p)).isDirectory()) return m01Walk(p);
  return /\.(tsx?|md)$/.test(n) && !/__tests__/.test(p) ? [p] : [];
});
const dayCode = (f: string) => dayRead(f).split('\n').filter((l) => !/^\s*(\*|\/\/|\/\*)/.test(l)).join('\n');
const HOTEL_COMMIT = 'src/app/api/trips/[id]/vendor-commit/route.ts';
const staySrcFiles = (): string[] => {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const abs = `${dir}/${name}`;
      if (statSync(abs).isDirectory()) { if (name !== '__tests__') walk(abs); continue; }
      if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(abs.replace(`${ROOT}/`, ''));
    }
  };
  walk(resolve(ROOT, 'src'));
  return out;
};

const reach = new Map<string, Door | null>();
const schemaText = codeOf('prisma/schema.prisma');
/**
 * OFFER-01 (2026-09-23): the selling surfaces split in two.
 *
 * PLAN_SURFACES are the PUBLIC offer — the landing and /pricing. They render the
 * three plans (src/components/offer/PlansSection.tsx over src/lib/offer/plans.ts)
 * and nothing of the builder's view: no tool count, no beat vocabulary, no
 * persona grid. THE PLAN LAW below holds them to it.
 *
 * OFFER_CARD_SURFACES are the two IN-APP surfaces that still render the shared
 * <OfferCard/> from src/lib/offer.ts: the cockpit's locked-tab card and the
 * /modules access block. They still carry the registry claim lines, beats and
 * all — OFFER-01 restructured the public offer and did not touch them, and
 * extending the plans to them is a later ruling. Named here so the split is
 * explicit rather than an omission.
 */
const PLAN_SURFACES = ['src/components/landing/Landing.tsx', 'src/app/pricing/page.tsx'];
const OFFER_CARD_SURFACES = ['src/components/home/LockedTabCard.tsx', 'src/app/modules/[pillar]/ModulePageClient.tsx'];
const SELLING_SURFACES = [...OFFER_CARD_SURFACES, ...PLAN_SURFACES];
const importsOf = new Map<string, string[]>();
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
const M01 = (f: string) => (existsSync(resolve(ROOT, f)) ? codeOf(f) : '');
const dayRead = (f: string) => (existsSync(resolve(ROOT, f)) ? codeOf(f) : '');
const TRAVEL_LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
function noteBlockOver(pins: string, notes: string, pinLine: number): string {
  const codeLines = pins.split('\n');
  const noteLines = notes.split('\n');
  const block: string[] = [];
  for (let i = pinLine - 2; i >= 0 && codeLines[i].trim() === ''; i--) block.unshift(noteLines[i]);
  return block.join('\n');
}
const HOTEL_CONTAINER = 'src/components/trips/PublicHotelSearch.tsx';

const arrivalsRows: string[] = [];
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
const m01Pipeline = M01('src/lib/convergence/pipeline.ts');
const DAY_VIEW_FILE = 'src/components/hub/DayView.tsx';
const HOTEL_VIEW = 'src/components/trips/HotelResultsView.tsx';

const callSites: Array<{ file: string; provider: string; resource: string; kind: string }> = [];
const toolRows = navRows(TOOL_GATE);
const m01Builder = M01('src/lib/strategy-builder.ts');
const HOTEL_CLIENT = 'src/lib/liteapiClient.ts';

const applied: Array<{ provider: string; resource: string; kind: string }> = [];
let toolViolations = 0;
const HOTEL_ROUTE = 'src/app/api/travel/hotels/search/route.ts';

const postingPaths = new Set<string>();
const stripFiles = shellFiles.filter((f) => codeOf(f).includes('<StageStrip'));

const srcEnv = new Set<string>();
const CALENDAR_HOME = '/calendar';

const libraryEnv = new Set(LIBRARY_READ_ENV.map((e) => e.name));

// ─── THE READERS EVERY LAW SHARES ───────────────────────────────────────────
// Declared here, above the guards, because more than one law reads them: a
// guarded region is a scope, and a reader declared inside one is invisible to
// the next. Nothing about what they do changed — only where they are declared.
const dynamicEnv = new Set(DYNAMIC_READ_ENV.map((e) => e.name));

/** Where the second gate starts reading — set inside the first guarded region, read by the gate at the foot of the file. */
let raised = 0;
lawGuard('The tool registry law', () => {
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
const migrationDir = readdirSync(resolve(ROOT, 'prisma/migrations')).find((d) => d.endsWith('_arrivals'));
const migrationSql = migrationDir ? codeOf(`prisma/migrations/${migrationDir}/migration.sql`) : '';
if (!migrationDir) violations.push('arrivals: no prisma/migrations/*_arrivals/migration.sql');

const enumBlock = schemaText.match(/enum arrival_provider \{\n([\s\S]*?)\n\}/);
const enumValues = enumBlock ? enumBlock[1].split('\n').map((l) => l.trim()).filter(Boolean) : [];
if (enumValues.join(',') !== PROVIDER_CODES.join(',')) violations.push(`arrivals: enum arrival_provider [${enumValues.join(' ')}] ≠ providers.ts codes [${PROVIDER_CODES.join(' ')}]`);
const typeValues = migrationSql.match(/CREATE TYPE arrival_provider AS ENUM \((.*?)\);/)?.[1].split(', ').map((v) => v.replace(/^'|'$/g, '')) ?? [];
if (typeValues.join(',') !== PROVIDER_CODES.join(',')) violations.push(`arrivals: migration CREATE TYPE arrival_provider [${typeValues.join(' ')}] ≠ providers.ts codes`);

/** Every migration.sql, in migration order — the ALTER TABLE … ADD COLUMN / SET NOT NULL a table gained after its CREATE TABLE. */

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
const landingConstants = new Map<string, string>();
for (const { src } of srcFiles) for (const m of src.matchAll(/export const ([A-Z_]+) = '([a-z_]+)';/g)) landingConstants.set(m[1], m[2]);
const wordOf = (expr: string): string | undefined => (expr.startsWith("'") ? expr.slice(1, -1) : landingConstants.get(expr));
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
for (const f of OFFER_CARD_SURFACES) {
  if (!existsSync(resolve(ROOT, f))) { violations.push(`offer: ${f} is missing`); continue; }
  const src = codeOf(f);
  if (!src.includes("from '@/lib/offer'") || !src.includes("from '@/components/OfferCard'")) violations.push(`offer: ${f} must render the offer (import src/lib/offer.ts and OfferCard) — never a typed claim or price`);
}
// OFFER-01: a plan surface renders the plans section, and never types the offer itself.
for (const f of PLAN_SURFACES) {
  if (!existsSync(resolve(ROOT, f))) { violations.push(`offer: ${f} is missing`); continue; }
  const src = codeOf(f);
  if (!src.includes("from '@/components/offer/PlansSection'")) violations.push(`offer: ${f} must render the offer through <PlansSection/> (src/components/offer/PlansSection.tsx) — never a typed claim or price`);
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
for (const { src } of srcFiles) for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) srcEnv.add(m[1]);
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
raised = violations.length;
console.log('✔ Tool registry law passed — 25/25 cells, homes resolve to page files, counts match the census.');
console.log(`✔ Reachability law passed — ${pages.length} pages, every one has a door (the rail, the sheet, the utilities menu, a listed route, or a redirect to one).`);
console.log(`✔ The nav law passed — ${navFamilies(TOOL_GATE).length} families and ${navRows(TOOL_GATE).length} tools, both in TOOL_REGISTRY's order; ${PHASE_TOTAL} phases from pipePhases.ts each owned by exactly one of them or by ${HOME_OWNER}; every built tool's screen is a page file that wears the shell; the rail and the sheet render from nav.ts.`);
console.log(`✔ The answers law passed — ${ANSWER_ROWS.length}/4 questions on ${ANSWERS_HOME}, every number sourced.`);
});
lawGuard('The arrivals law', () => {
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
for (const t of KIND_VIEW_CENSUS) console.log(`${t.table.padEnd(26)} ${kindOfTable(t).padEnd(10)} ${'column' in t.feed ? `by ${t.feed.column}: ${Object.values(t.feed.map).map(([p, r]) => `${p} · ${r}`).join(' | ')}` : `${t.feed[0]} · ${t.feed[1]}`}`);
for (const v of effectiveViews) { const p = parseViews(v.sql)[0]; console.log(`view ${v.kind.padEnd(10)} ← ${p && p.tables.length ? p.tables.join(', ') : '(nothing)'}  — ${v.dir}`); }
console.log(`stopped (reported, not viewed): ${STOPPED_TABLES.map((s) => s.table).join(' · ')}`);
console.log(`honest line: ${KIND_VIEWS_HONEST_LINE}`);

console.log(`✔ The arrivals law passed — ${PROVIDERS.length} providers, enum === codes, ${arrivalsRows.length} columns agree with the migrations.`);
console.log(`✔ The rule book law passed — ${RULE_BOOK.length} rules, ${callSites.length} landing call sites covered, enum arrival_kind === the six kinds, the migration applies ${applied.length} rules the book holds.`);
console.log(`✔ The kind views law passed — ${ARRIVAL_KINDS.length} views over ${KIND_VIEW_CENSUS.length} feed tables, each once, the kind from the rule book; posting unions nothing; ${STOPPED_TABLES.length} tables reported, not viewed.`);
console.log(`✔ The posting law passed — every journal and ledger row is created by postJournal.ts (SET CONSTRAINTS ALL IMMEDIATE first, one statement for the lines, read back after commit); ${postingPaths.size} files post through it.`);
console.log(`✔ The env law passed — ${srcEnv.size} names read as src literals, ${libraryEnv.size} read by a library (src/lib/envLaw.ts), ${dynamicEnv.size} by a computed key; every one documented in README.md, nothing documented that nothing reads.`);
});
lawGuard('The observatory law', () => {
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
});
lawGuard('The shell law', () => {
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
});
lawGuard('The founder-broker law', () => {

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
});
lawGuard('The citation law', () => {


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
// /accounts was on NAV-25's list as Banking + Books' Feed; with 01 Feed recorded
// against /books above it serves ONE tool, so it is NOT grandfathered here.

// 1. one tool, one page
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
});
lawGuard('The opener law', () => {

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
});
lawGuard('The lock law', () => {

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
});
lawGuard('The candidate log law', () => {

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
});
lawGuard('The two-scores laws', () => {

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
const m01Composite = M01('src/lib/convergence/composite.ts');
const m01Cards = M01('src/lib/convergence/trade-cards.ts');
const m01Log = M01('src/lib/convergence/candidate-log.ts');
const m01Types = M01('src/lib/convergence/types.ts');
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
});
lawGuard('The inputs-and-funnel laws', () => {

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
    // The key is read BEFORE the presence check: `'fetched_at' in r` narrows r to
    // never on the negative side (the type declares the field on every member), and
    // the runtime check is exactly what this law is for — the builder could still
    // return a row without it.
    const rowKey = r.key;
    if (!('fetched_at' in r)) m02Fail('inputs law', `Cboe input ${rowKey} carries no fetched_at`);
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
});
lawGuard('The trade-split law', () => {

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
});
lawGuard('The trade-log laws', () => {

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
});
lawGuard('The day laws', () => {

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
const DAY_HUB = 'src/components/hub/HubCalendar.tsx';
let dayViolations = 0;
const dayFail = (msg: string) => { dayViolations += 1; violations.push(`day law: ${msg} (DAY-01)`); };

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
});
lawGuard('The event laws', () => {

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
});
lawGuard('The geo law', () => {

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
});
lawGuard('The orphan law', () => {

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
});
lawGuard('The drill law', () => {

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
});
lawGuard('The link law', () => {

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
});
lawGuard('The lines law', () => {

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
});
lawGuard('The one-off law', () => {

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
});
lawGuard('The two-lists law', () => {

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
});
lawGuard('The extent law', () => {

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
});
lawGuard('The travel law', () => {

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
  // HOTEL-01 (2026-09-22): a stay with a STATED window takes it on the day (the invented
  // 15:00 / 11:00 is gone from vendor-commit, so a stored window is a stated one); a stay
  // with none stays all-day — asserted by the hotel law below.
  if (lo.start_time !== '15:00' || lo.end_time !== '11:00') travelFail(`a stay with a stated window drew ${lo.start_time}–${lo.end_time} — it takes its stated check-in and check-out on the day (HOTEL-01)`);
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
});
lawGuard('The repaint law', () => {

// ── THE REPAINT LAW (REPAINT-04, 2026-09-21) ─────────────────────────────────
// THE DEAD SURFACE'S PAINT COMES OFF EVERY WALL IT IS STILL ON.
//
// REPAINT-3 retired the cockpit's dark surface ("the dark surface passes died",
// ModuleLauncher.tsx) and re-pointed the design system to cream paper, white
// cards, lavender hairlines and aubergine ink (src/lib/ds.ts). Its palette
// survived it: tailwind.config.ts still defined the panel family and eleven
// files still painted with it — a near-black trip row on the cream travel tab,
// white/80 table headers on a white table, TRAVEL-01's white section labels on
// cream. REPAINT-04 repainted every miss; this law keeps them off.
//
//   1. NO PANEL-* TOKEN OUTSIDE THE ALLOWLIST. A panel token is admitted only in
//      src/lib/ds.ts PANEL_TOKEN_ALLOWLIST — the surfaces that still declare
//      themselves dark or purple by their own classes (read from the file) —
//      and the list may only shrink. The family stays defined exactly while an
//      admitted surface needs it.
//   2. NO WHITE INK ON CREAM ON THE TRAVEL TAB. Every string literal carrying
//      text-white(/N) in the launcher's travel region and in every component the
//      region mounts (the import closure under src/components) carries a solid
//      dark or purple background in the same literal — except in
//      WHITE_INK_ON_DARK_ANCESTOR, where the cited ancestor fill is read from
//      the declaring file, and every exception is a file the tab really mounts.
const REPAINT_TOKEN = /\bpanel-(?:surface|border|hover|highlight)\b|\bbg-panel\b/g;
const REPAINT_DARK_BG = /\b(?:bg-brand-purple|bg-brand-purple-hover|bg-brand-gold|bg-brand-gold-bright|bg-brand-green|bg-brand-red|bg-cyan-[5-9]00|bg-panel|bg-panel-surface|bg-black|bg-status-(?:success|danger|info|warning))\b(?!\/)/;
const REPAINT_STRING = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
const REPAINT_ALLOWLIST_LEAF = 'src/lib/ds.ts';
let repaintViolations = 0;
const repaintFail = (m: string) => { repaintViolations += 1; violations.push(`repaint law: ${m} (REPAINT-04)`); };

// 1. the panel family, admitted by name only.
{
  const admitted = new Map(PANEL_TOKEN_ALLOWLIST.map((a) => [a.file, a]));
  const found = new Set<string>();
  for (const f of tsFiles(resolve(ROOT, 'src')).map((abs) => abs.replace(`${ROOT}/`, ''))) {
    // The allowlist leaf quotes each surface's declaring classes (`declaredBy`) — a citation, not paint.
    if (f === REPAINT_ALLOWLIST_LEAF) continue;
    const body = codeOf(f);
    const hits = body.match(REPAINT_TOKEN) ?? [];
    if (hits.length === 0) continue;
    found.add(f);
    const a = admitted.get(f);
    if (!a) repaintFail(`${f} paints ${hits.length} panel token(s) (${[...new Set(hits)].join(', ')}) — the retired dark surface's paint; repaint to the cream token REPAINT-3 established, or name the still-dark surface in PANEL_TOKEN_ALLOWLIST`);
    else if (!body.includes(a.declaredBy)) repaintFail(`${f} no longer declares its dark surface by its own classes (${a.declaredBy}) — the allowlist entry stands on nothing`);
  }
  for (const a of PANEL_TOKEN_ALLOWLIST) {
    if (!existsSync(resolve(ROOT, a.file))) repaintFail(`${a.file} is allowlisted but gone`);
    else if (!found.has(a.file)) repaintFail(`${a.file} is allowlisted but paints no panel token — the list may only shrink; drop it`);
  }
  if (PANEL_TOKEN_ALLOWLIST.length > 3) repaintFail(`PANEL_TOKEN_ALLOWLIST grew to ${PANEL_TOKEN_ALLOWLIST.length} — REPAINT-04 named three and the list may only shrink`);
  const tailwind = codeOf('tailwind.config.ts');
  if (PANEL_TOKEN_ALLOWLIST.length > 0 && !/\bpanel:\s*\{/.test(tailwind)) repaintFail('tailwind.config.ts no longer defines the panel family while an allowlisted surface still paints with it');
  if (PANEL_TOKEN_ALLOWLIST.length === 0 && /\bpanel:\s*\{/.test(tailwind)) repaintFail('no surface needs the panel family any more — remove it from tailwind.config.ts');
}

// 2. the travel tab: white ink only on a solid dark or purple element, or on a cited ancestor fill.
{
  const launcher = codeOf(TRAVEL_LAUNCHER);
  const at = (name: string) => launcher.indexOf(`data-travel-section="${name}"`);
  const regionFrom = at('header');
  const regionTo = at('unattached') >= 0 ? launcher.indexOf('</section>', at('unattached')) : -1;
  const region = regionFrom >= 0 && regionTo > regionFrom ? launcher.slice(regionFrom, regionTo) : '';
  if (!region) repaintFail(`${TRAVEL_LAUNCHER} has no travel region to read`);
  const importsByName = new Map<string, string>();
  for (const m of launcher.matchAll(/import\s+([^;]*?)\s+from\s+'([^']+)'/g)) {
    for (const raw of m[1].replace(/[{}]/g, ',').split(',')) {
      const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/).pop()?.trim();
      if (name) importsByName.set(name, m[2]);
    }
  }
  const closure = new Set<string>();
  const queue: string[] = [];
  for (const [name, spec] of importsByName) {
    if (!new RegExp(`\\b${name}\\b`).test(region)) continue;
    const r = resolveImport(TRAVEL_LAUNCHER, spec);
    if (r && r.startsWith('src/components/')) queue.push(r);
  }
  while (queue.length) {
    const f = queue.shift()!;
    if (closure.has(f)) continue;
    closure.add(f);
    for (const dep of importsFor(f)) if (dep.startsWith('src/components/')) queue.push(dep);
  }
  const excepted = new Map(WHITE_INK_ON_DARK_ANCESTOR.map((e) => [e.file, e]));
  const scan = (file: string, body: string, offset: number, whole: string) => {
    for (const m of body.matchAll(REPAINT_STRING)) {
      const lit = m[2];
      if (!/\btext-white(?:\/\d+)?\b/.test(lit) || REPAINT_DARK_BG.test(lit)) continue;
      const line = whole.slice(0, offset + (m.index ?? 0)).split('\n').length;
      const e = excepted.get(file);
      if (!e) repaintFail(`${file}:${line} paints white ink ("${lit.slice(0, 90)}") on an element whose own classes carry no solid dark or purple background — white on cream`);
      else if (!codeOf(e.ancestorFile).includes(e.declaredBy)) repaintFail(`${file}:${line} leans on an ancestor fill ${e.ancestorFile} no longer declares (${e.declaredBy})`);
    }
  };
  scan(TRAVEL_LAUNCHER, region, regionFrom, launcher);
  for (const f of [...closure].sort()) scan(f, codeOf(f), 0, codeOf(f));
  for (const e of WHITE_INK_ON_DARK_ANCESTOR) if (!closure.has(e.file)) repaintFail(`${e.file} is excepted but the travel tab does not mount it — the exception is stale`);
  if (closure.size < 20) repaintFail(`the travel closure holds ${closure.size} component files — REPAINT-04 walked 29; the import walk is broken`);
  // The labels themselves: the shell's own section-label bar, never a second definition.
  if (!/<h2 className=\{SECTION_HEADER\} data-travel-heading>/.test(launcher)) repaintFail(`${TRAVEL_LAUNCHER}'s TravelHeading no longer wears SECTION_HEADER — the shell's one section-label idiom`);
  if (/text-white/.test(SECTION_HEADER) || !/text-brand-purple/.test(SECTION_HEADER)) repaintFail('SECTION_HEADER is no longer aubergine ink on cream');
}
if (repaintViolations === 0) console.log(`✔ The repaint law passed — the panel family is painted by ${PANEL_TOKEN_ALLOWLIST.length} self-declared dark surface(s) and nowhere else; on the travel tab every white-ink literal sits on a solid dark or purple element, or on one of ${WHITE_INK_ON_DARK_ANCESTOR.length} cited ancestor fills; the section labels wear SECTION_HEADER.`);
else console.log(`✖ The repaint law FAILED — ${repaintViolations} violation(s).`);
});
lawGuard('The flight law', () => {

// ── THE FLIGHT LAW (FLIGHT-01, 2026-09-22) ───────────────────────────────────
// A FLIGHT APPEARS ONCE, AND A FARE SAYS WHAT IT BUYS.
//
// BKK→HKT on 2026-10-25 returned 360 rows: the same Vietjet 06:50 six times at six
// prices with "Refundable" the only word between them, "Hahn Air Systems" listed
// as the carrier (an intermediary — the operating airline hidden), and no cabin,
// stops, duration or sort control. The vendor's contract already carried filters,
// sort, the operating carrier, the flight number, the cabin, the bags and the
// terms; the route forwarded none of the first two and the adapter dropped the
// rest, coercing the carrier's silence on refundability into "not refundable".
//
//   1. THE ROUTE FORWARDS NO FIELD IT DID NOT VALIDATE. The search route's
//      provider call carries legs, adults, currency, cabinClass, filters and
//      sort and nothing else; filters and sort reach it only through
//      parseFilters/parseSort, which refuse an unknown key BY NAME and a bad
//      value by name; the body is never spread; the order stays rateLimit →
//      validate → reserveTravelSearch → searchFlightRates, so a 400 costs no
//      slot. Every key the contract admits is a key the vendor's type declares.
//      A control left at "any" sends nothing — the vendor's own default applies,
//      and the screen says so.
//   2. NO FARE ATTRIBUTE IS RENDERED FROM A VALUE THE PAYLOAD DID NOT CARRY. The
//      adapter writes each attribute tri-state (true / false / null) and never
//      coerces with `!!`; fareAttributesOf reads no price; the view renders every
//      attribute cell through statedText() or `?? NOT_STATED`; the difference
//      line's loop compares stated attributes only. Probed on the captured-shape
//      BKK→HKT payload: six Vietjet rows become one flight with six fares, the
//      Hahn Air row says "operated by Thai Vietjet Air", a fare without baggage
//      or terms is null there, the lowest fare and the difference line read as
//      the ruling wrote them.
//   3. NO SEARCH FIRES ON A FILTER CHANGE. The view calls onSearchLeg exactly
//      once — from the SEARCH button — and runs no effect; the filter bar only
//      writes the leg's filters; neither container's effects call searchLeg;
//      the search request carries searchRequestOf(leg.filters) and the session's
//      search count increments in searchLeg alone.
//   4. THE BOOKING-FLOW PIN HOLDS, DATED. The five search-path files carry a
//      dated FLIGHT-01 re-pin note with the hash they had on main; no other file
//      was re-pinned by FLIGHT-01. (The hashes themselves are the travel law's.)
const FLIGHT_ROUTE = 'src/app/api/travel/liteapi/flights/search/route.ts';
const FLIGHT_CONTRACT = 'src/lib/flights/searchContract.ts';
const FLIGHT_LEAF = 'src/lib/flights/fares.ts';
const FLIGHT_ADAPTER = 'src/lib/liteapiFlightAdapter.ts';
const FLIGHT_CLIENT = 'src/lib/liteapiFlightsClient.ts';
const FLIGHT_VIEW = 'src/components/trips/FlightPickerView.tsx';
const FLIGHT_CONTAINERS = ['src/components/trips/FlightPicker.tsx', 'src/components/trips/PublicFlightSearch.tsx'];
const FLIGHT_PIN_FILE = 'src/lib/travelBookingFlow.ts';
const FLIGHT_REPINNED = [FLIGHT_ROUTE, 'src/components/trips/PublicFlightSearch.tsx', 'src/components/trips/FlightPicker.tsx', FLIGHT_VIEW, FLIGHT_ADAPTER];
const FLIGHT_CALL_KEYS = ['legs', 'adults', 'currency', 'cabinClass', 'filters', 'sort'];
let flightViolations = 0;
const flightFail = (m: string) => { flightViolations += 1; violations.push(`flight law: ${m} (FLIGHT-01)`); };
/** The body of a top-level `export function name(` — from its opening brace to the matching close. */
const flightFnBody = (src: string, name: string): string => {
  const at = src.indexOf(`export function ${name}(`);
  if (at < 0) return '';
  const open = src.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(open, i + 1); }
  }
  return '';
};

// 1. the route forwards no field it did not validate.
{
  const route = codeOf(FLIGHT_ROUTE);
  const callAt = route.indexOf('await searchFlightRates({');
  const callEnd = callAt >= 0 ? route.indexOf('});', callAt) : -1;
  const call = callAt >= 0 && callEnd > callAt ? route.slice(callAt + 'await searchFlightRates({'.length, callEnd) : '';
  if (!call) flightFail(`${FLIGHT_ROUTE} no longer calls searchFlightRates with an object literal — the call must be readable`);
  const sent: string[] = [];
  for (const raw of call.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const plain = /^([a-zA-Z]+)(?::\s*[^,]+)?,?$/.exec(raw);
    const spread = /^\.\.\.\(([a-zA-Z]+) \? \{ \1 \} : \{\}\),?$/.exec(raw);
    const key = plain?.[1] ?? spread?.[1];
    if (!key) { flightFail(`${FLIGHT_ROUTE} forwards a line the law cannot read: "${raw}" — the provider call carries named keys and \`...(x ? { x } : {})\` spreads only`); continue; }
    if (!FLIGHT_CALL_KEYS.includes(key)) flightFail(`${FLIGHT_ROUTE} forwards "${key}" to the provider — the call carries ${FLIGHT_CALL_KEYS.join(', ')} and nothing else`);
    sent.push(key);
  }
  for (const k of ['legs', 'adults', 'currency', 'filters', 'sort']) if (!sent.includes(k)) flightFail(`${FLIGHT_ROUTE} no longer forwards ${k}`);
  if (/\.\.\.body\b|\.\.\.\(body/.test(route)) flightFail(`${FLIGHT_ROUTE} spreads the request body — nothing unvalidated reaches the provider`);
  if (!/const parsed = parseFilters\(body\.filters\);[\s\S]{0,200}filters = parsed\.filters;/.test(route)) flightFail(`${FLIGHT_ROUTE} does not take filters from parseFilters(body.filters)`);
  if (!/const parsed = parseSort\(body\.sort\);[\s\S]{0,200}sort = parsed\.sort;/.test(route)) flightFail(`${FLIGHT_ROUTE} does not take sort from parseSort(body.sort)`);
  if (/filters:\s*body\.filters|sort:\s*body\.sort|\{ filters: body|\{ sort: body/.test(route)) flightFail(`${FLIGHT_ROUTE} forwards body.filters or body.sort raw`);
  const order = ['rateLimit(`liteapi-flight-search', 'parseFilters(', 'parseSort(', "reserveTravelSearch('liteapi')", 'await searchFlightRates({'];
  const idx = order.map((s) => route.indexOf(s));
  for (let i = 0; i < idx.length; i++) {
    if (idx[i] < 0) flightFail(`${FLIGHT_ROUTE} lost ${order[i]}`);
    else if (i > 0 && idx[i] <= idx[i - 1]) flightFail(`${FLIGHT_ROUTE} runs ${order[i]} before ${order[i - 1]} — the order is rateLimit → validate → reserve → call, so a 400 costs no slot`);
  }
  // The contract refuses by name and admits only keys the vendor's type declares.
  const bad = parseFilters({ maxPrice: 5 });
  if (!('error' in bad) || !/^filters\.maxPrice is not a supported filter \(supported: /.test(bad.error)) flightFail(`parseFilters admits an unknown key or refuses it without its name — got ${JSON.stringify(bad)}`);
  const badCabin = parseFilters({ cabinClass: 'COACH' });
  if (!('error' in badCabin) || !/^filters\.cabinClass must be one of ECONOMY, PREMIUM_ECONOMY, BUSINESS, FIRST$/.test(badCabin.error)) flightFail(`parseFilters admits cabinClass COACH — got ${JSON.stringify(badCabin)}`);
  const biz = parseFilters({ cabinClass: 'business', cabinClassMatch: 'exactly' });
  if (!('filters' in biz) || biz.filters.cabinClass !== 'BUSINESS' || biz.filters.cabinClassMatch !== 'exactly') flightFail(`parseFilters does not forward cabinClass BUSINESS unchanged — got ${JSON.stringify(biz)}`);
  const badSort = parseSort({ sortBy: 'colour' });
  if (!('error' in badSort) || !/^sort\.sortBy must be one of /.test(badSort.error)) flightFail(`parseSort admits sortBy colour — got ${JSON.stringify(badSort)}`);
  const badSortKey = parseSort({ sortBy: 'price', direction: 'asc' });
  if (!('error' in badSortKey) || !/^sort\.direction is not a supported sort field/.test(badSortKey.error)) flightFail(`parseSort admits an unknown key or refuses it without its name — got ${JSON.stringify(badSortKey)}`);
  const empty = parseFilters({});
  if (!('filters' in empty) || Object.keys(empty.filters).length !== 0) flightFail(`parseFilters invents a default — {} must forward {} so the vendor's own default applies; got ${JSON.stringify(empty)}`);
  const client = codeOf(FLIGHT_CLIENT);
  const typeAt = client.indexOf('export interface FlightSearchFilters {');
  const typeBody = typeAt >= 0 ? client.slice(typeAt, client.indexOf('\n}', typeAt)) : '';
  const declared = new Set([...typeBody.matchAll(/^\s+([a-zA-Z]+)\?:/gm)].map((m) => m[1]));
  for (const k of FILTER_KEYS) if (!declared.has(k)) flightFail(`${FLIGHT_CONTRACT} admits filter "${k}", which ${FLIGHT_CLIENT}'s FlightSearchFilters does not declare`);
  const sortAt = client.indexOf('export interface FlightSort {');
  const sortBody = sortAt >= 0 ? client.slice(sortAt, client.indexOf('\n}', sortAt)) : '';
  for (const s of SORT_BY) if (!sortBody.includes(`'${s}'`)) flightFail(`${FLIGHT_CONTRACT} admits sortBy "${s}", which ${FLIGHT_CLIENT}'s FlightSort does not declare`);
  // "Any" sends nothing; every control the screen offers round-trips through the contract.
  const none = searchRequestOf(DEFAULT_UI_FILTERS);
  if (Object.keys(none).length !== 0) flightFail(`searchRequestOf(DEFAULT_UI_FILTERS) sends ${JSON.stringify(none)} — a control at "any" sends nothing, so the vendor's default applies`);
  if (!/the vendor's default/.test(filtersStatement(DEFAULT_UI_FILTERS))) flightFail('filtersStatement(DEFAULT_UI_FILTERS) does not say the vendor\'s default applies — a default the screen does not state is a silent narrowing');
  const full = searchRequestOf({ cabin: 'BUSINESS', stops: 'nonstop', refundableOnly: true, checkedBag: true, departure: 'morning', sort: 'price' });
  const fullParsed = full.filters ? parseFilters(full.filters) : { error: 'no filters' };
  const fullSort = full.sort ? parseSort(full.sort) : { error: 'no sort' };
  if ('error' in fullParsed || 'error' in fullSort) flightFail(`the screen's own request is refused by the route's contract: ${JSON.stringify(full)}`);
  else {
    const f = fullParsed.filters;
    if (f.cabinClass !== 'BUSINESS' || f.cabinClassMatch !== 'exactly' || f.maxStops !== 0 || f.refundableOnly !== true || f.includesCheckedBag !== true || f.departureTimeAfter !== '05:00' || f.departureTimeBefore !== '11:59' || fullSort.sort.sortBy !== 'price') flightFail(`the screen's request does not survive the contract unchanged: ${JSON.stringify({ filters: f, sort: fullSort.sort })}`);
  }
  for (const stops of ['one'] as const) { const r = searchRequestOf({ ...DEFAULT_UI_FILTERS, stops }); if (r.filters?.maxStops !== 1) flightFail(`stops "${stops}" does not send maxStops 1`); }
}

// 2. no fare attribute is rendered from a value the payload did not carry — probed on the captured-shape payload.
{
  const adapter = codeOf(FLIGHT_ADAPTER);
  if (/!!/.test(adapter)) flightFail(`${FLIGHT_ADAPTER} coerces with !! — an attribute the payload did not carry is null, never false`);
  if (/\bconditions\b/.test(adapter)) flightFail(`${FLIGHT_ADAPTER} still writes \`conditions\` — the coerced booleans FLIGHT-01 retired`);
  const attrs = flightFnBody(adapter, 'fareAttributesOf');
  if (!attrs) flightFail(`${FLIGHT_ADAPTER} no longer exports fareAttributesOf`);
  else if (/pric|total|amount/i.test(attrs)) flightFail(`${FLIGHT_ADAPTER}'s fareAttributesOf reads a price — an attribute is what the carrier states, never inferred from money`);
  for (const k of ['cabin', 'fareFamily', 'fareBasisCode', 'checkedBag', 'carryOnBag', 'changeable', 'refundable', 'changeFee', 'refundFee']) {
    if (!new RegExp(`\\b${k}: stated(String|Boolean|Fee|Cabin)\\(`).test(attrs)) flightFail(`${FLIGHT_ADAPTER}'s fareAttributesOf does not read ${k} through a stated*() reader`);
  }
  const leaf = codeOf(FLIGHT_LEAF);
  const diff = flightFnBody(leaf, 'fareDifference');
  const loopAt = diff.indexOf('for (const { key, label } of DIFFERENCE_ATTRIBUTES)');
  const loop = loopAt >= 0 ? diff.slice(loopAt, diff.indexOf('\n  }', loopAt)) : '';
  if (!loop) flightFail(`${FLIGHT_LEAF}'s fareDifference no longer walks DIFFERENCE_ATTRIBUTES`);
  else if (/price|total|delta/.test(loop)) flightFail(`${FLIGHT_LEAF}'s fareDifference reasons from a price — the reasons are the stated attributes only`);
  if (!/unstated\.push\(label\); continue;/.test(loop)) flightFail(`${FLIGHT_LEAF}'s fareDifference no longer sets an unstated attribute aside — it must never count as a reason`);
  if (NOT_STATED !== 'not stated by the carrier') flightFail(`NOT_STATED reads "${NOT_STATED}" — the ruling's words are "not stated by the carrier"`);
  const view = codeOf(FLIGHT_VIEW);
  const cells = [...view.matchAll(/data-fare-field="([a-zA-Z]+)"[^\n]*/g)];
  if (cells.length < 7) flightFail(`${FLIGHT_VIEW} renders ${cells.length} fare cells — price, family, cabin, checked bag, carry-on, changeable, refundable`);
  for (const m of cells) {
    if (m[1] === 'price' || m[1] === 'family') continue; // the fare's price and its name — shown as carried, no tri-state
    if (!/statedText\(|NOT_STATED/.test(m[0])) flightFail(`${FLIGHT_VIEW} renders the ${m[1]} cell without statedText() or NOT_STATED — an unstated attribute reads "not stated by the carrier", never a default`);
  }
  if (/conditions\??\.refundable|conditions\??\.changeable/.test(view)) flightFail(`${FLIGHT_VIEW} still reads the retired coerced conditions`);
  if (!/data-flight-operated-by>operated by \{carrier\.operatedBy\}/.test(view)) flightFail(`${FLIGHT_VIEW} does not say "operated by" when the marketing carrier is not the operating one`);
  if (!/data-flight-llf/.test(view) || !/lowestFareLine\(/.test(view)) flightFail(`${FLIGHT_VIEW} does not render the lowest-fare line`);
  // TRAVEL-ROW-01 (2026-09-23): the difference still comes from fareDifference against
  // the lowest and still renders on the selection — it moved from the bar after the table
  // into the strip DIRECTLY BENEATH the selected fare row, so the names it is read by moved with it.
  if (!/data-fare-difference=\{fareDiff\.delta\}>\{fareDiff\.line\}/.test(view) || !/fareDifference\(fare, lowFare\.fare\)/.test(view)) flightFail(`${FLIGHT_VIEW} does not render the selection's difference over the lowest fare`);
  // The captured-shape payload: the founder's rows, grouped.
  const offers = liteApiResultsToFlightOffers(BKK_HKT_RATES);
  const groups = groupFlights(offers);
  if (groups.length !== BKK_HKT_EXPECTED.flights || offers.length !== BKK_HKT_EXPECTED.fares) flightFail(`BKK→HKT groups to ${groups.length} flights · ${offers.length} fares — the captured payload holds ${BKK_HKT_EXPECTED.flights} flights · ${BKK_HKT_EXPECTED.fares} fares`);
  const vz = groups.find((g) => g.representative.outboundSegments?.[0]?.marketingCode === 'VZ' && g.representative.outboundSegments?.[0]?.marketingNumber === '300');
  if (!vz || vz.fares.length !== BKK_HKT_EXPECTED.vietjetFares) flightFail(`Vietjet 300 at 06:50 is ${vz ? vz.fares.length : 0} fare(s) under one flight — the founder's six rows are one flight with six fares`);
  if (countLine(groups) !== `${BKK_HKT_EXPECTED.flights} flights · ${BKK_HKT_EXPECTED.fares} fares`) flightFail(`the count line reads "${countLine(groups)}"`);
  const hahn = offers.find((o) => o.outboundSegments?.[0]?.marketingCode === 'H1');
  const hahnLine = hahn?.outboundSegments?.[0] ? carrierLineOf(hahn.outboundSegments[0]) : null;
  if (!hahnLine || hahnLine.name !== 'Hahn Air Systems' || hahnLine.operatedBy !== 'Thai Vietjet Air') flightFail(`the Hahn Air row reads ${JSON.stringify(hahnLine)} — it is Hahn Air Systems, operated by Thai Vietjet Air`);
  const byId = (id: string) => offers.find((o) => o.id === id);
  const noBag = byId('vz300-deluxe-nobag'), noTerms = byId('vz300-deluxe-noterms'), sky = byId(BKK_HKT_EXPECTED.skyboss.offerId);
  if (!noBag || noBag.fare?.checkedBag !== null || noBag.fare?.carryOnBag !== null) flightFail(`a fare whose payload carries no baggage reads checkedBag ${JSON.stringify(noBag?.fare?.checkedBag)} — null, "not stated by the carrier"`);
  if (!noTerms || noTerms.fare?.refundable !== null || noTerms.fare?.changeable !== null) flightFail(`a fare whose payload carries no terms reads refundable ${JSON.stringify(noTerms?.fare?.refundable)} — null, never "not refundable"`);
  if (!sky || sky.fare?.refundable !== true || sky.fare?.checkedBag !== true) flightFail('the SkyBoss fare does not carry the refundable and checked-bag attributes its payload states');
  const low = lowestFare(groups);
  if (!low || low.fare.id !== BKK_HKT_EXPECTED.lowest.offerId || low.fare.price !== BKK_HKT_EXPECTED.lowest.price) flightFail(`the lowest fare is ${low?.fare.id} at ${low?.fare.price} — ${BKK_HKT_EXPECTED.lowest.offerId} at ${BKK_HKT_EXPECTED.lowest.price}`);
  if (low && lowestFareLine(low) !== BKK_HKT_EXPECTED.lowest.line) flightFail(`the lowest-fare line reads "${lowestFareLine(low)}" — "${BKK_HKT_EXPECTED.lowest.line}"`);
  if (low && sky && fareDifference(sky, low.fare).line !== BKK_HKT_EXPECTED.skyboss.difference) flightFail(`the SkyBoss difference reads "${fareDifference(sky, low.fare).line}" — "${BKK_HKT_EXPECTED.skyboss.difference}"`);
  if (low && noTerms && !/reason not stated by the carrier/.test(fareDifference(noTerms, low.fare).line)) flightFail(`a fare with unstated terms reads "${fareDifference(noTerms, low.fare).line}" — its reason is not stated by the carrier`);
  if (low && fareDifference(low.fare, low.fare).line !== 'This is the lowest fare meeting your filters.') flightFail('the lowest fare selected does not say it is the lowest');
}

// 3. no search fires on a filter change.
{
  const view = codeOf(FLIGHT_VIEW);
  const searchCalls = view.match(/onSearchLeg\(/g) ?? [];
  if (searchCalls.length !== 1) flightFail(`${FLIGHT_VIEW} calls onSearchLeg ${searchCalls.length} time(s) — exactly once, from the SEARCH button`);
  if (!/<button onClick=\{\(\) => onSearchLeg\(leg\.id\)\}/.test(view)) flightFail(`${FLIGHT_VIEW}'s one onSearchLeg call is not the SEARCH button's onClick`);
  if (/useEffect|useLayoutEffect/.test(view)) flightFail(`${FLIGHT_VIEW} runs an effect — the view is fully controlled and fires nothing`);
  if (/\bfetch\(/.test(view)) flightFail(`${FLIGHT_VIEW} fetches — the view calls no route`);
  const barFrom = view.indexOf('data-flight-filters>');
  const barTo = view.indexOf('data-flight-filters-stated');
  const bar = barFrom >= 0 && barTo > barFrom ? view.slice(barFrom, barTo) : '';
  if (!bar) flightFail(`${FLIGHT_VIEW} has no filter bar between data-flight-filters and data-flight-filters-stated`);
  const changes = bar.match(/onChange=\{/g) ?? [];
  const writes = bar.match(/setFilters\(leg, \{/g) ?? [];
  if (changes.length !== 6 || writes.length !== 6) flightFail(`the filter bar has ${changes.length} onChange handler(s) and ${writes.length} setFilters write(s) — six controls, each writing the leg's filters and nothing else`);
  if (/onSearchLeg|onUpdateLeg\(leg\.id, \{ offers|loading: true/.test(bar)) flightFail('the filter bar reaches the search — a filter change only writes the leg');
  if (!/data-flight-filters-stated>[\s\S]{0,200}filtersStatement\(leg\.filters\)/.test(view)) flightFail(`${FLIGHT_VIEW} does not state, under the bar, what the next search will ask`);
  // HOTEL-01 (2026-09-22): the count is the one shared SearchCount control (src/components/trips/SearchCount.tsx).
  if (!/<SearchCount count=\{searchCount\} \/>/.test(view)) flightFail(`${FLIGHT_VIEW} does not show the session's search count beside the button (the shared SearchCount control)`);
  if (!/data-search-count=\{count\}/.test(codeOf('src/components/trips/SearchCount.tsx'))) flightFail('SearchCount no longer renders data-search-count');
  for (const f of FLIGHT_CONTAINERS) {
    const c = codeOf(f);
    let effects = 0;
    for (const m of c.matchAll(/useEffect\(\(\) => \{/g)) {
      effects += 1;
      const open = c.indexOf('{', m.index!);
      let depth = 0, end = -1;
      for (let i = open; i < c.length; i++) { if (c[i] === '{') depth += 1; else if (c[i] === '}') { depth -= 1; if (depth === 0) { end = i; break; } } }
      const body = c.slice(open, end + 1);
      if (/searchLeg\(|flights\/search/.test(body)) flightFail(`${f}: an effect runs the search — a search fires only on the SEARCH press`);
    }
    if (effects === 0) flightFail(`${f} has no readable effects — the law reads \`useEffect(() => {\``);
    const bodies = [...c.matchAll(/body: JSON\.stringify\(\{ legs: searchLegs, adults: [^,]+, currency: 'USD', \.\.\.searchRequestOf\(leg\.filters\) \}\)/g)];
    if (bodies.length !== 1) flightFail(`${f} builds the search body ${bodies.length} way(s) — one body: legs, adults, currency, ...searchRequestOf(leg.filters)`);
    const counts = c.match(/setSearchCount\(\(n\) => n \+ 1\)/g) ?? [];
    if (counts.length !== 1) flightFail(`${f} increments the search count ${counts.length} time(s) — once, in searchLeg`);
    const fnAt = c.indexOf('const searchLeg = ');
    const countAt = c.indexOf('setSearchCount((n) => n + 1)');
    const fetchAt = c.indexOf("flights/search'");
    if (fnAt < 0 || countAt < fnAt || fetchAt < countAt) flightFail(`${f}'s search count is not incremented inside searchLeg before its fetch`);
    if (!/filters: DEFAULT_UI_FILTERS/.test(c)) flightFail(`${f} does not start a leg at DEFAULT_UI_FILTERS — every control at "any"`);
    if (!/searchCount=\{searchCount\}/.test(c)) flightFail(`${f} does not hand the search count to the view`);
  }
}

// 4. the booking-flow pin holds, dated.
{
  const notes = commentsOf(FLIGHT_PIN_FILE);
  const pins = codeOf(FLIGHT_PIN_FILE);
  const noteLines = [...notes.matchAll(/FLIGHT-01 \(2026-09-22\): re-pinned[^\n]*/g)];
  if (noteLines.length !== FLIGHT_REPINNED.length) flightFail(`${FLIGHT_PIN_FILE} carries ${noteLines.length} FLIGHT-01 re-pin note(s) — five: the route, the two containers, the view, the adapter`);
  for (const f of FLIGHT_REPINNED) {
    const pinAt = pins.indexOf(`{ file: '${f}', sha256: '`);
    if (pinAt < 0) { flightFail(`${FLIGHT_PIN_FILE} no longer pins ${f}`); continue; }
    const pinLine = pins.slice(0, pinAt).split('\n').length;
    // HOTEL-01 (2026-09-22): a later ruling's dated re-pin note may stack ABOVE this
    // one — the FLIGHT-01 note and its "Was" line must still stand, consecutive, in
    // the comment block over the pin (up to three stacked notes).
    const noteBlock = notes.split('\n').slice(Math.max(0, pinLine - 7), pinLine - 1).join('\n');
    if (!/FLIGHT-01 \(2026-09-22\): re-pinned — [^\n]+\. Search is not booking; no prebook\/verify\/book\/pay\/cancel call changed\.\n[^\n]*Was [0-9a-f]{64} at main b9eac34a\./.test(noteBlock)) flightFail(`${f}'s pin does not sit under a dated FLIGHT-01 note naming why, that search is not booking, and the hash it had on main`);
  }
  if (!/FLIGHT-01 \(2026-09-22\), search is not booking/.test(BOOKING_FLOW_BASE)) flightFail('BOOKING_FLOW_BASE does not record the FLIGHT-01 re-pin');
  for (const pin of BOOKING_FLOW_FILES) {
    if (FLIGHT_REPINNED.includes(pin.file)) continue;
    const pinAt = pins.indexOf(`{ file: '${pin.file}', sha256: '`);
    const pinLine = pins.slice(0, pinAt).split('\n').length;
    const above = notes.split('\n').slice(Math.max(0, pinLine - 3), pinLine - 1).join('\n');
    if (/FLIGHT-01/.test(above)) flightFail(`${pin.file} carries a FLIGHT-01 note — FLIGHT-01 re-pinned the five search-path files and nothing else`);
  }
}
if (flightViolations === 0) console.log(`✔ The flight law passed — the search route forwards ${FLIGHT_CALL_KEYS.length} validated keys and nothing else, the contract refuses an unknown filter or sort by name and invents no default; every fare attribute is tri-state from the payload and renders "${NOT_STATED}" when absent; BKK→HKT groups ${BKK_HKT_EXPECTED.fares} fares into ${BKK_HKT_EXPECTED.flights} flights with the Hahn Air row operated by Thai Vietjet Air; one onSearchLeg, no effect, six filter controls that only write the leg; ${FLIGHT_REPINNED.length} search-path files re-pinned, dated.`);
else console.log(`✖ The flight law FAILED — ${flightViolations} violation(s).`);
});
lawGuard('The hotel law', () => {

// ── THE HOTEL LAW (HOTEL-01, 2026-09-22) ─────────────────────────────────────
// A HOTEL APPEARS ONCE, A RATE SAYS WHAT IT BUYS, AND NOTHING ON THE SCREEN IS
// FROM A DEAD PROVIDER.
//
// FLIGHT-01's standard, applied to hotels. The search route forwarded city,
// country, dates and adults and nothing else while the vendor's contract took
// star rating, a guest-rating floor, refundable-only, board type and sort; the
// mapper kept ONE rate per hotel (the first with a price) and dropped the rest
// with every attribute; the showroom's picker hard-coded a null rating and named
// a retired provider under its prices; vendor-commit gave every stay a 15:00 /
// 11:00 nobody stated — an invented time, the class GRID-01 removed.
//
//   1. NO HOTEL SURFACE NAMES A PROVIDER OTHER THAN THE ONE THE ENV SELECTS. No
//      hotel surface's code names Amadeus or Duffel, or attributes what it shows
//      to any provider but LiteAPI; the results caption names LiteAPI; the
//      sandbox footer reads the env the route sends, which reads LITEAPI_MODE.
//   2. NO RATE ATTRIBUTE IS RENDERED FROM A VALUE THE PAYLOAD DID NOT CARRY. The
//      hotel leaf reads every attribute through the ONE tri-state helper
//      (src/lib/travel/stated.ts — no second reader anywhere), never `!!`; the
//      view renders stars, the guest rating and every rate cell through
//      starsText / statedText / NOT_STATED; the difference loop reads no price.
//      Probed on the Phuket payload: five items → four hotels, the Ibis's four
//      rates under one card cheapest first, a silent property all-null, the
//      lowest-rate line and the difference lines verbatim.
//   3. NO INVENTED CHECK-IN / CHECK-OUT TIME. vendor-commit holds no 15:00 / 11:00
//      and writes the caller's stated clock or null; a stay is overlaid like any
//      date-only item (a stated window draws on its days, an unstated one stays
//      all-day); the panel and the grid name the property's silence; the
//      container sends the property's clock only when the payload carried it.
//   4. NO SEARCH FIRES ON A FILTER CHANGE. The view runs no effect and fetches
//      nothing; its five controls write the filters and nothing else; the
//      container fetches the search once, from its one search function, counted
//      once; the route parses the contract between the guards and forwards it
//      unchanged; the contract refuses an unknown name and a bad value by name and
//      invents no default.
//   5. THE BOOKING-FLOW PIN HOLDS, DATED. The seven files HOTEL-01 touched carry a
//      dated HOTEL-01 re-pin note with the hash they had on main; no other file
//      carries one; and the client's booking functions — prebook, book, status,
//      cancel and their parsers, plus the paid content reads — hash BODY-FOR-BODY
//      to what they were on main d56b2cc9. (The whole-file hashes are the travel law's.)
/** The comment block stacked directly over a pin: every comment-only line above it (blank in the code half), nearest first. HOTEL-02 (2026-09-22): a pin's notes are the lines over IT, never a neighbour's. */
const HOTEL_CONTRACT = 'src/lib/hotels/searchContract.ts';
const HOTEL_LEAF = 'src/lib/hotels/rates.ts';
const HOTEL_TRIP_ITEM = 'src/lib/calendar/tripItem.ts';
const HOTEL_PANEL = 'src/components/hub/EventDetailPanel.tsx';
const HOTEL_GRID = 'src/components/shared/CalendarGrid.tsx';
const STATED_LEAF = 'src/lib/travel/stated.ts';
const HOTEL_SURFACES = [HOTEL_VIEW, HOTEL_CONTAINER, 'src/components/trips/HotelPicker.tsx', 'src/components/trips/CheckoutPanel.tsx', 'src/components/trips/HotelGallery.tsx', 'src/components/trips/HotelMap.tsx', 'src/components/trips/LodgingOptions.tsx', 'src/components/trips/TransferPicker.tsx'];
const HOTEL_REPINNED = [HOTEL_ROUTE, HOTEL_VIEW, HOTEL_CONTAINER, 'src/components/trips/HotelPicker.tsx', HOTEL_CLIENT, 'src/lib/liteapiFlightAdapter.ts', 'src/components/trips/FlightPickerView.tsx'];
/** The client's booking functions and paid content reads, hashed body-for-body on main d56b2cc9 (code half). */
const HOTEL_BOOKING_FUNCTIONS: Record<string, string> = {
  // COMM-01 (2026-09-26): prebookRate states null for an absent commission (was
  // ?? 0 — a guess). Was 4dd7916a01b7e0d6305a98f6c64d3d9878e24bc41f99e8564826e6a2b366d405 at main 0ef428a6.
  prebookRate: 'a3edaf6c3a92dd0d4d9a8c946cd7ec1aec9ed6f64494a68012975d05758726ac',
  bookRate: 'ba5ce89952e481bd596f410b1aba271b5125db44c59dcb5fdb4327db572cb965',
  getBookingStatus: '4aa6e75fdacd576f8523bc8be6c3ba88a9df64fa13ac0a725f88ee6945836a2d',
  cancelBooking: '709d32f1029c90aaabb5dc33d4819e333281987642b762bee196817b85dbfe03',
  bookingObjectOf: 'f90ae8bfd4d9c3bfe5eb8ed8199e1d1f095c8d7c8a71a55b7b6ad29f9a66c789',
  // STATUS-01 (2026-09-26): parseBookResult no longer defaults an absent status to
  // 'CONFIRMED' — it states null; the word is mapped by hotelStatus.ts only.
  // Was a927130764815e4d5cfe1ad90f7a16df44f2c0a0222934fbf4b3e19f2a6bf61b at main 53900e67.
  parseBookResult: '35085c4c9b9b2ad4b96f64ab1e7202fc23705abcd06bcecc99e9716a4630c224',
  cancellationObjectOf: '8d7b73a8d26ae00af2108a21964f15667ae3e0d9f39009b3893a538710ec3f2c',
  parseCancelResult: 'd1b7e6430a29ada04033cf2e8f00ee0bf7cded39dcd3fbc96830eb642d335afd',
  getHotelContent: '29a889449fb4bb36bc093ae6a314d92f227dbf341c715eb1b1fb0da01671cff2',
  getHotelReviews: 'ce98b7ecc9a5b4de8443d0c443a95c0fa50f0853bf6a39a03cbbec2ddbb95531',
};
let hotelViolations = 0;
const hotelFail = (m: string) => { hotelViolations += 1; violations.push(`hotel law: ${m} (HOTEL-01)`); };

// 1. no hotel surface names a provider other than the one the env selects.
{
  for (const f of HOTEL_SURFACES) {
    if (!existsSync(resolve(ROOT, f))) { hotelFail(`${f} is gone`); continue; }
    const body = codeOf(f);
    const dead = body.match(/amadeus|duffel/i);
    if (dead) hotelFail(`${f} names ${dead[0]} — a retired provider on a hotel surface`);
    const other = /(from|via|powered by|data from)\s+(?!liteapi)[A-Za-z.]+\s+API/i.exec(body);
    if (other) hotelFail(`${f} attributes the screen to another provider: "${other[0]}"`);
  }
  const view = codeOf(HOTEL_VIEW);
  if (!/TRAVEL \/ HOTEL SEARCH — LIVE PRICES VIA LITEAPI/.test(view)) hotelFail(`${HOTEL_VIEW} no longer names LiteAPI as the provider`);
  if (!/env === 'sandbox' \? 'Sandbox prices — not bookable'/.test(view)) hotelFail(`${HOTEL_VIEW} does not say "Sandbox prices — not bookable" from the env`);
  if (!/setEnv\(data\.env === 'live' \? 'live' : data\.env === 'sandbox' \? 'sandbox' : null\);/.test(codeOf(HOTEL_CONTAINER))) hotelFail(`${HOTEL_CONTAINER} does not take the env from the route's answer`);
  if (!/env: liteApiPaymentEnv\(\),/.test(codeOf(HOTEL_ROUTE))) hotelFail(`${HOTEL_ROUTE} does not send the env it prices in`);
  if (!/return process\.env\.LITEAPI_MODE === 'production' \? 'production' : 'sandbox';/.test(codeOf(HOTEL_CLIENT))) hotelFail(`${HOTEL_CLIENT} no longer resolves the mode from LITEAPI_MODE alone`);
}

// 2. no rate attribute from a value the payload did not carry — one tri-state helper.
{
  const leaf = codeOf(HOTEL_LEAF);
  if (/!!/.test(leaf)) hotelFail(`${HOTEL_LEAF} coerces with !! — silence is null, never false`);
  if (!/import \{ type Stated, stated, statedBoolean, statedNumber, statedString \} from '@\/lib\/travel\/stated';/.test(leaf)) hotelFail(`${HOTEL_LEAF} does not read the one tri-state helper`);
  for (const f of tsFiles(resolve(ROOT, 'src')).map((abs) => abs.replace(`${ROOT}/`, ''))) {
    if (f === STATED_LEAF) continue;
    if (/(function|const) stated(Boolean|String|Number) ?[=(]/.test(codeOf(f))) hotelFail(`${f} defines a second tri-state reader — there is one, in ${STATED_LEAF}`);
  }
  for (const fn of ['statedString', 'statedBoolean', 'statedNumber', 'stated']) if (!new RegExp(`export function ${fn}\\(`).test(codeOf(STATED_LEAF))) hotelFail(`${STATED_LEAF} no longer exports ${fn}()`);
  const attrs = functionBody(leaf, 'rateViewOf') ?? '';
  if (!attrs) hotelFail(`${HOTEL_LEAF} no longer exports rateViewOf`);
  for (const k of ['roomName: statedString(', 'boardType,', 'boardName: statedString(', 'breakfast: breakfastOf(', 'refundable: refundableOf(', 'cancelDeadline: cancelDeadlineOf(', 'taxesIncluded: taxesIncludedOf(', 'maxOccupancy: statedNumber(']) {
    if (!attrs.includes(k)) hotelFail(`${HOTEL_LEAF}'s rateViewOf does not read "${k.replace(/[:(,].*$/, '')}" through a stated reader`);
  }
  const diff = functionBody(leaf, 'rateDifference') ?? '';
  const loopAt = diff.indexOf('for (const { key, label } of DIFFERENCE_ATTRIBUTES)');
  const loop = loopAt >= 0 ? diff.slice(loopAt, diff.indexOf('if (selected.roomName', loopAt)) : '';
  if (!loop) hotelFail(`${HOTEL_LEAF}'s rateDifference no longer walks DIFFERENCE_ATTRIBUTES`);
  else if (/total|perNight|price|delta/.test(loop)) hotelFail(`${HOTEL_LEAF}'s rateDifference reasons from a price`);
  if (!/unstated\.push\(label\); continue;/.test(loop)) hotelFail(`${HOTEL_LEAF}'s rateDifference no longer sets an unstated attribute aside`);
  if (HOTEL_NOT_STATED !== 'not stated by the property') hotelFail(`the hotel NOT_STATED reads "${HOTEL_NOT_STATED}"`);
  const view = codeOf(HOTEL_VIEW);
  if (!/data-hotel-stars>\{starsText\(card\.stars\)\}/.test(view)) hotelFail(`${HOTEL_VIEW} renders the stars without starsText() — a null must read "not stated"`);
  if (!/card\.guestRating === null \? `rating \$\{NOT_STATED\}`/.test(view)) hotelFail(`${HOTEL_VIEW} renders a null guest rating as something other than "not stated"`);
  for (const m of view.matchAll(/data-rate-field="([a-zA-Z]+)"[^\n]*/g)) {
    if (m[1] === 'price') continue;
    if (!/statedText\(|NOT_STATED/.test(m[0])) hotelFail(`${HOTEL_VIEW} renders the ${m[1]} cell without statedText() or NOT_STATED`);
  }
  if ((view.match(/data-rate-field="/g) ?? []).length < 6) hotelFail(`${HOTEL_VIEW} renders fewer than six rate cells — price, room, board, cancellation, taxes, guests`);
  // Probed on the Phuket payload.
  const cards = hotelCardsOf(PHUKET_RATES);
  if (cards.length !== PHUKET_EXPECTED.hotels || cards.reduce((n, c) => n + c.rates.length, 0) !== PHUKET_EXPECTED.rates) hotelFail(`Phuket groups to ${hotelCountLine(cards)} — the payload holds ${PHUKET_EXPECTED.hotels} hotels · ${PHUKET_EXPECTED.rates} rates (five items)`);
  const ibis = cards.find((c) => c.hotelId === 'lp-ibis');
  if (!ibis || ibis.rates.length !== PHUKET_EXPECTED.ibisRates || ibis.rates[0].rateId !== PHUKET_EXPECTED.lowest.rateId) hotelFail(`the Ibis holds ${ibis?.rates.length ?? 0} rates under one card, cheapest ${ibis?.rates[0]?.rateId} — four, cheapest first`);
  const gh = cards.find((c) => c.hotelId === 'lp-guesthouse');
  if (!gh || gh.stars !== null || gh.guestRating !== null || gh.rates[0]?.refundable !== null || gh.rates[0]?.breakfast !== null || gh.rates[0]?.roomName !== null) hotelFail('a property that states no stars, rating, room, board or policy reads something other than null');
  const low = lowestRate(cards);
  if (!low || lowestRateLine(low) !== PHUKET_EXPECTED.lowest.line) hotelFail(`the lowest-rate line reads "${lowestRateLine(low)}"`);
  const rateOf = (id: string) => cards.flatMap((c) => c.rates).find((r) => r.rateId === id);
  for (const k of ['breakfast', 'villa', 'guesthouse'] as const) {
    const r = rateOf(PHUKET_EXPECTED[k].rateId);
    if (low && (!r || rateDifference(r, low.rate).line !== PHUKET_EXPECTED[k].difference)) hotelFail(`the ${k} difference reads "${r && low ? rateDifference(r, low.rate).line : '(none)'}"`);
  }
}

// 3. no invented check-in / check-out time.
{
  const commit = codeOf(HOTEL_COMMIT);
  if (/'15:00'|'11:00'/.test(commit)) hotelFail(`${HOTEL_COMMIT} still holds the hotel-standard 15:00 / 11:00 — an invented time`);
  // HOTEL-02 (2026-09-22): the stay's clock is resolved ONCE before the transaction — the
  // property's own (read at commit) or the caller's stated one — and written to both columns.
  if (!/const blockStart = stayStart\.value;\n\s+const blockEnd = stayEnd\.value;/.test(commit)) hotelFail(`${HOTEL_COMMIT} does not write the stay's resolved clock (the property's or the caller's stated one) or null`);
  if (!/homeTime: ledgerStart,\n\s+destDate: end, destTime: ledgerEnd,/.test(commit)) hotelFail(`${HOTEL_COMMIT} does not write the ledger's clock as the same clock the block window holds`);
  if (!(DATE_ONLY_TRIP_TYPES as readonly string[]).includes('lodging')) hotelFail(`${HOTEL_TRIP_ITEM} does not overlay a stay's stated window`);
  if ((TIMED_BY_THEMSELVES as readonly string[]).includes('lodging')) hotelFail(`${HOTEL_TRIP_ITEM} still treats a stay as timed by itself`);
  const clockAt = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
  const stays: TripItemRow[] = [
    { id: 'ti-s', tripId: 't', vendorOptionId: 'h-s', vendorOptionType: 'lodging', category: 'accommodation', vendor: 'Kata Rocks', vendor_name: 'LiteAPI', location: 'Phuket', block_start_time: clockAt('16:00'), block_end_time: clockAt('11:00') },
    { id: 'ti-u', tripId: 't', vendorOptionId: 'h-u', vendorOptionType: 'lodging', category: 'accommodation', vendor: 'Kata Guesthouse', vendor_name: 'LiteAPI', location: 'Phuket', block_start_time: null, block_end_time: null },
  ];
  const stayRows: Array<TripOverlayEvent & { id: string }> = [
    { id: 'e-s', source: 'trip', source_id: 'trip:t:vendor:h-s', start_time: null, end_time: null, location: null },
    { id: 'e-u', source: 'trip', source_id: 'trip:t:vendor:h-u', start_time: null, end_time: null, location: null },
  ];
  const overlaid = overlayTripItems(stayRows, stays);
  if (overlaid[0].start_time !== '16:00' || overlaid[0].end_time !== '11:00') hotelFail(`a stay with a stated 16:00 / 11:00 window drew ${overlaid[0].start_time}–${overlaid[0].end_time}`);
  if (overlaid[1].start_time !== null || overlaid[1].end_time !== null) hotelFail(`a stay with no stated window was given ${overlaid[1].start_time}–${overlaid[1].end_time} — a clock nobody stated`);
  if (hhmmOf('04:00 PM') !== '16:00' || hhmmOf('11:00 AM') !== '11:00' || hhmmOf('12:00 AM') !== '00:00' || hhmmOf('noon') !== null) hotelFail("hhmmOf no longer reads the vendor's 12-hour clock to HH:MM (and nothing else)");
  // HOTEL-02 (2026-09-22): the container names the vendor's hotel and sends NO clock — the
  // commit reads the property's own; the rates answer never carried one.
  const container = codeOf(HOTEL_CONTAINER);
  if (!/liteapiHotelId: card\.hotelId,/.test(container)) hotelFail(`${HOTEL_CONTAINER} does not name the vendor's hotel on Save`);
  if (/hhmmOf|startTime|endTime|checkinTime|checkoutTime/.test(container)) hotelFail(`${HOTEL_CONTAINER} sends a clock from the search — the property states it at commit`);
  if (!/row\.kind === 'trip_item' && row\.itemType === 'lodging'\n\s+\? 'check-in time not stated by the property'/.test(codeOf(HOTEL_PANEL))) hotelFail(`${HOTEL_PANEL} does not name an unstated check-in time`);
  if (!/event\.itemType === 'lodging' \? `⚠ \$\{event\.title\} · check-in time not stated` : event\.title/.test(codeOf(HOTEL_GRID))) hotelFail(`${HOTEL_GRID} does not flag a stay without a stated check-in`);
  // HOTEL-02 (2026-09-22): the rates leaf holds no clock at all — the vendor's documented keys are read by the stay-times leaf, at commit.
  if (/checkinCheckoutTimes|checkinTime|checkoutTime|hhmmOf/.test(codeOf(HOTEL_LEAF))) hotelFail(`${HOTEL_LEAF} models a clock the rates answer never carries`);
  if (!/const blockStartParse = parseTimeOrNull\(startTime, 'block_start_time'\);\n\s+if \(blockStartParse\.error\) return blockStartParse\.error;/.test(commit)) hotelFail(`${HOTEL_COMMIT} does not refuse a malformed commit time by name — a silently nulled time is a time nobody stated`);
}

// 4. no search on a filter change; the route forwards the contract by name.
{
  const view = codeOf(HOTEL_VIEW);
  if (/useEffect|useLayoutEffect/.test(view)) hotelFail(`${HOTEL_VIEW} runs an effect`);
  if (/\bfetch\(/.test(view)) hotelFail(`${HOTEL_VIEW} fetches`);
  const barFrom = view.indexOf('data-hotel-filters>');
  const barTo = view.indexOf('data-hotel-filters-stated');
  const bar = barFrom >= 0 && barTo > barFrom ? view.slice(barFrom, barTo) : '';
  if (!bar) hotelFail(`${HOTEL_VIEW} has no filter bar between data-hotel-filters and data-hotel-filters-stated`);
  const changes = (bar.match(/onChange=\{/g) ?? []).length;
  const writes = (bar.match(/onFiltersChange\(\{/g) ?? []).length;
  if (changes !== 5 || writes !== 5) hotelFail(`the filter bar has ${changes} onChange handler(s) and ${writes} onFiltersChange write(s) — five controls, each writing the filters and nothing else`);
  if (/onBook|onSave|onSelect|onSubmit|\bfetch\(/.test(bar)) hotelFail('the filter bar reaches beyond the filters');
  if (!/<SearchCount count=\{searchCount\} \/>/.test(view)) hotelFail(`${HOTEL_VIEW} does not show the session's search count (the shared SearchCount control)`);
  if (!/data-hotel-filters-stated>[\s\S]{0,120}hotelFiltersStatement\(filters\)/.test(view)) hotelFail(`${HOTEL_VIEW} does not state what the next search asks`);
  const container = codeOf(HOTEL_CONTAINER);
  if (/useEffect/.test(container)) hotelFail(`${HOTEL_CONTAINER} runs an effect`);
  if ((container.match(/fetch\(`\/api\/travel\/hotels\/search/g) ?? []).length !== 1) hotelFail(`${HOTEL_CONTAINER} fetches the search other than once`);
  if ((container.match(/setSearchCount\(\(n\) => n \+ 1\)/g) ?? []).length !== 1) hotelFail(`${HOTEL_CONTAINER} counts a search other than once`);
  const searchAt = container.indexOf('const search = async');
  const countAt = container.indexOf('setSearchCount((n) => n + 1)');
  const fetchAt = container.indexOf('fetch(`/api/travel/hotels/search');
  if (searchAt < 0 || countAt < searchAt || fetchAt < countAt) hotelFail(`${HOTEL_CONTAINER}'s count is not inside search(), before its fetch`);
  if (!/\.\.\.hotelSearchParamsOf\(filters\),/.test(container)) hotelFail(`${HOTEL_CONTAINER} does not send the screen's filters as the vendor's names`);
  if (Object.keys(hotelSearchParamsOf(DEFAULT_HOTEL_FILTERS)).length !== 0) hotelFail('a control at "any" sends something — the vendor\'s default must apply');
  if (!/the vendor's default/.test(hotelFiltersStatement(DEFAULT_HOTEL_FILTERS))) hotelFail('the filters statement does not say the vendor\'s default applies');
  const route = codeOf(HOTEL_ROUTE);
  const order = ["rateLimit(`hotel-search:", 'parseHotelFilters([...params.keys()]', "reserveTravelSearch('liteapi')", 'searchHotelRates({'];
  const idx = order.map((s) => route.indexOf(s));
  for (let i = 0; i < idx.length; i++) {
    if (idx[i] < 0) hotelFail(`${HOTEL_ROUTE} lost ${order[i]}`);
    else if (i > 0 && idx[i] <= idx[i - 1]) hotelFail(`${HOTEL_ROUTE} runs ${order[i]} before ${order[i - 1]} — rateLimit → validate → reserve → call`);
  }
  if (!/\.\.\.\(Number\.isFinite\(radiusMeters\) \? \{ radiusMeters \} : \{\}\),\n\s+\.\.\.filters,\n\s+\}\);/.test(route)) hotelFail(`${HOTEL_ROUTE} does not forward the parsed filters unchanged, and only them`);
  // The contract file itself: the accepted names are the vendor's, and only those.
  const contract = codeOf(HOTEL_CONTRACT);
  if (!/export const HOTEL_FILTER_PARAMS = \['starRating', 'refundableRatesOnly', 'boardType', 'sort', 'sortDirection'\] as const;/.test(contract)) hotelFail(`${HOTEL_CONTRACT} admits a filter name the vendor does not document on one scale, or lost one`);
  if (/minRating/.test(contract)) hotelFail(`${HOTEL_CONTRACT} accepts minRating — documented on two scales (0–5 and out of 10); one number cannot ride both calls`);
  if (/minPrice|maxPrice|priceRange/.test(contract)) hotelFail(`${HOTEL_CONTRACT} names a price range — the vendor documents none; the range narrows on the page`);
  if (!/export function parseHotelFilters\(names: readonly string\[\], get: \(name: string\) => string \| null\)/.test(contract)) hotelFail(`${HOTEL_CONTRACT} no longer exports parseHotelFilters(names, get)`);
  const get = (o: Record<string, string>) => (n: string) => (n in o ? o[n] : null);
  const unknown = parseHotelFilters(['city', 'maxPrice'], get({ city: 'x', maxPrice: '5' }));
  if (!('error' in unknown) || !/^maxPrice is not a supported search parameter \(supported: /.test(unknown.error)) hotelFail(`parseHotelFilters admits an unknown name or refuses it without its name — ${JSON.stringify(unknown)}`);
  const bad = parseHotelFilters(['starRating'], get({ starRating: '4.2' }));
  if (!('error' in bad) || !/^starRating must be a comma list of /.test(bad.error)) hotelFail(`parseHotelFilters admits starRating 4.2 — ${JSON.stringify(bad)}`);
  const badSort = parseHotelFilters(['sort'], get({ sort: 'rating' }));
  if (!('error' in badSort) || !/^sort must be one of top_picks, price, revenue$/.test(badSort.error)) hotelFail(`parseHotelFilters admits sort rating — the vendor documents no rating sort — ${JSON.stringify(badSort)}`);
  const none = parseHotelFilters(['city'], get({ city: 'x' }));
  if (!('filters' in none) || Object.keys(none.filters).length !== 0) hotelFail(`parseHotelFilters invents a default — ${JSON.stringify(none)}`);
  const full = parseHotelFilters(['starRating', 'refundableRatesOnly', 'sort'], get({ starRating: '4,4.5,5', refundableRatesOnly: 'true', sort: 'price' }));
  if (!('filters' in full) || JSON.stringify(full.filters) !== JSON.stringify({ starRating: [4, 4.5, 5], refundableRatesOnly: true, sort: [{ field: 'price', direction: 'ascending' }] })) hotelFail(`the screen's request does not survive the contract unchanged — ${JSON.stringify(full)}`);
  const client = codeOf(HOTEL_CLIENT);
  for (const k of ['starRating', 'refundableRatesOnly', 'boardType', 'sort', 'maxRatesPerHotel']) {
    if (!new RegExp(`\\.\\.\\.\\([^)]*params\\.${k}[^)]*\\? \\{ ${k}: `).test(client)) hotelFail(`${HOTEL_CLIENT} does not carry ${k} to /hotels/rates verbatim, only when set`);
  }
}

// 5. the pin holds, dated; the booking functions byte-identical to main.
{
  const notes = commentsOf('src/lib/travelBookingFlow.ts');
  const pins = codeOf('src/lib/travelBookingFlow.ts');
  const count = (notes.match(/HOTEL-01 \(2026-09-22\): re-pinned/g) ?? []).length;
  if (count !== HOTEL_REPINNED.length) hotelFail(`src/lib/travelBookingFlow.ts carries ${count} HOTEL-01 re-pin note(s) — ${HOTEL_REPINNED.length}: the route, the two hotel surfaces, the showroom picker, the client, the flight adapter and the flight view`);
  for (const f of HOTEL_REPINNED) {
    const pinAt = pins.indexOf(`{ file: '${f}', sha256: '`);
    if (pinAt < 0) { hotelFail(`src/lib/travelBookingFlow.ts no longer pins ${f}`); continue; }
    const pinLine = pins.slice(0, pinAt).split('\n').length;
    // HOTEL-02 (2026-09-22): a later ruling's dated note may stack BELOW this one (directly
    // over the pin) — the HOTEL-01 note and its "Was" line must still stand, consecutive, in
    // the comment block over the pin (noteBlockOver: the pin's own lines, never a neighbour's).
    const above = noteBlockOver(pins, notes, pinLine);
    if (!/HOTEL-01 \(2026-09-22\): re-pinned — [^\n]+\. Search and display are not booking; no prebook\/book\/pay\/cancel call changed\.\n[^\n]*Was [0-9a-f]{64} at main d56b2cc9\./.test(above)) hotelFail(`${f}'s pin does not sit under a dated HOTEL-01 note naming why, that search and display are not booking, and the hash it had on main d56b2cc9`);
  }
  for (const pin of BOOKING_FLOW_FILES) {
    if (HOTEL_REPINNED.includes(pin.file)) continue;
    const pinAt = pins.indexOf(`{ file: '${pin.file}', sha256: '`);
    const pinLine = pins.slice(0, pinAt).split('\n').length;
    if (/HOTEL-01/.test(noteBlockOver(pins, notes, pinLine))) hotelFail(`${pin.file} carries a HOTEL-01 note — HOTEL-01 re-pinned ${HOTEL_REPINNED.length} files and nothing else`);
  }
  if (!/HOTEL-01 \(2026-09-22\), search and display are not booking/.test(BOOKING_FLOW_BASE)) hotelFail('BOOKING_FLOW_BASE does not record the HOTEL-01 re-pin');
  const client = codeOf(HOTEL_CLIENT);
  for (const [name, expected] of Object.entries(HOTEL_BOOKING_FUNCTIONS)) {
    const body = functionBody(client, name);
    if (!body) { hotelFail(`${HOTEL_CLIENT} no longer exports ${name}() — a booking function is gone`); continue; }
    const h = createHash('sha256').update(body).digest('hex');
    if (h !== expected) hotelFail(`${HOTEL_CLIENT}'s ${name}() is not byte-identical to main d56b2cc9 (sha256 ${h}) — a booking call changed under a search ruling`);
  }
}
if (hotelViolations === 0) console.log(`✔ The hotel law passed — ${HOTEL_SURFACES.length} hotel surfaces name no provider but the env's (LiteAPI; the sandbox footer from LITEAPI_MODE); one tri-state helper and every rate attribute through it; Phuket's five items group to ${PHUKET_EXPECTED.hotels} hotels · ${PHUKET_EXPECTED.rates} rates with the lowest-rate and difference lines verbatim; vendor-commit invents no check-in time and a stay draws its stated window or stays all-day, flagged; five filter controls that only write the filters and one counted search; the route forwards the vendor's contract by name; ${HOTEL_REPINNED.length} files re-pinned, dated, and ${Object.keys(HOTEL_BOOKING_FUNCTIONS).length} booking functions byte-identical to main.`);
else console.log(`✖ The hotel law FAILED — ${hotelViolations} violation(s).`);
});
lawGuard('The stay law', () => {

// ── THE STAY LAW (HOTEL-02, 2026-09-22) ──────────────────────────────────────
// THE STAY'S TIMES ARE THE PROPERTY'S, NOT OURS.
//
// HOTEL-01 removed vendor-commit's invented 15:00 / 11:00 and found the vendor
// states a property's check-in / check-out only in its per-hotel content (GET
// /data/hotel), never in the rates answer. Three invented lodging times remained
// (AddToTripButton's 22:00–07:00 prefill, the planner's dead lodging default, the
// timeline's edit that moved the block alone while the ledger kept its clock), and
// the checkout panel labelled the content rating "/10" while the client typed it 0-5.
//
//   1. NO LODGING TIME IS WRITTEN THAT THE VENDOR OR THE USER DID NOT STATE.
//      vendor-commit resolves a stay's clock ONCE — the property's, read at commit
//      for a stay that names its hotel, or the caller's stated one — and writes it
//      to both columns or null; no clock literal stands in the commit, the button
//      or the planner; the button has no time input and no prefill; the planner's
//      dead default is gone; the search sends no clock. Probed on the documented
//      content shape: a stated clock reads to HH:MM, silence reads null, words the
//      reader cannot read are refused — never nulled.
//   2. THE CONTENT CALL THAT SETS A STAY'S CLOCK FIRES ONLY FROM COMMIT, ONCE. The
//      commit makes exactly one getHotelContent call, guarded by the hotel id and a
//      lodging commit, after validation and the row check, preceded by exactly one
//      'hotelcontent' reservation, before the transaction; its failure is an explicit
//      502 / 503 with a fixed reason before the catch-all. The callers of the content
//      read under src are a CLOSED set: the content route (the checkout's read), the
//      discover detail page (one hotel opened — grandfathered, dated, reported: it
//      reserves no cap and swallows its failure) and the commit; no search route, no
//      results view, no planner list, no assistant reads it. "Once per booking" is a
//      code shape (one call site per commit POST), not a runtime dedupe — said so.
//   3. TIMELINE EDITS KEEP THE TWO TIMES EQUAL. The itinerary PATCH pairs every write
//      of block_start_time with homeTime and block_end_time with destTime, in the one
//      update; the two keys of one clock may not disagree; a flight row, which has no
//      block window, refuses the timeline's keys by name.
//   4. THE RATING SCALE IS ONE. The checkout panel renders the content rating on the
//      scale the client types (/5, never /10); the detail page holds no runtime guess
//      at that scale; the results view names the catalog's documented /10; no file
//      under src re-scales a content rating; the client's comments name what is and
//      is not verified.
//   5. THE PIN HOLDS, DATED. Five files re-dated by HOTEL-02 carry a dated note with
//      the hash they had on main 81045434; no other file carries one; the booking
//      functions stay body-for-body (the hotel law); BOOKING_FLOW_BASE records it.
const STAY_LEAF = 'src/lib/hotels/stayTimes.ts';
const STAY_PATCH = 'src/app/api/trips/[id]/itinerary/[itineraryId]/route.ts';
const STAY_BUTTON = 'src/app/budgets/trips/[id]/discover/[category]/[rank]/AddToTripButton.tsx';
const STAY_PLANNER = 'src/components/trips/TripPlannerAI.tsx';
const STAY_CHECKOUT = 'src/components/trips/CheckoutPanel.tsx';
const STAY_DETAIL = 'src/app/budgets/trips/[id]/discover/[category]/[rank]/page.tsx';
const STAY_CONTENT_ROUTE = 'src/app/api/travel/hotels/content/route.ts';
/** The closed set of content readers (dated 2026-09-22): the route the checkout fetches, the detail page (grandfathered), the commit. */
const STAY_CONTENT_CALLERS = [STAY_CONTENT_ROUTE, STAY_DETAIL, HOTEL_COMMIT];
const STAY_REDATED = [HOTEL_CONTAINER, HOTEL_VIEW, STAY_CHECKOUT, STAY_PLANNER, HOTEL_CLIENT];
let stayViolations = 0;
const stayFail = (m: string) => { stayViolations += 1; violations.push(`stay law: ${m} (HOTEL-02)`); };

// 1. no lodging time is written that the vendor or the user did not state.
{
  const commit = codeOf(HOTEL_COMMIT);
  for (const [f, src] of [[HOTEL_COMMIT, commit], [STAY_BUTTON, codeOf(STAY_BUTTON)], [STAY_PLANNER, codeOf(STAY_PLANNER)]] as const) {
    if (/'15:00'|'11:00'|'22:00'|'07:00'|'16:00'/.test(src)) stayFail(`${f} holds a lodging clock literal — a time nobody stated`);
  }
  if (!/const stayStart = propertyClock \? parseTimeOrNull\(propertyClock\.checkin, 'block_start_time'\) : blockStartParse;/.test(commit)) stayFail(`${HOTEL_COMMIT} does not resolve the stay's start from the property's clock or the caller's stated one`);
  if (!/const ledgerStart: string \| null = propertyClock \? propertyClock\.checkin : \(startTime \|\| null\);/.test(commit)) stayFail(`${HOTEL_COMMIT} does not write the ledger's clock from the same resolution`);
  if (!/if \(sentClock\(startTime\) \|\| sentClock\(endTime\)\) \{/.test(commit)) stayFail(`${HOTEL_COMMIT} accepts a caller's clock beside the hotel id — two sources for one stay`);
  const button = codeOf(STAY_BUTTON);
  if (/type="time"|windowStart|windowEnd|startTime|endTime/.test(button)) stayFail(`${STAY_BUTTON} still offers or sends a stay time — the property states it at commit`);
  if (!/\.\.\.\(liteapiHotelId \? \{ liteapiHotelId \} : \{\}\),/.test(button)) stayFail(`${STAY_BUTTON} does not name the vendor's hotel on commit`);
  const planner = codeOf(STAY_PLANNER);
  if (/CATEGORY_DEFAULT_TIMES/.test(planner)) stayFail(`${STAY_PLANNER} still holds the dead lodging default`);
  if (!/catInfo\.optionType === 'lodging' && rec\.liteapiHotelId \? \{ liteapiHotelId: rec\.liteapiHotelId \} : \{\}/.test(planner)) stayFail(`${STAY_PLANNER} does not name the vendor's hotel on a lodging commit`);
  const stated = propertyClockOf({ checkin_start: '02:00 PM', checkout: '12:00 PM', checkin_end: '12:00 AM' });
  if (!('clock' in stated) || stated.clock.checkin !== '14:00' || stated.clock.checkout !== '12:00') stayFail(`a stated 02:00 PM / 12:00 PM read as ${JSON.stringify(stated)}`);
  const silent = propertyClockOf(undefined);
  if (!('clock' in silent) || silent.clock.checkin !== null || silent.clock.checkout !== null) stayFail(`a property that states no clock read as ${JSON.stringify(silent)} — a clock nobody stated`);
  const odd = propertyClockOf({ checkin_start: 'from 16h', checkout: '11:00 AM' });
  if (!('unreadable' in odd) || odd.unreadable !== 'the property stated a check-in time this reader cannot read: "from 16h"') stayFail(`words the reader cannot read were not refused by name — ${JSON.stringify(odd)}`);
  if (propertyClockStatement({ checkin: null, checkout: null }) !== 'check-in time not stated by the property; check-out time not stated by the property') stayFail('the statement does not name the property\'s silence');
  if (propertyClockStatement({ checkin: '14:00', checkout: '12:00' }) !== 'check-in 14:00 stated by the property; check-out 12:00 stated by the property') stayFail('the statement does not repeat the property\'s clock');
  if (hhmmOf('02:00 PM') !== '14:00') stayFail('hhmmOf no longer reads the vendor\'s 12-hour clock');
  if (!/PURE: no fetch, no env/.test(commentsOf(STAY_LEAF)) || /\bfetch\(|process\.env/.test(codeOf(STAY_LEAF))) stayFail(`${STAY_LEAF} is not pure`);
}

// 2. the content call that sets a stay's clock fires only from commit, once.
{
  const commit = codeOf(HOTEL_COMMIT);
  const calls = (commit.match(/getHotelContent\(/g) ?? []).length;
  if (calls !== 1) stayFail(`${HOTEL_COMMIT} calls getHotelContent ${calls} time(s) — one content call per commit`);
  const reserves = (commit.match(/reserveTravelSearch\('hotelcontent'\)/g) ?? []).length;
  if (reserves !== 1) stayFail(`${HOTEL_COMMIT} reserves the content cap ${reserves} time(s) — once, under the existing 'hotelcontent' cap`);
  if (!/if \(optionType === 'lodging' && liteapiHotelId\) \{/.test(commit)) stayFail(`${HOTEL_COMMIT} does not gate the content call on a lodging commit that names its hotel`);
  const rowCheckAt = commit.indexOf('if (!isSyntheticLodging) {\n        const row = await prisma.trip_lodging_options.findFirst');
  const reserveAt = commit.indexOf("reserveTravelSearch('hotelcontent')");
  const callAt = commit.indexOf('getHotelContent(liteapiHotelId)');
  const txAt = commit.indexOf('const result = await prisma.$transaction(');
  const validAt = commit.indexOf("if (!validTypes.includes(optionType))");
  if (!(validAt >= 0 && validAt < rowCheckAt && rowCheckAt < reserveAt && reserveAt < callAt && callAt < txAt)) stayFail(`${HOTEL_COMMIT}'s order is not validate → row check → reserve → call → transaction (${validAt}, ${rowCheckAt}, ${reserveAt}, ${callAt}, ${txAt})`);
  for (const branch of ['err instanceof TravelSearchQuotaError', 'err instanceof LiteApiError', 'err instanceof MissingLiteApiKeyError', "'unreadable' in read", 'if (!content) {']) {
    if (!commit.includes(branch)) stayFail(`${HOTEL_COMMIT} lacks the explicit failure branch ${branch} — the catch-all strips the reason`);
  }
  if (/err\.message/.test(commit.slice(callAt, txAt))) stayFail(`${HOTEL_COMMIT} quotes a thrown message to the browser — the reason is a fixed line (HYG-02)`);
  if (!/stayTimes: propertyClock \? \{ \.\.\.propertyClock, source: 'property', statement: propertyClockStatement\(propertyClock\) \} : null,/.test(commit)) stayFail(`${HOTEL_COMMIT} does not answer with the clock it stored`);
  const callers = staySrcFiles().filter((f) => f !== HOTEL_CLIENT && /getHotelContent\(/.test(codeOf(f))).sort();
  const expected = [...STAY_CONTENT_CALLERS].sort();
  if (JSON.stringify(callers) !== JSON.stringify(expected)) stayFail(`the content read's callers are ${JSON.stringify(callers)} — the closed set is ${JSON.stringify(expected)}`);
  const fetchers = staySrcFiles().filter((f) => /api\/travel\/hotels\/content/.test(codeOf(f)) && !/travelBookingFlow\.ts$|middleware\.ts$/.test(f)).sort();
  if (JSON.stringify(fetchers) !== JSON.stringify([STAY_CHECKOUT])) stayFail(`the content route is fetched by ${JSON.stringify(fetchers)} — only the checkout panel reads it from the browser`);
  for (const f of [HOTEL_ROUTE, HOTEL_VIEW, HOTEL_CONTAINER, 'src/app/api/trips/[id]/ai-assistant/route.ts']) {
    if (/getHotelContent\(|hotels\/content/.test(codeOf(f))) stayFail(`${f} reads the content — a search, a list or a view may not`);
  }
}

// 3. timeline edits keep the two times equal.
{
  const patch = codeOf(STAY_PATCH);
  if (!/data\.block_start_time = t\.block;[^\n]*\n\s+data\.homeTime = t\.str;/.test(patch)) stayFail(`${STAY_PATCH} writes block_start_time without homeTime on the timeline's key`);
  if (!/data\.block_end_time = t\.block;\n\s+data\.destTime = t\.str;/.test(patch)) stayFail(`${STAY_PATCH} writes block_end_time without destTime on the timeline's key`);
  const pairs: Array<[string, string]> = [['data.block_start_time =', 'data.homeTime ='], ['data.block_end_time =', 'data.destTime =']];
  for (const [a, b] of pairs) {
    const na = patch.split(a).length - 1, nb = patch.split(b).length - 1;
    if (na !== nb || na < 2) stayFail(`${STAY_PATCH} writes ${a} ${na} time(s) and ${b} ${nb} time(s) — one clock, two columns, always together`);
  }
  if (!/are one clock — they were sent with different values/.test(patch)) stayFail(`${STAY_PATCH} does not refuse two different clocks for one column`);
  if (!/existing\.vendorOptionType === 'flight' && \(body\.blockStartTime !== undefined \|\| body\.blockEndTime !== undefined\)/.test(patch)) stayFail(`${STAY_PATCH} lets the timeline write a block window onto a flight — a third clock`);
  if (!/prisma\.trip_itinerary\.update\(\{ where: \{ id: itineraryId \}, data \}\)/.test(patch)) stayFail(`${STAY_PATCH} does not write in the one update`);
  const timeline = codeOf('src/components/trips/TripTimelineView.tsx');
  if (!/blockStartTime: start \|\| null,\n\s+blockEndTime: end \|\| null,/.test(timeline) || !/patch\(\{ blockStartTime: null, blockEndTime: null \}\)/.test(timeline)) stayFail('the timeline\'s save and clear no longer send the timeline\'s keys (the route pairs them)');
}

// 4. the rating scale is one.
{
  const checkout = codeOf(STAY_CHECKOUT);
  if (!/\{content\.rating\}<\/span>\/5/.test(checkout)) stayFail(`${STAY_CHECKOUT} does not render the content rating on the client's typed scale (/5)`);
  if (/\{content\.rating\}<\/span>\/10/.test(checkout)) stayFail(`${STAY_CHECKOUT} renders the content rating /10 — a second scale for one number`);
  const detail = codeOf(STAY_DETAIL);
  if (/content\.rating <= 5|content\.rating \* |enrichedScore/.test(detail)) stayFail(`${STAY_DETAIL} guesses the content rating's scale at runtime`);
  if (!/\$\{card\.guestRating\}\/10/.test(codeOf(HOTEL_VIEW))) stayFail(`${HOTEL_VIEW} renders the catalog's guest rating without its documented scale (/10)`);
  const clientNotes = commentsOf(HOTEL_CLIENT);
  if (!/0-5 in observed responses/.test(clientNotes) || !/Not verified by a captured payload/.test(clientNotes)) stayFail(`${HOTEL_CLIENT} no longer names the content rating's observed scale and that no captured payload verifies it`);
  if (!/documented out of 10/.test(clientNotes)) stayFail(`${HOTEL_CLIENT} no longer names the catalog rating's documented scale`);
  for (const f of staySrcFiles()) {
    if (/content\.rating\s*[*/]|content\.rating <= 5/.test(codeOf(f))) stayFail(`${f} re-scales a content rating`);
  }
}

// 5. the pin holds, dated.
{
  const notes = commentsOf('src/lib/travelBookingFlow.ts');
  const pins = codeOf('src/lib/travelBookingFlow.ts');
  const count = (notes.match(/HOTEL-02 \(2026-09-22\): re-dated/g) ?? []).length;
  if (count !== STAY_REDATED.length) stayFail(`src/lib/travelBookingFlow.ts carries ${count} HOTEL-02 note(s) — ${STAY_REDATED.length}: the two hotel surfaces, the checkout panel, the planner and the client`);
  for (const f of STAY_REDATED) {
    const pinAt = pins.indexOf(`{ file: '${f}', sha256: '`);
    if (pinAt < 0) { stayFail(`src/lib/travelBookingFlow.ts no longer pins ${f}`); continue; }
    const pinLine = pins.slice(0, pinAt).split('\n').length;
    const above = noteBlockOver(pins, notes, pinLine);
    // TRAVEL-ROW-01 (2026-09-23): the $ anchor is gone, for the reason the hotel law states
    // over its own check — a LATER ruling's dated note may stack below this one, directly
    // over the pin. HOTEL-02's note and its "Was" line must still stand consecutive in the
    // block; they simply need not be the last lines of it.
    if (!/HOTEL-02 \(2026-09-22\): re-dated — [^\n]+\. The stay's clock is the property's, read once at commit; no prebook\/book\/pay\/cancel call changed\.\n[^\n]*Was [0-9a-f]{64} at main 81045434\./.test(above)) stayFail(`${f}'s pin does not sit under a dated HOTEL-02 note naming why and the hash it had on main 81045434`);
  }
  for (const pin of BOOKING_FLOW_FILES) {
    if (STAY_REDATED.includes(pin.file)) continue;
    const pinAt = pins.indexOf(`{ file: '${pin.file}', sha256: '`);
    const pinLine = pins.slice(0, pinAt).split('\n').length;
    if (/HOTEL-02/.test(noteBlockOver(pins, notes, pinLine))) stayFail(`${pin.file} carries a HOTEL-02 note — HOTEL-02 re-dated ${STAY_REDATED.length} files and nothing else`);
  }
  if (!/re-dated by HOTEL-02 \(2026-09-22\), the stay's clock is the property's/.test(BOOKING_FLOW_BASE)) stayFail('BOOKING_FLOW_BASE does not record the HOTEL-02 re-dating');
  if (BOOKING_FLOW_FILES.some((p) => p.file === HOTEL_COMMIT)) stayFail(`${HOTEL_COMMIT} is pinned — it is the itinerary writer, not the booking flow (TRAVEL-01)`);
}
if (stayViolations === 0) console.log(`✔ The stay law passed — the commit resolves a stay's clock once (the property's, read at commit, or the caller's stated one) and writes it to both columns or null; no clock literal in the commit, the button or the planner; the content read's callers are the closed set of ${STAY_CONTENT_CALLERS.length} (the route, the detail page, the commit) with one call and one reservation per commit and explicit 502 / 503 reasons; the itinerary PATCH pairs every block write with the ledger's clock and refuses a flight's; the content rating renders /5 and the catalog's /10, nothing re-scales; ${STAY_REDATED.length} files re-dated, dated.`);
else console.log(`✖ The stay law FAILED — ${stayViolations} violation(s).`);
});
lawGuard('The activity law', () => {

// ── THE ACTIVITY LAW (ACTIVITY-01, 2026-09-22) ──────────────────────────────
// ONE ACTIVITY, WHAT THE OPERATOR STATES; A TOUR TAKES ITS TIME ON THE DAY.
//
// The Things-to-do tab forwarded nothing to the vendor (sort DEFAULT, count 12
// fixed), and the client normalized the answer with `|| 0` and `|| null` — a 0
// price collapsed to "Price on request", an unrated product became a 0 rating and
// was then DROPPED by a hidden rating×log re-sort, a Viator rating was typed
// googleRating, a variable duration was an empty cell, the flags, the currency
// and the extra charges were never read — and a "Book" that opened sign-up booked
// nothing. ACTIVITY-01 gives the tab the vendor's own contract, a pure leaf and a
// picker that states every attribute or the operator's silence.
//
//   1. THE ROUTE FORWARDS THE CONTRACT BY NAME. The query carries the vendor's
//      documented /products/search names (src/lib/activities/searchContract.ts);
//      an unknown name — `currency` among them — is a 400 naming it, a bad value a
//      400 naming it, an absent name is not sent so the vendor's default applies;
//      validation runs between the two guards; the currency is sent from ONE named
//      constant (no plan column carries a currency) and the answer names it; the
//      route makes ONE raw call, answers through the leaf, and never re-sorts,
//      drops an unrated product, or quotes the vendor's body.
//   2. ONE LEAF PER JOB, PURE, EVERY ATTRIBUTE THROUGH stated.ts. The products
//      leaf reads the captured Phuket answer whole: one product per row in the
//      vendor's order; price with its own currency and documented basis; extra
//      charges and the all-in figure stated beside the from-price, never
//      collapsed; duration fixed / variable / the operator's text / not stated;
//      a present flag is true and an absent one is the operator's silence — never
//      false; rating and review count with the sources named; the two unrated
//      products present and said so. No fetch, no env, no `|| 0`.
//   3. NO CLOCK LITERAL, NO DEFAULT, NO CONVERSION, NO "PRICE ON REQUEST", NO
//      googleRating, NO SIGN-UP BOOK on the activities path. The picker and the
//      container carry none of them; the container's one fetch fires only from the
//      SEARCH press, counted; a row links out on the validated productUrl or says
//      "no booking link stated by the operator"; the old results view (the
//      transfers rail's) has no onBook; the benchmark ranks on the all-in figure
//      where stated and says so; two currencies are never compared.
//   3b. SHOW THEM ALL (the founder's ruling, 2026-09-22). The vendor states a
//      totalCount; the screen reveals it page by page — the vendor's own `start`
//      cursor, validated by name (an integer ≥ 1), one more counted search per
//      "Next" press with the same filters; the count line derives from the vendor's
//      totalCount and the rows shown; no `.slice(` narrows the result set on the
//      route, the leaf, the container or the view.
//   4. THE SAVE READS THE PRODUCT, THE SCHEDULE AND THE VENDOR'S STATED RATE (the
//      STEP 4 ruling by tier, 2026-09-22: /availability/check answered 403 FORBIDDEN
//      "Endpoint access denied" — a Basic-access key; CHECK-01 replaces this path
//      when Full-access is granted). The three reads have ONE call site each — the
//      authed options route — behind getVerifiedEmail → the user → the query by
//      name → the per-user limit, each reserved once under 'viatorsave' (safe cap
//      300/day: three reservations per attempt, ~100 attempts, the prebook
//      precedent) immediately before the call; the route is not a public path; the
//      search route, the picker and the planner never call them. The rate is cached
//      per pair until ITS OWN expiry and never past it; an expired rate the vendor
//      hands back, or a rate it does not state, refuses by name; a schedule already
//      in the plan's currency skips the rate and says so. Probed on the captures:
//      the product's bands and zone, the schedule's start times with the vendor's
//      reason verbatim, the open-ended season's 384 days, the special price inside
//      both windows, the rate with its expiry.
//   5. THE FIGURE IS CALCULATED AND SAYS SO. Every converted figure carries the label
//      'calculated' with the native amount, the currency, the rate, its source, its
//      lastUpdated and its expiry; the note names them all; vendor-commit DERIVES the
//      total from the sealed quote (clause 7) and takes no figure from the caller,
//      admits a stated 0 only under the 'operator' marker with its option code, and
//      fixes the instant from the operator's stated zone alone. Reconciled: the
//      schedule's from-price × the rate = the search's 77.66; its extra charges × the
//      rate = 12.33, not the search's 12.03 — both facts, neither explained.
//   7. THE SERVER SEALS THE FIGURES IT READ (STEP 4b, 2026-09-22). STEP 4 let the
//      browser post the figures and could only check them against each other — the
//      band unit prices were never posted, so the native cost could not be recomputed
//      at all. Now the options route seals its own Viator read per bookable pick, key
//      = HMAC-SHA256(JWT_SECRET, 'temple-stuart/viator-quote/v1') — domain-separated
//      from the session cookie's HMAC(JWT_SECRET, email) and throwing when the secret
//      is absent — seal = HMAC-SHA256(key, the canonical JSON), verified with
//      crypto.timingSafeEqual. vendor-commit refuses the old `viatorSave` field BY
//      NAME, refuses an amount / note / clock sent beside a quote, verifies the seal,
//      refuses another account's quote and one read more than QUOTE_MAX_AGE_MINUTES
//      ago, and then DERIVES the price, the note, the start and the end from the
//      sealed quote alone. A variable duration takes the founder's end only inside the
//      operator's stated range; an empty pick draws a flagged marker and the note says
//      the range. The quote's leaves are pure, type a rate nowhere, and the container
//      posts the sealed pair, the party and that end — and nothing else.
//   6. THE PIN HOLDS, DATED. Six files re-dated by ACTIVITY-01 carry a dated note
//      with the hash they had on main dfc02881 and the options route is pinned new,
//      dated; no other file carries one; the transfers route's pin is unchanged;
//      every existing function of the Viator client is byte-identical to main (the
//      planner and the transfers rail keep their paths); BOOKING_FLOW_BASE records it.
const ACTIVITY_ROUTE = 'src/app/api/travel/activities/search/route.ts';
const ACTIVITY_CONTRACT = 'src/lib/activities/searchContract.ts';
const ACTIVITY_LEAF = 'src/lib/activities/products.ts';
const ACTIVITY_VIEW = 'src/components/trips/ActivityPickerView.tsx';
const ACTIVITY_CONTAINER = 'src/components/trips/PublicActivitySearch.tsx';
const ACTIVITY_OLD_VIEW = 'src/components/trips/ActivityResultsView.tsx';
const ACTIVITY_STRIP = 'src/components/trips/travelStripModes.tsx';
const ACTIVITY_CLIENT = 'src/lib/viatorClient.ts';
const ACTIVITY_TRANSFERS_ROUTE = 'src/app/api/travel/transfers/search/route.ts';
const ACTIVITY_OPTIONS_ROUTE = 'src/app/api/travel/activities/options/route.ts';
const ACTIVITY_COMMIT = 'src/app/api/trips/[id]/vendor-commit/route.ts';
const ACTIVITY_QUOTA = 'src/lib/travelSearchQuota.ts';
const ACTIVITY_PRODUCT_LEAF = 'src/lib/activities/product.ts';
const ACTIVITY_SCHEDULE_LEAF = 'src/lib/activities/schedule.ts';
const ACTIVITY_FX_LEAF = 'src/lib/activities/fx.ts';
const ACTIVITY_SAVE_LEAF = 'src/lib/activities/save.ts';
const ACTIVITY_QUOTE_LEAF = 'src/lib/activities/quote.ts';
/** The law's own clock for the captures — the read's as-of, stated once. */
const ACTIVITY_AS_OF = '2026-09-22T12:00:00.000Z';
/**
 * The law's OWN probe secrets — never the deployment secret, which this file does
 * not read and does not need. Two of them, because "a different secret derives a
 * different key" is what proves the derivation is a derivation rather than the
 * secret handed through.
 */
const ACTIVITY_PROBE_SECRET_A = 'activity-law-probe-secret-A-not-a-deployment-value';
const ACTIVITY_PROBE_SECRET_B = 'activity-law-probe-secret-B-not-a-deployment-value';
const ACTIVITY_SEAL_LEAF = 'src/lib/activities/quoteSeal.ts';
const ACTIVITY_PLANNER = 'src/components/trips/TripPlannerAI.tsx';
const ACTIVITY_REDATED = [ACTIVITY_ROUTE, ACTIVITY_STRIP, ACTIVITY_CONTAINER, ACTIVITY_OLD_VIEW, ACTIVITY_CLIENT, ACTIVITY_QUOTA];
const ACTIVITY_PINNED_NEW = [ACTIVITY_OPTIONS_ROUTE];
/** The Save's three reads: each has one call site under src — the options route. */
const ACTIVITY_SAVE_READS = ['getProductRaw(', 'getScheduleRaw(', 'fetchExchangeRatesRaw('];
/** The Viator client's existing functions, code half, signature to closing brace — the sha256 each had on main dfc02881. */
const ACTIVITY_CLIENT_FUNCTIONS: Record<string, string> = {
  'function getApiKey(': 'edec61c24b2b35bc5b970cbb46603620eb81fee3c02636ba8415a7194416e88d',
  'function v2Headers(': '803097811688e32c9cf35ff21fc447966fb0665ebd488314d243bf104fc7170d',
  'export async function findDestinationId(': '0e2992461214508567656d2754a1c46f89600c09a8a4bf4db899ca434e0e1666',
  'function normalizeV2Product(': 'b7a9cb9ad6574f185e383600fe4f1c8daff80524138cd5c8f7a6d6c26fc0d325',
  'async function searchV2Products(': 'f05125f023ce32de923ab30905c9f19af0e8f2f495a6dee0a3d7db13126046b4',
  'async function searchV2Freetext(': 'ce6a92acf3ca8172d76e26670864b02bfecbf53a31c0626ff7249f78ded693dc',
  'export async function searchViatorProducts(': '60e398e7f350b440fb13b68b11bf02e473100293ec9bf7704754270f331aca9f',
  'export async function searchViatorProductsByTags(': '3c94d0596fa8aa3082090609c9b7c881b3cd148980dc0839ce3738ae50bfbf09',
  'export function viatorProductToRecommendation(': '47c42632dd3d732072bfa8a4c6e5ce3c432d27db02021a57b35327cc730e2b24',
};
/** The captured Phuket answer's facts (Alex's probe, 2026-09-22): 50 of 1,915; the lowest ranks; the flags; the durations; the unrated. */
const PHUKET_ACTIVITY_EXPECTED = { cards: 50, total: 1915, lowest: '198310P2', lowestFigure: 21.57, fixed: 34, variable: 16, freeCancellation: 47, unrated: ['110534P1165', '103612P66'], extraCharges: 6 };
let activityViolations = 0;
const activityFail = (m: string) => { activityViolations += 1; violations.push(`activity law: ${m} (ACTIVITY-01)`); };
/** A function's text from its signature line to its closing brace at column 0 (code half). */
const functionSlice = (src: string, head: string): string | null => {
  const i = src.indexOf(head);
  if (i < 0) return null;
  const j = src.indexOf('\n}\n', i);
  return j < 0 ? null : src.slice(i, j + 3);
};
const activityResolvers = { validateUrl: (u: string) => validatedAffiliateUrl(u, 'viator'), destinationNameOf: cityForViatorDestId };

// 1. the route forwards the contract by name.
{
  const route = codeOf(ACTIVITY_ROUTE);
  const at = (s: string) => route.indexOf(s);
  const order = [at('await rateLimit('), at('if (!city || !country)'), at('parseActivityFilters([...params.keys()], (n) => params.get(n))'), at("await reserveTravelSearch('viator')"), at('searchProductsRaw(activitySearchBodyOf(String(destId), filters))'), at('activityCardsOf(raw as RawProductSearch, {')];
  if (order.some((i) => i < 0) || order.some((v, i) => i > 0 && v < order[i - 1])) activityFail(`${ACTIVITY_ROUTE}'s order is not rate limit → presence → the contract → reserve → the one call → the leaf (${order.join(', ')})`);
  if ((route.match(/searchProductsRaw\(/g) ?? []).length !== 1) activityFail(`${ACTIVITY_ROUTE} makes ${(route.match(/searchProductsRaw\(/g) ?? []).length} raw calls — one`);
  if (!/currency: ACTIVITY_SEARCH_CURRENCY,/.test(route)) activityFail(`${ACTIVITY_ROUTE} does not answer with the currency it sent, by its one name`);
  if (/searchViatorProducts\(|viatorProductToRecommendation|googleRating|\.sort\(|\.slice\(0|ACTIVITY_MAX_RESULTS/.test(route)) activityFail(`${ACTIVITY_ROUTE} still re-sorts, slices, maps through the old normalizer or types a Viator rating googleRating`);
  if (/error\.message|error\.body|err\.body/.test(route)) activityFail(`${ACTIVITY_ROUTE} quotes the vendor's body or a thrown message to the browser (HYG-02)`);
  if (!/error instanceof ViatorApiError/.test(route) || !/error instanceof MissingViatorKeyError/.test(route)) activityFail(`${ACTIVITY_ROUTE} lacks the explicit 502 branches — the catch-all strips the reason`);
  const q = (o: Record<string, string>) => parseActivityFilters(Object.keys(o), (n) => (n in o ? o[n] : null));
  for (const [name, o] of [['currency', { city: 'x', country: 'y', currency: 'THB' }], ['tags', { city: 'x', country: 'y', tags: '1' }], ['minRating', { city: 'x', country: 'y', minRating: '4' }]] as const) {
    const r = q(o as Record<string, string>);
    if (!('error' in r) || !r.error.startsWith(`${name} is not a supported search parameter`)) activityFail(`the contract admits or misnames "${name}" — ${JSON.stringify(r)}`);
  }
  for (const [o, re] of [[{ sort: 'DEFAULT', order: 'ASCENDING' }, /order may not be sent with sort DEFAULT/], [{ sort: 'TRAVELER_RATING', order: 'ASCENDING' }, /takes only order DESCENDING/], [{ count: '51' }, /^count must be/], [{ highestPrice: '0' }, /^highestPrice must be/], [{ flags: 'REFUNDABLE' }, /^flags must be/]] as const) {
    const r = q({ city: 'x', country: 'y', ...o });
    if (!('error' in r) || !re.test(r.error)) activityFail(`the contract does not refuse ${JSON.stringify(o)} by name — ${JSON.stringify(r)}`);
  }
  const bare = q({ city: 'Phuket', country: 'Thailand' });
  const body = 'filters' in bare ? activitySearchBodyOf('349', bare.filters) : null;
  if (JSON.stringify(body) !== JSON.stringify({ filtering: { destination: '349' }, currency: ACTIVITY_SEARCH_CURRENCY })) activityFail(`an empty screen sends ${JSON.stringify(body)} — the destination and the one currency, nothing else (the vendor's defaults)`);
  if (ACTIVITY_SEARCH_CURRENCY !== 'USD') activityFail(`the search currency constant is ${ACTIVITY_SEARCH_CURRENCY} — every plan amount is USD (the invariant)`);
  if (!/THE CURRENCY INVARIANT/.test(commentsOf(ACTIVITY_CONTRACT))) activityFail(`${ACTIVITY_CONTRACT} no longer states the currency invariant`);
  if (/\bfetch\(|process\.env|from '@\/lib\/viatorClient'/.test(codeOf(ACTIVITY_CONTRACT))) activityFail(`${ACTIVITY_CONTRACT} is not pure`);
  if (JSON.stringify(ACTIVITY_FILTER_PARAMS) !== JSON.stringify(['lowestPrice', 'highestPrice', 'ratingFrom', 'ratingTo', 'durationFrom', 'durationTo', 'flags', 'sort', 'order', 'count', 'start'])) activityFail(`the contract's names drifted: ${ACTIVITY_FILTER_PARAMS.join(', ')}`);
  const sent = activitySearchParamsOf({ ...DEFAULT_ACTIVITY_FILTERS, priceMin: '20', rating: '4', duration: 'over6h', freeCancellation: true, sort: 'PRICE', count: '25' });
  if (!('filters' in q({ city: 'x', country: 'y', ...sent }))) activityFail(`what the screen sends does not pass the route's contract: ${JSON.stringify(sent)}`);
  if (Object.keys(activitySearchParamsOf(DEFAULT_ACTIVITY_FILTERS)).length !== 0) activityFail('a screen at "any" sends a filter');
  // 3b. SHOW THEM ALL: the cursor by name, the count line from the vendor's total, no slice.
  if (!(ACTIVITY_FILTER_PARAMS as readonly string[]).includes('start')) activityFail("the contract does not carry the vendor's start cursor by name");
  for (const [o, ok] of [[{ start: '51' }, true], [{ start: '0' }, false], [{ start: '1.5' }, false], [{ start: 'two' }, false]] as const) {
    const r = q({ city: 'x', country: 'y', ...o });
    if (('filters' in r) !== ok) activityFail(`start ${JSON.stringify(o)} was ${ok ? 'refused' : 'admitted'} — an integer ≥ 1 by name`);
  }
  const page2 = q({ city: 'x', country: 'y', start: '51' });
  if (!('filters' in page2) || JSON.stringify(activitySearchBodyOf('349', page2.filters).pagination) !== JSON.stringify({ start: 51 })) activityFail('a start cursor is not forwarded as the vendor\'s pagination.start');
  if (!/start: filters\.start \?\? 1,/.test(route)) activityFail(`${ACTIVITY_ROUTE} does not name the page it answers`);
  for (const f of [ACTIVITY_ROUTE, ACTIVITY_LEAF, ACTIVITY_VIEW, ACTIVITY_CONTAINER]) {
    // A slice of the RESULT SET is the client cap SHOW THEM ALL forbids; a slice of a date string is not.
    if (/\b(cards|products|results|rows|displayed)\s*\.slice\(/.test(codeOf(f))) activityFail(`${f} slices the result set — no client cap; the vendor's pages reveal its total`);
  }
  const container = codeOf(ACTIVITY_CONTAINER);
  if (!/const page = await fetchPage\(sentFilters, cards\.length \+ 1\);/.test(container)) activityFail(`${ACTIVITY_CONTAINER}'s Next does not ask for the next page with the filters the pages were asked with`);
  if (!/const filtersChanged = sentFilters !== null && JSON\.stringify\(filters\) !== JSON\.stringify\(sentFilters\);/.test(container)) activityFail(`${ACTIVITY_CONTAINER} does not reset to page one on a filter change`);
  if (!/countLine\(cards, totalCount, previousTotal\)/.test(codeOf(ACTIVITY_VIEW))) activityFail(`${ACTIVITY_VIEW}'s count line does not derive from the vendor's totalCount`);
}

// 2. one leaf per job, pure, every attribute through stated.ts.
{
  const leaf = codeOf(ACTIVITY_LEAF);
  if (!/import \{ type Stated, stated, statedBoolean, statedNumber, statedString \} from '@\/lib\/travel\/stated';/.test(leaf)) activityFail(`${ACTIVITY_LEAF} does not read the one tri-state helper`);
  if (/\bfetch\(|process\.env|googleRating|\|\| 0\b|\|\| null\b/.test(leaf)) activityFail(`${ACTIVITY_LEAF} is not pure or coerces the vendor's silence`);
  if (!/PURE: no fetch, no env/.test(commentsOf(ACTIVITY_LEAF))) activityFail(`${ACTIVITY_LEAF} no longer declares itself pure`);
  // Every vendor field the card reads passes through the one helper on the line it is read — never a bare read, never `??`.
  const cardFn = functionSlice(leaf, 'export function activityCardOf(') ?? '';
  const VENDOR_FIELDS = /(?:\?\.|\.)(combinedAverageRating|totalReviews|averageRating|fromPrice|fromPriceBeforeDiscount|extraCharges|currency|confirmationType|itineraryType|containsMachineTranslatedText|productUrl|description|title|provider|totalCount)\b/;
  for (const line of cardFn.split('\n')) {
    if (VENDOR_FIELDS.test(line) && !/stated(Number|String|Boolean)\(/.test(line)) activityFail(`${ACTIVITY_LEAF} reads a vendor field outside the one helper: ${line.trim().slice(0, 90)}`);
  }
  const { cards, totalCount } = activityCardsOf(PHUKET_ACTIVITIES as RawProductSearch, activityResolvers);
  const E = PHUKET_ACTIVITY_EXPECTED;
  if (cards.length !== E.cards || totalCount !== E.total) activityFail(`the captured Phuket answer reads as ${cards.length} of ${totalCount} — ${E.cards} of ${E.total}`);
  if (activityCountLine(cards, totalCount) !== '1–50 of 1,915 stated by the vendor') activityFail(`the count line reads "${activityCountLine(cards, totalCount)}" — the rows shown against the vendor's total`);
  const first = cards[0];
  if (!first || first.productCode !== '27424P2' || first.price !== 77.66 || first.currency !== 'USD' || first.extraCharges !== 12.03 || first.allInPrice !== 89.69) activityFail(`27424P2 reads as ${JSON.stringify(first && { code: first.productCode, price: first.price, currency: first.currency, extra: first.extraCharges, allIn: first.allInPrice })} — from $77.66 USD, +$12.03 extra, $89.69 all-in`);
  if (cards.filter((c) => c.duration?.kind === 'fixed').length !== E.fixed || cards.filter((c) => c.duration?.kind === 'variable').length !== E.variable) activityFail('the durations do not read 34 fixed and 16 variable');
  if (cards.filter((c) => c.freeCancellation === true).length !== E.freeCancellation || cards.some((c) => c.freeCancellation === false)) activityFail(`free cancellation reads ${cards.filter((c) => c.freeCancellation === true).length} true and ${cards.filter((c) => c.freeCancellation === false).length} false — 47 true, an absent flag is silence, never false`);
  for (const code_ of E.unrated) {
    const c = cards.find((x) => x.productCode === code_);
    if (!c) { activityFail(`unrated ${code_} is missing — an unrated product is never dropped`); continue; }
    if (c.rating !== null || ratingText(c) !== `rating ${ACTIVITY_NOT_STATED}`) activityFail(`unrated ${code_} reads rating ${c.rating} — the operator's silence, never 0`);
  }
  if (cards.filter((c) => c.extraCharges !== null).length !== E.extraCharges) activityFail('the extra charges are not read on the six products that state them');
  if (cards.some((c) => c.productUrl === null)) activityFail('a captured productUrl failed the affiliate gate — every one carries our partner id');
  if (cards.some((c) => c.currency !== 'USD')) activityFail('a captured product is not priced in USD — the leaf must carry the answer\'s own currency');
  const zero = activityCardOf({ ...(PHUKET_ACTIVITIES as RawProductSearch).products![0], pricing: { summary: { fromPrice: 0 }, currency: 'USD' } }, 0, activityResolvers);
  if (zero.price !== 0 || zero.priceBasis === null) activityFail(`a stated 0 reads as ${zero.price} — a 0 is a price`);
  const silent = activityCardOf({ productCode: 'X', title: 'x' }, 0, activityResolvers);
  if (silent.price !== null || silent.freeCancellation !== null || silent.rating !== null || silent.duration !== null || cancellationText(silent) !== `cancellation policy ${ACTIVITY_NOT_STATED}`) activityFail('a product that states nothing does not read as the operator\'s silence');
}

// 3. no clock literal, no default, no conversion, no "Price on request", no googleRating, no sign-up Book.
{
  const view = codeOf(ACTIVITY_VIEW);
  const container = codeOf(ACTIVITY_CONTAINER);
  for (const [f, src] of [[ACTIVITY_VIEW, view], [ACTIVITY_CONTAINER, container], [ACTIVITY_LEAF, codeOf(ACTIVITY_LEAF)], [ACTIVITY_ROUTE, codeOf(ACTIVITY_ROUTE)]] as const) {
    if (/Price on request|googleRating/.test(src)) activityFail(`${f} still says "Price on request" or types a Viator rating googleRating`);
    if (/'09:00'|'17:00'|'10:00'|'15:00'|'11:00'/.test(src)) activityFail(`${f} holds a clock literal — a time nobody stated`);
    if (/Intl\.NumberFormat|toLocaleString\('en-US', \{ style: 'currency'/.test(src)) activityFail(`${f} re-formats a price through a currency formatter — a conversion in disguise`);
  }
  // The picker is pure: no auth callback, no Book. The container may open sign-in for the SAVE (STEP 4) — never for a Book, and never a search that fires without the press.
  if (/onRequireAuth|onBook/.test(view)) activityFail(`${ACTIVITY_VIEW} holds an auth callback or a Book — the picker is pure`);
  if (/onBook|useEffect|searchNonce/.test(container)) activityFail('the activities path still holds a sign-up Book or a search that fires without the SEARCH press');
  const searchFetches = container.split('fetch(' + '`' + '/api/travel/activities/search?').length - 1;
  if (searchFetches !== 1 || !/setSearchCount\(\(n\) => n \+ 1\);/.test(container) || !/\.\.\.activitySearchParamsOf\(asked\),/.test(container) || !/await fetchPage\(filters, 1\);/.test(container)) activityFail(`${ACTIVITY_CONTAINER} does not fire one counted search carrying the screen's filters (${searchFetches} search fetch(es))`);
  for (const must of ['Plan here; book on Viator.', 'no booking link stated by the operator', 'data-activity-llf', 'data-price-difference', 'cancellationText(card)', 'ratingText(card)', 'durationText(card.duration)', 'priceText(card)', 'extraChargesText(card)']) {
    if (!view.includes(must)) activityFail(`${ACTIVITY_VIEW} lacks ${must}`);
  }
  if (/onBook/.test(codeOf(ACTIVITY_OLD_VIEW))) activityFail(`${ACTIVITY_OLD_VIEW} still carries the sign-up Book`);
  if (!/<PublicActivitySearch\n\s+onRequireAuth=\{onRequireAuth\}\n\s+authed=\{authed\}\n\s+currentTrip=\{currentTrip\}\n\s+onCommitted=\{onCommitted\}/.test(codeOf(ACTIVITY_STRIP))) activityFail(`${ACTIVITY_STRIP} does not mount the Things-to-do search with the trip props the Save needs (authed, currentTrip, onCommitted) — or mounts it with props it does not take`);
  if (!/searchViatorProductsByTags\(/.test(codeOf(ACTIVITY_TRANSFERS_ROUTE))) activityFail(`${ACTIVITY_TRANSFERS_ROUTE} no longer keeps its own path`);
  const { cards } = activityCardsOf(PHUKET_ACTIVITIES as RawProductSearch, activityResolvers);
  const low = lowestPrice(cards);
  if (!low || low.card.productCode !== PHUKET_ACTIVITY_EXPECTED.lowest || low.figure !== PHUKET_ACTIVITY_EXPECTED.lowestFigure) activityFail(`the benchmark is ${low?.card.productCode} at ${low?.figure} — 198310P2 at $21.57`);
  const llf = lowestPriceLine(low);
  if (!llf || !/Ranked on the all-in figure where the operator states extra charges\.$/.test(llf)) activityFail(`the lowest line does not say what it ranks on: ${llf}`);
  const d = priceDifference(cards[0], low!.card);
  if (d.delta !== 68.12 || !/duration 9h vs 1h/.test(d.line) || !/private tour, skip the line — reason not stated by the operator/.test(d.line)) activityFail(`27424P2's difference reads "${d.line}" — +$68.12 on the all-in figure, from stated attributes, the unstated named`);
  const x = priceDifference({ ...cards[0], currency: 'THB' }, low!.card);
  if (x.delta !== null || !/no conversion, no comparison/.test(x.line)) activityFail(`two currencies were compared: "${x.line}"`);
}

// 4. the save reads the product, the schedule and the vendor's stated rate — one call site each, authed, reserved, cached by expiry.
{
  const route = codeOf(ACTIVITY_OPTIONS_ROUTE);
  const at = (s: string) => route.indexOf(s);
  const order = [at('await getVerifiedEmail()'), at('prisma.users.findFirst'), at('is not a supported parameter (supported: productCode, date)'), at('await rateLimit(`activity-options:${user.id}`'), at("await reserveTravelSearch('viatorsave');"), at('await getProductRaw(productCode)'), at('await getScheduleRaw(productCode)'), at('cachedExchangeRate(currency, ACTIVITY_SEARCH_CURRENCY, now)'), at('await fetchExchangeRatesRaw(currency, ACTIVITY_SEARCH_CURRENCY)'), at('rememberExchangeRate(read)')];
  if (order.some((i) => i < 0) || order.some((v, i) => i > 0 && v < order[i - 1])) activityFail(`${ACTIVITY_OPTIONS_ROUTE}'s order is not user → query by name → per-user limit → reserve → product → schedule → cache → rate → remember (${order.join(', ')})`);
  if ((route.match(/reserveTravelSearch\('viatorsave'\)/g) ?? []).length !== 3) activityFail(`${ACTIVITY_OPTIONS_ROUTE} reserves 'viatorsave' ${(route.match(/reserveTravelSearch\('viatorsave'\)/g) ?? []).length} time(s) — three, one before each read`);
  for (const call of ACTIVITY_SAVE_READS) {
    const re = new RegExp(call.replace('(', '\\('), 'g');
    if ((route.match(re) ?? []).length !== 1) activityFail(`${ACTIVITY_OPTIONS_ROUTE} calls ${call} ${(route.match(re) ?? []).length} time(s) — once`);
    const callers = staySrcFiles().filter((f) => f !== ACTIVITY_CLIENT && re.test(codeOf(f))).sort();
    if (JSON.stringify(callers) !== JSON.stringify([ACTIVITY_OPTIONS_ROUTE])) activityFail(`${call} is called from ${JSON.stringify(callers)} — one call site, the options route`);
  }
  for (const f of [ACTIVITY_ROUTE, ACTIVITY_VIEW, ACTIVITY_PLANNER, ACTIVITY_CONTAINER, ACTIVITY_LEAF, 'src/app/api/travel/transfers/search/route.ts']) {
    if (/availability\/schedules|exchange-rates|\/products\/\$\{/.test(codeOf(f))) activityFail(`${f} names one of the Save's endpoints — the search route, the picker and the planner never call them`);
  }
  if (codeOf('src/middleware.ts').includes("'/api/travel/activities/options'")) activityFail('the options route is a public path — the Save\'s reads are authed');
  if (!/if \(isExpired\(read, now\)\) return NextResponse\.json\(\{ error: `Viator's \$\{currency\}→\$\{ACTIVITY_SEARCH_CURRENCY\} rate had already expired at/.test(route)) activityFail(`${ACTIVITY_OPTIONS_ROUTE} does not refuse an expired rate the vendor hands back, by name`);
  if (!/if \(currency !== ACTIVITY_SEARCH_CURRENCY\) \{/.test(route)) activityFail(`${ACTIVITY_OPTIONS_ROUTE} reads a rate for a schedule already in the plan's currency`);
  if (/error\.message|error\.body|err\.body/.test(route)) activityFail(`${ACTIVITY_OPTIONS_ROUTE} quotes the vendor's body to the browser (HYG-02)`);
  const client = codeOf(ACTIVITY_CLIENT);
  if (!/const exchangeRateCache = new Map<string, RateRecord>\(\);/.test(client) || !/if \(isExpired\(hit, now\)\) \{ exchangeRateCache\.delete/.test(client)) activityFail(`${ACTIVITY_CLIENT}'s rate cache does not honour the vendor's expiry`);
  for (const f of [ACTIVITY_CLIENT, ACTIVITY_OPTIONS_ROUTE, ACTIVITY_FX_LEAF, ACTIVITY_SAVE_LEAF, ACTIVITY_SCHEDULE_LEAF, ACTIVITY_QUOTE_LEAF, ACTIVITY_CONTAINER, ACTIVITY_COMMIT]) {
    if (/rate:\s*[0-9]|0\.030818/.test(codeOf(f))) activityFail(`${f} types a rate`);
  }
  if (!/viatorsave: 300,/.test(codeOf(ACTIVITY_QUOTA))) activityFail(`${ACTIVITY_QUOTA} does not carry the 'viatorsave' safe cap of 300`);
  for (const f of [ACTIVITY_PRODUCT_LEAF, ACTIVITY_SCHEDULE_LEAF, ACTIVITY_FX_LEAF, ACTIVITY_SAVE_LEAF, ACTIVITY_QUOTE_LEAF]) {
    if (/\bfetch\(|process\.env/.test(codeOf(f)) || !/PURE: no fetch, no env/.test(commentsOf(f))) activityFail(`${f} is not pure`);
  }
  // Probed on the captures.
  const facts = productFactsOf(PHUKET_PRODUCT as unknown as RawProduct);
  if (facts.timeZone !== 'Asia/Bangkok' || facts.requiresAdultForBooking !== true || optionTitleOf(facts, 'TG14') !== 'Small Group Only 20 People' || facts.duration?.kind !== 'fixed' || facts.duration.minutes !== 540) activityFail('the captured product does not read as Asia/Bangkok, an adult required, TG14 "Small Group Only 20 People", 540 minutes');
  if (!('refused' in partyMeetsProduct(facts, { CHILD: 1 }))) activityFail('a party with no adult passes a product that requires one');
  const on = startTimesOn(PHUKET_SCHEDULE as unknown as RawSchedule, '2026-09-23', '2026-09-22T12:00:00Z');
  const tg29 = on.find((o) => o.productOptionCode === 'TG29'); const tg14 = on.find((o) => o.productOptionCode === 'TG14');
  if (!tg29 || tg29.startTimes[0]?.unavailable !== 'SOLD_OUT' || !tg14 || tg14.startTimes[0]?.startTime !== '07:30' || tg14.startTimes[0]?.unavailable !== null) activityFail('the captured schedule on 2026-09-23 does not read TG29 04:30 SOLD_OUT (verbatim) and TG14 07:30 available');
  if (startTimesOn(PHUKET_SCHEDULE as unknown as RawSchedule, '2027-10-12', '2026-09-22T12:00:00Z')[0].refused !== 'no season stated by the operator holds 2027-10-12') activityFail('an open-ended season holds past the docs\' 384 days');
  const details = (PHUKET_SCHEDULE as unknown as RawSchedule).bookableItems!.find((b) => b.productOptionCode === 'TG14')!.seasons![0].pricingRecords![0].pricingDetails!;
  const cost = partyCost(details, { ADULT: 2 }, '2026-09-23', '2026-09-22T12:00:00Z', 'THB');
  if ('refused' in cost || cost.total !== 7020 || cost.lines[0].basis !== 'special') activityFail(`two adults on TG14 price as ${JSON.stringify(cost)} — 7,020 THB at the special price inside both windows`);
  const later = partyCost(details, { ADULT: 2 }, '2026-09-23', '2026-10-05T00:00:00Z', 'THB');
  if ('refused' in later || later.total !== 7800 || later.lines[0].basis !== 'original') activityFail('a read after the offer window still takes the special price');
  if (!('refused' in partyCost([{ ...details[0], pricingPackageType: 'PER_GROUP' }], { ADULT: 1 }, '2026-09-23', '2026-09-22T12:00:00Z', 'THB'))) activityFail('an unknown pricing package type was priced');
  const rate = rateOf(THB_USD as unknown as RawExchangeRates, 'THB', 'USD');
  if ('refused' in rate) { activityFail(`the captured rate does not read: ${rate.refused}`); }
  else {
    const fromPrice = convert({ amount: 2520, currency: 'THB' }, rate, new Date('2026-09-22T12:00:00Z'));
    if ('refused' in fromPrice || fromPrice.amount !== 77.66 || fromPrice.label !== CALCULATED) activityFail(`2,520 THB at the captured rate reads ${JSON.stringify(fromPrice)} — 77.66, labelled calculated`);
    const extra = convert({ amount: 400, currency: 'THB' }, rate, new Date('2026-09-22T12:00:00Z'));
    if ('refused' in extra || extra.amount !== 12.33) activityFail(`400 THB at the captured rate reads ${JSON.stringify(extra)} — 12.33 (the search's 12.03 is a different figure; both stand)`);
    if (!isExpired(rate, new Date('2026-09-23T01:09:59Z')) || isExpired(rate, new Date('2026-09-22T12:00:00Z'))) activityFail('the rate\'s expiry is not honoured to the second');
    if (!('refused' in convert({ amount: 1, currency: 'USD' }, rate, new Date('2026-09-22T12:00:00Z')))) activityFail('a rate was applied to the wrong currency');
  }
}

// 5. the figure is calculated and says so; the commit recomputes; a stated 0 is a price; the instant is the operator's zone.
{
  const commit = codeOf(ACTIVITY_COMMIT);
  if (!/const operatorStated = priceStatedByInput === 'operator' && viatorSave !== null;/.test(commit) || !/if \(!Number\.isFinite\(amt\) \|\| amt < 0 \|\| \(amt === 0 && !operatorStated\)\) \{/.test(commit)) activityFail(`${ACTIVITY_COMMIT} does not admit a stated 0 under the 'operator' marker alone`);
  if (!/Google places have no price/.test(commit) || !/a 0 is accepted only as a price the operator stated/.test(commit)) activityFail(`${ACTIVITY_COMMIT}'s amount guard does not name both cases`);
  if (!/const derived = saveFromQuote\(read, partyInput as Record<string, number>, endTimeChosenInput, ACTIVITY_SEARCH_CURRENCY, now\);/.test(commit) || !/viatorNote = activitySaveNoteOf\(derived\);/.test(commit)) activityFail(`${ACTIVITY_COMMIT} does not derive the line and its note from the sealed quote`);
  if (!/const activityZone = viatorSave\?\.timeZone \?\? null;/.test(commit) || !/start_zone: activityZone,\n\s+end_zone: activityZone,\n\s+start_at: activityZone \? startAt : null,\n\s+end_at: activityZone \? endAt : null,/.test(commit)) activityFail(`${ACTIVITY_COMMIT} does not fix the instant from the operator's stated zone alone`);
  if (/'Asia\/|'America\/|'Europe\//.test(commit)) activityFail(`${ACTIVITY_COMMIT} types a zone`);
  if (!/optionId\.startsWith\('viator-'\)/.test(commit)) activityFail(`${ACTIVITY_COMMIT} cannot uncommit a tour`);
  if (!/title: viatorSave \? viatorSave\.title : \(notes \|\|/.test(commit)) activityFail(`${ACTIVITY_COMMIT} titles a tour's line from its note — the operator's own title names it`);
  if (!/the line's title column holds 255; nothing was saved/.test(commit)) activityFail(`${ACTIVITY_COMMIT} does not refuse a title longer than the column — a truncation would drop what the operator stated`);
  const container = codeOf(ACTIVITY_CONTAINER);
  const optionReads = container.split('fetch(' + '`' + '/api/travel/activities/options?').length - 1;
  if (optionReads !== 1) activityFail(`${ACTIVITY_CONTAINER} reads the options ${optionReads} time(s) — once, at the press`);
  if (!/if \(authed !== true\) \{ onRequireAuth\(\); return; \}/.test(container)) activityFail(`${ACTIVITY_CONTAINER} reads the schedule for a guest`);
  if (!/priceStatedBy: 'operator',/.test(container) || !/viatorQuote: chosen\.quote,/.test(container) || !/viatorSeal: chosen\.seal,/.test(container)) activityFail(`${ACTIVITY_CONTAINER}'s Save does not carry the marker and the sealed pair`);
  if (!/initial\[b\.ageBand\] = b\.minTravelersPerBooking \?\? 0;/.test(container)) activityFail(`${ACTIVITY_CONTAINER}'s party form is not the operator's bands at their stated minimum`);
  if (!/const end = endOfQuote\(chosen\.quote, endPick\);/.test(container) || !/return priceQuote\(quote, party, answer\.targetCurrency, new Date\(\)\);/.test(container)) activityFail(`${ACTIVITY_CONTAINER} prices or ends a tour outside the sealed quote's own leaf`);
  if (/'09:00'|'17:00'|'0[0-9]:[0-9]{2}'|'1[0-9]:[0-9]{2}'/.test(container) || /'0[0-9]:[0-9]{2}'|'1[0-9]:[0-9]{2}'|'2[0-3]:[0-9]{2}'/.test(codeOf(ACTIVITY_SAVE_LEAF))) activityFail('a clock literal stands on the Save path');
  for (const f of [ACTIVITY_CONTAINER, ACTIVITY_VIEW, ACTIVITY_SAVE_LEAF, ACTIVITY_FX_LEAF, ACTIVITY_COMMIT]) {
    if (/Intl\.NumberFormat\([^)]*currency/.test(codeOf(f))) activityFail(`${f} re-formats a converted figure through a currency formatter`);
  }
  if (!/label: CALCULATED,/.test(codeOf(ACTIVITY_FX_LEAF)) || !/\$\{calc\.label\}/.test(codeOf(ACTIVITY_FX_LEAF))) activityFail(`${ACTIVITY_FX_LEAF} does not label a converted figure calculated in the line it writes`);
  if (!/<span data-activity-option-total=\{priced\.total\.amount\}>\{conversionText\(\{ native: priced\.native, extra: priced\.extra, rate: st\.quote\?\.rate \?\? null, total: priced\.total \}\)\}<\/span>/.test(container)) activityFail(`${ACTIVITY_CONTAINER} shows a plan figure without its conversion line`);
  // Probed on the captures: the sealed quote the route would issue, and the line it derives.
  const facts = productFactsOf(PHUKET_PRODUCT as unknown as RawProduct);
  const onDate = startTimesOn(PHUKET_SCHEDULE as unknown as RawSchedule, '2026-09-23', ACTIVITY_AS_OF);
  const rate5 = rateOf(THB_USD as unknown as RawExchangeRates, 'THB', 'USD');
  const extraPer = extraChargesFor(PHUKET_SCHEDULE as unknown as RawSchedule, 1);
  if (!('refused' in rate5) && extraPer !== null) {
    const now = new Date(ACTIVITY_AS_OF);
    const quoteOf = (code_: string): ViatorQuote | null => quotesForOption('u-law', facts, onDate.find((o) => o.productOptionCode === code_)!, '2026-09-23', 'THB', extraPer.perTraveller, rate5, ACTIVITY_AS_OF)[0]?.quote ?? null;
    const q = quoteOf('TG14');
    if (q === null) activityFail('the captured TG14 option issues no quote');
    else {
      const band = q.bands.find((b) => b.ageBand === 'ADULT');
      // The sealed band carries the price that applied, why it applied, AND the operator's own limits —
      // the per-price minimum/maximum from the pricing record and the per-booking pair from the product.
      if (!band || band.unitPrice !== 3510 || band.basis !== 'special' || band.offerEndDate !== '2026-09-30' || band.travelEndDate !== '2026-10-15') activityFail(`the sealed ADULT band reads ${JSON.stringify(band)} — 3,510 THB, the special, with the windows that made it apply`);
      if (!band || band.min !== 1 || band.max !== null || band.minPerBooking !== 1 || band.maxPerBooking !== 28) activityFail(`the sealed ADULT band's limits read min ${band?.min} max ${band?.max} perBooking ${band?.minPerBooking}–${band?.maxPerBooking} — the operator states 1 for this price, none above it, and 1–28 per booking`);
      const priced = priceQuote(q, { ADULT: 2 }, 'USD', now);
      if ('refused' in priced || priced.total.amount !== 241 || priced.total.label !== CALCULATED) activityFail(`two adults on the sealed TG14 quote read ${JSON.stringify(priced)} — USD 241.00, calculated`);
      const save = saveFromQuote(q, { ADULT: 2 }, undefined, 'USD', now);
      if ('refused' in save) activityFail(`the honest Save is refused: ${save.refused}`);
      else {
        if (save.endTime !== '16:30') activityFail(`07:30 + the stated 540 minutes reads ${save.endTime}`);
        const note = activitySaveNoteOf(save);
        if (!/× 0\.0308188425 \(Viator rate as of 2026-09-21T23:59:59Z, expires 2026-09-23T01:09:59Z\) = USD 241\.00 · calculated · cancellation: STANDARD/.test(note)) activityFail(`the note does not name the rate, its dates and the calculated figure: ${note}`);
        if (endTimeOf('07:30', { kind: 'fixed', minutes: 540 }) !== '16:30') activityFail('the fixed end no longer follows from the stated duration');
        if (!('refused' in totalOf({ native: { amount: 1, currency: 'THB' }, extra: null, rate: null }, 'USD', now))) activityFail('a native figure in another currency converts with no rate');
      }
      // The seal, probed under the LAW'S OWN key: canonical, verified in constant
      // time, every changed byte refused — and a different secret derives a
      // different key, which is what proves the derivation.
      const probeA = quoteKeyFrom(ACTIVITY_PROBE_SECRET_A);
      const probeB = quoteKeyFrom(ACTIVITY_PROBE_SECRET_B);
      const seal = sealWith(probeA, q);
      if (!/^[0-9a-f]{64}$/.test(seal) || !sealHoldsWith(probeA, q, seal)) activityFail('the quote does not seal and verify');
      if (sealWith(probeB, q) === seal || sealHoldsWith(probeB, q, seal)) activityFail('a different secret derives the same quote key — the seal is not keyed');
      if (probeA.equals(Buffer.from(ACTIVITY_PROBE_SECRET_A))) activityFail('the quote key is the secret itself, not a derivation over the domain');
      if (probeA.length !== 32) activityFail(`the quote key is ${probeA.length} bytes — HMAC-SHA256 gives 32`);
      if (canonicalJson({ b: 1, a: [2, { d: 3, c: 4 }] }) !== '{"a":[2,{"c":4,"d":3}],"b":1}') activityFail('the sealed form is not canonical (sorted keys, no whitespace)');
      if (sealWith(probeA, JSON.parse(JSON.stringify(Object.fromEntries(Object.entries(q).reverse())))) !== seal) activityFail('a quote seals differently when its keys arrive in another order');
      for (const tampered of [{ ...q, bands: q.bands.map((b) => ({ ...b, unitPrice: 1 })) }, { ...q, rate: { ...q.rate!, rate: 1 } }, { ...q, timeZone: 'Europe/London' }, { ...q, userId: 'someone-else' }, { ...q, asOf: new Date(Date.parse(q.asOf) + 1000).toISOString() }]) {
        if (sealHoldsWith(probeA, tampered, seal)) activityFail('a changed quote still carries the old seal');
      }
      for (const bad of [undefined, null, '', 'not-hex', seal.slice(0, 63), seal.toUpperCase()]) if (sealHoldsWith(probeA, q, bad)) activityFail(`a seal of the wrong shape verified: ${String(bad)}`);
      if (canonicalJson(readViatorQuote(JSON.parse(JSON.stringify(q)))) !== canonicalJson(q)) activityFail('the commit does not read back the quote it sealed');
      if (!('refused' in readViatorQuote({ ...JSON.parse(JSON.stringify(q)), v: 2 }))) activityFail('a quote of another version was read');
      // The party and the clock are checked against the SEALED limits.
      if (!('refused' in saveFromQuote(q, { CHILD: 1 }, undefined, 'USD', now))) activityFail('a party with no adult passed the sealed rules');
      if (!('refused' in saveFromQuote(q, { ADULT: 29 }, undefined, 'USD', now))) activityFail('a party past the sealed maximum passed');
      if (!('refused' in saveFromQuote(q, { ADULT: 2 }, undefined, 'USD', new Date('2026-09-24T00:00:00Z')))) activityFail('an expired rate passed the derivation');
      const soldOut = quoteOf('TG29');
      if (soldOut === null || soldOut.unavailable !== 'SOLD_OUT' || !('refused' in saveFromQuote(soldOut, { ADULT: 2 }, undefined, 'USD', now))) activityFail('a start time the operator states as SOLD_OUT was saved');
      if (Math.round(quoteAgeMinutes(q, new Date(Date.parse(q.asOf) + QUOTE_MAX_AGE_MINUTES * 60000 + 60000))) !== QUOTE_MAX_AGE_MINUTES + 1) activityFail('the quote\'s age is not measured from its own read');
      // A variable duration: the end sits inside the operator's stated range, or none is drawn.
      const variable: ViatorQuote = { ...q, duration: { kind: 'variable', fromMinutes: 420, toMinutes: 480 } };
      if (JSON.stringify(endOfQuote(variable, '15:00')) !== JSON.stringify({ endTime: '15:00', flagged: false })) activityFail('an end inside the stated range was refused');
      if (!('refused' in endOfQuote(variable, '16:00'))) activityFail('an end outside the operator\'s stated range was accepted');
      if (!('refused' in endOfQuote(q, '15:00'))) activityFail('an end was chosen where the operator states a fixed duration');
      const loose = saveFromQuote(variable, { ADULT: 2 }, undefined, 'USD', now);
      if ('refused' in loose || loose.endTime !== null || !/7h–8h \(variable, stated by the operator\) · no end chosen/.test(activitySaveNoteOf(loose))) activityFail('a variable tour with no end does not draw a flagged marker naming the range');
    }
  }
}

// 7. the server seals what it read; the commit takes no figure from the caller.
{
  const seal = codeOf(ACTIVITY_SEAL_LEAF);
  if (!/const secret = process\.env\.JWT_SECRET;\n\s+if \(!secret\) throw new Error\('JWT_SECRET environment variable is required to seal a Viator quote'\);/.test(seal)) activityFail(`${ACTIVITY_SEAL_LEAF} does not fail closed when JWT_SECRET is absent`);
  if (!/return crypto\.createHmac\('sha256', secret\)\.update\(QUOTE_SEAL_DOMAIN\)\.digest\(\);/.test(seal)) activityFail(`${ACTIVITY_SEAL_LEAF}'s key is not HMAC-SHA256(the secret, the domain) — an undomained key is the session cookie's`);
  if (!/return quoteKeyFrom\(secret\);/.test(seal)) activityFail(`${ACTIVITY_SEAL_LEAF}'s deployment key is not the same derivation the probes use`);
  if (QUOTE_SEAL_DOMAIN !== 'temple-stuart/viator-quote/v1') activityFail(`the quote's domain reads ${QUOTE_SEAL_DOMAIN} — the pinned domain is 'temple-stuart/viator-quote/v1'`);
  if (!/return crypto\.timingSafeEqual\(expected, given\);/.test(seal) || !/if \(expected\.length !== given\.length\) return false;/.test(seal)) activityFail(`${ACTIVITY_SEAL_LEAF} does not compare seals in constant time over equal-length buffers`);
  if (!/if \(typeof seal !== 'string' \|\| !\/\^\[0-9a-f\]\{64\}\$\/\.test\(seal\)\) return false;/.test(seal)) activityFail(`${ACTIVITY_SEAL_LEAF} lets a seal of the wrong shape reach the comparison`);
  // The seal is made in ONE place (the options route) and checked in ONE place (the commit);
  // the key-taking pair is for a test or a law, and is called from no production file.
  for (const [fn, callers] of [['sealOf(', [ACTIVITY_OPTIONS_ROUTE]], ['sealHolds(', [ACTIVITY_COMMIT]], ['sealWith(', []], ['sealHoldsWith(', []], ['quoteKeyFrom(', []]] as Array<[string, string[]]>) {
    const found = staySrcFiles().filter((f) => f !== ACTIVITY_SEAL_LEAF && codeOf(f).includes(fn)).sort();
    if (JSON.stringify(found) !== JSON.stringify(callers)) activityFail(`${fn} is called from ${JSON.stringify(found)} — one place, ${JSON.stringify(callers)}`);
  }
  // ACTIVITY-01 STEP 4c: NO LAW READS A CREDENTIAL. The suite must run, and pass,
  // in an environment that holds no deployment secret at all — `npm run build`
  // runs the laws before it builds anything.
  const lawSource = codeOf('scripts/assert-tool-registry.ts');
  if (/process\.env\.JWT_SECRET|process\.env\[/.test(lawSource)) activityFail('the law reads a deployment secret — the seal probes derive under a probe key of the law\'s own');
  if (/\bsealOf\(|\bsealHolds\(/.test(lawSource.replace(/'[^']*'/g, "''"))) activityFail('the law calls the deployment-keyed seal — the probes use sealWith / sealHoldsWith');
  const route = codeOf(ACTIVITY_OPTIONS_ROUTE);
  if (!/seal: row\.quote === null \? null : sealOf\(row\.quote\)/.test(route)) activityFail(`${ACTIVITY_OPTIONS_ROUTE} hands out a quote it did not seal`);
  if (!/quotesForOption\(user\.id, product, option, date, currency, extraPerTraveller\?\.perTraveller \?\? null, rate, asOf\)/.test(route)) activityFail(`${ACTIVITY_OPTIONS_ROUTE} does not seal the quote to the signed-in user and its own read`);
  if (/pricingDetails/.test(route)) activityFail(`${ACTIVITY_OPTIONS_ROUTE} hands the raw pricing records to the browser — the sealed unit price is what leaves`);
  const commit = codeOf(ACTIVITY_COMMIT);
  if (!/if \(viatorSaveInput !== undefined\) \{/.test(commit) || !/viatorSave is no longer accepted/.test(commit)) activityFail(`${ACTIVITY_COMMIT} does not refuse the posted-figures shape by name`);
  if (/readViatorSave|verifyViatorSave/.test(commit)) activityFail(`${ACTIVITY_COMMIT} still reads figures the browser posted`);
  if (!/if \(requestAmountInput !== undefined \|\| notesInput !== undefined \|\| sentClock\(startTimeInput\) \|\| sentClock\(endTimeInput\)\) \{/.test(commit)) activityFail(`${ACTIVITY_COMMIT} lets an amount, a note or a clock ride along with a quote`);
  const order7 = ['if (!sealHolds(viatorQuoteInput, viatorSealInput)) {', 'const read = readViatorQuote(viatorQuoteInput);', 'if (read.userId !== user.id) {', 'const age = quoteAgeMinutes(read, now);', 'if (age > QUOTE_MAX_AGE_MINUTES)', 'const derived = saveFromQuote('].map((n) => commit.indexOf(n));
  if (order7.some((i) => i < 0) || order7.some((v, i) => i > 0 && v < order7[i - 1])) activityFail(`${ACTIVITY_COMMIT}'s order is not seal → read → whose → how old → derive (${order7.join(', ')})`);
  if (!/const startTime = viatorSave \? \(viatorSave\.startTime \?\? undefined\) : startTimeInput;/.test(commit) || !/const requestAmount = viatorSave \? viatorSave\.total\.amount : requestAmountInput;/.test(commit) || !/const notes = viatorNote \?\? notesInput;/.test(commit)) activityFail(`${ACTIVITY_COMMIT} writes a figure, a note or a clock the caller sent`);
  // The browser posts the sealed pair, the party and the chosen end — and no figure.
  const container = codeOf(ACTIVITY_CONTAINER);
  const bodyAt = container.indexOf('body: JSON.stringify({', container.indexOf('/vendor-commit'));
  const postBody = bodyAt < 0 ? '' : container.slice(bodyAt, container.indexOf('}),', bodyAt));
  if (postBody === '' || /amount:|notes:|startTime:|endTime:|viatorSave:/.test(postBody)) activityFail(`${ACTIVITY_CONTAINER} states a figure, a note or a clock to the commit`);
  if (!/party,/.test(postBody) || !/endTimeChosen: endPick \|\| undefined,/.test(postBody)) activityFail(`${ACTIVITY_CONTAINER} does not post the party and the end it picked`);
}

// 6. the pin holds, dated.
{
  const notes = commentsOf('src/lib/travelBookingFlow.ts');
  const pins = codeOf('src/lib/travelBookingFlow.ts');
  const count = (notes.match(/ACTIVITY-01 \(2026-09-22\): re-dated/g) ?? []).length;
  if (count !== ACTIVITY_REDATED.length) activityFail(`src/lib/travelBookingFlow.ts carries ${count} ACTIVITY-01 re-dated note(s) — ${ACTIVITY_REDATED.length}: the search route, the strip, the container, the transfers-only results view, the client and the quota`);
  const pinnedNew = (notes.match(/ACTIVITY-01 \(2026-09-22\): pinned — /g) ?? []).length;
  if (pinnedNew !== ACTIVITY_PINNED_NEW.length) activityFail(`src/lib/travelBookingFlow.ts carries ${pinnedNew} ACTIVITY-01 pinned note(s) — ${ACTIVITY_PINNED_NEW.length}: the options route`);
  for (const f of ACTIVITY_PINNED_NEW) {
    const pinAt = pins.indexOf(`{ file: '${f}', sha256: '`);
    if (pinAt < 0) { activityFail(`src/lib/travelBookingFlow.ts does not pin ${f}`); continue; }
    const pinLine = pins.slice(0, pinAt).split('\n').length;
    if (!/ACTIVITY-01 \(2026-09-22\): pinned — [^\n]+\. A tour takes its time on the day; no prebook\/book\/pay\/cancel call changed\./.test(noteBlockOver(pins, notes, pinLine))) activityFail(`${f}'s pin does not sit under a dated ACTIVITY-01 note naming why`);
  }
  for (const f of ACTIVITY_REDATED) {
    const pinAt = pins.indexOf(`{ file: '${f}', sha256: '`);
    if (pinAt < 0) { activityFail(`src/lib/travelBookingFlow.ts no longer pins ${f}`); continue; }
    const pinLine = pins.slice(0, pinAt).split('\n').length;
    const above = noteBlockOver(pins, notes, pinLine);
    // TRAVEL-ROW-01 (2026-09-23): unanchored, as the hotel law's is and for the same stated
    // reason — a later ruling's dated note may stack below this one, directly over the pin.
    if (!/ACTIVITY-01 \(2026-09-22\): re-dated — [^\n]+\. A tour takes its time on the day; no prebook\/book\/pay\/cancel call changed\.\n[^\n]*Was [0-9a-f]{64} at main dfc02881\./.test(above)) activityFail(`${f}'s pin does not sit under a dated ACTIVITY-01 note naming why and the hash it had on main dfc02881`);
  }
  for (const pin of BOOKING_FLOW_FILES) {
    if (ACTIVITY_REDATED.includes(pin.file) || ACTIVITY_PINNED_NEW.includes(pin.file)) continue;
    const pinAt = pins.indexOf(`{ file: '${pin.file}', sha256: '`);
    const pinLine = pins.slice(0, pinAt).split('\n').length;
    if (/ACTIVITY-01/.test(noteBlockOver(pins, notes, pinLine))) activityFail(`${pin.file} carries an ACTIVITY-01 note — ACTIVITY-01 re-dated ${ACTIVITY_REDATED.length} files, pinned ${ACTIVITY_PINNED_NEW.length}, and nothing else`);
  }
  const transfersPin = BOOKING_FLOW_FILES.find((p) => p.file === ACTIVITY_TRANSFERS_ROUTE);
  if (!transfersPin || transfersPin.sha256 !== 'b55f3bd99f64b07f64d078063f3b408028f2531eae69ddbd82f939687ff2a66e') activityFail(`${ACTIVITY_TRANSFERS_ROUTE}'s pin changed — ACTIVITY-01 does not touch the transfers route`);
  if (!/re-dated and the options route pinned by ACTIVITY-01 \(2026-09-22\), a tour takes its time on the day/.test(BOOKING_FLOW_BASE)) activityFail('BOOKING_FLOW_BASE does not record the ACTIVITY-01 re-dating and the options route\'s pin');
  const client = codeOf(ACTIVITY_CLIENT);
  for (const [head, sha] of Object.entries(ACTIVITY_CLIENT_FUNCTIONS)) {
    const slice = functionSlice(client, head);
    const now = slice === null ? null : createHash('sha256').update(slice, 'utf8').digest('hex');
    if (now !== sha) activityFail(`${ACTIVITY_CLIENT}'s ${head.replace(/^export |^async |^function |^async function /g, '').replace('(', '')} is not byte-identical to main dfc02881 — ACTIVITY-01 adds one raw call and changes no existing function`);
  }
  if (!/export async function searchProductsRaw\(body: ProductSearchBody\): Promise<unknown> \{/.test(client)) activityFail(`${ACTIVITY_CLIENT} lacks the one raw call the route uses`);
}
if (activityViolations === 0) console.log(`✔ The activity law passed — the route forwards the vendor's /products/search contract by name between its guards (unknown → 400, currency the one constant, the start cursor for SHOW THEM ALL) and makes one raw call; the leaf reads the captured Phuket answer whole (${PHUKET_ACTIVITY_EXPECTED.cards} of ${PHUKET_ACTIVITY_EXPECTED.total}, ${PHUKET_ACTIVITY_EXPECTED.extraCharges} with extra charges, ${PHUKET_ACTIVITY_EXPECTED.unrated.length} unrated and present) tri-state; no "Price on request", no googleRating, no sign-up Book, no slice; the benchmark ranks on the all-in figure and says so; the Save's ${ACTIVITY_SAVE_READS.length} reads have one authed call site each under 'viatorsave' (300/day), the rate cached to its own expiry, every converted figure labelled calculated, a stated 0 admitted under the marker, the instant from the operator's zone; the route SEALS what it read (HMAC-SHA256 under a key derived from JWT_SECRET, '${QUOTE_SEAL_DOMAIN}', verified in constant time) and the commit takes no figure, note or clock from the caller — the old viatorSave field refused by name, another account's quote refused, one read over ${QUOTE_MAX_AGE_MINUTES} minutes ago refused, a variable end bounded by the stated range; ${ACTIVITY_REDATED.length} files re-dated and ${ACTIVITY_PINNED_NEW.length} pinned, dated, ${Object.keys(ACTIVITY_CLIENT_FUNCTIONS).length} client functions byte-identical to main.`);
else console.log(`✖ The activity law FAILED — ${activityViolations} violation(s).`);
});
// ─── THE LOCKFILE LAW (LOCK-02, 2026-09-23) ─────────────────────────────────
// THE LOCKFILE AND package.json AGREE, OR THE BUILD STOPS.
//
// LOCK-01 synced a package-lock.json that had been out of step since PIPE-01
// (8358dc28, 2026-09-10) dropped the Grok rail from package.json and left the
// lockfile still carrying xai-sdk. Nothing caught it for two weeks. The drift
// surfaced only because an unrelated PR happened to run `npm install`, which
// pruned the orphan and dragged seven lines of churn into that PR — where it had
// to be reverted so the PR carried only its own change.
//
// The lockfile's ROOT package entry, `packages[""]`, is a mirror of what
// package.json declares. While the two disagree, every install silently rewrites
// the lockfile, so the next PR carries a change nobody asked for and a reviewer
// cannot tell the sync from the intent. That is the class this closes.
//
// It reads TWO FILES and nothing else — package.json and package-lock.json,
// through the one reader. code() returns both byte-for-byte: JSON carries no
// comments, and a `//` inside a double-quoted registry URL is string content to
// splitSource, not a comment. NO install, NO network, NO node_modules, NO
// registry: a name or a range that differs is arithmetic over two files already
// in the repo, and it costs milliseconds.
lawGuard('The lockfile law', () => {
  /** The blocks package.json declares and the lockfile's root entry mirrors. */
  const LOCK_BLOCKS = ['dependencies', 'devDependencies', 'optionalDependencies'] as const;
  // npm rewrites the whole file when the format moves, so the version this repo is
  // on is PINNED here rather than read back from the file it is meant to judge.
  const LOCKFILE_VERSION = 3;
  let lockViolations = 0;
  const lockFail = (m: string) => { lockViolations += 1; violations.push(`lockfile law: ${m} (LOCK-02)`); };

  /** One of the two files, parsed. A file that does not parse is a NAMED failure, never a throw. */
  const readJson = (file: string): Record<string, unknown> => {
    let parsed: unknown;
    try { parsed = JSON.parse(codeOf(file)); } catch (error) {
      lockFail(`${file} does not parse as JSON: ${error instanceof Error ? error.message : String(error)}`);
      return {};
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) { lockFail(`${file} is not a JSON object`); return {}; }
    return parsed as Record<string, unknown>;
  };
  /** A block as a name → range map, or a named failure when it is something else. */
  const blockOf = (holder: Record<string, unknown>, block: string, where: string): Record<string, string> => {
    const raw = holder[block];
    if (raw === undefined) return {};
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) { lockFail(`${where} carries a ${block} that is not an object`); return {}; }
    const out: Record<string, string> = {};
    for (const [name, range] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof range !== 'string') { lockFail(`${where} states ${block}.${name} as ${typeof range}, not a version range`); continue; }
      out[name] = range;
    }
    return out;
  };

  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');
  const packages = lock.packages;
  const root = (typeof packages === 'object' && packages !== null && !Array.isArray(packages))
    ? (packages as Record<string, unknown>)['']
    : undefined;
  const counted: string[] = [];
  if (typeof root !== 'object' || root === null || Array.isArray(root)) {
    lockFail('package-lock.json has no root package entry ("" in packages) — that entry is the mirror this law reads');
  } else {
    for (const block of LOCK_BLOCKS) {
      const declared = blockOf(pkg, block, 'package.json');
      const mirrored = blockOf(root as Record<string, unknown>, block, 'package-lock.json\'s root entry');
      counted.push(`${Object.keys(declared).length} ${block}`);
      // package.json → the lockfile: a dependency added without an install.
      for (const [name, range] of Object.entries(declared)) {
        if (!(name in mirrored)) lockFail(`package.json declares ${block} "${name}": "${range}" and package-lock.json's root entry does not carry it — run npm install and commit the lockfile`);
        else if (mirrored[name] !== range) lockFail(`"${name}" is "${range}" in package.json's ${block} and "${mirrored[name]}" in package-lock.json's root entry — one range, both files`);
      }
      // The lockfile → package.json: a dependency removed from package.json alone (PIPE-01's xai-sdk).
      for (const [name, range] of Object.entries(mirrored)) {
        if (!(name in declared)) lockFail(`package-lock.json's root entry carries ${block} "${name}": "${range}" and package.json does not declare it — a dependency removed from package.json alone leaves the lockfile holding it, and the next install prunes it into an unrelated PR`);
      }
    }
  }
  if (lock.lockfileVersion !== LOCKFILE_VERSION) lockFail(`package-lock.json states lockfileVersion ${JSON.stringify(lock.lockfileVersion)} — this repo is on ${LOCKFILE_VERSION}, and npm rewrites the whole file when that moves`);

  if (lockViolations === 0) console.log(`✔ The lockfile law passed — package-lock.json's root entry mirrors package.json exactly (${counted.join(' · ')}), name for name and range for range in both directions, at lockfileVersion ${LOCKFILE_VERSION}; two files read, no install, no network, no node_modules.`);
  else console.log(`✖ The lockfile law FAILED — ${lockViolations} violation(s).`);
});

// ── THE CHECKOUT LAW (CHECKOUT-01, 2026-09-23) ──────────────────────────────
// A CHECKOUT THAT FAILS SAYS WHAT HAPPENED.
//
// WHAT THIS CLOSES. The founder searched Phuket on production, picked a rate, pressed
// Book, and the pane came up with nothing to pay with. The cause is not ours alone —
// LiteAPI's hosted payment SDK swallows EVERY failure in two empty catch blocks
// (liteAPIPayment.js handlePayment and liteAPIPaymentStripe.js handlePayment, both
// read from the vendor's shipped bytes on 2026-09-23) — so handlePayment() resolves
// having drawn nothing, and no throw ever reaches our try/catch. But the panel then
// made it worse: it had TWO silent `return`s in the SDK effect, one loose `error`
// string that the script's onError overwrote with a vaguer reason than the prebook
// had already given, and it printed "Enter your card to pay" and "Loading the secure
// payment form…" UNDERNEATH "Could not load the payment form" — three claims at once
// and no card field.
//
// THE RULE: every path out of this panel renders either a payment form or a STATED
// reason. Never a blank pane, never two answers at once.
lawGuard('The checkout law', () => {
  let checkoutViolations = 0;
  const checkoutFail = (m: string) => { checkoutViolations += 1; violations.push(`checkout law: ${m} (CHECKOUT-01)`); };

  const PANEL = 'src/components/trips/CheckoutPanel.tsx';
  const panel = codeOf(PANEL);

  // 1. NO SILENT BRANCH. Every `return` inside the SDK effect either starts the form
  //    or states why it cannot. The effect is bounded by its own dependency array.
  const effectStart = panel.indexOf('if (started || phase !== \'pay\'');
  if (effectStart < 0) checkoutFail(`${PANEL} no longer has the SDK-init guard — the effect that opens the card form`);
  else {
    const effectEnd = panel.indexOf('payment.handlePayment();', effectStart);
    if (effectEnd < 0) checkoutFail(`${PANEL} no longer calls handlePayment() — the card form is never requested`);
    else {
      const body = panel.slice(effectStart, effectEnd);
      // The FIRST guard is the not-ready-yet one: phase, prebook, paymentEnv, sdkReady
      // and the attach choice are states this effect legitimately waits on, and the
      // render says which. Every guard AFTER it is a real dead end and must speak.
      // Walk the body by POSITION — several `return;` lines are textually identical,
      // so each one is judged by what precedes IT, not by the first match of its text.
      const lines = body.split('\n');
      let at = 0;
      for (let i = 0; i < lines.length; i += 1) {
        const lineStart = at;
        at += lines[i].length + 1;
        if (i === 0) continue; // the wait-on-state guard; the render says which state
        const t = lines[i].trim();
        if (!/\breturn;/.test(t)) continue;
        // A one-line `if (…) return;` cannot have stated anything, and the previous
        // branch's fail() sitting above it is not its reason. It must be a block.
        if (/^if\s*\(.*\)\s*return;$/.test(t)) {
          checkoutFail(`${PANEL}'s SDK effect has the one-line guard "${t}" — a branch that gives up must open a block and say why; this exact shape is what left the founder a blank pane`);
          continue;
        }
        const preceding = body.slice(Math.max(0, lineStart - 400), lineStart);
        if (!/fail\(\{/.test(preceding)) checkoutFail(`${PANEL}'s SDK effect returns at line ${i} of the effect without saying why — a dead end that renders nothing is the blank pane this law closes`);
      }
    }
  }

  // 2. THE FAILURE IS NAMED, and the first reason wins. One loose string let the
  //    script's onError overwrite the prebook's own, specific reason.
  if (/const \[error, setError\]/.test(panel)) checkoutFail(`${PANEL} holds a loose \`error\` string again — a named failure carries its kind, and a later vaguer reason must not displace a specific one`);
  for (const kind of ['missing_key', 'prebook', 'sdk_script', 'form_absent']) {
    if (!panel.includes(`'${kind}'`)) checkoutFail(`${PANEL} names no "${kind}" failure — every way this panel can fail to take a card is named`);
  }
  if (!/setFailureState\(\(cur\) => cur \?\? next\)/.test(panel)) checkoutFail(`${PANEL}'s fail() does not keep the FIRST reason — the CDN's onError fires late and would bury the prebook's own`);

  // 3. THE WATCHDOG. The vendor cannot report a failure, so the panel watches the DOM
  //    and says so when no form arrives. Without this the blank pane is invisible.
  if (!panel.includes('FORM_DEADLINE_MS')) checkoutFail(`${PANEL} has no deadline for the vendor's form — handlePayment() resolves whether or not it drew anything, so the DOM is the only signal`);
  if (!/new MutationObserver/.test(panel)) checkoutFail(`${PANEL} does not watch its payment target — a form that never arrives must be noticed, not waited on forever`);
  if (!/kind: 'form_absent'/.test(panel)) checkoutFail(`${PANEL} never raises form_absent — the watchdog must end in a stated reason`);

  // 4. A PANEL THAT CANNOT TAKE A CARD DOES NOT ASK FOR ONE.
  const ask = panel.indexOf('Enter your card to pay');
  if (ask < 0) checkoutFail(`${PANEL} no longer asks for a card at all`);
  else {
    const before = panel.slice(Math.max(0, ask - 600), ask);
    if (!/\{!failure && \(/.test(before)) checkoutFail(`${PANEL} asks for a card without first ruling out a failure — it printed "Enter your card to pay" under "Could not load the payment form", which is the defect`);
  }
  if (!/data-checkout-failure=\{failure\.kind\}/.test(panel)) checkoutFail(`${PANEL}'s stated failure does not carry its kind on the element — the walk and a reader name the branch by it`);

  // 4b. CHECKOUT-03: THE PANEL WAITS ON STRIPE.JS, AND SAYS SO IF IT NEVER COMES.
  //     The vendor needs window.Stripe and will hang forever rather than report
  //     its absence, so the hand-off is gated on a real readiness signal — never a
  //     retry, never a poll that gives up quietly.
  if (!panel.includes('STRIPE_JS_SRC')) checkoutFail(`${PANEL} does not load Stripe.js itself — the vendor's loader hangs silently on a failed pre-existing tag, so the prerequisite is ours to satisfy`);
  if (!/!sdkReady \|\| !stripeJsReady/.test(panel)) checkoutFail(`${PANEL} does not wait for Stripe.js before handing off to the vendor — window.Stripe is the vendor's unstated prerequisite`);
  {
    // Scoped to THIS <Script>'s own closing tag, never a character count: a shorter
    // handler would slide the next <Script>'s onError into a fixed window and the
    // clause would pass on a panel that had stopped naming anything.
    const at = panel.indexOf('STRIPE_JS_SRC}');
    const end = at > 0 ? panel.indexOf('/>', at) : -1;
    const block = at > 0 && end > at ? panel.slice(at, end) : '';
    if (!block) checkoutFail(`${PANEL} has no Stripe.js <Script> element to read — CHECKOUT-03 loads it here`);
    else if (!/onError=\{\(\) => fail\(/.test(block)) checkoutFail(`${PANEL} loads Stripe.js without naming the failure when it cannot load — a script that never arrives must be stated, not waited on`);
  }
  for (const banned of ['setTimeout(() => setStripeJsReady', 'setInterval', 'retryStripe']) {
    if (panel.includes(banned)) checkoutFail(`${PANEL} polls or retries for Stripe.js (${banned}) — readiness is awaited on a real signal, and its absence is named`);
  }

  // 5. THE VENDOR'S BODY NEVER REACHES THE SCREEN. Every detail line is fixed,
  //    first-party text.
  for (const m of panel.matchAll(/detail: ([^\n]+)/g)) {
    const val = m[1].trim();
    if (!/^['"`]/.test(val) && !val.startsWith('`No LiteAPI')) checkoutFail(`${PANEL} builds a failure detail from ${val.slice(0, 60)} — the detail line is fixed first-party text, never the vendor's body`);
  }

  if (checkoutViolations === 0) console.log(`✔ The checkout law passed — the hotel checkout has no silent branch: 4 named failures (missing_key · prebook · sdk_script · form_absent), the first reason kept against a late overwrite, a ${'FORM_DEADLINE_MS'} watchdog on the vendor's own target because its SDK swallows every error in two empty catches, and no card asked for beside a stated failure; Stripe.js is loaded here and waited on, because the vendor hangs rather than report its absence.`);
  else console.log(`✖ The checkout law FAILED — ${checkoutViolations} violation(s).`);
});

// ── THE FLIGHT PAYMENT-RAIL LAW (FL-4c, 2026-09-23) ─────────────────────────
// THE FLIGHTS CHECKOUT TAKES A CARD THE WAY THE VENDOR DOCUMENTS IT.
//
// WHAT THIS CLOSES. LiteAPI documents ONE way to take a card (docs.liteapi.travel/
// docs/user-payment): load their payment wrapper, hand it
// { publicKey, appearance, targetElement, secretKey, returnUrl } and call
// handlePayment(). `publicKey` is the ENVIRONMENT — their words, "the environment
// you are using, and must match your API key's environment" — the literal 'live' or
// 'sandbox'. The wrapper resolves that label to a real Stripe publishable key
// itself, through its own /config.
//
// The flights panel did not use that rail. It mounted raw @stripe/react-stripe-js
// Elements on `prebook.publishableKey` and THREW when that came back null. But the
// flights reference documents publishableKey as `string, nullable: true` — "Stripe
// publishable key (null if not applicable)". The panel was reporting the documented
// shape as a failure, and a customer could never type a card.
//
// FL-4c proved the wrapper fits this lane before rebuilding it: one real production
// flight prebook (a hold; no card, nothing charged) whose clientSecret Stripe
// resolved against the pk_live_ the wrapper's /config returns for this account —
// HTTP 200, livemode true, the prebook's own amount. Same Stripe account as hotels.
//
// THE RULE: the flights panel hands the vendor an ENVIRONMENT LABEL and a secretKey
// and lets the wrapper draw the form. It reads no publishable key, mounts no Stripe
// of its own, and keeps CHECKOUT-01's named failures and CHECKOUT-03's Stripe.js
// gate. The rail redirects, so the redirect must land on a page that finishes the
// booking.
lawGuard('The flight payment-rail law', () => {
  let railViolations = 0;
  const railFail = (m: string) => { railViolations += 1; violations.push(`flight payment-rail law: ${m} (FL-4c)`); };

  const FPANEL = 'src/components/trips/LiteApiFlightCheckoutPanel.tsx';
  const FCONFIRM = 'src/app/booking/flight-confirm/page.tsx';
  const fpanel = codeOf(FPANEL);
  const fconfirm = codeOf(FCONFIRM);

  // 1. THE VENDOR'S WRAPPER IS THE RAIL — not a hand-rolled Stripe mount.
  if (!fpanel.includes('payment-wrapper.liteapi.travel/dist/liteAPIPayment.js')) railFail(`${FPANEL} does not load the vendor payment wrapper — the documented rail is the wrapper, not a Stripe mount of our own`);
  if (!/new window\.LiteAPIPayment\(\{/.test(fpanel)) railFail(`${FPANEL} never constructs the vendor wrapper`);
  if (!/payment\.handlePayment\(\);/.test(fpanel)) railFail(`${FPANEL} never calls handlePayment() — the card form is never requested`);
  if (!/secretKey: prebook\.secretKey/.test(fpanel)) railFail(`${FPANEL} does not hand the wrapper the prebook secretKey`);
  if (!/targetElement: `#\$\{PAYMENT_TARGET_ID\}`/.test(fpanel)) railFail(`${FPANEL} does not give the wrapper our own target element`);
  for (const banned of ['@stripe/react-stripe-js', '@stripe/stripe-js', 'loadStripe', '<Elements', '<PaymentElement', 'useStripe(', 'useElements(', 'confirmPayment(']) {
    if (fpanel.includes(banned)) railFail(`${FPANEL} still hand-rolls the card form (${banned}) — the wrapper is the documented rail and the only one this app drives`);
  }

  // 2. publicKey IS THE ENVIRONMENT LABEL, FROM THE SERVER — never a key, never a
  //    guess. An environment we cannot name is a stated dead end, not a default.
  if (!/publicKey: paymentEnv,/.test(fpanel)) railFail(`${FPANEL} does not pass the environment label as publicKey — publicKey is the environment, not a Stripe key`);
  if (!/data\?\.paymentEnv === 'string'/.test(fpanel)) railFail(`${FPANEL} does not read the environment label from the prebook response — the server derives it (liteApiPaymentEnv), the browser never guesses`);
  if (!/env !== 'live' && env !== 'sandbox'/.test(fpanel)) railFail(`${FPANEL} does not check the environment label against the two the vendor documents`);
  for (const banned of ['pk_live_', 'pk_test_', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'process.env', "setPaymentEnv('live')", "setPaymentEnv('sandbox')", "paymentEnv = 'live'", "paymentEnv = 'sandbox'"]) {
    if (fpanel.includes(banned)) railFail(`${FPANEL} carries ${banned} — the label comes from the server or the checkout stops; there is no key here and no default`);
  }

  // 3. THE DOCUMENTED NULL IS NOT A FAILURE. The field is nullable by the vendor's
  //    own reference, so the panel does not read it at all — in code. (Comments are
  //    blanked by codeOf, so the header may explain it.)
  if (fpanel.includes('publishableKey')) railFail(`${FPANEL} reads publishableKey again — the vendor documents it "null if not applicable", so a null is the shape, never a fault; the wrapper resolves the key`);

  // 4. CHECKOUT-01'S DISCIPLINE, CARRIED ONTO THIS LANE.
  for (const kind of ['payment_env', 'prebook', 'sdk_script', 'form_absent']) {
    if (!fpanel.includes(`'${kind}'`)) railFail(`${FPANEL} names no "${kind}" failure — every way this panel can fail to take a card is named`);
  }
  if (/const \[error, setError\]/.test(fpanel)) railFail(`${FPANEL} holds a loose \`error\` string — a named failure carries its kind, and a later vaguer reason must not displace a specific one`);
  if (!/setFailureState\(\(cur\) => cur \?\? next\)/.test(fpanel)) railFail(`${FPANEL}'s fail() does not keep the FIRST reason — the CDN onError fires late and would bury the prebook own`);
  if (!fpanel.includes('FORM_DEADLINE_MS')) railFail(`${FPANEL} has no deadline for the vendor form — handlePayment() resolves whether or not it drew anything, so the DOM is the only signal`);
  if (!/new MutationObserver/.test(fpanel)) railFail(`${FPANEL} does not watch its payment target — the vendor SDK swallows every error in two empty catches`);
  if (!/data-flight-checkout-failure=\{failure\.kind\}/.test(fpanel)) railFail(`${FPANEL} stated failure does not carry its kind on the element — the walk and a reader name the branch by it`);
  {
    const ask = fpanel.indexOf('Enter your card to pay');
    if (ask < 0) railFail(`${FPANEL} no longer asks for a card at all`);
    else {
      const before = fpanel.slice(Math.max(0, ask - 400), ask);
      if (!/&& !failure && \(/.test(before)) railFail(`${FPANEL} asks for a card without first ruling out a failure — a panel that cannot take a card does not ask for one`);
    }
  }
  // Every detail line is fixed, first-party text — never the vendor body.
  for (const m of fpanel.matchAll(/detail: ([^\n]+)/g)) {
    const val = m[1].trim();
    if (!/^['"`]/.test(val)) railFail(`${FPANEL} builds a failure detail from ${val.slice(0, 60)} — the detail line is fixed first-party text`);
  }

  // 5. CHECKOUT-03'S GATE, CARRIED. This panel is where the stale js.stripe.com tag
  //    came from; it now loads the same src through next/script and waits on it.
  if (!fpanel.includes('STRIPE_JS_SRC')) railFail(`${FPANEL} does not load Stripe.js itself — the vendor loader hangs silently on a failed pre-existing tag`);
  if (!/!sdkReady \|\| !stripeJsReady/.test(fpanel)) railFail(`${FPANEL} does not wait for Stripe.js before handing off to the vendor — window.Stripe is the vendor unstated prerequisite`);
  {
    // Scoped to THIS <Script> own closing tag, never a character count: a shorter
    // handler would slide the next <Script> onError into a fixed window.
    const at = fpanel.indexOf('STRIPE_JS_SRC}');
    const end = at > 0 ? fpanel.indexOf('/>', at) : -1;
    const block = at > 0 && end > at ? fpanel.slice(at, end) : '';
    if (!block) railFail(`${FPANEL} has no Stripe.js <Script> element to read`);
    else if (!/onError=\{\(\) => fail\(/.test(block)) railFail(`${FPANEL} loads Stripe.js without naming the failure when it cannot load`);
  }
  for (const banned of ['setTimeout(() => setStripeJsReady', 'setInterval', 'retryStripe']) {
    if (fpanel.includes(banned)) railFail(`${FPANEL} polls or retries for Stripe.js (${banned}) — readiness is awaited on a real signal, and its absence is named`);
  }

  // 6. THE RAIL REDIRECTS, SO THE REDIRECT LANDS SOMEWHERE THAT FINISHES THE JOB.
  //    The wrapper ends with Stripe confirmPayment and a redirect to returnUrl. A
  //    paid customer must not land on the hotel page, or on a public path they are
  //    bounced off.
  if (!/\/booking\/flight-confirm\?\$\{q\.toString\(\)\}/.test(fpanel)) railFail(`${FPANEL} returnUrl does not land on /booking/flight-confirm — the documented rail redirects, and a paid flight customer must land where the booking is finished`);
  // SEC-03 (2026-09-25): the link carries IDS ONLY — the contact email that rode
  // it under FL-5b is stored at prebook and read by the book route (the
  // privacy-and-money law below owns that rule; this clause reads the rail).
  for (const key of ['prebookId: prebook.prebookId', 'transactionId: prebook.transactionId']) {
    if (!fpanel.includes(key)) railFail(`${FPANEL} returnUrl does not carry ${key} — the confirm page finishes the booking from what the link carries and invents nothing`);
  }
  if (!fconfirm.includes("'/api/travel/liteapi/flights/book'")) railFail(`${FCONFIRM} does not complete the booking through the existing flights book route`);
  if (!/body: JSON\.stringify\(\{ prebookId, transactionId, \.\.\.\(tripId \? \{ tripId \} : \{\}\) \}\)/.test(fconfirm)) railFail(`${FCONFIRM} does not post the two references the panel handed it (and the trip, when there is one)`);
  if (!/data-flight-email="sent"/.test(fconfirm) || !/data-flight-email="failed"/.test(fconfirm)) railFail(`${FCONFIRM} does not say whether the confirmation email went out — FL-5b rule moved here with the booking it belongs to`);
  if (!/setPhase\('incomplete'\)/.test(fconfirm)) railFail(`${FCONFIRM} does not state a link that arrived without its references — a missing value is said, never guessed`);
  {
    const mw = codeOf('src/middleware.ts');
    if (!/'\/booking\/flight-confirm',/.test(mw)) railFail('src/middleware.ts does not list /booking/flight-confirm as public — a guest who just paid would be 307-bounced to the landing and never finish the booking');
  }

  if (railViolations === 0) console.log(`✔ The flight payment-rail law passed — the flights checkout drives the vendor own documented wrapper: publicKey is the environment label from the server (never a key, never a default), the prebook publishableKey is not read at all because the vendor documents it nullable, and the wrapper draws the form from the prebook secretKey; CHECKOUT-01 four named failures (payment_env · prebook · sdk_script · form_absent), first reason kept, FORM_DEADLINE_MS watchdog and no card asked for beside a failure all hold, as does CHECKOUT-03 Stripe.js gate; the rail redirect lands on /booking/flight-confirm, public, which finishes the booking through the existing route.`);
  else console.log(`✖ The flight payment-rail law FAILED — ${railViolations} violation(s).`);
});

// ── THE LANE LAW (LANE-01, 2026-09-25) ──────────────────────────────────────
// A RESERVATION KNOWS WHAT IT IS.
//
// WHAT THIS CLOSES. reservations had no lane column. The lane IS known at book time
// (each book route hands landLiteApiBooking lane: hotel | flight) and was thrown
// away. Three routes each carried their own PROVIDER_TYPE map deriving a type from
// `provider`, every one mapping liteapi to hotel — and LiteAPI is now both rails,
// so every flight rendered as a hotel. Each named a row hotelName ?? provider: a
// flight writes hotelName null, so a paid flight was named "liteapi" on a
// customer-facing ledger. The flights book route hardcoded tripId null, wrote no
// calendar row (the book payload has no date of travel) and froze the status at
// "pending" forever.
//
// THE RULE. Type comes from reservations.lane, written by the book route from the
// value it already holds — never from provider. A name comes from stated fields
// only; nothing displays a provider slug. A flight's day, name and status come from
// the vendor's GET /flights/bookings/{id}, applied ONCE per booking after the
// reservation is committed (CAL-01's ordering), through ONE shared function that
// the retro script also runs; a failed or empty answer changes nothing, named. The
// migration's backfill CASE is a one-time act and exists in no runtime code.
lawGuard('The lane law', () => {
  let laneViolations = 0;
  const laneFail = (m: string) => { laneViolations += 1; violations.push(`lane law: ${m} (LANE-01)`); };

  const LANE_LEAF = 'src/lib/reservations/lane.ts';
  const STATUS_LEAF = 'src/lib/reservations/flightStatus.ts';
  const REFRESH_LEAF = 'src/lib/reservations/refreshFlightReservation.ts';
  // STATUS-01 (2026-09-26): the one apply leaf the refresh hands the status to.
  const APPLY_LEAF = 'src/lib/reservations/applyVendorState.ts';
  const FLIGHT_BOOK = 'src/app/api/travel/liteapi/flights/book/route.ts';
  const HOTEL_BOOK = 'src/app/api/travel/liteapi/book/route.ts';
  const LANE_READERS = [
    'src/app/api/reservations/[id]/route.ts',
    'src/app/api/reservations/unattached/route.ts',
    'src/app/api/trips/[id]/reservations/route.ts',
    'src/app/api/trips/[id]/actuals/route.ts',
    'src/components/hub/MatchReviewSection.tsx',
  ];
  const RETRO = 'scripts/lane-01-retro-flights.ts';
  const LANE_MIGRATION = ALL_MIGRATIONS.find((m) => /_lane_01_/.test(m.dir));

  // 1. ONE READER, KEYED ON LANE. No PROVIDER_TYPE map anywhere; no name falls
  //    through to the provider; every reader goes through the leaf.
  const leaf = codeOf(LANE_LEAF);
  if (!/export function reservationIdentity\(/.test(leaf)) laneFail(`${LANE_LEAF} does not export reservationIdentity — the one reader`);
  if (/\.provider\b/.test(leaf)) laneFail(`${LANE_LEAF} reads .provider — type comes from lane, never from the provider`);
  if (/liteapi|viator|duffel/.test(leaf)) laneFail(`${LANE_LEAF} knows a provider by name — a lane is not a provider`);
  if (!/if \(!isReservationLane\(row\.lane\)\) \{\s*throw new Error/.test(leaf)) laneFail(`${LANE_LEAF} does not throw on a lane the column does not admit — an unknown lane is never guessed around`);
  for (const f of staySrcFiles()) {
    const src = codeOf(f);
    if (/PROVIDER_TYPE/.test(src)) laneFail(`${f} carries a PROVIDER_TYPE map — type comes from reservations.lane through ${LANE_LEAF}`);
    if (/hotelName \?\? [a-zA-Z.]*provider\b/.test(src)) laneFail(`${f} names a row hotelName ?? provider — a flight has no hotelName and would be named after its vendor`);
    if (/\$\{[a-zA-Z.]*provider\} booking/.test(src)) laneFail(`${f} names a row after its provider ("<provider> booking") — nothing displays a vendor slug`);
  }
  for (const f of LANE_READERS) {
    const src = codeOf(f);
    if (!/reservationIdentity\(/.test(src)) laneFail(`${f} does not read type and name through reservationIdentity — the one reader`);
    // Using the leaf for the NAME while reading the TYPE straight off the row is the
    // same defect by another door: the one reader decides what a row is.
    if (/\btype: (r|row|reservation|q\.reservation)\.(lane|provider)\b/.test(src)) laneFail(`${f} reads a row type past the leaf (type: r.lane / r.provider) — the one reader decides what a row is`);
  }

  // 2. THE COLUMN. NOT NULL, no default, CHECK-enforced; both book routes write the
  //    lane they already hold.
  if (!/\n  lane\s+String\s+@db\.VarChar\(20\)\n/.test(schemaText)) laneFail('prisma/schema.prisma: reservations.lane is not a NOT NULL VarChar(20) with no @default');
  if (!/\n  displayName\s+String\?\s+@db\.VarChar\(255\)\n/.test(schemaText)) laneFail('prisma/schema.prisma: reservations.displayName is not a nullable VarChar(255)');
  if (!/lane: 'hotel',\s*displayName: resolvedHotelName,/.test(codeOf(HOTEL_BOOK))) laneFail(`${HOTEL_BOOK} does not write lane: hotel and its stated name on the row`);
  if (!/lane: 'flight',\s*displayName: null,/.test(codeOf(FLIGHT_BOOK))) laneFail(`${FLIGHT_BOOK} does not write lane: flight on the row (the name is not stated at book time)`);

  // 3. THE BACKFILL IS A MIGRATION-ONLY ACT. The CASE exists in the migration and in
  //    no runtime code.
  if (!LANE_MIGRATION) laneFail('no prisma/migrations/*_lane_01_*/migration.sql');
  else {
    const sql = LANE_MIGRATION.sql;
    for (const must of ['ADD COLUMN "lane" VARCHAR(20);', "THEN 'activity'", "THEN 'flight'", "ELSE 'hotel'", 'ALTER COLUMN "lane" SET NOT NULL;', "CHECK (\"lane\" IN ('hotel', 'flight', 'activity'))", 'NO RUNTIME CODE MAY EVER DERIVE lane THIS WAY']) {
      if (!sql.includes(must)) laneFail(`the LANE-01 migration lacks "${must}"`);
    }
  }
  for (const f of [...staySrcFiles(), RETRO]) {
    const src = codeOf(f);
    if (/checkinDate"? IS NULL|checkinDate === null \? 'flight'|provider === 'viator' \? 'activity'|CASE\s+WHEN\s+"?provider"?\s*=\s*'viator'/i.test(src)) {
      laneFail(`${f} derives a lane from a stay date or a provider — the migration backfill CASE is a one-time act, and runtime code writes the lane it holds`);
    }
  }

  // 4. THE FLIGHT'S DAY, NAME AND STATUS ARE VENDOR-STATED, THROUGH ONE FUNCTION,
  //    AFTER THE COMMIT, OUTSIDE IT, IN ITS OWN TRY/CATCH — CAL-01's ordering.
  const refresh = codeOf(REFRESH_LEAF);
  if (!/export async function refreshFlightReservation\(/.test(refresh)) laneFail(`${REFRESH_LEAF} does not export refreshFlightReservation`);
  if (/createdAt/.test(refresh)) laneFail(`${REFRESH_LEAF} reads createdAt — a flight day is the vendor stated departure, never the booking instant`);
  if (/new Date\(\)/.test(refresh)) laneFail(`${REFRESH_LEAF} reads the clock — nothing here is today`);
  if (/\?\? '(pending|confirmed|cancelled)'/.test(refresh)) laneFail(`${REFRESH_LEAF} defaults a status — the vendor is the only source that may change one`);
  if (!/s\.direction === 'OUTBOUND'/.test(refresh)) laneFail(`${REFRESH_LEAF} does not pick the segment the vendor MARKED outbound`);
  // STATUS-01 (2026-09-26): the mapping moved WITH the status logic into the one
  // apply leaf, stricter — the refresh hands it the stated status and carries no
  // mapping of its own; the leaf maps through the same STATUS_LEAF, defaults
  // nothing and reads no clock.
  if (!/applyVendorState\(/.test(refresh)) laneFail(`${REFRESH_LEAF} does not hand the status to the one apply leaf (applyVendorState) — the refresh would drift from the webhook and the cron`);
  if (/flightProviderStatusToReservation/.test(refresh)) laneFail(`${REFRESH_LEAF} maps the status itself beside the apply leaf — two mappings drift`);
  {
    const apply = codeOf(APPLY_LEAF);
    if (!/flightProviderStatusToReservation\(vendor\.status\)/.test(apply)) laneFail(`${APPLY_LEAF} does not map the flight status through ${STATUS_LEAF}`);
    if (/\?\? '(pending|confirmed|cancelled|failed)'/.test(apply)) laneFail(`${APPLY_LEAF} defaults a status — the vendor is the only source that may change one`);
    if (/new Date\(\)/.test(apply)) laneFail(`${APPLY_LEAF} reads the clock — nothing here is today`);
  }
  if (!/writeBookingCalendarEvent\(\s*ports\.calendar,\s*flightStatedCalendarDecision\(/.test(refresh)) laneFail(`${REFRESH_LEAF} does not write the CAL-01 row through the CAL-01 writer`);
  const fb = codeOf(FLIGHT_BOOK);
  if (!/flightProviderStatusToReservation\(parsed\.status\)/.test(fb)) laneFail(`${FLIGHT_BOOK} does not map the status through ${STATUS_LEAF} — the two callers would drift`);
  if (/'TICKETED'/.test(fb)) laneFail(`${FLIGHT_BOOK} still carries an inline status mapping beside the leaf`);
  {
    const txAt = fb.indexOf('prisma.$transaction');
    const at = fb.indexOf('refreshFlightReservation(');
    if (at < 0) laneFail(`${FLIGHT_BOOK} never calls refreshFlightReservation — a flight gets no day, no name and no refreshed status`);
    else {
      if (!(txAt > 0 && txAt < at)) laneFail(`${FLIGHT_BOOK}: the refresh must come AFTER the reservation transaction`);
      const between = fb.slice(txAt, at);
      if (!/const result = landed\.reservation;/.test(between)) laneFail(`${FLIGHT_BOOK}: the transaction has not produced its reservation before the refresh runs`);
      const after = fb.slice(at, at + 1900);
      if (!/catch \(calErr\)/.test(after)) laneFail(`${FLIGHT_BOOK}: the refresh has no try/catch of its own — a vendor failure would fail a PAID booking`);
      if (!/prismaBookingCalendar\(prisma\)/.test(after)) laneFail(`${FLIGHT_BOOK}: the refresh must write through the top-level client, never the transaction client`);
      if (/prismaBookingCalendar\(tx\)/.test(after)) laneFail(`${FLIGHT_BOOK}: the refresh enlists the transaction client`);
      const before = fb.slice(Math.max(0, at - 400), at);
      if (!/reserveTravelSearch\('liteapiflightbookingread'\)/.test(before)) laneFail(`${FLIGHT_BOOK}: the GET is not reserved against its daily cap immediately before it runs`);
      const catchAt = after.indexOf('catch (calErr)');
      if (catchAt > 0 && /return NextResponse|throw /.test(after.slice(catchAt, catchAt + 400))) laneFail(`${FLIGHT_BOOK}: the refresh catch fails the booking`);
      if (!/LANE-01 refresh did not apply/.test(after)) laneFail(`${FLIGHT_BOOK}: a refresh that does not apply is not logged by name`);
    }
  }
  if (dailyCap('liteapiflightbookingread') > 100) laneFail(`liteapiflightbookingread has no tight safe-default cap (${dailyCap('liteapiflightbookingread')}) — the GET is treated as metered`);

  // 5. THE TRIP. The flights route takes tripId under the hotel route OWN gate.
  for (const line of ["{ error: 'Sign in to save a booking to a trip.' }", 'where: { id: tripId, userId: user!.id }', "{ error: 'Trip not found' }, { status: 404 }", 'tripId: resolvedTripId,']) {
    if (!fb.includes(line)) laneFail(`${FLIGHT_BOOK} lacks the hotel route gate line ${line}`);
  }
  if (/tripId: null,/.test(fb)) laneFail(`${FLIGHT_BOOK} still hardcodes tripId: null`);
  if (!/tripId=\{authed === true && currentTrip \? currentTrip\.id : undefined\}/.test(codeOf('src/components/trips/PublicFlightSearch.tsx'))) laneFail('PublicFlightSearch.tsx does not pass the selected trip under the hotel lane rule (authed === true && currentTrip)');
  if (!/\.\.\.\(tripId \? \{ tripId \} : \{\}\),/.test(codeOf('src/components/trips/LiteApiFlightCheckoutPanel.tsx'))) laneFail('LiteApiFlightCheckoutPanel.tsx does not carry tripId in the returnUrl when there is one');
  if (!/params\.get\('tripId'\)/.test(codeOf('src/app/booking/flight-confirm/page.tsx'))) laneFail('/booking/flight-confirm does not read tripId from the link');

  // 6. THE RETRO runs THE shared function, guarded the same way.
  const retro = codeOf(RETRO);
  if (!/refreshFlightReservation\(/.test(retro)) laneFail(`${RETRO} does not run refreshFlightReservation — a second implementation would drift`);
  if (!/reserveTravelSearch\('liteapiflightbookingread'\)/.test(retro)) laneFail(`${RETRO} does not reserve the daily cap before each GET`);
  if (!/where: \{ lane: 'flight' \}/.test(retro)) laneFail(`${RETRO} does not select flight rows by lane`);

  if (laneViolations === 0) console.log(`✔ The lane law passed — type comes from reservations.lane through ONE reader (${LANE_READERS.length} readers, 0 PROVIDER_TYPE maps, no name falls through to a provider slug); both book routes write the lane they hold; the migration backfills once and its CASE exists in no runtime file; a flight day, name and status are vendor-stated through one function, after the commit, outside it, in its own try/catch, reserved against liteapiflightbookingread (${dailyCap('liteapiflightbookingread')}/day); flights attach to a trip under the hotel route own gate; the retro runs the same function.`);
  else console.log(`✖ The lane law FAILED — ${laneViolations} violation(s).`);
});

// ── THE PRIVACY-AND-MONEY LAW (SEC-03, 2026-09-25) ──────────────────────────
// NO PII IN A URL, NO FABRICATED NUMBER IN A LEDGER.
//
// WHAT THIS CLOSES. (A) The flights checkout put the customer email in the payment
// wrapper returnUrl; /booking/flight-confirm read it off the query string and
// posted it to the book route. A redirect URL is browser history, referrer headers
// and server logs. (B) Both book routes wrote a price the vendor never stated:
// `parsed.price ?? 0` put $0 into reservations.finalPriceCents AND
// commission_ledger.grossAmountCents, and `?? 'USD'` invented a currency, so a
// real $0 and a gap were the same number and the matcher had to read 0 as
// "unknown". (C) CANCELLED_WITH_CHARGES was unmapped: a cancelled, charged flight
// read "pending".
//
//   1. NO EMAIL IN ANY URL. Over every source file: no URLSearchParams literal,
//      set or append carries an email-named key, no `?email=` is built into a
//      URL, and no page or route reads an email-named key off a query string.
//   2. THE CONTACT IS STORED AT PREBOOK. The flights prebook route validates the
//      contact, calls the vendor, then writes prebook_contacts under the
//      vendor prebookId BEFORE it answers; the write has its own catch that
//      answers a NAMED 500 carrying no secretKey. (The table key is the vendor
//      id, which exists only once the vendor has answered — so the row cannot
//      precede the call; what it precedes is the answer, and with it any card
//      form.) The search currency the panel states is validated and stored.
//   3. THE BOOK ROUTE READS IT. By prebookId, BEFORE the quota reservation and
//      the vendor call; no row is a named 400. The recipient is the stored
//      address. One email attempt per booking: a retry that finds the
//      reservation already recorded reports earlier and sends nothing.
//   4. THE MONEY. Both book routes: price absent → NULL in both ledgers with a
//      loud log naming the bookingId; currency absent → the currency the SEARCH
//      was made in (stored with the contact for flights, stated by the confirm
//      page for hotels), else the contract-deviation throw. No `?? 0`, no
//      `?? 'USD'`, no price relayed from a URL into the ledger.
//   5. THE SCHEMA AND THE MIGRATION. Both money columns nullable; prebook_contacts
//      keyed on prebookId with no default on any stated field; no backfill.
//   6. EVERY READER SAYS "price not stated" for NULL — never $0, never NaN, never
//      summed, never dropped. The export keeps the Dollars twin, empty.
//   7. THE MATCHER. NULL excludes the amount signal; 0 is a real amount.
//   8. THE STATUS. CANCELLED_WITH_CHARGES → cancelled.
lawGuard('The privacy-and-money law', () => {
  let secViolations = 0;
  const secFail = (m: string) => { secViolations += 1; violations.push(`privacy-and-money law: ${m} (SEC-03)`); };

  const FPREBOOK = 'src/app/api/travel/liteapi/flights/prebook/route.ts';
  const FBOOK = 'src/app/api/travel/liteapi/flights/book/route.ts';
  const HBOOK = 'src/app/api/travel/liteapi/book/route.ts';
  const FPANEL = 'src/components/trips/LiteApiFlightCheckoutPanel.tsx';
  const FCONFIRM = 'src/app/booking/flight-confirm/page.tsx';
  const HCONFIRM = 'src/app/booking/confirm/page.tsx';
  const MATCHER = 'src/lib/runway/reservationMatcher.ts';
  const STATUS_LEAF = 'src/lib/reservations/flightStatus.ts';
  const EXPORT = 'src/app/api/export/route.ts';
  const AMOUNT_ROUTES = ['src/app/api/reservations/[id]/route.ts', 'src/app/api/reservations/unattached/route.ts', 'src/app/api/trips/[id]/reservations/route.ts'];
  const SAYING_READERS = ['src/components/trips/TripBookings.tsx', 'src/components/trips/UnattachedBookings.tsx', 'src/components/trips/TripBudgetActual.tsx', 'src/components/hub/MatchReviewSection.tsx', HCONFIRM, 'src/lib/emailTemplates/flightConfirmation.ts', 'src/lib/emailTemplates/bookingConfirmation.ts'];
  const SEC_MIGRATION = ALL_MIGRATIONS.find((m) => /_sec_03_/.test(m.dir));

  // The object literal handed to a call, walked by brace depth — never a character
  // count, and never the first `})`, which a spread `...(x ? { x } : {})` would hit.
  const literalAfter = (src: string, at: number): string => {
    const open = src.indexOf('{', at);
    if (open < 0) return '';
    let depth = 0;
    for (let i = open; i < src.length; i++) {
      if (src[i] === '{') depth += 1;
      else if (src[i] === '}') { depth -= 1; if (depth === 0) return src.slice(open, i + 1); }
    }
    return src.slice(open);
  };

  // 1. NO EMAIL IN ANY URL, anywhere in src.
  for (const { file, src } of srcFiles) {
    for (const m of src.matchAll(/new URLSearchParams\(/g)) {
      const lit = literalAfter(src, m.index! + m[0].length);
      const key = lit.match(/\b([A-Za-z]*[eE]mail[A-Za-z]*)\s*:/);
      if (key) secFail(`${file} builds a URL whose query carries an email (${key[1]}) — a redirect URL is browser history, referrer headers and server logs`);
    }
    // A query-string setter — never a cookie jar or a header map, which set the
    // signed session cookie by its name and are not URLs.
    const setter = src.match(/(?<!cookies|cookieStore|headers)\.(set|append)\('([A-Za-z]*[eE]mail[A-Za-z]*)'/);
    if (setter) secFail(`${file} puts an email-named key (${setter[2]}) on a query string with .${setter[1]}()`);
    const built = src.match(/[?&]([A-Za-z]*[eE]mail[A-Za-z]*)=/);
    if (built) secFail(`${file} builds ?${built[1]}= into a URL`);
    const read = src.match(/(?:searchParams|params)\.get\('([A-Za-z]*[eE]mail[A-Za-z]*)'\)/);
    if (read) secFail(`${file} reads an email off a query string (${read[1]}) — the contact is stored at prebook and read by prebookId`);
  }
  {
    const fp = codeOf(FPANEL);
    if (/contactEmail/.test(fp)) secFail(`${FPANEL} still names contactEmail — the address rides no link`);
    const fc = codeOf(FCONFIRM);
    if (/contactEmail/.test(fc)) secFail(`${FCONFIRM} still names contactEmail — the page reads no email and posts none`);
    if (!/body: JSON\.stringify\(\{ prebookId, transactionId, \.\.\.\(tripId \? \{ tripId \} : \{\}\) \}\)/.test(fc)) secFail(`${FCONFIRM} does not post exactly the two references and the trip`);
    if (!/data-flight-email="earlier"/.test(fc)) secFail(`${FCONFIRM} does not say when the email went out on an EARLIER attempt — a retry sends no second one, and that is stated`);
  }

  // 2. THE CONTACT IS STORED AT PREBOOK, before the browser is answered.
  {
    const src = codeOf(FPREBOOK);
    const vendor = src.indexOf('await prebookFlight(');
    const write = src.indexOf('prisma.prebook_contacts.create(');
    // The envelope that carries the secretKey to the browser — anchored on its own
    // three opening lines, so a secretKey smuggled into a refusal is found in the
    // refusal, not mistaken for the envelope.
    const answer = src.indexOf('return NextResponse.json({\n      prebookId: prebook.prebookId,\n      transactionId: prebook.transactionId,\n      secretKey: prebook.secretKey,');
    if (write < 0) secFail(`${FPREBOOK} does not write the contact row (prisma.prebook_contacts.create) — the book route has nothing to read`);
    else if (answer < 0) secFail(`${FPREBOOK} no longer answers the whitelisted envelope (prebookId, transactionId, secretKey) — the clause cannot place the write against it`);
    else {
      if (!(vendor > 0 && vendor < write)) secFail(`${FPREBOOK}: the contact row is keyed on the vendor prebookId and must be written right after the vendor answers`);
      if (!(answer > write)) secFail(`${FPREBOOK}: the secretKey is answered before the contact row is written — a card form could open on a hold with no stored contact`);
      const between = src.slice(write, answer);
      if (!/catch \(writeErr\)/.test(between)) secFail(`${FPREBOOK}: the contact write has no catch of its own — a failed write must be a NAMED refusal, not a generic 500`);
      const catchAt = between.indexOf('catch (writeErr)');
      const catchBody = catchAt >= 0 ? between.slice(catchAt) : '';
      if (!/code: 'contact_not_stored'/.test(catchBody)) secFail(`${FPREBOOK}: a failed contact write is not refused by name (contact_not_stored)`);
      if (/secretKey/.test(catchBody)) secFail(`${FPREBOOK}: the refusal for a failed contact write carries a secretKey — a card form could open with no stored contact`);
      if (!/\{ status: 500 \}/.test(catchBody)) secFail(`${FPREBOOK}: a failed contact write does not answer 500`);
    }
    for (const field of ['contactFirstName: contact.firstName', 'contactLastName: contact.lastName', 'contactEmail: contact.email', 'contactPhone: contact.phoneNumber', "lane: 'flight'", 'searchCurrency: searchCurrency || null', 'userId: user?.id ?? null']) {
      if (!src.includes(field)) secFail(`${FPREBOOK} does not store ${field} — the row holds exactly what was validated`);
    }
    if (!/\/\^\[A-Z\]\{3\}\$\/\.test\(searchCurrency\)/.test(src)) secFail(`${FPREBOOK} does not validate the stated search currency as an ISO 4217 code`);
    if (/\?\? 'USD'|\|\| 'USD'/.test(src)) secFail(`${FPREBOOK} invents a currency`);
    if (!/^\s*const contact: FlightPrebookContact = \{/m.test(src) || src.indexOf('const contact: FlightPrebookContact') > vendor) secFail(`${FPREBOOK}: the contact is not validated BEFORE the vendor call`);
  }

  // 3. THE BOOK ROUTE READS IT — before the quota and the vendor; the stored
  //    address is the recipient; one attempt per booking.
  {
    const src = codeOf(FBOOK);
    const read = src.indexOf('prisma.prebook_contacts.findUnique({ where: { prebookId } })');
    const refuse = src.indexOf("code: 'contact_not_stored'");
    const quota = src.indexOf("reserveTravelSearch('liteapiflightbooking')");
    const vendor = src.indexOf('await bookFlight(');
    if (read < 0) secFail(`${FBOOK} does not read the stored contact by prebookId`);
    else {
      if (!(refuse > read && refuse < quota)) secFail(`${FBOOK} does not refuse a missing contact by name (contact_not_stored) between the read and the quota reservation`);
      if (!(quota > 0 && read < quota)) secFail(`${FBOOK} does not read the stored contact before the quota reservation — a booking with no contact would cost quota`);
      if (!(vendor > quota && read < vendor)) secFail(`${FBOOK} does not read the stored contact before the vendor call — a booking with no contact would cost money`);
      if (!/if \(!contact \|\| contact\.lane !== 'flight'\)/.test(src)) secFail(`${FBOOK} accepts a contact row from another lane`);
    }
    if (/body\.contactEmail|contactEmail\?: unknown/.test(src)) secFail(`${FBOOK} still takes contactEmail from the body — the address is read from the stored row, never carried`);
    if (!/to: contact\.contactEmail,/.test(src)) secFail(`${FBOOK}: the recipient is not the stored contact (to: contact.contactEmail)`);
    if (/to: userEmail|to: user\?\.email|to: (?:body|params)\./.test(src)) secFail(`${FBOOK} substitutes a recipient`);
    if (!/if \(landed\.reservationOutcome === 'existing'\) \{\s*emailStatus = \{ sent: 'earlier' \};/.test(src)) secFail(`${FBOOK} does not keep one email attempt per booking — a retry that finds the reservation already recorded must report earlier and send nothing`);
  }

  // 4. THE MONEY, both book routes.
  for (const [file, currencyChain] of [[FBOOK, 'const resolvedCurrency = parsed.currency ?? contact.searchCurrency;'], [HBOOK, 'const resolvedCurrency = parsed.currency ?? currency;']] as const) {
    const src = codeOf(file);
    if (/\?\? 0\b/.test(src)) secFail(`${file} writes ?? 0 — a price the vendor did not state is NULL, never 0`);
    if (/\?\? 'USD'|\|\| 'USD'|: 'USD'/.test(src)) secFail(`${file} invents a currency with a literal`);
    if (/resolvedPrice/.test(src)) secFail(`${file} still resolves a price through a fallback chain`);
    if (!/const statedCents = statedPrice === null \? null : Math\.round\(statedPrice \* 100\);/.test(src)) secFail(`${file} does not derive the cents from the stated price or NULL`);
    if (!/finalPriceCents: statedCents,/.test(src)) secFail(`${file} does not write the stated cents (or NULL) to reservations.finalPriceCents`);
    if (!/grossAmountCents: statedCents,/.test(src)) secFail(`${file} does not write the stated cents (or NULL) to commission_ledger.grossAmountCents`);
    if (!/SEC-03 the vendor stated NO price[^\n]*\n\s*bookingId: parsed\.bookingId,/.test(src)) secFail(`${file} does not log a price the vendor did not state, loudly, naming the bookingId`);
    if (!src.includes(currencyChain)) secFail(`${file} does not take the currency from the vendor, else the currency the search was made in`);
    const chainAt = src.indexOf(currencyChain);
    const after = chainAt >= 0 ? src.slice(chainAt, chainAt + 700) : '';
    if (!/contract deviation from the documented shape/.test(after) || !/throw new LiteApi(Flights)?(Api)?Error\(/.test(after)) secFail(`${file} does not throw the contract-deviation error when neither the vendor nor the search states a currency`);
  }
  {
    const hb = codeOf(HBOOK);
    if (/finalPriceCents\?: number/.test(hb) || /finalPriceCents \/ 100/.test(hb)) secFail(`${HBOOK} still takes a price from the request body — a number relayed from a URL is not a vendor statement`);
    if (!/\/\^\[A-Z\]\{3\}\$\/\.test\(currency\)/.test(hb)) secFail(`${HBOOK} does not validate the stated search currency as an ISO 4217 code`);
    const hc = codeOf(HCONFIRM);
    if (/finalPriceCents: Math\.round/.test(hc)) secFail(`${HCONFIRM} posts the price it displayed into the ledger`);
    if (/'USD'/.test(hc)) secFail(`${HCONFIRM} carries a currency literal — the search currency is what the link states, or nothing`);
    if (!/\.\.\.\(currency \? \{ currency \} : \{\}\),/.test(hc)) secFail(`${HCONFIRM} does not state the search currency to the book route only when the link carries one`);
  }

  // 5. THE SCHEMA AND THE MIGRATION.
  if (!/\n  finalPriceCents\s+Int\?/.test(schemaText)) secFail('prisma/schema.prisma: reservations.finalPriceCents is not nullable');
  if (!/\n  grossAmountCents\s+Int\?/.test(schemaText)) secFail('prisma/schema.prisma: commission_ledger.grossAmountCents is not nullable');
  if (!/\nmodel prebook_contacts \{\n  prebookId\s+String\s+@id/.test(schemaText)) secFail('prisma/schema.prisma: prebook_contacts is not keyed on prebookId');
  for (const col of ['lane', 'contactFirstName', 'contactLastName', 'contactEmail', 'contactPhone']) {
    const line = schemaText.match(new RegExp(`\\n  ${col}\\s+String[^\\n]*`));
    if (!line) secFail(`prisma/schema.prisma: prebook_contacts lacks ${col}`);
    else if (/\?|@default/.test(line[0].replace(/\/\/.*$/, ''))) secFail(`prisma/schema.prisma: prebook_contacts.${col} is nullable or defaulted — a stated field has no default`);
  }
  if (!SEC_MIGRATION) secFail('no prisma/migrations/*_sec_03_*/migration.sql');
  else {
    const sql = SEC_MIGRATION.sql;
    for (const must of ['ALTER TABLE "reservations" ALTER COLUMN "finalPriceCents" DROP NOT NULL;', 'ALTER TABLE "commission_ledger" ALTER COLUMN "grossAmountCents" DROP NOT NULL;', 'CREATE TABLE "prebook_contacts"', 'PRIMARY KEY ("prebookId")', `CHECK ("lane" IN ('hotel', 'flight', 'activity'))`]) {
      if (!sql.includes(must)) secFail(`the SEC-03 migration lacks "${must}"`);
    }
    // A statement that starts with UPDATE is a backfill; ON UPDATE CASCADE on the key is not.
    if (/^\s*UPDATE\b/im.test(sql)) secFail('the SEC-03 migration backfills — existing rows are untouched');
    for (const col of ['prebookId', 'lane', 'contactFirstName', 'contactLastName', 'contactEmail', 'contactPhone']) {
      const line = sql.split('\n').find((l) => l.includes(`"${col}"`) && /VARCHAR/.test(l));
      if (!line) secFail(`the SEC-03 migration does not declare "${col}"`);
      else if (/DEFAULT/i.test(line) || !/NOT NULL/.test(line)) secFail(`the SEC-03 migration defaults or nulls "${col}" — a stated field is NOT NULL with no default`);
    }
  }

  // 6. EVERY READER SAYS IT.
  for (const f of AMOUNT_ROUTES) {
    if (!codeOf(f).includes('amountUsd: r.finalPriceCents === null ? null : r.finalPriceCents / 100,')) secFail(`${f} does not pass a NULL price through as null (amountUsd) — it would divide NULL and answer 0 or NaN`);
  }
  for (const f of SAYING_READERS) {
    if (!/price not stated/.test(codeOf(f))) secFail(`${f} does not say "price not stated" for a NULL price`);
  }
  for (const f of ['src/lib/emailTemplates/flightConfirmation.ts', 'src/lib/emailTemplates/bookingConfirmation.ts']) {
    if (!/totalAmountCents: number \| null;/.test(codeOf(f))) secFail(`${f}: the template does not accept a NULL total`);
  }
  {
    const tb = codeOf('src/components/trips/TripBookings.tsx');
    if (!/r\.amountUsd === null \? 0 : Math\.round\(r\.amountUsd \* 100\)/.test(tb)) secFail('TripBookings.tsx sums a NULL price — the total leaves it out');
    if (!/unstatedCount\(rows\) > 0/.test(tb)) secFail('TripBookings.tsx does not say how many rows its total left out');
    const ex = codeOf(EXPORT);
    if (!/if \(\/Cents\$\/\.test\(k\)\) out\[k\.replace\(\/Cents\$\/, 'Dollars'\)\] = '';/.test(ex)) secFail(`${EXPORT} drops the Dollars twin of a NULL cents column — the column is kept, empty, never 0.00`);
  }
  for (const { file, src } of srcFiles) {
    if (/finalPriceCents \?\? \d|amountUsd \?\? \d|totalAmountCents \?\? \d/.test(src)) secFail(`${file} reads a NULL price as a number (?? 0)`);
    const lines = src.split('\n');
    for (const [i, line] of lines.entries()) {
      if (!/finalPriceCents\)? \/ 100/.test(line)) continue;
      const window = lines.slice(Math.max(0, i - 5), i + 1).join('\n');
      if (!/finalPriceCents === null/.test(window)) secFail(`${file}:${i + 1} divides finalPriceCents with no NULL guard within five lines — NaN, never said`);
    }
    if (/amountUsd\.toFixed\(/.test(src) && !/amountUsd (===|!==|!=) null|typeof [a-zA-Z.]*amountUsd === 'number'/.test(src)) secFail(`${file} formats amountUsd with no NULL guard`);
  }

  // 7. THE MATCHER.
  {
    const m = codeOf(MATCHER);
    if (!/finalPriceCents: number \| null;/.test(m)) secFail(`${MATCHER} does not type finalPriceCents as nullable`);
    if (!/const amountKnown = r\.finalPriceCents !== null;/.test(m)) secFail(`${MATCHER} reads 0 as unknown — NULL is the one unknown and 0 is a real amount`);
    if (/finalPriceCents > 0|0 cents recorded|0 = price unknown/.test(rejoin(m, commentsOf(MATCHER)))) secFail(`${MATCHER} still treats 0 as "price unknown"`);
    if (!/price not stated by the vendor \(NULL recorded\)/.test(m)) secFail(`${MATCHER} does not name the NULL exclusion in the rationale`);
  }

  // 8. THE STATUS.
  if (!/s === 'CANCELLED' \|\| s === 'CANCELLED_WITH_CHARGES'\) return 'cancelled';/.test(codeOf(STATUS_LEAF))) secFail(`${STATUS_LEAF} does not map CANCELLED_WITH_CHARGES to cancelled`);
  if (!/SEC-03/.test(commentsOf(STATUS_LEAF))) secFail(`${STATUS_LEAF}: the header does not record the SEC-03 mapping`);

  if (secViolations === 0) console.log(`✔ The privacy-and-money law passed — ${srcFiles.length} source files, 0 emails in a URL; the flights contact is stored at prebook under the vendor prebookId before the browser is answered and read by the book route before the quota and the vendor; both book routes write NULL, never 0, for a price the vendor did not state and take the currency from the vendor or the search, never a literal; ${AMOUNT_ROUTES.length + SAYING_READERS.length} readers say "price not stated"; the matcher excludes NULL and compares 0; CANCELLED_WITH_CHARGES is cancelled.`);
  else console.log(`✖ The privacy-and-money law FAILED — ${secViolations} violation(s).`);
});

// ── THE CANCEL LAW (CANCEL-01, 2026-09-26) ──────────────────────────────────
// A CANCEL GOES TO THE RIGHT ENDPOINT, SHOWS THE QUOTE FIRST, AND KEEPS THE
// MONEY FACTS.
//
// WHAT THIS CLOSES. The cancel route selected no lane and its only vendor call
// was the HOTEL client (PUT /v3.0/bookings/{id}); both lists offered Cancel on
// any confirmed liteapi row, so a flight bookingId went to the hotel endpoint.
// The hotel answer stated a fee and a refund; the route wrote status only and
// discarded them. The flights client had no cancel, quote, amend or refund.
//
//   1. THE LANE DECIDES THE ENDPOINT. The route reads lane; hotel → the hotel
//      client, flight → the flights client, anything else → a named 409 before
//      any vendor call. The flights client calls the two documented paths.
//   2. THE QUOTE COMES FIRST. GET is the quote, metered before the vendor read;
//      the dialog renders no Cancel control for a flight until the quote has
//      rendered, and names a quote it could not fetch.
//   3. THE MONEY FACTS. Both lanes write money_events rows from the answer they
//      land, each pointed at the arrival; an amount the vendor did not state is
//      NULL, never 0; a 202 writes none.
//   4. THE 202. cancel_pending with the vendor own cancelIntentAt from one metered
//      GET — never our clock; the refresh does not undo it; the lists say it.
//   5. THE DAY AND THE MARGIN. A final cancel MARKS the calendar row (never
//      removes it) and moves the estimated commission to cancelled.
//   6. THE NAMED ABSENCES. CANCEL-02 (email), item 3 (webhook / refresh), item 7
//      (journal), item 8 (refund matching) are named where they attach.
lawGuard('The cancel law', () => {
  let cancelViolations = 0;
  const cancelFail = (m: string) => { cancelViolations += 1; violations.push(`cancel law: ${m} (CANCEL-01)`); };

  const ROUTE = 'src/app/api/reservations/[id]/cancel/route.ts';
  const DIALOG = 'src/components/trips/CancelBookingDialog.tsx';
  const LISTS = ['src/components/trips/TripBookings.tsx', 'src/components/trips/UnattachedBookings.tsx'];
  const FCLIENT = 'src/lib/liteapiFlightsClient.ts';
  const LEAF = 'src/lib/reservations/cancellation.ts';
  const CAL_IMPL = 'src/lib/calendar/prismaBookingCalendar.ts';
  const REFRESH = 'src/lib/reservations/refreshFlightReservation.ts';
  // STATUS-01 (2026-09-26): the guard lives in the one apply leaf now.
  const APPLY = 'src/lib/reservations/applyVendorState.ts';
  const CANCEL_MIGRATION = ALL_MIGRATIONS.find((m) => /_cancel_01_/.test(m.dir));

  const route = codeOf(ROUTE);
  // 1. THE LANE DECIDES THE ENDPOINT.
  // CANCEL-02 widened the select (the recipient and identity fields ride beside the lane).
  if (!/select: \{\s*id: true, status: true, provider: true, providerBookingId: true, lane: true,/.test(route)) cancelFail(`${ROUTE} does not read the lane off the owned row`);
  if (!/if \(owned\.lane === 'hotel'\) return cancelHotel\(owned, userId, accountEmail\);/.test(route)) cancelFail(`${ROUTE} does not send the hotel lane to the hotel cancel`);
  if (!/if \(owned\.lane === 'flight'\) return cancelFlight\(owned, userId, accountEmail\);/.test(route)) cancelFail(`${ROUTE} does not send the flight lane to the flight cancel — a flight bookingId would reach the hotel endpoint`);
  if (!/code: 'cancel_lane_unsupported'/.test(route)) cancelFail(`${ROUTE} does not refuse an unsupported lane by name before any vendor call`);
  {
    const hotelAt = route.indexOf('async function cancelHotel(');
    const flightAt = route.indexOf('async function cancelFlight(');
    const hotel = hotelAt >= 0 && flightAt > hotelAt ? route.slice(hotelAt, flightAt) : '';
    const flight = flightAt >= 0 ? route.slice(flightAt) : '';
    if (!hotel || !flight) cancelFail(`${ROUTE} lacks the two lane functions`);
    if (!/await cancelBooking\(owned\.providerBookingId\)/.test(hotel)) cancelFail(`${ROUTE}: the hotel cancel does not call the hotel client`);
    if (/cancelFlightBooking\(/.test(hotel)) cancelFail(`${ROUTE}: the hotel cancel reaches the flight endpoint`);
    if (!/await cancelFlightBooking\(owned\.providerBookingId\)/.test(flight)) cancelFail(`${ROUTE}: the flight cancel does not call the flights client`);
    if (/cancelBooking\(owned/.test(flight)) cancelFail(`${ROUTE}: the flight cancel reaches the hotel endpoint`);
    if (!/code: 'cancel_refused'/.test(flight) || flight.indexOf("code: 'cancel_refused'") > flight.indexOf('prisma.$transaction')) cancelFail(`${ROUTE}: a vendor 409 is not a named refusal before any write`);
    // 3. THE MONEY FACTS, both lanes.
    if (!/hotelCancelMoneyEvents\(parsed, \{ reservationId: owned\.id, arrivalId, statedAt: answer\.arrived \}\)/.test(hotel) || !/tx\.money_events\.createMany\(\{ data: moneyEvents \}\)/.test(hotel)) cancelFail(`${ROUTE}: the hotel cancel discards the refund and fee the answer states — they are money_events rows pointed at the arrival`);
    if (!/flightCancelDecision\(parsed, answer\.httpStatus, \{ reservationId: owned\.id, arrivalId, statedAt: answer\.arrived \}\)/.test(flight)) cancelFail(`${ROUTE}: the flight cancel does not decide its writes from the arrival and the HTTP status`);
    if (!/tx\.money_events\.createMany\(\{ data: decision\.moneyEvents \}\)/.test(flight)) cancelFail(`${ROUTE}: the flight cancel does not write its money facts`);
    // 4. THE 202.
    const read = flight.indexOf("reserveTravelSearch('liteapiflightbookingread')");
    const getBooking = flight.indexOf('getFlightBooking(owned.providerBookingId)');
    if (!(read > 0 && getBooking > read)) cancelFail(`${ROUTE}: the cancelIntentAt read after a 202 is not metered immediately before it runs`);
    if (!/cancelIntentAt: new Date\(details\.cancelIntentAt\)/.test(flight)) cancelFail(`${ROUTE}: cancelIntentAt is not the vendor own word from GET /flights/bookings`);
    if (/cancelIntentAt: new Date\(\)/.test(route)) cancelFail(`${ROUTE} writes our clock into cancelIntentAt — the vendor column holds the vendor word or NULL`);
    // 5. THE DAY AND THE MARGIN.
    if (!/const calendar = decision\.final \? await markCalendar\(owned\.id, owned\.providerBookingId\) : 'pending';/.test(flight)) cancelFail(`${ROUTE}: a final flight cancel does not mark the calendar row (and a pending one must not)`);
    if (!/await markCalendar\(owned\.id, owned\.providerBookingId\)/.test(hotel)) cancelFail(`${ROUTE}: a hotel cancel does not mark the calendar row`);
    if (!/where: \{ reservationId: owned\.id, status: 'estimated' \}, data: \{ status: 'cancelled' \}/.test(flight)) cancelFail(`${ROUTE}: a final flight cancel does not move the estimated commission to cancelled`);
    if (!/status: 'estimated' \},\s*data: \{ status: 'cancelled' \}/.test(hotel)) cancelFail(`${ROUTE}: a hotel cancel does not move the estimated commission to cancelled`);
  }
  // 2. THE QUOTE COMES FIRST.
  {
    const getAt = route.indexOf('export async function GET(');
    const postAt = route.indexOf('export async function POST(');
    const get = getAt >= 0 && postAt > getAt ? route.slice(getAt, postAt) : '';
    if (!get) cancelFail(`${ROUTE} has no GET — the quote verb`);
    const reserve = get.indexOf("reserveTravelSearch('liteapiflightcancelquote')");
    const vendor = get.indexOf('getFlightCancellationQuote(owned.providerBookingId)');
    if (!(reserve > 0 && vendor > reserve)) cancelFail(`${ROUTE}: the quote is not reserved against liteapiflightcancelquote immediately before the vendor read`);
    if (!/code: 'quote_refused'/.test(get)) cancelFail(`${ROUTE}: a vendor 409 on the quote is not named`);
    if (dailyCap('liteapiflightcancelquote') > 100) cancelFail(`liteapiflightcancelquote has no tight safe-default cap (${dailyCap('liteapiflightcancelquote')})`);
    const dialog = codeOf(DIALOG);
    if (!/const canConfirm = !isFlight \|\| quote\.state === 'quoted';/.test(dialog)) cancelFail(`${DIALOG} renders a Cancel control before the quote has rendered — a customer is never asked to confirm blind`);
    const gateAt = dialog.indexOf('{canConfirm && (');
    const buttonAt = dialog.indexOf("'Cancel booking'");
    if (!(gateAt > 0 && buttonAt > gateAt)) cancelFail(`${DIALOG}: the Cancel control is not inside the quoted gate`);
    if ((dialog.match(/'Cancel booking'/g) ?? []).length !== 1) cancelFail(`${DIALOG} carries a second Cancel control outside the gate`);
    if (!/state: 'quote_failed'/.test(dialog) || !/The cancellation quote could not be fetched\./.test(dialog)) cancelFail(`${DIALOG} does not name a quote it could not fetch`);
    for (const shown of ['data-quote-refund', 'data-quote-penalty', 'data-quote-confidence', 'data-quote-destination', 'data-quote-vouchers']) {
      if (!dialog.includes(shown)) cancelFail(`${DIALOG} does not render ${shown} before the customer confirms`);
    }
    if (!/confidenceWords\(quote\.quote\.confidence\)/.test(dialog) || !/destinationWords\(quote\.quote\.destination\)/.test(dialog)) cancelFail(`${DIALOG} does not render the vendor words as what they mean`);
    const fclient = codeOf(FCLIENT);
    if (!/getFlightsAnswer\(base, `\/flights\/bookings\/\$\{encodeURIComponent\(bookingId\)\}\/cancellations`\)/.test(fclient)) cancelFail(`${FCLIENT}: the quote does not read the documented path GET /flights/bookings/{id}/cancellations`);
    if (!/postFlightsAnswer\(base, `\/flights\/bookings\/\$\{encodeURIComponent\(bookingId\)\}\/cancellations`, undefined\)/.test(fclient)) cancelFail(`${FCLIENT}: the action does not call the documented path POST /flights/bookings/{id}/cancellations with no body`);
  }
  // 3. THE MONEY FACTS — the leaf and the table.
  {
    const leaf = codeOf(LEAF);
    if (!/if \(amount === null\) return null;/.test(leaf)) cancelFail(`${LEAF}: an amount the vendor did not state is not NULL — never 0`);
    if (/\?\? 0\b/.test(leaf) || /\?\? 0\b/.test(route)) cancelFail(`a cancel writes ?? 0 — a missing figure is NULL with the vendor own words`);
    if (!/return \{ status: 'cancel_pending', final: false, moneyEvents: \[\], vouchers: \[\], vouchersWithoutCode: \[\], commission: 'leave' \};/.test(leaf)) cancelFail(`${LEAF}: a 202 writes money — nothing is stated finally until the airline answers (item 3)`);
    if ((leaf.match(/arrivalId: ev\.arrivalId/g) ?? []).length < 3) cancelFail(`${LEAF}: not every money row points at the arrival`);
    // Scoped to the money_events model block — vouchers carries an arrivalId line too.
    const modelAt = schemaText.indexOf('\nmodel money_events {');
    const moneyModel = modelAt >= 0 ? schemaText.slice(modelAt, schemaText.indexOf('\n}', modelAt)) : '';
    if (!moneyModel) cancelFail('prisma/schema.prisma: no money_events model');
    if (!/\n  arrivalId\s+String\n/.test(moneyModel)) cancelFail('prisma/schema.prisma: money_events.arrivalId is not required — no money fact without its evidence');
    if (!/\n  amountCents\s+Int\?\n/.test(moneyModel)) cancelFail('prisma/schema.prisma: money_events.amountCents is not nullable');
    if (!CANCEL_MIGRATION) cancelFail('no prisma/migrations/*_cancel_01_*/migration.sql');
    else {
      const sql = CANCEL_MIGRATION.sql;
      for (const must of ['"arrivalId"         TEXT         NOT NULL,', 'FOREIGN KEY ("arrivalId") REFERENCES "arrivals"("id") ON DELETE RESTRICT', 'FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE RESTRICT', `CHECK ("kind" IN ('charge', 'refund', 'cancellation_fee', 'change_fee', 'servicing_fee', 'ticketing_fee', 'voucher_issued'))`, `CHECK ("status" IN ('stated', 'settled'))`, 'CREATE TABLE "vouchers"', 'ALTER TABLE "reservations" ADD COLUMN "cancelIntentAt" TIMESTAMPTZ(6);']) {
        if (!sql.includes(must)) cancelFail(`the CANCEL-01 migration lacks "${must}"`);
      }
      if (/^\s*UPDATE\b/im.test(sql)) cancelFail('the CANCEL-01 migration backfills — nothing is inferred');
    }
  }
  // 4. THE 202 — the guard and the lists. STATUS-01 (2026-09-26): the guard moved
  //    WITH the status logic into the one apply leaf and got stricter (a pending
  //    word does not undo the request either); the refresh carries none of its own.
  {
    const apply = codeOf(APPLY);
    if (!/else if \(row\.status === 'cancel_pending' && mapped === 'confirmed'\) status = 'unchanged';/.test(apply)) cancelFail(`${APPLY}: the apply leaf would flip a cancel_pending row back to confirmed while the airline still says CONFIRMED`);
    if (!/else if \(row\.status === 'cancel_pending' && mapped === 'pending'\) status = 'unchanged';/.test(apply)) cancelFail(`${APPLY}: the apply leaf would flip a cancel_pending row to pending on a pre-confirmation word`);
    if (/cancel_pending/.test(codeOf(REFRESH))) cancelFail(`${REFRESH}: the refresh carries a guard of its own beside the apply leaf — two guards drift`);
  }
  for (const f of LISTS) {
    const src = codeOf(f);
    if (!/\(r\.type === 'hotel' \|\| r\.type === 'flight'\) && r\.status === 'confirmed' && \(/.test(src)) cancelFail(`${f} does not offer Cancel on exactly the hotel and flight lanes, confirmed`);
    if (/r\.provider === 'liteapi' && r\.status === 'confirmed'/.test(src)) cancelFail(`${f} gates Cancel on the provider — LiteAPI is both rails`);
    if (!/lane=\{cancelTarget\.type\}/.test(src)) cancelFail(`${f} does not hand the dialog the lane through the one reader`);
    if (!/cancellation requested — awaiting the airline/.test(src)) cancelFail(`${f} does not say a cancel_pending row is awaiting the airline`);
  }
  // 5. THE DAY — marked, never removed.
  {
    const impl = codeOf(CAL_IMPL);
    if (!/UPDATE calendar_events/.test(impl) || !/status = 'cancelled'/.test(impl)) cancelFail(`${CAL_IMPL}: a cancelled reservation row is not marked`);
    if (/DELETE FROM calendar_events/.test(impl)) cancelFail(`${CAL_IMPL}: a cancelled reservation row is removed, not marked — the day-side of a record that lives forever`);
  }
  // 6. THE NAMED ABSENCES — and, since CANCEL-02 (2026-09-26), THE EMAIL THAT IS
  //    NO LONGER ONE: both lanes send after the commit, from the rows, to a
  //    recipient the rule stated or to nobody by name; never failing the cancel.
  const routeNotes = commentsOf(ROUTE);
  for (const named of ['item 3: the webhook receiver and scheduled refresh', 'item 7: journal posting of these money facts attaches here — NOT this PR']) {
    if (!routeNotes.includes(named)) cancelFail(`${ROUTE} does not name "${named.slice(0, 40)}..." where it attaches`);
  }
  if (/CANCEL-02: the cancellation EMAIL attaches here — NOT this PR/.test(routeNotes)) cancelFail(`${ROUTE} still names the cancellation email as absent — CANCEL-02 sends it`);
  {
    const hotelAt = route.indexOf('async function cancelHotel(');
    const flightAt = route.indexOf('async function cancelFlight(');
    const hotel = hotelAt >= 0 && flightAt > hotelAt ? route.slice(hotelAt, flightAt) : '';
    const flight = flightAt >= 0 ? route.slice(flightAt) : '';
    for (const [name, lane] of [['hotel', hotel], ['flight', flight]] as const) {
      const tx = lane.indexOf('prisma.$transaction');
      const send = lane.indexOf('await sendCancellationEmail(');
      if (!(tx > 0 && send > tx)) cancelFail(`${ROUTE}: the ${name} cancel does not email the customer AFTER the transaction commits`);
      if (!/email: emailStatus,/.test(lane)) cancelFail(`${ROUTE}: the ${name} cancel does not report email.sent in its envelope`);
    }
    if (!/const emailStatus = await sendCancellationEmail\(owned, accountEmail, \{ kind: 'cancelled', moneyEvents, vouchers: \[\], providerStatus: landed\.parsed\.status \}\);/.test(hotel)) cancelFail(`${ROUTE}: the hotel email is not rendered from the money_events rows the transaction wrote`);
    if (!/\? \{ kind: 'cancelled', moneyEvents: decision\.moneyEvents, vouchers: decision\.vouchers, providerStatus: landed\.parsed\.status \}\s*: \{ kind: 'cancel_pending' \}/.test(flight)) cancelFail(`${ROUTE}: the flight email is not the final figures from the rows on a 200, or the pending template on a 202`);
    // The email function ends where the next declaration begins (statusRefusal) — never a comment anchor, never a character count.
    const sender = route.slice(route.indexOf('async function sendCancellationEmail('), route.indexOf('function statusRefusal('));
    if (!sender) cancelFail(`${ROUTE} has no sendCancellationEmail`);
    if (!/const recipient = cancelRecipient\(owned, accountEmail\);/.test(sender)) cancelFail(`${ROUTE}: the recipient is not resolved by the one rule (cancelRecipient)`);
    if (!/return \{ sent: false, error: recipient\.reason \};/.test(sender)) cancelFail(`${ROUTE}: a missing recipient is not reported by name with no send`);
    if (!/catch \(emailErr\)/.test(sender) || /throw |return NextResponse/.test(sender.slice(sender.indexOf('catch (emailErr)')))) cancelFail(`${ROUTE}: an email failure would fail the cancel`);
    if (!/cancellationEmailFacts\(outcome\.moneyEvents, outcome\.vouchers\)/.test(sender)) cancelFail(`${ROUTE}: the email figures are not read from the rows`);
    for (const banned of ['userEmail ??', 'accountEmail ??', 'guestEmail ??', '?? accountEmail', '?? owned.guestEmail', 'retry', 'setTimeout']) {
      if (sender.includes(banned)) cancelFail(`${ROUTE}: the email path carries a fallback or a retry (${banned})`);
    }
  }
  {
    const leaf = codeOf(LEAF);
    if (!/if \(row\.bookingType === 'account'\) \{/.test(leaf) || !/return guest\.length > 0 \? \{ to: guest \} : \{ to: null, reason: 'no_recipient_stated' \};/.test(leaf)) cancelFail(`${LEAF}: cancelRecipient does not send an account row to the account and a guest row to its stated guestEmail, else nobody by name`);
    if (/accountEmail \?\? |guestEmail \?\? |\?\? accountEmail|\?\? row\.guestEmail/.test(leaf)) cancelFail(`${LEAF}: cancelRecipient falls back from one address to another`);
    const tpl = codeOf('src/lib/emailTemplates/lifecycle.ts');
    if (!/not stated by the vendor/.test(tpl)) cancelFail('src/lib/emailTemplates/lifecycle.ts: a NULL amount is not said as "not stated by the vendor"');
    if (!/We will email you again when the vendor confirms the refund was issued\./.test(tpl)) cancelFail('src/lib/emailTemplates/lifecycle.ts: the cancelled email does not state the next email');
    for (const kind of ["'cancelled'", "'cancel_pending'", "'ticketed'", "'hotel_confirmation_arrived'"]) if (!tpl.includes(`case ${kind}:`)) cancelFail(`src/lib/emailTemplates/lifecycle.ts lacks the ${kind} template`);
    // The two STATUS-01 slots are fired by exactly two files (STATUS-01, 2026-09-26):
    // the apply leaf decides an email is owed, the sender renders and sends it.
    const LIFECYCLE_FIRERS = ['src/lib/reservations/applyVendorState.ts', 'src/lib/reservations/lifecycleSend.ts'];
    for (const { file, src } of srcFiles) {
      if (file === 'src/lib/emailTemplates/lifecycle.ts' || LIFECYCLE_FIRERS.includes(file)) continue;
      if (/kind: 'ticketed'|kind: 'hotel_confirmation_arrived'/.test(src)) cancelFail(`${file} fires the ${/ticketed/.test(src) ? 'ticketed' : 'hotel_confirmation_arrived'} lifecycle email — STATUS-01 owns that, through the apply leaf and the sender only`);
    }
    for (const f of LIFECYCLE_FIRERS) if (!/kind: 'ticketed'/.test(codeOf(f)) || !/kind: 'hotel_confirmation_arrived'/.test(codeOf(f))) cancelFail(`${f} no longer carries both STATUS-01 kinds — a slot lost its caller`);
  }
  if (!/item 8/.test(commentsOf('prisma/migrations/20260926090000_cancel_01_money_events/migration.sql'))) cancelFail('the CANCEL-01 migration does not name item 8 (refund matching) as the settled status owner');

  if (cancelViolations === 0) console.log(`✔ The cancel law passed — the cancel route reads the lane and sends a hotel to PUT /v3.0/bookings/{id} and a flight to POST /flights/bookings/{id}/cancellations, refusing any other lane and a vendor 409 by name before any write; the quote is metered (${dailyCap('liteapiflightcancelquote')}/day) and rendered before any Cancel control; both lanes write money_events rows pointed at the arrival with NULL, never 0, for an unstated amount and none on a 202; cancelIntentAt is the vendor word from one metered GET; the refresh does not undo a pending cancel; a final cancel marks the day and moves the margin; both lanes email the customer after the commit from the rows, to the one recipient the rule states or to nobody by name, never failing the cancel (CANCEL-02); the two STATUS-01 slots are fired only by the apply leaf and the sender (STATUS-01).`);
  else console.log(`✖ The cancel law FAILED — ${cancelViolations} violation(s).`);
});

// ── THE STATUS LAW (STATUS-01, 2026-09-26) ──────────────────────────────────
// THE VENDOR'S CURRENT TRUTH REACHES EVERY RESERVATION.
//
// WHAT THIS CLOSES. On main 53900e67 a reservation's status was read from the
// vendor at exactly two moments — the flight book route's one refresh and the
// cancel route's one GET after a 202 — never on a schedule and never on a
// vendor event: getBookingStatus had zero callers and there was no LiteAPI
// webhook. A hotel's confirmation number that arrived after booking showed "—"
// forever; a flight was never marked ticketed; a cancel_pending never resolved.
// And the hotel status word was fabricated twice: the book route turned any word
// but CONFIRMED into pending and a missing word into CONFIRMED; parseBookResult
// defaulted an absent status to 'CONFIRMED'.
//
// THE DESIGN PRINCIPLE, non-negotiable: A WEBHOOK IS A HINT. THE GET IS THE
// TRUTH. No field is ever applied from a webhook payload. Every delivery is
// authenticated, lands its bytes, dedupes, finds OUR reservation by
// providerBookingId, and if one exists re-reads the vendor with GET and applies
// from THAT answer, through ONE apply leaf (applyVendorState) that is the only
// writer of the five new columns and the only place a post-booking read changes
// a reservation. The scheduled refresh and the retro come through the same leaf.
//
//   1. THE RECEIVER: per-IP rate limit in its own bucket; LITEAPI_WEBHOOK_TOKEN
//      required (500 by name) and the authorization header EQUAL to it in
//      constant time (401) — before a byte is stored; the bytes landed before any
//      parse; duplicate → 200 without a vendor call; an undocumented event and a
//      booking that is not ours → 200 without a vendor call; the delivery's answer
//      is read for the booking id and NOTHING else; no vendor call and no status
//      write in the route — the read leaf owns both. Public in the middleware.
//   2. ONE WRITER of ticketedAt, ticketLimitTime, lastVendorReadAt,
//      ticketedEmailSentAt, confirmationEmailSentAt: the apply leaf; and it reads
//      no clock — lastVendorReadAt is the landed answer's own instant.
//   3. EACH LIFECYCLE EMAIL AT MOST ONCE: the marker rides the SAME write as the
//      change that earned it, only when null; the two kinds are fired only from
//      the apply leaf and the sender; the sender makes ONE attempt, audit-logs a
//      failure by name and never retries or substitutes an address; every caller
//      sends after its transaction.
//   4. NO DEFAULT STATUS WORD anywhere in src: no `?? 'CONFIRMED'`, no
//      `|| 'CONFIRMED'`, no `?? 'pending'`, no `?? 'confirmed'`.
//   5. THE TWO LANE LEAVES are the only files that turn a vendor status word into
//      ours; both list every documented word by name; the hotel book route maps
//      through the hotel leaf and records pending BY NAME for an absent or
//      unlisted word; parseBookResult states null for an absent status.
//   6. THE READ LEAF: the cap, then the GET by lane, then ONE transaction that
//      LOCKS THE ROW (STATUS-01b, 2026-09-26: re-selected by id FOR UPDATE before
//      anything is landed or applied; the apply and the refresh take the LOCKED
//      row, never the caller's), lands and applies; a GET that throws is
//      read_failed with nothing written; the commission moves exactly as the
//      cancel route moves it; the refresh applies the status whether or not the
//      answer carries a segment (STATUS-01b).
//   7. THE CRON: the auto-categorize pattern (Bearer CRON_SECRET; 500 by name;
//      401) before any query; the non-final selection; oldest read first, NULL
//      first; a NAMED batch bound; a cap refusal stops the batch; per-row
//      outcomes in the body; registered hourly in vercel.json — and REACHABLE
//      (STATUS-01b): every cron path but auto-categorize exports GET, has an
//      EXACT-path middleware bypass (the audit-ingest convention), and answers
//      401 before any prisma call.
//   8. THE MIGRATION, THE SCHEMA, THE RULE BOOK: five nullable TIMESTAMPTZ
//      columns with no default; webhook_events with its six-word CHECK, its
//      partial UNIQUE dedupe and its RESTRICT foreign key to arrivals; nothing
//      backfilled; liteapi · booking_read is a snapshot and liteapi · webhook an
//      event in the rule book.
//   9. THE RETRO runs the one read leaf over EVERY reservation, rehearses with
//      --dry-run, stops on the cap by name, and grows no implementation of its own.
lawGuard('The status law', () => {
  let statusViolations = 0;
  const statusFail = (m: string) => { statusViolations += 1; violations.push(`status law: ${m} (STATUS-01)`); };

  const APPLY = 'src/lib/reservations/applyVendorState.ts';
  const HOTEL_LEAF = 'src/lib/reservations/hotelStatus.ts';
  const FLIGHT_LEAF = 'src/lib/reservations/flightStatus.ts';
  const READ_LEAF = 'src/lib/reservations/vendorRead.ts';
  const SENDER = 'src/lib/reservations/lifecycleSend.ts';
  const REFRESH = 'src/lib/reservations/refreshFlightReservation.ts';
  const WEBHOOK_ROUTE = 'src/app/api/webhooks/liteapi/route.ts';
  const WEBHOOK_LEAF = 'src/lib/webhooks/liteapiWebhook.ts';
  const CRON_ROUTE = 'src/app/api/cron/reservations-refresh/route.ts';
  const HOTEL_BOOK = 'src/app/api/travel/liteapi/book/route.ts';
  const FLIGHT_BOOK = 'src/app/api/travel/liteapi/flights/book/route.ts';
  const HOTEL_CLIENT = 'src/lib/liteapiClient.ts';
  const CANCEL_ROUTE = 'src/app/api/reservations/[id]/cancel/route.ts';
  const RETRO = 'scripts/status-01-retro-reservations.ts';
  const LANE_RETRO = 'scripts/lane-01-retro-flights.ts';
  const STATUS_MIGRATION = ALL_MIGRATIONS.find((m) => /_status_01_/.test(m.dir));
  const FIVE = ['ticketedAt', 'ticketLimitTime', 'lastVendorReadAt', 'ticketedEmailSentAt', 'confirmationEmailSentAt'];

  // 1. THE RECEIVER NEVER APPLIES A PAYLOAD FIELD.
  {
    const r = codeOf(WEBHOOK_ROUTE);
    const steps = [
      ['rateLimit(`liteapi-webhook:${ip}`', 'is not rate-limited per IP in its own bucket'],
      ['process.env.LITEAPI_WEBHOOK_TOKEN', 'does not require LITEAPI_WEBHOOK_TOKEN'],
      ["{ error: 'Webhook not configured' }, { status: 500 }", 'does not answer 500 by name when the token is not configured'],
      ['if (given === null || !constantTimeEqual(given, expected)) {', 'does not refuse an absent or unequal authorization header (an absent header is not refused, or the compare is loose)'],
      ["{ error: 'Unauthorized' }, { status: 401 }", 'does not answer 401 to a wrong token'],
      ['request.arrayBuffer()', 'never reads the delivery bytes'],
      ['landLiteApiWebhookBytes(', 'does not land the bytes'],
      ['parseLiteApiWebhookDelivery(body)', 'does not parse the documented envelope'],
      ['landLiteApiWebhookEvent(', 'does not land the event arrival'],
      ["outcome: { not: 'duplicate' }", 'does not look for an already-acted event before the vendor call'],
      ["if (acted !== null) {\n      await record('duplicate', null);", 'acts on a duplicate delivery instead of recording it'],
      ["laneOfWebhookEvent(eventName) === null", 'does not refuse an undocumented event by name'],
      ["record('unknown_event', null)", 'does not record unknown_event'],
      ["if (row === null) {\n      await record('unknown_booking', null);", 'reads the vendor for a booking that is not ours instead of recording unknown_booking'],
      ["readAndApplyReservation(row, { source: 'webhook' })", 'does not re-read the vendor through the one read leaf'],
      ["record('read_failed', null)", 'does not record read_failed'],
      ['record(read.outcome, new Date())', 'does not record the applied/unchanged outcome with actedAt'],
    ];
    let last = -1;
    for (const [needle, why] of steps) {
      const i = r.indexOf(needle);
      if (i < 0) { statusFail(`${WEBHOOK_ROUTE} ${why}`); continue; }
      if (i < last) statusFail(`${WEBHOOK_ROUTE}: "${needle.slice(0, 40)}" comes before the step it must follow — the receiver runs rate limit → token → bytes → envelope → duplicate → unknown → the GET, in that order`);
      last = Math.max(last, i);
    }
    const postAt = r.indexOf('export async function POST(');
    const at401 = r.indexOf("{ error: 'Unauthorized' }, { status: 401 }");
    if (postAt >= 0 && at401 > postAt && /arrayBuffer|landLiteApi|prisma\./.test(r.slice(postAt, at401))) statusFail(`${WEBHOOK_ROUTE} reads the bytes or touches a table before the token check passes — nothing lands on a 500 or a 401 (bytes before the token)`);
    if (!/authorization: given === null \? 'absent' : `present, \$\{given\.length\} chars/.test(r)) statusFail(`${WEBHOOK_ROUTE}: the 401 log does not name the header shape (absent / length / Bearer-prefixed)`);
    if ((r.match(/delivery\.response/g) ?? []).length !== 1 || !/resolveWebhookBookingId\(eventName, delivery\.response\)/.test(r)) statusFail(`${WEBHOOK_ROUTE} reads the delivery answer for something other than the booking id — a webhook is a hint`);
    if ((r.match(/delivery\.payload/g) ?? []).length !== 1) statusFail(`${WEBHOOK_ROUTE} reads the delivery payload beyond landing it`);
    if (/getHotelBooking|getFlightBooking/.test(r)) statusFail(`${WEBHOOK_ROUTE} calls the vendor itself — the read leaf owns the GET, the cap and the landing`);
    if (/reservations\.update|status: '(pending|confirmed|cancelled|failed)'/.test(r)) statusFail(`${WEBHOOK_ROUTE} writes a reservation — the receiver applies nothing; the apply leaf does`);
    if (/'(CONFIRMED|CANCELLED|CANCELED|TICKETED|FAILED|EXPIRED)'/.test(r)) statusFail(`${WEBHOOK_ROUTE} carries a vendor status word — the receiver never reads one`);
    if (!/err instanceof Prisma\.PrismaClientKnownRequestError && err\.code === 'P2002'/.test(r)) statusFail(`${WEBHOOK_ROUTE} does not honour the partial unique dedupe (P2002 → duplicate)`);
    if (!/export const dynamic = 'force-dynamic';/.test(r)) statusFail(`${WEBHOOK_ROUTE} is not force-dynamic`);
    const leaf = codeOf(WEBHOOK_LEAF);
    if (!/return timingSafeEqual\(a, b\);/.test(leaf) || !/if \(a\.length !== b\.length\) return false;/.test(leaf)) statusFail(`${WEBHOOK_LEAF} does not compare the token in constant time (timingSafeEqual over equal-length buffers)`);
    if (/startsWith|toLowerCase|includes\(given/.test(leaf.slice(leaf.indexOf('export function constantTimeEqual'), leaf.indexOf('export type ParsedDelivery')))) statusFail(`${WEBHOOK_LEAF} compares the token loosely`);
    if (!/'\/api\/webhooks\/liteapi',/.test(codeOf('src/middleware.ts'))) statusFail(`src/middleware.ts: /api/webhooks/liteapi is not a listed public path — the vendor holds no session and the token is the gate`);
  }

  // 2. ONE WRITER of the five columns, and it reads no clock.
  {
    const apply = codeOf(APPLY);
    for (const col of FIVE) if (!new RegExp(`patch\\.${col} = |${col}: vendor\\.readAt`).test(apply)) statusFail(`${APPLY} no longer writes ${col}`);
    if (!/const patch: ReservationPatch = \{ lastVendorReadAt: vendor\.readAt \};/.test(apply)) statusFail(`${APPLY}: lastVendorReadAt is not the landed answer instant (vendor.readAt)`);
    if (/new Date\(\)/.test(apply)) statusFail(`${APPLY} reads the clock`);
    const writer = /patch\.(ticketedAt|ticketLimitTime|lastVendorReadAt|ticketedEmailSentAt|confirmationEmailSentAt) =|(ticketedAt|ticketLimitTime|lastVendorReadAt|ticketedEmailSentAt|confirmationEmailSentAt): (new Date|vendor\.|readAt|at\b)/;
    for (const { file, src } of srcFiles) {
      if (file === APPLY) continue;
      if (writer.test(src)) statusFail(`${file} writes ${(src.match(writer) as RegExpMatchArray)[0].trim()} — applyVendorState is the only writer of the five STATUS-01 columns`);
    }
    for (const f of [RETRO, LANE_RETRO]) if (writer.test(codeOf(f))) statusFail(`${f} writes a STATUS-01 column itself — the apply leaf is the only writer`);
  }

  // 3. EACH LIFECYCLE EMAIL AT MOST ONCE.
  {
    const apply = codeOf(APPLY);
    if (!/if \(row\.confirmationEmailSentAt === null\) \{\s*patch\.confirmationEmailSentAt = vendor\.readAt;\s*emails\.push\(\{ kind: 'hotel_confirmation_arrived', confirmationCode: statedCode \}\);/.test(apply)) statusFail(`${APPLY}: the hotel_confirmation_arrived marker does not ride the same write as the code, guarded on a null marker`);
    if (!/if \(row\.ticketedEmailSentAt === null\) \{\s*patch\.ticketedEmailSentAt = vendor\.readAt;\s*emails\.push\(\{ kind: 'ticketed' \}\);/.test(apply)) statusFail(`${APPLY}: the ticketed marker does not ride the same write as ticketedAt, guarded on a null marker`);
    const firers = ['src/lib/emailTemplates/lifecycle.ts', APPLY, SENDER];
    for (const { file, src } of srcFiles) {
      if (firers.includes(file)) continue;
      if (/kind: 'ticketed'|kind: 'hotel_confirmation_arrived'/.test(src)) statusFail(`${file} fires a lifecycle email kind — only the apply leaf decides and only the sender renders (a third file carries a lifecycle email kind)`);
    }
    const sender = codeOf(SENDER);
    if (!/description: `lifecycle_email_failed — \$\{request\.kind\} for reservation \$\{row\.id\}: \$\{errorClass\}`/.test(sender)) statusFail(`${SENDER}: a failed send is not written to audit_log by name (lifecycle_email_failed)`);
    if (/setTimeout|for \(let attempt|retries|while \(/.test(sender)) statusFail(`${SENDER} retries a send — the marker means the one attempt was made`);
    if (/accountEmail \?\? |guestEmail \?\? |\?\? accountEmail|\?\? row\.guestEmail/.test(sender)) statusFail(`${SENDER} falls back from one address to another`);
    if (!/cancelRecipient\(row, await accountEmailOf\(row\)\)/.test(sender)) statusFail(`${SENDER} does not pick the recipient by the CANCEL-02 rule`);
    const read = codeOf(READ_LEAF);
    if (!(read.indexOf('for (const request of applied.emails) emails.push(await sendLifecycleEmail(emailRow, request));') > read.indexOf('prisma.$transaction(async (tx) => {'))) statusFail(`${READ_LEAF} sends before its transaction commits`);
    if (!/if \(!opts\.dryRun\) \{\s*const emailRow/.test(read)) statusFail(`${READ_LEAF} sends on a dry run`);
    const fb = codeOf(FLIGHT_BOOK);
    if (!(fb.indexOf('for (const request of refreshed.emails)') > fb.indexOf('catch (calErr)'))) statusFail(`${FLIGHT_BOOK} does not attempt the emails the refresh owes after its refresh block`);
    if (!/for \(const request of outcome\.emails\)/.test(codeOf(LANE_RETRO))) statusFail(`${LANE_RETRO} writes the markers and never makes the one attempt`);
  }

  // 4. NO DEFAULT STATUS WORD ANYWHERE IN SRC.
  for (const { file, src } of srcFiles) {
    const m = src.match(/\?\? 'CONFIRMED'|\|\| 'CONFIRMED'|\?\? 'pending'|\?\? 'confirmed'/);
    if (m) statusFail(`${file} defaults a status (${m[0]}) — the vendor is the only source of a status word`);
  }

  // 5. THE TWO LANE LEAVES ARE THE ONLY MAPPERS.
  {
    const VENDOR = /=== '(CONFIRMED|CANCELED|CANCELLED|CANCELLED_WITH_CHARGES|TICKETED|CREATED|PENDING_CONFIRMATION|PENDING|FAILED|EXPIRED)'/;
    const OURS = /return '(pending|confirmed|cancelled|failed)'/;
    for (const { file, src } of srcFiles) {
      if (file === HOTEL_LEAF || file === FLIGHT_LEAF) continue;
      if (VENDOR.test(src) && OURS.test(src)) statusFail(`${file} turns a vendor status word into ours outside the two leaves`);
    }
    for (const f of [HOTEL_BOOK, FLIGHT_BOOK, REFRESH, APPLY, READ_LEAF, WEBHOOK_ROUTE, CRON_ROUTE, CANCEL_ROUTE]) {
      if (VENDOR.test(codeOf(f))) statusFail(`${f} compares a vendor status word — only the two lane leaves may`);
    }
    const hotel = codeOf(HOTEL_LEAF);
    for (const w of ["s === 'CONFIRMED'", "s === 'CANCELED' || s === 'CANCELLED' || s === 'CANCELLED_WITH_CHARGES'", "s === 'FAILED'"]) if (!hotel.includes(w)) statusFail(`${HOTEL_LEAF} no longer lists ${w} by name`);
    if (!/return null;\s*\}\s*$/.test(hotel.trimEnd() + '\n')) statusFail(`${HOTEL_LEAF} does not answer null for an unlisted word`);
    const flight = codeOf(FLIGHT_LEAF);
    for (const w of ["s === 'CREATED' || s === 'PENDING_CONFIRMATION' || s === 'PENDING'", "s === 'CONFIRMED' || s === 'TICKETED'", "s === 'CANCELLED' || s === 'CANCELLED_WITH_CHARGES'", "s === 'FAILED' || s === 'EXPIRED'"]) if (!flight.includes(w)) statusFail(`${FLIGHT_LEAF} no longer lists ${w} by name`);
    const book = codeOf(HOTEL_BOOK);
    if (!/const mappedStatus = hotelProviderStatusToReservation\(parsed\.status\);/.test(book)) statusFail(`${HOTEL_BOOK} does not map the status through ${HOTEL_LEAF}`);
    if (!/const status = mappedStatus === null \? 'pending' : mappedStatus;/.test(book)) statusFail(`${HOTEL_BOOK} does not record pending for exactly an unlisted or absent word`);
    if (!/STATUS-01 the vendor stated \$\{parsed\.status === null \? 'NO status' : `status "\$\{parsed\.status\}", a word the hotel leaf does not list`\} — recorded pending/.test(book)) statusFail(`${HOTEL_BOOK} does not say by name which word it recorded pending for`);
    if (!/status: typeof d\.status === 'string' \? d\.status : null,/.test(codeOf(HOTEL_CLIENT))) statusFail(`${HOTEL_CLIENT}: parseBookResult does not state null for an absent status`);
  }

  // 6. THE READ LEAF.
  {
    const r = codeOf(READ_LEAF);
    const i = (needle: string) => r.indexOf(needle);
    if (!(i("reserveTravelSearch('liteapi')") >= 0 && i("reserveTravelSearch('liteapi')") < i('await getHotelBooking(row.providerBookingId)'))) statusFail(`${READ_LEAF} does not reserve the liteapi cap before the GET`);
    if (!/return \{ outcome: 'read_failed', kind: 'vendor', reason: `\$\{tag\}: GET of \$\{lane\} booking \$\{row\.providerBookingId\} failed/.test(r)) statusFail(`${READ_LEAF}: a GET that throws is not read_failed by name`);
    const fnAt = i('export async function readAndApplyReservation(');
    const readAt = i('const readAt = read.answer.arrived;');
    if (fnAt < 0 || readAt < 0) statusFail(`${READ_LEAF} lost its shape (readAndApplyReservation / read.answer.arrived)`);
    else if (/writeReservation|reservations\.update|applyVendorState/.test(r.slice(fnAt, readAt))) statusFail(`${READ_LEAF} writes before the answer is in hand`);
    // STATUS-01b: ONE READ HOLDS THE ROW. The transaction re-selects the row FOR
    // UPDATE before anything is landed or applied, and the apply and the refresh
    // take the LOCKED row — never the caller's.
    const txAt = i('prisma.$transaction(async (tx) => applyLockedRead(');
    const forAt = i('FOR UPDATE');
    if (txAt < 0) statusFail(`${READ_LEAF} does not run the locked read inside prisma.$transaction (applyLockedRead)`);
    else if (!(forAt > txAt && /lock: async \(id\) => \(await tx\.\$queryRaw<VendorReadRow\[\]>`SELECT \$\{LOCK_COLUMNS\} FROM reservations WHERE id = \$\{id\}::uuid FOR UPDATE`\)\[0\] \?\? null,/.test(r))) statusFail(`${READ_LEAF} does not lock the row (no FOR UPDATE re-select of every VENDOR_READ_SELECT column inside its transaction)`);
    const lockedFn = functionBody(r, 'applyLockedRead') ?? '';
    if (!lockedFn) statusFail(`${READ_LEAF} does not export applyLockedRead`);
    else {
      const j = (needle: string) => lockedFn.indexOf(needle);
      if (!(j('const locked = await ports.lock(caller.id);') >= 0 && j('const locked = await ports.lock(caller.id);') < j('landLiteApiBookingRead(') && j('landLiteApiBookingRead(') < j('applyVendorState('))) statusFail(`${READ_LEAF}: the lock is not taken before the landing and the apply`);
      if (!/if \(locked === null\) throw new Error\(/.test(lockedFn)) statusFail(`${READ_LEAF}: a row gone between the GET and the lock is not a named throw (read_failed)`);
      if (!/applyVendorState\(ports\.apply, locked, \{\s*lane: 'hotel'/.test(lockedFn) || !/refreshFlightReservation\(\{ \.\.\.ports\.apply, calendar: ports\.calendar, fetchBooking: async \(\) => \(\{ \.\.\.landed\.parsed, readAt \}\) \}, locked\)/.test(lockedFn)) statusFail(`${READ_LEAF}: the apply or the refresh does not take the locked row`);
      if (/applyVendorState\([^;]*\bcaller\b|\}, caller\)|\brow\b/.test(lockedFn)) statusFail(`${READ_LEAF}: applyLockedRead applies to the caller row, never the locked one`);
      if (!/userId: locked\.userId/.test(lockedFn)) statusFail(`${READ_LEAF}: the landing takes its owner from the caller row, not the locked one`);
    }
    if (!/takes NO lock/.test(commentsOf(READ_LEAF))) statusFail(`${READ_LEAF}: the header does not say the dry run takes no lock`);
    if (!/cancelCommission: async \(reservationId\) => \(await tx\.commission_ledger\.updateMany\(\{ where: \{ reservationId, status: 'estimated' \}, data: \{ status: 'cancelled' \} \}\)\)\.count,/.test(r)) statusFail(`${READ_LEAF} does not move the estimated commission exactly as the cancel route does`);
    if (!/calendar: prismaBookingCalendar\(tx\),/.test(r)) statusFail(`${READ_LEAF} does not mark the day through the CAL-01 port inside the transaction`);
    if (/new Date\(\)/.test(r)) statusFail(`${READ_LEAF} reads the clock`);
    // 6b. THE REFRESH: the status is independent of the segments (STATUS-01b). The
    //     GET failure is the ONE fetched:false; a segment-less answer names no row
    //     and no rename and still hands the status to the apply leaf.
    const refresh = codeOf(REFRESH);
    if ((refresh.match(/fetched: false,/g) ?? []).length !== 1) statusFail(`${REFRESH} applies no status when the answer has no OUTBOUND segment — the fetched:false return is the GET failure only`);
    if (!/landed: 'no_row',\s*reason: stated\.segments\.length === 0/.test(refresh)) statusFail(`${REFRESH} does not name a segment-less answer as no row, no rename`);
    if ((refresh.match(/no status change/g) ?? []).length !== 1) statusFail(`${REFRESH}: only the GET failure may say no status change`);
    if (!/^\s*const applied = await applyVendorState\(/m.test(refresh)) statusFail(`${REFRESH} does not hand the status to the apply leaf unconditionally`);
  }

  // 7. THE CRON.
  {
    const r = codeOf(CRON_ROUTE);
    if (!/if \(!cronSecret\) \{\s*console\.error\('CRON_SECRET not configured'\);\s*return NextResponse\.json\(\s*\{ error: 'Cron not configured' \},\s*\{ status: 500 \}/.test(r)) statusFail(`${CRON_ROUTE} does not answer 500 by name when CRON_SECRET is unset`);
    if (!/if \(authHeader !== `Bearer \$\{cronSecret\}`\) \{\s*console\.error\('Unauthorized cron attempt'\);\s*return NextResponse\.json\(\s*\{ error: 'Unauthorized' \},\s*\{ status: 401 \}/.test(r)) statusFail(`${CRON_ROUTE} does not refuse a wrong CRON_SECRET with 401 (the auto-categorize pattern)`);
    if (!(r.indexOf('{ status: 401 }') >= 0 && r.indexOf('{ status: 401 }') < r.indexOf('prisma.reservations.findMany'))) statusFail(`${CRON_ROUTE} queries before it refuses`);
    if (!/\nconst BATCH = \d+;/.test(r) || !/take: BATCH,/.test(r)) statusFail(`${CRON_ROUTE}: the batch is unbounded or its bound is not named (BATCH)`);
    if (!/hourly runs/.test(commentsOf(CRON_ROUTE)) || !/reads\/day/.test(commentsOf(CRON_ROUTE))) statusFail(`${CRON_ROUTE} does not say why the bound is what it is against the daily cap`);
    for (const must of ["provider: 'liteapi',", "{ status: { in: ['pending', 'cancel_pending'] } },", "{ lane: 'flight', status: 'confirmed', ticketedAt: null },", "{ lane: 'hotel', status: 'confirmed', providerConfirmationCode: null },", "orderBy: [{ lastVendorReadAt: { sort: 'asc', nulls: 'first' } }, { createdAt: 'asc' }],", "readAndApplyReservation(row, { source: 'cron' })", "if (out.kind === 'quota') { stopped = out.reason; break; }", 'return NextResponse.json({ ...summary, rows: perRow });', 'export async function GET(request: NextRequest) { return run(request); }']) {
      if (!r.includes(must)) statusFail(`${CRON_ROUTE} lacks "${must}"`);
    }
    let vercel: { crons?: Array<{ path: string; schedule: string }> } = {};
    try { vercel = JSON.parse(codeOf('vercel.json')); } catch { statusFail('vercel.json does not parse'); }
    const cron = (vercel.crons ?? []).find((c) => c.path === '/api/cron/reservations-refresh');
    if (!cron) statusFail('vercel.json: /api/cron/reservations-refresh is not registered in vercel.json');
    else if (cron.schedule !== '0 * * * *') statusFail(`vercel.json: /api/cron/reservations-refresh is scheduled "${cron.schedule}", not hourly`);
    // STATUS-01b (2026-09-26): THE CRON REACHES ITS HANDLER. src/middleware.ts's
    // matcher covers every path and redirects a cookie-less request to "/", so a
    // cron path needs an EXACT-path bypass (the audit-ingest convention: not a
    // PUBLIC_PATHS entry, not a prefix) and the route validates the bearer FIRST.
    // auto-categorize is left as it is — whether it should ever run is a
    // separate decision, reported, unchanged.
    const middlewareCode = codeOf('src/middleware.ts');
    for (const c of (vercel.crons ?? []).filter((c) => c.path !== '/api/cron/auto-categorize')) {
      const routeFile = `src/app${c.path}/route.ts`;
      let routeCode = '';
      try { routeCode = codeOf(routeFile); } catch { statusFail(`vercel.json: cron ${c.path} has no route at ${routeFile}`); continue; }
      if (!/export async function GET\(/.test(routeCode)) statusFail(`${routeFile} does not export GET — Vercel invokes a cron by GET`);
      if (!middlewareCode.includes(`if (pathname === '${c.path}') {\n    return NextResponse.next();\n  }`)) statusFail(`src/middleware.ts: cron ${c.path} has no exact-path middleware bypass — the catch-all matcher redirects the cookie-less GET to / before the handler runs`);
      if (new RegExp(`'${c.path.replace(/[/]/g, '\\/')}',`).test(middlewareCode)) statusFail(`src/middleware.ts: cron ${c.path} is listed in PUBLIC_PATHS — the bypass is the exact path, not a public entry`);
      const at401 = routeCode.indexOf('{ status: 401 }');
      const atPrisma = routeCode.indexOf('prisma.');
      if (!(at401 >= 0 && (atPrisma < 0 || at401 < atPrisma))) statusFail(`${routeFile} touches prisma before it answers 401`);
    }
  }

  // 8. THE MIGRATION, THE SCHEMA, THE RULE BOOK.
  if (!STATUS_MIGRATION) statusFail('no prisma/migrations/*_status_01_*/migration.sql');
  else {
    // The code half: the header comment names the words this clause forbids.
    const sql = codeOf(`prisma/migrations/${STATUS_MIGRATION.dir}/migration.sql`);
    for (const col of FIVE) if (!sql.includes(`ALTER TABLE "reservations" ADD COLUMN "${col}" TIMESTAMPTZ(6);`)) statusFail(`the STATUS-01 migration does not add reservations.${col} as a nullable TIMESTAMPTZ(6) with no default`);
    for (const must of ['CREATE TABLE "webhook_events"', `CHECK ("outcome" IN ('applied', 'unchanged', 'unknown_booking', 'unknown_event', 'duplicate', 'read_failed'))`, `CREATE UNIQUE INDEX "webhook_events_eventId_acted_key" ON "webhook_events"("eventId") WHERE "outcome" <> 'duplicate';`, '"arrivalId"  TEXT           NOT NULL,', 'FOREIGN KEY ("arrivalId") REFERENCES "arrivals"("id") ON DELETE RESTRICT']) {
      if (!sql.includes(must)) statusFail(`the STATUS-01 migration lacks "${must}" (no partial unique dedupe, no CHECK, or no RESTRICT foreign key)`);
    }
    if (/^\s*UPDATE\b/im.test(sql)) statusFail('the STATUS-01 migration backfills — the retro reads the vendor, nothing is inferred');
    if (/DEFAULT/.test(sql.replace('DEFAULT gen_random_uuid()', ''))) statusFail('the STATUS-01 migration defaults a stated field');
  }
  for (const col of FIVE) if (!new RegExp(`\\n  ${col}\\s+DateTime\\? @db\\.Timestamptz\\(6\\)\\n`).test(schemaText)) statusFail(`prisma/schema.prisma: reservations.${col} is not a nullable Timestamptz(6) with no @default`);
  {
    const at = schemaText.indexOf('\nmodel webhook_events {');
    const block = at >= 0 ? schemaText.slice(at, schemaText.indexOf('\n}', at)) : '';
    if (!block) statusFail('prisma/schema.prisma: no webhook_events model');
    else if (!/arrival arrivals @relation\(fields: \[arrivalId\], references: \[id\], onDelete: Restrict/.test(block)) statusFail('prisma/schema.prisma: webhook_events.arrivalId is not a RESTRICT relation to arrivals');
    if (ruleFor('liteapi', 'booking_read')?.kind !== 'snapshot') statusFail('the rule book does not declare liteapi · booking_read a snapshot');
    if (ruleFor('liteapi', 'webhook')?.kind !== 'event') statusFail('the rule book does not declare liteapi · webhook an event');
  }

  // 9. THE RETRO.
  {
    const r = codeOf(RETRO);
    if (!/readAndApplyReservation\(row, \{ source: 'retro', dryRun/.test(r)) statusFail(`${RETRO} does not run readAndApplyReservation — the retro grows its own implementation`);
    if (!/select: VENDOR_READ_SELECT,/.test(r)) statusFail(`${RETRO} does not read the one select`);
    const q = r.slice(r.indexOf('prisma.reservations.findMany'), r.indexOf('select: VENDOR_READ_SELECT'));
    if (r.indexOf('prisma.reservations.findMany') < 0 || /where:/.test(q)) statusFail(`${RETRO} does not read EVERY reservation`);
    if (!/--dry-run/.test(r)) statusFail(`${RETRO} cannot be rehearsed with --dry-run`);
    if (!/if \(out\.kind === 'quota'\)/.test(r)) statusFail(`${RETRO} does not stop on the cap by name`);
    if (/getHotelBooking|getFlightBooking|applyVendorState|reservations\.update/.test(r)) statusFail(`${RETRO} carries an implementation of its own beside the read leaf`);
  }

  if (statusViolations === 0) console.log(`✔ The status law passed — the LiteAPI receiver authenticates in constant time before a byte lands, lands the bytes before any parse, dedupes, and re-reads the vendor for every event about a booking that is ours, applying from the GET alone; applyVendorState is the only writer of the five STATUS-01 columns and reads no clock; each lifecycle email is attempted at most once with its marker in the same write; no default status word in ${srcFiles.length} source files; the two lane leaves are the only mappers; the read leaf caps, reads, lands and applies in one transaction; the hourly cron follows the cron pattern with a batch of ${(codeOf(CRON_ROUTE).match(/\nconst BATCH = (\d+);/) ?? ['', '?'])[1]}; the migration adds five nullable columns and webhook_events with its partial unique dedupe; the retro reads every reservation through the one leaf.`);
  else console.log(`✖ The status law FAILED — ${statusViolations} violation(s).`);
});

// ── THE COMMISSION LAW (COMM-01, 2026-09-26) ────────────────────────────────
// THE COMMISSION IS THE VENDOR'S STATED FIGURE, NEVER A ZERO, AND IT LOCKS WHEN
// THE VENDOR SAYS IT LOCKS.
//
// WHAT THIS CLOSES. On main 0ef428a6 the hotel book route FABRICATED a
// commission through a fallback chain — the vendor's figure, else a figure the
// BROWSER posted (the confirm page relayed the prebook-time number back), else a
// literal 0; the flight book route wrote a literal 0; the prebook parser
// defaulted an absent commission to 0; commissionAmountCents was NOT NULL so a
// commission the vendor did not state could not be said; status had no CHECK;
// nothing ever wrote confirmed; nothing read the commission the vendor states
// after booking.
//
// THE VENDOR'S RULE (docs.liteapi.travel/docs/revenue-management-and-commission):
// "A booking is confirmed when a guest completes their stay and checks out of
// the hotel. Once this happens, your commission will be locked in and included
// in the next weekly payout." GET /bookings/{id} states `commission` ("The
// total commission amount associated with all rooms on the booking"),
// `distributorCommission`, `clientCommission`, `processingFee`. The flight book
// answer and GET /flights/bookings/{id} document `distributorCommission` and no
// `commission`: the seller's commission is NOT DOCUMENTED for a flight.
//
//   1. THE WRITERS. The two book routes are the only writers of the book-time
//      figure (commissionAmountCents); the apply leaf shapes the locked figures
//      and the read leaf's lock port is the only writer of the locked columns
//      and of status 'confirmed'.
//   2. NO ZERO. No `?? 0`, no literal 0 into commissionAmountCents, anywhere in
//      src; the hotel route writes the vendor's `commission` or NULL with a named
//      log; the flight route writes NULL with the documented reason; the prebook
//      parser states null.
//   3. THE LOCK. Exactly when lane hotel AND the vendor's word maps to confirmed
//      AND row.checkoutDate < vendor.readAt (the landed instant — no clock) AND
//      the GET stated `commission`; through the lock port with the figures, the
//      read instant and the read's arrival; not stated → named, no lock.
//   4. THE CLIENT BODY CARRIES NO COMMISSION: the book route refuses
//      commissionAmountCents by name before any query or vendor call; the confirm
//      page posts none.
//   5. EVERY READER renders NULL as not stated: the checkout panel, the prebook
//      type.
//   6. THE MIGRATION AND THE SCHEMA: commissionAmountCents nullable; the six lock
//      columns; the RESTRICT evidence key; the four-word CHECK; no default; no
//      backfill.
//   7. THE CRON re-reads a checked-out stay whose commission is still estimated,
//      once, to lock; the retro prints the lock; the hotel read parser states the
//      four figures verbatim.
lawGuard('The commission law', () => {
  let commViolations = 0;
  const commFail = (m: string) => { commViolations += 1; violations.push(`commission law: ${m} (COMM-01)`); };

  const APPLY = 'src/lib/reservations/applyVendorState.ts';
  const READ_LEAF = 'src/lib/reservations/vendorRead.ts';
  const HOTEL_BOOK = 'src/app/api/travel/liteapi/book/route.ts';
  const FLIGHT_BOOK = 'src/app/api/travel/liteapi/flights/book/route.ts';
  const HOTEL_CLIENT = 'src/lib/liteapiClient.ts';
  const CONFIRM_PAGE = 'src/app/booking/confirm/page.tsx';
  const PANEL = 'src/components/trips/CheckoutPanel.tsx';
  const CRON_ROUTE = 'src/app/api/cron/reservations-refresh/route.ts';
  const RETRO = 'scripts/status-01-retro-reservations.ts';
  const COMM_MIGRATION = ALL_MIGRATIONS.find((m) => /_comm_01_/.test(m.dir));

  // 1. THE WRITERS.
  for (const { file, src } of srcFiles) {
    if (/commissionAmountCents:/.test(src) && file !== HOTEL_BOOK && file !== FLIGHT_BOOK) commFail(`${file} writes the book-time commission outside the two book routes`);
    if (/lockedCommissionCents:/.test(src) && file !== APPLY && file !== READ_LEAF) commFail(`${file} writes a locked commission figure — only the read leaf's lock port writes commission_ledger's locked columns`);
    if (/commission_ledger\.updateMany\([^;]*status: 'confirmed'/s.test(src) && file !== READ_LEAF) commFail(`${file} writes commission_ledger status confirmed — only the read leaf's lock port does`);
  }
  {
    const r = codeOf(READ_LEAF);
    if (!/lockCommission: async \(reservationId, figures, lockedAt, arrivalId\) => \(await tx\.commission_ledger\.updateMany\(\{\s*where: \{ reservationId, status: 'estimated' \},\s*data: \{\s*status: 'confirmed',\s*lockedCommissionCents: figures\.lockedCommissionCents,\s*distributorCommissionCents: figures\.distributorCommissionCents,\s*clientCommissionCents: figures\.clientCommissionCents,\s*processingFeeCents: figures\.processingFeeCents,\s*lockedAt,\s*lockArrivalId: arrivalId,\s*\},\s*\}\)\)\.count,/.test(r)) commFail(`${READ_LEAF}: the lock port does not move exactly the estimated row to confirmed with the figures, the read instant and the read arrival`);
    if (!/arrivalId: landed\.arrivalId,/.test(r)) commFail(`${READ_LEAF} does not hand the read arrival to the apply leaf as the lock evidence`);
  }

  // 2. NO ZERO.
  for (const { file, src } of srcFiles) {
    if (/commissionAmountCents: 0\b/.test(src)) commFail(`${file} writes a literal 0 commission`);
    if (/commission \?\? 0|commissionAmountCents \?\? 0|statedCommission \?\? 0|commission: 0\b/.test(src)) commFail(`${file} defaults a commission (a 0 is a guess)`);
  }
  {
    const hb = codeOf(HOTEL_BOOK);
    if (!/const statedCommission = typeof parsed\.commission === 'number' \? parsed\.commission : null;/.test(hb)) commFail(`${HOTEL_BOOK} does not take the vendor's stated commission or null`);
    if (!/commissionAmountCents: statedCommission === null \? null : Math\.round\(statedCommission \* 100\),/.test(hb)) commFail(`${HOTEL_BOOK} does not write NULL for an unstated commission`);
    if (!/COMM-01 the vendor stated NO commission on the book answer — commissionAmountCents recorded NULL/.test(hb)) commFail(`${HOTEL_BOOK} does not name an unstated commission by bookingId`);
    if (/resolvedCommission|commissionAmountCents \/ 100/.test(hb)) commFail(`${HOTEL_BOOK} still carries the fallback chain`);
    const fb = codeOf(FLIGHT_BOOK);
    if (!/commissionAmountCents: null,/.test(fb)) commFail(`${FLIGHT_BOOK} does not write NULL for the flight commission (NOT DOCUMENTED)`);
    if (!/NOT DOCUMENTED/.test(commentsOf(FLIGHT_BOOK)) || !/never inferred from a markup/.test(commentsOf(FLIGHT_BOOK))) commFail(`${FLIGHT_BOOK} does not name the documented reason for NULL`);
    const client = codeOf(HOTEL_CLIENT);
    if (!/commission: typeof d\.commission === 'number' \? d\.commission : null,/.test(client)) commFail(`${HOTEL_CLIENT}: the prebook parser defaults the commission instead of stating null`);
    if (!/commission: number \| null;/.test(client)) commFail(`${HOTEL_CLIENT}: PrebookResult.commission is not number | null`);
    for (const must of ['commission: num(d.commission),', 'distributorCommission: num(d.distributorCommission),', 'clientCommission: num(d.clientCommission),', 'processingFee: num(d.processingFee),']) if (!client.includes(must)) commFail(`${HOTEL_CLIENT}: the hotel read parser does not state ${must.split(':')[0]} verbatim`);
  }

  // 3. THE LOCK.
  {
    const leaf = codeOf(APPLY);
    if (!/if \(vendor\.lane === 'hotel' && mapped === 'confirmed'\) \{\s*const afterCheckout = row\.checkoutDate !== null && row\.checkoutDate < vendor\.readAt;/.test(leaf)) commFail(`${APPLY}: the lock does not require lane hotel, a confirmed word and checkoutDate < readAt (does not require checkoutDate < readAt)`);
    if (!/if \(!afterCheckout\) \{\s*commissionLock = \{ outcome: 'before_checkout' \};/.test(leaf)) commFail(`${APPLY}: a read before checkout is not named before_checkout`);
    if (!/else if \(vendor\.commission === null\) \{\s*commissionLock = \{ outcome: 'not_stated' \};/.test(leaf)) commFail(`${APPLY}: the leaf locks without a stated commission`);
    if (!/the vendor stated no commission on the read after checkout — stays estimated/.test(leaf)) commFail(`${APPLY}: an unstated commission after checkout is not named`);
    if (!/const locked = await ports\.lockCommission\(row\.id, figures, vendor\.readAt, vendor\.arrivalId\);/.test(leaf)) commFail(`${APPLY}: the lock reads the clock instead of the read instant, or drops the read arrival`);
    if (/new Date\(\)/.test(leaf)) commFail(`${APPLY}: the lock reads the clock instead of the read instant`);
    if (!/commissionLock = \{ outcome: 'already_locked', cents \};/.test(leaf)) commFail(`${APPLY}: a second read is not named already_locked`);
    if (!/lockedCommissionCents: cents,/.test(leaf) || !/distributorCommissionCents: centsOf\(vendor\.distributorCommission\),/.test(leaf)) commFail(`${APPLY}: the lock figures are not the vendor's, in cents, null when unstated`);
    const body = functionBody(leaf, 'applyVendorState') ?? '';
    if (/\* 0\.|margin|markup/.test(body)) commFail(`${APPLY} computes a commission from a price and a margin`);
    if (!/no estimated commission row moved — a commission already locked/.test(leaf)) commFail(`${APPLY}: a vendor cancel after the lock is not named (no reversal is documented)`);
  }

  // 4. THE CLIENT BODY CARRIES NO COMMISSION.
  {
    const hb = codeOf(HOTEL_BOOK);
    const refuse = hb.indexOf("if (Object.prototype.hasOwnProperty.call(body, 'commissionAmountCents')) {");
    if (refuse < 0 || !/\{ error: 'commissionAmountCents is not accepted — a client never states a ledger amount' \},\s*\{ status: 400 \}/.test(hb)) commFail(`${HOTEL_BOOK} accepts a commission from the client (no 400 by name)`);
    else {
      if (!(refuse < hb.indexOf('prisma.users.findFirst') && refuse < hb.indexOf('bookRate('))) commFail(`${HOTEL_BOOK} refuses the client commission only after a query or the vendor call`);
    }
    if (/commissionAmountCents\?: number|currency, commissionAmountCents,/.test(hb)) commFail(`${HOTEL_BOOK} accepts a commission from the client in its body type`);
    if (/commissionAmountCents/.test(codeOf(CONFIRM_PAGE))) commFail(`${CONFIRM_PAGE}: the confirm page posts a ledger amount`);
  }

  // 5. EVERY READER RENDERS NULL AS NOT STATED.
  {
    const panel = codeOf(PANEL);
    if (!/prebook\.commission === null \? 'not stated' : money\(prebook\.commission, prebook\.currency\)/.test(panel)) commFail(`${PANEL} does not render a NULL commission as not stated`);
    if (/prebook\.commission > 0 &&/.test(panel)) commFail(`${PANEL} hides a commission as if zero`);
    if (!/commission: number \| null;/.test(panel)) commFail(`${PANEL}: the prebook type is not number | null`);
  }

  // 6. THE MIGRATION AND THE SCHEMA.
  if (!COMM_MIGRATION) commFail('no prisma/migrations/*_comm_01_*/migration.sql');
  else {
    const sql = codeOf(`prisma/migrations/${COMM_MIGRATION.dir}/migration.sql`);
    for (const must of ['ALTER TABLE "commission_ledger" ALTER COLUMN "commissionAmountCents" DROP NOT NULL;', 'ADD COLUMN "lockedCommissionCents"      INTEGER;', 'ADD COLUMN "distributorCommissionCents" INTEGER;', 'ADD COLUMN "clientCommissionCents"      INTEGER;', 'ADD COLUMN "processingFeeCents"         INTEGER;', 'ADD COLUMN "lockedAt"                   TIMESTAMPTZ(6);', 'ADD COLUMN "lockArrivalId"              TEXT;', 'FOREIGN KEY ("lockArrivalId") REFERENCES "arrivals"("id") ON DELETE RESTRICT']) {
      if (!sql.includes(must)) commFail(`the COMM-01 migration lacks "${must}"`);
    }
    if (!sql.includes(`CHECK ("status" IN ('estimated', 'confirmed', 'paid', 'cancelled'))`)) commFail('the COMM-01 migration lacks its four-word CHECK on commission_ledger.status');
    if (/DEFAULT/.test(sql)) commFail('the COMM-01 migration defaults a stated field');
    if (/^\s*UPDATE\b/im.test(sql)) commFail('the COMM-01 migration backfills — nothing is inferred');
  }
  {
    const at = schemaText.indexOf('\nmodel commission_ledger {');
    const block = at >= 0 ? schemaText.slice(at, schemaText.indexOf('\n}', at)) : '';
    if (!block) commFail('prisma/schema.prisma: no commission_ledger model');
    else {
      if (!/\n  commissionAmountCents Int\?\n/.test(block)) commFail('prisma/schema.prisma: commission_ledger.commissionAmountCents is not nullable');
      for (const col of ['lockedCommissionCents', 'distributorCommissionCents', 'clientCommissionCents', 'processingFeeCents']) if (!new RegExp(`\\n  ${col}\\s+Int\\?\\n`).test(block)) commFail(`prisma/schema.prisma: commission_ledger.${col} is not a nullable Int`);
      if (!/lockArrival arrivals\?\s+@relation\("commission_lock", fields: \[lockArrivalId\], references: \[id\], onDelete: Restrict/.test(block)) commFail('prisma/schema.prisma: commission_ledger.lockArrivalId is not a RESTRICT relation to arrivals');
    }
  }

  // 7. THE CRON, THE RETRO.
  {
    const r = codeOf(CRON_ROUTE);
    if (!r.includes("{ lane: 'hotel', status: 'confirmed', checkoutDate: { lt: new Date() }, commission_ledger: { some: { status: 'estimated' } } },")) commFail(`${CRON_ROUTE} does not re-read a checked-out stay whose commission is still estimated`);
    if (!/The lock arm adds at most ONE read per checked-out stay/.test(commentsOf(CRON_ROUTE))) commFail(`${CRON_ROUTE} does not restate the batch arithmetic for the lock arm`);
    if (!/commissionLock/.test(codeOf(RETRO))) commFail(`${RETRO} does not print the lock`);
  }

  if (commViolations === 0) console.log(`✔ The commission law passed — the two book routes write the vendor's stated commission or NULL (never a browser figure, never 0) and refuse a client commission by name; the prebook parser and the checkout panel say not stated; the apply leaf locks a hotel commission exactly when the vendor's word is confirmed, the check-out date is before the read instant and the GET stated a figure, through the read leaf's one lock port with the read arrival as evidence; the migration opens commissionAmountCents, adds the six lock columns and enforces the four documented words; the cron re-reads a checked-out stay once to lock.`);
  else console.log(`✖ The commission law FAILED — ${commViolations} violation(s).`);
});

// ── THE POSTING-DOCUMENT LAW (POST-01, 2026-09-26) ──────────────────────────
// A POSTING CARRIES ITS DOCUMENT: THE BOOKING BEHIND THE BANK ROW.
//
// THE RULING. The only thing that posts to the books is a Plaid transaction. A
// booking is the SOURCE DOCUMENT of that posting, never a posting of its own. The
// seven source kinds stay seven. commitPlaidTransaction is the one writer of the
// two document columns, inside the same transaction as the entry; the commit
// route refuses a proposed link at 409 before any posting; an accepted link is
// never posted without its document; a refund entry requires the posted charge and
// derives its account from it; the document words come from the drill leaf only.
//
// It reads the writer, the port, the route, the gate leaf, the drill leaf and cell,
// both surfaces, both wire routes, the migration, the schema and the retro through
// code(); it runs the pure gate and the pure document rule over fixtures. No render,
// no database, no network, no metered call.
lawGuard('The posting-document law', () => {
  let postViolations = 0;
  const postFail = (m: string) => { postViolations += 1; violations.push(`posting-document law: ${m} (POST-01)`); };

  const WRITER = 'src/lib/journal-entry-service.ts';
  const PORT = 'src/lib/posting/postJournal.ts';
  const GATE = 'src/lib/posting/documentGate.ts';
  const ROUTE = 'src/app/api/transactions/commit-to-ledger/route.ts';
  const LEAF = 'src/lib/books/entrySource.ts';
  const CELL = 'src/components/books/EntrySourceCell.tsx';
  const SURFACES = ['src/components/dashboard/JournalEntryEngine.tsx', 'src/components/dashboard/GeneralLedger.tsx'];
  const WIRE_ROUTES = ['src/app/api/journal-transactions/route.ts', 'src/app/api/ledger/route.ts'];
  const MIGRATION = 'prisma/migrations/20260926180000_post_01_posting_document/migration.sql';
  const RETRO = 'scripts/post-01-retro-documents.ts';
  for (const f of [WRITER, PORT, GATE, ROUTE, LEAF, CELL, ...SURFACES, ...WIRE_ROUTES, MIGRATION]) {
    if (!existsSync(resolve(ROOT, f))) postFail(`${f} is missing`);
  }

  // ── CLAUSE 1. commitPlaidTransaction IS THE ONE WRITER OF THE TWO DOCUMENT COLUMNS. ──
  // A key `document_reservation_id:` / `document_money_event_id:` whose value is not a
  // same-named property read (the wire routes pass the column through) is a WRITE.
  // Writes live in the port (the pass-through into the create) and in the writer's
  // commitPlaidTransaction body — nowhere else under src, and never in an update.
  const DOC_KEY = /document_(reservation|money_event)_id\s*:\s*([^,\n}]+)/g;
  // A row TYPE's field declaration (`document_reservation_id: string | null;`) is not a write.
  const isTypeField = (value: string) => /^(?:string|number|boolean)\b/.test(value.trim());
  // The READERS — the two wire routes mapping the entry to the wire, the two surfaces handing
  // the row to the cell — may only PASS the column through, as the same-named property read
  // (`document_reservation_id: t.document_reservation_id`). Anywhere else a key with ANY value —
  // a copy of another entry's document included (the admin entity fix re-posting
  // `original.document_reservation_id` would be one) — is a write.
  const isPassThrough = (value: string) => /^\w+(?:\.\w+)*\.document_(?:reservation|money_event)_id$/.test(value.trim());
  const READERS = [...WIRE_ROUTES, ...SURFACES];
  for (const { file, src } of srcFiles) {
    const keyed = [...src.matchAll(DOC_KEY)].filter((m) => !isTypeField(m[2]));
    if (keyed.length === 0) continue;
    if (file === PORT || file === WRITER) {
      // the writers — clause 1's second half reads their bodies below
    } else if (READERS.includes(file)) {
      for (const m of keyed) if (!isPassThrough(m[2])) postFail(`${file} writes document_${m[1]}_id (${m[2].trim()}) — a reader passes the column through and decides nothing`);
    } else {
      postFail(`${file} writes document_reservation_id / document_money_event_id — commitPlaidTransaction (${WRITER}) is the one writer of a posting's document`);
    }
    if (/journal_entries\s*\.\s*update(?:Many)?\s*\(\s*\{[\s\S]{0,400}?document_(reservation|money_event)_id\s*:/.test(src)) postFail(`${file} updates a posted entry's document — the document is born with the entry, never updated under src`);
  }
  const writerSrc = codeOf(WRITER);
  const commitBody = functionBody(writerSrc, 'commitPlaidTransaction') ?? '';
  const reverseBody = functionBody(writerSrc, 'reversePlaidTransaction') ?? '';
  if (!commitBody) postFail(`${WRITER} has no commitPlaidTransaction`);
  if (!commitBody.includes('document_reservation_id: document ? document.reservationId : null,')) postFail(`commitPlaidTransaction does not write document_reservation_id from the pre-validated document (null when there is none)`);
  if (!commitBody.includes('document_money_event_id: document ? document.moneyEventId : null,')) postFail(`commitPlaidTransaction does not write document_money_event_id from the pre-validated document`);
  if (/document_(reservation|money_event)_id\s*:/.test(reverseBody)) postFail('reversePlaidTransaction carries a document — the reversal carries none; the original keeps its own');
  if (/\bdocument\s*\?\?|document\?\.(reservationId|moneyEventId)\s*\?\?/.test(writerSrc)) postFail(`${WRITER} defaults a document — a document is the accepted link's booking or nothing, never defaulted`);
  if (!/const entry = await post\(\{/.test(commitBody) || !commitBody.includes("source_type: 'plaid_txn',")) postFail('commitPlaidTransaction no longer posts a plaid_txn entry through the port — the booking is what the posting documents, never what it is');
  const portSrc = codeOf(PORT);
  if (!portSrc.includes('document_reservation_id: entry.document_reservation_id ?? null,') || !portSrc.includes('document_money_event_id: entry.document_money_event_id ?? null,')) postFail(`${PORT} does not pass the two document columns into the create`);

  // ── CLAUSE 2. THE COMMIT ROUTE REFUSES A PROPOSED LINK AT 409 BEFORE ANY POSTING. ──
  const routeSrc = codeOf(ROUTE);
  const gateAt = routeSrc.indexOf('const gate = documentsForBatch(transactionIds, batchLinks);');
  const loopAt = routeSrc.indexOf('const batchRequestId = randomUUID();');
  const postAt = routeSrc.indexOf('commitPlaidTransaction(prisma, {');
  if (gateAt < 0) postFail('the commit route does not call documentsForBatch() over the batch');
  else {
    if (loopAt < 0 || gateAt > loopAt) postFail('the commit route does not call documentsForBatch() before its posting loop');
    if (postAt < 0 || gateAt > postAt) postFail('the commit route posts before the document gate has decided the batch');
  }
  if (!/if \(!gate\.ok\) \{\s*return NextResponse\.json\(\s*\{[\s\S]{0,400}?error: gate\.refusal\.message,[\s\S]{0,400}?\{ status: 409 \}/.test(routeSrc)) postFail('the commit route posts a proposed link — the gate refuses at 409 before any posting, by name, listing transaction ids and link ids');
  if (!routeSrc.includes('where: { userId: user.id, transactionId: { in: transactionIds }, status: { in: [\'proposed\', \'accepted\'] } }')) postFail('the commit route reads the batch links without the user scope (userId = the authed user) over the batch transaction ids');
  const proposedOnly = documentFromLinks([{ id: 'l1', transactionId: 't1', reservationId: 'r1', moneyEventId: null, status: 'proposed' }]);
  if (proposedOnly.kind !== 'proposed') postFail(`documentFromLinks lets a proposed link through as ${proposedOnly.kind} — a proposed link never posts silently`);
  const mixed = documentFromLinks([
    { id: 'l1', transactionId: 't1', reservationId: 'r1', moneyEventId: null, status: 'accepted' },
    { id: 'l2', transactionId: 't1', reservationId: 'r2', moneyEventId: null, status: 'proposed' },
  ]);
  if (mixed.kind !== 'proposed') postFail(`documentFromLinks posts beside an undecided link (${mixed.kind}) — one proposed link refuses the transaction`);
  const two = documentFromLinks([
    { id: 'l1', transactionId: 't1', reservationId: 'r1', moneyEventId: null, status: 'accepted' },
    { id: 'l2', transactionId: 't1', reservationId: 'r2', moneyEventId: null, status: 'accepted' },
  ]);
  if (two.kind !== 'many_accepted') postFail(`documentFromLinks picks one of two accepted links (${two.kind}) — a posting documents one booking and the gate never picks`);
  const batch = documentsForBatch(['t1', 't2'], [
    { id: 'l1', transactionId: 't1', reservationId: 'r1', moneyEventId: null, status: 'accepted' },
    { id: 'l9', transactionId: 't2', reservationId: 'r7', moneyEventId: null, status: 'proposed' },
  ]);
  if (batch.ok) postFail('documentsForBatch posts a batch holding a proposed link — the whole batch is refused, nothing posted');
  else if (batch.refusal.reason !== 'proposed' || !batch.refusal.transactionIds.includes('t2') || !batch.refusal.linkIds.includes('l9') || !batch.refusal.message.includes('t2') || !batch.refusal.message.includes('l9')) postFail('documentsForBatch refuses a proposed link without naming its transaction and link ids');

  // ── CLAUSE 3. AN ACCEPTED LINK IS NEVER POSTED WITHOUT ITS DOCUMENT. ──
  const one = documentFromLinks([
    { id: 'l1', transactionId: 't1', reservationId: 'r1', moneyEventId: null, status: 'accepted' },
    { id: 'l3', transactionId: 't1', reservationId: 'r3', moneyEventId: null, status: 'rejected' },
  ]);
  if (one.kind !== 'document' || one.document.reservationId !== 'r1' || one.document.moneyEventId !== null || one.linkId !== 'l1') postFail(`documentFromLinks reads one accepted link as ${JSON.stringify(one)} — the accept IS the authorization and its booking is the document`);
  const refund = documentFromLinks([{ id: 'l1', transactionId: 't1', reservationId: 'r1', moneyEventId: 'me1', status: 'accepted' }]);
  if (refund.kind !== 'document' || refund.document.moneyEventId !== 'me1') postFail('documentFromLinks drops the money event of an accepted refund link');
  const none = documentFromLinks([{ id: 'l3', transactionId: 't1', reservationId: 'r3', moneyEventId: null, status: 'rejected' }]);
  if (none.kind !== 'none' || documentFromLinks([]).kind !== 'none') postFail('documentFromLinks invents a document for a rejected or absent link');
  const okBatch = documentsForBatch(['t1', 't2'], [{ id: 'l1', transactionId: 't1', reservationId: 'r1', moneyEventId: null, status: 'accepted' }]);
  if (!okBatch.ok || okBatch.documents.get('t1')?.reservationId !== 'r1' || okBatch.documents.get('t2') !== null || okBatch.documents.size !== 2) postFail('documentsForBatch does not decide every transaction of the batch (the document for an accepted link, null for none)');
  if (!routeSrc.includes('document: document === null ? undefined : document,')) postFail('the commit route posts an accepted link without its document — the gate’s decision is passed to commitPlaidTransaction, and an accepted link is never posted without its document');
  if (!/if \(document === undefined\) throw new Error\(/.test(routeSrc)) postFail('the commit route lets a transaction the gate did not decide post as a posting of no booking — that is a fault, said out loud');
  if (/\bdocument\s*\?\?/.test(routeSrc)) postFail('the commit route defaults a document');

  // ── CLAUSE 4. A REFUND ENTRY REQUIRES THE POSTED CHARGE AND DERIVES ITS ACCOUNT. ──
  if (!/if \(!\(amount < 0\)\) \{\s*throw new ValidationError\(\s*`POST-01 a refund is money that came back/.test(commitBody)) postFail('commitPlaidTransaction lets an outflow document a refund — an outflow may not document a refund; only an inflow (Plaid amount < 0) may');
  if (!/if \(!charge\) \{\s*throw new ValidationError\(\s*`POST-01 the charge is not posted; post it first/.test(commitBody)) postFail('commitPlaidTransaction posts a refund without a posted charge — a refund entry requires the posted charge, and refuses by name without it');
  if (!commitBody.includes("where: { userId, document_reservation_id: document.reservationId, document_money_event_id: null, status: 'posted' },")) postFail('commitPlaidTransaction does not look the booking’s charge up as a POSTED entry with no money event (the charge, not a refund; posted, not reversed)');
  if (!/const debitLine = charge\.ledger_entries\.find\(\(l\) => l\.entry_type === 'D'\);/.test(commitBody)) postFail('commitPlaidTransaction does not derive the refund’s account from the charge entry’s debit line');
  if (!/if \(accountCode !== debitLine\.account\.code\) \{\s*throw new ValidationError\(/.test(commitBody)) postFail('commitPlaidTransaction lets a caller pick a refund’s account — a caller’s accountCode that differs from the charge’s is refused by name');
  if (!/const expenseOrIncomeAccount = refundAgainst\s*\?\s*refundAgainst\.account\s*:/.test(commitBody)) postFail('commitPlaidTransaction looks a refund’s account up by the caller’s code — the account of a refund is derived from the posted charge, never chosen');
  if (!/if \(holder\) throw new ValidationError\(chargeAlreadyPostedMessage\(document\.reservationId, holder\.id\), \{ status: 409 \}\);/.test(commitBody)) postFail('commitPlaidTransaction does not name a second posted charge for the same booking before the write');
  if (!/isDocumentChargeUniqueError\(err\)/.test(writerSrc) || !/this booking already has a posted charge entry \$\{holderId\}/.test(writerSrc)) postFail('commitPlaidTransaction lets a P2002 on the one-posted-charge index out as a fault — it is named ("this booking already has a posted charge entry <id>"), never a 500');

  // ── CLAUSE 5. KINDS STAY SEVEN. ──
  const SEVEN = ['plaid_txn', 'manual', 'reversal', 'investment_txn', 'trading_position', 'reclass', 'year_end_close'];
  if (SOURCE_RULES.length !== 7 || !SEVEN.every((k) => SOURCE_RULES.some((r) => r.type === k))) postFail(`the drill leaf holds ${SOURCE_RULES.length} source kinds [${SOURCE_RULES.map((r) => r.type).join(' ')}] — KINDS stay seven; a booking is a document, never an eighth kind`);
  if (/source_type:\s*'(booking|reservation|refund|document)'/.test(writerSrc)) postFail('the writer posts a booking as its own source kind — a booking is the document of a plaid_txn posting');

  // ── CLAUSE 6. THE DOCUMENT WORDS COME FROM THE DRILL LEAF ONLY. ──
  const leafSrc = codeOf(LEAF);
  if (!/export function documentOf\(/.test(leafSrc)) postFail(`${LEAF} has no documentOf() — the one rule for the document’s words`);
  const charge = documentOf({ document_reservation_id: 'r1', document_money_event_id: null, document_reservation: { displayName: 'Hotel Temple', providerBookingId: 'hSq2gVDrf', providerConfirmationCode: 'HCC-4421' } });
  if (charge.kind !== 'charge' || charge.words !== 'Booking: Hotel Temple · HCC-4421') postFail(`documentOf reads a charge as ${JSON.stringify(charge)} — "Booking: <name> · <confirmation code>"`);
  const noCode = documentOf({ document_reservation_id: 'r1', document_money_event_id: null, document_reservation: { displayName: 'Hotel Temple', providerBookingId: 'hSq2gVDrf', providerConfirmationCode: null } });
  if (noCode.kind !== 'charge' || noCode.words !== 'Booking: Hotel Temple · hSq2gVDrf') postFail(`documentOf without a confirmation code reads ${JSON.stringify(noCode)} — the booking id stands in`);
  const refundWords = documentOf({ document_reservation_id: 'r1', document_money_event_id: 'me1', document_reservation: { displayName: 'Hotel Temple', providerBookingId: 'hSq2gVDrf', providerConfirmationCode: 'HCC-4421' }, document_money_event: { kind: 'refund', amountCents: 12345, currency: 'USD' } });
  if (refundWords.kind !== 'refund' || refundWords.words !== 'Refund of booking: Hotel Temple · 123.45 USD') postFail(`documentOf reads a refund as ${JSON.stringify(refundWords)} — "Refund of booking: <name> · <amount currency>"`);
  const nothing = documentOf({ source_type: 'plaid_txn', source_id: 'x', document_reservation_id: null, document_money_event_id: null });
  if (nothing.kind !== 'none') postFail(`documentOf invents a document for NULL (${JSON.stringify(nothing)}) — NULL renders nothing`);
  if (documentOf({ source_type: 'plaid_txn', source_id: 'x' }).kind !== 'none') postFail('documentOf invents a document for a row that carries none');
  const cellSrc = codeOf(CELL);
  if (!cellSrc.includes('documentOf(')) postFail(`${CELL} does not call documentOf() — the document is derived from the row by the leaf, never decided in the cell`);
  for (const typed of ['Booking:', 'Refund of booking:', 'Booking ', 'Refund']) {
    if (cellSrc.includes(`'${typed}`) || cellSrc.includes(`"${typed}`) || cellSrc.includes(`\`${typed}`)) postFail(`${CELL} types "${typed}" — every document word comes from ${LEAF}`);
  }
  if (!/\{document\.words\}/.test(cellSrc)) postFail(`${CELL} does not render the leaf’s document words`);
  if (!/document\.kind !== 'none' &&/.test(cellSrc)) postFail(`${CELL} renders something for a NULL document — NULL renders nothing`);
  for (const f of SURFACES) {
    const src = codeOf(f);
    const handed = [...src.matchAll(/entry=\{\{([^}]*)\}\}/g)].map((m) => m[1]);
    const carries = handed.find((props) => ['document_reservation_id', 'document_money_event_id', 'document_reservation', 'document_money_event'].every((field) => new RegExp(`${field}:\\s*\\w+\\.${field}\\b`).test(props)));
    if (!carries) postFail(`${f} does not hand the document (document_reservation_id, document_money_event_id, document_reservation, document_money_event) off its rows to the source cell — a column nothing renders is the fault the drill law closes`);
  }
  for (const f of WIRE_ROUTES) {
    const src = codeOf(f);
    for (const field of ['document_reservation_id', 'document_money_event_id']) {
      if (!new RegExp(`${field}:\\s*\\w+(?:\\.\\w+)*\\.${field}\\b`).test(src)) postFail(`${f} does not put ${field} on the wire — the screen cannot read what the route drops`);
    }
    if (!/document_reservation: \{ select: \{ displayName: true, providerBookingId: true, providerConfirmationCode: true \} \}/.test(src)) postFail(`${f} does not join the booking’s displayName, providerBookingId and providerConfirmationCode`);
    if (!/document_money_event: \{ select: \{ kind: true, amountCents: true, currency: true \} \}/.test(src)) postFail(`${f} does not join the money event’s kind and amount`);
  }

  // ── CLAUSE 7. THE MIGRATION AND THE SCHEMA MOVE TOGETHER. ──
  const mig = codeOf(MIGRATION);
  const MIGRATION_LINES: ReadonlyArray<[string, string]> = [
    ['ALTER TABLE "journal_entries" ADD COLUMN "document_reservation_id" UUID;', 'the document_reservation_id column'],
    ['ALTER TABLE "journal_entries" ADD COLUMN "document_money_event_id" UUID;', 'the document_money_event_id column'],
    ['FOREIGN KEY ("document_reservation_id") REFERENCES "reservations"("id")\n    ON DELETE RESTRICT', 'the reservation FK, RESTRICT'],
    ['FOREIGN KEY ("document_money_event_id") REFERENCES "money_events"("id")\n    ON DELETE RESTRICT', 'the money event FK, RESTRICT'],
    ['CHECK ("document_money_event_id" IS NULL OR "document_reservation_id" IS NOT NULL)', 'the CHECK — a money event never documents a posting without its booking'],
    ['CREATE UNIQUE INDEX "journal_entries_document_charge_key"\n    ON "journal_entries"("document_reservation_id")\n    WHERE "document_money_event_id" IS NULL AND "status" = \'posted\';', 'one posted charge per booking — the partial unique on document_reservation_id WHERE the money event is NULL and status = posted'],
    ['CREATE INDEX "journal_entries_document_reservation_id_idx" ON "journal_entries"("document_reservation_id");', 'the reservation index'],
    ['CREATE INDEX "journal_entries_document_money_event_id_idx" ON "journal_entries"("document_money_event_id");', 'the money event index'],
    ['ALTER TABLE "transaction_reservation_links" ADD COLUMN "moneyEventId" UUID;', 'links.moneyEventId'],
    ['FOREIGN KEY ("moneyEventId") REFERENCES "money_events"("id")\n    ON DELETE RESTRICT', 'the link’s money event FK, RESTRICT'],
  ];
  for (const [text, what] of MIGRATION_LINES) if (!mig.includes(text)) postFail(`${MIGRATION} lacks ${what}`);
  if (/DEFAULT/.test(mig)) postFail(`${MIGRATION} defaults a document column — nothing is defaulted`);
  if (/UPDATE "journal_entries"/.test(mig)) postFail(`${MIGRATION} backfills — the retro sets a document only from an accepted link, printed per row`);
  const SCHEMA_LINES: ReadonlyArray<[string, string]> = [
    ['document_reservation_id String? @db.Uuid', 'journal_entries.document_reservation_id'],
    ['document_money_event_id String? @db.Uuid', 'journal_entries.document_money_event_id'],
    ['document_reservation reservations?  @relation("posting_document", fields: [document_reservation_id], references: [id], onDelete: Restrict, onUpdate: Cascade)', 'the reservation relation, Restrict'],
    ['document_money_event money_events?  @relation("posting_document_event", fields: [document_money_event_id], references: [id], onDelete: Restrict, onUpdate: Cascade)', 'the money event relation, Restrict'],
    ['moneyEventId   String?   @db.Uuid', 'transaction_reservation_links.moneyEventId'],
    ['moneyEvent  money_events? @relation("link_money_event", fields: [moneyEventId], references: [id], onDelete: Restrict, onUpdate: Cascade)', 'the link’s money event relation, Restrict'],
  ];
  for (const [text, what] of SCHEMA_LINES) if (!schemaText.includes(text)) postFail(`schema.prisma lacks ${what}`);

  // ── CLAUSE 8. THE RETRO FILLS FROM AN ACCEPTED LINK, PRINTS EVERY ROW, PICKS NOTHING. ──
  if (!existsSync(resolve(ROOT, RETRO))) postFail(`${RETRO} is missing — the retro (git add -f past the scripts/ ignore)`);
  else {
    const retro = codeOf(RETRO);
    if (!retro.includes("process.argv.includes('--dry-run')")) postFail('the retro has no --dry-run');
    if (!retro.includes("where: { source_type: 'plaid_txn', status: 'posted', document_reservation_id: null, source_id: { not: null } },")) postFail('the retro does not select exactly the posted plaid_txn entries without a document — the selection is what makes a second run change nothing');
    if (!retro.includes('where: { transactionId: e.source_id as string },')) postFail('the retro does not join the entry to its bank row by source_id = transactions.transactionId');
    if (!retro.includes('where: { transactionId: txn.id, userId: e.userId },')) postFail('the retro does not read the bank row’s links by transactions.id, scoped to the entry’s own user');
    if (!retro.includes('const decision = documentFromLinks(links);')) postFail('the retro decides with a rule of its own — it asks the one gate (documentFromLinks)');
    if (!/if \(decision\.kind === 'many_accepted'\) \{\s*leftAsIs \+= 1;/.test(retro)) postFail('the retro picks between two accepted links — two accepted links are printed by name and left as is');
    if (!/if \(decision\.kind === 'proposed'\) \{\s*leftAsIs \+= 1;/.test(retro)) postFail('the retro sets a document from a proposed link — undecided is not a document');
    if (!/if \(decision\.document\.moneyEventId !== null\) \{\s*leftAsIs \+= 1;/.test(retro)) postFail('the retro sets a refund document — a refund document is set by the writer at posting, which derives the account from the posted charge');
    if (!retro.includes("err.code === 'P2002'")) postFail('the retro lets the one-posted-charge refusal out as a crash — it is printed by name and the row left as is');
    if (/reservationId\s*\?\?|document_reservation_id:\s*[^,]*\?\?/.test(retro)) postFail('the retro defaults a document');
    if (!retro.includes('data: { document_reservation_id: reservationId, document_money_event_id: null },')) postFail('the retro writes something other than the accepted link’s booking as the charge document');
  }

  if (postViolations === 0) console.log('✔ The posting-document law passed — commitPlaidTransaction is the one writer of the two document columns; the commit route refuses a proposed link at 409 before any posting; an accepted link is never posted without its document; a refund requires the posted charge and derives its account; KINDS stay seven; the document words come from the drill leaf only; the migration, the schema and the retro agree.');
  else console.log(`✖ The posting-document law FAILED — ${postViolations} violation(s).`);
});

// ── THE ROW LAW (TRAVEL-ROW-01, 2026-09-23) ─────────────────────────────────
// BOOK AT THE LINE.
//
// WHAT THIS CLOSES. On main 97d6db04 you picked the line you wanted and then
// scrolled past the whole table to act on it: HotelResultsView.tsx's selection
// bar sat at :294 (`data-hotel-selection`), AFTER the outer table closed;
// FlightPickerView.tsx's leg bar sat at :557-588, after that leg's table closed;
// ActivityPickerView.tsx's sat at :292 (`data-activity-selection`); the tour's
// Save sat at PublicActivitySearch.tsx:406 (`data-activity-save-button`), after
// the options table closed. Worse, BOTH checkouts mounted at the very tail of
// their container's page — CheckoutPanel after <HotelResultsView/>,
// LiteApiFlightCheckoutPanel after <FlightPickerView/> — so pressing Book put
// the form somewhere the founder could not see. Trip.com and Expedia put the
// action at the line; so does this.
//
// The law is the SHAPE, not the styling: a view's actions live in the strip
// under the selected row, nothing acts on a selection from outside a table, the
// checkout reaches the strip through a SLOT the container fills, and the two
// files that actually book are byte-identical to main.
//
// It reads six component files plus the strip through code() and comments() and
// costs milliseconds: no render, no network, no metered call.
// ── THE PLAN LAW (OFFER-01, 2026-09-23; the module model, OFFER-03) ──────────────────────────────────────
// THE CUSTOMER'S PAGE SHOWS THE CUSTOMER'S OFFER.
//
// WHAT IT CLOSES. On main 3f84ac5d the public offer was the builder's view. The
// hero counted the registry ("Twenty-five tools, counted: two live, nine partial,
// fourteen on the blueprint" — Landing.tsx:2010, again at :2180, again at
// pricing/page.tsx:34). The cards listed TOOLS wearing the loop's own beat
// vocabulary — claimLine() renders "partial — discover · decide" (offer.ts:170-180)
// — under a STATUS chip reading "not built". Above them sat six personas headed
// "ONE SYSTEM · SIX LIVES" (Landing.tsx:2125). No customer knows what a beat is,
// and the founder could not scan his own offer.
//
// OFFER-01 replaced all of it with the anatomy a commercial product uses: three
// cumulative plans, an audience line and a plan-relationship line each, a price
// slot that is real but empty, and ONE table of collapsed capability groups whose
// every cell derives from the registry. This law keeps the builder's view off
// those surfaces and keeps every cell derived.
//
// It reads the plan surfaces, the section and the leaf through code() and
// comments(), and runs the leaf's own planLaw over the live registry. No render,
// no network, no metered call.
// ── THE DRILL LAW (DRILL-01, 2026-09-23) ─────────────────────────────────────
// EVERY ENTRY ON A BOOK SURFACE SAYS WHERE IT CAME FROM.
//
// WHAT IT CLOSES. Every posted entry is born with a pointer — journal-entry-service.ts
// :138-139 writes source_type 'plaid_txn' and source_id = the bank transaction's id,
// and :236-237 writes 'reversal' with a null id. The columns are on the table
// (schema.prisma:192-193), indexed together (:217) and IMMUTABLE after posting (the
// SOC 2 trigger, 20260227000100_protect_journal_entries/migration.sql:16-17, :34).
// /api/journal-transactions has put both on the wire since route.ts:46-47. And no
// screen read them: JournalEntryEngine's row type carried neither, GeneralLedger
// rendered none, and /api/ledger dropped them when it mapped its rows. The audit
// trail the product is sold on existed in the data and on no screen.
//
// FOUR CLAUSES: every rendered entry shows a source or names its absence; no
// component invents one; the coverage line derives from the rows shown and is never
// typed; the leaf is pure.
//
// It reads four files through code() and runs the leaf over every kind. No render,
// no database, no network, no metered call.
lawGuard('The entry-source law', () => {
  let drillViolations = 0;
  const drillFail = (m: string) => { drillViolations += 1; violations.push(`entry-source law: ${m} (DRILL-01)`); };

  const DRILL_LEAF = 'src/lib/books/entrySource.ts';
  const DRILL_CELL = 'src/components/books/EntrySourceCell.tsx';
  // The two book surfaces that render entries, and the routes that feed them.
  const DRILL_SURFACES = ['src/components/dashboard/JournalEntryEngine.tsx', 'src/components/dashboard/GeneralLedger.tsx'];
  const DRILL_ROUTES = ['src/app/api/journal-transactions/route.ts', 'src/app/api/ledger/route.ts'];
  /** The three columns a book surface hands to the source cell. */
  const SOURCE_COLUMNS = ['source_type', 'source_id', 'reverses_entry_id'] as const;

  for (const f of [DRILL_LEAF, DRILL_CELL, ...DRILL_SURFACES, ...DRILL_ROUTES]) {
    if (!existsSync(resolve(ROOT, f))) drillFail(`${f} is missing`);
  }

  // ── CLAUSE 1. EVERY RENDERED ENTRY SHOWS A SOURCE OR NAMES ITS ABSENCE. ──
  // Both surfaces read the three columns and render them through the one cell.
  for (const f of DRILL_SURFACES) {
    const src = codeOf(f);
    // A field DECLARED on a row type is not a field READ, and a field read for the
    // COVERAGE COUNT is not a field shown on the line. The whole fault this law closes
    // was three columns sitting in the payload with nothing rendering them — so the
    // clause wants the row handed to the source cell itself, carrying all three.
    const handed = [...src.matchAll(/entry=\{\{([^}]*)\}\}/g)].map((m) => m[1]);
    const carries = handed.find((props) => SOURCE_COLUMNS.every((field) => new RegExp(`${field}:\\s*\\w+\\.${field}\\b`).test(props)));
    if (!carries) {
      drillFail(`${f} does not read source_type, source_id and reverses_entry_id off its rows into the source cell — a book surface says where each entry came from, and a column nothing renders is the fault this law closes`);
    }
    if (!/EntrySource(Cell|Words)/.test(src)) drillFail(`${f} does not render the entry's source through ${DRILL_CELL}`);
  }
  // And the routes carry them, or the surfaces have nothing to read.
  for (const f of DRILL_ROUTES) {
    const src = codeOf(f);
    for (const field of ['source_type', 'source_id']) {
      if (!src.includes(field)) drillFail(`${f} does not put ${field} on the wire — the columns exist and the screen cannot read what the route drops`);
    }
  }
  // The leaf answers for EVERY kind, and names the absence rather than going blank.
  const KINDS = ['plaid_txn', 'manual', 'reversal', 'investment_txn', 'trading_position', 'reclass', 'year_end_close'];
  for (const type of KINDS) {
    if (!SOURCE_RULES.some((r) => r.type === type)) drillFail(`${DRILL_LEAF} holds no rule for source_type "${type}" — it is written under src and the surface must have words for it`);
    const s = entrySourceOf({ source_type: type, source_id: 'x', reverses_entry_id: 'e' });
    if (!('words' in s) || !s.words.trim()) drillFail(`${type} renders no words`);
  }
  const silent = entrySourceOf({ source_type: null, source_id: null });
  if (silent.kind !== 'none' || silent.words !== NO_SOURCE_WORDS) drillFail(`an entry with no source_type reads ${JSON.stringify(silent)} — it must say "${NO_SOURCE_WORDS}", never a blank`);
  for (const blank of ['', '   ']) {
    if (entrySourceOf({ source_type: blank }).kind !== 'none') drillFail(`a blank source_type (${JSON.stringify(blank)}) is not named as absent`);
  }

  // ── CLAUSE 2. NO COMPONENT INVENTS A SOURCE. ──
  // An unknown source_type renders AS ITSELF, and the cell types no source word of
  // its own: every one comes from the leaf.
  const unknown = entrySourceOf({ source_type: 'a_kind_nobody_wrote_yet', source_id: 'z' });
  if (unknown.kind !== 'unknown' || unknown.words !== 'a_kind_nobody_wrote_yet') {
    drillFail(`an unknown source_type reads ${JSON.stringify(unknown)} — it renders as itself, never as a guess`);
  }
  const cellSrc = codeOf(DRILL_CELL);
  for (const rule of SOURCE_RULES) {
    if (cellSrc.includes(rule.words)) drillFail(`${DRILL_CELL} types "${rule.words}" — every source word comes from ${DRILL_LEAF}`);
  }
  if (cellSrc.includes(NO_SOURCE_WORDS)) drillFail(`${DRILL_CELL} types "${NO_SOURCE_WORDS}" — the words live in the leaf`);
  if (!cellSrc.includes('entrySourceOf(')) drillFail(`${DRILL_CELL} does not call entrySourceOf() — a source is derived from the row, never decided here`);
  if (!cellSrc.includes('statedFacts(')) drillFail(`${DRILL_CELL} does not render through statedFacts() — a null column is dropped, never shown as 0 or ""`);
  // A source the surface cannot verify is never substituted for: no default, no "Unknown".
  // The EntrySource kind tags ('opens' · 'entry' · 'stated' · 'unknown' · 'none') are
  // the leaf's discriminants — code the cell switches on, never words it renders.
  const KIND_TAGS = new Set(['opens', 'entry', 'stated', 'unknown', 'none']);
  for (const m of cellSrc.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    const lit = m[2].trim();
    if (KIND_TAGS.has(lit)) continue;
    if (/^(unknown|n\/a|not available|—|-)$/i.test(lit)) drillFail(`${DRILL_CELL} carries the stand-in "${m[2]}" — an absent source is named in words, never filled in`);
  }
  // statedFacts drops what the row does not carry, and keeps a stated 0 / false.
  const dropped = statedFacts({
    transactionId: 't1', date: null, name: null, merchantName: null, amount: 0, accountName: null,
    accountMask: null, category: null, pending: false, paymentChannel: null, transactionType: null,
    authorizedDate: null, website: null,
  });
  if (dropped.some((f) => f.label === 'Date' || f.label === 'Merchant')) drillFail('statedFacts renders a field the row does not carry');
  if (!dropped.some((f) => f.label === 'Amount' && f.value === '0')) drillFail('statedFacts drops a stated 0 — a zero the vendor sent is a value, not a silence');
  if (!dropped.some((f) => f.label === 'Pending' && f.value === 'no')) drillFail('statedFacts drops a stated false');

  // ── CLAUSE 3. THE COVERAGE LINE DERIVES FROM THE ROWS SHOWN, NEVER TYPED. ──
  const probe = [
    { source_type: 'plaid_txn', source_id: 'a' },
    { source_type: 'manual', source_id: null },
    { source_type: 'reversal', source_id: null, reverses_entry_id: 'e1' },
    // DRILL-01b: a reclass states its origin and has nothing to open — reclassify.ts
    // writes no source_id at all — so it joins the middle bucket, not the sourced one.
    { source_type: 'reclass', source_id: null },
    { source_type: '', source_id: null },
  ];
  const cov = coverageOf(probe);
  if (cov.total !== 5 || cov.sourced !== 2 || cov.withoutPointer !== 2 || cov.unrecorded !== 1) {
    drillFail(`coverageOf counted ${JSON.stringify(cov)} over a bank entry, a hand entry, a reversal, a reclass and a silent row — expected 5 total, 2 sourced, 2 with nothing to open, 1 unrecorded`);
  }
  if (!cov.line.startsWith(`${cov.sourced} of ${cov.total} `)) drillFail(`the coverage line reads "${cov.line}" — it states N of M over the rows shown`);
  if (coverageOf([]).total !== 0) drillFail('coverageOf invents rows for an empty list');
  for (const f of DRILL_SURFACES) {
    const src = codeOf(f);
    if (!src.includes('coverageOf(')) drillFail(`${f} does not derive its coverage line with coverageOf() — a typed count on a proof surface is the fault this law exists for`);
    if (!src.includes('<CoverageLine')) drillFail(`${f} renders no coverage line`);
    // A typed "N of M" anywhere on a book surface is the thing the clause forbids.
    for (const m of src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
      if (/\b\d+\s+of\s+\d+\b/.test(m[2])) drillFail(`${f} types "${m[2]}" — the coverage line is counted from the rows shown`);
    }
  }

  // ── CLAUSE 4. THE LEAF IS PURE. ──
  // No fetch, no env, no clock, no Prisma, no React: it maps a source_type to words.
  const leafSrc = codeOf(DRILL_LEAF);
  const IMPURE: ReadonlyArray<[RegExp, string]> = [
    [/\bfetch\s*\(/, 'fetches'],
    [/process\.env/, 'reads the environment'],
    [/new Date\s*\(|Date\.now\s*\(/, 'reads the clock'],
    [/from 'react'|from "react"/, 'imports React'],
    [/prisma|PrismaClient/, 'reaches the database'],
    [/\bimport\s+[^\n]*\bfrom\s+'(?!\.)/, 'imports a module outside its own folder'],
  ];
  for (const [re, what] of IMPURE) {
    if (re.test(leafSrc)) drillFail(`${DRILL_LEAF} ${what} — the mapping is pure: a source_type in, words out`);
  }
  // And the ONE read behind the open is authed, tab-gated and user-scoped.
  const SOURCE_ROUTE = 'src/app/api/journal-entries/[id]/source/route.ts';
  if (!existsSync(resolve(ROOT, SOURCE_ROUTE))) drillFail(`${SOURCE_ROUTE} is missing — the open has no read`);
  else {
    const routeSrc = codeOf(SOURCE_ROUTE);
    for (const [needle, why] of [
      ['getVerifiedEmail()', 'verifies the cookie'],
      ["requireTabAccess(user.id, 'tab:books')", 'gates on the books tab'],
      ['userId: user.id', 'scopes the entry to its owner'],
      ['accounts: { userId: user.id }', "scopes the transaction through its account's owner"],
    ] as const) {
      if (!routeSrc.includes(needle)) drillFail(`${SOURCE_ROUTE} no longer ${why} (${needle})`);
    }
    if (!/status: 404/.test(routeSrc)) drillFail(`${SOURCE_ROUTE} has no defensive 404 — another account's entry must answer as an unknown one does`);
  }

  if (drillViolations === 0) {
    console.log(`✔ The entry-source law passed — ${SOURCE_RULES.length} source kinds, every one with words; an unknown kind renders as itself and a silent row says "${NO_SOURCE_WORDS}"; ${DRILL_SURFACES.length} book surfaces read the three columns through one cell and derive their coverage line from the rows shown; the leaf is pure and the one read behind the open is authed, tab-gated and user-scoped.`);
  } else {
    console.log(`✖ The entry-source law FAILED — ${drillViolations} violation(s).`);
  }
});

lawGuard('The plan law', () => {
  let planViolations = 0;
  const planFail = (m: string) => { planViolations += 1; violations.push(`plan law: ${m} (OFFER-01)`); };

  const PLANS_LEAF = 'src/lib/offer/plans.ts';
  const PLANS_SECTION = 'src/components/offer/PlansSection.tsx';

  // The leaf's own law first — three plans in the ladder's order, every registry
  // tool placed in exactly one capability row, no cell claiming ✓ over a tool that
  // is not LIVE, and no struck-through figure with no price behind it.
  for (const v of planLaw({ throwOnFail: false })) planFail(v);

  // ── CLAUSE 1. THE BUILDER'S VIEW DOES NOT RENDER ON A PLAN SURFACE. ──
  // Three vocabularies leave the customer's page: the registry COUNT, the loop's
  // four BEAT names, and the PERSONA grid.
  const BEAT_WORDS = ['discover', 'decide', 'commit', 'record'] as const;
  const COUNT_TELLS = ['heroCountsLine', 'statusCounts', 'numberWord', 'tools, counted'];
  const PERSONA_TELLS = ['SIX LIVES', 'PERSONAS', 'Who is this for?'];
  // THE BEAT CLAIM, on any plan surface: the form claimLine() renders
  // ("partial — discover · decide") and the readers that build it. The scan is
  // the CLAIM, not the word: Landing.tsx is a 4,400-line deck whose loop cells
  // legitimately say "a trade record" (:832, :908) — that is the deck's own essay
  // copy about the four beats, which this ruling did not touch and which is not
  // an offer claim. What may never come back is a beat used to SELL.
  const BEAT_CLAIM = new RegExp(`partial\\s*[—-]\\s*(?:${BEAT_WORDS.join('|')})|(?:${BEAT_WORDS.join('|')})\\s*·\\s*(?:${BEAT_WORDS.join('|')})`);
  for (const f of PLAN_SURFACES) {
    if (!existsSync(resolve(ROOT, f))) { planFail(`${f} is missing`); continue; }
    const src = codeOf(f);
    for (const tell of COUNT_TELLS) {
      if (src.includes(tell)) planFail(`${f} carries "${tell}" — the registry's tool count is the builder's view and does not render on the customer's page`);
    }
    for (const tell of PERSONA_TELLS) {
      if (src.includes(tell)) planFail(`${f} carries "${tell}" — the persona grid is gone; the audience each persona named rides on the plan that serves it`);
    }
    if (BEAT_CLAIM.test(src)) planFail(`${f} renders a beat claim — "partial — discover · decide" is the loop's vocabulary, not a customer's`);
    if (/claimLine|beatsOf/.test(src)) planFail(`${f} reads the beat-bearing claim line — a plan surface reads src/lib/offer/plans.ts`);
    if (/from '@\/components\/OfferCard'/.test(src)) planFail(`${f} renders <OfferCard/> — the public offer is the plans section, and OfferCard carries the registry status chips and the beat claim lines`);
  }
  // The offer's OWN two files are held to the whole word: nothing in the plans
  // leaf or the section it feeds may name a beat at all. "records", "committed"
  // and "Discovery" are other words and are not caught.
  for (const f of [PLANS_SECTION, PLANS_LEAF]) {
    if (!existsSync(resolve(ROOT, f))) { planFail(`${f} is missing`); continue; }
    const src = codeOf(f);
    for (const tell of [...COUNT_TELLS, ...PERSONA_TELLS]) {
      if (src.includes(tell)) planFail(`${f} carries "${tell}" — the count and the personas stay in the registry and the audit trail`);
    }
    for (const m of src.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
      for (const beat of BEAT_WORDS) {
        if (new RegExp(`\\b${beat}\\b`).test(m[2])) planFail(`${f} renders "${beat}" — the loop's beat vocabulary is the builder's; a customer is told what they can do, not which beat is cited`);
      }
    }
  }
  // And the data itself: no plan's copy and no capability label may name a beat.
  for (const copy of [
    ...PLANS.flatMap((p) => [p.name, p.positioning, p.audience, p.relationship, ...p.benefits]),
    ...CAPABILITY_GROUPS.flatMap((g) => [g.title, ...g.rows.map((r) => r.label)]),
  ]) {
    for (const beat of BEAT_WORDS) {
      if (new RegExp(`\\b${beat}\\b`, 'i').test(copy)) planFail(`the plans' copy says "${beat}" in "${copy}" — the beat vocabulary stays in the registry`);
    }
  }

  // ── CLAUSE 2. EVERY CELL DERIVES FROM THE REGISTRY. ──
  // The section calls cellState() and draws CELL_MARK; it types no glyph, no
  // "Coming" and no state of its own.
  const sectionSrc = codeOf(PLANS_SECTION);
  if (!sectionSrc.includes('cellState(')) planFail(`${PLANS_SECTION} does not call cellState() — a cell is derived from the registry, never decided here`);
  if (!sectionSrc.includes('CELL_MARK[state]')) planFail(`${PLANS_SECTION} does not draw CELL_MARK[state] — the mark is the leaf's one mapping`);
  for (const mark of ['✓', '◐', 'Coming']) {
    for (const m of sectionSrc.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
      if (m[2].includes(mark)) planFail(`${PLANS_SECTION} types "${mark}" — every mark comes from CELL_MARK (src/lib/offer/plans.ts), so a cell can never claim more than the registry does`);
    }
  }
  // The one mapping is the one the ruling names, and nothing else maps.
  const MAPPING: Readonly<Record<string, string>> = { LIVE: 'ready', PARTIAL: 'partial', NOT_BUILT: 'coming' };
  for (const [status, cell] of Object.entries(MAPPING)) {
    if (STATUS_TO_CELL[status as keyof typeof STATUS_TO_CELL] !== cell) planFail(`STATUS_TO_CELL maps ${status} to "${STATUS_TO_CELL[status as keyof typeof STATUS_TO_CELL]}", not "${cell}" — LIVE is ✓, PARTIAL is ◐, NOT_BUILT is "Coming"`);
  }

  // ── CLAUSE 3. A PARTIAL CAPABILITY READS ◐ AND NEVER ✓. ──
  // Over the live registry, cell by cell: the weakest backing tool decides, so a
  // row standing on one PARTIAL tool is ◐ in every plan that carries it, and a row
  // reading ✓ has every tool behind it LIVE.
  let partialCells = 0;
  let readyCells = 0;
  for (const g of CAPABILITY_GROUPS) {
    for (const row of g.rows) {
      const weakest = weakestStatus(row.tools);
      for (const plan of PLANS) {
        const state = cellState(plan, row);
        // OFFER-03: a cell is SET MEMBERSHIP. A plan that does not hold the row's
        // module renders "—" and nothing else; a plan that holds it renders the
        // weakest backing state.
        if (!plan.modules.includes(row.module)) {
          if (state !== 'absent') planFail(`${g.id} · "${row.label}" reads "${state}" for ${plan.id}, which holds [${plan.modules.join(', ')}] and not the ${row.module} module`);
          continue;
        }
        if (state === 'absent') { planFail(`${g.id} · "${row.label}" reads "—" for ${plan.id}, which DOES hold the ${row.module} module`); continue; }
        if (weakest === 'PARTIAL') {
          partialCells += 1;
          if (state !== 'partial') planFail(`${g.id} · "${row.label}" stands on a PARTIAL tool and reads "${state}" for ${plan.id} — a partly built capability is ◐, never ✓`);
        }
        if (state === 'ready') {
          readyCells += 1;
          const notLive = row.tools.filter((t) => TOOL_REGISTRY.find((e) => e.name === t)?.status !== 'LIVE');
          if (notLive.length) planFail(`${g.id} · "${row.label}" reads ✓ for ${plan.id} while ${notLive.join(', ')} is not LIVE`);
        }
      }
    }
  }
  if (partialCells === 0) planFail('no cell on the whole table reads ◐ — the registry carries nine PARTIAL tools, so the derivation is not running');

  // ── CLAUSE 4. THE PRICE SLOT IS REAL BUT EMPTY. ──
  // While a plan's ONE price constant carries no figure the slot says so, and the
  // section types no figure, no discount and no placeholder of its own.
  for (const p of PLANS) {
    const slot = priceSlot(p);
    if (p.price.monthly === null && slot.kind !== 'unannounced') planFail(`${p.id}: no price is set and the slot does not render the launch placeholder`);
    if (p.price.monthly === null && slot.kind === 'unannounced' && slot.text !== LAUNCH_PLACEHOLDER) planFail(`${p.id}: the unset slot says "${slot.text}", not the one placeholder`);
  }
  for (const m of sectionSrc.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    if (/\$\s*\d/.test(m[2])) planFail(`${PLANS_SECTION} types a price figure (${m[2]}) — a figure comes from the plan's own constant through priceSlot()`);
    if (m[2].includes(LAUNCH_PLACEHOLDER) || m[2].includes(EARLY_ACCESS_CTA)) planFail(`${PLANS_SECTION} types "${m[2]}" — the slot's words live in ${PLANS_LEAF}`);
  }
  if (!sectionSrc.includes('priceSlot(plan)')) planFail(`${PLANS_SECTION} does not call priceSlot() — the slot is the leaf's, geometry and all`);
  // Nothing invented anywhere on the surface: no countdown, no statistic, no testimonial.
  const INVENTED = /\b(\d+%\s*off|limited time|ends (?:in|soon)|save \$\d|\d+,?\d*\s*(?:customers|users|traders|founders)\b|testimonial)/i;
  for (const f of [PLANS_LEAF, PLANS_SECTION]) {
    for (const m of codeOf(f).matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
      if (INVENTED.test(m[2])) planFail(`${f} carries "${m[2]}" — no invented price, discount, countdown, statistic or testimonial on the offer`);
    }
  }

  // ── CLAUSE 5. THE THREE RELATIONSHIP LINES ARE THE CUMULATIVE ONES. ──
  const RELATIONSHIPS: readonly string[] = [
    'Your own money, start to finish.',
    'Everything in Personal, plus the company.',
    'Everything in Personal, plus the trading book.',
    'Personal, the company and the trading book, in one set of records.',
  ];
  PLANS.forEach((p, i) => {
    if (p.relationship !== RELATIONSHIPS[i]) planFail(`${p.id}'s relationship line is "${p.relationship}", not "${RELATIONSHIPS[i]}" — the line says which modules the plan holds`);
  });
  const NAMES: readonly string[] = ['Personal', 'Personal + Business', 'Personal + Trading', 'Everything'];
  PLANS.forEach((p, i) => {
    if (p.name !== NAMES[i]) planFail(`plan ${i + 1} is named "${p.name}", not "${NAMES[i]}"`);
  });
  // The section renders both lines, on the card and over the table column.
  for (const attr of ['data-plan-audience', 'data-plan-relationship', 'data-column-audience', 'data-column-relationship']) {
    if (!sectionSrc.includes(attr)) planFail(`${PLANS_SECTION} renders no ${attr} — the audience and the relationship sit on the card AND over the column`);
  }
  // ── THE DOOR THE SECTION CARRIES. ──
  // id="modules" was the offer act's. The plans section took it, and three things
  // still resolve to it: the Stripe cancel_url, the /modules access block's door
  // and /pricing's. A page may not lose its door, and this one moved.
  const ANCHOR_USERS = ['src/app/api/stripe/checkout-entitlement/route.ts', 'src/app/modules/[pillar]/ModulePageClient.tsx'];
  if (!sectionSrc.includes("headingId = 'modules'")) planFail(`${PLANS_SECTION}'s default headingId is not 'modules' — the offer act's anchor rides on the plans now`);
  const landingSource = codeOf('src/components/landing/Landing.tsx');
  if (!landingSource.includes('<PlansSection door=')) planFail('the landing does not mount <PlansSection/>');
  else if (/<PlansSection[^>]*headingId=/.test(landingSource)) planFail("the landing overrides <PlansSection/>'s headingId — #modules is the anchor the checkout cancel_url returns to, and it lives on the plans");
  for (const f of ANCHOR_USERS) {
    if (!codeOf(f).includes('#modules')) planFail(`${f} no longer names #modules — if the door moved, the section it lands on must move with it`);
  }

  // ── OFFER-03: THE MODULE MODEL, ON THE SURFACE. ──
  // Every module is sold; the two are independent; the bundle alone reserves the
  // best-value position and claims nothing while the prices are unset.
  const MODULE_SET = new Set(CAPABILITY_GROUPS.flatMap((g) => g.rows.map((r) => r.module)));
  for (const m of MODULES) {
    if (!MODULE_SET.has(m)) planFail(`no capability row belongs to the ${m} module — a module with no rows is sold empty`);
    if (!PLANS.some((p) => p.modules.includes(m))) planFail(`the ${m} module is in no plan`);
  }
  for (const [have, without] of [['business', 'trading'], ['trading', 'business']] as const) {
    if (!PLANS.some((p) => p.modules.includes(have) && !p.modules.includes(without))) {
      planFail(`${have} is reachable only together with ${without} — the two modules are independent`);
    }
  }
  for (const p of PLANS) {
    const slot = priceSlot(p);
    if (p.price.monthly === null && slot.bestValue === 'claimed') planFail(`${p.id} claims the best-value mark with no price set`);
    if (slot.bestValue !== null && p.id !== 'everything') planFail(`${p.id} carries a best-value position — only the bundle does`);
  }
  // The section reserves the position, and types the words nowhere: they are the leaf's.
  if (!sectionSrc.includes('slot.bestValue')) planFail(`${PLANS_SECTION} does not render the reserved best-value position`);
  if (!sectionSrc.includes('BEST_VALUE_WORDS')) planFail(`${PLANS_SECTION} does not read BEST_VALUE_WORDS from the leaf`);
  for (const m of sectionSrc.matchAll(/(['"`])((?:\\.|(?!\1)[^\\])*)\1/g)) {
    if (m[2].toLowerCase().includes(BEST_VALUE_WORDS.toLowerCase())) planFail(`${PLANS_SECTION} types "${m[2]}" — the best-value words live in the leaf and render only when a slot claims them`);
  }
  // THE PHONE COLUMN: four check columns do not fit 390px, so one plan shows at a
  // time below `lg` and a selector reaches every plan.
  if (!sectionSrc.includes('data-plan-selector')) planFail(`${PLANS_SECTION} renders no plan selector — at phone width the table shows one column and every plan must still be reachable`);
  if (!/data-plan-select=\{plan\.id\}/.test(sectionSrc)) planFail(`${PLANS_SECTION}'s selector is not built from PLANS — every plan must have a button`);
  if (!sectionSrc.includes("hidden lg:table-cell")) planFail(`${PLANS_SECTION} does not gate its columns below lg — four check columns do not fit a phone`);
  // And the table's desktop floor is gated with them: a 720px minimum under a 390px
  // phone pushes the one column the selector chose off the screen entirely.
  for (const m of sectionSrc.matchAll(/<table className="([^"]*)"/g)) {
    const cls = m[1].split(/\s+/);
    const ungated = cls.filter((c) => /^min-w-/.test(c));
    if (ungated.length > 0) planFail(`${PLANS_SECTION}'s table carries ${ungated.join(' ')} at every width — a desktop floor must be gated (lg:min-w-…) or the selected column sits off a phone's screen`);
    if (!cls.some((c) => /^lg:min-w-/.test(c))) planFail(`${PLANS_SECTION}'s table declares no lg:min-w-… — the four columns need their floor from lg up`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // OFFER-04: THE SECTION SAYS WHAT IT MEANS.
  //
  // "base", "module", "tier", "cumulative", "registry", "beat" and "loop" are this
  // codebase's words for how the offer is ASSEMBLED. A customer does not buy a
  // module or read a beat. None of them may reach the screen.
  //
  // WHAT THIS CLAUSE COVERS: the copy the section and its leaf AUTHOR — the two
  // heading lines, every plan's name, role, positioning, audience, relationship and
  // benefits, every group title, every capability row's label, the cell labels, the
  // price placeholder and its button, the best-value words, Travel's free line, and
  // the text this component types between its own tags.
  //
  // WHY-01 (2026-09-23) MADE THIS LITERAL. OFFER-04 had to carve out the registry's
  // own `why` notes, because the table showed them verbatim and one of them said
  // `module_expenses`. The table no longer shows a `why` at all — it shows the
  // registry's CUSTOMER sentence — so the exception is gone and every string a
  // customer reads in this section is covered, the sentences included.
  //
  // Still not covered, because no customer reads them: CSS class names, data-*
  // attribute values and the `modules` anchor id.
  const BUILDER_WORDS = ['module', 'base', 'tier', 'cumulative', 'registry', 'beat', 'loop'];
  const builderWordsIn = (text: string) => BUILDER_WORDS.filter((w) => new RegExp(`\\b${w}`, 'i').test(text));

  // ───────────────────────────────────────────────────────────────────────────
  // WHY-01: THE CUSTOMER READS A SENTENCE WRITTEN FOR THE CUSTOMER.
  //
  // Every tool a plan row can show as ◐ or Coming — the set the opened group puts
  // on screen (PlansSection.tsx filters capabilityNotes to status !== 'LIVE').
  const shownNotLive: [string, string | null][] = [];
  {
    const seen = new Set<string>();
    for (const g of CAPABILITY_GROUPS) {
      for (const row of g.rows) {
        for (const n of capabilityNotes(row)) {
          if (n.status === 'LIVE' || seen.has(n.name)) continue;
          seen.add(n.name);
          shownNotLive.push([n.name, n.customer]);
        }
      }
    }
  }

  // 1. THE PLANS TABLE RENDERS NO `why`. Not the component, not the note type the
  //    leaf hands it — a field that is not carried cannot leak.
  if (/\bn\.why\b|\bnote\.why\b/.test(sectionSrc)) planFail(`${PLANS_SECTION} renders a registry \`why\` — that is the builder's evidence; the customer reads the customer sentence`);
  if (/\bwhy\b/.test(codeOf(PLANS_LEAF).slice(codeOf(PLANS_LEAF).indexOf('export interface CapabilityNote')))) {
    planFail(`${PLANS_LEAF} still names \`why\` at or below CapabilityNote — the note the public table receives carries the customer sentence and nothing else`);
  }

  // 2. EVERY TOOL A PLAN ROW CAN SHOW HAS ONE, and it is named when it does not.
  for (const [name, line] of shownNotLive) {
    if (!line || !line.trim()) planFail(`${name} can be shown by a plan row as ◐ or Coming and carries no customer sentence — add one beside its \`why\` in src/lib/toolRegistry.ts`);
  }

  // 3. AND IT IS WRITTEN FOR A CUSTOMER: no PR id, no snake_case identifier, no
  //    "the founder", and none of the loop's own beat words. (The builder words are
  //    checked with the rest of the section's copy, below.)
  // BEAT_WORDS is the plan law's own const, declared above for the beat-claim check.
  for (const [name, line] of shownNotLive) {
    if (!line) continue;
    const prId = line.match(/\b[A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d+\b/);
    if (prId) planFail(`${name}'s customer sentence names "${prId[0]}" — a customer does not read PR ids`);
    const snake = line.match(/\b[a-z][a-z0-9]*(?:_[a-z0-9]+)+\b/);
    if (snake) planFail(`${name}'s customer sentence names "${snake[0]}" — a table or column name is not a customer's word`);
    if (/\bfounder/i.test(line)) planFail(`${name}'s customer sentence says "founder" — the customer is not told whose account this runs on`);
    const beats = BEAT_WORDS.filter((w) => new RegExp(`\\b${w}`, 'i').test(line));
    if (beats.length) planFail(`${name}'s customer sentence says "${beats.join('", "')}" — the loop's beat words are the builder's vocabulary`);
  }

  const authoredCopy: { where: string; text: string }[] = [
    { where: 'PLANS_HEADLINE', text: PLANS_HEADLINE },
    { where: 'PLANS_SUBHEAD', text: PLANS_SUBHEAD },
    { where: 'BEST_VALUE_WORDS', text: BEST_VALUE_WORDS },
    { where: 'LAUNCH_PLACEHOLDER', text: LAUNCH_PLACEHOLDER },
    { where: 'EARLY_ACCESS_CTA', text: EARLY_ACCESS_CTA },
  ];
  for (const p of PLANS) {
    authoredCopy.push(
      { where: `PLANS.${p.id}.name`, text: p.name },
      { where: `PLANS.${p.id}.role`, text: p.role },
      { where: `PLANS.${p.id}.positioning`, text: p.positioning },
      { where: `PLANS.${p.id}.audience`, text: p.audience },
      { where: `PLANS.${p.id}.relationship`, text: p.relationship },
    );
    p.benefits.forEach((t, i) => authoredCopy.push({ where: `PLANS.${p.id}.benefits[${i}]`, text: t }));
  }
  for (const g of CAPABILITY_GROUPS) {
    authoredCopy.push({ where: `group "${g.id}" title`, text: g.title });
    for (const row of g.rows) authoredCopy.push({ where: `group "${g.id}" row`, text: row.label });
  }
  for (const [state, label] of Object.entries(CELL_LABEL)) authoredCopy.push({ where: `CELL_LABEL.${state}`, text: label });
  const freeLine = travelFreeLine();
  if (freeLine) authoredCopy.push({ where: 'travelFreeLine()', text: freeLine });
  // The customer sentences are copy this section renders, so they are held to the
  // same bar as the rest of it — and to more, below.
  for (const [name, line] of shownNotLive) authoredCopy.push({ where: `${name}'s customer sentence`, text: line ?? '' });

  for (const { where, text } of authoredCopy) {
    const found = builderWordsIn(text);
    if (found.length) planFail(`${where} says "${text}" — "${found.join('", "')}" ${found.length === 1 ? 'is a builder' : 'are builder'} word${found.length === 1 ? '' : 's'}, not a customer's; the plans section says what it means`);
  }

  // And the text the component types between its own tags, which never reached the
  // leaf. `>text<` with no brace in it is a literal the customer reads.
  for (const m of sectionSrc.matchAll(/>([^<>{}]+)</g)) {
    const text = m[1].replace(/\s+/g, ' ').trim();
    if (text.length < 3) continue;
    const found = builderWordsIn(text);
    if (found.length) planFail(`${PLANS_SECTION} types "${text}" between its tags — "${found.join('", "')}" ${found.length === 1 ? 'is a builder word' : 'are builder words'}; the section's copy lives in the leaf and speaks plainly`);
  }

  // The two heading lines come FROM the leaf — the component renders them and types
  // neither, so the words can only be changed in one place.
  if (!sectionSrc.includes('{PLANS_HEADLINE}')) planFail(`${PLANS_SECTION} does not render PLANS_HEADLINE — the heading is the leaf's string, not one typed here`);
  if (!sectionSrc.includes('{PLANS_SUBHEAD}')) planFail(`${PLANS_SECTION} does not render PLANS_SUBHEAD — the subhead is the leaf's string, not one typed here`);
  if (!sectionSrc.includes('{plan.role}')) planFail(`${PLANS_SECTION} does not render plan.role — the eyebrow over each plan's name is the leaf's string`);

  // Travel's free line sits once, derived from the registry's own Travel row.
  if (!sectionSrc.includes('travelFreeLine()')) planFail(`${PLANS_SECTION} does not call travelFreeLine() — Travel's free line derives from the registry's Travel row, never typed`);
  if ((sectionSrc.match(/data-travel-free/g) ?? []).length !== 1) planFail(`${PLANS_SECTION} renders Travel's free line ${(sectionSrc.match(/data-travel-free/g) ?? []).length} times — it sits once, under the cards`);

  if (planViolations === 0) {
    console.log(`✔ The plan law passed — ${PLANS.length} plans over ${MODULES.length} modules (${PLANS.map((p) => `${p.id}{${p.modules.join(',')}}`).join(' ')}), ${CAPABILITY_GROUPS.length} capability groups and ${CAPABILITY_GROUPS.reduce((n, g) => n + g.rows.length, 0)} rows accounting for all ${TOOL_REGISTRY.length} registry tools; every cell is set membership (${readyCells} ✓, ${partialCells} ◐) with no ✓ over a tool that is not LIVE and no cell drawn for a module its plan does not hold; the price slot is the launch placeholder on all ${PLANS.length} and the bundle's best-value position is reserved, not claimed; no tool count, no beat name and no persona grid on ${PLAN_SURFACES.length} plan surfaces; ${authoredCopy.length} authored strings and the component's own typed text carry none of the ${BUILDER_WORDS.length} builder words, and the ${shownNotLive.length} tools a row can show as ◐ or Coming each carry a customer sentence — no PR id, no table name, no beat word, no \"founder\" — with the builder's own why reaching no public surface.`);
  } else {
    console.log(`✖ The plan law FAILED — ${planViolations} violation(s).`);
  }
});

lawGuard('The row law', () => {
  let rowViolations = 0;
  const rowFail = (m: string) => { rowViolations += 1; violations.push(`row law: ${m} (TRAVEL-ROW-01)`); };

  const ROW_STRIP = 'src/components/trips/RowActionStrip.tsx';
  /**
   * Is this offset inside a <tbody>…</tbody>? The nearest tbody marker before it
   * is an OPEN, not a close. That is exactly the difference between "under the
   * selected row" and "in a bar after the table", which is the whole ruling.
   */
  const inTableBody = (body: string, at: number) => body.lastIndexOf('<tbody', at) > body.lastIndexOf('</tbody>', at);
  /** Every offset a token occurs at. */
  const allAt = (body: string, token: string): number[] => {
    const out: number[] = [];
    for (let at = body.indexOf(token); at >= 0; at = body.indexOf(token, at + 1)) out.push(at);
    return out;
  };
  const lineAt = (body: string, at: number) => body.slice(0, at).split('\n').length;

  /**
   * The four travel result views. `actions` are the action wirings this view
   * renders — each must occur EXACTLY ONCE and inside a table body. `gone` are
   * the bars TRAVEL-ROW-01 deleted: one place to act, not two.
   */
  const ROW_VIEWS: { file: string; actions: string[]; gone: string[] }[] = [
    {
      file: 'src/components/trips/HotelResultsView.tsx',
      actions: ['onSave={onSave ? () => onSave(card, rate) : undefined}', 'onBook={() => onBook(card, rate)}'],
      gone: ['data-hotel-selection'],
    },
    {
      file: 'src/components/trips/FlightPickerView.tsx',
      actions: ['onSave={() => onCommitLeg(leg.id)}', 'onBook={onBookLeg && !fare.isManual ? () => onBookLeg(leg.id) : undefined}'],
      gone: ['leg.selectedOffer && !leg.committed && ('],
    },
    {
      file: 'src/components/trips/ActivityPickerView.tsx',
      actions: ['{savePanel && <div data-activity-save-panel>{savePanel}</div>}'],
      gone: ['data-activity-selection'],
    },
    {
      file: 'src/components/trips/PublicActivitySearch.tsx',
      actions: ['onSave={save}', 'bookHref={selectedCard.productUrl ?? undefined}'],
      gone: ['data-activity-save-button'],
    },
  ];

  // ── CLAUSE 1. The strip is mounted UNDER THE ROW, inside the table body. ──
  // One mount per view, inside a <tbody>, and the row it sits under carries
  // tabIndex={-1} so Close can put focus back on it.
  for (const view of ROW_VIEWS) {
    const body = codeOf(view.file);
    if (!body.includes(`from './RowActionStrip'`)) rowFail(`${view.file} does not import RowActionStrip — every travel result view acts through the one shared strip`);
    const mounts = allAt(body, '<RowActionStrip');
    if (mounts.length !== 1) { rowFail(`${view.file} mounts <RowActionStrip/> ${mounts.length} times — a view has exactly one action strip, the one under its selected row`); continue; }
    if (!inTableBody(body, mounts[0])) rowFail(`${view.file}:${lineAt(body, mounts[0])} mounts <RowActionStrip/> outside a <tbody> — the strip is a row of the table, directly beneath the line it acts on`);
    const before = body.slice(0, mounts[0]);
    if (!before.slice(before.lastIndexOf('<tr')).includes('tabIndex={-1}')) rowFail(`${view.file}: the row above the strip is not focusable (tabIndex={-1}) — Close returns focus to the row, so the row must be focusable programmatically`);
  }

  // ── CLAUSE 2. NO SELECTION BAR OUTSIDE A TABLE. ──
  // Every action wiring sits inside a table body, and the bars this ruling
  // deleted are gone from every view — one place to act, not two.
  for (const view of ROW_VIEWS) {
    const body = codeOf(view.file);
    for (const action of view.actions) {
      const at = allAt(body, action);
      if (at.length !== 1) { rowFail(`${view.file} wires \`${action}\` ${at.length} times — the action is rendered once, in the strip under the selected row`); continue; }
      if (!inTableBody(body, at[0])) rowFail(`${view.file}:${lineAt(body, at[0])} wires \`${action}\` outside a <tbody> — that is a selection bar after the table, which is what TRAVEL-ROW-01 deleted`);
    }
    for (const bar of view.gone) {
      if (body.includes(bar)) rowFail(`${view.file} still carries \`${bar}\` — the selection bar after the table was DELETED by TRAVEL-ROW-01; the actions live in the strip under the row`);
    }
  }

  // ── CLAUSE 3. THE CHECKOUT MOUNTS ONLY IN THE SLOT. ──
  // The container passes the checkout ELEMENT into the view's `checkout` slot,
  // mounts it nowhere else, and the view still never books: no result view
  // imports a checkout panel — it receives one as a ReactNode.
  const ROW_CHECKOUTS: { container: string; view: string; panel: string }[] = [
    { container: 'src/components/trips/PublicHotelSearch.tsx', view: '<HotelResultsView', panel: '<CheckoutPanel' },
    { container: 'src/components/trips/PublicFlightSearch.tsx', view: '<FlightPickerView', panel: '<LiteApiFlightCheckoutPanel' },
  ];
  for (const c of ROW_CHECKOUTS) {
    const body = codeOf(c.container);
    const mounts = allAt(body, c.panel);
    const viewAt = body.indexOf(c.view);
    if (viewAt < 0) { rowFail(`${c.container} no longer mounts ${c.view}/> — the checkout reaches the strip through that view's slot`); continue; }
    const viewEnd = body.indexOf('/>', body.indexOf('onCloseCheckout=', viewAt));
    if (mounts.length !== 1) { rowFail(`${c.container} mounts ${c.panel}/> ${mounts.length} times — it is mounted once, in the view's \`checkout\` slot, and nowhere else`); continue; }
    if (!(mounts[0] > viewAt && viewEnd > 0 && mounts[0] < viewEnd)) rowFail(`${c.container}:${lineAt(body, mounts[0])} mounts ${c.panel}/> outside ${c.view}/>'s \`checkout\` slot — a checkout at the tail of the page is what TRAVEL-ROW-01 moved to the line`);
    if (!body.includes('checkout={')) rowFail(`${c.container} passes no \`checkout={…}\` — the container fills the slot; the view never books`);
    if (!body.includes('onCloseCheckout={')) rowFail(`${c.container} passes no \`onCloseCheckout={…}\` — Close collapses the strip's checkout from the container that opened it`);
  }
  for (const view of ROW_VIEWS) {
    const body = codeOf(view.file);
    for (const panel of ['CheckoutPanel', 'LiteApiFlightCheckoutPanel']) {
      if (new RegExp(`import ${panel} from`).test(body)) rowFail(`${view.file} imports ${panel} — a result view DISPLAYS; the checkout is an element its container passes into the slot`);
    }
  }
  // The strip renders what it is handed and imports no panel of its own.
  const stripBody = codeOf(ROW_STRIP);
  if (!stripBody.includes('checkout?: ReactNode;')) rowFail(`${ROW_STRIP} does not take the checkout as a ReactNode — the slot is an element the container built, never a panel the strip chose`);
  if (/import\s+\w*CheckoutPanel/.test(stripBody)) rowFail(`${ROW_STRIP} imports a checkout panel — it renders the element it is handed and nothing else`);

  // ── CLAUSE 4. THE STRIP'S OWN CLOCK. ──
  // On open the checkout comes to the top of the viewport and takes the caret;
  // Close and Escape both collapse it and return focus to the row above.
  for (const [what, needle] of [
    ['scroll the opened checkout to the top of the viewport', `wrap.scrollIntoView({ block: 'start', behavior: 'smooth' })`],
    ['focus the opened checkout without scrolling the page again', 'heading.focus({ preventScroll: true });'],
    ['return focus to the row it belongs to', 'stripRef.current?.previousElementSibling'],
    ['close on Escape', `if (e.key === 'Escape')`],
    ['close on the Close button', 'onClick={closeAndReturn}'],
  ] as const) {
    if (!stripBody.includes(needle)) rowFail(`${ROW_STRIP} does not ${what} (\`${needle}\` is gone) — the founder must land on the form and get back to the row`);
  }
  if (!/<tr ref=\{stripRef\} data-row-strip=\{rowId\}/.test(stripBody)) rowFail(`${ROW_STRIP} is no longer a <tr> carrying data-row-strip={rowId} — it is a row of the table, so the line above it never moves`);
  if (!stripBody.includes('<td colSpan={colSpan}')) rowFail(`${ROW_STRIP} does not span the table's columns — the strip is full width beneath the row`);

  // ── CLAUSE 5. THE TWO FILES THAT ACTUALLY BOOK DID NOT MOVE. ──
  // Display is not booking. These hashes are the ones both panels carried on
  // main 97d6db04, before TRAVEL-ROW-01: not a re-pin, an UNCHANGED pin.
  const ROW_UNTOUCHED: { file: string; sha256: string }[] = [
    // CHECKOUT-01 (2026-09-23): re-pinned by its own ruling — the panel now NAMES why
    // it cannot take a card instead of leaving a blank pane. Where it mounts, which
    // TRAVEL-ROW-01 owns, is untouched.
    // CHECKOUT-03 (2026-09-23): re-pinned by its own ruling — the panel waits on
    // Stripe.js before handing off, so the vendor's loader cannot hang. Where it
    // mounts, which TRAVEL-ROW-01 owns, is untouched.
    // COMM-01 (2026-09-26): re-pinned by its own ruling — the panel renders the
    // vendor's stated prebook commission or "not stated", never a hidden 0. Where
    // it mounts, which the row law owns, is untouched.
    // Was b3fd49cbd8acf9ab3d5afb11fdc42f61089722d2951dd6cbfa6a8dc2bdf19b46 at main 0ef428a6.
    { file: 'src/components/trips/CheckoutPanel.tsx', sha256: 'ab04853f236ae7d519c717a7aa5183efbaa20eab370caa2bd73b9f46904734b0' },
    // FL-5b (2026-09-23): re-pinned by its own ruling — the panel sends the contact
    // with the book call so the confirmation has somewhere to go. Where it mounts,
    // which TRAVEL-ROW-01 owns, is untouched.
    // FL-4c (2026-09-23): re-pinned by its own ruling — the panel reads its
    // publishable key from the vendor's /config. Where it mounts, which
    // TRAVEL-ROW-01 owns, is untouched.
    // FL-4c v2 (2026-09-23): re-pinned again by its own ruling — the panel rides
    // the vendor's documented wrapper instead of hand-rolled Stripe Elements, and
    // the booking completes on /booking/flight-confirm because that rail redirects.
    // Where it mounts, which TRAVEL-ROW-01 owns, is untouched.
    // Was 21b681fca23325df4e0925ce53515bb483a9ea75f0129ab0ab5720b44057c806 at main b75c3ab1.
    // LANE-01 (2026-09-25): re-pinned by its own ruling — the panel takes an optional
    // tripId and carries it in the returnUrl when present. Where it mounts, which
    // TRAVEL-ROW-01 owns, is untouched.
    // Was 559fa688d4c88dfc7fc83bf1ff91fba13dff4e9cace83e83b82198a505dba98c at main 8f06554c.
    // SEC-03 (2026-09-25): re-pinned by its own ruling — the returnUrl carries ids
    // only; the contact email no longer rides the redirect. Where it mounts, which
    // the row law owns, is untouched.
    // Was 6fc3a51fcf5e2a552ca7d6cd7ccf88ed0997b4b4ed77f12706cd76944d6be92c at main a5e66262.
    { file: 'src/components/trips/LiteApiFlightCheckoutPanel.tsx', sha256: '85abd313700af8443d1f76c325c6b9bc15db3ee785011b445e3c4fe1ea16a864' },
  ];
  const flowPins = codeOf('src/lib/travelBookingFlow.ts');
  const flowNotes = commentsOf('src/lib/travelBookingFlow.ts');
  for (const p of ROW_UNTOUCHED) {
    const now = bookingFlowSha256(rejoin(codeOf(p.file), commentsOf(p.file)));
    if (now !== p.sha256) rowFail(`${p.file} hashes to ${now}, not the ${p.sha256} it carried on main 97d6db04 — TRAVEL-ROW-01 moved WHERE the checkout mounts, never what it does; a booking file that changed here is a different ruling`);
    const pinAt = flowPins.indexOf(`{ file: '${p.file}', sha256: '${p.sha256}' }`);
    if (pinAt < 0) { rowFail(`${p.file} is not pinned at ${p.sha256} in travelBookingFlow.ts — the census must still carry the hash it had on main`); continue; }
    if (/TRAVEL-ROW-01/.test(noteBlockOver(flowPins, flowNotes, flowPins.slice(0, pinAt).split('\n').length))) {
      rowFail(`${p.file}'s pin carries a TRAVEL-ROW-01 note — this ruling re-dated the views and the containers; the two checkout panels are UNTOUCHED and a dated note over them would say otherwise`);
    }
  }
  // And the strip itself is in the census, pinned new by this ruling.
  if (!flowPins.includes(`{ file: '${ROW_STRIP}', sha256: '`)) rowFail(`${ROW_STRIP} is not in the booking-flow census — the strip is where Book is pressed, so it is pinned`);

  if (rowViolations === 0) console.log(`✔ The row law passed — ${ROW_VIEWS.length} travel result views, each acting only in the one strip under its selected row; 0 selection bars outside a table; both checkouts mounted only in the view's slot; LiteApiFlightCheckoutPanel.tsx byte-identical to its FL-4c re-pin and CheckoutPanel.tsx to its CHECKOUT-01 one.`);
  else console.log(`✖ The row law FAILED — ${rowViolations} violation(s).`);
});

lawGuard('The reader law', () => {

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
});

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
