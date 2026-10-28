/**
 * COCKPIT-PERF-01 (Alex, 2026-10-25/27) — hidden panels stop fetching; account chips toggle; the stale comments go.
 *
 *   A. The cockpit (ModuleLauncher) mounts ONLY the active tab's panel. A hidden tab mounts nothing and fires no
 *      request until selected; a switch mounts the new panel and unmounts the old (no cache, no prefetch). The Books
 *      reads (trial balance, accounts, closing periods) and the Plaid link-token POST moved INTO the Books panel's own
 *      mount (BooksPanel). Ruling 1: the first tab is the path's, read during render. Ruling 2: data-cockpit-panel.
 *   B. CAL-03b: an account chip in the calendar legend — and each neutral chip — toggles its routine tiles, exactly as
 *      a source chip toggles its source's; the hidden state is React state only.
 *   C. Stale words leave (comments only), and ProjectRowView's two unescaped quotes are escaped, the words unchanged.
 *
 * The click itself is proven in the browser (the PR's proofs); here the tree is rendered on the server per path, and
 * the chip behaviour is driven through the pure functions the grid calls.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PathnameContext, SearchParamsContext } from 'next/dist/shared/lib/hooks-client-context.shared-runtime';
import { code, comments } from '../sourceText';
import { chipShows, legendKeyOf, legendOf, toggleShown, type PaletteEvent } from '../calendar/accountPalette';
import { ROUTINES_SOURCE } from '../hub/mapOperationsRoutines';
import type { TileAccount } from '../hub/tileAccount';

// The launcher's tree renders JSX at module scope (travelStripModes), so React goes on globalThis BEFORE it is
// imported — the trips01 harness's reason; the launcher import below is dynamic for it.
Object.assign(globalThis, { React });

const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const GRID = 'src/components/shared/CalendarGrid.tsx';
const PALETTE = 'src/lib/calendar/accountPalette.ts';
const HUB = 'src/components/hub/HubCalendar.tsx';
const ROUTINES_ROUTE = 'src/app/api/operations/routines/route.ts';
const CALENDAR_PAGE = 'src/app/calendar/page.tsx';
const FRONT_DOOR = 'src/app/page.tsx';
const LANDING = 'src/components/landing/Landing.tsx';
const DAYCARD01 = 'src/lib/__tests__/daycard01.test.ts';
const PROJECT_ROW = 'src/components/workbench/operations/projects/ProjectRowView.tsx';
const LAW = 'scripts/assert-tool-registry.ts';
const NAV = 'src/lib/nav.ts';

const TABS = ['calendar', 'travel', 'trade', 'books', 'tax', 'compliance'] as const;

/** The launcher as Next renders it at a path, for a visitor whose sign-in has not resolved (no effect runs here). */
async function launcherAt(pathname: string): Promise<string> {
  const { RailStateProvider } = await import('../../components/shell/RailState');
  const { default: ModuleLauncher } = await import('../../components/home/ModuleLauncher');
  return renderToStaticMarkup(React.createElement(PathnameContext.Provider, { value: pathname },
    React.createElement(SearchParamsContext.Provider, { value: new URLSearchParams('') },
      React.createElement(RailStateProvider, null, React.createElement(ModuleLauncher, { onRequireAuth: () => {} })))));
}
const panelsIn = (html: string): string[] => [...html.matchAll(/data-cockpit-panel="([a-z]+)"/g)].map((m) => m[1]);

// ── RULING A · ONE PANEL MOUNTED ─────────────────────────────────────────────

test('A rendered at a tab\'s path, the launcher mounts that panel alone — every other panel\'s component is not in the tree', async () => {
  for (const [path, tab] of [['/travel', 'travel'], ['/trade', 'trade'], ['/books', 'books'], ['/tax', 'tax']] as const) {
    const html = await launcherAt(path);
    assert.deepEqual(panelsIn(html), [tab], `${path} mounts the ${tab} panel and no other`);
  }
  // Each panel's own markers are absent everywhere but on its own tab (before this ruling every one was in every tree, CSS-hidden).
  const travel = await launcherAt('/travel');
  assert.match(travel, /data-travel-section="header"/);
  assert.doesNotMatch(travel, /Loading your books|data-cockpit-panel="books"|data-cockpit-panel="trade"/, 'the Books and Trade panels are not in the Travel tree');
  const books = await launcherAt('/books');
  assert.match(books, /Loading your books/, 'the Books panel renders its own loading line');
  assert.doesNotMatch(books, /data-travel-section|data-cockpit-panel="travel"/, 'the Travel panel is not in the Books tree');
  // /runway: the calendar panel waits for the sign-in read (authed === true or false) — before it lands, nothing else mounts in its place.
  assert.deepEqual(panelsIn(await launcherAt('/runway')), [], 'no other tab\'s panel stands in for the calendar');
  assert.deepEqual(panelsIn(await launcherAt('/')), [], 'the bare / is the calendar default, as before');
});

test('A ruling 1: the first tab is the path\'s, read during render — /travel\'s first paint is Travel on the server and the client alike', () => {
  const l = code(LAUNCHER);
  assert.match(l, /function tabOfPath\(pathname: string \| null\): string \{\n\s*const seg = \(pathname \?\? ''\)\.split\('\/'\)\[1\] \?\? '';\n\s*return seg === 'runway' \? 'calendar' : TABS\.some\(\(t\) => t\.key === seg\) \? seg : 'calendar';\n\}/);
  assert.match(l, /const pathname = usePathname\(\);\n\s*const \[activeModule, setActiveModule\] = useState\(\(\) => tabOfPath\(pathname\)\);/);
  assert.doesNotMatch(l, /useState\('calendar'\)/, 'the first tab is no longer a constant');
  // The restore effect stands: it tells the parent, normalises the URL and answers the legacy ?tab= (home01 B, home03 C pin it).
  assert.match(l, /const fromPath = seg === 'runway' \? 'calendar' : TABS\.some\(\(t\) => t\.key === seg\) \? seg : null;\n\s*if \(fromPath\) \{ selectTab\(fromPath\); return; \}/);
  // trips01's harness and the trips law's line stand.
  assert.match(l, /const requestedTripId = requestedTripOf\(usePathname\(\), useSearchParams\(\)\);/);
});

test('A every panel is a conditional mount carrying data-cockpit-panel (ruling 2) — none is a CSS-hidden section any more', () => {
  const l = code(LAUNCHER);
  for (const tab of TABS) {
    const at = l.indexOf(`{activeModule === '${tab}' && (`);
    assert.ok(at > 0, `the ${tab} panel is mounted only while its tab is active`);
    const attr = l.indexOf(`data-cockpit-panel="${tab}"`, at);
    assert.ok(attr > at && attr - at < 400, `the ${tab} section, right inside its guard, carries data-cockpit-panel="${tab}"`);
    assert.doesNotMatch(l, new RegExp(`\\$\\{activeModule === '${tab}' \\? 'block' : 'hidden'\\}`), `the ${tab} panel is not CSS-hidden`);
  }
  assert.equal((l.match(/data-cockpit-panel="calendar"/g) ?? []).length, 2, 'the calendar panel: the signed-in branch and the guest branch, both inside the one guard');
  assert.equal((l.match(/data-cockpit-panel="/g) ?? []).length, 7, 'six tabs, seven sections, each marked');
  assert.match(comments(LAUNCHER), /COCKPIT-PERF-01 \(Alex, 2026-10-27, ruling A\): THE COCKPIT MOUNTS ONLY THE ACTIVE TAB'S PANEL/);
});

test('A the Books reads moved INTO the Books panel — the launcher\'s body fires none of them; the panel fires them on its own mount, a locked viewer none', () => {
  const l = code(LAUNCHER);
  const panelAt = l.indexOf('function BooksPanel({ booksLocked, lapsed }: { booksLocked: boolean; lapsed: LapsedEntitlement | null }) {');
  const launcherAt = l.indexOf('export default function ModuleLauncher(');
  assert.ok(panelAt > 0 && launcherAt > panelAt, 'BooksPanel is its own component, above the launcher');
  const panel = l.slice(panelAt, launcherAt);
  const launcherBody = l.slice(launcherAt);
  for (const read of ["fetch('/api/trial-balance')", "fetch('/api/accounts')", 'fetch(`/api/closing-periods?year=${booksYear}`)', 'useBankConnection({ onChanged: loadBooksCockpit, enabled: !booksLocked })']) {
    assert.ok(panel.includes(read), `BooksPanel holds ${read}`);
    assert.ok(!launcherBody.includes(read), `the launcher's body no longer holds ${read}`);
  }
  assert.doesNotMatch(launcherBody, /useBankConnection\(|loadBooksCockpit|booksState|link-initialize/, 'no Books read, state or Plaid script is the launcher\'s');
  // The locked gate came with them, unchanged: a locked viewer fires no cockpit read and no link token.
  assert.match(panel, /useEffect\(\(\) => \{\n\s*if \(booksLocked\) return;\n\s*loadBooksCockpit\(\);\n\s*\}, \[booksLocked, loadBooksCockpit\]\);/);
  assert.match(panel, /<Script src="https:\/\/cdn\.plaid\.com\/link\/v2\/stable\/link-initialize\.js" strategy="lazyOnload" \/>/, 'the Plaid script loads with the panel');
  assert.match(launcherBody, /<BooksPanel booksLocked=\{booksLocked\} lapsed=\{lapsedFor\(keysGranting\('tab:books'\), lapsed\)\} \/>/);
  // The hook itself is untouched: it fetches the token in an effect, only when enabled (toolRegistry.ts cites its lines).
  assert.match(code('src/components/bank/useBankConnection.ts'), /useEffect\(\(\) => \{\n\s*if \(!enabled\) return;/);
});

test('A what a panel reported up closes with it — a re-opened panel says "not loaded yet" until its own re-read lands; selections stay', () => {
  const l = code(LAUNCHER);
  assert.match(l, /useEffect\(\(\) => \(\) => \{\n\s*if \(activeModule === 'calendar'\) \{ setRunwayTotals\(null\); setMatchTotals\(null\); \}\n\s*if \(activeModule === 'travel'\) setUnattachedCount\(null\);\n\s*if \(activeModule === 'trade'\) \{ setTradeScanMeta\(null\); setTradeTally\(null\); setTradeRecordStats\(null\); setTradeCoverage\(null\); \}\n\s*\}, \[activeModule\]\);/);
  assert.doesNotMatch(l, /setCurrentTrip\(null\)|setRunwayPhase\('burn'\)|setTradePhase\('setup'\)/, 'the trip, the runway phase and the trade phase are the viewer\'s choices — kept');
});

test('A the pins that said "CSS-hidden, never unmounted" moved, dated — the law\'s note, nav.ts\'s citations', () => {
  assert.match(comments(LAW), /COCKPIT-PERF-01 \(Alex, 2026-10-27, ruling A\): "as a CSS-hidden section" stood above/);
  assert.match(comments(NAV), /COCKPIT-PERF-01 \(2026-10-27\): 106 lines further down/);
  assert.match(comments('src/lib/__tests__/home01.test.ts'), /COCKPIT-PERF-01 \(Alex, 2026-10-27, ruling A\): "The panels are CSS-hidden, never unmounted/);
  assert.match(comments('src/lib/__tests__/home03.test.ts'), /COCKPIT-PERF-01 \(Alex, 2026-10-27, ruling A\): the anchor was the panel's CSS-hidden class/);
});

// ── RULING B · EVERY CHIP TOGGLES ITS TILES ──────────────────────────────────

const acc = (book: string, code: string, name: string): TileAccount => ({ book, code, name });
const FOOD = acc('P', '6150', 'Food & drink');
const RENT = acc('P', '6010', 'Rent');
const tile = (account: TileAccount | null, accountState: PaletteEvent['accountState']): PaletteEvent => ({ source: ROUTINES_SOURCE, account, accountState });
const TILES: readonly PaletteEvent[] = [
  tile(FOOD, 'account'), tile(FOOD, 'account'), tile(RENT, 'account'),
  tile(null, 'several'), tile(null, 'none'), tile(acc('P', '9999', 'Gone'), 'missing'), tile(null, undefined),
  { source: 'trip' }, { source: 'manual' },
];
const shown = (visible: Record<string, boolean>): PaletteEvent[] => TILES.filter((e) => chipShows(e, visible));

test('B every routine tile is filed under a chip the legend draws — the same key, from the same builder', () => {
  const keys = legendOf(TILES).map((c) => c.key);
  for (const e of TILES) {
    const key = legendKeyOf(e);
    if (e.source === ROUTINES_SOURCE) assert.ok(key !== null && keys.includes(key), `the tile ${JSON.stringify(e)} is under the chip ${key}`);
    else assert.equal(key, null, 'a tile of another source has no account chip — its source chip toggles it');
  }
  assert.equal(legendKeyOf(tile(FOOD, 'account')), 'account:P-6150 Food & drink');
  assert.deepEqual(TILES.slice(3, 7).map(legendKeyOf), ['several', 'none', 'missing:P-9999', 'not-read']);
  assert.throws(() => legendKeyOf(tile(null, 'account')), /a tile in state account carries no account/);
  assert.throws(() => legendKeyOf(tile(null, 'missing')), /a tile in state missing carries no account/);
});

test('B an account chip hides its tiles and shows them again — the other chips\' tiles and the other sources\' untouched', () => {
  let visible: Record<string, boolean> = {};
  assert.equal(shown(visible).length, TILES.length, 'nothing is hidden until a click');
  visible = toggleShown(visible, 'account:P-6150 Food & drink');
  assert.deepEqual(visible, { 'account:P-6150 Food & drink': false });
  assert.equal(shown(visible).length, TILES.length - 2, 'both Food & drink tiles are hidden');
  assert.ok(shown(visible).every((e) => e.account !== FOOD), 'only Food & drink\'s');
  assert.ok(shown(visible).some((e) => e.account === RENT) && shown(visible).some((e) => e.source === 'trip'), 'Rent and the trip stay');
  visible = toggleShown(visible, 'account:P-6150 Food & drink');
  assert.deepEqual(visible, { 'account:P-6150 Food & drink': true });
  assert.equal(shown(visible).length, TILES.length, 'shown again on the next click');
});

test('B the neutral chips — several · no account · a missing account · not read — toggle their tiles the same way', () => {
  for (const key of ['several', 'none', 'missing:P-9999', 'not-read']) {
    const hidden = toggleShown({}, key);
    assert.equal(shown(hidden).length, TILES.length - 1, `${key} hides its one tile`);
    assert.ok(!shown(hidden).some((e) => legendKeyOf(e) === key));
    assert.equal(shown(toggleShown(hidden, key)).length, TILES.length, `${key} shows it again`);
  }
});

test('B the grid: one filter for every view, a <label> per account chip that toggles as a source chip does; the source chip unchanged; React state only', () => {
  const grid = code(GRID);
  assert.match(grid, /const \[visibleChips, setVisibleChips\] = useState<Record<string, boolean>>\(\{\}\);/);
  assert.match(grid, /return \(eventsByDateKey\[key\] \|\| \[\]\)\.filter\(e => visibleCategories\[e\.source\] !== false && chipShows\(e, visibleChips\)\);/, 'month, week and day all read getEventsForDate');
  assert.match(grid, /<label key=\{chip\.key\} className="flex items-center gap-1\.5 cursor-pointer" data-legend-chip=\{chip\.kind\} data-legend-words=\{chip\.words\} onClick=\{\(\) => setVisibleChips\(prev => toggleShown\(prev, chip\.key\)\)\}>/);
  // The source chip, byte for byte as on main 0c52460c.
  assert.match(grid, /<label key=\{source\} className="flex items-center gap-1\.5 cursor-pointer" onClick=\{\(\) => setVisibleCategories\(prev => \(\{ \.\.\.prev, \[source\]: prev\[source\] === false \? true : false \}\)\)\}>\n\s*<div className=\{`w-2\.5 h-2\.5 rounded-sm \$\{visibleCategories\[source\] !== false \? \(config\.badge \|\| config\.dot\) : 'bg-border'\}`\} \/>\n\s*<span className=\{`text-xs \$\{visibleCategories\[source\] !== false \? 'text-text-secondary' : 'text-text-faint line-through'\}`\}>\{config\.label\}<\/span>/);
  // The toggle is the source chips' own expression, in the module.
  assert.match(code(PALETTE), /\(\{ \.\.\.prev, \[key\]: prev\[key\] === false \? true : false \}\)/);
  for (const f of [GRID, PALETTE]) assert.doesNotMatch(code(f), /localStorage|sessionStorage|document\.cookie/, `${f}: the hidden state is React state only`);
});

// ── RULING C · THE STALE WORDS ───────────────────────────────────────────────

test('C the stale comments are corrected, each with a dated note; nothing rendered changed', () => {
  assert.doesNotMatch(comments(HUB), /project=indigo, routines=teal, trade=amber/, 'the scale no longer names a teal routine tile');
  assert.match(comments(HUB), /uses a distinct color scale: trip=cyan, project=indigo, trade=amber\. Routines' teal below is drawn on no tile and no chip/);
  assert.doesNotMatch(comments(ROUTINES_ROUTE), /nothing reads the pair as a duration:/);
  assert.match(comments(ROUTINES_ROUTE), /The pair is read as a\s*\n\s*\/\/ length since WORK-03b \(2026-10-26\)/);
  assert.doesNotMatch(comments(CALENDAR_PAGE), /ModuleLauncher\.tsx:691/);
  assert.doesNotMatch(comments(FRONT_DOOR), /ModuleLauncher :204-231/);
  const landing = comments(LANDING);
  assert.doesNotMatch(landing, /\*\s+PERSONAS\s+— one system · six lives|\[PR-MODULES placeholder — "the what", content TBD\]/, 'the act list names no deleted act as live');
  assert.match(landing, /THE PLANS\s+— four plan cards and one comparison table/);
  assert.match(landing, /id="modules" lives on THE PLANS act/);
  assert.match(landing, /said by the four plans below/);
  assert.doesNotMatch(comments(DAYCARD01), /\/budget lists\s*\n?\s*\/\/ each stranded vendor with Clear \(budgetReportView\.test\.ts T5 pins it\)/);
  assert.match(comments(DAYCARD01), /VENDOR-03 \(2026-10-27\) gave the stranded vendors their home on the day card/);
});

test('C ProjectRowView: the two quotes are escaped in the markup — the words a viewer reads are unchanged', () => {
  const row = code(PROJECT_ROW);
  assert.match(row, /click &quot;↑ generate tasks&quot; to synthesize an atomic task array/);
  assert.doesNotMatch(row, /click "↑ generate tasks" to synthesize/);
  // React decodes the entity: the rendered text is the same characters as before.
  const html = renderToStaticMarkup(React.createElement('div', null, 'click "↑ generate tasks" to'));
  assert.equal(html, '<div>click &quot;↑ generate tasks&quot; to</div>', 'React itself writes the quote as &quot; — the markup now says what React renders');
});
