/**
 * HOME-ORDER-01 (Alex, 2026-11-10 16:27: "What We Do → About Us → Our Story") — THE HOME PAGE'S ACT HEADINGS, each
 * typed ONCE, here. Two with HOME-ORDER-01; the third, About Us, with HOME-BRIEF-02 (2026-11-10).
 *   · WHAT_WE_DO_HEADING — the first child of the travel block's section on the home page (Landing.tsx, the h2 that
 *                          carries data-act-heading): the heading over travel booking, the events, the guest's strip,
 *                          the plans and the professional services.
 *   · OUR_STORY_HEADING  — the trip log's h2 (WasHereSection.tsx, MY_TRIP_HEADLINE), over the trip cards.
 *   · ABOUT_US_HEADING   — the h2 of the act between them (StopZeroSection.tsx), over Alex's text; that text is its own
 *                          leaf's (src/lib/stopZeroWords.ts), not this file's.
 *
 * HOME-BRIEF-03 (Alex, 2026-11-10 18:09): one more line of the home page lives here —
 *   · SAVE_TRIPS_LINE    — in the travel block's foot row, right after "One trip holds everything — plans, bookings,
 *                          budget." (Landing.tsx): what an account adds to booking without one.
 *
 * HOME-FINISH-02 (Alex's brief "HOME-FINISH | Temple Stuart Homepage Copy, Layout & Footer", 2026-11-10 20:56):
 *   · WHAT_WE_DO_HEADING stands ALONE now, in gold, directly above the three pillars (Landing.tsx — it was the travel
 *     section's first child until then); About Us and Our Story wear the same gold.
 *   · THE THREE PILLARS under it, in his order — PLAN → BUILD → EXPLORE — have their words here, word for word as he
 *     approved them. His rule for all three: "Purple title → Approved description → Existing functionality … No
 *     additional promotional headings or explanatory paragraphs between these elements." A pillar is its heading (an
 *     h2) and its paragraphs (one <p> each, in order); the component that draws it types neither.
 *       PLAN_PILLAR — over the plans (HowToSection.tsx).
 *
 * PURE, NO DIRECTIVE: no import, no state, no clock — one string each (a pillar: its heading and its paragraphs), so a
 * client component, a server component and a test all read the same words.
 */

export const WHAT_WE_DO_HEADING = 'What We Do';

export const ABOUT_US_HEADING = 'About Us';

export const OUR_STORY_HEADING = 'Our Story';

export const SAVE_TRIPS_LINE = 'Create a free account to save your trips.';

/** A pillar under "What We Do": its heading, then its paragraphs in order. */
export interface Pillar {
  readonly heading: string;
  readonly paragraphs: readonly string[];
}

export const PLAN_PILLAR: Pillar = {
  heading: 'Plan Your Escape.',
  paragraphs: [
    'Get your bank data. Turn it into financial statements. See your income and expenses, what you own, what you owe, and what living at home actually costs.',
    'Plan ahead, budget for what you want to do, prepare for tax time, and compare your plans with what actually happened.',
    'Connect the dots across your personal, business, and trading finances to make better decisions about what comes next.',
  ],
};
