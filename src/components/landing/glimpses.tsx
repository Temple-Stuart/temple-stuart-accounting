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

export const GLIMPSES: Partial<Record<PipePillarId, ReadonlyArray<ReactNode>>> = {
  routines: routinesGlimpses,
};
