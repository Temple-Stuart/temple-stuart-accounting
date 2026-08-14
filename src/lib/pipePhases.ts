// PIPE-PHASES-1: the shared pipe-phases config — the SINGLE SOURCE the
// landing's merged pipe section AND the in-app StageStrips read, so the
// homepage and the app are lockstep BY CONSTRUCTION: a change here changes
// both surfaces in the same commit; neither surface retypes a phase string.
// Leaf module (zero imports, client-safe) — the moduleBands.ts precedent.
//
// Keyed by PILLAR id in the ratified funnel order (Landing.tsx PILLAR_CARDS
// ids, travel first … content last — the numbering authority PIPE-FRAME-1
// ratified). NOTE the key is the pillar id, NOT the tab key: Runway's pillar
// id is 'runway' while its tab key is 'calendar' (moduleBands.ts keying).
//
// TRADE + BOOKS — the two LIVE in-app strips: strings MOVED VERBATIM from
// the strips' own phase arrays (ModuleLauncher.tsx's Trade StageStrip mount
// and BooksPipeline.tsx's StageStrip mount import from here now) — every
// num, name, subLabel and the COMMIT link chip byte-identical to what the
// app rendered before the move. These entries are the live app's own
// strings; the app is the authority for them.
//
// THE OTHERS — the ratified spec lists their future in-app strips will
// consume when each strip PR lands. subLabel deliberately ABSENT until a
// module's own strip PR derives its sub-labels from its surface's real
// machinery (the Trade R2 precedent) — inventing them here is forbidden.
// Graduated so far: routines (ROUTINES-PIPE, derivations cited at the entry).
//
// link — a phase living in ANOTHER module (Trade's 06 COMMIT → Books):
// target = the tab key the app's existing navigation mechanism receives
// (ModuleLauncher selectTab); label = the bordered link chip's string.
// This file carries phase DATA only — no states, no keys, no handlers;
// each consumer keeps its own derived-state machinery. Books' 13-stage →
// 6-phase nesting map likewise stays local to BooksPipeline.tsx.

export interface PipePhase {
  /** Two-digit mono ordinal, e.g. '01'. */
  num: string;
  /** The phase name exactly as the strip renders it (case preserved —
   *  Trade is mono-uppercase by copy, Books title-case by copy). */
  name: string;
  /** The descriptive micro-label under the phase name (Trade's R2 row —
   *  the only strip that has ratified sub-labels today). */
  subLabel?: string;
  /** Set only when the phase lives in another module: { target, label }. */
  link?: { target: string; label: string };
}

export type PipePillarId =
  | 'travel'
  | 'runway'
  | 'books'
  | 'trade'
  | 'tax'
  | 'compliance'
  | 'routines'
  | 'projects'
  | 'content';

export const PIPE_PHASES = {
  // TRAVEL-PIPE: subLabels derived from the tab's own surface strings (the
  // Trade R2 idiom), never invented: Trip ⇐ the YOUR TRIPS card header
  // (ModuleLauncher SECTION_HEADER) + "+ Create a trip"; Search ⇐ ABSENT —
  // no honest compression of the nine mode-chip labels exists (declared);
  // Book ⇐ TripBookings' own "Booked (N)" header (:284) + its "BOOKED, PAID
  // reservations" contract (:7); Ledger ⇐ TripBudgetActual's "Saved vs
  // Booked" vocabulary (:22, the trip's BUDGET LEDGER); Reconcile ⇐
  // UnattachedBookings' "adoptable orphans" (:5) + its attach action (:93).
  travel: [
    { num: '01', name: 'Trip', subLabel: 'YOUR TRIPS + CREATE' },
    { num: '02', name: 'Search' },
    { num: '03', name: 'Book', subLabel: 'BOOKED + PAID' },
    { num: '04', name: 'Ledger', subLabel: 'SAVED VS BOOKED' },
    { num: '05', name: 'Reconcile', subLabel: 'ATTACH ORPHANS' },
  ],
  // RUNWAY-PIPE: subLabels derived from the tab's own surface strings (the
  // Trade R2 idiom), never invented: Source ⇐ the hero Cash cell's source
  // label "Plaid balance · operating (excl. trading)" (runway/route.ts:243,
  // rendered RunwayBudgetPanel.tsx:246); History ⇐ the payload's burnSource
  // "trailing ledger actuals" (rendered in the on-screen formula line,
  // RunwayBudgetPanel.tsx:276); Burn ⇐ the hero's own cell labels "Net burn"
  // + "Zero date" (RunwayBudgetPanel.tsx:225,:250); Match ⇐ the section's
  // rendered h3 "Booking ↔ bank match review" (MatchReviewSection.tsx:130);
  // Project ⇐ the panel's own view description "Month-by-month budget vs
  // actual." (RunwayBudgetPanel.tsx:337).
  runway: [
    { num: '01', name: 'Source', subLabel: 'PLAID BALANCE' },
    { num: '02', name: 'History', subLabel: 'TRAILING LEDGER ACTUALS' },
    { num: '03', name: 'Burn', subLabel: 'NET BURN + ZERO DATE' },
    { num: '04', name: 'Match', subLabel: 'BOOKING ↔ BANK' },
    { num: '05', name: 'Project', subLabel: 'BUDGET VS ACTUAL' },
  ],
  books: [
    { num: '01', name: 'Feed' },
    { num: '02', name: 'Code' },
    { num: '03', name: 'Reconcile' },
    { num: '04', name: 'Close' },
    { num: '05', name: 'Reports' },
    { num: '06', name: 'Export' },
  ],
  trade: [
    { num: '01', name: 'SETUP', subLabel: 'UNIVERSE + FILTERS' },
    { num: '02', name: 'SCAN', subLabel: 'RUN THE PIPELINE' },
    { num: '03', name: 'REVIEW', subLabel: 'PICK CANDIDATES' },
    { num: '04', name: 'LAB', subLabel: 'LINK + GRADE' },
    { num: '05', name: 'RECORD', subLabel: 'GRADED RESULTS' },
    { num: '06', name: 'COMMIT', link: { target: 'books', label: 'IN BOOKS →' } },
  ],
  tax: [
    { num: '01', name: 'Life events' },
    { num: '02', name: 'Documents' },
    { num: '03', name: 'Income' },
    { num: '04', name: 'Deductions' },
    { num: '05', name: 'Trading' },
    { num: '06', name: 'Review' },
    { num: '07', name: 'File' },
  ],
  // COMPLIANCE-PIPE: subLabels derived from the workbench sections' own doc
  // headers (the Trade R2 idiom), never invented: Profile ⇐ "entities,
  // jurisdictions, income types" (SectionB:3-4); Corpus ⇐ "total documents,
  // total chunks" (SectionC:3-4 + its Stat labels); Retrieve ⇐ "hybrid
  // retrieval over the regulatory corpus" (SectionH:3-4); Discover ⇐
  // "Discovery run launcher" + "Live discovery stream" (SectionD:3,
  // SectionE:3 — SectionF missions + SectionJ cost ride this phase, the
  // Books nesting precedent); Verify ⇐ "8-step status badges per citation"
  // (SectionG:3-4, the honest UNBUILT placeholder); Register ⇐ the
  // "hash chain" (SectionI:4-5).
  compliance: [
    { num: '01', name: 'Profile', subLabel: 'ENTITIES + JURISDICTIONS' },
    { num: '02', name: 'Corpus', subLabel: 'DOCUMENTS + CHUNKS' },
    { num: '03', name: 'Retrieve', subLabel: 'HYBRID RETRIEVAL' },
    { num: '04', name: 'Discover', subLabel: 'LAUNCH + LIVE STREAM' },
    { num: '05', name: 'Verify', subLabel: '8-STEP BADGES' },
    { num: '06', name: 'Register', subLabel: 'HASH CHAIN' },
  ],
  // ROUTINES-PIPE: the first of the seven future strips landed — subLabels
  // derived from the tab's own surface strings (the Trade R2 idiom), never
  // invented: Define ⇐ the list's create/edit affordances ("+ new routine",
  // RoutineList.tsx:158; "+ create a routine", TodaysStrip zero-state);
  // Scheduled ⇐ the cadence grouping vocabulary (CADENCE_GROUP_LABELS,
  // routines/types.ts); Run ⇐ TodaysStrip's own summary row "{done} done ·
  // {due} due · {missed} missed"; Proven ⇐ RoutineRow's streak render + its
  // title "completion streak / miss streak" (RoutineRow.tsx:239-240).
  routines: [
    { num: '01', name: 'Define', subLabel: 'CREATE + EDIT' },
    { num: '02', name: 'Scheduled', subLabel: 'CADENCE GROUPS' },
    { num: '03', name: 'Run', subLabel: 'DONE · DUE · MISSED' },
    { num: '04', name: 'Proven', subLabel: 'STREAKS' },
  ],
  // PROJECTS-PIPE (Option A ruling): subLabels derived from the truth
  // machine's own stage-card strings (TruthMachineView.tsx), never invented:
  // Input ⇐ the card's field labels goal/problem/diagnosis (:325-338);
  // Research ⇐ "✨ run deep research" (:362); Audit ⇐ the "Claude Code
  // audit" output vocabulary (:390-394); Tasks ⇐ the "fusion → tasks" card
  // label (:423) + the human-accept gate (:13); Plan ⇐ the "TASK LIST
  // (live)" card (:475-477); Evolve ⇐ "↻ evolve — new goals, loop again"
  // (:504).
  projects: [
    { num: '01', name: 'Input', subLabel: 'GOAL · PROBLEM · DIAGNOSIS' },
    { num: '02', name: 'Research', subLabel: 'DEEP RESEARCH' },
    { num: '03', name: 'Audit', subLabel: 'CLAUDE CODE AUDIT' },
    { num: '04', name: 'Tasks', subLabel: 'FUSION + ACCEPT GATE' },
    { num: '05', name: 'Plan', subLabel: 'LIVE TASK LIST' },
    { num: '06', name: 'Evolve', subLabel: 'NEW GOALS, LOOP AGAIN' },
  ],
  content: [
    { num: '01', name: 'Inputs' },
    { num: '02', name: 'Script map' },
    { num: '03', name: 'Answer + Record' },
    { num: '04', name: 'Script' },
  ],
} as const satisfies Record<PipePillarId, readonly PipePhase[]>;
