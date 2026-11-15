'use client';

/**
 * AboutBand — ABOUT US ON THE GUEST LANDING, AS ONE BAND (HOME-TRIM-01 — Alex's brief, 2026-11-14 19:11 Manila, with his four beta
 * users' notes on the home page; the boards approved on the design canvas at 20:01, the corrected boards at 20:41; built 2026-11-15).
 * Two of the notes, as he pasted them: "Cut the scrolling length of the landing page in half. Make the user explore to find the
 * information behind info pages" · "Like for Mobile, put your story behind a page and make it a vertical scroll." His approval of the
 * boards, 20:01 Manila: "ALL LOOKS GOOD … OTHERWISE, LETS DO IT".
 *
 * HOME-ABOUT-02 (Alex's brief, 2026-11-15 22:40 Manila; built 2026-11-15) — THE BAND SHOWS THE LETTER'S THREE PARTS. Alex, looking at
 * this band on the live home page, 2026-11-15 22:40 Manila: "Update the homepage About Us section to display all three quotes, one at
 * the end of each corresponding section, instead of displaying only one." And at 22:49 Manila: "it should be all showing, no swipe on
 * quotes, cause they flow into eachother."
 *
 * WHAT IT IS: the heading, the letter's three parts — each its number, its title and the quote that ends it in the letter — and one
 * door that opens the letter on its own page, /about (HOME-ABOUT-02, 2026-11-15: "the heading, the first quote of Alex's letter, and
 * one door" until then). Landing.tsx mounts it in the seat the letter held, between the Travel Marketplace and Our Story; the letter
 * itself — StopZeroSection.tsx — is mounted by /about's page alone now (src/app/about/page.tsx, HOME-PAGES-01), whole, its layout and
 * its code as they were ("whole and unchanged" until HOME-ABOUT-02, 2026-11-15, which gave its second quote Alex's new first sentence).
 *
 * AS DRAWN. The spec is a file, not this note: design-refs/home-about-02/Section-Reference.html ("Every value in its stylesheet is the
 * design, and its markup is the page."), with its README beside it — since HOME-ABOUT-02 (2026-11-15); until then the spec was
 * design-refs/home-trim-01's, which stays in the tree, the record of the first band. This section is that file's section, element for
 * element; its classes are the reference's own behind the house prefix (.aboutband → .ts-aboutband), but for the heading's (HOME-TRIM-01's
 * f, below), and their rules are the reference's own, ported to src/app/globals.css (src/lib/__tests__/homeAbout02.test.ts holds both
 * equal; homeTrim01.test.ts held the first band and its port to design-refs/home-trim-01 until then).
 *
 * HOME-ABOUT-02'S RULINGS BUILT HERE (Alex's brief, 2026-11-15 22:40 Manila):
 *   a. "THE BAND SHOWS ALL THREE PARTS OF THE LETTER. Under the heading, an ordered list: each part of STOP_ZERO_STORY in his order, as
 *      its number, its heading and its quote. Then the door. At every width all three show; nothing swipes, folds or hides. The heading
 *      keeps the act headings' classes; the section keeps aria-label="About us" and carries no id." — the <ol> below, one <li> for each
 *      part, in the leaf's order: its number, its h3, its quote; then the one <Link>. The port stands the three side by side from 1024px
 *      and stacks them under it; at no width does it hide one.
 *   b. "THE BAND'S WORDS COME FROM THE LEAVES. It types none of them. Each number is partNumber(index), and each quote is split by
 *      quoteParts, both imported from ./StopZeroSection as quoteParts is today; no second helper is written. ABOUT_US_HEADING stays its
 *      heading, and its door stays a next/link Link to ABOUT_PATH with ABOUT_US_DOOR." — every word drawn is handed in, in braces: the
 *      heading and the door's words from homeActWords.ts, each part's heading and quote from stopZeroWords.ts — of that leaf this file
 *      reads STOP_ZERO_STORY and nothing else — and each part's number from the letter's own partNumber.
 *
 * HOME-TRIM-01'S RULINGS BUILT HERE (its brief of 2026-11-14, above), each with what stands of it since HOME-ABOUT-02 (2026-11-15):
 *   a. "THE LETTER IS NOT REDRAWN. StopZeroSection.tsx's code, its port (.ts-about…) and design-refs/home-about-01 do not change.
 *      /about shows the letter exactly as main does. src/lib/stopZeroWords.ts stays byte for byte: nothing in it goes false. Its header
 *      names the section that draws all of its words; the band reads one quote and says so in its own file." — said here until
 *      HOME-ABOUT-02 (2026-11-15): "of that leaf this file reads ONE thing, STOP_ZERO_STORY[0].quote, the letter's first quote, and draws
 *      it under the same heading. It draws no other word of the leaf, and no class of the letter's port." It reads the leaf's three parts
 *      now (b, above) and still draws no class of the letter's port; the leaf's second quote is Alex's new words since then (its ruling c).
 *   c. "THE WORDS. Nothing is typed in the band. The heading is ABOUT_US_HEADING. The quote is STOP_ZERO_STORY[0].quote, split by
 *      the letter's own quoteParts, imported from ./StopZeroSection: no second split is written, and a quote without that shape is
 *      refused by name, as it is there. "Read my story →" is new: one constant, ABOUT_US_DOOR, in src/lib/homeActWords.ts beside
 *      ABOUT_US_HEADING, the arrow in the string, with a dated note. It does not go in stopZeroWords.ts (stopZero01:189 holds that
 *      "Read my story" is typed nowhere in that leaf)." — nothing is typed in the band still, and each quote is split by that helper
 *      (HOME-ABOUT-02, 2026-11-15: "the three words drawn are imported, from two leaves: the heading and the door's words from
 *      homeActWords.ts, the quote from stopZeroWords.ts" until then). quoteParts throws StopZeroShapeError on a quote without its two
 *      curly marks: no guess, no fallback.
 *   d. "THE DOOR is a next/link Link to ABOUT_PATH (src/lib/homePages.ts), read by the band and not retyped. No button element, no
 *      state, no modal, no script." — one <Link>, the page's path read from the pages' leaf. It is the section's one tab stop.
 *   e. "THE SEAT. In Landing.tsx the band's import takes the letter's on :204 and its mount takes the letter's on :753. The notes
 *      around them are re-said. No line moves. The section keeps aria-label="About us" and carries no id: STOP_ZERO_ANCHOR stays the
 *      letter's section's alone (src/lib/homeAnchors.ts:28), the band does not read it, and /#stop-0 does nothing on the home page,
 *      as the old-links effect's note already says (Landing.tsx:453). No redirect is added." — the label is typed on the <section>
 *      tag below, as the letter types its own (StopZeroSection.tsx): no leaf holds those two words, and they are not drawn. No id.
 *   f. "THE HEADING wears the act headings' classes, the string What We Do's h2 and the letter's h2 wear. The reference's rule for it
 *      is not ported." — BAND.h2, below: the same string, whole.
 *
 * 'use client', as the letter's file is: this file calls two functions that file exports, quoteParts and partNumber ("a function that
 * file exports (quoteParts)" until HOME-ABOUT-02, 2026-11-15), and a file with the directive hands a server file only a reference to it.
 * Landing.tsx, which mounts the band, is a client file too.
 * No state, no effect, no fetch, no clock: it is text and one link.
 */

import Link from 'next/link';
import { ABOUT_US_DOOR, ABOUT_US_HEADING } from '@/lib/homeActWords';
import { ABOUT_PATH } from '@/lib/homePages';
import { STOP_ZERO_STORY } from '@/lib/stopZeroWords';
import { partNumber, quoteParts } from './StopZeroSection';

// THE CLASS GRAMMAR — one const, every string whole: the reference's classes behind the house prefix (their rules are the port's,
// globals.css), and the act headings' type on the h2. HOME-ABOUT-02 (2026-11-15): the reference's list and its parts — each part's
// number and h3 — join; the words' column (words: 'ts-aboutband__words') went with the first band's layout, its rule with it.
const BAND = {
  section: 'ts-aboutband',
  inner: 'ts-aboutband__inner',
  h2: 'text-3xl sm:text-4xl font-medium tracking-tight text-brand-gold', // the act headings' type: What We Do's (Landing.tsx) and the letter's (StopZeroSection.tsx)
  parts: 'ts-aboutband__parts',
  part: 'ts-aboutband__part',
  number: 'ts-aboutband__number',
  h3: 'ts-aboutband__heading',
  quote: 'ts-aboutband__quote',
  mark: 'ts-aboutband__mark',
  go: 'ts-aboutband__go',
} as const;

export default function AboutBand() {
  return (
    <section className={BAND.section} aria-label="About us">
      <div className={BAND.inner}>
        <h2 className={BAND.h2}>{ABOUT_US_HEADING}</h2>
        <ol className={BAND.parts}>
          {STOP_ZERO_STORY.map((part, index) => {
            const quote = quoteParts(part.quote);
            return (
              <li key={part.heading} className={BAND.part}>
                <p className={BAND.number} aria-hidden="true">{partNumber(index)}</p>
                <h3 className={BAND.h3}>{part.heading}</h3>
                <blockquote className={BAND.quote}><span className={BAND.mark}>{quote.open}</span>{quote.words}<span className={BAND.mark}>{quote.close}</span></blockquote>
              </li>
            );
          })}
        </ol>
        <Link className={BAND.go} href={ABOUT_PATH}>{ABOUT_US_DOOR}</Link>
      </div>
    </section>
  );
}
