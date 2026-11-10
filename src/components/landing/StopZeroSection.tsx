'use client';

/**
 * StopZeroSection — ABOUT US (HOME-BRIEF-02, Alex's home page brief, 2026-11-10 16:27), between DONE-FOR-YOU and MY TRIP
 * on the guest landing (Landing.tsx): Alex's finalized text in ONE readable column — the heading, the place, the dates
 * in italics, then three sections, each an h3, its paragraphs and its quote last. No grid, no card, no timeline.
 * (STOP0-01, 2026-11-08, drew his letter beside a dated timeline here; both went with this ruling — git history holds them.)
 *
 * Every visible word comes from a leaf — the heading from src/lib/homeActWords.ts, the rest from src/lib/stopZeroWords.ts —
 * and none is typed here; the region's aria-label, "About us", sits on the <section> tag (the siblings' idiom). The id is
 * still STOP_ZERO_ANCHOR: the events band's "Read my story ↓" and the footer's link land on it. No state, no fetch, no clock.
 *
 * PAINT: house tokens only, zero new hex. A cream act with its own border-b, as before; the h2 is MY TRIP's idiom
 * (WasHereSection.tsx TRIP), the paragraph and the quote are the classes the letter wore.
 */

import { ABOUT_US_HEADING } from '@/lib/homeActWords';
import { STOP_ZERO_ANCHOR, STOP_ZERO_DATES, STOP_ZERO_PLACE, STOP_ZERO_STORY } from '@/lib/stopZeroWords';

// THE CLASS GRAMMAR — one const, every string whole, house tokens only. The act's own classes sit on its <section>, as ruled.
const STOP = {
  inner: 'max-w-7xl mx-auto px-4 lg:px-8 py-10 lg:py-14',
  h2: 'mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple',
  place: 'mt-3 text-sm font-semibold text-text-primary',
  dates: 'mt-1 text-sm italic text-text-secondary',
  part: 'mt-10',
  h3: 'max-w-2xl text-lg font-semibold text-text-primary',
  paragraph: 'mt-4 max-w-2xl text-base leading-relaxed text-text-primary',
  // No left border, no card: the quote is its section's own last line, set larger.
  quote: 'mt-6 max-w-2xl text-xl font-semibold leading-snug text-brand-purple',
} as const;

export default function StopZeroSection() {
  return (
    <section id={STOP_ZERO_ANCHOR} aria-label="About us" className="w-full border-b border-border bg-bg-terminal">
      <div className={STOP.inner}>
        <h2 className={STOP.h2}>{ABOUT_US_HEADING}</h2>
        <p className={STOP.place}>{STOP_ZERO_PLACE}</p>
        <p className={STOP.dates}>{STOP_ZERO_DATES}</p>
        {STOP_ZERO_STORY.map((part) => (
          <div key={part.heading} className={STOP.part}>
            <h3 className={STOP.h3}>{part.heading}</h3>
            {part.paragraphs.map((paragraph) => <p key={paragraph} className={STOP.paragraph}>{paragraph}</p>)}
            <blockquote className={STOP.quote}>{part.quote}</blockquote>
          </div>
        ))}
      </div>
    </section>
  );
}
