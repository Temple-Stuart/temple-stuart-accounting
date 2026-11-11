'use client';

/**
 * HowToSection — PLAN YOUR ESCAPE, the first pillar on the guest landing (Landing.tsx mounts it; the section carries
 * id="modules", the anchor the checkout's cancel link, the /modules pages and the footer's first link land on).
 *
 * HOME-PLANS-03 (Alex, 2026-11-11 18:17 Manila: "take the table and have the steps listed inside the cards… as they
 * apply… so that there are just 4 neat cards … and no added table, to save room and look cleaner and more crisp").
 *
 * WHAT IT RENDERS, top to bottom, and nothing else — no label, no intro line, no table, no price and no button outside
 * the cards:
 *   1. the pillar — "Plan Your Escape." and Alex's three paragraphs, read from src/lib/homeActWords.ts PLAN_PILLAR;
 *   2. the four plan cards — PlanCards, the very component /pricing draws (src/components/offer/PlansSection.tsx), with
 *      a button door ("Join early access" opens the door Landing hands in: sign-up) and with `steps`: what each card
 *      lists, from src/lib/howTo.ts planCardSteps. A card lists the steps its plan ADDS, by category — Personal: its own
 *      and Travel's; Personal + Business: Business's; Personal + Trading: Trade's — where its three benefits stood. The
 *      bundle adds no category of its own, so it keeps its three benefits. What a card inherits, its own line says
 *      ("Everything in Personal, plus the company.");
 *   3. ONE LINK under the cards — the leaf's words, to the leaf's path: /pricing, where the plans' own comparison stands.
 * A MARK SAYS "IN THIS PLAN" — never "built". No status is drawn here: no chip, no count of what is live, no legend. The
 * status view stays in the leaf (src/lib/howTo.ts howToView), undrawn, and so does the comparison (planComparison). The
 * build script's plan law holds the counterweight: no plan may carry a price while this page draws no status.
 *
 * EVERY WORD IS A LEAF'S: the pillar's (homeActWords.ts); the cards' (src/lib/offer/plans.ts, through PlanCards); each
 * category's heading and each step's title (src/lib/howTo.ts planCardSteps, through PlanCards); the link's
 * (COMPARE_PLANS_WORDS, COMPARE_PLANS_PATH). This file types its aria-label, and nothing a visitor reads.
 *
 * NO STATE: nothing opens and nothing closes, so the section holds none — no hook, no storage, no URL. HowToView is the
 * pure half (props in, markup out; the tests render it); the default export hands it the door.
 * 'use client' STAYS, FOR THE DOOR: this file builds the button door's click handler (`onClick: () => onJoin()`) and
 * hands it to PlanCards, a client component — a function cannot cross from a server module to a client one.
 *
 * PAINT: house tokens only, zero new hex. A cream act with its own border-b. The cards are the plans section's own.
 * The link wears the house text link — brand purple, the hover purple, mono, at least 44px tall: the look this very
 * link wore here until HOME-PLANS-01 (HOME-BRIEF-04, 2026-11-10), under a top margin.
 *
 * UNTIL THEN (HOME-PLANS-01, 2026-11-11 00:09: "Four plans. One comparison."; HOME-PLANS-02, the same day: the
 * comparison fits a phone): under the four cards — which drew their three benefits each, as /pricing's do — stood ONE
 * COMPARISON: a table in a rounded white box (data-plan-comparison) that scrolled sideways inside itself. Its head row
 * was the first head and the four plans; then one <tbody> per category — the category's row, a button with
 * aria-expanded over its heading ("PERSONAL — 8 steps") and a mark under each plan; when open, its line and a row per
 * step, each a button with aria-expanded and the same marks; when a step was open, its tools with their lines and its
 * note. Two sets in React state held what was open (Personal at rest; stepKey, toggled, OPEN_AT_REST). All of it left
 * the public page with this brief, with every class key, import, helper and data- hook only it used. The section drew
 * no link to /pricing then.
 *
 * BEFORE THAT (HOME-BRIEF-03 and -04, 2026-11-10; HOME-FINISH-02, 2026-11-10 put the pillar over it): the section was
 * THE HOW-TO — "What you run · add any" with two switches (+ Business, + Trade), the plan line with its price line, its
 * button and a link to /pricing, the steps line and the needs-Books line, each section's steps as one row of cards that
 * swiped sideways (every tool with its status chip, every step LIVE or PENDING), and the legend. All of it left the
 * public page with HOME-PLANS-01, with every class key, import and data- hook only it used.
 */

import { COMPARE_PLANS_PATH, COMPARE_PLANS_WORDS, planCardSteps } from '@/lib/howTo';
import { PLAN_PILLAR } from '@/lib/homeActWords';
import { PlanCards } from '@/components/offer/PlansSection';

// THE CLASS GRAMMAR — one const, house tokens only. The act's own classes sit on its <section>, as ruled.
const HOW = {
  inner: 'max-w-7xl mx-auto px-4 lg:px-8 pt-6 pb-10',
  h2: 'text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple',
  pillar: 'mt-3 max-w-3xl text-base text-text-secondary',
  // The one link under the cards: the house text link — at least 44px tall, so a thumb finds it.
  compare: 'mt-4 inline-flex min-h-[44px] items-center font-mono text-xs tracking-wider text-brand-purple hover:text-brand-purple-hover',
} as const;

export interface HowToViewProps {
  /** A plan card's button — the door Landing hands in. */
  onJoin: () => void;
}

/** The pure half: props in, markup out. */
export function HowToView({ onJoin }: HowToViewProps) {
  return (
    <section id="modules" aria-label="Software plans" className="w-full border-b border-border bg-bg-terminal" data-how-to>
      <div className={HOW.inner}>
        <h2 className={HOW.h2}>{PLAN_PILLAR.heading}</h2>
        {PLAN_PILLAR.paragraphs.map((words) => <p key={words} className={HOW.pillar}>{words}</p>)}

        <PlanCards door={{ kind: 'button', onClick: () => onJoin() }} steps={planCardSteps()} />

        <a href={COMPARE_PLANS_PATH} className={HOW.compare} data-compare-plans>{COMPARE_PLANS_WORDS}</a>
      </div>
    </section>
  );
}

/** A plan card's button opens the door Landing hands in. The section holds no state. */
export default function HowToSection({ onRequireAuth }: { onRequireAuth: () => void }) {
  return <HowToView onJoin={onRequireAuth} />;
}
