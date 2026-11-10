'use client';

/**
 * HowToSection (HOME-BRIEF-03, Alex, 2026-11-10 18:09; the board he approved on 2026-11-09, "pick what you run") — THE
 * HOW-TO: a visitor says what they run and the steps fill in, in order, across Personal, Business, Travel and Trade.
 *
 * HOME-BRIEF-04 (Alex, 2026-11-10 19:00 · 19:03: "the how-to should replace software plans … cards should be horizontal
 * swipe per P, B, T … clean these cards up") — on the guest landing this IS the SOFTWARE PLANS block (Landing.tsx): the
 * four plan cards and the comparison table are /pricing's alone now. So the section carries id="modules" — the anchor
 * the checkout's cancel link and the /modules pages land on (it was "how-to", and the plans section's until then).
 *
 * WHAT IT RENDERS, top to bottom — every word, every status, the plan, its price line, its button's words and the
 * counts come from src/lib/howTo.ts (which reads the tool registry, the plans and the Books offer); nothing is typed
 * here but the region's aria-label:
 *   1. the pillar's heading and its three paragraphs — "Plan Your Escape." and Alex's words, read from
 *      src/lib/homeActWords.ts PLAN_PILLAR (HOME-FINISH-02, Alex, 2026-11-10 20:56: "Purple title → Approved description
 *      → Existing functionality … No additional promotional headings or explanatory paragraphs between these
 *      elements." Until then: the label, the h2, the one line, and the door to the 14 steps — its words and path from
 *      ./pipelineWords; the footer's THE RECORD keeps that door);
 *   2. WHAT YOU RUN — "Personal · always" (not a button) and two switches, + Business and + Trade: real buttons with
 *      aria-pressed, 44px tall, filled brand purple when on;
 *   3. the plan line; under it the plan's price line and its button — the public page's one filled button
 *      (src/lib/ds.ts), opening the door Landing hands in, the one the plan cards' button opened — and, beside the
 *      button, the link to the four plans on /pricing;
 *   4. the steps line and — while Books is not on sale — the needs-Books line;
 *   5. the sections that choice shows, each a badge, its name, its line and its steps as ONE ROW that swipes sideways
 *      (MY TRIP's rail idiom — no grid): fixed-width cards of equal height. A card: its step on the left and its own
 *      state on the right; the title; each tool on its own line with its mark on the right; its note. Its place among
 *      your steps, the section's name and the needs-Books tags are off the card — the line over the rows and the
 *      legend still say which steps need Books;
 *   6. the legend.
 * NOT HERE, on purpose (the board): no placeholder box, no "guide" line, no count of the tools.
 *
 * STATE: the two switches, in React state only — no storage, no URL. HowToView is the pure half (props in, markup out;
 * the tests render it); the default export holds the switches.
 *
 * PAINT: house tokens only, zero new hex. A cream act with its own border-b; the inner box, the eyebrow, the h2 and the
 * rail are MY TRIP's idioms (WasHereSection.tsx TRIP); every mark is the design system's chip (src/lib/ds.ts).
 * HOME-FINISH-02 (2026-11-10): the eyebrow left; the h2 wears the page's purple heading classes with no top margin (it
 * is the section's first line now), each paragraph `mt-3 max-w-3xl text-base text-text-secondary`, and the inner box's
 * top padding came down (py-10 → pt-6 pb-10) so the pillar sits under "What We Do".
 */

import Link from 'next/link';
import { useState } from 'react';
import { PRIMARY_CTA, chip } from '@/lib/ds';
import {
  ADD_BUSINESS, ADD_TRADE, COMPARE_PLANS_PATH, COMPARE_PLANS_WORDS, LEGEND_ORDER,
  LEGEND_STEP_LINE, LEGEND_TITLE, PERSONAL_ALWAYS, TOOL_MARKS, WHAT_YOU_RUN_LABEL, howToView, type HowToChoice,
} from '@/lib/howTo';
import { PLAN_PILLAR } from '@/lib/homeActWords';

// THE CLASS GRAMMAR — one const, every string whole, house tokens only. The act's own classes sit on its <section>, as ruled.
const HOW = {
  // HOME-FINISH-02 (2026-11-10): the pillar — its heading and its paragraphs over the tool. The top padding came down ('… py-10' until then), the
  // h2 lost the top margin it had under the label ('mt-3 text-2xl …'), and the keys of the three lines that left (eyebrow, sub, door) left with them.
  inner: 'max-w-7xl mx-auto px-4 lg:px-8 pt-6 pb-10',
  h2: 'text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple',
  pillar: 'mt-3 max-w-3xl text-base text-text-secondary',
  // The label and the legend's title read in the case the leaf writes them — no CSS upper-casing.
  label: 'font-mono text-xs lg:text-[10px] font-semibold tracking-wider text-text-faint',
  switches: 'mt-3 flex flex-wrap items-center gap-2',
  // Personal is everyone's: the same box as a switch, never pressed and not a button.
  always: 'inline-flex min-h-[44px] items-center rounded-lg border border-border bg-bg-row px-4 py-2 font-mono text-xs font-medium text-text-secondary',
  switchOn: 'min-h-[44px] rounded-lg border border-brand-purple bg-brand-purple px-4 py-2 font-mono text-xs font-medium text-white',
  switchOff: 'min-h-[44px] rounded-lg border border-brand-purple/40 px-4 py-2 font-mono text-xs font-medium text-brand-purple transition-colors hover:bg-brand-purple-wash',
  plan: 'mt-6 text-lg font-semibold text-text-primary',
  // HOME-BRIEF-04: the plan's price line — the plan card's own idiom for it — then its button and, beside it, the door to the four plans.
  price: 'mt-1 font-mono text-sm text-text-secondary',
  offer: 'mt-3 flex flex-wrap items-center gap-x-4 gap-y-2',
  compare: 'inline-flex min-h-[44px] items-center font-mono text-xs tracking-wider text-brand-purple hover:text-brand-purple-hover',
  steps: 'mt-4 text-sm text-text-secondary',
  count: 'mt-1 text-sm text-text-secondary',
  section: 'mt-10',
  sectionHead: 'flex flex-wrap items-baseline gap-x-3 gap-y-1',
  sectionName: 'font-mono text-xs font-semibold uppercase tracking-wider text-brand-purple',
  sectionLine: 'text-sm text-text-secondary',
  // HOME-BRIEF-04: one row per section, swiped sideways — MY TRIP's rail (WasHereSection.tsx TRIP.list), whole but for its top margin. No grid.
  row: '-mx-4 mt-4 flex snap-x snap-proximity gap-4 overflow-x-auto scroll-px-4 px-4 pb-3 lg:-mx-8 lg:scroll-px-8 lg:px-8 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent',
  // One width for every card; the row stretches each to its tallest, so a row's cards are equal in height.
  card: 'w-[17rem] shrink-0 snap-start flex flex-col rounded-lg border border-border bg-white p-5',
  // Line one: the step on the left, its state on the right.
  cardHead: 'flex items-center justify-between gap-2',
  step: 'font-mono text-[10px] font-semibold tracking-wider text-text-faint',
  title: 'mt-2 text-base font-semibold text-text-primary',
  tools: 'mt-3 space-y-1.5',
  // Each tool on its own line: its name on the left, its mark on the right.
  tool: 'flex items-center justify-between gap-2 text-sm text-text-primary',
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
  /** The plan's button — the door the plan cards' button opened. */
  onJoin: () => void;
}

/** The pure half: props in, markup out. */
export function HowToView({ choice, onBusiness, onTrade, onJoin }: HowToViewProps) {
  const view = howToView(choice);
  return (
    <section id="modules" aria-label="How to" className="w-full border-b border-border bg-bg-terminal" data-how-to>
      <div className={HOW.inner}>
        <h2 className={HOW.h2}>{PLAN_PILLAR.heading}</h2>
        {PLAN_PILLAR.paragraphs.map((words) => <p key={words} className={HOW.pillar}>{words}</p>)}

        <p className={`mt-6 ${HOW.label}`}>{WHAT_YOU_RUN_LABEL}</p>
        <div className={HOW.switches} role="group" aria-label={WHAT_YOU_RUN_LABEL}>
          <span className={HOW.always} data-how-to-always>{PERSONAL_ALWAYS}</span>
          <button type="button" aria-pressed={choice.business} onClick={onBusiness} className={choice.business ? HOW.switchOn : HOW.switchOff} data-how-to-switch="business">{ADD_BUSINESS}</button>
          <button type="button" aria-pressed={choice.trade} onClick={onTrade} className={choice.trade ? HOW.switchOn : HOW.switchOff} data-how-to-switch="trade">{ADD_TRADE}</button>
        </div>

        <p className={HOW.plan} data-how-to-plan>{view.planLine}</p>
        <p className={HOW.price} data-how-to-price>{view.price.line}</p>
        <div className={HOW.offer}>
          <button type="button" onClick={onJoin} className={PRIMARY_CTA} data-how-to-cta={view.plan.id}>{view.price.cta}</button>
          <Link href={COMPARE_PLANS_PATH} className={HOW.compare} data-how-to-compare>{COMPARE_PLANS_WORDS}</Link>
        </div>
        <p className={HOW.steps} data-how-to-steps>{view.stepsLine}</p>
        {view.booksLine !== null && <p className={HOW.count} data-how-to-books>{view.booksLine}</p>}

        {view.sections.map((section) => (
          <div key={section.id} className={HOW.section} data-how-to-section={section.id}>
            <p className={HOW.sectionHead}>
              <span className={chip('accent')} data-how-to-badge>{section.badge}</span>
              <span className={HOW.sectionName}>{section.name}</span>
              <span className={HOW.sectionLine}>{section.line}</span>
            </p>
            <div className={HOW.row} data-how-to-row={section.id}>
              {section.cards.map((card) => (
                <article key={card.n} className={HOW.card} data-how-to-card={`${section.id}-${card.n}`}>
                  <p className={HOW.cardHead}>
                    <span className={HOW.step} data-how-to-step>{card.step}</span>
                    <span className={chip(card.state.tone)} data-how-to-state>{card.state.words}</span>
                  </p>
                  <h3 className={HOW.title}>{card.title}</h3>
                  <ul className={HOW.tools}>
                    {card.tools.map((tool) => (
                      <li key={tool.name} className={HOW.tool}>
                        <span>{tool.name}</span>
                        <span className={chip(tool.tone)} data-how-to-mark={tool.name}>{tool.words}</span>
                      </li>
                    ))}
                  </ul>
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

/** The two switches, in React state only — no storage, no URL. The plan's button opens the door Landing hands in. */
export default function HowToSection({ onRequireAuth }: { onRequireAuth: () => void }) {
  const [business, setBusiness] = useState(false);
  const [trade, setTrade] = useState(false);
  return <HowToView choice={{ business, trade }} onBusiness={() => setBusiness((on) => !on)} onTrade={() => setTrade((on) => !on)} onJoin={onRequireAuth} />;
}
