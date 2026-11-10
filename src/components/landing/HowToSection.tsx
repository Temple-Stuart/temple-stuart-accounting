'use client';

/**
 * HowToSection — PLAN YOUR ESCAPE, the first pillar on the guest landing (Landing.tsx mounts it; the section carries
 * id="modules", the anchor the checkout's cancel link, the /modules pages and the footer's first link land on).
 *
 * HOME-PLANS-01 (Alex, 2026-11-11 00:09: "Four plans. One comparison. Clean, polished, professional." · "Do not display
 * development statuses on the public homepage." · "A checkmark means the capability is part of that plan's intended
 * offering. It does NOT represent implementation status or current availability.").
 *
 * WHAT IT RENDERS, top to bottom, and nothing else — no label, no intro line, no price and no button outside the cards:
 *   1. the pillar — "Plan Your Escape." and Alex's three paragraphs, read from src/lib/homeActWords.ts PLAN_PILLAR;
 *   2. the four plan cards — PlanCards, the very component /pricing draws (src/components/offer/PlansSection.tsx), with a
 *      button door: "Join early access" opens the door Landing hands in (sign-up), as the plans' button did on this page
 *      until 2026-11-10;
 *   3. ONE COMPARISON — a table in a rounded white box that scrolls sideways inside itself below the width it needs (the
 *      page never does). The head row: the first head, then the four plans — each column head gives a screen reader the
 *      plan's full name. Then one <tbody> per category:
 *        · the category's row — a real button with aria-expanded filling the first cell: its heading ("PERSONAL — 8
 *          steps") and a + or − at the right; then a mark under each plan;
 *        · when it is open — its line, once, across the table; then a row per step: a real button with aria-expanded
 *          (the step's number and its title), then a mark under each plan;
 *        · when a step is open — a row across the table: each tool's name with its line, then the step's note when it
 *          has one.
 * A MARK SAYS "IN THIS PLAN" — never "built". No status is drawn here: no chip, no count of what is live, no legend. The
 * status view stays in the leaf (src/lib/howTo.ts howToView), undrawn; the signed-in app is where statuses will show.
 * The build script's plan law holds the counterweight: no plan may carry a price while this table draws no status.
 *
 * EVERY WORD IS A LEAF'S: the pillar's (homeActWords.ts), the cards' (src/lib/offer/plans.ts, through PlanCards) and
 * the table's — its heads, its marks, each category, step, tool line and note (src/lib/howTo.ts planComparison). This
 * file types its aria-label and the two signs of a toggle, and nothing a visitor reads.
 *
 * STATE: two sets — the open categories and the open steps — in React state only: no storage, no URL. Personal starts
 * open; Business, Travel and Trade start closed; no step starts open; any number may be open at once. HowToView is the
 * pure half (props in, markup out; the tests render it); the default export holds the two sets.
 *
 * PAINT: house tokens only, zero new hex. A cream act with its own border-b. The table's box, its head row and its
 * toggle rows are the plans section's own table idioms (PlansSection.tsx: the data-plan-table box, its thead, its group
 * toggle). The marks: ✓ in brand purple, — in faint ink — never the status colours. Every button is at least 44px tall
 * and shows a focus ring.
 *
 * UNTIL THEN (HOME-BRIEF-03 and -04, 2026-11-10; HOME-FINISH-02, 2026-11-10 put the pillar over it): the section was
 * THE HOW-TO — "What you run · add any" with two switches (+ Business, + Trade), the plan line with its price line, its
 * button and a link to /pricing, the steps line and the needs-Books line, each section's steps as one row of cards that
 * swiped sideways (every tool with its status chip, every step LIVE or PENDING), and the legend. All of it left the
 * public page with this brief, with every class key, import and data- hook only it used.
 */

import { Fragment, useState } from 'react';
import { DATA } from '@/lib/ds';
import { PLAN_MARKS, planComparison, type HowToSectionId } from '@/lib/howTo';
import { PLAN_PILLAR } from '@/lib/homeActWords';
import { PlanCards } from '@/components/offer/PlansSection';

/** A toggle's focus ring — the house ring (src/lib/ds.ts CONTROL), drawn inside the cell so the box's edge never clips it. */
const RING = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-purple';

// THE CLASS GRAMMAR — one const, house tokens only. The act's own classes sit on its <section>, as ruled.
const HOW = {
  inner: 'max-w-7xl mx-auto px-4 lg:px-8 pt-6 pb-10',
  h2: 'text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple',
  pillar: 'mt-3 max-w-3xl text-base text-text-secondary',
  // The comparison's box: the plans table's own (PlansSection.tsx, data-plan-table) but for its top margin. It scrolls sideways inside itself.
  box: 'mt-8 overflow-x-auto rounded-lg border border-border bg-white',
  // All four plan columns show at every width, so the table keeps the width it needs and the box scrolls below it. Fixed layout: opening a row moves no column.
  table: 'w-full min-w-[720px] table-fixed text-sm',
  // The head row: the plans table's own thead.
  headRow: 'border-b border-border bg-bg-row text-left align-top',
  firstHead: `px-3 py-3 text-left ${DATA.columnHeader}`,
  planHead: 'w-[6.5rem] px-2 py-3 text-center text-sm font-semibold text-brand-purple',
  row: 'border-b border-border-light',
  rowHead: 'p-0 text-left font-normal',
  // A category's toggle: the plans table's group toggle — its capitals are the leaf's, so the count reads as written.
  categoryToggle: `flex min-h-[44px] w-full items-center justify-between gap-3 px-3 py-2.5 text-left font-mono text-xs font-semibold tracking-wider text-brand-purple hover:bg-bg-row ${RING}`,
  // A step's toggle: the same row, in the table's own ink, set in under its category.
  stepToggle: `flex min-h-[44px] w-full items-center justify-between gap-3 py-2 pl-6 pr-3 text-left text-sm text-text-primary hover:bg-bg-row ${RING}`,
  stepWords: 'flex items-baseline gap-3',
  stepNumber: 'w-4 shrink-0 font-mono text-xs text-text-faint',
  sign: 'shrink-0 font-mono text-xs text-text-faint',
  // The marks — never the status colours.
  markCell: 'px-2 py-2 text-center',
  markIn: 'font-mono text-sm text-brand-purple',
  markOut: 'font-mono text-sm text-text-faint',
  line: 'px-3 py-2 text-sm text-text-secondary',
  // An open step: its tools start where its title starts (pl-6 + the number's w-4 + gap-3).
  tools: 'py-3 pl-[3.25rem] pr-3',
  toolList: 'space-y-1.5',
  tool: 'grid grid-cols-[12rem_minmax(0,1fr)] gap-x-4',
  toolName: 'text-sm font-medium text-text-primary',
  toolLine: 'text-sm text-text-secondary',
  note: 'mt-2 text-xs text-text-muted',
} as const;

/** A step's key in the open set: its category and its number. */
export function stepKey(category: HowToSectionId, n: number): string {
  return `${category}-${n}`;
}

/** A set with one key flipped — a new set, so React sees the change. */
export function toggled<T>(set: ReadonlySet<T>, key: T): ReadonlySet<T> {
  const next = new Set(set);
  if (!next.delete(key)) next.add(key);
  return next;
}

export interface HowToViewProps {
  /** The categories that are open. */
  openCategories: ReadonlySet<HowToSectionId>;
  /** The steps that are open, each by its key (stepKey). */
  openSteps: ReadonlySet<string>;
  onCategory: (id: HowToSectionId) => void;
  onStep: (key: string) => void;
  /** A plan card's button — the door Landing hands in. */
  onJoin: () => void;
}

/** The pure half: props in, markup out. */
export function HowToView({ openCategories, openSteps, onCategory, onStep, onJoin }: HowToViewProps) {
  const view = planComparison();
  const span = 1 + view.columns.length;
  // A mark under each plan: in the plan, or not — and what a screen reader hears for it.
  const marks = (inPlan: readonly boolean[]) => view.columns.map((column, i) => {
    const mark = inPlan[i] ? PLAN_MARKS.inPlan : PLAN_MARKS.notInPlan;
    return (
      <td key={column.id} className={HOW.markCell} data-comparison-mark={column.id} data-in-plan={inPlan[i]}>
        <span aria-hidden="true" className={inPlan[i] ? HOW.markIn : HOW.markOut}>{mark.mark}</span>
        <span className="sr-only">{mark.label}</span>
      </td>
    );
  });
  return (
    <section id="modules" aria-label="Software plans" className="w-full border-b border-border bg-bg-terminal" data-how-to>
      <div className={HOW.inner}>
        <h2 className={HOW.h2}>{PLAN_PILLAR.heading}</h2>
        {PLAN_PILLAR.paragraphs.map((words) => <p key={words} className={HOW.pillar}>{words}</p>)}

        <PlanCards door={{ kind: 'button', onClick: () => onJoin() }} />

        <div className={HOW.box} data-plan-comparison>
          <table className={HOW.table}>
            <thead>
              <tr className={HOW.headRow}>
                <th scope="col" className={HOW.firstHead}>{view.firstHead}</th>
                {view.columns.map((column) => (
                  <th key={column.id} scope="col" className={HOW.planHead} data-comparison-column={column.id}>
                    <span aria-hidden="true">{column.head}</span>
                    <span className="sr-only">{column.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            {view.categories.map((category) => {
              const open = openCategories.has(category.id);
              return (
                <tbody key={category.id} data-comparison-category={category.id} data-comparison-open={open}>
                  <tr className={HOW.row}>
                    <th scope="row" className={HOW.rowHead}>
                      <button type="button" aria-expanded={open} onClick={() => onCategory(category.id)} className={HOW.categoryToggle} data-comparison-toggle={category.id}>
                        <span>{category.heading}</span>
                        <span aria-hidden="true" className={HOW.sign}>{open ? '−' : '+'}</span>
                      </button>
                    </th>
                    {marks(category.inPlan)}
                  </tr>
                  {open && (
                    <tr className={HOW.row}>
                      <td colSpan={span} className={HOW.line} data-comparison-line>{category.line}</td>
                    </tr>
                  )}
                  {open && category.steps.map((step) => {
                    const key = stepKey(category.id, step.n);
                    const stepOpen = openSteps.has(key);
                    return (
                      <Fragment key={key}>
                        <tr className={HOW.row} data-comparison-step={key}>
                          <th scope="row" className={HOW.rowHead}>
                            <button type="button" aria-expanded={stepOpen} onClick={() => onStep(key)} className={HOW.stepToggle} data-comparison-step-toggle={key}>
                              <span className={HOW.stepWords}>
                                <span className={HOW.stepNumber}>{step.n}</span>
                                <span>{step.title}</span>
                              </span>
                              <span aria-hidden="true" className={HOW.sign}>{stepOpen ? '−' : '+'}</span>
                            </button>
                          </th>
                          {marks(category.inPlan)}
                        </tr>
                        {stepOpen && (
                          <tr className={HOW.row}>
                            <td colSpan={span} className={HOW.tools} data-comparison-tools={key}>
                              <ul className={HOW.toolList}>
                                {step.tools.map((tool) => (
                                  <li key={tool.name} className={HOW.tool}>
                                    <span className={HOW.toolName}>{tool.name}</span>
                                    <span className={HOW.toolLine}>{tool.line}</span>
                                  </li>
                                ))}
                              </ul>
                              {step.note !== null && <p className={HOW.note} data-comparison-note>{step.note}</p>}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              );
            })}
          </table>
        </div>
      </div>
    </section>
  );
}

/** Personal starts open; Business, Travel and Trade start closed; no step starts open. */
const OPEN_AT_REST: readonly HowToSectionId[] = ['personal'];

/** The two sets, in React state only — no storage, no URL. A plan card's button opens the door Landing hands in. */
export default function HowToSection({ onRequireAuth }: { onRequireAuth: () => void }) {
  const [openCategories, setOpenCategories] = useState<ReadonlySet<HowToSectionId>>(() => new Set(OPEN_AT_REST));
  const [openSteps, setOpenSteps] = useState<ReadonlySet<string>>(() => new Set<string>());
  return (
    <HowToView
      openCategories={openCategories}
      openSteps={openSteps}
      onCategory={(id) => setOpenCategories((open) => toggled(open, id))}
      onStep={(key) => setOpenSteps((open) => toggled(open, key))}
      onJoin={onRequireAuth}
    />
  );
}
