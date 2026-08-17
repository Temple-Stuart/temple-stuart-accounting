// GLIMPSE-ART (round-5): the per-step glimpse drawings for the walkthrough
// stage — mirrored TOKEN-FOR-TOKEN from the approved Desktop-1440 mock's
// embedded stage template (design-refs/landing-v5/Modules-v5-Desktop-1440
// .dc.html, the {{ g0 }}…{{ g3 }} blocks — the art authority). THIS PR lands
// ROUTINES' four drawn states; every other module stays absent here and the
// stage renders its staged placeholder (the mock's own to-follow pattern — a
// visible staging state, not a silent fallback; the stage's `??` render is
// the declared staged-rollout mechanism).
//
// Tokens: every mock hex maps to the shipped scale (#FFFDF9 ts-white ·
// #DDD6E8 border · #EBE4F7 border-light · #F3EFE6 bg-row · #3B2D6B purple ·
// #B8860B gold · #1A1A2E/#4A4A5A/#7A7488/#A8A2B0 text scale). Green #16a34a
// and red #c53030 render as inline arbitrary values ON PURPOSE — the token
// law's ONLY green/red zone is glimpse interiors; no app token exists or
// should. All interior strings and sample figures are the mock's own
// ILLUSTRATION data (mock props by design); interior type at 10-12px is
// illustration-tier — decorative, exempt from the mobile UI floor (the old
// in-SVG text precedent), declared per-string in the PR report.
//
// Mobile (the mock's M2 key-region ruling): each drawing renders CONTAINED —
// fluid interiors; G1's fixed 280px calendar column (the non-key region)
// hides below sm so the priced list (the key region) fills the frame.
//
// Shape (declared): a ReadonlyArray of pre-built static nodes per module —
// the drawings take no props, so component-per-step would be ceremony.

import type { ReactNode } from 'react';
import type { PipePillarId } from '@/lib/pipePhases';

/** The shared 299 surface shell — the mock's own card (border + ts-white). */
const SHELL = 'flex h-full min-h-[220px] flex-col border border-border bg-ts-white lg:h-[299px]';

const CAL_DOT_DAYS = new Set([1, 15, 20]);

const routinesGlimpses: ReadonlyArray<ReactNode> = [
  /* ── 01 Define — the routine create form (g0) ── */
  <div key="r0" className={SHELL}>
    <div className="flex items-baseline justify-between px-4 pb-2.5 pt-3">
      <span className="font-mono text-[13px] tracking-[0.2em] text-text-secondary">YOUR ROUTINES</span>
      <span className="whitespace-nowrap font-mono text-[11px] font-semibold tracking-[0.08em] text-brand-purple">+ NEW ROUTINE</span>
    </div>
    <div className="mx-4 mt-2 border border-border bg-white px-4 py-3.5">
      <div className="grid grid-cols-[1.4fr_1fr_0.8fr] gap-2 sm:gap-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">NAME</div>
          <div className="mt-1.5 border border-border bg-ts-white px-2.5 py-2 text-[13px] text-text-primary">Pay the rent</div>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">CADENCE</div>
          <div className="mt-1.5 truncate border border-border bg-ts-white px-2.5 py-2 font-mono text-[12px] text-text-secondary">MONTHLY · DAY 1</div>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">EACH TIME</div>
          <div className="mt-1.5 border border-border bg-ts-white px-2.5 py-2 font-mono text-[12px] font-medium text-brand-gold">$400.00</div>
        </div>
      </div>
    </div>
    {/* DEFINE-ROWS (Alex-ruled deviation from the mock): the already-filed
        routines render as TWO priced rows — the one-line cram retired. */}
    <div className="mx-4 mt-2 flex items-baseline justify-between gap-2 border-b border-border-light py-[7px]">
      <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">Restock supplies</span>
      <span className="font-mono text-[11px] text-text-secondary">MONTHLY · DAY 15</span>
      <span className="font-mono text-[12px] font-medium text-brand-gold">$300.00</span>
    </div>
    <div className="mx-4 flex items-baseline justify-between gap-2 py-[7px]">
      <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">Service the truck</span>
      <span className="font-mono text-[11px] text-text-secondary">MONTHLY · DAY 20</span>
      <span className="font-mono text-[12px] font-medium text-brand-gold">$150.00</span>
    </div>
    <div className="mt-auto flex flex-wrap justify-between gap-x-3 border-t border-border bg-bg-row px-4 py-2 font-mono text-[12px] tracking-[0.1em]">
      <span className="text-text-primary">$400 + $300 + $150 = $850.00</span>
      <span className="text-text-muted">YOUR ROUTINES ARE THE BUDGET</span>
    </div>
  </div>,

  /* ── 02 Scheduled — calendar dots + the priced month list (g1) ── */
  <div key="r1" className={`${SHELL} !flex-row`}>
    <div className="hidden w-[280px] shrink-0 border-r border-border-light px-4 py-3 sm:block">
      <div className="font-mono text-[11px] tracking-[0.14em] text-text-muted">AUGUST</div>
      <div className="mt-2.5 grid grid-cols-7 gap-[3px]">
        {Array.from({ length: 21 }, (_, d) => d + 1).map((day) => (
          <div key={day} className="flex h-[34px] flex-col items-center justify-center gap-[2px] border border-border-light bg-ts-white">
            <span className="font-mono text-[11px] text-text-secondary">{day}</span>
            {CAL_DOT_DAYS.has(day) && <span className="h-[5px] w-[5px] bg-brand-purple" />}
          </div>
        ))}
      </div>
    </div>
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex justify-between bg-bg-row px-4 py-1.5 font-mono text-[10px] tracking-[0.12em] text-text-muted">
        <span>MONTHLY</span>
        <span>3 ROUTINES</span>
      </div>
      {([
        ['Pay the rent', 'AUG 1', '$400.00'],
        ['Restock supplies', 'AUG 15', '$300.00'],
        ['Service the truck', 'AUG 20', '$150.00'],
      ] as const).map(([name, date, amt], i) => (
        <div key={name} className={`flex items-baseline justify-between gap-2 px-4 py-[11px] ${i < 2 ? 'border-b border-border-light' : ''}`}>
          <span className="truncate text-[14px] text-text-primary">{name}</span>
          <span className="font-mono text-[12px] text-text-secondary">{date}</span>
          <span className="font-mono text-[12.5px] font-medium text-brand-gold">{amt}</span>
        </div>
      ))}
      <div className="mt-auto border-t border-border px-4 py-2.5">
        <div className="font-mono text-[11px] tracking-[0.14em] text-text-muted">PLANNED THIS MONTH</div>
        <div className="mt-0.5 text-[26px] font-medium leading-[1.15] tracking-[-0.02em] text-brand-gold">$850.00</div>
      </div>
    </div>
  </div>,

  /* ── 03 Run — the today strip (g2; green/red zone) ── */
  <div key="r2" className={SHELL}>
    <div className="flex items-baseline justify-between px-4 pb-2.5 pt-3">
      <span className="font-mono text-[13px] tracking-[0.2em] text-text-secondary">TODAY</span>
      <span className="font-mono text-[11px] tracking-[0.14em] text-text-faint">AUG 15</span>
    </div>
    <div className="flex items-baseline gap-3 border-t border-border-light px-4 py-[13px]">
      <span className="w-5 font-mono text-[14px] text-[#16a34a]">✓</span>
      <span className="flex-1 text-[15px] text-text-primary">Pay the rent</span>
      <span className="font-mono text-[11px] tracking-[0.1em] text-[#16a34a]">DONE · AUG 1</span>
    </div>
    <div className="flex items-baseline gap-3 border-t border-border-light px-4 py-[13px]">
      <span className="w-5 font-mono text-[14px] text-brand-gold">○</span>
      <span className="flex-1 text-[15px] font-medium text-text-primary">Restock supplies</span>
      <span className="font-mono text-[11px] font-semibold tracking-[0.1em] text-brand-gold">DUE TODAY</span>
    </div>
    <div className="flex items-baseline gap-3 border-t border-border-light px-4 py-[13px]">
      <span className="w-5 font-mono text-[14px] text-text-faint">○</span>
      <span className="flex-1 text-[15px] text-text-muted">Service the truck</span>
      <span className="font-mono text-[11px] tracking-[0.1em] text-text-faint">DUE · AUG 20</span>
    </div>
    <div className="mt-auto flex flex-wrap justify-between gap-x-3 border-t border-border bg-bg-row px-4 py-2 font-mono text-[12px] tracking-[0.1em]">
      <span className="text-text-primary">1 DONE · 1 DUE · 0 MISSED</span>
      <span className="text-text-muted">DONE OR MISSED</span>
    </div>
  </div>,

  /* ── 04 Proven — the streak bars (g3; green/red zone) ── */
  <div key="r3" className={SHELL}>
    <div className="flex items-baseline justify-between px-4 pb-2.5 pt-3">
      <span className="font-mono text-[13px] tracking-[0.2em] text-text-secondary">STREAKS</span>
      <span className="font-mono text-[11px] tracking-[0.14em] text-text-faint">COMPLETION · MISS</span>
    </div>
    {([
      ['Pay the rent', ['g', 'g', 'g', 'g', 'g', 'g'], '6 IN A ROW', false],
      ['Restock supplies', ['e', 'e', 'g', 'g', 'g', 'g'], '4 IN A ROW', false],
      ['Service the truck', ['g', 'g', 'r', 'g', 'g', 'g'], 'MISSED JUL', true],
    ] as const).map(([name, cells, note, missed]) => (
      <div key={name} className="flex items-center gap-3.5 border-t border-border-light px-4 py-3.5">
        <span className="min-w-0 flex-1 truncate text-[15px] text-text-primary">{name}</span>
        <span className="flex gap-1">
          {cells.map((c, i) => (
            <span key={i} className={`h-[11px] w-[11px] ${c === 'g' ? 'bg-[#16a34a]' : c === 'r' ? 'bg-[#c53030]' : 'bg-border-light'}`} />
          ))}
        </span>
        <span className={`w-[110px] shrink-0 text-right font-mono text-[11px] tracking-[0.08em] ${missed ? 'text-[#c53030]' : 'text-text-secondary'}`}>{note}</span>
      </div>
    ))}
    <div className="mt-auto flex justify-end border-t border-border bg-bg-row px-4 py-2 font-mono text-[12px] tracking-[0.1em]">
      <span className="text-text-muted">THE STREAK COUNTS BOTH WAYS</span>
    </div>
  </div>,
];


// ─── BATCH 2 (projects · travel · trade) — NEW ART, not mock-mirrored: the
// mock drew only Routines; these 17 compose FROM the Routines grammar above
// (header row · white field card · priced rows · status glyphs · footer bar ·
// the two-col variant) with the ledger's GLIMPSE clause as the manifest (law)
// and real app vocabulary where it exists ("+ Create a trip", "Saved vs
// Booked", adoptable orphans, the approve gate, pipeline counts, IN BOOKS →).
// Sample figures are modest teaching props in the Routines style — no live-
// price implication, no P&L claim; Trade 05 shows a LOSS on purpose (the
// no-cherry-picking truth made visible). Green/red stay drawing-internal
// (the token law's only green/red zone). ───────────────────────────────────

const HEADER = 'flex items-baseline justify-between px-4 pb-2.5 pt-3';
const HL = 'font-mono text-[13px] tracking-[0.2em] text-text-secondary';
const HR = 'font-mono text-[11px] tracking-[0.14em] text-text-faint';
const FOOT = 'mt-auto flex flex-wrap justify-between gap-x-3 border-t border-border bg-bg-row px-4 py-2 font-mono text-[12px] tracking-[0.1em]';
const ROW = 'flex items-baseline gap-3 border-t border-border-light px-4 py-[13px]';
const CHIP = 'rounded border px-1.5 font-mono text-[10px] tracking-[0.1em]';

const projectsGlimpses: ReadonlyArray<ReactNode> = [
  /* 01 Input — the goal input, "I WANT to…" lines */
  <div key="p0" className={SHELL}>
    <div className={HEADER}><span className={HL}>THE GOAL</span><span className={HR}>PLAIN WORDS</span></div>
    <div className="mx-4 mt-1 border border-border bg-white px-4 py-3.5">
      <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">I WANT TO…</div>
      <p className="mt-2 text-[14px] leading-[1.5] text-text-primary">launch the workshop side of the business without losing the truck work</p>
      <p className="mt-2 border-t border-border-light pt-2 text-[13px] leading-[1.5] text-text-muted">…and figure out what the tooling actually costs</p>
    </div>
    <div className={FOOT}><span className="text-text-primary">2 GOALS · VERBATIM</span><span className="text-text-muted">THE SOURCE OF TRUTH</span></div>
  </div>,
  /* 02 Research — your words highlighted inside the real prompt */
  <div key="p1" className={SHELL}>
    <div className={HEADER}><span className={HL}>DEEP RESEARCH</span><span className={HR}>YOUR WORDS IN THE PROMPT</span></div>
    <div className="mx-4 mt-1 border border-border bg-white px-4 py-3.5">
      <p className="font-mono text-[11.5px] leading-[1.7] text-text-secondary">Research how to <span className="bg-brand-purple-wash px-1 text-brand-purple">launch the workshop side</span> while keeping <span className="bg-brand-purple-wash px-1 text-brand-purple">the truck work</span> — costs, licensing, sequencing…</p>
    </div>
    <div className="mx-4 mt-2.5 flex items-baseline justify-between">
      <span className="text-[12px] text-text-muted">Findings return here — add your own beside them</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">RESEARCH ON YOUR GOALS</span><span className="text-text-muted">NOT A TEMPLATE</span></div>
  </div>,
  /* 03 Audit — the audit card + its output box */
  <div key="p2" className={SHELL}>
    <div className={HEADER}><span className={HL}>THE AUDIT</span><span className={HR}>FACT-CHECK FIRST</span></div>
    <div className="mx-4 mt-1 border border-border bg-white px-4 py-3">
      <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">CLAUDE CODE AUDIT</div>
      <div className="mt-2 border border-border-light bg-ts-white px-3 py-2.5">
        <p className="font-mono text-[11.5px] leading-[1.7] text-text-secondary">✓ workshop insurance quote verified<br/>⚠ tool budget missing a compressor line</p>
      </div>
    </div>
    <div className={FOOT}><span className="text-text-primary">AUDITED AGAINST REALITY</span><span className="text-text-muted">BEFORE ANYTHING RUNS</span></div>
  </div>,
  /* 04 Tasks — the task preview with the approve gate */
  <div key="p3" className={SHELL}>
    <div className={HEADER}><span className={HL}>PROPOSED TASKS</span><span className={HR}>THE ACCEPT GATE</span></div>
    <div className={ROW}>
      <span className="flex-1 text-[14px] text-text-primary">Get the workshop insurance quote</span>
      <span className={`${CHIP} border-brand-purple bg-brand-purple text-white`}>APPROVED</span>
    </div>
    <div className={ROW}>
      <span className="flex-1 text-[14px] text-text-primary">Price the compressor</span>
      <span className={`${CHIP} border-border bg-ts-white text-brand-purple`}>APPROVE?</span>
      <span className={`${CHIP} border-border bg-ts-white text-text-faint`}>REJECT</span>
    </div>
    <div className={ROW}>
      <span className="flex-1 text-[14px] text-text-muted">Book the stall at the spring fair</span>
      <span className={`${CHIP} border-border bg-ts-white text-brand-purple`}>APPROVE?</span>
      <span className={`${CHIP} border-border bg-ts-white text-text-faint`}>REJECT</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">1 APPROVED · 2 WAITING</span><span className="text-text-muted">NOTHING RUNS ITSELF</span></div>
  </div>,
  /* 05 Plan — the live task list */
  <div key="p4" className={SHELL}>
    <div className={HEADER}><span className={HL}>TASK LIST</span><span className={HR}>LIVE · ON YOUR CALENDAR</span></div>
    {([
      ['Get the insurance quote', 'TUE 9:00', '$0'],
      ['Price the compressor', 'TUE 14:00', '$1,150'],
      ['Book the spring-fair stall', 'FRI 10:00', '$180'],
    ] as const).map(([name, slot, amt]) => (
      <div key={name} className={ROW}>
        <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">{name}</span>
        <span className="font-mono text-[12px] text-text-secondary">{slot}</span>
        <span className="w-[64px] text-right font-mono text-[12.5px] font-medium text-brand-gold">{amt}</span>
      </div>
    ))}
    <div className={FOOT}><span className="text-text-primary">PLANNED: $1,330</span><span className="text-text-muted">TIME + PRICE TOGETHER</span></div>
  </div>,
  /* 06 Evolve — "new goals, loop again" */
  <div key="p5" className={SHELL}>
    <div className={HEADER}><span className={HL}>EVOLVE</span><span className={HR}>HISTORY KEPT</span></div>
    <div className="mx-4 mt-4 flex flex-1 flex-col items-center justify-center border border-border-light bg-ts-white px-6 py-6 text-center">
      <span className="font-mono text-[15px] font-semibold tracking-[0.1em] text-brand-purple">↻ NEW GOALS, LOOP AGAIN</span>
      <span className="mt-2 font-mono text-[11px] tracking-[0.1em] text-text-faint">PLAN v1 · PLAN v2 — BOTH KEPT</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">RERUNS THE PIPE</span><span className="text-text-muted">NOTHING DELETED</span></div>
  </div>,
];

const travelGlimpses: ReadonlyArray<ReactNode> = [
  /* 01 Trip — your trips + "+ Create a trip" */
  <div key="v0" className={SHELL}>
    <div className={HEADER}><span className={HL}>YOUR TRIPS</span><span className="whitespace-nowrap font-mono text-[11px] font-semibold tracking-[0.08em] text-brand-purple">+ CREATE A TRIP</span></div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">Lisbon — October</span>
      <span className="font-mono text-[12px] text-text-secondary">OCT 3–14</span>
      <span className="font-mono text-[12.5px] font-medium text-brand-gold">$2,400</span>
    </div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-muted">Home base — ongoing</span>
      <span className="font-mono text-[12px] text-text-faint">—</span>
      <span className="font-mono text-[12.5px] text-text-faint">budget only</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">EACH TRIP = A BUDGET + A CALENDAR</span><span className="text-text-muted">FROM DAY ONE</span></div>
  </div>,
  /* 02 Search — the mode strip + live results */
  <div key="v1" className={SHELL}>
    <div className={HEADER}><span className={HL}>SEARCH</span><span className={HR}>FREE · NO ACCOUNT</span></div>
    <div className="mx-4 mt-1 flex gap-1.5">
      {['FLIGHTS', 'HOTELS', 'TOURS', 'TRANSFERS'].map((m, i) => (
        <span key={m} className={`${CHIP} ${i === 0 ? 'border-brand-purple bg-brand-purple text-white' : 'border-border bg-ts-white text-text-secondary'}`}>{m}</span>
      ))}
    </div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">PDX → LIS · 1 stop</span>
      <span className="font-mono text-[12px] text-text-secondary">OCT 3</span>
      <span className="font-mono text-[12.5px] font-medium text-brand-gold">$612</span>
    </div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">PDX → LIS · nonstop</span>
      <span className="font-mono text-[12px] text-text-secondary">OCT 3</span>
      <span className="font-mono text-[12.5px] font-medium text-brand-gold">$704</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">LIVE PRICES</span><span className="text-text-muted">SEARCHING IS ALWAYS FREE</span></div>
  </div>,
  /* 03 Book — booked + paid reservations */
  <div key="v2" className={SHELL}>
    <div className={HEADER}><span className={HL}>BOOKED</span><span className={HR}>PAID TO THE PROVIDER</span></div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">Flight · PDX → LIS</span>
      <span className={`${CHIP} border-brand-purple bg-brand-purple-wash text-brand-purple`}>BOOKED</span>
      <span className="w-[56px] text-right font-mono text-[12.5px] font-medium text-brand-gold">$612</span>
    </div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">Hotel · Alfama, 4 nights</span>
      <span className={`${CHIP} border-brand-purple bg-brand-purple-wash text-brand-purple`}>BOOKED</span>
      <span className="w-[56px] text-right font-mono text-[12.5px] font-medium text-brand-gold">$388</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">SAVED TO THE TRIP</span><span className="text-text-muted">THE PROVIDER IS THE MERCHANT</span></div>
  </div>,
  /* 04 Ledger — saved vs booked */
  <div key="v3" className={SHELL}>
    <div className={HEADER}><span className={HL}>BUDGET LEDGER</span><span className={HR}>SAVED VS BOOKED</span></div>
    <div className="mx-4 mt-1 grid grid-cols-[1fr_72px_72px] gap-x-2 border-b border-border-light pb-1.5 font-mono text-[10px] tracking-[0.12em] text-text-muted">
      <span>LINE</span><span className="text-right">SAVED</span><span className="text-right">BOOKED</span>
    </div>
    {([
      ['Flights', '$650', '$612'],
      ['Lodging', '$400', '$388'],
      ['Tours', '$250', '—'],
    ] as const).map(([line, saved, booked]) => (
      <div key={line} className="mx-4 grid grid-cols-[1fr_72px_72px] gap-x-2 border-b border-border-light py-[9px]">
        <span className="truncate text-[14px] text-text-primary">{line}</span>
        <span className="text-right font-mono text-[12px] text-text-secondary">{saved}</span>
        <span className={`text-right font-mono text-[12.5px] font-medium ${booked === '—' ? 'text-text-faint' : 'text-brand-gold'}`}>{booked}</span>
      </div>
    ))}
    <div className={FOOT}><span className="text-text-primary">BOOKINGS WRITE THE LINES</span><span className="text-text-muted">AUTOMATIC</span></div>
  </div>,
  /* 05 Reconcile — the unattached-bookings attach panel */
  <div key="v4" className={SHELL}>
    <div className={HEADER}><span className={HL}>RECONCILE</span><span className={HR}>ADOPTABLE ORPHANS</span></div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">Airport transfer · $46</span>
      <span className={`${CHIP} border-brand-purple bg-ts-white text-brand-purple`}>ATTACH → LISBON</span>
    </div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-muted">Card feed · TAP AIR $612</span>
      <span className="font-mono text-[11px] tracking-[0.1em] text-[#16a34a]">MATCHED ✓</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">TRIP SPEND ↔ BANK FEED</span><span className="text-text-muted">NOTHING FLOATS LOOSE</span></div>
  </div>,
];

// ─── TRADE-REALITY-1 (reality pass 1): module-04 redrawn from the REAL Trade
// surfaces — every interior string ⇐ code (cites at each step); the sample
// figures are SPEC-FIGURES (production screenshot values: the 473/94/379/18/17
// counts, NTAP/NWS/META, $278, 92.0%, +$64, $520/$980/62.0%/0.53, 7W–0L–0BE,
// $82, 7 of 7, 952). Color law: gold ONLY on the money moments ($278 · +$64 ·
// $520/$980 · $82); the real UI's other accents (gold count lines, gold stars,
// green EV / green Max Profit / red Max Loss, green success chips) normalize
// to the cream/aubergine scale — declared, not drift. Micro type at 8–9.5px on
// t0/t1 is the miniature tier (a ~4:1-scale form and a 20-row terminal ledger,
// decorative) — below the file's usual 10–12px illustration tier, declared.
//
// TRADE-REALITY-2 (reality pass 2): the array order is the LANDING order —
// FILTER → SCAN → REVIEW → QUEUE → COMMIT → RECORD (order-parallel with the
// Landing.tsx LANDING-TRADE-ORDER override, NOT with pipePhases.trade, until
// the app strip rewires). Figure tags: S = supplied spec-figure (production
// run/screenshot), C = code-cited string, D = DEFAULT_FILTERS default. Pass-2
// additions: t1 shows the full 20-step done state (counts S); t2 carries the
// NTAP expanded dive (S); 05 COMMIT is the Trade Commit Workflow from the
// Books CODE surface (S) — the IN BOOKS → chip retired with the journal-only
// drawing; 06 RECORD adds the record line, grade chips and the per-trade
// detail affordance (S). Gold-law additions: $270 · $730 · $1.01 · $12.78 ·
// $11.77 (money moments).
//
// TRADE-REALITY-3 (reality pass 3): 06 RECORD shows the per-trade detail
// EXPANDED — the toggle's real expanded-state string ("Hide per-trade detail
// (8)") + the 8 per-trade rows [S] from the production Record screenshot,
// 2026-08-18; both money columns (claimed max loss · actual P&L) wear the
// money gold (the pass-1 precedent — max loss is money); "Open"/"—" muted.
// The grade-chips row retired 2026-08-18 — grades now shown per-trade in the
// expanded table's GRADE column; the app's amber grade chips normalize to
// the bordered bg-row neutral (the declared palette rule). Mobile-yield
// (pass-3 commit 1): every fixed/nowrap text span in this block shrinks and
// wraps below lg (min-w-0 shrink / whitespace-normal), byte-identical at lg.
const tradeGlimpses: ReadonlyArray<ReactNode> = [
  /* ── 01 Filter (pass-2 name; drawing unchanged) — the REAL scan form,
     miniaturized. Controls + strings ⇐
     ScanFilterForm.tsx (:41 universes, :77-80 Direction, :88-91 Premium,
     :99-102 Risk, :108-126 DTE/Width $, :133-151 liquidity + edge rows,
     :158-178 strategies, :183-186 Scan); chip states = toggleChip/SEGMENT
     (ds.ts :113-117/:147-155); every value = DEFAULT_FILTERS (filter-types.ts
     :53-78 — DTE 30—60 and Width $ 1—10 ARE the defaults); the 16 chips =
     AVAILABLE_STRATEGIES (filter-types.ts :85-102), all active at the default
     empty selection (:166) hence "(all)" and no Reset all (:158-159). ── */
  <div key="t0" className={SHELL}>
    <div className={HEADER}><span className={HL}>FILTER</span><span className={HR}>YOUR RULES</span></div>
    <div className="mx-4 mt-1 space-y-1">
      <div className="flex flex-wrap items-center gap-1 font-mono text-[8.5px] leading-none">
        <span className="rounded-sm bg-brand-purple px-1.5 py-[3px] text-white">S&amp;P 500</span>
        <span className="rounded-sm border border-brand-purple/40 px-1.5 py-[3px] text-brand-purple">Nasdaq 100</span>
        {([
          { cells: ['All', 'Bull', 'Bear', 'Ntrl'], on: 0 },
          { cells: ['SELL', 'BUY', 'Both'], on: 2 },
          { cells: ['Defined', 'Unlimited'], on: 0 },
        ] as const).map((seg) => (
          <span key={seg.cells[0]} className="inline-flex items-center gap-px rounded-sm bg-bg-row p-[2px]">
            {seg.cells.map((cell, ci) => (
              <span key={cell} className={`rounded-sm px-1 py-[2px] ${ci === seg.on ? 'bg-white font-medium text-brand-purple' : 'text-text-secondary'}`}>{cell}</span>
            ))}
          </span>
        ))}
        <span className="rounded-sm border border-border bg-ts-white px-1.5 py-[3px] text-text-primary"><span className="text-text-faint">DTE </span>30 — 60</span>
        <span className="rounded-sm border border-border bg-ts-white px-1.5 py-[3px] text-text-primary"><span className="text-text-faint">Width $ </span>1 — 10</span>
      </div>
      <div className="grid grid-cols-2 gap-x-4">
        <div>
          <div className="mb-[3px] font-mono text-[8.5px] uppercase tracking-wider text-text-muted">Liquidity gates</div>
          {([
            ['Min OI', 'w-[3%]', '100'],
            ['Max Spread', 'w-[20%]', '10%'],
            ['Min Volume', 'w-[5%]', '500K'],
          ] as const).map(([lab, w, val]) => (
            <div key={lab} className="flex h-[11px] items-center gap-1.5">
              <span className="w-[52px] min-w-0 shrink text-[8.5px] font-medium text-text-secondary lg:shrink-0">{lab}</span>
              <span className="relative h-[3px] min-w-0 flex-1 rounded bg-border-light"><span className={`absolute inset-y-0 left-0 rounded bg-brand-purple ${w}`} /></span>
              <span className="w-[26px] min-w-0 shrink text-right font-mono text-[8.5px] font-semibold text-text-primary lg:shrink-0">{val}</span>
            </div>
          ))}
          <div className="flex h-[11px] items-center gap-1.5">
            <span className="w-[52px] min-w-0 shrink text-[8.5px] font-medium text-text-secondary lg:shrink-0">Min Rating</span>
            <span className="text-[11px] leading-none tracking-[0.1em]"><span className="text-text-secondary">**</span><span className="text-text-faint">***</span></span>
          </div>
        </div>
        <div>
          <div className="mb-[3px] font-mono text-[8.5px] uppercase tracking-wider text-text-muted">Edge metrics</div>
          {([
            ['Min PoP', 'w-[50%]', '50%'],
            ['Min EV', 'w-[33%]', '$0'],
            ['Min EV/Risk', 'w-[50%]', '0.00'],
          ] as const).map(([lab, w, val]) => (
            <div key={lab} className="flex h-[11px] items-center gap-1.5">
              <span className="w-[56px] min-w-0 shrink text-[8.5px] font-medium text-text-secondary lg:shrink-0">{lab}</span>
              <span className="relative h-[3px] min-w-0 flex-1 rounded bg-border-light"><span className={`absolute inset-y-0 left-0 rounded bg-brand-purple ${w}`} /></span>
              <span className="w-[26px] min-w-0 shrink text-right font-mono text-[8.5px] font-semibold text-text-primary lg:shrink-0">{val}</span>
            </div>
          ))}
          <div className="flex h-[11px] items-center gap-1.5">
            <span className="w-[56px] min-w-0 shrink text-[8.5px] font-medium text-text-secondary lg:shrink-0">Vol Edge</span>
            <span className="inline-flex items-center gap-px rounded-sm bg-bg-row p-[2px] font-mono text-[8px] leading-none">
              {(['IV>HV', 'IV<HV', 'Any'] as const).map((cell) => (
                <span key={cell} className={`rounded-sm px-1 py-[2px] ${cell === 'Any' ? 'bg-white font-medium text-brand-purple' : 'text-text-secondary'}`}>{cell}</span>
              ))}
            </span>
          </div>
          {([
            ['Min IV Rank', 'w-[2%]', '0%'],
            ['Sentiment', 'w-[2%]', '-1.0'],
          ] as const).map(([lab, w, val]) => (
            <div key={lab} className="flex h-[11px] items-center gap-1.5">
              <span className="w-[56px] min-w-0 shrink text-[8.5px] font-medium text-text-secondary lg:shrink-0">{lab}</span>
              <span className="relative h-[3px] min-w-0 flex-1 rounded bg-border-light"><span className={`absolute inset-y-0 left-0 rounded bg-brand-purple ${w}`} /></span>
              <span className="w-[26px] min-w-0 shrink text-right font-mono text-[8.5px] font-semibold text-text-primary lg:shrink-0">{val}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="font-mono text-[8.5px] uppercase tracking-wider text-text-muted">Strategies (all)</div>
        <div className="mt-[3px] flex flex-wrap gap-[3px]">
          {([
            'Iron Condor', 'Put Credit Spread', 'Call Credit Spread', 'Short Strangle',
            'Short Straddle', 'Jade Lizard', 'Bull Call Spread', 'Bear Call Spread',
            'Bear Put Spread', 'Bull Put Spread', 'Long Straddle', 'Long Strangle',
            'Debit Spread', 'Calendar Spread', 'Diagonal Spread', 'Iron Butterfly',
          ] as const).map((s) => (
            <span key={s} className="rounded-sm bg-brand-purple px-1 py-[2px] font-mono text-[8px] leading-none text-white">{s}</span>
          ))}
        </div>
      </div>
      <div className="flex justify-end">
        <span className="rounded bg-brand-purple px-4 py-[3px] text-[9px] font-bold leading-none text-white">Scan</span>
      </div>
    </div>
    <div className={FOOT}><span className="text-text-primary">THE SCAN OBEYS THESE</span><span className="text-text-muted">ALWAYS</span></div>
  </div>,
  /* ── 02 Scan — the REAL Pipeline Flow ledger: one row per rendered step
     section of ConvergenceIntelligence.tsx, chip + title verbatim (C — STEP A
     :1641-1642 … STEP T :4286-4287; the on-screen letters run A–T; "A2"
     exists only in a code comment, :1825). Pass 2: the full DONE state —
     every count line supplied verbatim (S, one production run); ▼ = the
     collapsed toggle (:1652). Density: 20 rows × 10.5px pitch = 210px in
     the ≈222px body — fits; counts render whole (nowrap), titles carry the
     ellipsis guard at width. ── */
  <div key="t1" className={SHELL}>
    <div className={HEADER}><span className={HL}>SCAN</span><span className={HR}>THE PIPELINE RUNS</span></div>
    <div className="mx-4 mt-1">
      {([
        ['STEP A', 'TT Scanner — Universe Scan', '473 symbols fetched'],
        ['STEP B', 'Pre-Filter', '473 → 473 survived'],
        ['STEP C', 'Hard Exclusions', '94 excluded — 379 passed'],
        ['STEP D', 'Top-N Selection', '473 → 18 candidates for hard filters'],
        ['STEP E', 'Hard Filters', '18 → 17 survived'],
        ['STEP F', 'Peer Grouping', 'Finnhub peer relationships mapped'],
        ['STEP G', 'Pre-Score', '17 → 17 selected for enrichment'],
        ['STEP H', 'Macro & Regime Data', '10 FRED series fetched'],
        ['STEP I', 'Data Enrichment', '136 Finnhub calls'],
        ['STEP J', 'Candle Data & Cross-Asset Correlations', '17 of 17 symbols have candle data'],
        ['STEP K', '4-Gate Scoring', '17 tickers scored'],
        ['STEP L', 'Re-Score With Technicals', '17 of 17 tickers re-scored with candle technicals'],
        ['STEP M', 'Final Selection', '8 of 17 tickers selected'],
        ['STEP N', 'Chain Fetch', '320 strikes fetched across 8 tickers — 320 Greeks events received'],
        ['STEP O', 'Live Greeks Subscription', '320 Greeks events received across 8 symbols'],
        ['STEP P', 'Strategy Scoring', '4 strategies passed all 3 gates'],
        ['STEP Q', 'Live Options Flow & GEX', '8 tickers with live flow data'],
        ['STEP R', 'Re-Score With Live Data', '8 of 8 tickers re-scored with live flow data'],
        ['STEP S', 'Trade Cards', '4 strategies generated'],
        ['STEP T', 'Save & Return', 'Scan saved — 8 tickers logged'],
      ] as const).map(([step, title, count]) => (
        <div key={step} className="flex items-baseline gap-2 font-mono text-[9px] leading-[10.5px]">
          <span className="w-[36px] min-w-0 shrink font-semibold text-brand-purple lg:shrink-0">{step}</span>
          <span className="min-w-0 flex-1 truncate text-text-secondary">{title}</span>
          <span className="min-w-0 shrink whitespace-normal text-right text-text-secondary lg:shrink-0 lg:whitespace-nowrap">{count}</span>
          <span aria-hidden="true" className="min-w-0 shrink text-[7px] text-text-faint lg:shrink-0">▼</span>
        </div>
      ))}
    </div>
    <div className={FOOT}><span className="text-text-primary">EVERY STEP COUNTED</span><span className="text-text-muted">NOTHING HIDDEN</span></div>
  </div>,
  /* ── 03 Review — the REAL results-table anatomy (ScannerResultsTable.tsx):
     ticker cell mono-bold purple (:677); strategy (:681-682, the no-card row's
     italic "—"); Premium = entryText "Collect $278" (:456); PoP = fmtPct
     (:109-112 → "92.0%", the row's font-black anchor :694); EV "+$64" (:704);
     TRADE chip (:712) / SKIP chip (:714) + the stored reason uppercased
     (:717 — 'No strategies available' :446). Gate vocabulary only — the real
     scoring speaks "N/4 gates" (ConvergenceIntelligence :673, :3189), and no
     invented "filters" phrasing appears here. Pass 2: the NTAP expanded dive
     (S — the four gate scores, the four legs, the collect/max-loss line);
     gold only on $270/$730/+$64 and the row's $278. ── */
  <div key="t2" className={SHELL}>
    <div className={HEADER}><span className={HL}>VERDICTS</span><span className={HR}>WITH REASONS</span></div>
    <div className={ROW}>
      <span className="w-[44px] min-w-0 shrink font-mono text-[13px] font-bold text-brand-purple lg:shrink-0">NTAP</span>
      <span className="min-w-0 flex-1 truncate text-[12px] text-text-secondary">Iron Condor</span>
      <span className="min-w-0 shrink font-mono text-[11px] font-medium text-brand-gold lg:shrink-0">Collect $278</span>
      <span className="min-w-0 shrink font-mono text-[11px] font-black text-text-primary lg:shrink-0">92.0%</span>
      <span className="min-w-0 shrink font-mono text-[11px] font-medium text-brand-gold lg:shrink-0">+$64</span>
      <span className={`${CHIP} min-w-0 shrink border-brand-purple bg-brand-purple font-bold text-white lg:shrink-0`}>TRADE</span>
    </div>
    <div className="mx-4 mb-1.5 border border-border-light bg-bg-row px-2.5 py-1.5 font-mono text-[8.5px] leading-[1.7] text-text-secondary">
      <div>VOL EDGE <span className="font-semibold text-text-primary">65.2</span> · QUALITY <span className="font-semibold text-text-primary">64.7</span> · REGIME <span className="font-semibold text-text-primary">67.7</span> · INFO <span className="font-semibold text-text-primary">48.7</span></div>
      <div>SELL PUT $185 $5.60 / BUY PUT $175 $3.80 / SELL CALL $240 $4.20 / BUY CALL $250 $3.30</div>
      <div>COLLECT <span className="font-semibold text-brand-gold">$270</span> · MAX LOSS <span className="font-semibold text-brand-gold">$730</span> · POP 92.0% · EV <span className="font-semibold text-brand-gold">+$64</span> · R:R 0.37</div>
    </div>
    <div className={ROW}>
      <span className="w-[44px] min-w-0 shrink font-mono text-[13px] font-bold text-brand-purple lg:shrink-0">NWS</span>
      <span className="min-w-0 shrink text-[12px] italic text-text-muted lg:shrink-0">—</span>
      <span className={`${CHIP} min-w-0 shrink border-border bg-bg-row font-bold text-text-muted lg:shrink-0`}>SKIP</span>
      <span className="min-w-0 flex-1 truncate font-mono text-[9px] tracking-wider text-text-faint">NO STRATEGIES AVAILABLE</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">SKIPS SHOW THEIR WHY</span><span className="text-text-muted">PICK OR PASS — YOURS</span></div>
  </div>,
  /* ── 04 Lab — the REAL lab scorecard (TradeLabPanel.tsx): the Predicted
     column labels + formats (:638-654 — Max Profit / Max Loss / Est. PoP
     .toFixed(1)% / R:R .toFixed(2)); the unlinked Actual column verbatim
     ("Not yet linked to a position", :703-704); the "Link to Position"
     action (:540). $520/$980 wear the money gold (law); the real UI's
     green/red on them is declared-normalized. ── */
  <div key="t3" className={SHELL}>
    <div className={HEADER}><span className={HL}>THE LAB</span><span className={HR}>LINK + GRADE</span></div>
    <div className="mx-4 mt-1 border border-border bg-white px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate"><span className="font-mono text-[13px] font-bold text-brand-purple">META</span><span className="ml-2 text-[12px] text-text-secondary">Iron Condor</span></span>
        <span className={`${CHIP} min-w-0 shrink border-brand-purple bg-ts-white text-brand-purple lg:shrink-0`}>Link to Position</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-4 border-t border-border-light pt-2">
        <div>
          <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-text-muted">Predicted</div>
          {([
            ['Max Profit', '$520', 'text-brand-gold'],
            ['Max Loss', '$980', 'text-brand-gold'],
            ['Est. PoP', '62.0%', 'text-text-secondary'],
            ['R:R', '0.53', 'text-text-secondary'],
          ] as const).map(([lab, val, tone]) => (
            <div key={lab} className="mt-1 flex items-baseline justify-between gap-2">
              <span className="text-[10.5px] text-text-muted">{lab}</span>
              <span className={`font-mono text-[11px] font-bold ${tone}`}>{val}</span>
            </div>
          ))}
        </div>
        <div>
          <div className="font-mono text-[9px] font-bold uppercase tracking-wider text-text-muted">Actual</div>
          <div className="mt-1 text-[10.5px] leading-[1.5] text-text-faint">Not yet linked to a position</div>
        </div>
      </div>
    </div>
    <div className={FOOT}><span className="text-text-primary">GRADED BEFORE MONEY MOVES</span><span className="text-text-muted">THE SETUP, TESTED</span></div>
  </div>,
  /* ── 05 Commit (pass 2 — replaces the journal-only drawing; the IN BOOKS →
     chip retired with it): the Trade Commit Workflow from the Books CODE
     surface (S — title row + counts, the commit bar with Net and the Open
     Position action, the two leg rows; NO strategy dropdown drawn, per spec).
     The DR/CR journal pair retained beneath, recaptioned WHAT IT WRITES.
     Gold: $1.01 and the leg amounts $12.78/$11.77 (money moments); the
     Open Position button is aubergine. ── */
  <div key="t5" className={SHELL}>
    <div className={HEADER}><span className={HL}>COMMIT</span><span className={HR}>ONE CLICK</span></div>
    <div className="mx-4 mt-1 flex flex-wrap items-baseline justify-between gap-x-2">
      <span className="font-mono text-[10px] tracking-[0.12em] text-text-secondary">Trade Commit Workflow</span>
      <span className="font-mono text-[8.5px] text-text-faint">488 opens · 372 closes · 2 open trades</span>
    </div>
    <div className="mx-4 mt-1.5 flex flex-wrap items-center justify-between gap-2 border border-border bg-bg-row px-2.5 py-1.5 font-mono text-[9px]">
      <span className="min-w-0 truncate text-text-secondary">2 legs selected · Net: <span className="font-semibold text-brand-gold">$1.01</span> DR · MSFT-0013</span>
      <span className="min-w-0 shrink rounded bg-brand-purple px-2 py-[3px] text-[8.5px] font-bold leading-none text-white lg:shrink-0">Open Position</span>
    </div>
    <div className="mx-4 mt-1 font-mono text-[9px] leading-[1.8] text-text-secondary">
      <div className="flex items-baseline justify-between gap-2"><span className="min-w-0 truncate">Mar 1 MSFT BUY $500 CALL · 1</span><span className="min-w-0 shrink lg:shrink-0"><span className="font-medium text-brand-gold">$12.78</span> DR</span></div>
      <div className="flex items-baseline justify-between gap-2"><span className="min-w-0 truncate">Mar 1 MSFT SELL $505 CALL · 1</span><span className="min-w-0 shrink lg:shrink-0"><span className="font-medium text-brand-gold">$11.77</span> CR</span></div>
    </div>
    <div className="mx-4 mt-1.5 border border-border bg-white px-4 py-2">
      <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">WHAT IT WRITES</div>
      <div className="mt-1.5 flex items-baseline justify-between font-mono text-[12px] text-text-secondary"><span>DR · Brokerage cash</span><span>$120.00</span></div>
      <div className="flex items-baseline justify-between font-mono text-[12px] text-text-secondary"><span>CR · Trading gains (4100)</span><span>$120.00</span></div>
    </div>
    <div className={FOOT}><span className="text-text-primary">A REAL JOURNAL ENTRY</span><span className="text-text-muted">SAME LEDGER AS EVERYTHING</span></div>
  </div>,
  /* ── 06 Record (now terminal) — the REAL track-record heroes
     (TradeRecord.tsx): the three tiles verbatim — RECORD "{w}W – {l}L –
     {be}BE" (:192-193), NET P&L + "(linked trades only)" (:208-210),
     MAX-LOSS INTEGRITY "{x} of {y}" (:216-217) — plus the sync-coverage
     line (CoverageDeclaration.tsx :103, drawn truncated to the spec figure;
     the real string continues "· N unlinked — details"). $82 wears the money
     gold (law). Pass 2 adds (S): the record line (the :242-244 quiet-line
     template at the supplied figures). Pass 3: the per-trade detail draws
     EXPANDED — the toggle's real expanded-state string + the 8-row table
     [S], 9px pitch (the t1 miniature idiom); the grade-chips row retired
     2026-08-18 — grades now shown per-trade in the GRADE column. ── */
  <div key="t4" className={SHELL}>
    <div className={HEADER}><span className={HL}>THE RECORD</span><span className={HR}>WINS AND LOSSES</span></div>
    <div className="mx-4 mt-1 grid grid-cols-3 gap-2">
      {([
        ['RECORD', '7W – 0L – 0BE', 'text-text-primary', null],
        ['NET P&L', '$82', 'text-brand-gold', '(linked trades only)'],
        ['MAX-LOSS INTEGRITY', '7 of 7', 'text-text-primary', null],
      ] as const).map(([lab, val, tone, sub]) => (
        <div key={lab} className="min-w-0 rounded border border-border bg-bg-row px-2 py-2">
          <div className="truncate font-mono text-[8px] uppercase tracking-wider text-text-faint">{lab}</div>
          <div className={`mt-1 truncate font-mono text-[13.5px] font-bold ${tone}`}>{val}</div>
          {sub && <div className="mt-0.5 truncate text-[8.5px] text-text-faint">{sub}</div>}
        </div>
      ))}
    </div>
    <div className="mx-4 mt-1.5 font-mono text-[10.5px] text-text-faint">Sync coverage: 952 transactions</div>
    <div className="mx-4 mt-1 font-mono text-[9px] leading-[1.5] text-text-faint">Record: <span className="font-semibold text-text-primary">8</span> linked trades · <span className="font-semibold text-text-primary">4</span> closed positions unlinked (excluded) · <span className="font-semibold text-text-primary">4</span> cards queued, not yet linked</div>
    <div className="mx-4 mt-1 font-mono text-[9.5px] text-brand-purple">Hide per-trade detail (8)</div>
    <div className="mx-4 mt-[3px]">
      <div className="flex h-[9px] items-center gap-2 font-mono text-[7.5px] uppercase tracking-wider text-text-faint">
        <span className="w-[34px] min-w-0 shrink lg:shrink-0">Symbol</span>
        <span className="min-w-0 flex-1 truncate">Generated</span>
        <span className="w-[62px] min-w-0 shrink text-right lg:shrink-0">Claimed max loss</span>
        <span className="w-[38px] min-w-0 shrink text-right lg:shrink-0">Actual P&amp;L</span>
        <span className="w-[22px] min-w-0 shrink text-right lg:shrink-0">Grade</span>
      </div>
      {([
        ['PYPL', '2026-03-23', '-$186', '$6', 'C'],
        ['PYPL', '2026-03-20', '-$151', '$6', 'C'],
        ['META', '2026-03-31', '-$1,035', '$7', 'C'],
        ['NFLX', '2026-03-17', '-$144', '$10', 'C'],
        ['CTSH', '2026-03-11', '-$175', '$10', 'C'],
        ['MSFT', '2026-03-09', '-$316', '$18', 'C'],
        ['MSFT', '2026-03-10', '-$482', '$25', 'C'],
        ['MSFT', '2026-04-02', '-$321', 'Open', null],
      ] as const).map(([sym, gen, maxLoss, pl, grade]) => (
        <div key={`${sym}-${gen}`} className="flex h-[9px] items-center gap-2 font-mono text-[8px] leading-none">
          <span className="w-[34px] min-w-0 shrink font-bold text-text-primary lg:shrink-0">{sym}</span>
          <span className="min-w-0 flex-1 truncate text-text-muted">{gen}</span>
          <span className="w-[62px] min-w-0 shrink text-right font-medium text-brand-gold lg:shrink-0">{maxLoss}</span>
          <span className={`w-[38px] min-w-0 shrink text-right font-medium lg:shrink-0 ${pl === 'Open' ? 'text-text-muted' : 'text-brand-gold'}`}>{pl}</span>
          <span className="w-[22px] min-w-0 shrink text-right lg:shrink-0">
            {grade ? <span className="inline-block rounded-sm border border-border bg-bg-row px-1 font-mono text-[7px] leading-[7px] text-text-muted">{grade}</span> : <span className="text-text-muted">—</span>}
          </span>
        </div>
      ))}
    </div>
    <div className={FOOT}><span className="text-text-primary">EVERY RESULT WRITTEN DOWN</span><span className="text-text-muted">NO CHERRY-PICKING</span></div>
  </div>,
];


// ─── BATCH 3 (books · compliance · tax) — same law as batch 2: the ledger's
// GLIMPSE clause is the manifest, the shared grammar above is the kit, real
// app vocabulary where it exists (the manual-entry affordance, the coding
// queue, debits = credits, the reports set, "Export All", entities +
// jurisdictions, documents · chunks, VERIFY CHAIN → VALID, auto-detected
// tags, "derived, not typed", Schedule C/D + 8949). [IN BUILD] COEXISTENCE
// (declared, path B): the stage's surface chip lives INSIDE the placeholder
// branch (Landing.tsx :1043) and cannot render over art — so Compliance 04 +
// 05 carry the spec's muted chip INSIDE their drawings (same anatomy
// classes), and their interiors are drawn in the DESIGN-INTENT register
// (dashed previews, em-dash values) — clearly a preview, never fake live
// data. Green/red stay drawing-internal (the token law). ──────────────────

const booksGlimpses: ReadonlyArray<ReactNode> = [
  /* 01 Feed — source accounts + the manual-entry row (the no-Plaid path) */
  <div key="b0" className={SHELL}>
    <div className={HEADER}><span className={HL}>SOURCE ACCOUNTS</span><span className={HR}>THE FEED</span></div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">Chase Checking ···· 4821</span>
      <span className="font-mono text-[11px] tracking-[0.1em] text-[#16a34a]">SYNCED ✓</span>
    </div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[13px] text-text-muted">No bank connection? Add transactions manually</span>
      <span className={`${CHIP} border-brand-purple bg-brand-purple text-white`}>+ ADD</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">EVERY REAL TRANSACTION</span><span className="text-text-muted">ON ITS OWN</span></div>
  </div>,
  /* 02 Code — the coding queue */
  <div key="b1" className={SHELL}>
    <div className={HEADER}><span className={HL}>THE CODING QUEUE</span><span className={HR}>YOU CONFIRM</span></div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">TRADER JOE&apos;S · $84.12</span>
      <span className={`${CHIP} border-brand-purple bg-brand-purple-wash text-brand-purple`}>GROCERIES ✓</span>
    </div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">SHELL OIL · $61.40</span>
      <span className={`${CHIP} border-border bg-ts-white text-brand-purple`}>FUEL — CONFIRM?</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">PROPOSED, NEVER SILENT</span><span className="text-text-muted">YOU STAY THE BOSS</span></div>
  </div>,
  /* 03 Reconcile — book vs bank, differences named */
  <div key="b2" className={SHELL}>
    <div className={HEADER}><span className={HL}>RECONCILE</span><span className={HR}>BOOK VS BANK</span></div>
    <div className="mx-4 mt-1 grid grid-cols-2 gap-2">
      <div className="border border-border bg-white px-3 py-2.5 text-center">
        <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">BOOK TOTAL</div>
        <div className="mt-1 font-mono text-[16px] font-semibold text-text-primary">$4,211.52</div>
      </div>
      <div className="border border-border bg-white px-3 py-2.5 text-center">
        <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">BANK TOTAL</div>
        <div className="mt-1 font-mono text-[16px] font-semibold text-text-primary">$4,186.52</div>
      </div>
    </div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[13px] text-text-primary">Pending card hold · not yet posted</span>
      <span className="font-mono text-[12.5px] font-medium text-brand-gold">$25.00</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">DIFFERENCES GET NAMED</span><span className="text-text-muted">NEVER PAPERED OVER</span></div>
  </div>,
  /* 04 Close — DEBITS = CREDITS ✓ (the refuses-to-lie close) */
  <div key="b3" className={SHELL}>
    <div className={HEADER}><span className={HL}>PERIOD CLOSE</span><span className={HR}>JULY</span></div>
    <div className="mx-4 mt-4 flex flex-1 flex-col items-center justify-center border border-border-light bg-ts-white px-6 py-6 text-center">
      <span className="font-mono text-[20px] font-semibold tracking-[0.08em] text-text-primary">DEBITS = CREDITS <span className="text-[#16a34a]">✓</span></span>
      <span className={`${CHIP} mt-3 border-brand-purple bg-brand-purple text-white`}>PERIOD LOCKED</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">BALANCED — OR IT REFUSES</span><span className="text-text-muted">NO EXCEPTIONS</span></div>
  </div>,
  /* 05 Reports — the reports grid */
  <div key="b4" className={SHELL}>
    <div className={HEADER}><span className={HL}>REPORTS</span><span className={HR}>BUILT FROM THE LEDGER</span></div>
    <div className="mx-4 mt-1 grid flex-1 grid-cols-2 gap-2 pb-3">
      {['TRIAL BALANCE', 'INCOME STATEMENT', 'BALANCE SHEET', 'GENERAL LEDGER'].map((r) => (
        <div key={r} className="flex items-center justify-center border border-border bg-white px-2 py-3 text-center font-mono text-[11px] tracking-[0.1em] text-brand-purple">{r}</div>
      ))}
    </div>
    <div className={FOOT}><span className="text-text-primary">THE FULL SET</span><span className="text-text-muted">READ THEM ANYTIME</span></div>
  </div>,
  /* 06 Export — "Export All" */
  <div key="b5" className={SHELL}>
    <div className={HEADER}><span className={HL}>CPA EXPORT</span><span className={HR}>ONE CLICK</span></div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-text-secondary">journal-entries.csv · ledger.csv · accounts.csv</span>
    </div>
    <div className="mx-4 mt-3 flex justify-center">
      <span className="inline-block bg-brand-purple px-4 py-2 font-mono text-[12px] font-semibold tracking-[0.1em] text-white">EXPORT ALL</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">ACCOUNTANT-READY CSVS</span><span className="text-text-muted">YOURS, NEVER PAYWALLED</span></div>
  </div>,
];

const complianceGlimpses: ReadonlyArray<ReactNode> = [
  /* 01 Profile — entities + jurisdictions */
  <div key="c0" className={SHELL}>
    <div className={HEADER}><span className={HL}>PROFILE</span><span className={HR}>WHO · WHERE</span></div>
    <div className="mx-4 mt-1 border border-border bg-white px-4 py-3.5">
      <div className="grid grid-cols-2 gap-2 sm:gap-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">ENTITIES</div>
          <div className="mt-1.5 border border-border bg-ts-white px-2.5 py-2 text-[13px] text-text-primary">Personal · Workshop LLC</div>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">JURISDICTIONS</div>
          <div className="mt-1.5 border border-border bg-ts-white px-2.5 py-2 font-mono text-[12px] text-text-secondary">US-OR · PT</div>
        </div>
      </div>
    </div>
    <div className={FOOT}><span className="text-text-primary">EVERY CHECK RUNS AGAINST THIS</span><span className="text-text-muted">THE PROFILE</span></div>
  </div>,
  /* 02 Corpus — documents · chunks */
  <div key="c1" className={SHELL}>
    <div className={HEADER}><span className={HL}>THE CORPUS</span><span className={HR}>THE RULEBOOKS</span></div>
    <div className="mx-4 mt-1 grid flex-1 grid-cols-2 gap-2 pb-3">
      <div className="flex flex-col items-center justify-center border border-border bg-white px-3 py-4">
        <span className="font-mono text-[10px] tracking-[0.12em] text-text-muted">DOCUMENTS</span>
        <span className="mt-1 font-mono text-[26px] font-medium text-brand-purple">128</span>
      </div>
      <div className="flex flex-col items-center justify-center border border-border bg-white px-3 py-4">
        <span className="font-mono text-[10px] tracking-[0.12em] text-text-muted">CHUNKS</span>
        <span className="mt-1 font-mono text-[26px] font-medium text-brand-purple">5,214</span>
      </div>
    </div>
    <div className={FOOT}><span className="text-text-primary">STORED + SEARCHABLE</span><span className="text-text-muted">THE LIBRARY</span></div>
  </div>,
  /* 03 Retrieve — the retrieval search */
  <div key="c2" className={SHELL}>
    <div className={HEADER}><span className={HL}>RETRIEVE</span><span className={HR}>PLAIN WORDS IN</span></div>
    <div className="mx-4 mt-1 border border-border bg-white px-3 py-2 font-mono text-[12px] text-text-secondary">do I need a license to sell furniture in Oregon?</div>
    <div className="mx-4 mt-2 border border-border-light bg-ts-white px-3 py-2.5">
      <p className="text-[12.5px] leading-[1.6] text-text-primary">…retail sales of finished goods do not require a state seller&apos;s permit; local business registration applies…</p>
      <p className="mt-1 font-mono text-[10px] tracking-[0.1em] text-text-faint">OR. ADMIN. R. · CH 150 · §2</p>
    </div>
    <div className={FOOT}><span className="text-text-primary">THE PASSAGE, RETURNED</span><span className="text-text-muted">WITH ITS SOURCE</span></div>
  </div>,
  /* 04 Discover — the launcher, marked IN BUILD (path B: the chip rides
     INSIDE the drawing; design-intent register — dashed, em-dash values) */
  <div key="c3" className={SHELL}>
    <div className={HEADER}><span className={HL}>DISCOVER</span><span className="flex items-baseline gap-2"><span className={HR}>THE LAUNCHER</span><span className="rounded border border-border bg-bg-row px-1.5 font-mono text-[10px] tracking-[0.1em] text-text-faint">IN BUILD</span></span></div>
    <div className="mx-4 mt-4 flex flex-1 flex-col items-center justify-center border border-dashed border-border bg-ts-white px-6 py-6 text-center">
      <span className="inline-block border border-dashed border-border px-4 py-2 font-mono text-[12px] tracking-[0.1em] text-text-muted">RUN DISCOVERY</span>
      <span className="mt-3 text-[12.5px] leading-[1.6] text-text-muted">Scans your profile against the corpus for gaps — being built now.</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">FINDINGS TO VERIFY</span><span className="text-text-muted">BEING BUILT NOW</span></div>
  </div>,
  /* 05 Verify — the 8-step badge design, marked IN BUILD (path B) */
  <div key="c4" className={SHELL}>
    <div className={HEADER}><span className={HL}>VERIFY</span><span className="flex items-baseline gap-2"><span className={HR}>8 CHECKS PER CITATION</span><span className="rounded border border-border bg-bg-row px-1.5 font-mono text-[10px] tracking-[0.1em] text-text-faint">IN BUILD</span></span></div>
    <div className="mx-4 mt-4 flex flex-1 flex-col items-center justify-center border border-dashed border-border bg-ts-white px-6 py-6 text-center">
      <span className="flex gap-1.5">
        {Array.from({ length: 8 }, (_, i) => (
          <span key={i} className="flex h-[22px] w-[22px] items-center justify-center border border-dashed border-border font-mono text-[10px] text-text-faint">{i + 1}</span>
        ))}
      </span>
      <span className="mt-3 text-[12.5px] leading-[1.6] text-text-muted">Each citation checked 8 ways before it counts — being built now.</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">VERIFIED FINDINGS ONLY</span><span className="text-text-muted">BEING BUILT NOW</span></div>
  </div>,
  /* 06 Register — the audit tail + VERIFY CHAIN → VALID */
  <div key="c5" className={SHELL}>
    <div className={HEADER}><span className={HL}>THE REGISTER</span><span className={HR}>HASH-CHAINED</span></div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-text-secondary">a41f…9c02 · period closed · JUL 31</span>
    </div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-text-secondary">7be3…d114 · export issued · AUG 2</span>
    </div>
    <div className="mx-4 mt-3 flex items-center justify-center gap-2 border border-border-light bg-ts-white px-4 py-2.5">
      <span className="font-mono text-[12px] tracking-[0.1em] text-text-primary">VERIFY CHAIN →</span>
      <span className="font-mono text-[12px] font-semibold tracking-[0.1em] text-[#16a34a]">VALID</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">CHANGE ONE RECORD</span><span className="text-text-muted">AND THE CHAIN SCREAMS</span></div>
  </div>,
];

const taxGlimpses: ReadonlyArray<ReactNode> = [
  /* 01 Life events — the checklist with auto-detected tags */
  <div key="x0" className={SHELL}>
    <div className={HEADER}><span className={HL}>LIFE EVENTS</span><span className={HR}>WHAT HAPPENED THIS YEAR</span></div>
    <div className={ROW}>
      <span className="w-5 font-mono text-[14px] text-[#16a34a]">✓</span>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">Side business income</span>
      <span className={`${CHIP} border-brand-purple bg-brand-purple-wash text-brand-purple`}>AUTO-DETECTED</span>
    </div>
    <div className={ROW}>
      <span className="w-5 font-mono text-[14px] text-[#16a34a]">✓</span>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">Investment activity</span>
      <span className={`${CHIP} border-brand-purple bg-brand-purple-wash text-brand-purple`}>AUTO-DETECTED</span>
    </div>
    <div className={ROW}>
      <span className="w-5 font-mono text-[14px] text-text-faint">○</span>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-muted">Bought or sold a home</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">YOUR BOOKS ALREADY PROVE IT</span><span className="text-text-muted">TICK THE REST</span></div>
  </div>,
  /* 02 Documents — the paper trail */
  <div key="x1" className={SHELL}>
    <div className={HEADER}><span className={HL}>DOCUMENTS</span><span className={HR}>THE PAPER TRAIL</span></div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">W-2 · employer</span>
      <span className="font-mono text-[11px] tracking-[0.1em] text-[#16a34a]">UPLOADED ✓</span>
    </div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-muted">1099-B · broker</span>
      <span className="font-mono text-[11px] tracking-[0.1em] text-text-faint">WAITING</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">ONLY WHAT CAN&apos;T BE DERIVED</span><span className="text-text-muted">THE APP HOLDS THE REST</span></div>
  </div>,
  /* 03 Income — FROM YOUR CLOSED BOOKS — DERIVED, NOT TYPED */
  <div key="x2" className={SHELL}>
    <div className={HEADER}><span className={HL}>INCOME</span><span className={HR}>CONFIRM</span></div>
    <div className="mx-4 mt-1 border border-brand-purple/30 bg-brand-purple-wash px-3 py-1.5 text-center font-mono text-[11px] tracking-[0.12em] text-brand-purple">FROM YOUR CLOSED BOOKS — DERIVED, NOT TYPED</div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">Wages</span>
      <span className="font-mono text-[12.5px] font-medium text-brand-gold">$52,400</span>
    </div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">Workshop income</span>
      <span className="font-mono text-[12.5px] font-medium text-brand-gold">$9,180</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">THE LEDGER IS THE SOURCE</span><span className="text-text-muted">YOU JUST CONFIRM</span></div>
  </div>,
  /* 04 Deductions — Schedule C from coded expenses */
  <div key="x3" className={SHELL}>
    <div className={HEADER}><span className={HL}>DEDUCTIONS</span><span className={HR}>SCHEDULE C</span></div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">Supplies (coded all year)</span>
      <span className="font-mono text-[12.5px] font-medium text-brand-gold">$2,140</span>
    </div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">Vehicle · service + fuel</span>
      <span className="font-mono text-[12.5px] font-medium text-brand-gold">$1,890</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">BUILT FROM YOUR CODED EXPENSES</span><span className="text-text-muted">NOT A SHOEBOX</span></div>
  </div>,
  /* 05 Trading — Schedule D + 8949 from your fills */
  <div key="x4" className={SHELL}>
    <div className={HEADER}><span className={HL}>TRADING</span><span className={HR}>SCHEDULE D + 8949</span></div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">Realized gains</span>
      <span className="font-mono text-[12.5px] font-medium text-[#16a34a]">+$1,420</span>
    </div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">Realized losses</span>
      <span className="font-mono text-[12.5px] font-medium text-[#c53030]">−$610</span>
    </div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[13px] text-text-muted">Wash-sale window checked · IRS rules</span>
      <span className="font-mono text-[11px] tracking-[0.1em] text-[#16a34a]">CLEAR ✓</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">FROM YOUR FILLS</span><span className="text-text-muted">NOTHING RETYPED</span></div>
  </div>,
  /* 06 Review — the 1040 assembled */
  <div key="x5" className={SHELL}>
    <div className={HEADER}><span className={HL}>THE 1040</span><span className={HR}>ASSEMBLED</span></div>
    {([
      ['Total income', '$63,000'],
      ['Adjusted gross income', '$61,390'],
      ['Tax after credits', '$6,204'],
    ] as const).map(([line, amt]) => (
      <div key={line} className={ROW}>
        <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">{line}</span>
        <span className="font-mono text-[12.5px] font-medium text-brand-gold">{amt}</span>
      </div>
    ))}
    <div className={FOOT}><span className="text-text-primary">FROM EVERY STEP ABOVE</span><span className="text-text-muted">READ IT WHOLE</span></div>
  </div>,
  /* 07 File — export + filing options */
  <div key="x6" className={SHELL}>
    <div className={HEADER}><span className={HL}>FILE</span><span className={HR}>YOUR CALL</span></div>
    <div className="mx-4 mt-3 flex flex-col items-center gap-2.5">
      <span className="inline-block bg-brand-purple px-4 py-2 font-mono text-[12px] font-semibold tracking-[0.1em] text-white">DOWNLOAD THE FILING PACKAGE</span>
      <span className="inline-block border border-border bg-ts-white px-4 py-2 font-mono text-[12px] tracking-[0.1em] text-brand-purple">EXPORT FOR YOUR CPA</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">EXPORT — OR FILE</span><span className="text-text-muted">VERIFIED BY A PROFESSIONAL</span></div>
  </div>,
];


// ─── FINAL BATCH (runway · content) — the last nine; same law as batches
// 2-3 (ledger clause = manifest, the shared kit composes, real app
// vocabulary: "EXCLUDES TRADING CAPITAL" — the runway route's own cash
// scope; the trailing-window readout; MONTHS LEFT · ZERO DATE · "NOT A
// NUMBER YOU TYPED"; "nothing links silently"; budget vs actual; scene rows
// + cameras; the answer grid; the generated script). With these, ALL NINE
// MODULES ARE DRAWN — the stage's staged `??` placeholder branch is now
// UNREACHABLE; it stays as shipped (do-not-refactor ruling), this line is
// its provenance. Green/red stay drawing-internal (the token law). ────────

const runwayGlimpses: ReadonlyArray<ReactNode> = [
  /* 01 Source — the CASH line, trading capital excluded */
  <div key="w0" className={SHELL}>
    <div className={HEADER}><span className={HL}>CASH</span><span className={HR}>OPERATING ONLY</span></div>
    <div className="mx-4 mt-2 flex flex-col items-center border border-border bg-white px-4 py-5 text-center">
      <span className="font-mono text-[26px] font-medium text-text-primary">$15,000</span>
      <span className="mt-1 font-mono text-[11px] tracking-[0.12em] text-brand-purple">EXCLUDES TRADING CAPITAL</span>
      <span className="mt-0.5 font-mono text-[10px] tracking-[0.1em] text-text-faint">AT-RISK MONEY IS NOT SPENDING MONEY</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">BOOKS ALREADY LINKED THEM</span><span className="text-text-muted">NOTHING TO TYPE</span></div>
  </div>,
  /* 02 History — the trailing-months readout */
  <div key="w1" className={SHELL}>
    <div className={HEADER}><span className={HL}>THE TRAILING LEDGER</span><span className={HR}>REAL SPEND</span></div>
    <div className="mx-4 mt-1 grid grid-cols-2 gap-2">
      {([['TRAILING 3MO', '$600/mo out'], ['TRAILING 6MO', '$580/mo out']] as const).map(([win, burn]) => (
        <div key={win} className="border border-border bg-white px-3 py-3 text-center">
          <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">{win}</div>
          <div className="mt-1.5 font-mono text-[14px] font-medium text-text-primary">{burn}</div>
          <div className="mt-0.5 font-mono text-[10px] tracking-[0.1em] text-text-faint">NET BURN</div>
        </div>
      ))}
    </div>
    <div className={FOOT}><span className="text-text-primary">FROM THE LEDGER</span><span className="text-text-muted">NOT ESTIMATES</span></div>
  </div>,
  /* 03 Burn — the hero: MONTHS LEFT · ZERO DATE · not a number you typed */
  <div key="w2" className={SHELL}>
    <div className={HEADER}><span className={HL}>RUNWAY</span><span className={HR}>CASH ÷ BURN</span></div>
    <div className="mx-4 mt-2 flex flex-1 flex-col items-center justify-center border border-border-light bg-ts-white px-6 py-5 text-center">
      <span className="font-mono text-[10px] tracking-[0.14em] text-text-muted">MONTHS LEFT</span>
      <span className="mt-1 font-mono text-[34px] font-medium leading-none text-brand-gold">25.0<span className="text-[16px]"> MO</span></span>
      <span className="mt-2 font-mono text-[11px] tracking-[0.12em] text-text-secondary">ZERO DATE · AUG 14, 2028</span>
      <span className="mt-1.5 font-mono text-[10px] tracking-[0.12em] text-text-faint">NOT A NUMBER YOU TYPED</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">DERIVED, EVERY DAY</span><span className="text-text-muted">FROM CASH + BURN</span></div>
  </div>,
  /* 04 Match — booking ↔ bank review */
  <div key="w3" className={SHELL}>
    <div className={HEADER}><span className={HL}>MATCH REVIEW</span><span className={HR}>BOOKING ↔ BANK</span></div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[13.5px] text-text-primary">Hotel Alfama $388 ↔ card feed $388</span>
      <span className={`${CHIP} border-brand-purple bg-ts-white text-brand-purple`}>APPROVE</span>
    </div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[13.5px] text-text-muted">TAP AIR $612 ↔ card feed $612</span>
      <span className="font-mono text-[11px] tracking-[0.1em] text-[#16a34a]">MATCHED ✓</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">PLANNED ↔ WHAT ACTUALLY HIT</span><span className="text-text-muted">NOTHING LINKS SILENTLY</span></div>
  </div>,
  /* 05 Project — month-by-month budget vs actual */
  <div key="w4" className={SHELL}>
    <div className={HEADER}><span className={HL}>BUDGET VS ACTUAL</span><span className={HR}>MONTH BY MONTH</span></div>
    <div className="mx-4 mt-1 grid grid-cols-[1fr_70px_70px_56px] gap-x-2 border-b border-border-light pb-1.5 font-mono text-[10px] tracking-[0.12em] text-text-muted">
      <span>CATEGORY</span><span className="text-right">PLANNED</span><span className="text-right">ACTUAL</span><span className="text-right">VAR</span>
    </div>
    {([
      ['Rent', '$400', '$400', '0.0%', false],
      ['Supplies', '$300', '$312', '+4.2%', true],
    ] as const).map(([cat, plan, act, v, over]) => (
      <div key={cat} className="mx-4 grid grid-cols-[1fr_70px_70px_56px] gap-x-2 border-b border-border-light py-[9px]">
        <span className="truncate text-[13.5px] text-text-primary">{cat}</span>
        <span className="text-right font-mono text-[12px] text-text-secondary">{plan}</span>
        <span className="text-right font-mono text-[12px] text-text-secondary">{act}</span>
        <span className={`text-right font-mono text-[11px] ${over ? 'text-[#c53030]' : 'text-text-faint'}`}>{v}</span>
      </div>
    ))}
    <div className={FOOT}><span className="text-text-primary">PROJECTS FORWARD</span><span className="text-text-muted">FROM WHAT REALLY HAPPENED</span></div>
  </div>,
];

const contentGlimpses: ReadonlyArray<ReactNode> = [
  /* 01 Inputs — today's routines + tasks band */
  <div key="n0" className={SHELL}>
    <div className={HEADER}><span className={HL}>TODAY&apos;S INPUTS</span><span className={HR}>ROUTINES + TASKS</span></div>
    <div className={ROW}>
      <span className="w-5 font-mono text-[13px] text-text-faint">🔁</span>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">Morning shop setup</span>
      <span className="font-mono text-[11px] tracking-[0.1em] text-text-faint">ROUTINE</span>
    </div>
    <div className={ROW}>
      <span className="w-5 font-mono text-[13px] text-text-faint">🎯</span>
      <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">Price the compressor</span>
      <span className="font-mono text-[11px] tracking-[0.1em] text-text-faint">TASK</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">YOUR DAY IS THE STORY</span><span className="text-text-muted">NOTHING INVENTED</span></div>
  </div>,
  /* 02 Script map — scene rows + cameras */
  <div key="n1" className={SHELL}>
    <div className={HEADER}><span className={HL}>THE SCENE MAP</span><span className={HR}>CAMERAS: IPHONE</span></div>
    {([
      ['SCENE 01', 'Morning shop setup', 'WIDE · BENCH'],
      ['SCENE 02', 'Compressor pricing run', 'HANDHELD · COUNTER'],
    ] as const).map(([num, name, cam]) => (
      <div key={num} className={ROW}>
        <span className="font-mono text-[10px] tracking-[0.12em] text-text-muted">{num}</span>
        <span className="min-w-0 flex-1 truncate text-[14px] text-text-primary">{name}</span>
        <span className="font-mono text-[10px] tracking-[0.1em] text-text-faint">{cam}</span>
      </div>
    ))}
    <div className={FOOT}><span className="text-text-primary">YOUR DAY, MAPPED</span><span className="text-text-muted">SHOT BY SHOT</span></div>
  </div>,
  /* 03 Answer + Record — the answer grid + take rows */
  <div key="n2" className={SHELL}>
    <div className={HEADER}><span className={HL}>THE ANSWER GRID</span><span className={HR}>QUESTIONS → TAKES</span></div>
    <div className="mx-4 mt-1 border border-border bg-white px-3 py-2.5">
      <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">SCENE 01 · THE QUESTION</div>
      <p className="mt-1 text-[13px] leading-[1.5] text-text-primary">What broke this morning — and what did it cost?</p>
      <p className="mt-2 border-t border-border-light pt-2 text-[12.5px] leading-[1.5] text-text-secondary">&ldquo;The compressor died mid-job — $1,150 to replace…&rdquo;</p>
    </div>
    <div className={ROW}>
      <span className="min-w-0 flex-1 truncate text-[13px] text-text-muted">Scene 02 · take waiting</span>
      <span className="font-mono text-[11px] tracking-[0.1em] text-text-faint">○ UNANSWERED</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">ANSWERS BECOME TAKES</span><span className="text-text-muted">TIED TO EACH SCENE</span></div>
  </div>,
  /* 04 Script — the generated script view */
  <div key="n3" className={SHELL}>
    <div className={HEADER}><span className={HL}>THE SCRIPT</span><span className={HR}>READ IT TO CAMERA</span></div>
    <div className="mx-4 mt-1 flex-1 border border-border bg-white px-4 py-3">
      <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">VOICEOVER — FROM YOUR ANSWERS</div>
      <p className="mt-2 font-mono text-[12px] leading-[1.7] text-text-secondary">&ldquo;This morning the compressor died mid-job. Eleven hundred and fifty dollars. Here&apos;s how the day absorbed it…&rdquo;</p>
    </div>
    <div className={FOOT}><span className="text-text-primary">YOUR WORDS, ORGANIZED</span><span className="text-text-muted">NOT A TEMPLATE</span></div>
  </div>,
];

export const GLIMPSES: Partial<Record<PipePillarId, ReadonlyArray<ReactNode>>> = {
  routines: routinesGlimpses,
  projects: projectsGlimpses,
  travel: travelGlimpses,
  trade: tradeGlimpses,
  books: booksGlimpses,
  compliance: complianceGlimpses,
  tax: taxGlimpses,
  runway: runwayGlimpses,
  content: contentGlimpses,
};
