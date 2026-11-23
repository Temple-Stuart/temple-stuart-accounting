'use client';

/**
 * TripPostJournal (TRIPPOST-02, Alex, 2026-11-23) — the journal of a written-up stop's page (design-refs/trippost-02, README,
 * Behaviour): the post's days as a calendar, seven across from the weekday of its first day, a date with no entry an empty seat;
 * the open day, with its chips and two arrows; the weeks. Every day is in the markup — one shown, the rest carrying hidden — and it
 * opens on the post's first day. A day's seat, a week (it opens its first day) and the arrows open a day; the week holding the open
 * day is lit. At an end an arrow says so (aria-disabled), fades, keeps the focus and does nothing when pressed. The keyboard's order
 * through it: the days, the two arrows, the weeks.
 * Read that day stands outside it — a plain link to the journal that names its day (data-trip-post-pick) — so the journal listens on
 * the document for a press on such a link outside itself, and opens that day. A link naming no day of this journal opens none.
 *
 * Its one state is the open day, in React state alone: nothing is stored, nothing is written to the address, no clock. It imports no
 * leaf as a value: every word reaches it as a prop from src/components/trip/TripPostView.tsx (ruling l). Which week holds a day, and
 * whether an arrow is at its end, are pure functions, exported and tested (src/lib/__tests__/tripPost02.test.ts).
 */

import { useEffect, useRef, useState } from 'react';
import type { CalendarSeat } from '@/lib/tripFigures';

/** A chip of a day: its kind (the hook), the kind's words, what it names. */
export interface JournalChip {
  kind: string;
  label: string;
  value: string;
}

/** A day of the journal, in the words it is drawn in. */
export interface JournalDay {
  date: string;
  /** The day's name — its seat's, and the open day's first line. */
  label: string;
  /** Its seat's words: the date's own two digits. */
  seat: string;
  /** Its place among the post's days. */
  place: string;
  /** Its week's eyebrow. */
  week: string;
  weekTitle: string;
  story: string;
  chips: JournalChip[];
}

/** A week: its number, its eyebrow, its title and its first day. */
export interface JournalWeek {
  n: number;
  when: string;
  title: string;
  first: string;
}

/** Which week holds a day: the last week whose first day is not after it. `weekStarts` are the weeks' first days, by their place among the days. */
export function weekOfDay(weekStarts: readonly number[], day: number): number {
  let week = 0;
  weekStarts.forEach((start, w) => {
    if (start <= day) week = w;
  });
  return week;
}

/** Whether each arrow stands at its end: the earlier at the first day, the later at the last. */
export function arrowEnds(day: number, days: number): { earlier: boolean; later: boolean } {
  return { earlier: day === 0, later: day === days - 1 };
}

export default function TripPostJournal({ span, count, weekdays, seats, days, weeks, earlier, later, join }: {
  span: string;
  count: string;
  weekdays: readonly string[];
  seats: readonly CalendarSeat[];
  days: readonly JournalDay[];
  weeks: readonly JournalWeek[];
  earlier: string;
  later: string;
  join: string;
}) {
  const [open, setOpen] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const weekStarts = weeks.map((week) => days.findIndex((day) => day.date === week.first));
  if (weekStarts.some((start) => start === -1)) throw new Error('TripPostJournal: a week whose first day is no day of the journal');
  const openWeek = weekOfDay(weekStarts, open);
  const ends = arrowEnds(open, days.length);

  // Read that day, outside the journal: a press on a link naming a day opens that day
  useEffect(() => {
    const dates = days.map((day) => day.date);
    const onPress = (event: MouseEvent): void => {
      if (!(event.target instanceof Element)) return;
      const link = event.target.closest('a[data-trip-post-pick]');
      if (link === null || root.current === null || root.current.contains(link)) return;
      const pick = link.getAttribute('data-trip-post-pick');
      if (pick === null) return;
      const day = dates.indexOf(pick);
      if (day > -1) setOpen(day);
    };
    document.addEventListener('click', onPress);
    return () => document.removeEventListener('click', onPress);
  }, [days]);

  return (
    <div className="ts-post-journal" ref={root}>
      <div className="ts-post-cal">
        <div className="ts-post-cal__head"><p className="ts-post-cal__span">{span}</p><p className="ts-post-cal__count">{count}</p></div>
        <div className="ts-post-cal__weekdays" aria-hidden="true">{weekdays.map((weekday, i) => <span key={i}>{weekday}</span>)}</div>
        <div className="ts-post-cal__grid">
          {seats.map((seat) => {
            const entry = seat.entry;
            if (entry === null) return <span key={seat.date} className="ts-post-day ts-post-day--none" aria-hidden="true" />;
            return (
              <button key={seat.date} type="button" className={entry === open ? 'ts-post-day ts-post-day--on' : 'ts-post-day'} aria-label={days[entry].label} aria-pressed={entry === open} data-trip-post-pick={seat.date} onClick={() => setOpen(entry)}>
                {days[entry].seat}
              </button>
            );
          })}
        </div>
      </div>
      <div className="ts-post-entries">
        <div className="ts-post-steps">
          <button type="button" className={ends.earlier ? 'ts-post-step ts-post-step--off' : 'ts-post-step'} aria-label={earlier} aria-disabled={ends.earlier} onClick={() => { if (!ends.earlier) setOpen(open - 1); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 3L5 8l5 5" /></svg>
          </button>
          <button type="button" className={ends.later ? 'ts-post-step ts-post-step--off' : 'ts-post-step'} aria-label={later} aria-disabled={ends.later} onClick={() => { if (!ends.later) setOpen(open + 1); }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5" /></svg>
          </button>
        </div>
        {days.map((day, i) => (
          <div key={day.date} className="ts-post-entry" data-trip-post-day={day.date} hidden={i !== open}>
            <p className="ts-post-entry__day"><span>{day.label}</span>{join}{day.place}</p>
            <p className="ts-post-entry__week">{day.week}{join}<span>{day.weekTitle}</span></p>
            <p className="ts-post-entry__story">{day.story}</p>
            {day.chips.length > 0 && (
              <div className="ts-post-entry__chips">
                {day.chips.map((chip) => <span key={chip.kind} className="ts-post-chip" data-trip-post-chip={chip.kind}><span className="ts-post-chip__kind">{chip.label}</span><span>{chip.value}</span></span>)}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="ts-post-weeks">
        {weeks.map((week, w) => (
          <button key={week.n} type="button" className={w === openWeek ? 'ts-post-week ts-post-week--on' : 'ts-post-week'} aria-pressed={w === openWeek} data-trip-post-week={week.n} data-trip-post-pick={week.first} onClick={() => setOpen(weekStarts[w])}>
            <span className="ts-post-week__when">{week.when}</span><span className="ts-post-week__title">{week.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
