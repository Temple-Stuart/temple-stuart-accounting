'use client';

/**
 * StopZeroSection — ABOUT US, on the guest landing (Landing.tsx) between the Travel Marketplace (and the guest's strip, when a
 * guest has one) and Our Story. Alex's words in ONE readable column — HOME-BRIEF-02's structure (Alex's home page brief,
 * 2026-11-10 16:27): the heading, the place, the dates, then three parts, each an h3, its paragraphs and its quote last. No grid,
 * no card, no timeline, no border on a quote. (STOP0-01, 2026-11-08, drew his letter beside a dated timeline here; both went with
 * that ruling — git history holds them.)
 *
 * HOME-ABOUT-01 (Alex, 2026-11-12 21:43 Manila: "ok last but not least , mock up that about me section"; the boards approved on
 * the design canvas at 21:53: "okayy give me the prompt to send it!") — AS DRAWN. The spec is a file, not this note:
 * design-refs/home-about-01/Section-Reference.html ("Every value in its stylesheet is the design, and its markup is the page"),
 * with its README beside it. This section is that file's section, element for element; its classes are the reference's own
 * behind the house prefix (.about → .ts-about), and their rules are the reference's own, ported to src/app/globals.css
 * (src/lib/__tests__/homeAbout01.test.ts holds both equal). What he approved is the letter, centred: the column 680px at most
 * in the middle of the page; under the heading, Stop 0 as a small outlined tag, the place, and the dates in the trip cards'
 * date look; then each part — a hairline, its number, its heading, his paragraphs — and his quote as a statement, centred, its
 * two curly marks drawn in gold.
 *   · THE HEADING keeps the act headings' type, the classes What We Do's h2 wears (Landing.tsx) since Alex's note of 2026-11-12
 *     ("i like how about us and What We do were the same. About us is better size"), without the 'mt-3' it wore until now, as
 *     What We Do's went. The reference's rule for it is not ported.
 *   · ONE PART OF HOME-BRIEF-02 REVERSES: it set "the dates in italics"; they wear the trip cards' date look now — violet mono,
 *     upright — as the approved board draws them.
 *   · THE WORDS are the leaves', and none is typed here: the heading from src/lib/homeActWords.ts, the rest from
 *     src/lib/stopZeroWords.ts, which stays byte for byte ("Never reworded, trimmed or added to here: a change to these words is
 *     Alex's."). Two pure helpers below split what the section draws — the place line at its " | " (the stop, then the place),
 *     and each quote into its two curly marks and its words — and each refuses, by name, a string without that shape. The parts'
 *     numbers come from his order and are aria-hidden: the heading under each says which part it is.
 *   · THE HOOKS STAY: id={STOP_ZERO_ANCHOR} (the footer's link lands on it), the aria-label "About us" on the <section> tag, the
 *     line under the section, and the mount in Landing.tsx.
 * No state, no fetch, no clock: it is text.
 *
 * UNTIL HOME-ABOUT-01 (HOME-BRIEF-02, 2026-11-10; the heading HOME-FINISH-02's, 2026-11-10 20:56): the section wore
 * 'w-full border-b border-border bg-bg-terminal' and its box 'max-w-7xl mx-auto px-4 lg:px-8 py-10 lg:py-14'; the h2
 * 'mt-3 text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold'; the place line, whole, 'mt-3 text-sm font-semibold
 * text-text-primary'; the dates 'mt-1 text-sm italic text-text-secondary'; each part 'mt-10' — its h3 'max-w-2xl text-lg
 * font-semibold text-text-primary', its paragraphs 'mt-4 max-w-2xl text-base leading-relaxed text-text-primary', and its quote,
 * whole and last, 'mt-6 max-w-2xl text-xl font-semibold leading-snug text-brand-purple'.
 */

import { ABOUT_US_HEADING } from '@/lib/homeActWords';
import { STOP_ZERO_ANCHOR, STOP_ZERO_DATES, STOP_ZERO_PLACE, STOP_ZERO_STORY } from '@/lib/stopZeroWords';

// THE CLASS GRAMMAR — one const, every string whole: the reference's classes behind the house prefix (their rules are the
// port's, globals.css), and the act headings' type on the h2.
const STOP = {
  section: 'ts-about',
  inner: 'ts-about__inner',
  column: 'ts-about__column',
  h2: 'text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold', // the act headings' type, What We Do's (Landing.tsx) — HOME-ABOUT-01 (2026-11-12): its 'mt-3' went, as What We Do's did
  meta: 'ts-about__meta',
  stop: 'ts-about__stop',
  place: 'ts-about__place',
  dates: 'ts-about__dates',
  part: 'ts-about-part',
  number: 'ts-about-part__number',
  h3: 'ts-about-part__title',
  paragraph: 'ts-about-part__text',
  quote: 'ts-about-part__quote',
  mark: 'ts-about-part__mark',
} as const;

/** A string without the shape a helper splits — refused by name. Never a guess, never a fallback. */
export class StopZeroShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StopZeroShapeError';
  }
}

/** Where the place line splits: the stop before it, the place after. */
const PLACE_SPLIT = ' | ';
/** A quote's own two marks, as his words carry them. */
const OPEN_MARK = '“';
const CLOSE_MARK = '”';

/** A half of a split: something, with no space at either end, no bar and no line break. */
const isHalf = (half: string): boolean => half !== '' && half === half.trim() && !half.includes('|') && !/[\r\n]/.test(half);

/**
 * The place line, split at its " | ": the stop, then the place. Its shape is exactly one " | " between two halves, each something
 * with no space at either end, no bar and no line break. Anything else is refused by name.
 */
export function placeParts(line: string): { stop: string; place: string } {
  const halves = line.split(PLACE_SPLIT);
  if (halves.length !== 2 || !halves.every(isHalf)) {
    throw new StopZeroShapeError(`placeParts: "${line}" is not the stop, " | ", then the place`);
  }
  return { stop: halves[0], place: halves[1] };
}

/**
 * A quote, split into its two curly marks and its words: “, the words, ”. Its shape is the opening mark first and the closing mark
 * last, with words between them — no other curly mark, no space at either end, no line break. Anything else is refused by name.
 */
export function quoteParts(quote: string): { open: string; words: string; close: string } {
  const words = quote.slice(OPEN_MARK.length, quote.length - CLOSE_MARK.length);
  const shaped = quote.length > OPEN_MARK.length + CLOSE_MARK.length && quote.startsWith(OPEN_MARK) && quote.endsWith(CLOSE_MARK)
    && !words.includes(OPEN_MARK) && !words.includes(CLOSE_MARK) && words === words.trim() && !/[\r\n]/.test(words);
  if (!shaped) {
    throw new StopZeroShapeError(`quoteParts: "${quote}" is not one quote inside its own two curly marks, “ and ”`);
  }
  return { open: OPEN_MARK, words, close: CLOSE_MARK };
}

/** A part's number, from his order: the first is 01. */
export function partNumber(index: number): string {
  return String(index + 1).padStart(2, '0');
}

export default function StopZeroSection() {
  const { stop, place } = placeParts(STOP_ZERO_PLACE);
  return (
    <section id={STOP_ZERO_ANCHOR} aria-label="About us" className={STOP.section}>
      <div className={STOP.inner}>
        <div className={STOP.column}>
          <h2 className={STOP.h2}>{ABOUT_US_HEADING}</h2>
          <div className={STOP.meta}>
            <span className={STOP.stop}>{stop}</span>
            <p className={STOP.place}>{place}</p>
            <p className={STOP.dates}>{STOP_ZERO_DATES}</p>
          </div>
        </div>
        {STOP_ZERO_STORY.map((part, index) => {
          const quote = quoteParts(part.quote);
          return (
            <div key={part.heading} className={STOP.part}>
              <div className={STOP.column}>
                <p className={STOP.number} aria-hidden="true">{partNumber(index)}</p>
                <h3 className={STOP.h3}>{part.heading}</h3>
                {part.paragraphs.map((paragraph) => <p key={paragraph} className={STOP.paragraph}>{paragraph}</p>)}
              </div>
              <blockquote className={STOP.quote}><span className={STOP.mark}>{quote.open}</span>{quote.words}<span className={STOP.mark}>{quote.close}</span></blockquote>
            </div>
          );
        })}
      </div>
    </section>
  );
}
