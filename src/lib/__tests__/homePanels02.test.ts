/**
 * HOME-PANELS-02 (Alex, 2026-11-07 23:53) — DONE-FOR-YOU moves up on the home page: directly under MY TRIP (the trip
 * log; the guest's strip when it renders), directly above THE PLANS (early access); THE PLANS then sits over the
 * pipeline header, since the pipe is the system's. One concept: the section's seat — its markup moved WHOLESALE,
 * byte-identical inside <section>…</section>; only its position and Landing's comments changed.
 * HOME-ORDER-01 (Alex, 2026-11-10 16:27: "What We Do → About Us → Our Story"): the seats changed again — every block
 * moved whole into Alex's order. T1 and T3 hold the new order; T2 (the seams, the SEAT paragraph's words) is untouched.
 *
 *   T1 the order, by index — HOME-FINISH-02 (Alex, 2026-11-10 20:56): PLAN → BUILD → EXPLORE — the how-to → DONE-FOR-YOU → the
 *      travel block with the booking box → the guest strip → Stop 0 → MY TRIP → the door. Until then —
 *      HOME-BRIEF-03 (2026-11-10): the how-to stands between THE PLANS and the services section,
 *      a comment between each. HOME-ORDER-01 (2026-11-10): experiences → the guest strip → THE PLANS → DONE-FOR-YOU (the
 *      eyebrow) → Stop 0 → MY TRIP → the door to the 14 steps, each mounted once; nothing but a comment between each
 *      neighbour pair. (Until then: experiences → Stop 0 → MY TRIP → the guest strip → DONE-FOR-YOU → THE PLANS → the
 *      door — PIPELINE-PAGE-01, 2026-11-09, had put the door in the pipeline header's seat when the header and its steps
 *      moved whole to /how-it-works.)
 *   T2 the seams — one rule per boundary from experiences to the door, every one a border-b: my trip's (WasHereSection),
 *      the strip's own when it renders (GuestTripStrip), done-for-you's (no border-t), the plans act's (PlansSection.tsx),
 *      the door's (PIPELINE-PAGE-01: below it, built-on's border-t too — two rules on door | built on); the header keeps
 *      its border-b over 01 in the deck's file; the ledger's three lines present once each and the old two gone, and the
 *      header's SEAM sentence naming the plans — both moved with the deck (PipelineDeck.tsx); the LANDING-V4 comment's
 *      SEAT paragraph, dated; the history lines untouched;
 *   T3 the act list — HOME-FINISH-02 (2026-11-10): THE PLANS' three lines, DONE-FOR-YOU and its two historical notes, LIVE
 *      DEMO — TRAVEL, EXPERIENCES, THE GUEST'S TRIP, MY TRIP, then the door's line, under one dated line. Until then —
 *      HOME-ORDER-01 (2026-11-10): EXPERIENCES, THE GUEST'S TRIP, THE PLANS' three lines, DONE-FOR-YOU and
 *      its two historical notes, MY TRIP, then the door's line (in place of THE PIPELINE header's) — lines moved, their
 *      words untouched (until then: MY TRIP, THE GUEST'S TRIP, DONE-FOR-YOU and its notes, THE PLANS, the door); the s08
 *      line the deck tests read, found by content in the deck's file (PIPELINE-PAGE-01 ended the Landing.tsx:1807 pins).
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
const BOOKING = '<LandingBookingSection onRequireAuth={onRequireAuth} events={<ExperiencesSection today={today} />} />'; // HOME-BRIEF-04 (Alex, 2026-11-10 19:00): the booking box, carrying the experiences catalog as its Events panel
// HOME-FINISH-02 (Alex, 2026-11-10 20:56), Part 4: the travel block's foot row left the page; its last child is the booking lookup, and that marks
// the block's end now. Until then: TRAVEL_FOOT = 'One trip holds everything — plans, bookings, budget.'.
const TRAVEL_FOOT = "<GuestBookingLookup onOpened={() => window.location.assign('/booking/manage')} />";
const MY_TRIP = '<WasHereSection today={today} />';
const GUEST_STRIP = '<GuestTripStrip onRequireAuth={onRequireAuth} />';
const STOP_ZERO = '<StopZeroSection />';
const HOW_TO = '<HowToSection onRequireAuth={onRequireAuth} />'; // HOME-BRIEF-03 (Alex, 2026-11-10): the how-to, between the plans and the services section. HOME-BRIEF-04 (2026-11-10): it IS the Software Plans — in the plans' seat, handed the door ('<HowToSection />' until then)
// HOME-FINISH-02 (Alex, 2026-11-10 20:56): the services section opens at the pillar's h2 ("Build Your Income."), and it is found from that. Until then
// this constant was EYEBROW, the label: 'text-text-faint">\n            PROFESSIONAL SERVICES\n' — its note follows.
const SERVICES_HEAD = '<h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">{BUILD_PILLAR.heading}</h2>'; // (EYEBROW's note) HOME-BRIEF-03 (Alex, 2026-11-10): the section's label reads PROFESSIONAL SERVICES — 'DONE-FOR-YOU\n' until then; found with the end of its own <p>, since the card's chip says the same words
const SECTION_OPEN = '<section id={SERVICES_ANCHOR} className="w-full border-b border-border bg-bg-terminal">'; // HOME-FINISH-02 (2026-11-10): the section carries its anchor — '<section className="w-full border-b border-border bg-bg-terminal">' until then
const TRAVEL_OPEN = '<section aria-label="Live demo — travel" className="max-w-7xl mx-auto px-4 lg:px-8 py-10 border-b border-border">'; // (Part 4: the section wears py-10 — no padding of its own until then) HOME-FINISH-02 (2026-11-10): the travel block, third under "What We Do"
const PLANS_MOUNT = "<PlansSection door={{ kind: 'button', onClick: () => onRequireAuth() }} />"; // HOME-BRIEF-04 (Alex, 2026-11-10 19:00): no longer on this page — held here so T1 can say it is gone
const DOOR = '<section aria-label="How it all connects"'; // PIPELINE-PAGE-01 (2026-11-09): the door in the pipeline header's seat (HEADER was '<section aria-label="The pipeline"')
/** code() blanks a JSX comment's words and keeps its braces — the guest law's own allowance. */
const ONLY_COMMENTS = /^\s*(\{\s*\}\s*)*$/;

test('T1 the order by index (HOME-FINISH-02, 2026-11-10: plan → build → explore): the how-to → DONE-FOR-YOU → the travel block with the booking box → the guest strip → Stop 0 → MY TRIP → the door; each once; nothing but a comment between each pair', () => {
  const landing = code(LANDING);
  const at = (s: string): number => { const i = landing.indexOf(s); assert.notEqual(i, -1, s); return i; };
  for (const s of [EXPERIENCES, BOOKING, GUEST_STRIP, HOW_TO, SECTION_OPEN, SERVICES_HEAD, TRAVEL_OPEN, STOP_ZERO, MY_TRIP, DOOR]) assert.equal(landing.split(s).length - 1, 1, `${s.trim()} once`);
  // HOME-BRIEF-04 (Alex, 2026-11-10 19:00 · 19:03): the purple band is gone — the catalog is mounted once, INSIDE the booking mount, as the box's
  // Events panel. Until then '<ExperiencesSection today={today} />' stood on its own between the travel block and the guest's strip, and this
  // order opened with it ('experiences → the strip: a comment between, nothing else').
  assert.equal(landing.split('<ExperiencesSection').length - 1, 1, 'the catalog is mounted once on the page');
  assert.ok(at(EXPERIENCES) > at(BOOKING) && at(EXPERIENCES) < at(BOOKING) + BOOKING.length, 'and that one mount is the booking box\'s events panel');
  // HOME-BRIEF-04 (Alex, 2026-11-10 19:00: "the how-to should replace software plans"): the plans mount left this page — it stood between the
  // guest's strip and the how-to ('the strip → the plans mount', 'the plans mount → the how-to': a comment between each) — and /pricing keeps it.
  assert.ok(!landing.includes(PLANS_MOUNT) && !landing.includes('PlansSection'), 'the plans are neither mounted nor imported here');
  // HOME-ORDER-01 (2026-11-10): Alex's order — "What We Do → About Us → Our Story". Until then this list read experiences → Stop 0 → MY TRIP → the guest
  // strip → DONE-FOR-YOU → THE PLANS → the door (HOME-PANELS-02's seat; STOP0-01, 2026-11-09, seated Stop 0; PIPELINE-PAGE-01, 2026-11-09, the door).
  // HOME-BRIEF-03 (Alex, 2026-11-10): the how-to (HowToSection) sits between the plans and the services section — the plans mount was the
  // section's direct neighbour until then ('the plans mount → the DONE-FOR-YOU section: a comment between, nothing else').
  // HOME-FINISH-02 (Alex, 2026-11-10 20:56): PLAN → BUILD → EXPLORE — the how-to and the services section moved above the travel block. Until then
  // the order ran the booking box → the guest strip → the how-to → the services section → stop 0, with 'the strip → the how-to' and "the
  // DONE-FOR-YOU section's </section> → stop 0" as neighbour pairs.
  const order = [HOW_TO, SECTION_OPEN, SERVICES_HEAD, TRAVEL_OPEN, BOOKING, GUEST_STRIP, STOP_ZERO, MY_TRIP, DOOR].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'the how-to → the services section → the travel block (the booking box, the experiences inside it) → the guest strip → stop 0 → my trip → the door');
  assert.match(landing.slice(at(HOW_TO) + HOW_TO.length, at(SECTION_OPEN)), ONLY_COMMENTS, 'the how-to → the services section: a comment between, nothing else');
  const sectionEnd = landing.indexOf('</section>', at(SERVICES_HEAD)) + '</section>'.length;
  assert.ok(sectionEnd > at(SERVICES_HEAD) && sectionEnd < at(TRAVEL_OPEN));
  assert.match(landing.slice(sectionEnd, at(TRAVEL_OPEN)), ONLY_COMMENTS, "the DONE-FOR-YOU section's </section> → the travel block: comments between, nothing else");
  const travelEnd = landing.indexOf('</section>', at(TRAVEL_FOOT)) + '</section>'.length;
  assert.ok(at(TRAVEL_FOOT) > at(BOOKING) && travelEnd > at(TRAVEL_FOOT) && travelEnd < at(GUEST_STRIP), 'the booking box sits in the travel block, which closes above the strip');
  assert.match(landing.slice(travelEnd, at(GUEST_STRIP)), ONLY_COMMENTS, 'the travel block\'s </section> → the strip: a comment between, nothing else — no band');
  assert.match(landing.slice(at(GUEST_STRIP) + GUEST_STRIP.length, at(STOP_ZERO)), ONLY_COMMENTS, 'the strip → stop 0: a comment between, nothing else');
  assert.match(landing.slice(at(STOP_ZERO) + STOP_ZERO.length, at(MY_TRIP)), ONLY_COMMENTS, 'stop 0 → my trip: a comment between, nothing else');
  assert.match(landing.slice(at(MY_TRIP) + MY_TRIP.length, at(DOOR)), ONLY_COMMENTS, 'my trip → the door: a comment between, nothing else');
});

test('T2 the seams: one border-b per boundary from experiences to the door — my trip\'s, the strip\'s own, done-for-you\'s (no border-t), the plans act\'s, the door\'s (PIPELINE-PAGE-01); the header\'s own over 01, the ledger\'s three lines once each and the header\'s SEAM — in the deck\'s file; the SEAT paragraph', () => {
  const landing = code(LANDING);
  // the rules, read from the components that carry them
  const trip = code(TRIP);
  const tripAct = /act: '([^']*)'/.exec(trip);
  assert.ok(tripAct && /\bborder-b border-border\b/.test(tripAct[1]) && !/border-t/.test(tripAct[1]), "my trip's border-b (WasHereSection TRIP.act), no border-t");
  assert.match(code(STRIP), /<section className="w-full border-b border-border bg-bg-terminal">/, "the guest strip's own border-b, when it renders");
  // HOME-FINISH-02 (2026-11-10): the section's opening tag gained its anchor (id={SERVICES_ANCHOR}); its classes — the seam — are unchanged. Until then: /<section className="w-full border-b border-border bg-bg-terminal">/g.
  assert.equal((landing.match(/<section id=\{SERVICES_ANCHOR\} className="w-full border-b border-border bg-bg-terminal">/g) ?? []).length, 1, "DONE-FOR-YOU's section: border-b, no border-t");
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

test('T3 the act list (HOME-FINISH-02, 2026-11-10: plan → build → explore): THE PLANS\' three lines, DONE-FOR-YOU and its two historical notes, EXPERIENCES, THE GUEST\'S TRIP, MY TRIP, then the door\'s line (PIPELINE-PAGE-01: in place of THE PIPELINE header\'s); the notes\' words untouched; the s08 line is the deck\'s, found by content', () => {
  const notes = comments(LANDING);
  const at = (s: string): number => { const i = notes.indexOf(s); assert.notEqual(i, -1, s); return i; };
  // HOME-FINISH-02 (Alex, 2026-11-10 20:56): the act list follows the new order — PLAN → BUILD → EXPLORE; the lines moved, their words unchanged, and
  // one dated line over them says so. Until then (HOME-ORDER-01, 2026-11-10): EXPERIENCES, THE GUEST'S TRIP, THE PLANS' three lines, DONE-FOR-YOU and
  // its two notes, MY TRIP, the door. (Before that: MY TRIP, THE GUEST'S TRIP, DONE-FOR-YOU and its two notes, THE PLANS, the door.)
  const seq = [
    ' *   (HOME-FINISH-02, 2026-11-10: THE ORDER IS PLAN → BUILD → EXPLORE',
    ' *   THE PLANS           — four plan cards and one comparison table\n *                         (OFFER-01; PlansSection over src/lib/offer/plans.ts);\n *                         the section carries id="modules"',
    // SERVICES-01 (2026-11-08): the line rewritten in place — six doors from src/lib/proposalNeeds.ts; the seat's note kept.
    ' *   DONE-FOR-YOU        — the professional-services panel, six doors from src/lib/proposalNeeds.ts — SERVICES-01, 2026-11-08: the close retired, bookkeeping a door (HOME-PANELS-02, 2026-11-07: under MY TRIP, above THE PLANS)',
    ' *   (COCKPIT-PERF-01, 2026-10-27: the PERSONAS act — "one system · six lives" —\n *   and the "[PR-MODULES placeholder]" seat, the SELL-02 offer act, stood\n *   between the demo and DONE-FOR-YOU here; OFFER-01 (2026-09-23) replaced both\n *   with THE PLANS.)',
    " *   (THE CLOSE          — HOME-05a's own act, gone: HOME-PANELS-01, 2026-11-07, folded the 2026 close into DONE-FOR-YOU as its fifth door, priced by proposal)",
    ' *   LIVE DEMO — TRAVEL  — travel search/booking, real and public',
    ' *   EXPERIENCES         — the events section under the strip (EVENTS-01)',
    " *   THE GUEST'S TRIP    — the guest's session trip (BOOK-3, GuestTripStrip);",
    ' *   MY TRIP             — the trip log, a card per stop, each opening its stop\'s page (TRIPCARDS-01)',
    // PIPELINE-PAGE-01 (2026-11-09): the door's line, in place of THE PIPELINE header's (' *   THE PIPELINE header — names the 14-step run (essay front matter, PR-CHROME)').
    ' *   HOW IT ALL CONNECTS — the door to the 14 steps (PIPELINE-PAGE-01, 2026-11-09: in the seat THE PIPELINE header held, PR-CHROME — the header and the fourteen steps moved whole to their own page, /how-it-works, PipelineDeck.tsx; the fourteen lines below name the steps behind the door)',
  ].map(at);
  assert.deepEqual(seq, [...seq].sort((a, b) => a - b), 'the dated line → THE PLANS → DONE-FOR-YOU (and its notes) → LIVE DEMO — TRAVEL → EXPERIENCES → THE GUEST\'S TRIP → MY TRIP → the door');
  // PIPELINE-PAGE-01 (2026-11-09): the s08 line moved with the deck to PipelineDeck.tsx — found by content (the one line whose code starts with s08:), never by number.
  assert.equal(code(DECK).split('\n').filter((l) => /^\s+s08: /.test(l)).length, 1, 'exactly one s08 line, in the deck\'s file');
  for (const phrase of [/THE PLANS\s+— four plan cards and one comparison table/, /id="modules" lives on THE PLANS act/, /said by the four plans below/]) assert.match(notes, phrase, "cockpitPerf01's pins stand");
});
