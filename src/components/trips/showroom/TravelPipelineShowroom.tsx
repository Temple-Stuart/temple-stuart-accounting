'use client';

/**
 * TravelPipelineShowroom — the public Travel story for the home page, below the
 * existing travel banner (CreateTripForm). Maria's Oaxaca food trip, all locked.
 *
 * Two labeled horizontal-scroll rows + the itinerary calendar:
 *   ROW 1 · Book + Budget — Flight / Hotel / Ground / Activities
 *   ROW 2 · Budget only   — the rest of the categories
 *   CALENDAR              — her days in Oaxaca
 *
 * "Locked but visible": every card renders a REAL pure view fed the T3 static
 * seed, and EVERY action — search, select, commit/BOOK, the activity's "Book on
 * Viator", and the calendar's inline edit — is bound to one inert handler that
 * does ONLY onRequireAuth(). No fetch, no real booking, no Viator URL, no live
 * container is reachable under any card. Imports are pure views + the two
 * prop-fed pickers + the seed + types — nothing else.
 */

import FlightPickerView from '../FlightPickerView';
import HotelPicker from '../HotelPicker';
import TransferPicker from '../TransferPicker';
import TripTimelineView, { type PatchResult } from '../TripTimelineView';
import {
  demoFlightLegs,
  demoHotels,
  demoTransfer,
  demoActivity,
  demoCategoryMap,
  demoTripItinerary,
  demoTripStart,
  demoTripEnd,
} from './demoTravel';

interface Props {
  /** Opens the existing home register/login modal (the same UI-only trigger the
   *  rest of the showroom + the travel banner use). Never fetches. */
  onRequireAuth: () => void;
}

const ROW = 'flex gap-4 overflow-x-auto pb-2 -mx-1 px-1 snap-x';
const ROW_LABEL = 'text-xs font-mono font-semibold uppercase tracking-wide text-brand-purple-hover mb-2';

export default function TravelPipelineShowroom({ onRequireAuth }: Props) {
  // One inert handler for every void callback across all cards + the calendar.
  const lock = () => onRequireAuth();
  // The calendar's inline edit returns a result; the locked version prompts sign-up
  // and reports "ok" so the row closes the editor (no fetch, no real save).
  const lockPatch = async (): Promise<PatchResult> => {
    onRequireAuth();
    return { ok: true };
  };

  const budgetCategories = demoCategoryMap.filter((c) => c.kind === 'budget');

  return (
    <div className="mt-6 space-y-6">
      <div>
        <p className="text-sm text-text-primary mb-1">
          Plan a whole trip in one place — book it and budget it together.
        </p>
        <p className="text-xs text-text-muted">
          This is Maria&rsquo;s Oaxaca food trip. Look around. Every button asks you
          to sign up — nothing here books or charges.
        </p>
      </div>

      {/* ── ROW 1 · Book + Budget ─────────────────────────────────────────── */}
      <div>
        <div className={ROW_LABEL}>Book + Budget</div>
        <div className={ROW}>
          <div className="snap-start shrink-0 w-[360px]">
            <FlightPickerView
              legs={demoFlightLegs}
              committing={null}
              liveSearchEnabled={true}
              onUpdateLeg={lock}
              onRemoveLeg={lock}
              onAddLeg={lock}
              onSearchLeg={lock}
              onSubmitManual={lock}
              onCommitLeg={lock}
              onUncommitLeg={lock}
            />
          </div>
          <div className="snap-start shrink-0 w-[360px]">
            <HotelPicker
              destinationName="Oaxaca de Juárez"
              resortId="demo-oax"
              checkInDate={demoTripStart}
              checkOutDate={demoTripEnd}
              adults={1}
              rooms={1}
              bedsNeeded={1}
              selectedHotel={null}
              onSelectHotel={lock}
              hotelOptions={demoHotels}
            />
          </div>
          <div className="snap-start shrink-0 w-[360px]">
            <TransferPicker
              destinationName="Oaxaca de Juárez"
              resortId="demo-oax"
              airportCode="OAX"
              arrivalDateTime={`${demoTripStart}T14:00:00`}
              departureDateTime={`${demoTripEnd}T15:10:00`}
              passengers={1}
              selectedArrival={null}
              selectedDeparture={null}
              onSelectArrival={lock}
              onSelectDeparture={lock}
              arrivalOptions={[demoTransfer]}
              departureOptions={[]}
            />
          </div>
          {/* Activities — static card (no live component; TripPlannerAI is caged).
              "Book on Viator" → onRequireAuth, NEVER the real affiliate URL. */}
          <div className="snap-start shrink-0 w-[300px]">
            <div className="bg-white border border-border rounded p-4 h-full flex flex-col">
              <div className="text-lg" aria-hidden>🌶️</div>
              <div className="font-medium text-text-primary mt-1">{demoActivity.title}</div>
              <div className="text-xs text-text-muted">{demoActivity.vendor} · {demoActivity.durationLabel}</div>
              <p className="text-xs text-text-secondary mt-2 flex-1">{demoActivity.blurb}</p>
              <div className="flex items-center justify-between mt-3">
                <span className="text-sm font-bold text-brand-green">${demoActivity.price}</span>
                <button
                  type="button"
                  onClick={lock}
                  className="px-3 py-1.5 border border-brand-purple text-brand-purple rounded text-xs font-mono hover:bg-purple-50"
                >
                  {demoActivity.bookLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── ROW 2 · Budget only ───────────────────────────────────────────── */}
      <div>
        <div className={ROW_LABEL}>Budget only</div>
        <div className={ROW}>
          {budgetCategories.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={lock}
              className="snap-start shrink-0 w-[150px] text-left bg-white border border-border rounded p-3 hover:bg-bg-row"
            >
              <div className="font-medium text-sm text-text-primary">{c.label}</div>
              <div className="text-[10px] text-text-muted mt-0.5 uppercase tracking-wide">budget only</div>
            </button>
          ))}
        </div>
      </div>

      {/* ── CALENDAR · Maria's days in Oaxaca ─────────────────────────────── */}
      <div>
        <div className={ROW_LABEL}>Your trip, day by day</div>
        <TripTimelineView
          itinerary={demoTripItinerary}
          startDate={demoTripStart}
          endDate={demoTripEnd}
          onUncommit={lock}
          onChanged={lock}
          onPatchItem={lockPatch}
        />
      </div>
    </div>
  );
}
