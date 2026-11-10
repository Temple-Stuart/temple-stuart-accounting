/**
 * HOME-ORDER-01 (Alex, 2026-11-10 16:27: "What We Do → About Us → Our Story") — THE HOME PAGE'S TWO ACT HEADINGS, each
 * typed ONCE, here.
 *   · WHAT_WE_DO_HEADING — the first child of the travel block's section on the home page (Landing.tsx, the h2 that
 *                          carries data-act-heading): the heading over travel booking, the events, the guest's strip,
 *                          the plans and the professional services.
 *   · OUR_STORY_HEADING  — the trip log's h2 (WasHereSection.tsx, MY_TRIP_HEADLINE), over the trip cards.
 * Stop 0 sits between the two acts; its words are its own leaf's (src/lib/stopZeroWords.ts), not this file's.
 *
 * PURE, NO DIRECTIVE: no import, no state, no clock — one string each, so a client component, a server component and
 * a test all read the same words.
 */

export const WHAT_WE_DO_HEADING = 'What We Do';

export const OUR_STORY_HEADING = 'Our Story';
