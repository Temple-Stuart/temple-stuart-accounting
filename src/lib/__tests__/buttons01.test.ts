/**
 * HOME-FINISH-01 (Alex, 2026-11-08 11:00: "the send a project proposal... white button... why? same thing on blog read the
 * post button.... should be consistent, like lookup, purple join early access purple") — ONE FILLED PURPLE BUTTON on the
 * public page. src/lib/ds.ts PRIMARY_CTA is the class; the plans' doors read it as their CTA, the DONE-FOR-YOU panel's
 * "Send a project proposal →" and the trip cards' "Read the post →" wear it, each at least 44px tall. Words, hrefs and data
 * hooks unchanged. CONTROL.primaryButton and ghostButton — the app's — are untouched.
 *
 *   T1 PRIMARY_CTA exported with the exact string, beside CONTROL, dated; the app's two buttons unchanged;
 *   T2 the three wearers — PlansSection's CTA is PRIMARY_CTA; the proposal Link and the post link carry it and min-h-[44px];
 *   T3 no ghost border (`border-brand-purple/40`) left in Landing.tsx, WasHereSection.tsx, PlansSection.tsx or
 *      GuestBookingLookup.tsx.
 * Source is read through code() and comments() only. No clock, no network.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { CONTROL, PRIMARY_CTA } from '../ds';

const DS = 'src/lib/ds.ts';
const LANDING = 'src/components/landing/Landing.tsx';
const TRIP = 'src/components/landing/WasHereSection.tsx';
const PLANS = 'src/components/offer/PlansSection.tsx';
const LOOKUP = 'src/components/guest/GuestBookingLookup.tsx';

test('T1 PRIMARY_CTA is exported with the exact string, beside CONTROL, dated; the app\'s CONTROL buttons are unchanged', () => {
  assert.equal(PRIMARY_CTA, 'rounded-lg bg-brand-purple px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover');
  const ds = code(DS);
  const control = ds.indexOf('export const CONTROL = {');
  const primary = ds.indexOf("export const PRIMARY_CTA = '");
  assert.ok(control > -1 && primary > control && primary < ds.indexOf('export function toggleChip('), 'beside CONTROL — after it, before toggleChip');
  assert.match(comments(DS), /HOME-FINISH-01 \(Alex, 2026-11-08\): the public page's one filled button/);
  assert.equal(CONTROL.primaryButton, 'rounded bg-brand-purple px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-purple-hover disabled:opacity-50', 'the app\'s primary, unchanged');
  assert.equal(CONTROL.ghostButton, 'rounded border border-brand-purple/40 px-4 py-2 text-sm font-medium text-brand-purple transition-colors hover:bg-brand-purple-wash', 'the app\'s ghost, unchanged');
});

test('T2 the wearers: PlansSection\'s CTA is PRIMARY_CTA; the proposal Link and the post link carry PRIMARY_CTA and min-h-[44px]; their words and hooks unchanged', () => {
  const plans = code(PLANS);
  assert.match(plans, /import \{ DATA, PRIMARY_CTA \} from '@\/lib\/ds';/);
  assert.match(plans, /\nconst CTA = PRIMARY_CTA;/);
  assert.doesNotMatch(plans, /const CTA = '/, 'no second copy of the string');
  assert.match(plans, /className=\{`inline-block text-center \$\{CTA\}`\} data-plan-cta=\{plan\.id\}/, 'the link door');
  assert.match(plans, /className=\{CTA\} data-plan-cta=\{plan\.id\}/, 'the button door');
  const landing = code(LANDING);
  assert.match(landing, /\} from '@\/lib\/proposalNeeds'; import \{ PRIMARY_CTA \} from '@\/lib\/ds';/, 'the import rides an existing line — every line above :1807 stays');
  assert.match(landing, /<Link\n\s*href=\{PROPOSAL_FORM_PATH\}\n\s*className=\{`\$\{PRIMARY_CTA\} inline-block min-h-\[44px\] text-center`\}\n\s*>\n\s*Send a project proposal →\n\s*<\/Link>/);
  assert.match(landing.split('\n')[1806], /^\s+s08: /, 'Landing.tsx:1807 is still the s08 line — the import came in line for line');
  const trip = code(TRIP);
  assert.match(trip, /import \{ PRIMARY_CTA \} from '@\/lib\/ds';/);
  assert.match(trip, /\n {2}link: `inline-flex min-h-\[44px\] items-center \$\{PRIMARY_CTA\}`,/);
  assert.match(trip, /<a href=\{href\} className=\{TRIP\.link\} data-was-here-post-link>\{READ_THE_POST\}<\/a>/, 'the post link\'s words and hook unchanged');
  assert.match(trip, /export const READ_THE_POST = 'Read the post →';/);
});

test('T3 no ghost border left on the four public files the ruling names', () => {
  for (const f of [LANDING, TRIP, PLANS, LOOKUP]) assert.doesNotMatch(code(f), /border-brand-purple\/40/, `${f}: no border-brand-purple/40`);
});
