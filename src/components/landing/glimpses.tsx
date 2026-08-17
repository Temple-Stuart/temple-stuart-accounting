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

import { Fragment } from 'react';
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
    <div className="mx-4 mt-2.5 flex flex-wrap items-baseline justify-between gap-x-3">
      <span className="text-[12px] text-text-muted">Restock supplies · Service the truck already filed</span>
      <span className="font-mono text-[11px] tracking-[0.08em] text-text-faint">MONTHLY ×3</span>
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

const tradeGlimpses: ReadonlyArray<ReactNode> = [
  /* 01 Setup — universe + filters */
  <div key="t0" className={SHELL}>
    <div className={HEADER}><span className={HL}>SETUP</span><span className={HR}>YOUR RULES</span></div>
    <div className="mx-4 mt-1 border border-border bg-white px-4 py-3.5">
      <div className="grid grid-cols-[1.2fr_1fr_0.9fr] gap-2 sm:gap-4">
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">UNIVERSE</div>
          <div className="mt-1.5 truncate border border-border bg-ts-white px-2.5 py-2 font-mono text-[12px] text-text-secondary">S&P 500</div>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">FILTERS</div>
          <div className="mt-1.5 truncate border border-border bg-ts-white px-2.5 py-2 font-mono text-[12px] text-text-secondary">4 ACTIVE</div>
        </div>
        <div>
          <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">RISK CAP</div>
          <div className="mt-1.5 border border-border bg-ts-white px-2.5 py-2 font-mono text-[12px] font-medium text-brand-gold">2%</div>
        </div>
      </div>
    </div>
    <div className={FOOT}><span className="text-text-primary">THE SCAN OBEYS THESE</span><span className="text-text-muted">ALWAYS</span></div>
  </div>,
  /* 02 Scan — the pipeline flow with counts */
  <div key="t1" className={SHELL}>
    <div className={HEADER}><span className={HL}>SCAN</span><span className={HR}>THE PIPELINE RUNS</span></div>
    <div className="mx-4 mt-3 flex flex-wrap items-center gap-2">
      {([['UNIVERSE', '500'], ['FILTERS', '74'], ['SCORED', '12'], ['VERDICTS', '12']] as const).map(([stage, count], i) => (
        <Fragment key={stage}>
          {i > 0 && <span aria-hidden="true" className="font-mono text-[12px] text-text-faint">→</span>}
          <span className="border border-border bg-white px-2.5 py-2 text-center">
            <span className="block font-mono text-[10px] tracking-[0.12em] text-text-muted">{stage}</span>
            <span className="block font-mono text-[15px] font-semibold text-brand-purple">{count}</span>
          </span>
        </Fragment>
      ))}
    </div>
    <p className="mx-4 mt-3 text-[12px] leading-[1.6] text-text-muted">Prices · fundamentals · macro · filings — pulled live, run through YOUR rules.</p>
    <div className={FOOT}><span className="text-text-primary">EVERY STEP COUNTED</span><span className="text-text-muted">NOTHING HIDDEN</span></div>
  </div>,
  /* 03 Review — the verdict table with reasons */
  <div key="t2" className={SHELL}>
    <div className={HEADER}><span className={HL}>VERDICTS</span><span className={HR}>WITH REASONS</span></div>
    {([
      ['NVO', 'TRADE', 'passes all 4 filters · earnings clear', true],
      ['HD', 'SKIP', 'fails the debt filter', false],
      ['UNH', 'SKIP', 'earnings inside the risk window', false],
    ] as const).map(([tick, verdict, reason, isTrade]) => (
      <div key={tick} className={ROW}>
        <span className="w-[44px] font-mono text-[13px] font-semibold text-text-primary">{tick}</span>
        <span className={`${CHIP} ${isTrade ? 'border-brand-purple bg-brand-purple text-white' : 'border-border bg-ts-white text-text-faint'}`}>{verdict}</span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] text-text-muted">{reason}</span>
      </div>
    ))}
    <div className={FOOT}><span className="text-text-primary">SKIPS SHOW THEIR WHY</span><span className="text-text-muted">PICK OR PASS — YOURS</span></div>
  </div>,
  /* 04 Lab — link + grade */
  <div key="t3" className={SHELL}>
    <div className={HEADER}><span className={HL}>THE LAB</span><span className={HR}>LINK + GRADE</span></div>
    <div className="mx-4 mt-1 border border-border bg-white px-4 py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-mono text-[13px] font-semibold text-text-primary">NVO — the setup</span>
        <span className={`${CHIP} border-brand-purple bg-brand-purple-wash text-brand-purple`}>LINKED</span>
      </div>
      <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-border-light pt-2.5">
        <span className="text-[13px] text-text-muted">Entry logic · sizing · exit plan</span>
        <span className="font-mono text-[15px] font-semibold text-brand-gold">B+</span>
      </div>
    </div>
    <div className={FOOT}><span className="text-text-primary">GRADED BEFORE MONEY MOVES</span><span className="text-text-muted">THE SETUP, TESTED</span></div>
  </div>,
  /* 05 Record — graded results, LOSS VISIBLE (no cherry-picking) */
  <div key="t4" className={SHELL}>
    <div className={HEADER}><span className={HL}>THE RECORD</span><span className={HR}>WINS AND LOSSES</span></div>
    {([
      ['NVO', 'B+', '+$120', false],
      ['XOM', 'C', '−$85', true],
      ['COST', 'A−', '+$40', false],
    ] as const).map(([tick, grade, pnl, loss]) => (
      <div key={tick} className={ROW}>
        <span className="w-[44px] font-mono text-[13px] font-semibold text-text-primary">{tick}</span>
        <span className="font-mono text-[12px] text-text-secondary">GRADE {grade}</span>
        <span className={`flex-1 text-right font-mono text-[12.5px] font-medium ${loss ? 'text-[#c53030]' : 'text-[#16a34a]'}`}>{pnl}</span>
      </div>
    ))}
    <div className={FOOT}><span className="text-text-primary">EVERY RESULT WRITTEN DOWN</span><span className="text-text-muted">NO CHERRY-PICKING</span></div>
  </div>,
  /* 06 Commit — the IN BOOKS → chip (the pipePhases link label, verbatim) */
  <div key="t5" className={SHELL}>
    <div className={HEADER}><span className={HL}>COMMIT</span><span className={HR}>ONE CLICK</span></div>
    <div className="mx-4 mt-3 border border-border bg-white px-4 py-3">
      <div className="font-mono text-[10px] tracking-[0.12em] text-text-muted">JOURNAL ENTRY</div>
      <div className="mt-2 flex items-baseline justify-between font-mono text-[12px] text-text-secondary"><span>DR · Brokerage cash</span><span>$120.00</span></div>
      <div className="flex items-baseline justify-between font-mono text-[12px] text-text-secondary"><span>CR · Trading gains (4100)</span><span>$120.00</span></div>
    </div>
    <div className="mx-4 mt-3 flex justify-center">
      <span className="inline-block rounded border border-border px-2 py-1 font-mono text-[11px] tracking-widest text-brand-purple">IN BOOKS →</span>
    </div>
    <div className={FOOT}><span className="text-text-primary">A REAL JOURNAL ENTRY</span><span className="text-text-muted">SAME LEDGER AS EVERYTHING</span></div>
  </div>,
];

export const GLIMPSES: Partial<Record<PipePillarId, ReadonlyArray<ReactNode>>> = {
  routines: routinesGlimpses,
  projects: projectsGlimpses,
  travel: travelGlimpses,
  trade: tradeGlimpses,
};
