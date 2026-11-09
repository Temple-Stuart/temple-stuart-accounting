/**
 * HOME-PANELS-02 (Alex, 2026-11-07 23:53) — DONE-FOR-YOU moves up on the home page: directly under MY TRIP (the trip
 * log; the guest's strip when it renders), directly above THE PLANS (early access); THE PLANS then sits over the
 * pipeline header, since the pipe is the system's. One concept: the section's seat — its markup moved WHOLESALE,
 * byte-identical inside <section>…</section>; only its position and Landing's comments changed.
 *
 *   T1 the order, by index — experiences → Stop 0 → MY TRIP → the guest strip → DONE-FOR-YOU (the eyebrow) → THE PLANS →
 *      the door to the 14 steps (PIPELINE-PAGE-01, 2026-11-09: in the pipeline header's seat — the header and its steps
 *      moved whole to /how-it-works), each mounted once; nothing but a comment between each neighbour pair;
 *   T2 the seams — one rule per boundary from experiences to the door, every one a border-b: my trip's (WasHereSection),
 *      the strip's own when it renders (GuestTripStrip), done-for-you's (no border-t), the plans act's (PlansSection.tsx),
 *      the door's (PIPELINE-PAGE-01: below it, built-on's border-t too — two rules on door | built on); the header keeps
 *      its border-b over 01 in the deck's file; the ledger's three lines present once each and the old two gone, and the
 *      header's SEAM sentence naming the plans — both moved with the deck (PipelineDeck.tsx); the LANDING-V4 comment's
 *      SEAT paragraph, dated; the history lines untouched;
 *   T3 the act list — DONE-FOR-YOU and its two historical notes above THE PLANS' three lines, the door's line after (in
 *      place of THE PIPELINE header's); the historical notes' words untouched; the s08 line the deck tests read, found by
 *      content in the deck's file (PIPELINE-PAGE-01 ended the Landing.tsx:1807 pins).
 * Source is read through code() and comments() only (the reader law). No clock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';

const LANDING = 'src/components/landing/Landing.tsx';
const TRIP = 'src/components/landing/WasHereSection.tsx';
const STRIP = 'src/components/landing/GuestTripStrip.tsx';
const PLANS = 'src/components/offer/PlansSection.tsx';
const DECK = 'src/components/landing/PipelineDeck.tsx'; // PIPELINE-PAGE-01 (2026-11-09): the deck's own file — the header, its seam sentence and the ledger moved there whole

const EXPERIENCES = '<ExperiencesSection today={today} />';
const MY_TRIP = '<WasHereSection today={today} />';
const GUEST_STRIP = '<GuestTripStrip onRequireAuth={onRequireAuth} />';
const EYEBROW = 'DONE-FOR-YOU\n';
const SECTION_OPEN = '<section className="w-full border-b border-border bg-bg-terminal">';
const PLANS_MOUNT = "<PlansSection door={{ kind: 'button', onClick: () => onRequireAuth() }} />";
const DOOR = '<section aria-label="How it all connects"'; // PIPELINE-PAGE-01 (2026-11-09): the door in the pipeline header's seat (HEADER was '<section aria-label="The pipeline"')
/** code() blanks a JSX comment's words and keeps its braces — the guest law's own allowance. */
const ONLY_COMMENTS = /^\s*(\{\s*\}\s*)*$/;

test('T1 the order by index: experiences → MY TRIP → the guest strip → DONE-FOR-YOU → THE PLANS → the door (PIPELINE-PAGE-01); each once; nothing but a comment between each pair', () => {
  const landing = code(LANDING);
  const at = (s: string): number => { const i = landing.indexOf(s); assert.notEqual(i, -1, s); return i; };
  for (const s of [EXPERIENCES, MY_TRIP, GUEST_STRIP, EYEBROW, SECTION_OPEN, PLANS_MOUNT, DOOR]) assert.equal(landing.split(s).length - 1, 1, `${s.trim()} once`);
  const order = [EXPERIENCES, '<StopZeroSection />', MY_TRIP, GUEST_STRIP, SECTION_OPEN, EYEBROW, PLANS_MOUNT, DOOR].map(at); // STOP0-01 (Alex, 2026-11-08; 2026-11-09): the Stop 0 mount joins the order, between the experiences and MY TRIP; PIPELINE-PAGE-01 (2026-11-09): the door takes the header's place
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'experiences → stop 0 → my trip → the guest strip → DONE-FOR-YOU → the plans → the door');
  assert.match(landing.slice(at(GUEST_STRIP) + GUEST_STRIP.length, at(SECTION_OPEN)), ONLY_COMMENTS, 'the strip → the section: a comment between, nothing else');
  const sectionEnd = landing.indexOf('</section>', at(EYEBROW)) + '</section>'.length;
  assert.ok(sectionEnd > at(EYEBROW) && sectionEnd < at(PLANS_MOUNT));
  assert.match(landing.slice(sectionEnd, at(PLANS_MOUNT)), ONLY_COMMENTS, 'the section → the plans mount: a comment between, nothing else');
  assert.match(landing.slice(at(PLANS_MOUNT) + PLANS_MOUNT.length, at(DOOR)), ONLY_COMMENTS, 'the plans mount → the door: a comment between, nothing else');
  assert.match(landing.slice(at(MY_TRIP) + MY_TRIP.length, at(GUEST_STRIP)), ONLY_COMMENTS, 'my trip → the strip: a comment between (unchanged)');
});

test('T2 the seams: one border-b per boundary from experiences to the door — my trip\'s, the strip\'s own, done-for-you\'s (no border-t), the plans act\'s, the door\'s (PIPELINE-PAGE-01); the header\'s own over 01, the ledger\'s three lines once each and the header\'s SEAM — in the deck\'s file; the SEAT paragraph', () => {
  const landing = code(LANDING);
  // the rules, read from the components that carry them
  const trip = code(TRIP);
  const tripAct = /act: '([^']*)'/.exec(trip);
  assert.ok(tripAct && /\bborder-b border-border\b/.test(tripAct[1]) && !/border-t/.test(tripAct[1]), "my trip's border-b (WasHereSection TRIP.act), no border-t");
  assert.match(code(STRIP), /<section className="w-full border-b border-border bg-bg-terminal">/, "the guest strip's own border-b, when it renders");
  assert.equal((landing.match(/<section className="w-full border-b border-border bg-bg-terminal">/g) ?? []).length, 1, "DONE-FOR-YOU's section: border-b, no border-t");
  assert.match(code(PLANS), /<section id=\{headingId\} aria-label="Plans" className="w-full border-b border-border bg-bg-terminal" data-plans>/, "the plans act's border-b (PlansSection.tsx), no border-t");
  // PIPELINE-PAGE-01 (2026-11-09): the door stands in the header's seat — its border-b, no border-t; the header moved with the
  // deck and keeps its own border-b, closing header | 01 on /how-it-works.
  const door = /<section aria-label="How it all connects" className="([^"]*)"/.exec(landing);
  assert.ok(door && /\bborder-b border-border\b/.test(door[1]) && !/border-t/.test(door[1]), "the door's border-b, no border-t");
  const header = /<section aria-label="The pipeline" className="([^"]*)"/.exec(code(DECK));
  assert.ok(header && /\bborder-b border-border\b/.test(header[1]) && !/border-t/.test(header[1]), "the header's border-b, no border-t — in the deck's file");
  // the ledger — PIPELINE-PAGE-01 (2026-11-09): it sits over deck-01, so it moved whole with the deck; read it in the deck's file
  const notes = comments(LANDING);
  const deckNotes = comments(DECK);
  const once = (re: RegExp, what: string) => assert.equal((deckNotes.match(re) ?? []).length, 1, what);
  once(/my trip \| guest strip \/ done-for-you → my trip's border-b \(WASHERE-01, 2026-10-31: a\n\s+cream act, the DONE-FOR-YOU idiom, one rule; HOME-PANELS-02,\n\s+2026-11-07: done-for-you sits here now, the plans below it\)/g, "my trip | guest strip / done-for-you → my trip's border-b");
  once(/done-for-you \| plans {5}→ done-for-you's border-b \(HOME-PANELS-02, 2026-11-07\)/g, "done-for-you | plans → done-for-you's border-b");
  once(/plans \| pipeline header → the plans act's border-b \(HOME-PANELS-02, 2026-11-07: done-for-you moved above the plans; until then done-for-you's border-b closed this seam\)/g, "plans | pipeline header → the plans act's border-b");
  for (const n of [notes, deckNotes]) assert.doesNotMatch(n, /my trip \| guest strip \/ plans|done-for-you \| pipeline header → done-for-you's border-b/, 'the two old lines are gone');
  assert.ok(deckNotes.includes("pipeline header | 01 problem   → the header's border-b"), 'header | 01 unchanged');
  // the header's own SEAM sentence names the plans now — it moved with the header (PIPELINE-PAGE-01, 2026-11-09)
  assert.match(deckNotes, /SEAM: this act takes border-b — the plans act's border-b closes\n\s+plans\|header from above \(HOME-PANELS-02, 2026-11-07: done-for-you\n\s+moved above the plans; its border-b closed this seam until then\),\n\s+and this act's border-b closes header\|01, which preserves 01's own\n\s+no-border exception exactly/);
  for (const n of [notes, deckNotes]) assert.doesNotMatch(n, /done-for-you's border-b closes\n\s+done-for-you\|header/);
  // the LANDING-V4 comment: the SEAT paragraph, dated, and the SEAM re-said for the new neighbours
  assert.match(notes, /SEAT \(HOME-PANELS-02, Alex, 2026-11-07 23:53\): directly under MY TRIP\n\s+\(the trip log — and the guest's strip, when it renders\) and directly\n\s+above THE PLANS \(early access\)\. Why: the services sit under the trip\n\s+and above early access while the system is still being built; the\n\s+pipe below the plans is the system's own\./);
  assert.match(notes, /byte-identical inside <section>…<\/section>; only this comment and\n\s+the position changed\./);
  assert.match(notes, /This section's bottom edge closes done-for-you\|plans; the plans act's\n\s+own border-b \(PlansSection\.tsx\) closes plans\|pipeline header, as it\n\s+closed plans\|done-for-you until now\./);
  // history stays as history
  assert.ok(deckNotes.includes("(the close | pipeline header → gone: HOME-PANELS-01, 2026-11-07"), "HOME-PANELS-01's note"); // the ledger's (PIPELINE-PAGE-01: in the deck's file)
  assert.ok(deckNotes.includes("personas | done-for-you  → the personas act's border-b"), 'the personas lines');
  assert.ok(notes.includes("HOME-PANELS-01, 2026-11-07, folded\n            the close into this card as its fifth door; both seams are history.)"), 'the close seams named as history');
});

test('T3 the act list: DONE-FOR-YOU and its two historical notes above THE PLANS\' three lines, the door\'s line after (PIPELINE-PAGE-01: in place of THE PIPELINE header\'s); the notes\' words untouched; the s08 line is the deck\'s, found by content', () => {
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
    // PIPELINE-PAGE-01 (2026-11-09): the door's line, in place of THE PIPELINE header's (' *   THE PIPELINE header — names the 14-step run (essay front matter, PR-CHROME)').
    ' *   HOW IT ALL CONNECTS — the door to the 14 steps (PIPELINE-PAGE-01, 2026-11-09: in the seat THE PIPELINE header held, PR-CHROME — the header and the fourteen steps moved whole to their own page, /how-it-works, PipelineDeck.tsx; the fourteen lines below name the steps behind the door)',
  ].map(at);
  assert.deepEqual(seq, [...seq].sort((a, b) => a - b), 'MY TRIP → THE GUEST\'S TRIP → DONE-FOR-YOU (and its notes) → THE PLANS → the door');
  // PIPELINE-PAGE-01 (2026-11-09): the s08 line moved with the deck to PipelineDeck.tsx — found by content (the one line whose code starts with s08:), never by number.
  assert.equal(code(DECK).split('\n').filter((l) => /^\s+s08: /.test(l)).length, 1, 'exactly one s08 line, in the deck\'s file');
  for (const phrase of [/THE PLANS\s+— four plan cards and one comparison table/, /id="modules" lives on THE PLANS act/, /said by the four plans below/]) assert.match(notes, phrase, "cockpitPerf01's pins stand");
});
