import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { PANEL_TOKEN_ALLOWLIST, SECTION_HEADER, SURFACE, WHITE_INK_ON_DARK_ANCESTOR } from '../ds';
import { BOOKING_FLOW_BASE, BOOKING_FLOW_FILES, bookingFlowSha256 } from '../travelBookingFlow';
import { code, comments, rejoin } from '../sourceText';

/**
 * REPAINT-04 — THE DEAD SURFACE'S PAINT COMES OFF EVERY WALL IT IS STILL ON.
 * The paint is asserted from source, comments stripped (TEST-TRUTH-01); the
 * rendered row and label are shown in the walk.
 */

const ROOT = resolve(__dirname, '../../..');
const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const TRIPS = 'src/components/trips/AllTripsList.tsx';
const PANEL_TOKEN = /\bpanel-(?:surface|border|hover|highlight)\b|\bbg-panel\b/g;
/** The cream-shell vocabulary REPAINT-3 established — the only tokens the repaint may write. */
const CREAM_TOKENS = new Set(['border-border', 'bg-white', 'bg-bg-row', 'text-text-primary', 'text-text-secondary', 'text-text-muted', 'text-text-faint', 'text-brand-purple', 'bg-brand-purple/10', 'hover:bg-bg-row']);
const LIGHT_BG = new Set(['bg-white', 'bg-ts-white', 'bg-bg-row', 'bg-bg-terminal']);
const DARK_INK = new Set(['text-text-primary', 'text-text-secondary', 'text-text-muted', 'text-brand-purple']);

function srcFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const abs = `${dir}/${name}`;
    if (statSync(abs).isDirectory()) { if (name !== '__tests__' && name !== 'node_modules') out.push(...srcFiles(abs)); continue; }
    if (name.endsWith('.ts') || name.endsWith('.tsx')) out.push(abs.replace(`${ROOT}/`, ''));
  }
  return out;
}
const travelRegion = () => {
  const launcher = code(LAUNCHER);
  const at = (n: string) => launcher.indexOf(`data-travel-section="${n}"`);
  return launcher.slice(at('header'), launcher.indexOf('</section>', at('unattached')));
};

// ───────────────────────────────────────────────────────────────────────────
test('/travel renders every TravelHeading with the section-label token and none with text-white', () => {
  const launcher = code(LAUNCHER);
  assert.match(launcher, /function TravelHeading\(\{ children \}: \{ children: React\.ReactNode \}\) \{\s*return <h2 className=\{SECTION_HEADER\} data-travel-heading>\{children\}<\/h2>;/);
  assert.match(launcher, /import \{ SECTION_HEADER, STATE \} from '@\/lib\/ds';/, 'the one definition, imported — never a second');
  // The token is the shell's own: aubergine mono ink on the cream row, as the trade log, the day view and the grid wear it.
  assert.match(SECTION_HEADER, /\btext-brand-purple\b/);
  assert.match(SECTION_HEADER, /\bbg-bg-row\b/);
  assert.doesNotMatch(SECTION_HEADER, /text-white/);
  for (const f of ['src/app/trade-log/page.tsx', 'src/components/hub/DayView.tsx', 'src/components/bookkeeping/BookkeepingSection.tsx']) {
    assert.match(code(f), /SECTION_HEADER/, `${f} labels its sections with the same token`);
  }
  const region = travelRegion();
  assert.equal((region.match(/<TravelHeading>/g) ?? []).length, 6, 'six labels: Trips · Itinerary · Search · Booked · Ledger · Unattached');
  assert.doesNotMatch(region, /text-white/, 'no white ink anywhere in the travel region');
  assert.match(comments(LAUNCHER), /REPAINT-04 \(2026-09-21\)/);
});

test('an unselected trip row carries the cream-shell classes and its name is not text-on-same-tone', () => {
  const trips = code(TRIPS);
  assert.match(trips, /hover:bg-bg-row \$\{selectedTripId === trip\.id \? 'border-brand-purple bg-brand-purple\/10' : 'border-border bg-white'\}/);
  assert.equal(trips.match(PANEL_TOKEN), null, 'no panel token survives in the list');
  assert.match(trips, /<td className="px-3 py-3 font-medium text-text-primary">\{trip\.name\}<\/td>/);
  // The row is a light fill and the name a dark ink — never the same tone.
  const unselectedBg = 'bg-white';
  const nameInk = 'text-text-primary';
  assert.ok(LIGHT_BG.has(unselectedBg) && DARK_INK.has(nameInk));
  assert.match(trips, /<td className="px-3 py-3 text-text-muted">\{trip\.destination \|\| '—'\}<\/td>/, 'destination readable');
  assert.match(trips, /<td className="px-3 py-3 text-text-muted">\{formatRange\(trip\.startDate, trip\.endDate\)\}<\/td>/, 'dates readable');
  assert.match(trips, /rounded-full bg-brand-purple\/10 px-2 py-0\.5 text-xs font-medium text-brand-purple">\s*\{trip\.status\}/, 'the status chip is aubergine ink on the aubergine wash');
  assert.match(trips, /aria-label=\{`Delete \$\{trip\.name\}`\}/, 'the delete control stays');
  assert.match(comments(TRIPS), /REPAINT-04 \(2026-09-21\)/);
});

test('a selected row is visibly distinct from an unselected one, and hover from rest', () => {
  const selected = 'border-brand-purple bg-brand-purple/10';
  const unselected = 'border-border bg-white';
  assert.notEqual(selected, unselected);
  const bgOf = (cls: string) => cls.split(' ').find((c) => c.startsWith('bg-'));
  assert.notEqual(bgOf(selected), bgOf(unselected), 'the fills differ');
  assert.notEqual(selected.split(' ')[0], unselected.split(' ')[0], 'the hairlines differ');
  assert.equal(SURFACE.hover, 'bg-bg-row', 'the hover fill is the cream row, REPAINT-3\'s own');
  assert.notEqual(SURFACE.hover, bgOf(unselected), 'hover differs from rest');
  assert.match(code(TRIPS), /hover:bg-bg-row/);
});

test('the allowlist matches the files the law admits — and each still declares its surface dark', () => {
  const painted = srcFiles(resolve(ROOT, 'src')).filter((f) => f !== 'src/lib/ds.ts' && (code(f).match(PANEL_TOKEN) ?? []).length > 0).sort();
  assert.deepEqual(painted, PANEL_TOKEN_ALLOWLIST.map((a) => a.file).sort());
  assert.deepEqual(PANEL_TOKEN_ALLOWLIST.map((a) => a.file), [
    'src/app/modules/[pillar]/ModulePageClient.tsx',
    'src/components/OfferCard.tsx',
    'src/components/dashboard/BudgetBuilder.tsx',
  ]);
  for (const a of PANEL_TOKEN_ALLOWLIST) {
    assert.ok(existsSync(resolve(ROOT, a.file)), `${a.file} exists`);
    assert.ok(code(a.file).includes(a.declaredBy), `${a.file} declares ${a.declaredBy}`);
    assert.ok(a.surface.length > 20, 'the surface is named');
  }
  // The dark tone of OfferCard is consumed by the /modules band alone.
  const consumers = srcFiles(resolve(ROOT, 'src')).filter((f) => /tone="dark"|tone: 'dark'/.test(code(f)));
  assert.deepEqual(consumers, ['src/app/modules/[pillar]/ModulePageClient.tsx']);
  // The family stays defined for them.
  assert.match(code('tailwind.config.ts'), /\bpanel:\s*\{/);
  assert.match(comments('tailwind.config.ts'), /REPAINT-04/);
});

test('every other miss is repainted to a cream token REPAINT-3 established, with a REPAINT-04 note', () => {
  const repainted: Array<[string, RegExp[]]> = [
    ['src/components/home/TaxHandoffGate.tsx', [/'rounded-xl border-2 border-border bg-white px-4 py-3 text-sm text-text-muted'/, /'rounded-xl border-2 border-border bg-white px-6 py-5'/, /tracking-tight text-text-primary'\}>Tax begins at completed books/, /'mx-auto mt-2 max-w-md text-sm text-text-secondary'/, /tracking-wider text-text-muted'\}>\s*Derived from your actual closed books/]],
    ['src/components/hub/BudgetComparison.tsx', [/<tr className="bg-bg-row text-text-secondary">/, /<tr className="bg-bg-row text-text-primary font-semibold">/, /travelMonths\.includes\(i\) \? 'bg-brand-purple\/10' : ''/, /text-right bg-brand-purple\/10 min-w-\[70px\]">FY Total/]],
    ['src/components/hub/HubBudgetSection.tsx', [/<tr className="border-b border-border bg-bg-row">/]],
    ['src/components/landing/Landing.tsx', [/rounded-lg border border-border bg-white">\s*<table className="w-full min-w-\[1080px\] text-sm">/, /tracking-wider text-text-faint">\s*<th className="px-3 py-2 font-semibold">Entity<\/th>/, /<div className="font-mono text-xs text-text-primary whitespace-nowrap">\{code\}<\/div>/, /<div className="text-\[10px\] leading-tight text-text-faint">\{label\}<\/div>/]],
    ['src/components/trading/TradeRecord.tsx', [/'rounded-lg border border-border bg-white px-3 py-2 text-xs text-text-muted'/]],
    ['src/components/BacktestPanel.tsx', [/<tr key=\{i\} className="border-b border-border hover:bg-bg-row">/]],
    ['src/components/CheckoutResultBanner.tsx', [/: 'border-border bg-bg-row text-text-secondary'/]],
    ['src/components/trips/TripBudgetActual.tsx', [/rounded-full bg-brand-purple\/10 px-2 py-0\.5 text-xs font-medium text-brand-purple">Saved<\/span>/]],
    ['src/components/trips/UnattachedBookings.tsx', [/text-xs font-medium text-brand-purple hover:bg-brand-purple\/10 disabled:opacity-50"/]],
  ];
  for (const [f, patterns] of repainted) {
    const body = code(f);
    assert.equal(body.match(PANEL_TOKEN), null, `${f} paints no panel token`);
    for (const p of patterns) assert.match(body, p, `${f} wears ${p}`);
    assert.match(comments(f), /REPAINT-04 \(2026-09-21\)/, `${f} names the ruling`);
  }
  // No new colour: every token the repaint wrote is one REPAINT-3 established.
  const wrote = ['border-border', 'bg-white', 'bg-bg-row', 'text-text-primary', 'text-text-secondary', 'text-text-muted', 'text-text-faint', 'text-brand-purple', 'bg-brand-purple/10', 'hover:bg-bg-row'];
  for (const t of wrote) assert.ok(CREAM_TOKENS.has(t), `${t} is an established token`);
  assert.equal(SURFACE.card, 'rounded-lg border border-border bg-white');
  assert.equal(SURFACE.inset, 'bg-bg-row');
});

test('white ink on the travel tab sits on a solid dark element, or on the three cited ancestor fills', () => {
  assert.deepEqual(WHITE_INK_ON_DARK_ANCESTOR.map((e) => e.file), [
    'src/components/trips/TripTimelineView.tsx',
    'src/components/ui/ToggleStrip.tsx',
    'src/components/trips/travelStripModes.tsx',
  ]);
  for (const e of WHITE_INK_ON_DARK_ANCESTOR) {
    assert.ok(code(e.ancestorFile).includes(e.declaredBy), `${e.ancestorFile} declares ${e.declaredBy}`);
  }
  // The timeline's fill is applied to its day blocks; the trust row rides the band's slot.
  assert.match(code('src/components/trips/TripTimelineView.tsx'), /\$\{TRAVEL_FILL\}/);
  assert.match(code('src/components/ui/ToggleStrip.tsx'), /style=\{\{ background: DS\.BAND_BG \}\}[\s\S]{0,600}\{trust && <div className="mt-4">\{trust\}<\/div>\}/);
  // The one legitimately-white travel control is a solid aubergine button.
  assert.match(code(LAUNCHER), /bg-brand-purple px-3 py-1\.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover/);
});

test('the one pinned booking-surface file this repaint touched is re-pinned, dated, paint only', () => {
  const f = 'src/components/trips/UnattachedBookings.tsx';
  const pin = BOOKING_FLOW_FILES.find((p) => p.file === f)!;
  assert.equal(bookingFlowSha256(rejoin(code(f), comments(f))), pin.sha256);
  assert.match(BOOKING_FLOW_BASE, /REPAINT-04 \(2026-09-21\)/);
  assert.match(comments('src/lib/travelBookingFlow.ts'), /REPAINT-04 \(2026-09-21\): re-pinned/);
  assert.match(comments('src/lib/travelBookingFlow.ts'), /d5f8e0be428de6054eb756c0301c1e064e825f6ddb013d45cc332b7ca6157492/, 'the old hash is kept for the record');
  // Nothing but paint: the button's fetch and label are what they were.
  const body = code(f);
  assert.match(body, /onClick=\{\(\) => attach\(r\.id\)\}/);
  assert.match(body, /\{busyId === r\.id \? 'Attaching…' : `Add to \$\{selectedTrip\.name \|\| 'selected trip'\}`\}/);
});
