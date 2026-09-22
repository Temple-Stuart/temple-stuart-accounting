'use client';

/**
 * PublicActivitySearch — the LIVE, logged-out activity search on the public travel
 * card (PR-A3). It mirrors PublicHotelSearch: a guest types a destination and sees
 * REAL tours/experiences from the PUBLIC PR-A1 route (/api/travel/activities/search
 * — no auth, bounded by per-IP rate-limit + the daily Viator cap).
 *
 * ACTIVITY-01 (2026-09-22): ONE ACTIVITY, WHAT THE OPERATOR STATES. The answer's
 * `cards` (one per product, tri-state from the payload through
 * src/lib/activities/products.ts) render through the pure <ActivityPickerView/>;
 * the screen's filters ride the request as the vendor's own /products/search
 * contract (activitySearchParamsOf — a control at "any" sends nothing) and a
 * search fires ONLY here, on the SEARCH press, counted for the session. SHOW THEM
 * ALL (the founder's ruling, 2026-09-22): the vendor states a totalCount; a "Next"
 * press is one more counted search with the SAME filters and the vendor's own
 * `start` cursor (rows shown + 1), and the rows accumulate — no client cap; the
 * vendor's filters narrow, its pages reveal. A filter change means the next
 * SEARCH starts from page one, and Next waits for it. The unified-bar fan-out
 * that fired a search on a nonce is gone. There is no Book
 * that opens sign-up: a row links out on the validated productUrl or says "no
 * booking link stated by the operator". Plan here; book on Viator.
 *
 * SEARCH is public; BOOKING links out (PR-CHIP-1, Alex's ruling, 2026-08-03 —
 * the affiliate lock is reversed for ACTIVITIES ONLY). No fake results: the
 * table renders exactly what the route returns.
 */

import { useState } from 'react';
import ActivityPickerView, { type ActivityCardView } from './ActivityPickerView';
// PR-STRIP-DESIGN-2: icon-inside-field — MapPin marks the destination.
import { MapPin } from 'lucide-react';
import TravelSectionShell, { TravelField, TRAVEL_INPUT_CLASS, TRAVEL_BUTTON_CLASS, TRAVEL_LABEL_CLASS } from './travelSection';
import { DEFAULT_ACTIVITY_FILTERS, activitySearchParamsOf, moreStated, pageSizeOf, type ActivityUiFilters } from '@/lib/activities/products';
import { ACTIVITY_SEARCH_CURRENCY } from '@/lib/activities/searchContract';
import type { Stated } from '@/lib/travel/stated';

// ACTIVITY-01: the search is public and this container takes no props today — the
// save-to-trip flow (authed / currentTrip / onCommitted, as flights) lands with
// the Save, not before it; no dead prop is declared for it.
export default function PublicActivitySearch() {
  // Guest has no trip/destination props — start empty so they search by typing a
  // city + country. Activity search is destination-based (no dates).
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const [cards, setCards] = useState<ActivityCardView[]>([]);
  const [totalCount, setTotalCount] = useState<Stated<number>>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);
  // SHOW THEM ALL: the filters the shown pages were asked with (a Next press repeats them),
  // and whether the vendor's last page held nothing new (then there is no next page).
  const [sentFilters, setSentFilters] = useState<ActivityUiFilters | null>(null);
  const [exhausted, setExhausted] = useState(false);
  // ACTIVITY-01: the screen's filters — a control writes them here and nothing else happens.
  const [filters, setFilters] = useState<ActivityUiFilters>(DEFAULT_ACTIVITY_FILTERS);
  // ACTIVITY-01: how many metered searches this session has sent — shown beside the controls.
  const [searchCount, setSearchCount] = useState(0);
  // ACTIVITY-01: the selected product — the benchmark's difference line is about it.
  const [selected, setSelected] = useState<string | null>(null);

  // ── LIVE search against the PUBLIC /api/travel/activities/search (PR-A1). The
  //    ONLY place a search fires — a filter change never does. One function, one
  //    fetch: SEARCH asks for page one with the screen's filters; Next asks for the
  //    next page (start = rows shown + 1) with the filters the pages were asked with. ──
  const fetchPage = async (asked: ActivityUiFilters, start: number): Promise<{ cards: ActivityCardView[]; totalCount: Stated<number> }> => {
    const params = new URLSearchParams({
      city: city.trim(),
      country: country.trim(),
      // ACTIVITY-01: the vendor's own filter, sort and count names — only what the screen set.
      ...activitySearchParamsOf(asked),
      // SHOW THEM ALL: the vendor's own cursor; page one sends nothing (the vendor's default 1).
      ...(start > 1 ? { start: String(start) } : {}),
    });
    setSearchCount((n) => n + 1);
    const res = await fetch(`/api/travel/activities/search?${params}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to search activities');
    }
    const data = await res.json();
    return { cards: (data.cards || []) as ActivityCardView[], totalCount: typeof data.totalCount === 'number' ? data.totalCount : null };
  };

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!city.trim() || !country.trim()) {
      setError('Enter a city and country.');
      return;
    }

    setLoading(true);
    setError('');
    setCards([]);
    setTotalCount(null);
    setSelected(null);
    setExhausted(false);
    setSearched(true);

    try {
      const page = await fetchPage(filters, 1);
      setCards(page.cards);
      setTotalCount(page.totalCount);
      setSentFilters(filters);
      if (page.cards.length === 0) setExhausted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activity search failed');
    } finally {
      setLoading(false);
    }
  };

  // SHOW THEM ALL: the next page, appended — a product already shown appears once
  // (the vendor's DEFAULT order can move a product between pages); a page that adds
  // nothing ends the paging and says so.
  const nextPage = async () => {
    if (!sentFilters || loading || loadingMore) return;
    setLoadingMore(true);
    setError('');
    try {
      const page = await fetchPage(sentFilters, cards.length + 1);
      setTotalCount(page.totalCount);
      const known = new Set(cards.map((c) => c.productCode));
      const fresh = page.cards.filter((c) => !known.has(c.productCode));
      if (fresh.length === 0) setExhausted(true);
      else setCards([...cards, ...fresh]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Activity search failed');
    } finally {
      setLoadingMore(false);
    }
  };

  const filtersChanged = sentFilters !== null && JSON.stringify(filters) !== JSON.stringify(sentFilters);
  const more = moreStated(cards.length, totalCount);
  // More to reveal: what the vendor states, else whatever the next page says — unless the last page added nothing.
  const hasMore = !exhausted && (more === null ? true : more);

  return (
    <TravelSectionShell
      title="Things to do"
      explainer="Real tours & experiences. Book on Viator."
      // PR-STRIP-DESIGN-1: under the strip the tab + per-mode line carry
      // this identity — the in-card header hides (title stays, sr-only).
      hideHeader
    >
      <form onSubmit={search} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <label className="flex flex-col gap-1 lg:col-span-2">
          <span className={TRAVEL_LABEL_CLASS}>City</span>
          <TravelField icon={<MapPin className="h-4 w-4" strokeWidth={1.75} />}>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="e.g. Lisbon"
              className={`w-full pl-10 ${TRAVEL_INPUT_CLASS}`}
              aria-label="Destination city"
            />
          </TravelField>
        </label>
        <label className="flex flex-col gap-1">
          <span className={TRAVEL_LABEL_CLASS}>Country</span>
          <input
            type="text"
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="e.g. Portugal"
            className={TRAVEL_INPUT_CLASS}
            aria-label="Destination country"
          />
        </label>
        <div className="col-span-full flex items-end sm:col-span-2 lg:col-span-1">
          <button
            type="submit"
            disabled={loading}
            className={`${TRAVEL_BUTTON_CLASS} w-full`}
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {/* Results (and the controls above them): only after the first search. */}
      {searched && (
        <ActivityPickerView
          cards={cards}
          totalCount={totalCount}
          loading={loading}
          error={error}
          filters={filters}
          onFiltersChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          searchCount={searchCount}
          sentCurrency={ACTIVITY_SEARCH_CURRENCY}
          selected={selected}
          onSelect={(card) => setSelected(card ? card.productCode : null)}
          pageSize={pageSizeOf(sentFilters ?? filters)}
          hasMore={hasMore}
          filtersChanged={filtersChanged}
          loadingMore={loadingMore}
          onNextPage={nextPage}
        />
      )}
      {!searched && error && (
        <div className="rounded-lg border border-border bg-white p-4 text-sm text-brand-red">{error}</div>
      )}
    </TravelSectionShell>
  );
}
