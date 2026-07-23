'use client';

/**
 * ResultsFilterBar — a reusable, presentational sort + star-rating filter bar
 * (PR-T-Filters). It sits above the results list in HotelResultsView +
 * ActivityResultsView. Controlled via props; it holds NO state, makes NO fetch —
 * it just reports the user's sort/rating choice up, and the view re-derives its
 * displayed list with sortAndFilterResults (client-side).
 *
 * COMPACT-1b: classes moved to the panel-family dark vocabulary (the COMPACT-1
 * strip idiom — TRAVEL_LABEL_CLASS micro-labels, bg-white/10 fields, the
 * white/brand-purple active toggle from the teaser/trip-type buttons).
 */

import type { SortKey } from '@/lib/resultsSortFilter';
import { TRAVEL_LABEL_CLASS } from './travelSection';

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
      <label className={`flex items-center gap-2 ${TRAVEL_LABEL_CLASS}`}>
        Sort
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          className="rounded border border-white/20 bg-white/10 px-2 py-1 font-sans text-xs font-normal normal-case tracking-normal text-white focus:outline-none focus:ring-2 focus:ring-white/40"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-1">
        <span className={`mr-1 ${TRAVEL_LABEL_CLASS}`}>Rating</span>
        {RATINGS.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => onMinRatingChange(r.value)}
            aria-pressed={minRating === r.value}
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              minRating === r.value
                ? 'border-white bg-white font-medium text-brand-purple'
                : 'border-white/30 text-white/70 hover:bg-white/10'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {typeof shownCount === 'number' && typeof totalCount === 'number' && shownCount !== totalCount && (
        <span className="ml-auto text-xs text-white/40">
          Showing {shownCount} of {totalCount}
        </span>
      )}
    </div>
  );
}
