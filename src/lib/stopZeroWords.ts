/**
 * ABOUT US (HOME-BRIEF-02 — Alex's home page brief, 2026-11-10 16:27) — Alex's finalized text, EXACT: the place, the dates,
 * and three sections in his order, each a heading, its paragraphs and — last — its quote. Never reworded, trimmed or
 * added to here: a change to these words is Alex's. The section that draws them is
 * src/components/landing/StopZeroSection.tsx, under ABOUT_US_HEADING (src/lib/homeActWords.ts); it types none of them.
 *
 * WHAT WENT (HOME-BRIEF-02, 2026-11-10): STOP0-01's letter of 2026-11-08 — its eyebrow, headline, five paragraphs, quote
 * and signature — and its timeline, HOW I GOT HERE, with the first commit's day and the Stop 1 row derived from the trip
 * log; the three imports only the timeline used went with them. Those words are in git history.
 *
 * WHAT STAYS: STOP_ZERO_ANCHOR, the section's id (src/lib/homeAnchors.ts re-exports it; the footer's link lands on it).
 * The three words at the foot of the events band — WHY EVENTS FIRST, its line and "Read my story ↓" (STOP0-01, K tag 7) —
 * went with that paragraph, the same day.
 *
 * PURE: no import, no clock, no locale call, no fetch, no React.
 */

/** The section's anchor — src/lib/homeAnchors.ts re-exports it, and the footer's link lands on it. */
export const STOP_ZERO_ANCHOR = 'stop-0';

/** Where, then when — the two lines under the heading. */
export const STOP_ZERO_PLACE = 'Stop 0 | Los Angeles, California 🇺🇸';
export const STOP_ZERO_DATES = 'January to June 2026';

/** The three sections, in his order. Each line of his text is one paragraph; a section's quote is drawn last. */
export const STOP_ZERO_STORY = [
  {
    heading: 'Why I Built Temple Stuart',
    paragraphs: [
      "I've wanted to travel the world, build businesses, and work for myself for as long as I can remember.",
      "I've been reading travel blogs since 2003, exploring everything from natural wonders to festivals, sporting events, and destinations around the world.",
      "There's no shortage of people telling you where to go, what to see, and which links to click.",
      'But I kept wondering how to actually build a life that could afford those experiences.',
    ],
    quote: '“Everyone was showing me the life they were living. I wanted to understand how to build one of my own.”',
  },
  {
    heading: 'The Idea Behind Temple Stuart',
    paragraphs: [
      'I wanted to understand what living at home actually cost me, what I could afford elsewhere, and how to build a business that could finance it all.',
      "And I realized these weren't just travel problems.",
      "Whether you're managing personal finances, running a business, trading stocks, or planning a trip, you should be able to plan ahead, budget for it, and compare those plans with what actually happened.",
      'So I decided to build Temple Stuart.',
      "I cashed in my retirement savings to go all in. On New Year's Eve, instead of going out drinking and talking about my goals, I stayed home and started working on them.",
      'For the next six months, I focused on building connected bookkeeping, trading, and travel systems, all tied to a calendar.',
      'I wanted to separate personal, business, and trading finances, distinguish personal travel from business travel, and use actual financial records to make more informed plans and budgets.',
    ],
    quote: '“One connected system for managing your money, planning your future, and measuring the outcomes of your decisions.”',
  },
  {
    heading: 'Our Story Is Still Being Written',
    paragraphs: [
      'By June 30, my financial records had shown me something interesting.',
      'I could spend less money traveling the world than I was spending just to pay rent in Los Angeles.',
      "Unfortunately, my system wasn't quite ready. The travel booking platform couldn't handle my first trip, the trading algorithm wasn't ready for daily use, and bookkeeping still needed work.",
      'But I left anyway.',
      "I wanted to test what I'd built, learn from firsthand experience, and improve the system based on what actually worked.",
      "Besides, I'd rather spend my money living the life I wanted than sitting around watching other people live theirs.",
      "Every destination after Los Angeles is another chapter in the story of Temple Stuart. I'll be documenting what I planned, what I spent, what worked, what didn't, and how those experiences influence the business I'm building.",
      'Maybe you want to travel the world, start a business, manage your investments, or simply understand your finances better.',
      'Whatever your goal, I want Temple Stuart to help you make more informed decisions about how to get there.',
    ],
    quote: "“I don't just want to sell the dream. I want to guide people into living it for themselves.”",
  },
] as const;
