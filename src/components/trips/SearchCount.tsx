'use client';

/**
 * SearchCount — how many METERED searches this session has sent (FLIGHT-01;
 * shared by HOTEL-01, 2026-09-22). One control for every travel search surface:
 * the container counts in its one search function, the view shows the count
 * beside the SEARCH button. A filter change never moves it.
 */
export default function SearchCount({ count }: { count: number }) {
  return (
    <span className="font-mono text-[10px] text-text-faint" data-search-count={count}>
      {count} search{count === 1 ? '' : 'es'} this session
    </span>
  );
}
