'use client';

/**
 * StopZeroSection (STOP0-01, Alex, 2026-11-08 15:11 + 16:18; board K tag 8) — STOP 0, between the experiences and
 * MY TRIP on the guest landing (Landing.tsx): Alex's letter in his own words, and a short dated timeline of how he got
 * here. The events band's last line before its closing line, "Read my story ↓" (K tag 7), points at this section's id.
 *
 * Every visible word comes from src/lib/stopZeroWords.ts — none is typed here; the region's aria-label, "Stop 0", sits on
 * the <section> tag as ruled (the siblings' idiom). No state, no fetch, no clock: the timeline's last two rows are derived
 * there (stopZeroTimeline over the trip log's rows, src/lib/wasHere.ts WAS_HERE).
 *
 * PAINT: house tokens only, zero new hex. A cream act with its own border-b, as ruled; the eyebrow and the h2 are MY
 * TRIP's idioms (WasHereSection.tsx TRIP). The letter and the timeline card sit side by side from lg up, stacked below.
 */

import { WAS_HERE } from '@/lib/wasHere';
import {
  STOP_ZERO_ANCHOR, STOP_ZERO_EYEBROW, STOP_ZERO_HEADLINE, STOP_ZERO_LETTER, STOP_ZERO_QUOTE, STOP_ZERO_SIGNATURE,
  STOP_ZERO_TIMELINE_LABEL, stopZeroTimeline,
} from '@/lib/stopZeroWords';

// THE CLASS GRAMMAR — one const, every string whole, house tokens only. The act's own classes sit on its <section>, as ruled.
const STOP = {
  inner: 'max-w-7xl mx-auto px-4 lg:px-8 py-10 lg:py-14',
  grid: 'grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]',
  eyebrow: 'font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint',
  h2: 'mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple',
  paragraph: 'mt-4 max-w-2xl text-base leading-relaxed text-text-primary',
  // No left border, no card: the quote is the letter's own line, set larger.
  quote: 'mt-6 max-w-2xl text-xl font-semibold leading-snug text-brand-purple',
  signature: 'mt-4 font-mono text-xs text-text-secondary',
  card: 'self-start rounded-lg border border-border bg-white p-5',
  row: 'mt-3 flex gap-3',
  when: 'w-24 shrink-0 font-mono text-xs text-brand-purple',
  what: 'text-sm text-text-primary',
} as const;

export default function StopZeroSection() {
  const timeline = stopZeroTimeline(WAS_HERE);
  return (
    <section id={STOP_ZERO_ANCHOR} aria-label="Stop 0" className="w-full border-b border-border bg-bg-terminal">
      <div className={STOP.inner}>
        <div className={STOP.grid}>
          <div>
            <p className={STOP.eyebrow}>{STOP_ZERO_EYEBROW}</p>
            <h2 className={STOP.h2}>{STOP_ZERO_HEADLINE}</h2>
            {STOP_ZERO_LETTER.map((paragraph) => <p key={paragraph} className={STOP.paragraph}>{paragraph}</p>)}
            <blockquote className={STOP.quote}>{STOP_ZERO_QUOTE}</blockquote>
            <p className={STOP.signature}>{STOP_ZERO_SIGNATURE}</p>
          </div>
          <div className={STOP.card}>
            <p className={STOP.eyebrow}>{STOP_ZERO_TIMELINE_LABEL}</p>
            <ol>
              {timeline.map((row) => (
                <li key={`${row.when} ${row.what}`} className={STOP.row}>
                  <span className={STOP.when}>{row.when}</span>
                  <span className={STOP.what}>{row.what}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
