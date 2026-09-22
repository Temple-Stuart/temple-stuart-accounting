'use client';

/**
 * ActivityPickerView — ONE ACTIVITY, WHAT THE OPERATOR STATES (ACTIVITY-01, 2026-09-22).
 *
 * Renders the cards the PUBLIC activity search route returns
 * (/api/travel/activities/search → { cards, totalCount, currency }): one row per
 * product — the vendor's productCode is the identity, in the vendor's order —
 * with every attribute stated or "not stated by the operator", never a blank and
 * never a guess: the from-price with its own currency and basis, the extra
 * charges and the all-in figure where stated, the duration (fixed, a range, or
 * the operator's text), the cancellation line (a present FREE_CANCELLATION, or
 * the operator's silence — never "non-refundable"), the rating out of 5 with the
 * review count and the sources named, the confirmation type, the place. The
 * outbound link is the validated productUrl; a row without one says "no booking
 * link stated by the operator". There is no sign-up Book: signing up books
 * nothing. "Plan here; book on Viator."
 *
 * Above the rows: from-price range · rating floor · duration window · free
 * cancellation · private tour · sort · count. A control only writes the
 * container's filters; the search re-runs ONLY on the SEARCH press, counted by
 * the shared SearchCount control. Above the table: the count line — the rows
 * shown against the total the vendor states (SHOW THEM ALL: "1–50 of 1,915 stated
 * by the vendor", then "1–100 …" after a Next press; no client cap) — and the
 * lowest from-price meeting the filters — the benchmark, ranked on the all-in
 * figure where the operator states extra charges — and, on a selection, the
 * difference over it from stated attributes only (src/lib/activities/products.ts).
 * Below the table: "Next <page size>" — one more counted search the container
 * sends with the vendor's start cursor; it waits when the filters changed.
 *
 * PURE VIEW: props only. NO fetch, NO context, NO data-loading effect. The
 * container searches; the view reports what the user pressed.
 */

import { useState, type ReactNode } from 'react';
import { DATA } from '@/lib/ds';
import SearchCount from './SearchCount';
import {
  ACTIVITY_SORT_OPTIONS, COUNT_OPTIONS, DURATION_OPTIONS, NOT_STATED, RATING_OPTIONS, SORT_LABEL,
  activityFiltersStatement, cancellationText, countLine, durationText, extraChargesText, lowestPrice, lowestPriceLine, money, priceDifference, priceText, ratingText,
  type ActivityCardView, type ActivityUiFilters,
} from '@/lib/activities/products';
import type { Stated } from '@/lib/travel/stated';

export type { ActivityCardView, ActivityUiFilters };

interface Props {
  cards: ActivityCardView[];
  /** The vendor's total for the filters, when it stated one — and the total the page before stated, when it moved. */
  totalCount: Stated<number>;
  previousTotal: Stated<number>;
  loading: boolean;
  error: string;
  filters: ActivityUiFilters;
  /** Writes the container's filters — and nothing else. A search fires only from the SEARCH press. */
  onFiltersChange: (patch: Partial<ActivityUiFilters>) => void;
  /** How many metered searches this session has sent (the container counts). */
  searchCount: number;
  /** The currency the search SENDS (the contract's one constant) — named beside the controls. */
  sentCurrency: string;
  /** The selected product, if any — the container holds it. */
  selected: string | null;
  onSelect: (card: ActivityCardView | null) => void;
  /** SHOW THEM ALL: the rows one Next press asks for (the screen's count, else the vendor's default). */
  pageSize: number;
  /** Whether more rows can be asked for: what the vendor's total says, or until a page adds nothing. */
  hasMore: boolean;
  /** The filters changed since the shown pages were asked — Next waits for a fresh SEARCH from page one. */
  filtersChanged: boolean;
  loadingMore: boolean;
  /** One more counted search with the same filters and the next start — the container sends it. */
  onNextPage: () => void;
  /** What the last Next answered: the products the page held and how many were already shown. */
  lastPage: { answered: number; alreadyShown: number } | null;
  /** STEP 4: the Save panel the container renders under a selected row (a signed-in user with a trip). */
  savePanel?: ReactNode;
}

/** Per-row thumbnail: the photo when present + loadable, else a neutral placeholder — never a broken <img>. */
function ActivityCardImage({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!photoUrl && !failed;
  return (
    <div className="relative h-full w-full overflow-hidden bg-bg-row">
      {showPhoto ? (
        <img src={photoUrl as string} alt={name} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-text-faint">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </div>
      )}
    </div>
  );
}

const SELECT_CLASS = 'border border-border bg-white px-2 py-1 font-mono text-[11px] text-brand-purple focus:outline-none';
const LABEL_CLASS = 'font-mono text-[9.5px] tracking-widest text-text-faint';

const DURATION_LABEL: Record<ActivityUiFilters['duration'], string> = { any: 'any', under2h: 'up to 2h', '2to6h': '2h to 6h', over6h: '6h and up' };

export default function ActivityPickerView({ cards, totalCount, previousTotal, loading, error, filters, onFiltersChange, searchCount, sentCurrency, selected, onSelect, pageSize, hasMore, filtersChanged, loadingMore, onNextPage, lastPage, savePanel }: Props) {
  // The controls: each writes the container's filters and nothing else.
  const bar = (
    <div className="space-y-1" data-activity-filters>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-1.5">
          <span className={LABEL_CLASS}>FROM-PRICE ({sentCurrency})</span>
          <input type="number" min={0} value={filters.priceMin} placeholder="from" onChange={e => onFiltersChange({ priceMin: e.target.value })} className={`${SELECT_CLASS} w-20`} data-activity-filter="priceMin" />
          <span className="text-text-faint">–</span>
          <input type="number" min={0} value={filters.priceMax} placeholder="to" onChange={e => onFiltersChange({ priceMax: e.target.value })} className={`${SELECT_CLASS} w-20`} data-activity-filter="priceMax" />
        </label>
        <label className="flex items-center gap-1.5">
          <span className={LABEL_CLASS}>RATING</span>
          <select value={filters.rating} onChange={e => onFiltersChange({ rating: e.target.value as ActivityUiFilters['rating'] })} className={SELECT_CLASS} data-activity-filter="rating">
            {RATING_OPTIONS.map(r => <option key={r} value={r}>{r === 'any' ? 'any' : `above ${r}`}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className={LABEL_CLASS}>DURATION</span>
          <select value={filters.duration} onChange={e => onFiltersChange({ duration: e.target.value as ActivityUiFilters['duration'] })} className={SELECT_CLASS} data-activity-filter="duration">
            {DURATION_OPTIONS.map(d => <option key={d} value={d}>{DURATION_LABEL[d]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 font-mono text-[11px] text-text-secondary">
          <input type="checkbox" checked={filters.freeCancellation} onChange={e => onFiltersChange({ freeCancellation: e.target.checked })} data-activity-filter="freeCancellation" />
          free cancellation
        </label>
        <label className="flex items-center gap-1.5 font-mono text-[11px] text-text-secondary">
          <input type="checkbox" checked={filters.privateTour} onChange={e => onFiltersChange({ privateTour: e.target.checked })} data-activity-filter="privateTour" />
          private tour
        </label>
        <label className="flex items-center gap-1.5">
          <span className={LABEL_CLASS}>SORT</span>
          <select value={filters.sort} onChange={e => onFiltersChange({ sort: e.target.value as ActivityUiFilters['sort'] })} className={SELECT_CLASS} data-activity-filter="sort">
            {ACTIVITY_SORT_OPTIONS.map(s => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className={LABEL_CLASS}>RESULTS</span>
          <select value={filters.count} onChange={e => onFiltersChange({ count: e.target.value as ActivityUiFilters['count'] })} className={SELECT_CLASS} data-activity-filter="count">
            {COUNT_OPTIONS.map(c => <option key={c} value={c}>{c === 'vendor' ? "the vendor's default" : c}</option>)}
          </select>
        </label>
        <SearchCount count={searchCount} />
      </div>
      <div className="font-mono text-[10px] text-text-faint" data-activity-filters-stated>
        Asked on the next search: {activityFiltersStatement(filters, sentCurrency)}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-2">
        {bar}
        <div className="divide-y divide-border rounded-lg border border-border bg-white" aria-busy="true">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2">
              <div className="h-14 w-20 shrink-0 animate-pulse rounded bg-bg-row" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-1/2 animate-pulse rounded bg-bg-row" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-bg-row" />
              </div>
              <div className="h-7 w-16 shrink-0 animate-pulse rounded bg-bg-row" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-2">
        {bar}
        <div className="rounded-lg border border-border bg-white p-3 text-sm text-brand-red">{error}</div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="space-y-2">
        {bar}
        <div className="rounded-lg border border-dashed border-border bg-white p-4 text-center">
          <p className="text-sm font-medium text-text-primary">No activities returned</p>
          <p className="mt-1 text-xs text-text-faint">The vendor returned no products for this city and these filters.</p>
        </div>
      </div>
    );
  }

  const low = lowestPrice(cards);
  const llf = lowestPriceLine(low);
  const selectedCard = selected ? cards.find(c => c.productCode === selected) ?? null : null;
  const diff = selectedCard && low ? priceDifference(selectedCard, low.card) : null;

  return (
    <div className="space-y-2" data-activity-results>
      {bar}
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-text-faint">
        <span data-activity-count>{countLine(cards, totalCount, previousTotal)} — click a row to compare it</span>
        <span data-activity-plan-line>Plan here; book on Viator.</span>
      </div>
      {llf && (
        <div className="rounded border border-border bg-bg-row px-3 py-2 font-mono text-[11px] text-text-primary" data-activity-llf>{llf}</div>
      )}
      <div>
        <div className="mb-1 font-mono text-[10px] tracking-wider text-text-faint" data-activity-provider>
          TRAVEL / THINGS TO DO — PRICES AS STATED BY THE OPERATOR VIA VIATOR
        </div>
        <div className="overflow-x-auto rounded-lg border border-border bg-white" aria-label="Activity results">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-bg-row text-left">
                <th className="px-2 py-2"><span className="sr-only">Photo</span></th>
                <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Activity</th>
                <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Rating</th>
                <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Duration</th>
                <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Cancellation</th>
                <th className={`px-3 py-2 text-right font-semibold ${DATA.columnHeader}`}>Price</th>
                <th className="px-3 py-2"><span className="sr-only">Link</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cards.map(card => {
                const isSelected = selected === card.productCode;
                const extra = extraChargesText(card);
                const place = card.destinationName ?? (card.destinationRef !== null ? `destination ref ${card.destinationRef}` : `place ${NOT_STATED}`);
                return (
                  <tr key={card.productCode}
                    data-activity-row={card.productCode}
                    onClick={() => onSelect(isSelected ? null : card)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-brand-purple-wash/40' : 'odd:bg-bg-row hover:bg-brand-purple-wash/40'}`}>
                    <td className="px-2 py-2">
                      <div className="h-14 w-20 overflow-hidden rounded"><ActivityCardImage photoUrl={card.photoUrl} name={card.name} /></div>
                    </td>
                    <td className={`border-l-2 px-3 py-2 ${isSelected ? 'border-brand-purple' : 'border-transparent'}`}>
                      <div className="max-w-[18rem] truncate text-sm font-medium text-brand-purple" title={card.name} data-activity-name>{card.name}</div>
                      <div className="max-w-[18rem] truncate text-xs text-text-faint" data-activity-place>{place}</div>
                      <div className="text-[10px] text-text-faint" data-activity-field="confirmation">
                        {card.confirmationType === null ? `confirmation ${NOT_STATED}` : `confirmation: ${card.confirmationType}`}
                        {card.privateTour === true ? ' · private tour' : ''}{card.skipTheLine === true ? ' · skip the line' : ''}
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-text-secondary" data-activity-field="rating">{ratingText(card)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-text-secondary" data-activity-field="duration">{durationText(card.duration)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-xs text-text-secondary" data-activity-field="cancellation">{cancellationText(card)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      <div className="font-mono text-sm font-semibold text-brand-gold" data-activity-field="price">{priceText(card)}</div>
                      <div className="text-[10px] text-text-faint" data-activity-field="priceBasis">{card.priceBasis ?? `basis ${NOT_STATED}`}</div>
                      {extra && <div className="text-[10px] text-text-secondary" data-activity-field="extraCharges">{extra}</div>}
                      {card.priceBeforeDiscount !== null && card.price !== null && card.priceBeforeDiscount > card.price && (
                        <div className="text-[10px] text-text-faint" data-activity-field="beforeDiscount">before discount {money(card.priceBeforeDiscount, card.currency)} — {card.specialOffer === true ? 'special offer stated by the operator' : `special offer ${NOT_STATED}`}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {card.productUrl ? (
                        <a href={card.productUrl} target="_blank" rel="noopener noreferrer sponsored" onClick={(e) => e.stopPropagation()}
                          className="shrink-0 rounded bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-purple-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple"
                          data-activity-link="stated">
                          Book on Viator
                        </a>
                      ) : (
                        <span className="text-[10px] text-text-faint" data-activity-link="none">no booking link stated by the operator</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* SHOW THEM ALL: the next page of the vendor's total — one more counted search, the same filters, the vendor's cursor. */}
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-faint" data-activity-paging>
          <button type="button" onClick={onNextPage} disabled={!hasMore || filtersChanged || loadingMore}
            className="rounded border border-brand-purple bg-white px-3 py-1.5 text-xs font-semibold text-brand-purple transition-colors hover:bg-bg-row disabled:opacity-50"
            data-activity-next={pageSize}>
            {loadingMore ? 'Asking…' : `Next ${pageSize}`}
          </button>
          <span data-activity-page-note>
            {filtersChanged ? 'filters changed — Search starts from page one' : !hasMore ? (totalCount !== null && cards.length >= totalCount ? 'every product the vendor stated is shown' : 'the vendor returned no more products') : countLine(cards, totalCount, previousTotal)}
            {lastPage && lastPage.alreadyShown > 0 ? ` · last page: ${lastPage.answered} answered, ${lastPage.alreadyShown} already shown` : ''}
          </span>
        </div>
      </div>

      {selectedCard && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-bg-row p-3" data-activity-selection>
          <div className="text-sm">
            <span className="font-medium">{selectedCard.name}</span>
            <span className="ml-2 font-bold text-brand-gold">{priceText(selectedCard)}</span>
            {extraChargesText(selectedCard) && <span className="ml-2 text-xs text-text-secondary">{extraChargesText(selectedCard)}</span>}
            {/* THE BENCHMARK — the selection against the lowest from-price meeting the filters, from stated attributes only. */}
            {diff && <div className="mt-1 font-mono text-[11px] text-text-secondary" data-price-difference={diff.delta ?? 'none'}>{diff.line}</div>}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => onSelect(null)} className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-white">Clear</button>
          </div>
          {savePanel && <div className="basis-full" data-activity-save-panel>{savePanel}</div>}
        </div>
      )}
    </div>
  );
}
