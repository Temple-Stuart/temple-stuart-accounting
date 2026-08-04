// ─── LiteAPI journeys → the picker's FlightOffer shape (PR-FL-6a) ────────────
// The STEP-0 ruled choice: an ADAPTER, not a parallel results view — the pure
// FlightPickerView (and the whole Duffel path that feeds it) stays untouched,
// and this one mapping function is strictly smaller than a second results UI +
// selection state machine.
//
// PURE + CLIENT-SAFE: type-only imports (erased at compile), no env, no fetch.
// Maps ONLY documented fields (FLIGHT-LITE-1 recon shapes); absent fields map
// to null/absent — never invented. Segments are split by their documented
// `direction` tag (OUTBOUND/INBOUND; untagged segments — the one-way case —
// count as outbound). Offers WITHOUT a display price cannot render in the
// picker (price is required) and are skipped with a loud count — never shown
// with a fabricated price.

import type { FlightSearchResult, FlightSegment, FlightJourney } from './liteapiFlightsClient';
import type { FlightOffer } from '@/components/trips/FlightPickerView';

/** "PT7H45M" → "7h 45m"; falls back to minutes; '' when neither exists. */
function formatDuration(iso8601?: string, minutes?: number): string {
  if (iso8601) {
    const m = /^PT(?:(\d+)H)?(?:(\d+)M)?/.exec(iso8601);
    if (m && (m[1] || m[2])) {
      return [m[1] ? `${m[1]}h` : '', m[2] ? `${m[2]}m` : ''].filter(Boolean).join(' ');
    }
  }
  if (typeof minutes === 'number' && minutes > 0) {
    return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  }
  return '';
}

/** ISO "2026-08-24T09:35:00" → { date: "2026-08-24", localTime: "09:35" }. */
function splitIso(iso?: string): { date: string; localTime: string } {
  if (!iso) return { date: '', localTime: '' };
  const [d, t] = iso.split('T');
  return { date: d ?? '', localTime: (t ?? '').slice(0, 5) };
}

/** One direction's segments → the picker's outbound/return block. */
function directionBlock(
  segs: FlightSegment[],
  duration: string,
  durationMinutes: number | undefined,
): NonNullable<FlightOffer['outbound']> | null {
  if (segs.length === 0) return null;
  const first = segs[0];
  const last = segs[segs.length - 1];
  const dep = splitIso(first.departureTime);
  const arr = splitIso(last.arrivalTime);
  const carriers = [...new Set(
    segs.map((s) => s.carrier?.marketingName || s.carrier?.marketingCode || '').filter(Boolean)
  )];
  return {
    departure: {
      airport: first.originCode ?? '',
      airportName: first.originName,
      localTime: dep.localTime,
      date: dep.date,
      // LiteAPI segments carry no IANA zone field — null, never a guessed zone
      // (the tz-0b convention).
      timeZone: null,
    },
    arrival: {
      airport: last.destinationCode ?? '',
      airportName: last.destinationName,
      localTime: arr.localTime,
      date: arr.date,
      timeZone: null,
    },
    duration,
    ...(durationMinutes !== undefined ? { durationMinutes } : {}),
    stops: segs.length - 1,
    carriers,
  };
}

function journeyDirectionDuration(j: FlightJourney, direction: 'OUTBOUND' | 'INBOUND'): {
  duration: string;
  durationMinutes?: number;
} {
  const entry = (j.legDurations ?? []).find((l) => l.direction === direction);
  if (entry?.duration) {
    return {
      duration: formatDuration(entry.duration.iso8601, entry.duration.minutes),
      durationMinutes: entry.duration.minutes,
    };
  }
  // One-way journeys: the journey total IS the outbound duration.
  if (direction === 'OUTBOUND' && j.totalDuration) {
    return {
      duration: formatDuration(j.totalDuration.iso8601, j.totalDuration.minutes),
      durationMinutes: j.totalDuration.minutes,
    };
  }
  return { duration: '' };
}

/** Flatten LiteAPI search results into picker-consumable offers. Each journey's
 *  offers become one FlightOffer per offer, sharing that journey's segment
 *  blocks. Insertion order is preserved (the API's own ranking). */
export function liteApiResultsToFlightOffers(results: FlightSearchResult[]): FlightOffer[] {
  const out: FlightOffer[] = [];
  let skippedNoPrice = 0;

  for (const r of results) {
    for (const j of r.journeys ?? []) {
      const segs = j.segments ?? [];
      const outSegs = segs.filter((s) => s.direction !== 'INBOUND');
      const inSegs = segs.filter((s) => s.direction === 'INBOUND');
      const outDur = journeyDirectionDuration(j, 'OUTBOUND');
      const inDur = journeyDirectionDuration(j, 'INBOUND');

      for (const o of j.offers ?? []) {
        const total = o.pricing?.display?.total;
        const currency = o.pricing?.display?.currency;
        if (typeof total !== 'number' || !currency) {
          skippedNoPrice++;
          continue;
        }
        const outbound = directionBlock(outSegs, outDur.duration, outDur.durationMinutes);
        const ret = inSegs.length > 0 ? directionBlock(inSegs, inDur.duration, inDur.durationMinutes) : null;
        out.push({
          id: o.offerId,
          price: total,
          currency,
          outbound,
          // The picker's return block has no durationMinutes field — drop it.
          return: ret
            ? {
                departure: ret.departure,
                arrival: ret.arrival,
                duration: ret.duration,
                stops: ret.stops,
                carriers: ret.carriers,
              }
            : null,
          ...(o.terms ? { conditions: { refundable: !!o.terms.refundable, changeable: !!o.terms.changeable } } : {}),
          expiresAt: o.expiration ?? null,
        });
      }
    }
  }

  if (skippedNoPrice > 0) {
    // Loud, honest: these offers exist upstream but cannot render without a
    // price — they are dropped, not faked.
    console.warn(`[LiteAPI flights] adapter: ${skippedNoPrice} offer(s) skipped — no display price in the response`);
  }
  return out;
}
