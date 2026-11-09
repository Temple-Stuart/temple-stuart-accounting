/**
 * Alex's own words (2026-11-08 13:52), edited for spelling and length, approved by him — the original is quoted in claude/blog-direction-2026-11-08.md (STOP0-01)
 *
 * STOP 0 (STOP0-01, Alex, 2026-11-08 15:11 + 16:18; board K tags 7-8) — the letter between the events and MY TRIP
 * (src/components/landing/StopZeroSection.tsx), and the one line at the foot of the events band that links to it
 * (src/components/landing/ExperiencesSection.tsx). Every visible word either one renders comes from here; neither types one.
 *
 * PURE: no clock, no locale call, no fetch, no React. The timeline's last two rows are derived, never typed: the first
 * commit's day through dayWords (src/lib/experienceWords.ts), and Stop 1 from the trip log's first row in trip order
 * (tripOrder and stopWords, src/lib/wasHereWords.ts).
 */

import type { WasHereRow } from './wasHere';
import { dayWords } from './experienceWords';
import { stopWords, tripOrder } from './wasHereWords';

/** The section's anchor — the events band's "Read my story ↓" names it. */
export const STOP_ZERO_ANCHOR = 'stop-0';
export const STOP_ZERO_EYEBROW = 'STOP 0';
export const STOP_ZERO_HEADLINE = 'None of the blogs actually told me how to do it.';
/** The letter: five paragraphs, in his order. */
export const STOP_ZERO_LETTER = [
  "I've been reading travel blogs since 2003. That year I got a subscription to Transworld Snowboarding, saw a resort that looked better than the one I grew up riding, and googled it. The world of travel and lifestyle blogs opened up. Twenty-three years later, I still read them.",
  "Snowboarding wasn't the only thing. I wanted to see wildlife, the wonders of the world, music and arts festivals, the biggest sporting events. Every one of them has blogs. They write about the experience, hand you a bunch of affiliate links, and take a slice when you book.",
  "None of them showed me how to actually do it. How to get your bank data. How to turn it into a financial statement. How to see your income and expenses. How to know what living at home costs, so you have a benchmark to weigh your travel against. How to set up a system to earn income abroad.",
  "So instead of venting about it, I cashed in my retirement, went out to live it, made a ton of mistakes, and built the system as I went.",
  "Even if nobody reads this, it's my letter to myself. And once something's in writing, if it's wrong, I have to keep looking at it until I go back and fix it. That's how the process gets better.",
] as const;
export const STOP_ZERO_QUOTE = "“I don't just want to sell you the dream. I want to guide you into living it.”";
export const STOP_ZERO_SIGNATURE = '— Alex';
export const STOP_ZERO_TIMELINE_LABEL = 'HOW I GOT HERE';

/**
 * STOP0-01 (2026-11-09): the day of the first commit on main — f85dbd8d (f85dbd8d79bb3aef9f114cce4f38a176b38229d5),
 * "Initial commit from Create Next App", 2025-09-04T18:26:29Z (11:26 -0700), no parent. Checked through the GitHub API
 * (`gh api repos/Temple-Stuart/temple-stuart-accounting/commits/f85dbd8d`), never a shallow clone's log, which shows a
 * later commit. Main's other root, 28ed9927 ("Initial commit"), came eight minutes later the same day (a commits-only
 * clone's `git rev-list --max-parents=0 main`); c0eee8c merged the two.
 */
export const FIRST_COMMIT_ON = '2025-09-04';

/** One row of HOW I GOT HERE: when, then what. Not exported: the module's exports are exactly the ruled list (STOP0-01 CLOSED 1). */
interface StopZeroRow {
  when: string;
  what: string;
}

/**
 * HOW I GOT HERE — six rows: the four years he wrote down, then the first commit's day and Stop 1, both derived. Stop 1
 * is the first row of the trip log in trip order: its start through dayWords, its city as the row holds it — "Jul 1,
 * 2026" and "Stop 1: Canggu, Bali." today (src/lib/wasHere.ts canggu-2026-07). An empty log has no Stop 1, so this
 * throws rather than draw the timeline without it.
 */
export function stopZeroTimeline(rows: readonly WasHereRow[]): readonly StopZeroRow[] {
  const first = tripOrder(rows)[0];
  if (first === undefined) throw new Error('stopZeroTimeline: the trip log has no stop — Stop 1 is its first row in trip order, never typed (STOP0-01)');
  return [
    { when: '2000', what: 'First time snowboarding. 2nd grade.' },
    { when: '2001', what: 'My first AIM account. 3rd grade.' },
    { when: '2002', what: 'My first snowboard. 4th grade.' },
    { when: '2003', what: 'Transworld Snowboarding → googled a resort → found the blogs. 5th grade.' },
    { when: dayWords(FIRST_COMMIT_ON), what: 'The first commit on this system.' },
    { when: dayWords(first.start), what: `${stopWords(1)}: ${first.city}.` },
  ];
}

/** K tag 7: the line at the foot of the events band, directly before its closing line, on every view. */
export const EVENTS_STORY_LABEL = 'WHY EVENTS FIRST';
export const EVENTS_STORY_LINE = 'In 5th grade I saw a resort in Transworld Snowboarding that looked better than mine, googled it, and found the travel blogs. The experience came first. The trip came second.';
export const READ_MY_STORY = 'Read my story ↓';
