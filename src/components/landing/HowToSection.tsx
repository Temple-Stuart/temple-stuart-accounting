'use client';

/**
 * HowToSection (HOME-BRIEF-03, Alex, 2026-11-10 18:09; the board he approved on 2026-11-09, "pick what you run") — THE
 * HOW-TO, on the guest landing directly under the plans (Landing.tsx): a visitor says what they run and the steps fill
 * in, in order, across Personal, Business, Travel and Trade.
 *
 * WHAT IT RENDERS, top to bottom — every word, every status, the plan and the counts come from src/lib/howTo.ts (which
 * reads the tool registry, the plans and the Books offer); nothing is typed here but the region's aria-label:
 *   1. the eyebrow, the h2, the one line, and the door to the 14 steps (its words and path from ./pipelineWords);
 *   2. WHAT YOU RUN — "Personal · always" (not a button) and two switches, + Business and + Trade: real buttons with
 *      aria-pressed, 44px tall, filled brand purple when on;
 *   3. the plan line, the steps line and — while Books is not on sale — the needs-Books line;
 *   4. the sections that choice shows, each a badge, its name, its line and its steps as cards: where the step sits,
 *      its place among your steps, the title, each tool with its mark, the step's own state, the two Books tags when
 *      they apply, and its note;
 *   5. the legend.
 * NOT HERE, on purpose (the board): no placeholder box, no "guide" line, no count of the tools.
 *
 * STATE: the two switches, in React state only — no storage, no URL. HowToView is the pure half (props in, markup out;
 * the tests render it); the default export holds the switches.
 *
 * PAINT: house tokens only, zero new hex. A cream act with its own border-b; the inner box, the eyebrow and the h2 are
 * MY TRIP's idioms (WasHereSection.tsx TRIP); every mark is the design system's chip (src/lib/ds.ts).
 */

import Link from 'next/link';
import { useState } from 'react';
import { chip } from '@/lib/ds';
import {
  ADD_BUSINESS, ADD_TRADE, HOW_TO_EYEBROW, HOW_TO_HEADING, HOW_TO_LINE, LEGEND_ORDER, LEGEND_STEP_LINE, LEGEND_TITLE,
  NEEDS_BOOKS_TAG, NOT_ON_SALE_TAG, PERSONAL_ALWAYS, TOOL_MARKS, WHAT_YOU_RUN_LABEL, howToView, type HowToChoice,
} from '@/lib/howTo';
import { PIPELINE_DOOR, PIPELINE_PATH } from './pipelineWords';

// THE CLASS GRAMMAR — one const, every string whole, house tokens only. The act's own classes sit on its <section>, as ruled.
const HOW = {
  inner: 'max-w-7xl mx-auto px-4 lg:px-8 py-10',
  eyebrow: 'font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint',
  h2: 'mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple',
  sub: 'mt-2 max-w-3xl text-sm text-text-secondary',
  door: 'mt-2 inline-flex min-h-[44px] items-center font-mono text-xs tracking-wider text-brand-purple hover:text-brand-purple-hover',
  // The label and the legend's title read in the case the leaf writes them — no CSS upper-casing (the eyebrow alone wears MY TRIP's caps).
  label: 'font-mono text-xs lg:text-[10px] font-semibold tracking-wider text-text-faint',
  switches: 'mt-3 flex flex-wrap items-center gap-2',
  // Personal is everyone's: the same box as a switch, never pressed and not a button.
  always: 'inline-flex min-h-[44px] items-center rounded-lg border border-border bg-bg-row px-4 py-2 font-mono text-xs font-medium text-text-secondary',
  switchOn: 'min-h-[44px] rounded-lg border border-brand-purple bg-brand-purple px-4 py-2 font-mono text-xs font-medium text-white',
  switchOff: 'min-h-[44px] rounded-lg border border-brand-purple/40 px-4 py-2 font-mono text-xs font-medium text-brand-purple transition-colors hover:bg-brand-purple-wash',
  plan: 'mt-6 text-lg font-semibold text-text-primary',
  count: 'mt-1 text-sm text-text-secondary',
  section: 'mt-10',
  sectionHead: 'flex flex-wrap items-baseline gap-x-3 gap-y-1',
  sectionName: 'font-mono text-xs font-semibold uppercase tracking-wider text-brand-purple',
  sectionLine: 'text-sm text-text-secondary',
  // One column on a phone, two from sm, four from lg.
  grid: 'mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4',
  card: 'rounded-lg border border-border bg-white p-5',
  // "Personal · step 1" as the leaf writes it; the place line under it is written in caps.
  where: 'font-mono text-[10px] font-semibold tracking-wider text-text-faint',
  place: 'mt-1 font-mono text-[10px] tracking-wider text-text-faint',
  title: 'mt-2 text-base font-semibold text-text-primary',
  tools: 'mt-3 space-y-1',
  tool: 'flex flex-wrap items-center justify-between gap-2 text-sm text-text-primary',
  tags: 'mt-3 flex flex-wrap items-center gap-1.5',
  note: 'mt-3 text-xs text-text-muted',
  after: 'mt-4 text-sm text-text-secondary',
  legend: 'mt-10 border-t border-border-light pt-4',
  legendMarks: 'mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-secondary',
  legendLine: 'mt-2 max-w-3xl text-xs text-text-secondary',
} as const;

export interface HowToViewProps {
  choice: HowToChoice;
  onBusiness: () => void;
  onTrade: () => void;
}

/** The pure half: props in, markup out. */
export function HowToView({ choice, onBusiness, onTrade }: HowToViewProps) {
  const view = howToView(choice);
  return (
    <section id="how-to" aria-label="How to" className="w-full border-b border-border bg-bg-terminal" data-how-to>
      <div className={HOW.inner}>
        <p className={HOW.eyebrow}>{HOW_TO_EYEBROW}</p>
        <h2 className={HOW.h2}>{HOW_TO_HEADING}</h2>
        <p className={HOW.sub}>{HOW_TO_LINE}</p>
        <Link href={PIPELINE_PATH} className={HOW.door} data-how-to-door>{PIPELINE_DOOR}</Link>

        <p className={`mt-6 ${HOW.label}`}>{WHAT_YOU_RUN_LABEL}</p>
        <div className={HOW.switches} role="group" aria-label={WHAT_YOU_RUN_LABEL}>
          <span className={HOW.always} data-how-to-always>{PERSONAL_ALWAYS}</span>
          <button type="button" aria-pressed={choice.business} onClick={onBusiness} className={choice.business ? HOW.switchOn : HOW.switchOff} data-how-to-switch="business">{ADD_BUSINESS}</button>
          <button type="button" aria-pressed={choice.trade} onClick={onTrade} className={choice.trade ? HOW.switchOn : HOW.switchOff} data-how-to-switch="trade">{ADD_TRADE}</button>
        </div>

        <p className={HOW.plan} data-how-to-plan>{view.planLine}</p>
        <p className={HOW.count} data-how-to-steps>{view.stepsLine}</p>
        {view.booksLine !== null && <p className={HOW.count} data-how-to-books>{view.booksLine}</p>}

        {view.sections.map((section) => (
          <div key={section.id} className={HOW.section} data-how-to-section={section.id}>
            <p className={HOW.sectionHead}>
              <span className={chip('accent')} data-how-to-badge>{section.badge}</span>
              <span className={HOW.sectionName}>{section.name}</span>
              <span className={HOW.sectionLine}>{section.line}</span>
            </p>
            <div className={HOW.grid}>
              {section.cards.map((card) => (
                <article key={card.n} className={HOW.card} data-how-to-card={`${section.id}-${card.n}`}>
                  <p className={HOW.where}>{card.where}</p>
                  <p className={HOW.place} data-how-to-place>{card.placeLine}</p>
                  <h3 className={HOW.title}>{card.title}</h3>
                  <ul className={HOW.tools}>
                    {card.tools.map((tool) => (
                      <li key={tool.name} className={HOW.tool}>
                        <span>{tool.name}</span>
                        <span className={chip(tool.tone)} data-how-to-mark={tool.name}>{tool.words}</span>
                      </li>
                    ))}
                  </ul>
                  <p className={HOW.tags}>
                    <span className={chip(card.state.tone)} data-how-to-state>{card.state.words}</span>
                    {card.needsBooks && <span className={chip('warning')} data-how-to-needs-books>{NEEDS_BOOKS_TAG}</span>}
                    {card.needsBooks && <span className={chip('warning')} data-how-to-not-on-sale>{NOT_ON_SALE_TAG}</span>}
                  </p>
                  {card.note !== null && <p className={HOW.note} data-how-to-note>{card.note}</p>}
                </article>
              ))}
            </div>
            {section.after !== null && <p className={HOW.after} data-how-to-next>{section.after}</p>}
          </div>
        ))}

        <div className={HOW.legend} data-how-to-legend>
          <p className={HOW.label}>{LEGEND_TITLE}</p>
          <p className={HOW.legendMarks}>
            {LEGEND_ORDER.map((status) => (
              <span key={status}><span className={chip(TOOL_MARKS[status].tone)}>{TOOL_MARKS[status].words}</span> {TOOL_MARKS[status].means}</span>
            ))}
          </p>
          <p className={HOW.legendLine}>{LEGEND_STEP_LINE}</p>
          {view.legendBooksLine !== null && <p className={HOW.legendLine} data-how-to-legend-books>{view.legendBooksLine}</p>}
        </div>
      </div>
    </section>
  );
}

/** The two switches, in React state only — no storage, no URL. */
export default function HowToSection() {
  const [business, setBusiness] = useState(false);
  const [trade, setTrade] = useState(false);
  return <HowToView choice={{ business, trade }} onBusiness={() => setBusiness((on) => !on)} onTrade={() => setTrade((on) => !on)} />;
}
