/**
 * TripPostView (TRIPPOST-01, Alex, 2026-11-05) — one stop's page, the body of
 * /my-trip/<stop id> (src/app/my-trip/[id]/page.tsx). PURE and server-safe: props in, markup
 * out — no 'use client', no state, no effect, no fetch; the tests render it. Every word of the
 * post comes from src/lib/tripPosts.ts through src/lib/tripPostWords.ts; every word of the stop
 * and its events from src/lib/wasHere.ts through src/lib/wasHereWords.ts; the event it was
 * around from src/lib/experiences.ts through src/lib/experienceWords.ts; what it cost from
 * src/lib/tripCosts.ts — never typed here, the section headings aside.
 *
 * TRIPCARDS-01 (Alex, 2026-11-05): EVERY stop has this page, and it holds everything about the
 * stop that its card does not (the card is the stop and what it cost). Two kinds, by whether the
 * stop is written up (a post in tripPosts.ts):
 *   · WRITTEN — the post's title as the h1, its dek, the place and dates; the short version, what
 *     he'd do differently, what it cost (the stop's three, then the post's own), the month day by
 *     day, what was on, his picks, the band, the day it was written;
 *   · NOT WRITTEN YET — the place as the h1, the dates, the line that says which (booked ahead,
 *     or lived and not yet written); what it cost (the stop's three), what was on, the band.
 * Either kind also carries, when the stop holds them: Alex's line, the event the stop was around
 * (its block, as the card once drew it — the window's words with no day in them, so the static
 * page never goes stale), and DID / LEARNED.
 *
 * TOP TO BOTTOM: the back link; the eyebrow, the title, the dek, the meta; the stop's photo when
 * it has one (WasHereSection's figure — no placeholder while it is null); Alex's line; the event;
 * DID; LEARNED; THE SHORT VERSION; WHAT I'D DO DIFFERENTLY; WHAT IT COST; THE MONTH, DAY BY DAY —
 * one native <details> per week, the first open and the rest closed, no state and no script
 * (Tailwind's group-open swaps Open / Close); WHAT WAS ON WHILE I WAS THERE — the stop's own
 * events, each linking its source (none, no section); MY PICKS; the closing band, its button the
 * hero's money-action gold (Landing.tsx:506 — re-cited BUILTON-01, 2026-11-09: was :511; FOOTER-01, 2026-11-09: was :2100); the day it was written.
 *
 * PAINT: house tokens only, zero new hex, no new font — WasHereSection's TRIP grammar. 44px tap
 * targets. Nothing scrolls sideways at 390px. No emoji, no clock.
 */

import type { WasHereRow } from '@/lib/wasHere';
import type { TripPost } from '@/lib/tripPosts';
import type { TripCosts } from '@/lib/tripCosts';
import { experienceCategoryLabel, type Experience } from '@/lib/experiences';
import { experienceWindowLine } from '@/lib/experienceWords';
import { listWords, onPill, stayWords } from '@/lib/wasHereWords';
import { UNWRITTEN_COST_NOTE, bookLine, chipLabel, costRows, dayLabel, postEyebrow, postMeta, stopHeading, unwrittenLine, weekCount, weekEyebrow, writtenLine } from '@/lib/tripPostWords';
import { DEMO_ANCHOR, MY_TRIP_ANCHOR } from '@/lib/homeAnchors'; // FOOTER-01 (2026-11-09): the front door's anchors, from their one home

export const POST_BACK = '← Back to my trip';
export const POST_BACK_HREF = `/#${MY_TRIP_ANCHOR}`;
export const SHORT_VERSION = 'THE SHORT VERSION';
export const DIFFERENTLY = "WHAT I'D DO DIFFERENTLY";
export const WHAT_IT_COST = 'WHAT IT COST';
export const DAY_BY_DAY = 'THE MONTH, DAY BY DAY';
export const WHAT_WAS_ON_THERE = 'WHAT WAS ON WHILE I WAS THERE';
export const MY_PICKS = 'MY PICKS';
/** TRIPCARDS-01: the stop's two lists, as the card once headed them. */
export const DID = 'DID';
export const LEARNED = 'LEARNED';
export const BOOK_BUTTON = 'Book the stay and the flight';
/** The booking strip on the front door (Landing.tsx's live demo act, id={DEMO_ANCHOR}). */
export const BOOK_HREF = `/#${DEMO_ANCHOR}`;
export const OPEN_WORD = 'Open';
export const CLOSE_WORD = 'Close';

// THE CLASS GRAMMAR — one const, every string whole, house tokens only (WasHereSection's TRIP idiom).
const POST = {
  article: 'max-w-3xl mx-auto px-4 lg:px-8 pt-8 pb-10',
  back: 'inline-flex min-h-[44px] items-center text-sm text-brand-purple hover:text-brand-purple-hover',
  eyebrow: 'mt-4 font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint',
  h1: 'mt-3 text-3xl sm:text-4xl font-medium tracking-tight text-brand-purple',
  dek: 'mt-3 text-base sm:text-lg leading-relaxed text-text-secondary',
  unwritten: 'mt-4 rounded-lg border border-border-light bg-bg-row px-4 py-3 text-sm text-text-secondary',
  meta: 'mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs uppercase tracking-wider text-text-faint',
  figure: 'mt-6',
  image: 'aspect-[3/2] w-full rounded object-cover',
  credit: 'mt-1 font-mono text-[10px] text-text-faint',
  // TRIPCARDS-01: Alex's line and the event block, in WasHereSection's old card idiom.
  quote: 'mt-6 text-lg leading-relaxed text-text-primary',
  event: 'mt-6 rounded-lg border border-border-light bg-bg-row p-4',
  eventEyebrow: 'font-mono text-[10px] font-semibold uppercase tracking-wider text-brand-amber',
  eventName: 'mt-1 text-base font-semibold text-text-primary',
  eventVenue: 'mt-1 text-sm text-text-secondary',
  eventLine: 'mt-2 font-mono text-xs leading-relaxed text-text-primary',
  joined: 'mt-1 text-base leading-relaxed text-text-primary',
  paragraph: 'mt-2 text-base leading-relaxed text-text-primary',
  card: 'mt-8 rounded-lg border border-border bg-white p-5',
  section: 'mt-8',
  sectionEyebrow: 'font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint',
  shortGrid: 'mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 text-base text-text-primary',
  muted: 'text-text-secondary',
  lessons: 'mt-3',
  lesson: 'flex gap-4 border-t border-border-light py-3',
  lessonNumber: 'w-7 shrink-0 font-mono text-xs text-text-faint pt-1',
  lessonWords: 'text-base leading-relaxed text-text-primary',
  lessonLead: 'font-semibold',
  costRow: 'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-border-light py-3',
  costWhat: 'text-base font-semibold text-text-primary',
  costDetail: 'text-sm text-text-secondary',
  costAmount: 'font-mono text-sm text-text-primary',
  costNote: 'mt-3 text-xs text-text-muted',
  week: 'group mt-3 rounded-lg border border-border bg-white px-5',
  summary: 'flex min-h-[44px] cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-4 [&::-webkit-details-marker]:hidden',
  weekEyebrow: 'block font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint',
  weekTitle: 'mt-1 block text-lg font-semibold text-text-primary',
  weekCount: 'font-mono text-xs uppercase tracking-wider text-brand-purple',
  openWord: 'group-open:hidden',
  closeWord: 'hidden group-open:inline',
  day: 'grid grid-cols-1 gap-x-5 gap-y-2 border-t border-border-light py-4 sm:grid-cols-[7rem_1fr]',
  dayLabel: 'font-mono text-xs uppercase tracking-wider text-text-faint sm:pt-1',
  story: 'text-base leading-relaxed text-text-primary',
  chips: 'mt-2 flex flex-wrap gap-2',
  chip: 'inline-flex items-baseline gap-2 rounded border border-border bg-bg-row px-3 py-1 text-sm text-text-primary',
  chipKind: 'font-mono text-[10px] uppercase tracking-wider text-text-faint',
  pillRow: 'mt-3 flex flex-col gap-2',
  pill: 'inline-flex min-h-[44px] items-center whitespace-normal break-words rounded border border-border bg-bg-row px-3 py-2 text-left font-mono text-xs leading-snug text-text-primary hover:bg-brand-purple-wash',
  pick: 'mt-4 first:mt-3',
  pickHeading: 'font-mono text-[10px] font-semibold uppercase tracking-wider text-text-faint',
  pickItems: 'mt-1 text-base leading-relaxed text-text-primary',
  band: 'mt-2 bg-brand-purple text-white',
  bandInner: 'max-w-3xl mx-auto px-4 lg:px-8 py-10 flex flex-wrap items-center justify-between gap-4',
  bandLine: 'text-xl font-medium',
  // The hero's primary CTA (Landing.tsx:506 — the money-action gold; re-cited BUILTON-01, 2026-11-09: was :511; FOOTER-01, 2026-11-09: was :2100), at 44px.
  bandButton: 'inline-flex min-h-[44px] items-center px-6 py-3 bg-brand-gold text-white font-medium hover:bg-brand-gold/90 text-sm text-center',
  written: 'max-w-3xl mx-auto px-4 lg:px-8 py-6 font-mono text-xs text-text-faint',
} as const;

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));

export default function TripPostView({ row, costs, post, event, stop }: { row: WasHereRow; costs: TripCosts; post: TripPost | null; event: Experience | null; stop: number }) {
  // The two kinds of page — written up (its post) or not yet.
  const written = post === null ? null : { post };
  return (
    <div data-trip-post={row.id} data-trip-post-kind={written === null ? 'stop' : 'written'}>
      <article className={POST.article}>
        <a href={POST_BACK_HREF} className={POST.back} data-trip-post-back>{POST_BACK}</a>

        {written !== null ? (
          <header data-trip-post-section="header">
            <p className={POST.eyebrow}>{postEyebrow(stop)}</p>
            <h1 className={POST.h1}>{written.post.title}</h1>
            <p className={POST.dek}>{written.post.dek}</p>
            <p className={POST.meta}>
              {postMeta(row).map((part) => <span key={part}>{part}</span>)}
            </p>
          </header>
        ) : (
          <header data-trip-post-section="header">
            <p className={POST.eyebrow}>{postEyebrow(stop)}</p>
            <h1 className={POST.h1}>{stopHeading(row)}</h1>
            <p className={POST.meta}><span>{stayWords(row)}</span></p>
            <p className={POST.unwritten} data-trip-post-unwritten>{unwrittenLine(row)}</p>
          </header>
        )}

        {row.image !== null && (
          <figure className={POST.figure} data-trip-post-section="photo">
            {/* A plain <img>, WasHereSection's precedent: a file under public/, served as-is. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={row.image.src} alt={row.image.alt} className={POST.image} />
            <figcaption className={POST.credit}>{row.image.credit}</figcaption>
          </figure>
        )}

        {/* TRIPCARDS-01: what the card no longer carries — Alex's line, the event, DID and LEARNED. */}
        {row.line !== null && <p className={POST.quote} data-trip-post-section="line">{row.line}</p>}

        {event !== null && (
          <div className={POST.event} data-trip-post-section="event" data-trip-post-experience={event.id}>
            <p className={POST.eventEyebrow}>{event.series === null ? experienceCategoryLabel(event.category) : `${experienceCategoryLabel(event.category)} · ${event.series}`}</p>
            <p className={POST.eventName}>{event.name}</p>
            <p className={POST.eventVenue}>{event.venue}</p>
            <p className={POST.eventLine}>{experienceWindowLine(event)}</p>
          </div>
        )}

        {row.did.length > 0 && (
          <section aria-label="What I did" className={POST.section} data-trip-post-section="did">
            <p className={POST.sectionEyebrow}>{DID}</p>
            <p className={POST.joined}>{listWords(row.did)}</p>
          </section>
        )}

        {row.learned.length > 0 && (
          <section aria-label="What I learned" className={POST.section} data-trip-post-section="learned">
            <p className={POST.sectionEyebrow}>{LEARNED}</p>
            {row.learned.map((paragraph, i) => <p key={`learned-${i}`} className={POST.paragraph}>{paragraph}</p>)}
          </section>
        )}

        {written !== null && (
          <section aria-label="The short version" className={POST.card} data-trip-post-section="short">
            <p className={POST.sectionEyebrow}>{SHORT_VERSION}</p>
            <div className={POST.shortGrid}>
              {written.post.short.map((s) => (
                <p key={s.label}><span className={POST.muted}>{s.label}:</span> {s.value}</p>
              ))}
            </div>
          </section>
        )}

        {written !== null && (
          <section aria-label="What I'd do differently" className={POST.section} data-trip-post-section="differently">
            <p className={POST.sectionEyebrow}>{DIFFERENTLY}</p>
            <ol className={POST.lessons}>
              {written.post.lessons.map((l, i) => (
                <li key={l.lead} className={POST.lesson}>
                  <span className={POST.lessonNumber}>{two(i + 1)}</span>
                  <span className={POST.lessonWords}><strong className={POST.lessonLead}>{l.lead}</strong> {l.rest}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section aria-label="What it cost" className={POST.card} data-trip-post-section="cost">
          <p className={POST.sectionEyebrow}>{WHAT_IT_COST}</p>
          <div className="mt-2">
            {costRows(costs, written === null ? null : written.post).map((c) => (
              <div key={c.what} className={POST.costRow} data-trip-post-cost>
                <div>
                  <p className={POST.costWhat}>{c.what}</p>
                  {c.detail !== '' && <p className={POST.costDetail}>{c.detail}</p>}
                </div>
                <p className={POST.costAmount}>{c.amount}</p>
              </div>
            ))}
          </div>
          <p className={POST.costNote}>{written === null ? UNWRITTEN_COST_NOTE : written.post.costNote}</p>
        </section>

        {written !== null && (
          <section aria-label="The month, day by day" className={POST.section} data-trip-post-section="days">
            <p className={POST.sectionEyebrow}>{DAY_BY_DAY}</p>
            {written.post.weeks.map((week, w) => (
              <details key={week.title} className={POST.week} open={w === 0} data-trip-post-week={w + 1}>
                <summary className={POST.summary}>
                  <span>
                    <span className={POST.weekEyebrow}>{weekEyebrow(w + 1, week)}</span>
                    <span className={POST.weekTitle}>{week.title}</span>
                  </span>
                  <span className={POST.weekCount} data-trip-post-count>
                    {weekCount(week)} · <span className={POST.openWord}>{OPEN_WORD}</span><span className={POST.closeWord}>{CLOSE_WORD}</span>
                  </span>
                </summary>
                {week.days.map((day) => (
                  <div key={day.date} className={POST.day} data-trip-post-day={day.date}>
                    <p className={POST.dayLabel}>{dayLabel(day.date)}</p>
                    <div>
                      <p className={POST.story}>{day.story}</p>
                      {day.chips.length > 0 && (
                        <div className={POST.chips}>
                          {day.chips.map((chip) => (
                            <span key={chip.kind} className={POST.chip} data-trip-post-chip={chip.kind}>
                              <span className={POST.chipKind}>{chipLabel(chip.kind)}</span>{chip.value}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </details>
            ))}
          </section>
        )}

        {row.events.length > 0 && (
          <section aria-label="What was on while I was there" className={POST.section} data-trip-post-section="on">
            <p className={POST.sectionEyebrow}>{WHAT_WAS_ON_THERE}</p>
            <div className={POST.pillRow}>
              {row.events.map((ev) => (
                <a key={`${ev.name} · ${ev.start}`} href={ev.sourceUrl} rel="noopener" target="_blank" className={POST.pill} data-trip-post-event={ev.name}>
                  {onPill(ev)}
                </a>
              ))}
            </div>
          </section>
        )}

        {written !== null && (
          <section aria-label="My picks" className={POST.card} data-trip-post-section="picks">
            <p className={POST.sectionEyebrow}>{MY_PICKS}</p>
            {written.post.picks.map((p) => (
              <div key={p.heading} className={POST.pick}>
                <p className={POST.pickHeading}>{p.heading}</p>
                <p className={POST.pickItems}>{listWords(p.items)}</p>
              </div>
            ))}
          </section>
        )}
      </article>

      <section aria-label="Book the stay and the flight" className={POST.band} data-trip-post-section="book">
        <div className={POST.bandInner}>
          <p className={POST.bandLine}>{bookLine(row)}</p>
          <a href={BOOK_HREF} className={POST.bandButton}>{BOOK_BUTTON}</a>
        </div>
      </section>

      {written !== null && <p className={POST.written} data-trip-post-section="written">{writtenLine(written.post)}</p>}
    </div>
  );
}
