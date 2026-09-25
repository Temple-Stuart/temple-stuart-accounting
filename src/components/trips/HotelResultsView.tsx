'use client';

/**
 * HotelResultsView — PURE hotel results (PR-H2; COMPACT-1 rows; HOTEL-01, 2026-09-22:
 * A HOTEL APPEARS ONCE, A RATE SAYS WHAT IT BUYS, AND NOTHING ON THE SCREEN IS
 * FROM A DEAD PROVIDER).
 *
 * Renders the cards the PUBLIC hotel search route returns (/api/travel/hotels/search
 * → { cards, env }): one card per hotel — the vendor's hotelId is the identity —
 * with its stated facts (stars, guest rating, address: each "not stated by the
 * property" when the payload carried none, never a blank), the CHEAPEST rate
 * meeting the filters as the headline (per night AND the stay total with the
 * nights count), and beneath it every rate the vendor quoted: room, board,
 * refundable with the cancellation deadline, taxes, price — tri-state from the
 * payload through src/lib/hotels/rates.ts, never inferred from a price.
 *
 * THE FILTER BAR — stars · refundable only · price per night · sort — is defined
 * here (HotelFiltersBar, exported) and, since FILTER-01 (2026-09-25), MOUNTED BY
 * THE CONTAINER INSIDE ITS SEARCH FORM, ABOVE THE SEARCH BUTTON: a customer sets
 * what they want, then presses Search. It used to render here, above the cards,
 * only after the first search. Same five controls, same state, same handlers,
 * same defaults: a control only writes the container's filters; the search
 * re-runs ONLY on the SEARCH press, counted by the shared SearchCount control.
 * What the vendor takes rides the request; the per-night range narrows on this
 * page. Above the table: the lowest rate meeting the filters — the benchmark —
 * and, on a selection, the difference over it from stated attributes only.
 *
 * The provider named on screen is the one the env selects (LiteAPI), and a
 * sandbox answer says "Sandbox prices — not bookable" from the env — never a
 * retired provider's name.
 *
 * PURE VIEW: props only. NO fetch, NO context, NO data-loading effect. The
 * container searches, books and saves; the view reports what the user pressed.
 */

import { Fragment, useState, type ReactNode } from 'react';
import RowActionStrip from './RowActionStrip';
import { DATA } from '@/lib/ds';
import SearchCount from './SearchCount';
import {
  DEFAULT_HOTEL_FILTERS, HOTEL_SORT_OPTIONS, NOT_STATED, STARS_OPTIONS,
  applyRange, countLine, hotelFiltersStatement, lowestRate, lowestRateLine, money, rateDifference, rateHeadline, starsText, statedText,
  type HotelCardView, type HotelRateView, type HotelUiFilters,
} from '@/lib/hotels/rates';

export type { HotelCardView, HotelRateView, HotelUiFilters };

interface Props {
  cards: HotelCardView[];
  loading: boolean;
  error: string;
  /** Which LiteAPI environment priced the answer — from the env, via the route. Null before an answer. */
  env: 'live' | 'sandbox' | null;
  /** The screen's filters — read here for the per-night range that narrows on this page. The controls that write them are HotelFiltersBar, mounted by the container in its form (FILTER-01). */
  filters: HotelUiFilters;
  /** The selected rate, if any — the container holds it so Book / Save act on it. */
  selected: { hotelId: string; rateId: string } | null;
  onSelect: (card: HotelCardView, rate: HotelRateView | null) => void;
  /** Booking is gated — the view never books. */
  onBook: (card: HotelCardView, rate: HotelRateView) => void;
  /** Optional: save the stay to the selected trip's budget (the home Travel tab wires this). */
  onSave?: (card: HotelCardView, rate: HotelRateView) => void;
  /**
   * TRAVEL-ROW-01 (2026-09-23): the checkout ELEMENT, passed in by the container.
   * The view renders it inside the strip under the selected rate and never books.
   */
  checkout?: ReactNode;
  /** Collapse the checkout and hand focus back to the rate row. */
  onCloseCheckout?: () => void;
  /** The hotel id currently being saved — its Save button shows a pending state. */
  savingId?: string | null;
}

/** Per-card thumbnail: the photo when present + loadable, else a neutral placeholder — never a broken <img>. */
function HotelCardImage({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = !!photoUrl && !failed;
  return (
    <div className="relative h-full w-full overflow-hidden bg-bg-row">
      {showPhoto ? (
        <img src={photoUrl as string} alt={name} loading="lazy" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-text-faint">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-2" />
            <path d="M9 9v.01M9 12v.01M9 15v.01M9 18v.01" />
          </svg>
        </div>
      )}
    </div>
  );
}

const SELECT_CLASS = 'border border-border bg-white px-2 py-1 font-mono text-[11px] text-brand-purple focus:outline-none';
const LABEL_CLASS = 'font-mono text-[9.5px] tracking-widest text-text-faint';

/**
 * FILTER-01 (2026-09-25): THE FILTERS SIT ABOVE SEARCH. The container mounts this
 * inside its search form, before the submit — the same five controls that used to
 * render above the cards after the first search, unchanged: each writes the
 * container's filters and nothing else, the count is the shared SearchCount, and
 * the line beneath states exactly what the next Search press will send.
 */
export function HotelFiltersBar({ filters, onFiltersChange, searchCount }: {
  filters: HotelUiFilters;
  /** Writes the container's filters — and nothing else. A search fires only from the SEARCH press. */
  onFiltersChange: (patch: Partial<HotelUiFilters>) => void;
  /** How many metered searches this session has sent (the container counts). */
  searchCount: number;
}) {
  return (
    <div className="space-y-1" data-hotel-filters>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-1.5">
          <span className={LABEL_CLASS}>STARS</span>
          <select value={filters.stars} onChange={e => onFiltersChange({ stars: e.target.value as HotelUiFilters['stars'] })} className={SELECT_CLASS} data-hotel-filter="stars">
            {STARS_OPTIONS.map(s => <option key={s} value={s}>{s === 'any' ? 'any' : `${s}★ and up`}</option>)}
          </select>
        </label>
        <label className="flex items-center gap-1.5 font-mono text-[11px] text-text-secondary">
          <input type="checkbox" checked={filters.refundableOnly} onChange={e => onFiltersChange({ refundableOnly: e.target.checked })} data-hotel-filter="refundableOnly" />
          refundable only
        </label>
        <label className="flex items-center gap-1.5">
          <span className={LABEL_CLASS}>PER NIGHT</span>
          <input type="number" min={0} value={filters.priceMin} placeholder="from" onChange={e => onFiltersChange({ priceMin: e.target.value })} className={`${SELECT_CLASS} w-20`} data-hotel-filter="priceMin" />
          <span className="text-text-faint">–</span>
          <input type="number" min={0} value={filters.priceMax} placeholder="to" onChange={e => onFiltersChange({ priceMax: e.target.value })} className={`${SELECT_CLASS} w-20`} data-hotel-filter="priceMax" />
        </label>
        <label className="flex items-center gap-1.5">
          <span className={LABEL_CLASS}>SORT</span>
          <select value={filters.sort} onChange={e => onFiltersChange({ sort: e.target.value as HotelUiFilters['sort'] })} className={SELECT_CLASS} data-hotel-filter="sort">
            {HOTEL_SORT_OPTIONS.map(s => <option key={s} value={s}>{s === 'vendor' ? "the vendor's order" : 'price, low to high'}</option>)}
          </select>
        </label>
        <SearchCount count={searchCount} />
      </div>
      <div className="font-mono text-[10px] text-text-faint" data-hotel-filters-stated>
        Asked on the next search: {hotelFiltersStatement(filters)}
      </div>
    </div>
  );
}

export default function HotelResultsView({ cards, loading, error, env, filters, selected, onSelect, onBook, onSave, savingId, checkout, onCloseCheckout }: Props) {
  const [openCards, setOpenCards] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => openCards[id] === true;

  if (loading) {
    return (
      <div className="space-y-2">
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
        <div className="rounded-lg border border-border bg-white p-3 text-sm text-brand-red">{error}</div>
      </div>
    );
  }

  if (cards.length === 0) {
    return (
      <div className="space-y-2">
        <div className="rounded-lg border border-dashed border-border bg-white p-4 text-center">
          <p className="text-sm font-medium text-text-primary">No hotels yet</p>
          <p className="mt-1 text-xs text-text-faint">Enter a city, country, and your dates to see real stays with nightly prices.</p>
        </div>
      </div>
    );
  }

  // The per-night range narrows on this page (the vendor takes none); everything else was asked of the vendor.
  const shown = applyRange(cards, filters);
  const low = lowestRate(shown);
  const llf = lowestRateLine(low);
  const selectedRate = selected
    ? shown.find(c => c.hotelId === selected.hotelId)?.rates.find(r => r.rateId === selected.rateId) ?? null
    : null;
  const diff = selectedRate && low ? rateDifference(selectedRate, low.rate) : null;

  return (
    <div className="space-y-2" data-hotel-results>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-text-faint">
        <span data-hotel-count>{countLine(shown)} — click a hotel for its rates</span>
        {shown.length < cards.length && <span data-hotel-range-hidden>{cards.length - shown.length} hotel{cards.length - shown.length === 1 ? '' : 's'} outside the per-night range on this page</span>}
      </div>
      {llf && (
        <div className="rounded border border-border bg-bg-row px-3 py-2 font-mono text-[11px] text-text-primary" data-hotel-llf>{llf}</div>
      )}
      {shown.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-white p-4 text-center text-sm text-text-faint">No rates match the per-night range on this page.</div>
      ) : (
        <div>
          {/* The caption names the provider the env selects — LiteAPI — and the env it priced in. */}
          <div className="mb-1 font-mono text-[10px] tracking-wider text-text-faint" data-hotel-provider>
            TRAVEL / HOTEL SEARCH — LIVE PRICES VIA LITEAPI
          </div>
          <div className="overflow-x-auto rounded-lg border border-border bg-white" aria-label="Hotel results">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-bg-row text-left">
                  <th className="px-2 py-2"><span className="sr-only">Photo</span></th>
                  <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Hotel</th>
                  <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Stars</th>
                  <th className={`px-3 py-2 font-semibold ${DATA.columnHeader}`}>Guests say</th>
                  <th className={`px-3 py-2 text-right font-semibold ${DATA.columnHeader}`}>From / night</th>
                  <th className={`px-3 py-2 text-right font-semibold ${DATA.columnHeader}`}>Stay total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {shown.map(card => {
                  const cheapest = card.rates[0];
                  const holdsSelected = !!selected && selected.hotelId === card.hotelId;
                  const open = isOpen(card.hotelId) || holdsSelected;
                  const place = [card.address, card.city].filter(Boolean).join(', ');
                  const rows = [
                    <tr key={card.hotelId}
                      data-hotel-row={card.hotelId}
                      data-rate-count={card.rates.length}
                      onClick={() => setOpenCards(prev => ({ ...prev, [card.hotelId]: !isOpen(card.hotelId) }))}
                      className={`cursor-pointer transition-colors ${holdsSelected ? 'bg-brand-purple-wash/40' : 'odd:bg-bg-row hover:bg-brand-purple-wash/40'}`}>
                      <td className="px-2 py-2">
                        <div className="h-14 w-20 overflow-hidden rounded"><HotelCardImage photoUrl={card.photoUrl} name={card.name} /></div>
                      </td>
                      <td className={`border-l-2 px-3 py-2 ${holdsSelected ? 'border-brand-purple' : 'border-transparent'}`}>
                        <div className="max-w-[18rem] truncate text-sm font-medium text-brand-purple" title={card.name} data-hotel-name>{card.name}</div>
                        <div className="max-w-[18rem] truncate text-xs text-text-faint" data-hotel-place>{place || `address ${NOT_STATED}`}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-text-secondary" data-hotel-stars>{starsText(card.stars)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-text-secondary" data-hotel-guest-rating>
                        {card.guestRating === null ? `rating ${NOT_STATED}` : `${card.guestRating}/10${card.reviewCount !== null ? ` · ${card.reviewCount} reviews` : ''}`}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <div className="font-mono text-sm font-semibold text-brand-gold" data-hotel-headline>{cheapest.perNight === null ? `${money(cheapest.total, cheapest.currency)} total` : `${money(cheapest.perNight, cheapest.currency)}`}</div>
                        <div className="text-[10px] text-text-faint">{card.rates.length} rate{card.rates.length === 1 ? '' : 's'} {open ? '▲' : '▼'}</div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-[10px] text-text-faint" data-hotel-total>
                        {money(cheapest.total, cheapest.currency)} total{card.nights !== null ? ` · ${card.nights} night${card.nights === 1 ? '' : 's'}` : ` · nights ${NOT_STATED}`}
                      </td>
                    </tr>,
                  ];
                  if (open) {
                    rows.push(
                      <tr key={`${card.hotelId}:rates`} className="bg-white">
                        <td colSpan={6} className="px-3 pb-3 pt-1">
                          {/* A RATE SAYS WHAT IT BUYS: room, board, refundable with its deadline, taxes, price —
                              every value the payload carried, and "not stated by the property" where it carried none. */}
                          <table className="w-full text-xs" data-rate-options={card.hotelId}>
                            <thead>
                              <tr className="text-left">
                                <th className={`px-2 py-1 ${DATA.columnHeader}`}>Rate</th>
                                <th className={`px-2 py-1 ${DATA.columnHeader}`}>Room</th>
                                <th className={`px-2 py-1 ${DATA.columnHeader}`}>Board</th>
                                <th className={`px-2 py-1 ${DATA.columnHeader}`}>Cancellation</th>
                                <th className={`px-2 py-1 ${DATA.columnHeader}`}>Taxes</th>
                                <th className={`px-2 py-1 ${DATA.columnHeader}`}>Guests</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {card.rates.map(rate => {
                                const isSelected = selected?.hotelId === card.hotelId && selected.rateId === rate.rateId;
                                return (
                                  <Fragment key={rate.rateId}>
                                  <tr
                                    data-rate-row={rate.rateId}
                                    tabIndex={-1}
                                    onClick={(e) => { e.stopPropagation(); onSelect(card, isSelected ? null : rate); }}
                                    className={`cursor-pointer outline-none transition-colors ${isSelected ? 'bg-brand-purple-wash/40' : 'hover:bg-brand-purple-wash/40'}`}>
                                    <td className={`border-l-2 px-2 py-1.5 ${isSelected ? 'border-brand-purple' : 'border-transparent'}`}>
                                      <div className="font-mono font-semibold text-brand-gold" data-rate-field="price">{rateHeadline(rate)}</div>
                                      <div className="text-[10px] text-text-faint">{money(rate.total, rate.currency)} total</div>
                                    </td>
                                    <td className="px-2 py-1.5 text-text-secondary" data-rate-field="room">{rate.roomName ?? NOT_STATED}</td>
                                    <td className="px-2 py-1.5 text-text-secondary" data-rate-field="board">{rate.boardName ?? rate.boardType ?? NOT_STATED}</td>
                                    <td className="px-2 py-1.5 text-text-secondary" data-rate-field="refundable">{statedText(rate.refundable, rate.cancelDeadline ? `refundable until ${rate.cancelDeadline}` : 'refundable', 'non-refundable')}</td>
                                    <td className="px-2 py-1.5 text-text-secondary" data-rate-field="taxesIncluded">{statedText(rate.taxesIncluded, 'included', 'not all included')}</td>
                                    <td className="px-2 py-1.5 text-text-secondary" data-rate-field="maxOccupancy">{rate.maxOccupancy === null ? NOT_STATED : `up to ${rate.maxOccupancy}`}</td>
                                  </tr>
                                  {/* TRAVEL-ROW-01: the action strip sits DIRECTLY beneath the rate it acts on. */}
                                  {isSelected && (
                                    <RowActionStrip
                                      rowId={rate.rateId}
                                      colSpan={6}
                                      summary={<>
                                        <span className="font-medium">{card.name}</span>
                                        <span className="ml-2 text-text-faint">{rate.roomName ?? `room ${NOT_STATED}`}</span>
                                        <span className="ml-2 font-bold text-brand-gold">{rateHeadline(rate)}</span>
                                      </>}
                                      difference={diff ? <div className="mt-1 font-mono text-[11px] text-text-secondary" data-rate-difference={diff.delta}>{diff.line}</div> : undefined}
                                      onClear={() => onSelect(card, null)}
                                      onSave={onSave ? () => onSave(card, rate) : undefined}
                                      saveLabel={savingId === card.hotelId ? 'Saving…' : 'Save to trip'}
                                      saveDisabled={savingId === card.hotelId}
                                      onBook={() => onBook(card, rate)}
                                      bookLabel={rate.offerId === null ? 'Not bookable' : 'Book'}
                                      bookDisabled={rate.offerId === null}
                                      checkout={checkout}
                                      onCloseCheckout={onCloseCheckout}
                                    />
                                  )}
                                  </Fragment>
                                );
                              })}
                            </tbody>
                          </table>
                        </td>
                      </tr>,
                    );
                  }
                  return rows;
                })}
              </tbody>
            </table>
          </div>
          <div className="pt-1 text-center text-[10px] text-text-faint" data-hotel-env>
            {env === 'sandbox' ? 'Sandbox prices — not bookable' : 'Powered by LiteAPI · Prices include all taxes & fees unless a rate says otherwise'}
          </div>
        </div>
      )}

    </div>
  );
}

export { DEFAULT_HOTEL_FILTERS };
