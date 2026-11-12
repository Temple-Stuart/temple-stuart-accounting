'use client';

/**
 * Landing — the guest sales floor, mounted only by GuestLanding on bare '/'
 * (page.tsx branches authed arrivals to HomeClient). House Bloomberg aesthetic,
 * zero new hex; every colour is a token.
 *
 * THE ACTS, in document order:
 *   hero (HERO-CREST-01, 2026-11-11: the crest design — a violet ground, the crest, the top bar laid over it as glass; a full-bleed aubergine band until then)
 *   (HOME-FINISH-02, 2026-11-10: THE ORDER IS PLAN → BUILD → EXPLORE — "What We Do" stands alone over THE PLANS, then DONE-FOR-YOU, then LIVE DEMO — TRAVEL with the experiences in its box and THE GUEST'S TRIP under it. The lines below were re-ordered, their words unchanged; until then the list ran LIVE DEMO — TRAVEL, EXPERIENCES, THE GUEST'S TRIP, THE PLANS, DONE-FOR-YOU. Stop 0, named on the EXPERIENCES line, still sits above MY TRIP.)
 *   THE PLANS           — four plan cards and one comparison table
 *                         (OFFER-01; PlansSection over src/lib/offer/plans.ts);
 *                         the section carries id="modules"
 *                         (HOME-BRIEF-04, 2026-11-10: on this page the act is THE HOW-TO now — HowToSection over src/lib/howTo.ts, under the same label, SOFTWARE PLANS, carrying id="modules"; the plan cards and the table stand on /pricing alone)
 *   DONE-FOR-YOU        — the professional-services panel, six doors from src/lib/proposalNeeds.ts — SERVICES-01, 2026-11-08: the close retired, bookkeeping a door (HOME-PANELS-02, 2026-11-07: under MY TRIP, above THE PLANS)
 *   (COCKPIT-PERF-01, 2026-10-27: the PERSONAS act — "one system · six lives" —
 *   and the "[PR-MODULES placeholder]" seat, the SELL-02 offer act, stood
 *   between the demo and DONE-FOR-YOU here; OFFER-01 (2026-09-23) replaced both
 *   with THE PLANS.)
 *   (THE CLOSE          — HOME-05a's own act, gone: HOME-PANELS-01, 2026-11-07, folded the 2026 close into DONE-FOR-YOU as its fifth door, priced by proposal)
 *   LIVE DEMO — TRAVEL  — travel search/booking, real and public
 *   EXPERIENCES         — the events section under the strip (EVENTS-01); under it, above MY TRIP, STOP 0 — Alex's letter and how he got here (StopZeroSection — STOP0-01, 2026-11-09: named on this line, so the act list gains no line)
 *                         (HOME-BRIEF-04, 2026-11-10: no band of its own any more — the experiences are the booking box's Events panel, first in the row and open, inside the travel block above; mounted once, handed to LandingBookingSection as its events prop)
 *   THE GUEST'S TRIP    — the guest's session trip (BOOK-3, GuestTripStrip);
 *                         renders only when records exist
 *   MY TRIP             — the trip log, a card per stop, each opening its stop's page (TRIPCARDS-01)
 *   HOW IT ALL CONNECTS — the door to the 14 steps (PIPELINE-PAGE-01, 2026-11-09: in the seat THE PIPELINE header held, PR-CHROME — the header and the fourteen steps moved whole to their own page, /how-it-works, PipelineDeck.tsx; the fourteen lines below name the steps behind the door)
 *   (HOME-FINISH-02, 2026-11-10: that door left this page with its act — the footer's THE RECORD keeps it, and the old #deck-NN links still redirect)
 *   01 / IDENTIFY THE PROBLEM, THE TOOLS, THE FAMILIES — AND SORT THEM IN — four moves drawn: the raw list, the family sheet, the flow arcs
 *   02 / LOOK AT THE TOOLS AND PICK THE PROVIDERS BEHIND THEM — the provider menu + the open doors
 *   03 / IMPORT THE DATA AND SEE HOW IT ARRIVES — the raw import table, twelve arrivals, the promises
 *   04 / LABEL EVERY FEED BY ITS KIND — the fold drawn, one rule per feed, twenty rows, five kinds
 *   05 / CREATE ONE TABLE PER KIND AND MAP THE DATA IN — six tables; the kind picks the table
 *   06 / SEPARATE WHAT HAPPENED TO YOU FROM WHAT YOU DID — observed vs authored
 *   07 / RUN THE LOOP         — discover → decide → commit → record
 *   08 / STORE EVERYTHING YOU DO IN ONE MASTER TABLE
 *   09 / MATCH WHAT HAPPENED TO WHAT YOU DID — the deposit meets the invoice
 *   10 / LET THE RULES WRITE THE LINES
 *   11 / TURN THE LINES INTO ANSWERS
 *   12 / OPEN THE TWO WINDOWS — the Ledger and the Calendar
 *   13 / WATCH ONE DOLLAR RUN THE WHOLE MACHINE
 *   14 / PROVE EVERY NUMBER   — click any number, walk it back
 *   [PR-WHY placeholder — content TBD]
 *   (Built on           — the vendor marquee: BUILTON-01, 2026-11-09, moved it to /how-it-works, under the 14 steps — src/components/landing/BuiltOnStrip.tsx; the home page renders none)
 *
 * PIPELINE-PAGE-01 (Alex, ruled 2026-10-30; 2026-11-08 15:11): the pipeline header and 01–14 left this file for
 * src/components/landing/PipelineDeck.tsx, rendered by /how-it-works — whole and unchanged, with their state, the hash
 * effect and every const only they read. This page keeps the door in the header's seat, and an old /#deck-NN link is
 * sent on to that page with its hash (the old-links effect, in the component). The deck notes below — PR-DECK and
 * PR-VOICE, DECK LAW #7, PR-COLLAPSE, the RUST NOTE and ADDING A TEACHING SLIDE — describe that file now, and the seam
 * ledger moved with its markup.
 *
 * PR-DECK: 01–13 are the pipeline deck. PR-VOICE reconciled every rendered
 * string to the common-tongue essay (temple-stuart-full-system-writeup.md,
 * NOT in this repo) — headlines/subs that stay are the deck's poster
 * compressions; everything else is essay-verbatim, '(N) ' prefixes included.
 * Never rephrase in place — a copy change is an essay change first.
 * DECK LAW #7, SHOW DON'T ECHO: where a visual carries a piece of the essay
 * (09's cards, 10's drawn sale lines, 12's calendar), the visual IS that
 * piece — never render the same content as both drawing and text.
 * PR-COLLAPSE: each step is a disclosure —
 * header button (label + '+'/'−' glyph, the retired personas accordion's
 * shape, 5010ca1f) over a hidden-class body; all 14 collapsed by default, a
 * #deck-NN hash opens its step on load. RUST NOTE: the deck's "rust" group-label
 * colour has no token in this palette; brand-amber (#d97706) is the mapping,
 * chosen over inventing a hex. If Design lands a true rust token, swap
 * text-brand-amber across the deck in one pass.
 *
 * REVENUE FIRST, THEN THE TEACHING SEQUENCE. The two acts under the hero are
 * not slides — they are live surfaces a guest can transact on without an
 * account: travel search/booking is public (middleware.ts:70-94) and the
 * services panel takes a proposal. They carry NO step number for exactly that
 * reason; only the numbered run below them is a sequence, and its numbering
 * starts at 01 and stays contiguous. Do not renumber the revenue acts back in,
 * and do not number another one without deciding whether it is a step.
 *
 * ADDING A TEACHING SLIDE is a three-part edit and nothing more: the next
 * number in the run, a border-t (no NUMBERED act carries a border-b, so every
 * boundary INSIDE the run is closed by the lower section — but see the seam
 * ledger in the problem act for the one exception, 01 itself, which carries no
 * border at all), and its data as module-scope consts beside the others. 04 / THE
 * ROUTING was added that way — three consts, one border-t — and 05 / THE
 * HANDOFF after it with one const and one border-t. Neither changed an
 * existing border.
 *
 * MODULES-RETIRED (6a439eaf). The nine-module deck — pillar cards, the
 * nine-row module sheet, the segment control, the personas rail and the
 * merged '02 / THE NINE MODULES' stage that replaced them all — was DELETED.
 * It was built on a superseded model and a teaching sequence replaces it. Gone
 * with it: DECK_CATEGORIES, PILLAR_CARDS, REPLACED_APPS, FAMILY_OFFSETS,
 * FRAME_LINKS, GROUP_RATIONALE, the whole stage/autoplay state machine, and
 * the lucide + GLIMPSES imports that served only them. Do not reconstruct any
 * of it from this comment; read the git history instead.
 * PERSONAS-RESTORED (PR-PERSONAS-RESTORE): the personas rail alone came BACK
 * from bc1a6fef (the last commit that carried it — 6a439eaf's parent): the
 * PERSONAS const, the openPersona accordion state, and the ACT 2 block,
 * remounted between DONE-FOR-YOU and the pipeline header with exactly one
 * adaptation — its historical border-t became border-b for the new seat
 * (see the seam ledger); PR-REORDER later moved the act ABOVE done-for-you
 * for the who-first order, its border-b travelling with it. GROUP_RATIONALE stays dead: only the deleted stage
 * ever rendered it. PERSONAS-COPY (PR-PERSONAS-COPY) then rewrote the six
 * rows and the act label to the 13-step vocabulary per the 2026-08 persona
 * research pack — the STRUCTURE is still bc1a6fef's; the historical copy
 * lives in git history.
 *
 * id="modules" lives on THE PLANS act (OFFER-01 — PlansSection's own section,
 * data-plans, over src/lib/offer/plans.ts). It is a commerce contract, not decoration:
 * the Stripe checkout cancel_url (/?checkout=cancelled#modules), the /pricing
 * and /modules pages' doors (/?module=<slug>#modules) all resolve to it.
 * Moving or dropping it breaks the buy path — see the ANCHOR note on that
 * section. (COCKPIT-PERF-01, 2026-10-27: "lives on THE OFFER act (SELL-02,
 * data-offer-act) — the section that renders src/lib/offer.ts" stood here;
 * OFFER-01 deleted that act and the anchor rode on to THE PLANS.)
 * HOME-BRIEF-04 (2026-11-10): the plans act left this page for /pricing, and on this page the anchor rides on the
 * how-to's own section (HowToSection.tsx, <section id="modules">) — the plan law in scripts/assert-tool-registry.ts
 * holds it there.
 *
 * SELL-02 settled what the deck's retirement left open: the selling surfaces
 * (this act, /pricing, the /modules access block, the cockpit's locked tabs)
 * all render ONE source — src/lib/offer.ts over the tool registry — and the
 * offer law (scripts/assert-tool-registry.ts) fails the build on drift.
 *
 * STILL TRUE FROM THE FD-1d SPLIT: header/footer are extracted to
 * LandingHeader/LandingFooter (shared with the /modules pages) and the CPA
 * disclaimer rides the shared footer; descriptors import from the ONE source
 * (src/lib/tabDescriptors.ts).
 *
 * PRESERVED UNMOUNTED, exported, consumed by HPW-1 — not dead by accident:
 * ModuleCostBreakdown + helpers, REFERENCED_MARKS, ZERO_COST_BY_MODULE.
 * transparencyLedger is untouched. The demo modal is preserved the same way
 * but is currently UNREACHABLE — its only opener died with the deck; see the
 * showDemo declaration.
 */

import Link from 'next/link';
import { useEffect, useState } from 'react';
// MODULES-RETIRED: the lucide category icons left with DECK_CATEGORIES, and
// GLIMPSES left with the stage — the merged modules section was their only
// consumer. The TAB_PRICING import had already retired with the Act-4 bundle
// bar; the pricing surface is /how-pricing-works until buy affordances return.
//
// PIPE_PHASES AND WALKTHROUGH_LEDGER STAY, and are NOT dead. The landing no
// longer renders either — the step rail that read them is gone — but the
// module-scope assert directly below still consults both, and it is the only
// thing in the repo that fails loud when pipePhases.ts and walkthroughLedger.ts
// drift out of lockstep. Removing these two imports would delete that guard by
// accident. PipePhase went with the stage's phase array; PipePillarId stays
// because the assert keys on it.
import { PIPE_PHASES, type PipePillarId } from '@/lib/pipePhases';
import { WALKTHROUGH_LEDGER } from '@/lib/walkthroughLedger';

if (process.env.NODE_ENV !== 'production') {
  for (const pid of Object.keys(PIPE_PHASES) as PipePillarId[]) {
    if (PIPE_PHASES[pid].length !== WALKTHROUGH_LEDGER[pid].steps.length) {
      throw new Error(`walkthrough ledger drift: ${pid} has ${PIPE_PHASES[pid].length} phases but ${WALKTHROUGH_LEDGER[pid].steps.length} ledger steps`);
    }
  }
}
import {
  ALLOCATION_ROWS, NO_COST_STRIP,
  ENTITY_DIM, ACCOUNT_DIM, SUB_DIM, OBJECT_DIM, VENDOR_DIM,
  type ScheduleAllocationRow,
} from '@/config/transparencyLedger';
// LANDING-V4: the TAB_DESCRIPTORS import retired with the summary slides'
// prose — the descriptor strings still render on /modules/<id>.
import { DEMO_VIDEO_URL } from '@/config/demoVideo';

/** LOBBY-DECK-1b: a YouTube watch/short URL → its /embed/ form for the modal
 *  iframe. Anything else (e.g. a plain file URL) returns null and plays via a
 *  native <video> tag instead — both URL kinds Alex may set are covered. */
function youTubeEmbedUrl(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/);
  return m ? `https://www.youtube.com/embed/${m[1]}` : null;
}

/** FD-1f v3: a stacked CODE + MEANING cell — the schedule teaches the taxonomy.
 *  REPAINT-04 (2026-09-21): its ink follows the receipt off the retired dark sheet — primary / faint. */
function DimCell({ code, label }: { code: string; label: string }) {
  return (
    <div>
      <div className="font-mono text-xs text-text-primary whitespace-nowrap">{code}</div>
      <div className="text-[10px] leading-tight text-text-faint">{label}</div>
    </div>
  );
}
import dynamic from 'next/dynamic';
import LandingHeader from './LandingHeader';
import LandingFooter from './LandingFooter';
// BOOK-1: the live booking section (the REAL PublicFlightSearch +
// PublicHotelSearch), lazy-mounted (the FD-1 next/dynamic precedent) so the
// guest first paint stays light — the search stack's chunk loads after, and
// CountryCityPicker's mount fetch fires only then. This REPLACES the
// LAND-SEARCH-1 teaser: the mounted components' own controls ARE the
// landing's search controls (zero duplicated search UIs — the ruled
// conversion shape), so the teaser and its ls* prefill handoff died.
// TOGGLE-1 mounts it INSIDE the hero, where the teaser sat.
// BOOK-3: the session-trip strip (guest-only by construction — Landing renders
// only on the FD-2 verified-guest branch).
import GuestTripStrip from './GuestTripStrip';
// EVENTS-01 (2026-10-30): the experiences under the strip — the leaf's rows, the
// words module's lines, the URL's one filter; it reads the day the server passed.
import ExperiencesSection from './ExperiencesSection'; import StopZeroSection from './StopZeroSection'; // STOP0-01 (2026-11-09): Stop 0, Alex's letter, mounted between the experiences and MY TRIP — the import rides this line, so every line above :1807 stays
// WASHERE-01 (2026-10-31): the trip log — Alex's own stops, in trip order, each naming
// an experience by id; the leaf's rows, the words modules' lines, the server's day.
import WasHereSection from './WasHereSection';
// HOME-05a (2026-11-03) mounted the 2026 close here as CloseOfferSection.tsx; HOME-PANELS-01 (2026-11-07) made it
// CloseOfferCard.tsx, both over src/lib/offer/close.ts. SERVICES-01 (Alex, 2026-11-08) retired it — card, leaf, words
// and law are gone; bookkeeping is a door now. ONE-FORM-01 (2026-11-06): the doors open the ONE proposal form with
// their choice picked — the six doors (key, title, line) and the form's path from src/lib/proposalNeeds.ts, never typed here.
import {
  PROPOSAL_FORM_PATH, SERVICES,
} from '@/lib/proposalNeeds'; import { PRIMARY_CTA } from '@/lib/ds'; // HOME-FINISH-01 (2026-11-08): the proposal button's class, the public page's one filled button
import GuestBookingLookup from '@/components/guest/GuestBookingLookup';
// PIPELINE-PAGE-01 (2026-11-09): the deck's own imports — PROBLEM_SHEET, ANSWER_ROWS, ANSWER_INPUTS, PROVIDER_MENU,
// ROUTING_RULES, isRetired, liveMenuCell, ALL_BEATS_LINE, ownTableLine, KIND_VIEWS_HONEST_LINE and react's Fragment —
// moved with the 14 steps to PipelineDeck.tsx. The home page keeps the door (its path and words from the leaf beside
// it) and reads the step ids for the old-links effect. BUILTON-01 (2026-11-09): the step ids live in that leaf now too
// (DECK_STEP_IDS moved verbatim to ./pipelineWords.ts), so this page imports nothing from the deck's file.
import { DECK_STEP_IDS } from './pipelineWords';
// HOME-FINISH-02 (2026-11-10): the door left this page (the footer's THE RECORD keeps it), so its words are imported no more; the path stays — the old-links effect reads it.
import { PIPELINE_PATH } from './pipelineWords';
import { DEMO_ANCHOR } from '@/lib/homeAnchors'; // FOOTER-01 (2026-11-09): the live demo's anchor, from its one home — the footer's "Book travel" lands on it (HOME-FINISH-02, 2026-11-10: the footer's "Explore the World" now, and the anchor sits on that pillar's heading)
import { SERVICES_ANCHOR } from '@/lib/homeAnchors'; // HOME-FINISH-02 (2026-11-10): the professional-services section's id, from its one home — Alex: "a stable anchor so the footer can link directly to Build Your Income"
import { WHAT_WE_DO_HEADING } from '@/lib/homeActWords';
import { BUILD_PILLAR } from '@/lib/homeActWords'; // HOME-FINISH-02 (2026-11-10): the second pillar's heading and paragraph — Alex's words, from the leaf, never typed here
import { EXPLORE_PILLAR } from '@/lib/homeActWords'; // HOME-FINISH-02 (2026-11-10): the third pillar's heading and paragraph — Alex's words, from the leaf, never typed here. Four imports left this spot with their last readers: EXPERIENCE_LINE (@/lib/brandLines), SAVE_TRIPS_LINE (@/lib/homeActWords), PROMISE (./ExperiencesSection) and COMMISSION_LINE (@/lib/disclosureWords — the box renders it now)
import HowToSection from './HowToSection';
// SELL-02: the offer — what is sold and what is free, from ONE source; the hero's counts from the registry.
// OFFER-01 (2026-09-23): the landing no longer renders OfferCard, heroCountsLine,
// OFFERS or freeSetLine — the offer it shows is the three plans, and Travel's free
// line comes from the registry's own Travel row (plans.ts travelFreeLine).
import { COMPANY_LINE, HERO_SUBLINE } from '@/lib/brandLines'; // HOME-LINES-01 (2026-11-08): the hero's three lines and its subline, from src/lib/brandLines.ts — the import rides this line, so every line above :1807 stays. HOME-BRIEF-04 (2026-11-10): PlansSection's import, which this line rode beside, left with its mount — the page's offer is the how-to (./HowToSection, above); /pricing mounts the plans
// PR-ELEV-1: the coming-soon tiles became badged "Soon" chips INSIDE the
// booking strip (travelStripModes) — the separate tile row is gone.

// TOGGLE-1: the section is now ONE toggle strip mounted INSIDE the hero
// (where the LAND-SEARCH-1 teaser sat, pre-BOOK-1 Landing.tsx:325-328), so
// the loading fallback is the same strip shape in the same spot.
const LandingBookingSection = dynamic(() => import('./LandingBookingSection'), {
  ssr: false,
  loading: () => (
    <div className="mt-8 rounded-lg border border-white/20 bg-white/5 p-4 text-sm text-white/50">
      Loading live searches…
    </div>
  ),
});

// PIPELINE-PAGE-01 (2026-11-09): the deck's constants and helpers — S1_TOOL_LIST through GoldSegments, s14Law, DECK,
// DECK_STEP_IDS, NEW_PROVIDER_IS and DECK_TODAY among them — moved with the 14 steps to PipelineDeck.tsx
// (/how-it-works). What follows here is the home page's own: the retired decks' history and the cost receipts
// preserved, unmounted, for HPW-1. BUILTON-01 (2026-11-09): DECK_STEP_IDS moved on, to ./pipelineWords.ts.

// FD-1i: the SUMMARY deck's content — LIFTED ONLY, zero invented copy (the
// FD-1b bullet-lift precedent). PLAIN-SHOWCASE exception: the TRAVEL entry
// now carries Alex's ruled plain-language copy (PR-SLIDE-TRAVEL-REAL) rather
// than a lift — the showcase was brought to parity in the same ruling; the
// other eight pillars remain verbatim lifts. Per pillar: the module deck's
// dark-hero eyebrow + headline, then 3 verbatim slide titles. Provenance
// (file:line, verified at lift time):
//   Travel:     eyebrow/headline TravelShowcaseSections.tsx:324-325;
//               lines :342, :363, :370
//   Runway:     eyebrow/headline RunwayShowcaseSections.tsx:344-345;
//               lines :362, :397, :411
//   Books:      eyebrow/headline TabShowcases.tsx:237-238;
//               lines :247, :268, :289
//   Trade:      eyebrow/headline TabShowcases.tsx:134-135;
//               lines :162, :176, :190
//   Tax:        eyebrow/headline TabShowcases.tsx:340-341;
//               lines :364, :371, :385
//   Compliance: eyebrow/headline ComplianceShowcaseSections.tsx:327-328;
//               lines :345, :359, :387
//   Routines:   eyebrow/headline RoutinesShowcaseSections.tsx:366-367;
//               lines :384, :405, :412
//   Projects:   eyebrow/headline ProjectsShowcaseSections.tsx:270-271;
//               lines :288, :309, :330
//   Content:    eyebrow/headline ContentShowcaseSections.tsx:228-229;
//               lines :246, :253, :267
// Lines were chosen to NOT repeat the retired selection deck's PILLAR_CARDS
// bullets — the two decks told different halves of each pillar's story. That
// deck is gone; the constraint is recorded because these strings still read as
// one half of a pair.
// PR-ELEV-2c: entries MAY carry an optional demoImage — rendered as the
// slide's framed RIGHT column (PR-DECK-CLEAN-3, Nuitée-style; absent → text
// spans full width).
// PR-DEMO-1 → LANDING-04-ILLOS: all nine slots carry CODE-DRAWN SVG
// PIPELINE illustrations (public/demo/<pillar-id>.svg) — each shows that
// module's REAL stages left-to-right (stage names read from the module's own
// StageStrip config or source component; provenance in each SVG's header
// comment), in the Direction-C palette. The dark-era UI mockups and travel's
// stale pre-repaint PNG capture retired with them. Illustrative sample values
// only (a count, a chip, one dollar figure per frame — the eyebrow now says
// these are illustrations); never invented revenue/user/performance numbers.
// REAL SCREENSHOTS MAY REPLACE ANY FILE AT THE SAME PATH — drop the capture
// in, keep the filename, and flip the eyebrow line back.
// WALKTHROUGH-STAGE: SUMMARY_BY_ID deleted — the old deck's eyebrow/headline/
// lines went runtime-unconsumed at the merged-modules rebuild and its last
// live field (demoImage, the stage frame <img>) retires with Treatment A
// (per-step glimpses supersede the single frame — README round-5 note). The
// svg FILES stay in public/demo per the spec; the strings live in git
// history if a surface ever wants them back.

// OFFER-01 (2026-09-23): the PERSONAS const (six rows: FOUNDER · TRADER ·
// CREATOR · NOMAD · SMALL BUSINESS OWNER · STUDENT) is DELETED with the act that
// rendered it. A persona grid told a visitor which of six lives to see themselves
// in before it told them what they could buy; the audience each row named now
// sits on the plan that serves it, in one line under the plan's name
// (src/lib/offer/plans.ts PLANS[].audience).

// FD-1n: the footnote marks ACTUALLY referenced by the allocation rows
// (amount footnotes + the ᵉ riding split percentages) — the merged registry
// renders only these, derived, never hardcoded.
// LOBBY-DECK-1: unmounted on the landing (the footnote registry left with the
// sheet); exported/preserved for HPW-1.
export const REFERENCED_MARKS: Set<string> = (() => {
  const s = new Set<string>();
  for (const r of ALLOCATION_ROWS) {
    r.footnotes.forEach((m) => s.add(m));
    if (r.splitPct.includes('ᵉ')) s.add('ᵉ');
  }
  return s;
})();

// PRICE-1: the FD-1o "our cost: …" deck micro-line was REMOVED — accurate but
// incomprehensible on a sales card (PRICING-AUDIT-1). The full cost receipts
// live where they always did: /how-pricing-works (the transparency door link
// under the deck).

// FD-1n: the $0-strip fold-ins — the strip died as a section; its two facts
// render inside the ruled expansions (TT → Trade, GOV → Compliance). Mapped
// by VENDOR KEY per Alex's ruling, NOT by the strip's internal allocatedTo
// (whose 'Trading' name is legacy vocabulary FD-1l never touched — data is
// 0 lines this PR; flagged in the FD-1n report).
// LOBBY-DECK-1: unmounted on the landing; exported/preserved for HPW-1.
export const ZERO_COST_BY_MODULE: Record<string, string> = { trade: 'TT', compliance: 'GOV' };

/** FD-1n: one module's cost receipt — the FD-1k per-project grouping scoped
 *  to a single project name, inline under the module's sheet row. Same ten
 *  columns, same DimCell renders, its own overflow-x wrapper.
 *  LOBBY-DECK-1: does NOT render on the landing anymore (the deck replaced
 *  the sheet + its costs ▾ expanders) — PRESERVED unmounted and exported so
 *  the receipt machinery survives intact for HPW-1. */
export function ModuleCostBreakdown({ projectName, zeroCostVendor }: { projectName: string; zeroCostVendor?: string }) {
  const rows = ALLOCATION_ROWS.filter((r) => r.target.name === projectName);
  const entered = rows.filter((r) => r.amountUsd !== null);
  const total = entered.reduce((s, r) => s + (r.amountUsd as number), 0);
  const zeroFact = zeroCostVendor ? NO_COST_STRIP.find((f) => f.vendor === zeroCostVendor) : undefined;
  return (
    <div className="px-4 pb-4">
      {/* REPAINT-04 (2026-09-21): the receipt (unmounted, preserved for HPW-1) wore the retired dark sheet's
          paint — bg-panel-surface, panel hairlines, the white ladder. Cream-shell tokens now, so a remount lands
          on the cream landing readable. Structure and copy untouched. */}
      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
        Entered ${total.toFixed(2)} · {entered.length} of {rows.length} amounts
      </p>
      <div className="mt-2 overflow-x-auto rounded-lg border border-border bg-white">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="border-b border-border text-left font-mono text-[10px] uppercase tracking-wider text-text-faint">
              <th className="px-3 py-2 font-semibold">Entity</th>
              <th className="px-3 py-2 font-semibold">Account</th>
              <th className="px-3 py-2 font-semibold">Sub</th>
              <th className="px-3 py-2 font-semibold">Object</th>
              <th className="px-3 py-2 font-semibold">Vendor</th>
              <th className="px-3 py-2 font-semibold">Description</th>
              <th className="px-3 py-2 font-semibold">Basis</th>
              <th className="px-3 py-2 font-semibold">Cadence</th>
              <th className="px-3 py-2 font-semibold">Split</th>
              <th className="px-3 py-2 font-semibold text-right">Amount (USD/mo)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: ScheduleAllocationRow) => (
              <tr key={`${r.vendor}-${r.target.type}-${r.target.name}`} className="border-b border-border last:border-0">
                <td className="px-3 py-2 align-top"><DimCell code={r.entity} label={ENTITY_DIM[r.entity]} /></td>
                <td className="px-3 py-2 align-top"><DimCell code={r.account} label={ACCOUNT_DIM[r.account]} /></td>
                <td className="px-3 py-2 align-top"><DimCell code={r.sub} label={SUB_DIM[r.account]?.[r.sub] ?? ''} /></td>
                <td className="px-3 py-2 align-top"><DimCell code={r.object} label={OBJECT_DIM[r.object]} /></td>
                <td className="px-3 py-2 align-top"><DimCell code={r.vendor} label={VENDOR_DIM[r.vendor]} /></td>
                <td className="px-3 py-2 align-top text-xs leading-relaxed text-white/70">{r.description}</td>
                <td className="px-3 py-2 align-top font-mono text-[10px] uppercase tracking-wider text-white/60 whitespace-nowrap">{r.basis}</td>
                <td className="px-3 py-2 align-top text-xs text-white/60 whitespace-nowrap">{r.cadence}</td>
                <td className="px-3 py-2 align-top font-mono text-xs text-white/70 whitespace-nowrap">{r.splitPct}</td>
                <td className="px-3 py-2 align-top text-right font-mono text-xs font-semibold text-white whitespace-nowrap">
                  {r.amountUsd !== null ? `$${r.amountUsd.toFixed(2)}` : `—${r.footnotes.join('')}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {zeroFact && (
        <p className="mt-2 text-[11px] leading-relaxed text-white/50">
          <span className="font-mono text-white">{zeroFact.vendor}</span>{' '}
          <span className="text-white/60">{zeroFact.vendorLabel}</span> ·{' '}
          <span className="font-mono font-bold text-white">$0</span> — {zeroFact.description}
        </p>
      )}
    </div>
  );
}

interface Props {
  /** The register-ask funnel — the hero CTA + every in-page save/auth nudge.
   *  FD-2 supplies the real register-modal opener; the preview wrapper a stub. */
  onRequireAuth: () => void;
  /** ROUTE-1 (ruling b): the header's "Log in" opener — the SAME LoginBox in
   *  LOGIN mode (returning users). Optional so the preview wrapper needs no
   *  change; absent → LandingHeader falls back to its '/' link mode. */
  onRequireLogin?: () => void;
  /** EVENTS-01 (2026-10-30): THE DAY RULE — the UTC calendar date ('YYYY-MM-DD')
   *  src/app/page.tsx computed ONCE and passed down; the experiences compare their
   *  dates to it as strings. No component reads the clock during render. */
  today: string;
}

// REPAINT-2 (Direction C): the local HERO_BG radial-glow const DIED — the
// hero was a SOLID aubergine band (bg-brand-purple) on the cream page from then until HERO-CREST-01 (2026-11-11 — the crest design, at its mount below). The
// ELEV-2c/CARD-POP glow recipe died with it: every former CARD_BG mount in
// this file is a flat card + lavender hairline now (deck/services = bg-white,
// summary slides = bg-ts-white card cream, wall tiles = solid aubergine).

// OFFER-01 (2026-09-23): offerAvailability and onBuyModule LEFT this component
// with the offer act. They fed <OfferCard/>'s buy button, which renders only when
// a price is live — and no price is set, so that button has never rendered. The
// `?module=<key>` checkout resume never went through here: it is GuestLanding's
// own URL effect, which now also checks availability itself. REAL-MARKS:
// logoAvailability is CONSUMED — the marquee chips carry the lit-logo two-state
// render, so the server fs-check → availability → chip pipeline is live end to end.
// BUILTON-01 (2026-11-09): logoAvailability LEFT this component too — Built on moved to /how-it-works, under the 14 steps
// (src/components/landing/BuiltOnStrip.tsx), and that page's build-time check feeds the chips there; the sentence
// above is history.
export default function Landing({ onRequireAuth, onRequireLogin, today }: Props) {
  // LOBBY-DECK-1b: the demo modal's open flag.
  // UNREACHABLE AS OF THE MODULES RETIREMENT, DECLARED — the only
  // setShowDemo(true) in the file was the merged section's header button, which
  // died with that section, so nothing can flip this to true and the modal
  // below can no longer render. It is left mounted, not deleted, following this
  // file's existing preserved-unmounted convention (ModuleCostBreakdown,
  // ZERO_COST_BY_MODULE, REFERENCED_MARKS) so the next surface that wants a
  // demo opener has it ready. It is NOT wired and NOT a fallback: whoever
  // restores an opener restores the behaviour. Flagged rather than silently
  // left looking live.
  const [showDemo, setShowDemo] = useState(false);

  // PIPELINE-PAGE-01 (Alex, 2026-11-09): THE OLD LINKS. The 14 steps moved to /how-it-works (PipelineDeck.tsx), and a
  // hash naming a step — #deck-01 … #deck-14, DECK_STEP_IDS — was how a link opened one here. A visitor arriving with
  // one is sent to the page they moved to, with that hash, where the deck's own hash effect opens the step: a redirect
  // for a moved page — no data path, no default, nothing chosen for the visitor. Any other hash (#demo, #events,
  // #stop-0, #my-trip, #modules …) does nothing. The hash never reaches the server, so this cannot be a server
  // redirect; replace() keeps the dead URL out of the visitor's history.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if ((DECK_STEP_IDS as readonly string[]).includes(hash)) window.location.replace(`${PIPELINE_PATH}#${hash}`);
  }, []);

  return (
    <div className="min-h-screen bg-bg-terminal text-text-primary">
      {/* ── HERO-CREST-01 (Alex, design canvas, 2026-11-11) — THE HERO, AS DRAWN. The spec is a file, not this note:
            design-refs/hero-crest-01/Hero-Reference.html ("every value in its stylesheet is the design"), with its
            README beside it. This band is that file's markup, element for element, and its classes are the reference's
            own with the house prefix (.hero → .ts-hero …); their rules are the reference's own, ported to the foot of
            src/app/globals.css, and the colours they read are tokens there (--ts-hero-*, --ts-glass-*). No colour is
            typed in this file.
              · THE GROUND — a violet sweep with a bloom behind the crest and a warm corner bottom right (.ts-hero).
              · THE CREST — one <picture>, so only one file downloads: public/brand/hero-crest-desktop.svg from 1024px,
                hero-crest-mobile.svg under it. Generated art, used as files: never redrawn, traced or hand-edited.
                Decorative (alt="", aria-hidden) — the headline says what the page is.
              · THE TOP BAR lies over the band as glass (`glass` — LandingHeader.tsx; every other mount gets the same
                pill filled) and scrolls away with it. It stays a child of the band, outside the <section>, so it is
                still the page's banner.
              · THE HEADLINE — COMPANY_LINE's three sentences (src/lib/brandLines.ts), each a <span> the stylesheet
                puts on its own line; the third is gold. THE SUBLINE — HERO_SUBLINE, the same leaf.
              · TWO PILL BUTTONS, each with the handler or href it had: "Create free account" (onRequireAuth — the
                register opener) and "Clone it on GitHub" (the repo, in a new tab), which now carries GitHub's mark —
                public/logos/github.svg, the folder's own source (simple-icons), drawn through a mask so it takes the
                button's ink and its hover — then the label, then the arrow from 1024px.
            GONE, BY ALEX'S RULING (2026-11-11): the "✦ Source-available · BSL 1.1" pill that opened the hero — "the BSL
            we have down in the footer, so lets just remove it from the hero". The footer's Software License link
            (LICENSE_URL, src/lib/footerWords.ts) is the licence's door on this page. "GitHub ↗" and "CREATE FREE
            ACCOUNT" left the bar by his rulings of the same day (LandingHeader.tsx); the header's onRequireAuth went
            with the latter, so this button is the page's first register ask.
            HISTORY, until this design: the band was a SOLID aubergine <section> (bg-brand-purple, REPAINT-2) under a
            cream bar; its headline was bold with <br /> between the sentences and the third in the lavender wash
            (brand-purple-wash — REPAINT-2 (E), after the gradient clip died; HOME-LINES-01, 2026-11-08, moved the words
            to COMPANY_LINE); its primary button was the flat MONEY_ACTION gold, its secondary a bordered ghost reading
            "Clone it on GitHub ↗" (HERO-REPO-1); the pill was HERO-PRESENCE's. Direction C's ban on gradients (globals.css, REPAINT-5: "gradients are banned under Direction C") stood on
            this band from REPAINT-2 until this design, which draws one here and on the top bar and changes no other surface. ──── */}
      <div className="ts-hero">
        <picture className="ts-hero__crest">
          <source media="(min-width: 1024px)" srcSet="/brand/hero-crest-desktop.svg" />
          <img src="/brand/hero-crest-mobile.svg" alt="" aria-hidden="true" />{/* eslint-disable-line @next/next/no-img-element */}
        </picture>

        <LandingHeader glass onRequireLogin={onRequireLogin} />

        <section className="ts-hero__inner" aria-labelledby="hero-title">
          <div className="ts-hero__copy">
            <h1 className="ts-hero__title" id="hero-title">
              <span>{COMPANY_LINE[0]}</span>
              <span>{COMPANY_LINE[1]}</span>
              <span>{COMPANY_LINE[2]}</span>
            </h1>
            {/* OFFER-01 (2026-09-23): the hero's registry count is GONE. It read
                "Twenty-five tools, counted: two live, nine partial, fourteen on the
                blueprint" (heroCountsLine, src/lib/offer.ts) — the builder's own
                census on the customer's first screen. What the product is for is
                said by the four plans below, each in the words of the person who
                buys it. The count stays in the registry and the audit trail.
                (COCKPIT-PERF-01, 2026-10-27: "three plans" stood here — PLANS holds
                four: personal, business, trading, everything.) */}
            <p className="ts-hero__subline">{HERO_SUBLINE}</p>
            <div className="ts-hero__cta">
              {/* HERO-REPO-1 (Alex's rationale): the hosted product leads —
                  "Create free account" is the promoted CTA. The repo
                  joins as the secondary: cloning requires
                  provisioning every API (LiteAPI / Plaid / Stripe /
                  Anthropic / …) — most won't, many can't, and Alex sells setup
                  for those who want it; open-sourcing extends the honesty
                  thesis to the code. "See how it works ↓" left the hero (the
                  booking strip sits right below anyway; the demo trigger moved
                  to the pillar-deck header). */}
              <button type="button" onClick={onRequireAuth} className="ts-pill-gold ts-cta-primary">Create free account</button>
              <a
                className="ts-cta-secondary"
                href="https://github.com/Temple-Stuart/temple-stuart-accounting"
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="ts-github-mark" aria-hidden="true" />
                <span>Clone it on GitHub</span>
                <svg className="ts-cta-arrow" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 11.5l7-7M5.5 4.5h6v6" /></svg>
              </a>
            </div>
          </div>
        </section>
      </div>

      {/* ── HOME-FINISH-02 (Alex's brief "HOME-FINISH | Temple Stuart Homepage Copy, Layout & Footer", 2026-11-10 20:56):
            THE ORDER under the hero is PLAN → BUILD → EXPLORE. "What We Do" stands alone, in gold and one size up, over
            the three pillars: the plans (the how-to), the professional services, then travel booking with the events —
            and the guest's strip when a guest has one. Then Stop 0 under "About Us", the trip cards under "Our Story".
            Until then the heading was the travel block's first child, in the page's purple heading classes, and the
            order was travel → the guest's strip → the plans → the services (HOME-ORDER-01's note, kept below, and the
            seat notes on each block are history: each says where its block sat on the day it was written). Each block
            moved WHOLE with the note above it, byte for byte; only this heading left its block. brand-gold on the cream
            is about 3.1:1 — large type only, which is why the size went up with the colour. ─────────────────── */}
      {/* ── HOME-PLANS-04 (Alex's brief, 2026-11-12 14:07 Manila; the board approved on the design canvas at 14:30), in the
            brief's own words: "What We Do" keeps its element, its place and data-act-heading. Only its look changes: the
            eyebrow. This replaces HOME-FINISH-02's "in gold and one size up" for the heading's look only. The box and the
            heading wear the reference's classes with the house prefix (design-refs/home-plans-04/Section-Reference.html,
            .fs-heading and .fs-eyebrow; their rules are ported to src/app/globals.css): small gold mono capitals over the
            first pillar's name, in fs-gold-text — 5.06:1 on the cream, where brand gold's 3.1:1 held only for large type.
            Until then: the box was 'max-w-7xl mx-auto px-4 lg:px-8 pt-10' and the heading wore 'text-3xl sm:text-4xl
            font-medium tracking-tight text-brand-gold'. ─────────────────────────────────────────────────────────────── */}
      {/* ── AFTER THE BUILD (Alex's note on the built page, 2026-11-12: "first the what we do, whay did we shrink that , its so
            small," · "i like how about us and What We do were the same.  About us is better size... IMO..."): the heading
            wears the act headings' type again — 'text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold', the
            HOME-FINISH-02 string named above, as About Us's h2 (StopZeroSection.tsx) and Our Story's (WasHereSection.tsx) do;
            theirs add 'mt-3'. Its element, its place, data-act-heading and the reference's box (.ts-fs-heading) are as they
            were, so the space above it and the 12px down to the pillar's name are the board's. The eyebrow's rule (.fs-eyebrow)
            is not ported: src/app/globals.css names that difference. brand gold on the cream is about 3.1:1 — large type only,
            which this is, as the HOME-FINISH-02 note above says. Until then (HOME-PLANS-04): '<h2 className="ts-fs-eyebrow"
            data-act-heading>'. ──────────────────────────────────────────────────────────────────────────────────────────── */}
      <div className="ts-fs-heading">
        <h2 className="text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold" data-act-heading>{WHAT_WE_DO_HEADING}</h2>
      </div>
      {/* ── HOME-ORDER-01 (Alex, 2026-11-10 16:27: "What We Do → About Us → Our Story"): THE ORDER of this page is
            Alex's of 2026-11-10 — under the hero: travel booking, the events, the guest's strip when a guest has one,
            the plans, the professional services (together under the "What We Do" heading, the travel block's first
            child); then Stop 0; then the trip cards under "Our Story"; then the door to the 14 steps. Both headings
            come from src/lib/homeActWords.ts. Each block that moved, moved WHOLE with the comment above it,
            byte-identical, so the older seat notes — in those comments and in the act list above — are history:
            each says where its block sat on the day it was written, not where it sits now. ─────────────────── */}
      {/* ── HOME-BRIEF-03 (Alex, 2026-11-10 18:09; the board he approved on 2026-11-09, "pick what you run"): THE HOW-TO —
            what you run picks your steps, in order, across Personal, Business, Travel and Trade. Every status comes from
            the tool registry and the plan from the plans — nothing typed (src/lib/howTo.ts, drawn by HowToSection.tsx).
            A cream act with its own border-b, directly under the plans and above the professional services; its two
            switches live in React state only.
            HOME-BRIEF-04 (Alex, 2026-11-10 19:00: "the how-to should replace software plans"): THE HOW-TO IS THE
            SOFTWARE PLANS. OFFER-01's <PlansSection/> (2026-09-23 — four plan cards and one comparison table) was
            mounted directly above, under the note that seated it; both left this page, and the plans stand on /pricing
            alone. This act carries what that one carried here: id="modules" — the Stripe cancel_url
            (checkout-entitlement/route.ts) and the /modules access block land on it, and the plan law holds it — and
            the door: the plan's button opens the sign-up modal, as the plan cards' button did. No price is set, so the
            price line says so and the button joins early access; both are read from the plan's price slot
            (src/lib/offer/plans.ts), never typed. Its steps are one row per section, swiped sideways. ─────────── */}
      {/* HOME-PLANS-04 (2026-11-12): the how-to is the Financial Software section as the board draws it — the pillar's name and
            one line, the map of the 25 tools with its two switches (React state only), three plan cards and the all-three
            band, the link to /pricing (HowToSection.tsx). The notes above are history: no steps are drawn here now. */}
      <HowToSection onRequireAuth={onRequireAuth} />

      {/* ── LANDING-V4 (Alex's ruling, reversing the V2 seat): DONE-FOR-YOU is
            its own section — no right slot. Body = the PROFESSIONAL SERVICES
            panel relocated WHOLESALE from the 05 grid (markup byte-identical
            inside), seated in the old deck-table's white-card container idiom.

            UNNUMBERED BY RULING: a guest can submit a proposal here without an
            account, so this is a revenue surface, not a step. It lost its
            '04 / ' prefix when it moved up with the demo; the numbered acts
            below it start at 01 and the sequence is contiguous without it.

            SEAT (HOME-PANELS-02, Alex, 2026-11-07 23:53): directly under MY TRIP
            (the trip log — and the guest's strip, when it renders) and directly
            above THE PLANS (early access). Why: the services sit under the trip
            and above early access while the system is still being built; the
            pipe below the plans is the system's own. The section moved here
            WHOLESALE from its seat between the plans and the pipeline header —
            byte-identical inside <section>…</section>; only this comment and
            the position changed.

            SEAM: border-b ONLY — the border-t is deliberately gone. The act
            directly above closes that boundary with its own border-b — MY TRIP's
            (WASHERE-01's cream act), or the guest strip's when it renders — and
            a border-t here would have made it the page's only two-rule seam.
            This section's bottom edge closes done-for-you|plans; the plans act's
            own border-b (PlansSection.tsx) closes plans|pipeline header, as it
            closed plans|done-for-you until now. (HOME-05a, 2026-11-03, seated
            the close act under this section; HOME-PANELS-01, 2026-11-07, folded
            the close into this card as its fifth door; both seams are history.) ── */}
      <section id={SERVICES_ANCHOR} className="w-full border-b border-border bg-bg-terminal">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
          {/* HOME-FINISH-02 (Alex, 2026-11-10 20:56): THE SECOND PILLAR — "Build Your Income." His rule for all three: "Purple title →
              Approved description → Existing functionality … No additional promotional headings or explanatory paragraphs between
              these elements." So the section opens at the pillar's h2 (the page's purple heading classes) and his one paragraph
              follows — both read from src/lib/homeActWords.ts BUILD_PILLAR, typed nowhere here — and the card follows directly,
              keeping its own mt-4. The section carries id={SERVICES_ANCHOR} (src/lib/homeAnchors.ts): his "stable anchor so the
              footer can link directly to Build Your Income".
              UNTIL THEN, here: the label — a mono, upper-case line reading PROFESSIONAL SERVICES ("DONE-FOR-YOU" until HOME-BRIEF-03,
              2026-11-10) — and under it the h2 "Need help? Send a proposal." (mt-3, the travel act's h2 treatment, class for class).
              The notes above, the act list and the data-done-for-you hooks keep the name DONE-FOR-YOU for this same section. */}
          <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">{BUILD_PILLAR.heading}</h2>
          {BUILD_PILLAR.paragraphs.map((words) => <p key={words} className="mt-3 max-w-3xl text-base text-text-secondary">{words}</p>)}
          <div className="mt-4 rounded-lg border border-border bg-white p-5">
            <div className="mt-4">
              {/* HOME-BRIEF-04 (Alex, 2026-11-10 19:00): the small chip that repeated the label's words stood here, over the
                  doors; it went — the label above the headline says them once. */}
              {/* ONE-FORM-01 (Alex, 2026-11-06): each card is a door to the ONE proposal form with its choice
                  picked (?need=<key>, the form's own query key). SERVICES-01 (Alex, 2026-11-08): SIX EQUAL
                  DOORS — every door's key, title and line from SERVICES in src/lib/proposalNeeds.ts, the one
                  module the form and the CRM read too, and the form's path beside them; nothing typed here.
                  Two rows of three from lg, three rows of two from sm, one column below. The close's card
                  retired with the close, and the typed line under the chip went: it restated the first
                  door's line, with "custom to your business" added. HOME-FINISH-01 (Alex, 2026-11-08): auto-rows-fr — every row as tall as the tallest, so the six doors are one height at every width. */}
              <div className="mt-4 grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {SERVICES.map(({ need, title, line }) => (
                  <Link key={need} href={`${PROPOSAL_FORM_PATH}?need=${need}`} className="rounded-lg border border-border bg-white p-4 text-text-primary hover:bg-brand-purple-wash" data-done-for-you={need}>
                    <div className="text-sm font-medium">{title}</div>
                    <p className="mt-1 text-xs text-text-muted">{line}</p>
                  </Link>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-4">
                <Link
                  href={PROPOSAL_FORM_PATH}
                  className={PRIMARY_CTA}
                >
                  Send a project proposal →
                </Link>
                <span className="ml-auto font-mono text-xs italic text-text-faint">Scoped by proposal</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TOGGLE-1: the lobby books — the five-way toggle strip, mounted
            where the teaser sat (directly under the CTA row; pre-BOOK-1
            Landing.tsx:325-328). Full content width — the strip holds
            whole booking surfaces + result rows, not just a form.
            REPAINT-2: the mount moved OUT of the hero section (one JSX seat
            down, same props, zero wiring) — the hero is a solid aubergine
            band now (it was, until HERO-CREST-01, 2026-11-11: the crest design's violet ground since), so the strip sits on the cream page where its own
            aubergine band (ds.BAND_BG) reads as a band. DECLARED INTERIM:
            the strip's INTERIOR (travel pickers/results) stays dark until
            Slice 4's trips pass. */}
      {/* DEMO-SECTION (390 audit finding 8): div → section + aria-label so
          the demo region is a real landmark. Classes carried verbatim —
          Tailwind utilities are tag-agnostic and nothing selects div#demo
          (both ids here are href targets only).

          ANCHOR: id="modules" MOVED to the offer act (SELL-02) — the Stripe checkout
          cancel_url (api/stripe/checkout-entitlement/route.ts), the shopping View
          Plans button (app/shopping/page.tsx) and the /pricing and /modules doors
          resolve to the OFFER now, not to this demo.
          id="demo" is NOT dropped — an element carries one id, so it sits on
          the eyebrow row a few px below. It has no href pointing at it in src/
          today (the nav's Live-demo link retired, LandingHeader.tsx:53-54 — :35 until HERO-CREST-01, 2026-11-11, which moved that note into the file's header; the top bar links it again, as its third product link, BAR_PRODUCT_LINKS), but an
          external bookmark costs nothing to keep alive.
          FOOTER-01 (2026-11-09): the id is DEMO_ANCHOR now (src/lib/homeAnchors.ts), and two links land on it — the footer's "Book travel" and the trip page's "Book the stay and the flight" (TripPostView.tsx BOOK_HREF, since TRIPPOST-01) — so "no href pointing at it" above is history.

          UNNUMBERED BY RULING: this is a live surface, not a step in the
          teaching sequence, so the eyebrow reads LIVE DEMO — TRAVEL with no
          number. The numbered acts start below it at 01.

          SEAM: border-b, and it closes from BELOW on purpose. Above is the
          hero, whose aubergine-to-cream edge (violet-to-cream since HERO-CREST-01, 2026-11-11) is the page's one deliberate
          zero-rule boundary, so a border-t here would be the defect the seam
          ledger warns about. Closing from below also single-rules the
          GuestTripStrip case — see the ledger on the problem section.

          HOME-FINISH-02 (Alex, 2026-11-10 20:56): the eyebrow row left, so the id — DEMO_ANCHOR — sits on the pillar's h2 now,
          the section's first line, and the section wears its own top and bottom padding (py-10, like the pillar above it):
          the eyebrow row's pt-6 and the foot row's pb-2 gave them until then. */}
      <section aria-label="Live demo — travel" className="max-w-7xl mx-auto px-4 lg:px-8 py-10 border-b border-border">
        {/* HOME-FINISH-02 (Alex, 2026-11-10 20:56): THE THIRD PILLAR — "Explore the World." His rule for all three: "Purple title →
            Approved description → Existing functionality … No additional promotional headings or explanatory paragraphs between
            these elements." So the section holds four things and nothing else: the pillar's h2 (the page's purple heading
            classes), his one paragraph (both read from src/lib/homeActWords.ts EXPLORE_PILLAR, typed nowhere here), the booking
            box exactly as it was mounted, and the booking lookup directly under the box. The h2 carries id={DEMO_ANCHOR} —
            still once in this file — so the footer's Explore the World and the trip page's "Book the stay and the flight" land
            on the heading.
            THE EXPERIENCES ARE INSIDE THE BOX (HOME-BRIEF-04, Alex, 2026-11-10 19:00 · 19:03): this page hands the catalog to
            the box as its events prop (LandingBookingSection.tsx puts the builder's Events mode first with it as the panel); it
            is mounted exactly once, with the server's UTC day, and carries id="events". Every row still comes from
            src/lib/experiences.ts, dated from its own calendar with the day checked, and the one filter still lives in the URL
            (?into=).
            THE DISCLOSURE IS INSIDE THE BOX TOO: "When you book here, I may earn a commission." (src/lib/disclosureWords.ts) was
            a line of its own between the box and the lookup (BOOK-DISCLOSE-01, 2026-11-08). It is the last line of the four
            panels that can pay — Flights, Hotels, Getting around, Things to do — in LandingBookingSection.tsx now, so nothing
            stands between the box and the lookup.
            LEFT THIS SECTION, each as it stood: the eyebrow row — the label "TRAVEL BOOKING & EXPERIENCES" ("LIVE DEMO — TRAVEL"
            until HOME-BRIEF-02) and the link "EXPLORE TRAVEL →" to /modules/travel (LANDING-V2), the row that carried the id;
            the h2 "Plan your escape. Build your income. Explore the world." (EXPERIENCE_LINE, src/lib/brandLines.ts — it has
            no reader now and stays exported there); "Book the experience, not just the destination." (PROMISE); "Search & book
            travel — free today, no account needed." (the three were HOME-BRIEF-03's ONE HEADER); and the foot row under the
            lookup (LANDING-V5) — "One trip holds everything — plans, bookings, budget.", "Create a free account to save your
            trips." (SAVE_TRIPS_LINE) and "NO ACCOUNT NEEDED". */}
        <h2 id={DEMO_ANCHOR} className="text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">{EXPLORE_PILLAR.heading}</h2>
        {EXPLORE_PILLAR.paragraphs.map((words) => <p key={words} className="mt-3 max-w-3xl text-base text-text-secondary">{words}</p>)}
        <LandingBookingSection onRequireAuth={onRequireAuth} events={<ExperiencesSection today={today} />} />
        {/* GUEST-01 (2026-09-29; Alex's ruling 17:04): the door back for a guest who booked
            without an account — the one lookup box (src/components/guest/GuestBookingLookup.tsx),
            the reference and the manage code from their booking email. It asks nothing on
            load; a match goes to /booking/manage, which shows the booking. */}
        <div className="mt-6 border-t border-border-light pt-4" data-guest-lookup-home>
          <GuestBookingLookup onOpened={() => window.location.assign('/booking/manage')} />
        </div>
      </section>
      {/* PR-ELEV-1: the coming-soon tiles live INSIDE the strip above as
          badged "Soon" chips (travelStripModes) — the PR-LANDING-1 tile
          row below the strip is gone; the both-surfaces-at-once light-up
          ruling now holds at chip level via the shared builder. */}

      {/* ── BOOK-3: the guest's session trip — renders only when records
            exist (fail-honest empty state = nothing). ─────────────────────── */}
      <GuestTripStrip onRequireAuth={onRequireAuth} />

      {/* ── STOP0-01 (Alex, 2026-11-08 15:11 + 16:18; board K tag 8): STOP 0 — Alex's letter in his
            own words and a short dated timeline of how he got here, between the experiences and
            MY TRIP; every visible word from src/lib/stopZeroWords.ts. A cream act with its own border-b,
            id="stop-0" — the events band's "Read my story ↓" (K tag 7) points at it. ──────── */}
      <StopZeroSection />

      {/* ── WASHERE-01 (Alex, 2026-10-31): MY TRIP — the trip log, in trip order, built for
            photos. The card EVENTS-01 pinned inside the experiences lives here now: the
            events filter serves the reader; "I was here" is Alex's own trip. A cream act
            with its own border-b (the DONE-FOR-YOU idiom), id="my-trip". ───────────── */}
      <WasHereSection today={today} />

      {/* HOME-FINISH-02 (2026-11-10 — Alex's layout ends at Our Story; the chat's pick, shown to him with the pictures at 21:25): the
          14-steps button that stood here left the page — PIPELINE-PAGE-01's door, one cream act holding one link to /how-it-works in
          the page's filled button. The footer's THE RECORD keeps the door (LandingFooter.tsx), and the old #deck-NN links still
          redirect (the effect above reads PIPELINE_PATH). MY TRIP's border-b is the page's last rule over the footer. */}

      {/* WHY ACT LANDS HERE — (PR-WHY, content TBD) */}

      {/* ── LOBBY-DECK-1b: the demo modal — the house dialog idiom
            (CheckoutPanel.tsx:300 backdrop). YouTube URLs embed via iframe;
            any other URL plays through a native <video>. Backdrop click or
            ✕ closes. Unreachable while DEMO_VIDEO_URL is null. ─────────────── */}
      {showDemo && DEMO_VIDEO_URL !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowDemo(false)}
        >
          <div
            className="w-full max-w-3xl rounded-lg border border-border bg-white p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint">
                The demo
              </p>
              <button
                type="button"
                aria-label="Close the demo"
                onClick={() => setShowDemo(false)}
                className="text-text-muted transition-colors hover:text-text-primary"
              >
                ✕
              </button>
            </div>
            {youTubeEmbedUrl(DEMO_VIDEO_URL) ? (
              <iframe
                src={youTubeEmbedUrl(DEMO_VIDEO_URL) as string}
                title="Demo video"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
                className="aspect-video w-full rounded"
              />
            ) : (
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video src={DEMO_VIDEO_URL} controls autoPlay className="aspect-video w-full rounded" />
            )}
          </div>
        </div>
      )}

      <LandingFooter />
    </div>
  );
}
