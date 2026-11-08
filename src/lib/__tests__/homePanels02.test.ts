/**
 * HOME-PANELS-02 (Alex, 2026-11-07 23:53) — DONE-FOR-YOU moves up on the home page: directly under MY TRIP (the trip
 * log; the guest's strip when it renders), directly above THE PLANS (early access); THE PLANS then sits over the
 * pipeline header, since the pipe is the system's. One concept: the section's seat — its markup moved WHOLESALE,
 * byte-identical inside <section>…</section>; only its position and Landing's comments changed.
 *
 *   T1 the order, by index — experiences → MY TRIP → the guest strip → DONE-FOR-YOU (the eyebrow) → THE PLANS → the
 *      pipeline header, each mounted once; nothing but a comment between each neighbour pair;
 *   T2 the seams — one rule per boundary from experiences to 01, every one a border-b: my trip's (WasHereSection), the
 *      strip's own when it renders (GuestTripStrip), done-for-you's (no border-t), the plans act's (PlansSection.tsx),
 *      the header's; the ledger's three lines present once each and the old two gone; the header's SEAM sentence names
 *      the plans; the LANDING-V4 comment's SEAT paragraph, dated; the history lines untouched;
 *   T3 the act list — DONE-FOR-YOU and its two historical notes above THE PLANS' three lines, THE PIPELINE header after;
 *      the historical notes' words untouched; :1807 (the s08 line the deck tests index) still in place.
 * Source is read through code() and comments() only (the reader law). No clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';

const LANDING = 'src/components/landing/Landing.tsx';
const TRIP = 'src/components/landing/WasHereSection.tsx';
const STRIP = 'src/components/landing/GuestTripStrip.tsx';
const PLANS = 'src/components/offer/PlansSection.tsx';

const EXPERIENCES = '<ExperiencesSection today={today} />';
const MY_TRIP = '<WasHereSection today={today} />';
const GUEST_STRIP = '<GuestTripStrip onRequireAuth={onRequireAuth} />';
const EYEBROW = 'DONE-FOR-YOU\n';
const SECTION_OPEN = '<section className="w-full border-b border-border bg-bg-terminal">';
const PLANS_MOUNT = "<PlansSection door={{ kind: 'button', onClick: () => onRequireAuth() }} />";
const HEADER = '<section aria-label="The pipeline"';
/** code() blanks a JSX comment's words and keeps its braces — the guest law's own allowance. */
const ONLY_COMMENTS = /^\s*(\{\s*\}\s*)*$/;

test('T1 the order by index: experiences → MY TRIP → the guest strip → DONE-FOR-YOU → THE PLANS → the pipeline header; each once; nothing but a comment between each pair', () => {
  const landing = code(LANDING);
  const at = (s: string): number => { const i = landing.indexOf(s); assert.notEqual(i, -1, s); return i; };
  for (const s of [EXPERIENCES, MY_TRIP, GUEST_STRIP, EYEBROW, SECTION_OPEN, PLANS_MOUNT, HEADER]) assert.equal(landing.split(s).length - 1, 1, `${s.trim()} once`);
  const order = [EXPERIENCES, MY_TRIP, GUEST_STRIP, SECTION_OPEN, EYEBROW, PLANS_MOUNT, HEADER].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'experiences → my trip → the guest strip → DONE-FOR-YOU → the plans → the pipeline header');
  assert.match(landing.slice(at(GUEST_STRIP) + GUEST_STRIP.length, at(SECTION_OPEN)), ONLY_COMMENTS, 'the strip → the section: a comment between, nothing else');
  const sectionEnd = landing.indexOf('</section>', at(EYEBROW)) + '</section>'.length;
  assert.ok(sectionEnd > at(EYEBROW) && sectionEnd < at(PLANS_MOUNT));
  assert.match(landing.slice(sectionEnd, at(PLANS_MOUNT)), ONLY_COMMENTS, 'the section → the plans mount: a comment between, nothing else');
  assert.match(landing.slice(at(PLANS_MOUNT) + PLANS_MOUNT.length, at(HEADER)), ONLY_COMMENTS, 'the plans mount → the header: a comment between, nothing else');
  assert.match(landing.slice(at(MY_TRIP) + MY_TRIP.length, at(GUEST_STRIP)), ONLY_COMMENTS, 'my trip → the strip: a comment between (unchanged)');
});

test('T2 the seams: one border-b per boundary from experiences to 01 — my trip\'s, the strip\'s own, done-for-you\'s (no border-t), the plans act\'s, the header\'s; the ledger\'s three lines once each; the header\'s SEAM and the SEAT paragraph', () => {
  const landing = code(LANDING);
  // the rules, read from the components that carry them
  const trip = code(TRIP);
  const tripAct = /act: '([^']*)'/.exec(trip);
  assert.ok(tripAct && /\bborder-b border-border\b/.test(tripAct[1]) && !/border-t/.test(tripAct[1]), "my trip's border-b (WasHereSection TRIP.act), no border-t");
  assert.match(code(STRIP), /<section className="w-full border-b border-border bg-bg-terminal">/, "the guest strip's own border-b, when it renders");
  assert.equal((landing.match(/<section className="w-full border-b border-border bg-bg-terminal">/g) ?? []).length, 1, "DONE-FOR-YOU's section: border-b, no border-t");
  assert.match(code(PLANS), /<section id=\{headingId\} aria-label="Plans" className="w-full border-b border-border bg-bg-terminal" data-plans>/, "the plans act's border-b (PlansSection.tsx), no border-t");
  const header = /<section aria-label="The pipeline" className="([^"]*)"/.exec(landing);
  assert.ok(header && /\bborder-b border-border\b/.test(header[1]) && !/border-t/.test(header[1]), "the header's border-b, no border-t");
  // the ledger
  const notes = comments(LANDING);
  const once = (re: RegExp, what: string) => assert.equal((notes.match(re) ?? []).length, 1, what);
  once(/my trip \| guest strip \/ done-for-you → my trip's border-b \(WASHERE-01, 2026-10-31: a\n\s+cream act, the DONE-FOR-YOU idiom, one rule; HOME-PANELS-02,\n\s+2026-11-07: done-for-you sits here now, the plans below it\)/g, "my trip | guest strip / done-for-you → my trip's border-b");
  once(/done-for-you \| plans {5}→ done-for-you's border-b \(HOME-PANELS-02, 2026-11-07\)/g, "done-for-you | plans → done-for-you's border-b");
  once(/plans \| pipeline header → the plans act's border-b \(HOME-PANELS-02, 2026-11-07: done-for-you moved above the plans; until then done-for-you's border-b closed this seam\)/g, "plans | pipeline header → the plans act's border-b");
  assert.doesNotMatch(notes, /my trip \| guest strip \/ plans|done-for-you \| pipeline header → done-for-you's border-b/, 'the two old lines are gone');
  assert.ok(notes.includes("pipeline header | 01 problem   → the header's border-b"), 'header | 01 unchanged');
  // the header's own SEAM sentence names the plans now
  assert.match(notes, /SEAM: this act takes border-b — the plans act's border-b closes\n\s+plans\|header from above \(HOME-PANELS-02, 2026-11-07: done-for-you\n\s+moved above the plans; its border-b closed this seam until then\),\n\s+and this act's border-b closes header\|01, which preserves 01's own\n\s+no-border exception exactly/);
  assert.doesNotMatch(notes, /done-for-you's border-b closes\n\s+done-for-you\|header/);
  // the LANDING-V4 comment: the SEAT paragraph, dated, and the SEAM re-said for the new neighbours
  assert.match(notes, /SEAT \(HOME-PANELS-02, Alex, 2026-11-07 23:53\): directly under MY TRIP\n\s+\(the trip log — and the guest's strip, when it renders\) and directly\n\s+above THE PLANS \(early access\)\. Why: the services sit under the trip\n\s+and above early access while the system is still being built; the\n\s+pipe below the plans is the system's own\./);
  assert.match(notes, /byte-identical inside <section>…<\/section>; only this comment and\n\s+the position changed\./);
  assert.match(notes, /This section's bottom edge closes done-for-you\|plans; the plans act's\n\s+own border-b \(PlansSection\.tsx\) closes plans\|pipeline header, as it\n\s+closed plans\|done-for-you until now\./);
  // history stays as history
  assert.ok(notes.includes("(the close | pipeline header → gone: HOME-PANELS-01, 2026-11-07"), "HOME-PANELS-01's note");
  assert.ok(notes.includes("personas | done-for-you  → the personas act's border-b"), 'the personas lines');
  assert.ok(notes.includes("HOME-PANELS-01, 2026-11-07, folded\n            the close into this card as its fifth door; both seams are history.)"), 'the close seams named as history');
});

test('T3 the act list: DONE-FOR-YOU and its two historical notes above THE PLANS\' three lines, THE PIPELINE header after; the notes\' words untouched; Landing.tsx:1807 is still the s08 line', () => {
  const notes = comments(LANDING);
  const at = (s: string): number => { const i = notes.indexOf(s); assert.notEqual(i, -1, s); return i; };
  const seq = [
    ' *   MY TRIP             — the trip log, a card per stop, each opening its stop\'s page (TRIPCARDS-01)',
    " *   THE GUEST'S TRIP    — the guest's session trip (BOOK-3, GuestTripStrip);",
    // SERVICES-01 (2026-11-08): the line rewritten in place — six doors from src/lib/proposalNeeds.ts; the seat's note kept.
    ' *   DONE-FOR-YOU        — the professional-services panel, six doors from src/lib/proposalNeeds.ts — SERVICES-01, 2026-11-08: the close retired, bookkeeping a door (HOME-PANELS-02, 2026-11-07: under MY TRIP, above THE PLANS)',
    ' *   (COCKPIT-PERF-01, 2026-10-27: the PERSONAS act — "one system · six lives" —\n *   and the "[PR-MODULES placeholder]" seat, the SELL-02 offer act, stood\n *   between the demo and DONE-FOR-YOU here; OFFER-01 (2026-09-23) replaced both\n *   with THE PLANS.)',
    " *   (THE CLOSE          — HOME-05a's own act, gone: HOME-PANELS-01, 2026-11-07, folded the 2026 close into DONE-FOR-YOU as its fifth door, priced by proposal)",
    ' *   THE PLANS           — four plan cards and one comparison table\n *                         (OFFER-01; PlansSection over src/lib/offer/plans.ts);\n *                         the section carries id="modules"',
    ' *   THE PIPELINE header — names the 14-step run (essay front matter, PR-CHROME)',
  ].map(at);
  assert.deepEqual(seq, [...seq].sort((a, b) => a - b), 'MY TRIP → THE GUEST\'S TRIP → DONE-FOR-YOU (and its notes) → THE PLANS → THE PIPELINE header');
  assert.match(code(LANDING).split('\n')[1806], /^\s+s08: /, 'Landing.tsx:1807 is still the s08 line — the act list was reordered within its own lines');
  for (const phrase of [/THE PLANS\s+— four plan cards and one comparison table/, /id="modules" lives on THE PLANS act/, /said by the four plans below/]) assert.match(notes, phrase, "cockpitPerf01's pins stand");
});
