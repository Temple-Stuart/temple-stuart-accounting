/**
 * FOOTER-02 (Alex, design canvas: the board approved 2026-11-12 23:30 Manila — "lets get the hand off! yeet yett! i like it!") — THE
 * LOCKUP, ONE HOME: the gold crest and the wordmark.
 *
 * The top bar opens with them (src/components/landing/LandingHeader.tsx, HERO-CREST-01), and the footer now does too
 * (src/components/landing/LandingFooter.tsx; design-refs/footer-02/README.md: "the top bar's gold crest and wordmark, linking to
 * /"). Until FOOTER-02 the bar held both: BAR_MARK_SRC was its export, and the wordmark was typed in its JSX. They live here now,
 * and the bar and the footer both read them here.
 *
 * PURE, NO DIRECTIVE. LandingHeader.tsx is 'use client', and LandingFooter.tsx is a server component under /pricing,
 * /how-it-works and /my-trip/[id]. An export of a 'use client' module reaches a server component as a client reference, not as
 * its string, so the footer never reads these from the bar — as it reads PIPELINE_PATH from pipelineWords.ts, never from the
 * deck's 'use client' file. The bar re-exports BAR_MARK_SRC, where its readers (heroCrest01) find it.
 * NOT THIS HOME'S: the day card's own BRAND_WORDS (src/components/workbench/operations/day/dayCard.ts) — the card's word, left
 * with the card.
 */

/** The mark the design ships for the bar, and for the footer's lockup: public/brand/temple-stuart-crest.png with its white knocked out and its ink gold. */
export const BAR_MARK_SRC = '/brand/temple-stuart-crest-gold.png';

/** The wordmark beside the mark — in the bar, and in the footer's lockup. */
export const BAR_WORDMARK = 'TEMPLE STUART';
