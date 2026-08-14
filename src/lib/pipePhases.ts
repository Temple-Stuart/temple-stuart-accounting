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
// THE SEVEN OTHERS — the ratified spec lists their future in-app strips
// will consume when each strip PR lands. subLabel deliberately ABSENT:
// every strip PR derives its sub-labels from its own surface's real
// machinery (the Trade R2 precedent) — inventing them here is forbidden.
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
  travel: [
    { num: '01', name: 'Trip' },
    { num: '02', name: 'Search' },
    { num: '03', name: 'Book' },
    { num: '04', name: 'Ledger' },
    { num: '05', name: 'Reconcile' },
  ],
  runway: [
    { num: '01', name: 'Source' },
    { num: '02', name: 'History' },
    { num: '03', name: 'Burn' },
    { num: '04', name: 'Match' },
    { num: '05', name: 'Project' },
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
  compliance: [
    { num: '01', name: 'Profile' },
    { num: '02', name: 'Corpus' },
    { num: '03', name: 'Retrieve' },
    { num: '04', name: 'Discover' },
    { num: '05', name: 'Verify' },
    { num: '06', name: 'Register' },
  ],
  routines: [
    { num: '01', name: 'Define' },
    { num: '02', name: 'Scheduled' },
    { num: '03', name: 'Run' },
    { num: '04', name: 'Proven' },
  ],
  projects: [
    { num: '01', name: 'Input' },
    { num: '02', name: 'Research' },
    { num: '03', name: 'Audit' },
    { num: '04', name: 'Tasks' },
    { num: '05', name: 'Plan' },
    { num: '06', name: 'Evolve' },
  ],
  content: [
    { num: '01', name: 'Inputs' },
    { num: '02', name: 'Script map' },
    { num: '03', name: 'Answer + Record' },
    { num: '04', name: 'Script' },
  ],
} as const satisfies Record<PipePillarId, readonly PipePhase[]>;
