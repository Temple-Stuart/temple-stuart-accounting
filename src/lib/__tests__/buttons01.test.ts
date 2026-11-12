/**
 * HOME-FINISH-01 (Alex, 2026-11-08 11:00: "the send a project proposal... white button... why? same thing on blog read the
 * post button.... should be consistent, like lookup, purple join early access purple") — ONE FILLED PURPLE BUTTON on the
 * public page. src/lib/ds.ts PRIMARY_CTA is the class, and (the follow-up on #1931, Alex, 2026-11-08) it carries the shape:
 * 44px tall, the label centred, so every user wears it bare — the plans' doors, "Send a project proposal →", "Read the
 * post →", "Look up" and the strip's "Jump to them ↓". Words, hrefs and data hooks unchanged. CONTROL.primaryButton and
 * ghostButton — the app's — are untouched.
 * HOME-SERVICES-01 (Alex's brief, 2026-11-12): FOUR USERS NOW — "Send a project proposal →" is the Professional Services section's
 * gold link (src/components/landing/ServicesSection.tsx, .ts-ps-cta), by the brief's ruling f: "THE GOLD BUTTON replaces the purple
 * one here; PRIMARY_CTA keeps its other users." Landing.tsx wears PRIMARY_CTA nowhere, and its words live in src/lib/proposalNeeds.ts.
 *
 *   T1 PRIMARY_CTA exported with the exact string, beside CONTROL, dated; the app's two buttons unchanged;
 *   T2 the four users (five until HOME-SERVICES-01, 2026-11-12) wear it with no display or height class of their own — only mt-3 (the jump link), shrink-0 and
 *      disabled:opacity-60 (the lookup) beside it; their words, hrefs and hooks unchanged;
 *   T3 no ghost border (`border-brand-purple/40`) left in Landing.tsx, WasHereSection.tsx, PlansSection.tsx,
 *      GuestBookingLookup.tsx or travelStripModes.tsx;
 *   T4 the three re-pins, the REPAINT-04 way: each new hash matches its file; each note dated; each old hash kept; the base
 *      records them; the two views cite ds.ts by name and no file says "ds.ts:225".
 * Source is read through code() and comments() only. No clock, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { code, comments, rejoin } from '../sourceText';
import { CONTROL, PRIMARY_CTA } from '../ds';
import { BOOKING_FLOW_BASE, BOOKING_FLOW_FILES, bookingFlowSha256 } from '../travelBookingFlow';

const DS = 'src/lib/ds.ts';
const LANDING = 'src/components/landing/Landing.tsx';
const DECK = 'src/components/landing/PipelineDeck.tsx'; // PIPELINE-PAGE-01 (2026-11-09): the deck's own file — the 14 steps moved there whole from Landing.tsx
const TRIP = 'src/components/landing/WasHereSection.tsx';
const PLANS = 'src/components/offer/PlansSection.tsx';
const LOOKUP = 'src/components/guest/GuestBookingLookup.tsx';
const STRIP = 'src/components/trips/travelStripModes.tsx';
const FLIGHT_VIEW = 'src/components/trips/FlightPickerView.tsx';
const TRANSFER_VIEW = 'src/components/trips/ActivityResultsView.tsx';
const PINS = 'src/lib/travelBookingFlow.ts';

test('T1 PRIMARY_CTA is exported with the exact string — the shape in the class — beside CONTROL, dated; the app\'s CONTROL buttons are unchanged', () => {
  assert.equal(PRIMARY_CTA, 'inline-flex min-h-[44px] items-center justify-center rounded-lg bg-brand-purple px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover');
  const ds = code(DS);
  const control = ds.indexOf('export const CONTROL = {');
  const primary = ds.indexOf("export const PRIMARY_CTA = '");
  assert.ok(control > -1 && primary > control && primary < ds.indexOf('export function toggleChip('), 'beside CONTROL — after it, before toggleChip');
  assert.match(comments(DS), /HOME-FINISH-01 \(Alex, 2026-11-08\): the public page's one filled button — [^\n]*44px tall, its label centred/);
  assert.equal(CONTROL.primaryButton, 'rounded bg-brand-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-purple-hover disabled:opacity-50', 'the app\'s primary, unchanged');
  assert.equal(CONTROL.ghostButton, 'rounded border border-brand-purple/40 px-4 py-2 text-sm font-medium text-brand-purple transition-colors hover:bg-brand-purple-wash', 'the app\'s ghost, unchanged');
});

test('T2 the four users wear PRIMARY_CTA bare (five until HOME-SERVICES-01, 2026-11-12: the proposal button is gold now) — no display or height class of their own; only mt-3, shrink-0 and disabled:opacity-60 beside it; words, hrefs and hooks unchanged', () => {
  const plans = code(PLANS);
  assert.match(plans, /import \{ DATA, PRIMARY_CTA \} from '@\/lib\/ds';/);
  assert.match(plans, /\nconst CTA = PRIMARY_CTA;/);
  assert.doesNotMatch(plans, /const CTA = '|inline-block text-center/, 'no second copy of the string, no shape of its own');
  assert.match(plans, /<Link href=\{door\.href\} className=\{CTA\} data-plan-cta=\{plan\.id\}>\{label\}<\/Link>/, 'the link door');
  assert.match(plans, /<button type="button" onClick=\{\(\) => door\.onClick\(plan\.id\)\} className=\{CTA\} data-plan-cta=\{plan\.id\}>/, 'the button door');
  const landing = code(LANDING);
  // HOME-SERVICES-01 (Alex's brief, 2026-11-12; ruling f: "THE GOLD BUTTON replaces the purple one here; PRIMARY_CTA keeps its other
  // users. "Send a project proposal →" and "Scoped by proposal" move from Landing.tsx into a leaf."): the proposal button is the
  // Professional Services section's gold link (ServicesSection.tsx), so Landing.tsx neither imports nor wears PRIMARY_CTA, and types
  // neither word. Until then: assert.match(landing, /\} from '@\/lib\/proposalNeeds'; import \{ PRIMARY_CTA \} from '@\/lib\/ds';/,
  // 'the import rides an existing line — every line above :1807 stays'); assert.match(landing, /<Link\n\s*href=\{PROPOSAL_FORM_PATH\}\n\s*
  // className=\{PRIMARY_CTA\}\n\s*>\n\s*Send a project proposal →\n\s*<\/Link>/). The gold link's own pins are homeServices01.test.ts's.
  assert.doesNotMatch(landing, /\bPRIMARY_CTA\b/, 'Landing.tsx wears PRIMARY_CTA nowhere — the proposal button is gold, in ServicesSection.tsx');
  assert.ok(!landing.includes('Send a project proposal →') && !landing.includes('Scoped by proposal'), 'neither word is typed in Landing.tsx');
  assert.doesNotMatch(code('src/components/landing/ServicesSection.tsx'), /\bPRIMARY_CTA\b/, 'the gold link wears the section\'s own class, not PRIMARY_CTA');
  // PIPELINE-PAGE-01 (2026-11-09): the s08 line moved with the deck to PipelineDeck.tsx — found by content (the one line whose code starts with s08:), never by number.
  assert.equal(code(DECK).split('\n').filter((l) => /^\s+s08: /.test(l)).length, 1, 'exactly one s08 line, in the deck\'s file');
  const trip = code(TRIP);
  assert.match(trip, /import \{ PRIMARY_CTA \} from '@\/lib\/ds';/);
  assert.match(trip, /\n {2}link: PRIMARY_CTA,/);
  assert.match(trip, /<a href=\{href\} className=\{TRIP\.link\} data-was-here-post-link>\{READ_THE_POST\}<\/a>/, 'the post link\'s words and hook unchanged');
  assert.match(trip, /export const READ_THE_POST = 'Read the post →';/);
  const lookup = code(LOOKUP);
  assert.match(lookup, /import \{ PRIMARY_CTA \} from '@\/lib\/ds';/);
  assert.match(lookup, /<button type="submit" disabled=\{busy\} className=\{`\$\{PRIMARY_CTA\} shrink-0 disabled:opacity-60`\} data-guest-open>\n\s*Look up\n\s*<\/button>/, 'its type, disabled and data-guest-open unchanged');
  const strip = code(STRIP);
  assert.match(strip, /import ComingSoonSection from '@\/components\/home\/ComingSoonSection'; import \{ PRIMARY_CTA \} from '@\/lib\/ds';/, 'the import rides an existing line — travelStripModes.tsx:181 is cited by number');
  assert.match(strip, /<a\n\s*href=\{eventsAnchor\}\n\s*className=\{`mt-3 \$\{PRIMARY_CTA\}`\}\n\s*>\n\s*Jump to them ↓\n\s*<\/a>/, 'the jump link: its href and its words unchanged');
  // nothing beside the class but the three ruled extras
  const worn = [...[plans, landing, trip, lookup, strip].join('\n').matchAll(/`([^`]*\$\{PRIMARY_CTA\}[^`]*)`/g)].map((m) => m[1].replace('${PRIMARY_CTA}', '').trim());
  assert.deepEqual(worn.sort(), ['mt-3', 'shrink-0 disabled:opacity-60'], 'only mt-3, shrink-0 and disabled:opacity-60 ride beside it');
});

test('T3 no ghost border left on the five public files', () => {
  for (const f of [LANDING, TRIP, PLANS, LOOKUP, STRIP]) assert.doesNotMatch(code(f), /border-brand-purple\/40/, `${f}: no border-brand-purple/40`);
});

test('T4 the three re-pins, the REPAINT-04 way — each new hash matches, each note dated, each old hash kept; the base records them; ds.ts is cited by name, never ":225"', () => {
  const notes = comments(PINS);
  const OLD: Record<string, string> = {
    [STRIP]: '64cceb629d68bab227951417a6bc911c1c69385c3bf2348a575b527db63e9e37',
    [FLIGHT_VIEW]: '413996654695e37b13e53a9d115032b6ec95d02ad9f8e72591f9b7c6f9d792e4',
    [TRANSFER_VIEW]: '0a6fe304e51baecfedd727825c655c289d5a2ef2270ded03f84133273463a4aa',
  };
  for (const [f, old] of Object.entries(OLD)) {
    const pin = BOOKING_FLOW_FILES.find((p) => p.file === f);
    assert.ok(pin, `${f} is pinned`);
    assert.equal(bookingFlowSha256(rejoin(code(f), comments(f))), pin.sha256, `${f}: the new hash matches the file`);
    assert.notEqual(pin.sha256, old, `${f}: the hash moved with the bytes`);
    assert.ok(notes.includes(`Was ${old} at main 97d04a8d.`), `${f}: the old hash is kept for the record`);
  }
  assert.match(notes, /HOME-FINISH-01 \(2026-11-08\): re-pinned — paint only, the jump link wears PRIMARY_CTA/);
  assert.equal((notes.match(/HOME-FINISH-01 \(2026-11-08\): re-pinned — comment only: its header cites src\/lib\/ds\.ts DATA\.columnHeader by NAME/g) ?? []).length, 2, 'the two views, comment only');
  assert.match(BOOKING_FLOW_BASE, /the strip re-pinned by HOME-FINISH-01 \(2026-11-08\), paint only — the jump link wears PRIMARY_CTA; the flight view and the transfer view re-pinned by HOME-FINISH-01 \(2026-11-08\), comment only — ds\.ts cited by name/);
  for (const f of [FLIGHT_VIEW, TRANSFER_VIEW]) assert.match(comments(f), /DATA\.columnHeader micro-label is the one shared class string \(src\/lib\/ds\.ts DATA\.columnHeader\)\./, `${f} cites by name`);
  // nothing in src or scripts cites ds.ts:225 any more — a line number drifts, a name does not
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : walk(full);
    return /\.tsx?$/.test(name) ? [full.slice(process.cwd().length + 1)] : [];
  });
  const citing = [...walk(resolve(process.cwd(), 'src')), ...walk(resolve(process.cwd(), 'scripts'))].filter((f) => /\bds\.ts:225\b/.test(comments(f)));
  assert.deepEqual(citing, []);
});
