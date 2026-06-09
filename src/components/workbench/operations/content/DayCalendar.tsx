/**
 * DayCalendar — the LIVE, authed container for the day's time blocks.
 *
 * PR B split: this file keeps the EXACT live behavior it had before — it owns
 * the day feed (`useDayFeed(date)`, the 4 fetches: content grid, projects,
 * daily-plan items, trip day-blocks) and the entity context
 * (`useOperationsEntity`) — and now renders the pure <DayCalendarView/> with the
 * live `timeline`/`loading`/`error` + `entities` as props. The public name +
 * prop shape ({ date, onDateChange }) are unchanged, so the existing call site
 * (ContentPipeline.tsx:344) is untouched and /operations/content renders the day
 * EXACTLY as before — same 4 fetches, same teal/indigo/cyan fills, same layout.
 * The collapse + entity/source filters are pure UI state and live in the view.
 * NO new behavior, NO demo data, NO fallback.
 */

'use client';

import { useOperationsEntity } from '../EntitySelector';
import { useDayFeed } from './useDayFeed';
import DayCalendarView from './DayCalendarView';

export default function DayCalendar({
  date,
  onDateChange,
}: {
  date: string;
  onDateChange: (date: string) => void;
}) {
  const { timeline, loading, error } = useDayFeed(date);
  const { entities } = useOperationsEntity();

  return (
    <DayCalendarView
      date={date}
      onDateChange={onDateChange}
      timeline={timeline}
      loading={loading}
      error={error}
      entities={entities}
    />
  );
}
