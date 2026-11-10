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
 * PURE, NO DIRECTIVE: no import, no state, no clock — one string each, so a client component, a server component and
 * a test all read the same words.
 */

export const WHAT_WE_DO_HEADING = 'What We Do';

export const ABOUT_US_HEADING = 'About Us';

export const OUR_STORY_HEADING = 'Our Story';

export const SAVE_TRIPS_LINE = 'Create a free account to save your trips.';
