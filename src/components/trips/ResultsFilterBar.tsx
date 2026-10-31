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
 *
 * FINISH-01 (2026-09-28): THE FILTERS SIT ABOVE SEARCH, on the transfers lane
 * too. This bar's one consumer (ActivityResultsView — the transfers rail) drew it
 * above the rows, i.e. AFTER the Search button and only once a search had
 * answered. The CONTROLS (sort, rating) now mount in the transfers search form,
 * before its submit (PublicTransferSearch, through ActivityResultsView's
 * TransferFiltersBar — the FILTER-01 pattern); the shown/total note is a fact
 * about the rows, so it stays with them (ResultsShownNote). Same controls, same
 * options, same words — split, not rewritten. Neither part fetches: a control
 * reports its value up and the rows re-derive; a search runs only on Search.
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
}

/** The controls: sort and minimum rating. Each reports its value up — nothing else. */
export default function ResultsFilterBar({
  sort,
  minRating,
  onSortChange,
  onMinRatingChange,
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2" data-results-filters>
      <label className={`flex items-center gap-2 ${TRAVEL_LABEL_CLASS}`}>
        Sort
        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value as SortKey)}
          data-results-filter="sort"
          className="rounded border border-border bg-bg-row px-2 py-1 font-sans text-xs font-normal normal-case tracking-normal text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple"
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
            data-results-filter="minRating"
            className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
              minRating === r.value
                ? 'border-brand-purple bg-brand-purple-wash font-medium text-brand-purple'
                : 'border-border text-text-secondary hover:bg-bg-row'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The rows' own note: "Showing X of Y" when a control narrowed them, and the
 *  route's cap when it was hit (PR-CHIP-1 ruling 3) — words unchanged. */
export function ResultsShownNote({ shownCount, totalCount, capNote }: {
  shownCount?: number;
  totalCount?: number;
  /** PR-CHIP-1 (ruling 3): truncation disclosure, e.g. "Top 12 results" — the
   *  caller passes it only when the route-side cap was actually hit. */
  capNote?: string;
}) {
  const showingHint =
    typeof shownCount === 'number' && typeof totalCount === 'number' && shownCount !== totalCount;
  if (!showingHint && !capNote) return null;
  return (
    <div className="mb-1 text-right text-xs text-text-faint" data-results-shown>
      {showingHint ? `Showing ${shownCount} of ${totalCount}` : ''}
      {showingHint && capNote ? ' · ' : ''}
      {capNote ?? ''}
    </div>
  );
}
