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
 * that fired a search on a nonce is gone. There is no Book that opens sign-up: a
 * row links out on the validated productUrl or says "no booking link stated by
 * the operator". Plan here; book on Viator.
 *
 * STEP 4 (2026-09-22, the Basic-access path): A TOUR TAKES ITS TIME ON THE DAY. A
 * signed-in user with a trip selected picks a date inside the trip (no
 * preselection), presses "Show start times" — the ONE authed read
 * (/api/travel/activities/options: the product, the schedule, the vendor's rate,
 * three 'viatorsave' reservations) — enters the party per the operator's stated
 * bands (min / max from the payload), sees every option with its title, its
 * published start times (a sold-out date with the vendor's reason verbatim), the
 * party's cost in the supplier's currency and the CALCULATED plan figure at the
 * vendor's rate (src/lib/activities/schedule.ts, fx.ts, save.ts — the same pure
 * leaves vendor-commit recomputes with), picks one, and Saves: vendor-commit
 * 'activity' synthetic with the published start time, the end from the stated
 * fixed duration, the stated zone's instant, the calculated amount and the note
 * that names every figure and the rate. One Save per row; "Saved — <the stored
 * clock>" afterwards. Nothing typed, nothing defaulted, nothing converted silently.
 */

import { useState, type ReactNode } from 'react';
import ActivityPickerView, { type ActivityCardView } from './ActivityPickerView';
// PR-STRIP-DESIGN-2: icon-inside-field — MapPin marks the destination.
import { MapPin } from 'lucide-react';
import TravelSectionShell, { TravelField, TRAVEL_INPUT_CLASS, TRAVEL_BUTTON_CLASS, TRAVEL_LABEL_CLASS } from './travelSection';
import { DEFAULT_ACTIVITY_FILTERS, activitySearchParamsOf, moreStated, pageSizeOf, type ActivityUiFilters } from '@/lib/activities/products';
import { ACTIVITY_SEARCH_CURRENCY } from '@/lib/activities/searchContract';
import { cancellationStatement, optionTitleOf, partyMeetsProduct, partySize, partyText, type Party, type ProductFacts } from '@/lib/activities/product';
import { partyCost, priceLineText, type OptionOn } from '@/lib/activities/schedule';
import type { RateRecord } from '@/lib/activities/fx';
import { activitySaveNoteOf, conversionText, endTimeOf, totalOf, type ViatorSave } from '@/lib/activities/save';
import type { Stated } from '@/lib/travel/stated';

interface Props {
  /** Opens the existing home register/login modal (saving requires sign-in). */
  onRequireAuth: () => void;
  /** Login state from the home shell: null = resolving, true/false once known. */
  authed?: boolean | null;
  /** The trip selected in the trips list above — where a saved tour is budgeted; its dates bound the day. */
  currentTrip?: { id: string; name?: string; startDate?: string | null; endDate?: string | null } | null;
  /** Called after a successful save so the trip's budget re-fetches. */
  onCommitted?: () => void;
}

/** The options route's answer, as the screen reads it. */
interface OptionsAnswer {
  product: ProductFacts;
  date: string;
  currency: string;
  options: OptionOn[];
  extraChargesPerTraveller: number | null;
  rate: RateRecord | null;
  rateFrom: 'cache' | 'vendor' | 'not needed';
  targetCurrency: string;
  asOf: string;
}

const dateOnly = (v: string | null | undefined): string => (typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : '');

export default function PublicActivitySearch({ onRequireAuth, authed, currentTrip, onCommitted }: Props) {
  // Guest has no trip/destination props — start empty so they search by typing a
  // city + country. Activity search is destination-based (no dates).
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');

  const [cards, setCards] = useState<ActivityCardView[]>([]);
  const [totalCount, setTotalCount] = useState<Stated<number>>(null);
  // SHOW THEM ALL: the total the page before stated — named on the count line when the vendor's total moved.
  const [previousTotal, setPreviousTotal] = useState<Stated<number>>(null);
  const [lastPage, setLastPage] = useState<{ answered: number; alreadyShown: number } | null>(null);
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
  // ACTIVITY-01: the selected product — the benchmark's difference line is about it, and the Save panel opens under it.
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
    setPreviousTotal(null);
    setLastPage(null);
    setSelected(null);
    setExhausted(false);
    setSearched(true);
    resetSave();

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
      setPreviousTotal(totalCount);
      setTotalCount(page.totalCount);
      const known = new Set(cards.map((c) => c.productCode));
      const fresh = page.cards.filter((c) => !known.has(c.productCode));
      setLastPage({ answered: page.cards.length, alreadyShown: page.cards.length - fresh.length });
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

  // ── STEP 4: the Save — a date inside the trip, the one authed read, the party, the pick, the commit. ──
  const [saveDate, setSaveDate] = useState('');
  const [answer, setAnswer] = useState<OptionsAnswer | null>(null);
  const [party, setParty] = useState<Party>({});
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [chosen, setChosen] = useState<{ productOptionCode: string; startTime: string | null } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<{ kind: 'ok' | 'err' | 'info'; text: string } | null>(null);
  const [savedFor, setSavedFor] = useState<Record<string, string>>({});
  const resetSave = () => { setSaveDate(''); setAnswer(null); setParty({}); setChecking(false); setCheckError(''); setChosen(null); setSaveNote(null); };
  const selectRow = (card: ActivityCardView | null) => { setSelected(card ? card.productCode : null); resetSave(); };

  const tripStart = dateOnly(currentTrip?.startDate);
  const tripEnd = dateOnly(currentTrip?.endDate);
  const selectedCard = selected ? cards.find((c) => c.productCode === selected) ?? null : null;

  // The ONE read: the product, the schedule and the rate, behind the sign-in — nothing before the press.
  const showStartTimes = async () => {
    if (authed !== true) { onRequireAuth(); return; }
    if (!currentTrip) { setSaveNote({ kind: 'info', text: 'Pick or create a trip above first, then save this tour to it.' }); return; }
    if (!selectedCard) return;
    if (!saveDate) { setCheckError('Pick a date inside the trip.'); return; }
    if ((tripStart && saveDate < tripStart) || (tripEnd && saveDate > tripEnd)) { setCheckError(`Pick a date inside the trip (${tripStart || '?'} to ${tripEnd || '?'}).`); return; }
    setChecking(true);
    setCheckError('');
    setAnswer(null);
    setChosen(null);
    try {
      const res = await fetch(`/api/travel/activities/options?${new URLSearchParams({ productCode: selectedCard.productCode, date: saveDate })}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'The operator\'s schedule could not be read');
      }
      const data = (await res.json()) as OptionsAnswer;
      setAnswer(data);
      // The party form from the product's stated bands — the operator's minimum per band, nothing typed.
      const initial: Party = {};
      for (const b of data.product.bands) initial[b.ageBand] = b.minTravelersPerBooking ?? 0;
      setParty(initial);
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : 'The operator\'s schedule could not be read');
    } finally {
      setChecking(false);
    }
  };

  // The draft the screen prices and the commit recomputes — one method (src/lib/activities/save.ts).
  const draftOf = (opt: OptionOn, startTime: string | null): ViatorSave | { refused: string } => {
    if (!answer || !selectedCard) return { refused: 'no schedule read' };
    if (opt.productOptionCode === null) return { refused: 'the operator states no option code' };
    const rules = partyMeetsProduct(answer.product, party);
    if ('refused' in rules) return rules;
    const cost = partyCost(opt.pricingDetails, party, answer.date, answer.asOf, answer.currency);
    if ('refused' in cost) return cost;
    const travellers = partySize(party);
    const extra = answer.extraChargesPerTraveller === null ? null : { perTraveller: answer.extraChargesPerTraveller, travellers, total: Math.round(answer.extraChargesPerTraveller * travellers * 100) / 100 };
    const base = { native: { amount: cost.total, currency: answer.currency }, extra, rate: answer.rate };
    const total = totalOf(base, answer.targetCurrency, new Date());
    if ('refused' in total) return total;
    return {
      productCode: selectedCard.productCode,
      productOptionCode: opt.productOptionCode,
      optionTitle: optionTitleOf(answer.product, opt.productOptionCode),
      title: answer.product.title ?? selectedCard.name,
      date: answer.date,
      startTime,
      endTime: endTimeOf(startTime, answer.product.duration),
      timeZone: answer.product.timeZone,
      durationMinutes: answer.product.duration?.kind === 'fixed' ? answer.product.duration.minutes : null,
      party,
      ...base,
      total,
      cancellation: cancellationStatement(answer.product),
      asOf: answer.asOf,
    };
  };

  const save = async () => {
    if (authed !== true) { onRequireAuth(); return; }
    if (!currentTrip || !answer || !selectedCard || !chosen) return;
    const opt = answer.options.find((o) => o.productOptionCode === chosen.productOptionCode);
    if (!opt) return;
    const draft = draftOf(opt, chosen.startTime);
    if ('refused' in draft) { setSaveNote({ kind: 'err', text: `${draft.refused} — nothing was saved.` }); return; }
    setSaving(true);
    setSaveNote(null);
    try {
      const note = activitySaveNoteOf(draft);
      const res = await fetch(`/api/trips/${currentTrip.id}/vendor-commit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionType: 'activity',
          synthetic: true,                                  // no DB option row — built from this payload
          optionId: `viator-${draft.productCode}-${draft.productOptionCode}-${Date.now()}`,
          startDate: draft.date,
          endDate: draft.date,
          startTime: draft.startTime ?? undefined,          // the published start time, or nothing
          endTime: draft.endTime ?? undefined,              // start + the stated fixed duration, or nothing
          amount: draft.total.amount,                       // the calculated plan figure — recomputed by the commit
          notes: note,
          recurrence: 'once',
          category: 'activities',                           // TRAVEL_COA.activities — P-9400 / B-9400
          location: selectedCard.destinationName ?? undefined,
          priceStatedBy: 'operator',                        // a stated 0 is a price (the marker)
          viatorSave: draft,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message || d.error || 'Save failed');
      }
      const saved = await res.json();
      const stored = saved.viatorSave as { startTime: string | null; endTime: string | null; timeZone: string | null; total: { amount: number; currency: string; label: string } } | null;
      const clock = !stored ? 'the commit reported no clock for this tour'
        : stored.startTime === null ? `no start time stated by the operator for ${draft.date} — the block draws as a flagged marker with no end`
        : `starts ${stored.startTime}${stored.timeZone ? ` ${stored.timeZone}` : ''}${stored.endTime ? `, ends ${stored.endTime}` : ', no end stated (the block draws as a flagged marker)'}`;
      const figure = stored ? `${stored.total.currency} ${stored.total.amount.toFixed(2)} ${stored.total.label}` : '';
      setSavedFor((m) => ({ ...m, [draft.productCode]: clock }));
      setSaveNote({ kind: 'ok', text: `Saved ${draft.title} to ${currentTrip.name ?? 'your trip'} — ${clock}${figure ? ` · ${figure}` : ''}.` });
      onCommitted?.();
    } catch (err) {
      setSaveNote({ kind: 'err', text: err instanceof Error ? err.message : 'Save failed' });
    } finally {
      setSaving(false);
    }
  };

  const savePanel: ReactNode = selectedCard ? (
    <div className="mt-2 space-y-2 border-t border-border pt-2 text-xs" data-activity-save>
      {authed !== true ? (
        <button type="button" onClick={onRequireAuth} className="rounded border border-brand-purple bg-white px-3 py-1.5 text-xs font-semibold text-brand-purple hover:bg-bg-row" data-activity-save-signin>
          Sign in to save this tour to a trip
        </button>
      ) : !currentTrip ? (
        <div className="text-text-secondary" data-activity-save-notrip>Pick or create a trip above first, then save this tour to it.</div>
      ) : savedFor[selectedCard.productCode] ? (
        <div className="font-mono text-[11px] text-brand-green" data-activity-saved>Saved — {savedFor[selectedCard.productCode]}</div>
      ) : (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className={TRAVEL_LABEL_CLASS}>Day (inside {currentTrip.name ?? 'the trip'}{tripStart && tripEnd ? `, ${tripStart} to ${tripEnd}` : ''})</span>
              <input type="date" value={saveDate} min={tripStart || undefined} max={tripEnd || undefined} onChange={(e) => { setSaveDate(e.target.value); setAnswer(null); setChosen(null); }} className={TRAVEL_INPUT_CLASS} aria-label="Tour date" data-activity-save-date />
            </label>
            <button type="button" onClick={showStartTimes} disabled={checking || !saveDate} className={`${TRAVEL_BUTTON_CLASS}`} data-activity-show-times>
              {checking ? 'Reading the operator\'s schedule…' : 'Show start times'}
            </button>
          </div>
          {checkError && <div className="text-brand-red" data-activity-check-error>{checkError}</div>}
          {answer && (
            <div className="space-y-2" data-activity-options data-activity-rate-from={answer.rateFrom}>
              <div className="font-mono text-[10px] text-text-faint" data-activity-options-asof>
                schedule as published by the operator {answer.asOf} · priced in {answer.currency}
                {answer.rate ? ` · Viator rate ${answer.currency}→${answer.targetCurrency} ${answer.rate.rate} as of ${answer.rate.lastUpdated}, expires ${answer.rate.expiry} (${answer.rateFrom === 'cache' ? 'from the cache, inside its expiry' : 'read now'})` : ` · no conversion — the schedule answers in ${answer.targetCurrency}`}
                {answer.product.timeZone ? ` · operates in ${answer.product.timeZone}` : ' · zone not stated by the operator'}
                {' · '}{cancellationStatement(answer.product)}
              </div>
              <div className="flex flex-wrap items-end gap-3" data-activity-party>
                {answer.product.bands.map((b) => (
                  <label key={b.ageBand} className="flex flex-col gap-1">
                    <span className={TRAVEL_LABEL_CLASS}>{b.ageBand}{b.startAge !== null && b.endAge !== null ? ` (${b.startAge}–${b.endAge})` : ''}{b.minTravelersPerBooking !== null || b.maxTravelersPerBooking !== null ? ` min ${b.minTravelersPerBooking ?? '–'} max ${b.maxTravelersPerBooking ?? '–'}` : ''}</span>
                    <input type="number" min={b.minTravelersPerBooking ?? 0} max={b.maxTravelersPerBooking ?? undefined} value={party[b.ageBand] ?? 0} onChange={(e) => setParty((p) => ({ ...p, [b.ageBand]: Number(e.target.value) }))} className={`${TRAVEL_INPUT_CLASS} w-20`} aria-label={`${b.ageBand} travellers`} data-activity-party-band={b.ageBand} />
                  </label>
                ))}
                <span className="text-text-faint">{partyText(party)}{answer.product.requiresAdultForBooking === true ? ' · an adult is required' : ''}{answer.product.minTravelersPerBooking !== null ? ` · ${answer.product.minTravelersPerBooking}–${answer.product.maxTravelersPerBooking ?? '…'} per booking` : ''}</span>
              </div>
              <table className="w-full text-xs" data-activity-option-table>
                <thead><tr className="text-left text-text-faint"><th className="px-2 py-1">Option</th><th className="px-2 py-1">Start</th><th className="px-2 py-1">Party price</th><th className="px-2 py-1">Plan figure</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {answer.options.map((opt) => {
                    const code = opt.productOptionCode ?? '(no code)';
                    const title = opt.productOptionCode ? optionTitleOf(answer.product, opt.productOptionCode) : null;
                    const starts: Array<{ startTime: string | null; unavailable: string | null }> = opt.refused !== null && opt.startTimes.length === 0 ? [{ startTime: null, unavailable: opt.refused }] : opt.startTimes;
                    return starts.map((st, i) => {
                      const draft = opt.productOptionCode ? draftOf(opt, st.startTime) : { refused: 'no option code' };
                      const isChosen = chosen?.productOptionCode === opt.productOptionCode && chosen?.startTime === st.startTime;
                      const pickable = st.unavailable === null && !('refused' in draft);
                      return (
                        <tr key={`${code}:${st.startTime ?? 'none'}:${i}`} data-activity-option={code} data-activity-option-start={st.startTime ?? 'none'} data-activity-option-state={st.unavailable !== null ? 'unavailable' : 'refused' in draft ? 'refused' : 'available'}
                          onClick={() => { if (pickable && opt.productOptionCode) setChosen({ productOptionCode: opt.productOptionCode, startTime: st.startTime }); }}
                          className={`${pickable ? 'cursor-pointer' : 'cursor-default'} ${isChosen ? 'bg-brand-purple-wash/40' : ''}`}>
                          <td className="px-2 py-1"><span className="font-mono">{code}</span> {title ?? <span className="text-text-faint">title not stated by the operator</span>}</td>
                          <td className="px-2 py-1 font-mono">{st.startTime ?? <span className="text-text-faint">{opt.refused}</span>}{st.unavailable !== null && <span className="ml-1 text-brand-red" data-activity-option-reason>{st.unavailable}</span>}</td>
                          <td className="px-2 py-1 text-text-secondary">{'refused' in draft ? <span className="text-brand-red">{draft.refused}</span> : (() => { const cost = partyCost(opt.pricingDetails, party, answer.date, answer.asOf, answer.currency); return 'refused' in cost ? cost.refused : `${cost.lines.map((l) => priceLineText(l, answer.currency)).join('; ')}${draft.extra ? ` + ${draft.extra.total.toFixed(2)} ${answer.currency} in-destination charges stated by the operator (${draft.extra.perTraveller.toFixed(2)} × ${draft.extra.travellers})` : ''}`; })()}</td>
                          <td className="px-2 py-1 font-mono">{'refused' in draft ? '—' : <span data-activity-option-total={draft.total.amount}>{conversionText(draft)}</span>}</td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={save} disabled={saving || !chosen} className="rounded bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-purple-hover disabled:opacity-50" data-activity-save-button>
                  {saving ? 'Saving…' : chosen ? `Save ${chosen.productOptionCode} ${chosen.startTime ?? '(no start time)'} to ${currentTrip.name ?? 'the trip'}` : 'Pick an option and a start time'}
                </button>
                <span className="text-text-faint">Plan here; book on Viator.</span>
              </div>
            </div>
          )}
        </>
      )}
      {saveNote && (
        <div className={`rounded-lg border bg-white p-2 ${saveNote.kind === 'ok' ? 'border-brand-green/40 text-brand-green' : saveNote.kind === 'err' ? 'border-brand-red/40 text-brand-red' : 'border-border text-text-secondary'}`} data-save-note={saveNote.kind}>
          {saveNote.text}
        </div>
      )}
    </div>
  ) : null;

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
          previousTotal={previousTotal}
          loading={loading}
          error={error}
          filters={filters}
          onFiltersChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          searchCount={searchCount}
          sentCurrency={ACTIVITY_SEARCH_CURRENCY}
          selected={selected}
          onSelect={selectRow}
          pageSize={pageSizeOf(sentFilters ?? filters)}
          hasMore={hasMore}
          filtersChanged={filtersChanged}
          loadingMore={loadingMore}
          onNextPage={nextPage}
          lastPage={lastPage}
          savePanel={savePanel}
        />
      )}
      {!searched && error && (
        <div className="rounded-lg border border-border bg-white p-4 text-sm text-brand-red">{error}</div>
      )}
    </TravelSectionShell>
  );
}
