'use client';

/**
 * ResultsFilterBar — a reusable, presentational sort + star-rating filter bar
 * (PR-T-Filters). It sits above the horizontal results scroller in
 * HotelResultsView + ActivityResultsView. Controlled via props; it holds NO
 * state, makes NO fetch — it just reports the user's sort/rating choice up, and
 * the view re-derives its displayed list with sortAndFilterResults (client-side).
 */

import type { SortKey } from '@/lib/resultsSortFilter';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'price-desc', label: 'Price: high to low' },
  { key: 'rating-desc', label: 'Rating: high to low' },
];

const RATINGS: { value: number; label: string }[] = [
  { value: 0, label: 'Any' },
  { value: 3, label: '3★+' },
  { value: 4, label: '4★+' },
  { value: 4.5, label: '4.5★+' },
];

interface Props {
  sort: SortKey;
  minRating: number;
  onSortChange: (s: SortKey) => void;
  onMinRatingChange: (r: number) => void;
  /** Optional "Showing X of Y" hint (shown only when filtered count < total). */
  shownCount?: number;
  totalCount?: number;
}

export default function ResultsFilterBar({
  sort,
  minRating,
  onSortChange,
  onMinRatingChange,
  shownCount,
  totalCount,
}: Props) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      <label className="flex items-center gap-2 text-xs text-text-muted">
        Sort
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          className="rounded border border-border bg-white px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple/40"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-1">
        <span className="mr-1 text-xs text-text-muted">Rating</span>
        {RATINGS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => onMinRatingChange(r.value)}
            aria-pressed={minRating === r.value}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              minRating === r.value
                ? 'border-brand-purple bg-brand-purple text-white'
                : 'border-border bg-white text-text-secondary hover:bg-bg-row'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {typeof shownCount === 'number' && typeof totalCount === 'number' && shownCount !== totalCount && (
        <span className="ml-auto text-xs text-text-faint">
          Showing {shownCount} of {totalCount}
        </span>
      )}
    </div>
  );
}
