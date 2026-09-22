import { NextResponse } from 'next/server';
import { ValidationError } from '@/lib/errors/ValidationError';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { getCOACode } from '@/lib/travelCategories';
import { TRAVEL_COA, isValidTravelCoaCode } from '@/lib/travelCOA';
import { parseTimeOrNull } from '@/lib/operations/parseTime';
import { zonedToInstant } from '@/lib/time';
import { getHotelContent } from '@/lib/liteapiClient';
import { reserveTravelSearch, TravelSearchQuotaError } from '@/lib/travelSearchQuota';
import { LiteApiError, MissingLiteApiKeyError } from '@/lib/travelErrors';
import { propertyClockOf, propertyClockStatement, type PropertyClock } from '@/lib/hotels/stayTimes';
// ACTIVITY-01 STEP 4 (2026-09-22): a tour's line carries the operator's published clock, the stated figures and the vendor's rate.
// STEP 4b (2026-09-22): and the commit takes NONE of them from the caller — it verifies the seal the options
// route put on its own Viator read, then DERIVES the figures, the note and the clock from that sealed quote.
import { activitySaveNoteOf, type ViatorSave } from '@/lib/activities/save';
import { QUOTE_MAX_AGE_MINUTES, quoteAgeMinutes, readViatorQuote, saveFromQuote } from '@/lib/activities/quote';
import { sealHolds } from '@/lib/activities/quoteSeal';
import { ACTIVITY_SEARCH_CURRENCY } from '@/lib/activities/searchContract';

/** A commit time the caller actually sent (HH:MM text) — null, '' and undefined are absence. */
function sentClock(v: unknown): boolean {
  return typeof v === 'string' && v.trim() !== '';
}

// Travel COA codes: P-9xxx (personal) / B-9xxx (business)
// Maps vendor optionType to the 9xxx travel COA number
const VENDOR_TYPE_TO_COA: Record<string, string> = {
  flight: '9100',
  lodging: '9200',
  vehicle: '9300',
  transfer: '9600',
  activity: '9400',
};

type OptionType = 'lodging' | 'transfer' | 'vehicle' | 'activity' | 'flight';

async function getOptionDetails(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  optionType: OptionType,
  optionId: string,
  tripId: string,
): Promise<{ title: string; amount: number; tripId: string } | null> {
  switch (optionType) {
    case 'lodging': {
      const opt = await tx.trip_lodging_options.findFirst({ where: { id: optionId, trip_id: tripId } });
      if (!opt) return null;
      // PR-Lodging-Total-Guard: total_price is the canonical WHOLE-STAY amount — the active path
      // writes price_per_night × nights + taxes (LodgingOptions.tsx:72). NEVER fall back to bare
      // price_per_night: that is ONE night masquerading as the full stay (a silent under-count).
      // If total_price is absent/non-positive, FAIL LOUD — trip_lodging_options persists no nights
      // count to recompute from, so any substitute would either undercount (one night) or invent a
      // divisor. The outer catch surfaces this as a 500 with the message.
      const totalPrice = Number(opt.total_price);
      if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
        throw new ValidationError(
          `Lodging option ${optionId} has no total_price — refusing to substitute one night's ` +
          `price_per_night as the whole-stay amount. Re-save the stay with a total.`,
        );
      }
      return { title: opt.title || 'Lodging', amount: totalPrice, tripId: opt.trip_id };
    }
    case 'transfer': {
      const opt = await tx.trip_transfer_options.findFirst({ where: { id: optionId, trip_id: tripId } });
      if (!opt) return null;
      return { title: opt.title || opt.vendor || 'Transfer', amount: Number(opt.price || 0), tripId: opt.trip_id };
    }
    case 'vehicle': {
      const opt = await tx.trip_vehicle_options.findFirst({ where: { id: optionId, trip_id: tripId } });
      if (!opt) return null;
      return { title: opt.title || opt.vendor || 'Vehicle', amount: Number(opt.total_price || opt.price_per_day || 0), tripId: opt.trip_id };
    }
    case 'activity': {
      const opt = await tx.trip_activity_expenses.findFirst({ where: { id: optionId, trip_id: tripId } });
      if (!opt) return null;
      return { title: opt.title || opt.vendor || 'Activity', amount: Number(opt.price || 0), tripId: opt.trip_id };
    }
    default:
      return null;
  }
}

async function setOptionStatus(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  optionType: OptionType,
  optionId: string,
  status: 'proposed' | 'selected' | 'committed',
  isSelected: boolean,
) {
  switch (optionType) {
    case 'lodging':
      await tx.trip_lodging_options.update({ where: { id: optionId }, data: { status, is_selected: isSelected } });
      break;
    case 'transfer':
      await tx.trip_transfer_options.update({ where: { id: optionId }, data: { status, is_selected: isSelected } });
      break;
    case 'vehicle':
      await tx.trip_vehicle_options.update({ where: { id: optionId }, data: { status, is_selected: isSelected } });
      break;
    case 'activity':
      await tx.trip_activity_expenses.update({ where: { id: optionId }, data: { status, is_selected: isSelected } });
      break;
  }
}

// SEC-2: existence+ownership check for the uncommit (DELETE) path. setOptionStatus
// updates by { id: optionId } alone; DELETE — unlike POST, which scopes via
// getOptionDetails first — had no prior trip-scoped check, so a user could flip
// another trip's option back to proposed/deselected. Returns true only when the
// option row belongs to THIS trip (scoped by trip_id, the getOptionDetails scope).
async function optionBelongsToTrip(
  optionType: OptionType,
  optionId: string,
  tripId: string,
): Promise<boolean> {
  switch (optionType) {
    case 'lodging':
      return !!(await prisma.trip_lodging_options.findFirst({ where: { id: optionId, trip_id: tripId }, select: { id: true } }));
    case 'transfer':
      return !!(await prisma.trip_transfer_options.findFirst({ where: { id: optionId, trip_id: tripId }, select: { id: true } }));
    case 'vehicle':
      return !!(await prisma.trip_vehicle_options.findFirst({ where: { id: optionId, trip_id: tripId }, select: { id: true } }));
    case 'activity':
      return !!(await prisma.trip_activity_expenses.findFirst({ where: { id: optionId, trip_id: tripId }, select: { id: true } }));
    default:
      return false;
  }
}

// ═══════════════════════════════════════════════════════════════
// POST — Commit a vendor option (creates budget + itinerary atomically)
// ═══════════════════════════════════════════════════════════════

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    const { optionType, optionId, startDate, endDate, startTime: startTimeInput, endTime: endTimeInput, arriveDate, notes: notesInput, amount: requestAmountInput, location: requestLocation, synthetic, category,
      // PR 3 — commit-time capture (all optional; absent = old client → derive/default):
      recurrence: recurrenceInput, coa_code: coaCodeInput, vendor_name: vendorNameInput,
      // PR-Flight-Duration-1: the flight's true elapsed minutes (from the flight provider). Flights only; null otherwise.
      durationMinutes: durationMinutesInput,
      // PR-tz-1: departure/arrival airport IANA zones (tz-0b sends them). Persisted as
      // passthrough below — flight-only; null otherwise. NEVER defaulted to a hardcoded zone.
      originZone: originZoneInput, destZone: destZoneInput,
      // HOTEL-02 (2026-09-22): the vendor's id of the hotel being booked — a LiteAPI stay names it
      // so the commit reads the property's own clock once; a stay from elsewhere sends none.
      liteapiHotelId: liteapiHotelIdInput,
      // ACTIVITY-01 STEP 4 (2026-09-22): a Viator tour's Save — the marker that a 0 is a price the
      // operator stated. STEP 4b (2026-09-22): the facts come from the SEALED quote this server issued
      // (viatorQuote + viatorSeal) plus the party and, for a variable-duration tour, the end the founder
      // picked inside the operator's stated range. `viatorSave` — the STEP 4 shape, where the browser
      // posted the figures — is refused by name: one method, and it is this one.
      priceStatedBy: priceStatedByInput, viatorQuote: viatorQuoteInput, viatorSeal: viatorSealInput,
      party: partyInput, endTimeChosen: endTimeChosenInput, viatorSave: viatorSaveInput } = await request.json();
    const now = new Date();
    // ─── ACTIVITY-01 STEP 4b: THE FIGURES ARE THE SERVER'S, SEALED ──────────────────
    // The caller sends the quote this server issued, its seal, and the party. It sends
    // NO amount, NO note and NO clock: every one of them is derived below from the
    // sealed quote, so the line's "Viator rate as of … · calculated" is provable by the
    // server that wrote it. A quote whose bytes changed does not verify; a quote issued
    // to another account is refused; one older than the stated window is refused.
    let viatorSave: ViatorSave | null = null;
    let viatorNote: string | null = null;
    if (viatorSaveInput !== undefined) {
      return NextResponse.json({ error: 'viatorSave is no longer accepted — a tour\'s figures are the ones this server sealed when it read them (send viatorQuote + viatorSeal + party); nothing was saved.' }, { status: 400 });
    }
    if (viatorQuoteInput !== undefined && viatorQuoteInput !== null) {
      if (optionType !== 'activity' || synthetic !== true) {
        return NextResponse.json({ error: 'viatorQuote belongs to a synthetic activity commit only.' }, { status: 400 });
      }
      if (requestAmountInput !== undefined || notesInput !== undefined || sentClock(startTimeInput) || sentClock(endTimeInput)) {
        return NextResponse.json({ error: 'amount, notes, startTime and endTime may not be sent with viatorQuote — the sealed quote states them; nothing was saved.' }, { status: 400 });
      }
      if (!sealHolds(viatorQuoteInput, viatorSealInput)) {
        return NextResponse.json({ error: 'this quote is not the one this server sealed — read the operator\'s availability again; nothing was saved.', source: 'viator' }, { status: 400 });
      }
      const read = readViatorQuote(viatorQuoteInput);
      if ('refused' in read) return NextResponse.json({ error: `${read.refused}; nothing was saved.` }, { status: 400 });
      if (read.userId !== user.id) {
        return NextResponse.json({ error: 'this quote was issued to another account; nothing was saved.' }, { status: 400 });
      }
      if (read.date !== String(startDate).slice(0, 10)) return NextResponse.json({ error: 'viatorQuote.date must be the startDate; nothing was saved.' }, { status: 400 });
      // A sealed quote holds for one Save session against a PUBLISHED timetable — past that
      // the founder checks availability again (the vendor's own rate expiry is honoured
      // separately, inside the derivation, and is usually the shorter of the two).
      const age = quoteAgeMinutes(read, now);
      if (age > QUOTE_MAX_AGE_MINUTES) return NextResponse.json({ error: `this availability was read ${Math.round(age)} minutes ago and a quote holds for ${QUOTE_MAX_AGE_MINUTES} — check availability again; nothing was saved.`, source: 'viator' }, { status: 400 });
      if (age < -1) return NextResponse.json({ error: 'this availability is stamped in the future; nothing was saved.' }, { status: 400 });
      // trip_itinerary.vendor and vendor_name are VarChar(255) (prisma/schema.prisma) — a title
      // the operator states longer than the column is REFUSED by name, never truncated.
      if (read.title.length > 255) return NextResponse.json({ error: `the operator's title is ${read.title.length} characters and the line's title column holds 255; nothing was saved.` }, { status: 400 });
      const derived = saveFromQuote(read, partyInput as Record<string, number>, endTimeChosenInput, ACTIVITY_SEARCH_CURRENCY, now);
      if ('refused' in derived) return NextResponse.json({ error: derived.refused, source: 'viator' }, { status: 400 });
      viatorSave = derived;
      viatorNote = activitySaveNoteOf(derived);
    }
    // The clock, the words and the figure the line is written with: the sealed quote's
    // when a tour was saved, the caller's otherwise (a flight, a stay, a hand-entered place).
    const startTime = viatorSave ? (viatorSave.startTime ?? undefined) : startTimeInput;
    const endTime = viatorSave ? (viatorSave.endTime ?? undefined) : endTimeInput;
    const notes = viatorNote ?? notesInput;
    const requestAmount = viatorSave ? viatorSave.total.amount : requestAmountInput;
    const durationMinutes = optionType === 'flight' && Number.isFinite(durationMinutesInput)
      ? Math.round(durationMinutesInput)
      : null;
    // HOTEL-01 (2026-09-22): a commit time is HH:MM or absent — a malformed one is a
    // 400 naming the field (the itinerary PATCH's own idiom), never silently nulled.
    // Parsed here, before the transaction, so the refusal can be returned.
    const blockStartParse = parseTimeOrNull(startTime, 'block_start_time');
    if (blockStartParse.error) return blockStartParse.error;
    const blockEndParse = parseTimeOrNull(endTime, 'block_end_time');
    if (blockEndParse.error) return blockEndParse.error;
    // Flight-only zone passthrough (mirrors the durationMinutes gate). A non-flight commit
    // has no airport zone → null (genuinely absent, not a substitute).
    // ACTIVITY-01 STEP 4 (2026-09-22): a Viator tour states the zone it operates in
    // (product.timeZone, e.g. Asia/Bangkok) — the instant is computed the flight way,
    // naive wall-clock + the STATED IANA zone, ONLY when the operator states the zone;
    // the block window stays the naive local clock. Never a zone guessed.
    const activityZone = viatorSave?.timeZone ?? null;
    const startZone = optionType === 'flight' && typeof originZoneInput === 'string' ? originZoneInput : activityZone;
    const endZone = optionType === 'flight' && typeof destZoneInput === 'string' ? destZoneInput : activityZone;
    // PR-tz-2-fill: the true UTC instant = naive wall-clock + the airport IANA zone, via the
    // canonical converter. Computed ONLY when both the zone (flight-only) AND the date+time are
    // present → else null (no zone, no instant — an honest null, not a fallback). end_at uses
    // arriveDate (the ARRIVAL date), not endDate (which is the roundtrip RETURN date). Inputs are
    // sliced to zonedToInstant's strict 'YYYY-MM-DD'/'HH:MM' contract. NOT wrapped in try/catch:
    // if inputs are present and conversion still throws, that's bad data we WANT to surface.
    const startAt = startZone && startDate && startTime
      ? zonedToInstant(String(startDate).slice(0, 10), String(startTime).slice(0, 5), startZone)
      : null;
    // A flight's end is on its arrival date; a tour's end is on its own day (a fixed duration inside the day).
    const endAt = endZone && (activityZone ? startDate : arriveDate) && endTime
      ? zonedToInstant(String(activityZone ? startDate : arriveDate).slice(0, 10), String(endTime).slice(0, 5), endZone)
      : null;

    // PR 3: validate the user-selected COA against the canonical travel account
    // list — NO free-text COA codes. Absent is fine (server derives, below);
    // present-but-unknown is rejected loud (never silently coerced).
    if (coaCodeInput != null && coaCodeInput !== '' && !isValidTravelCoaCode(coaCodeInput)) {
      return NextResponse.json({ error: `Unknown COA code "${coaCodeInput}" — not a travel account.` }, { status: 400 });
    }
    const recurrenceOverride: 'once' | 'daily' | null =
      recurrenceInput === 'once' || recurrenceInput === 'daily' ? recurrenceInput : null;

    // PR-32: a hotel committed from the discover detail page ("Add to trip")
    // has NO trip_lodging_options row (scanner recs live in
    // trip_scanner_results). `synthetic: true` makes the lodging path build the
    // budget item straight from the payload — mirroring the flight synthetic
    // path — instead of looking up a row that doesn't exist. The existing
    // row-based lodging commit (from the planner's vendor options) is untouched.
    const isSyntheticLodging = optionType === 'lodging' && synthetic === true;

    // PR-35: a Google place committed from the detail page ("Add to trip") is an
    // UNPRICED discovery result with NO trip_activity_expenses row — `synthetic:
    // true` + a `category` (the scan catKey) builds the budget item from the
    // manual-entry payload (amount/dates/times) and takes the per-category COA
    // from the passed category (PR-35a-synced). One-time only (recurring is a
    // later PR). The existing row-based activity commit is untouched.
    const isSyntheticActivity = optionType === 'activity' && synthetic === true;

    if (!optionType || !optionId || !startDate) {
      return NextResponse.json({ error: 'optionType, optionId, and startDate are required' }, { status: 400 });
    }

    const validTypes: OptionType[] = ['lodging', 'transfer', 'vehicle', 'activity', 'flight'];
    if (!validTypes.includes(optionType)) {
      return NextResponse.json({ error: `Invalid optionType: ${optionType}` }, { status: 400 });
    }

    // ─── PR-35: validation + accounting rule for synthetic place commits ──────
    // SERVER-SIDE guard (the real enforcement, not just UI). NO fallbacks: a bad
    // amount/date fails loud; a personal-only category on a Business trip is
    // BLOCKED (the COA's null-business constraint enforced, never substituted).
    let placePrefix: 'P' | 'B' = trip.tripType === 'business' ? 'B' : 'P';
    if (isSyntheticActivity) {
      if (!category || !TRAVEL_COA[category]) {
        return NextResponse.json({ error: 'A valid category is required to commit this place.' }, { status: 400 });
      }
      const amt = Number(requestAmount);
      // ACTIVITY-01 (2026-09-22): a stated 0 is a price. A 0 is accepted ONLY when the
      // request marks it priceStatedBy 'operator' and names the product option it was
      // stated for (a Viator Save); the Google path (no marker) keeps its > 0 rule.
      const operatorStated = priceStatedByInput === 'operator' && viatorSave !== null;
      if (!Number.isFinite(amt) || amt < 0 || (amt === 0 && !operatorStated)) {
        return NextResponse.json({ error: 'A positive amount is required — Google places have no price, so enter the expected cost; a 0 is accepted only as a price the operator stated (priceStatedBy \'operator\' with its product option code).' }, { status: 400 });
      }
      if (!endDate) {
        return NextResponse.json({ error: 'Start and end dates are required.' }, { status: 400 });
      }
      if (new Date(endDate) < new Date(startDate)) {
        return NextResponse.json({ error: 'End date must be on or after start date.' }, { status: 400 });
      }
      const businessCapable = TRAVEL_COA[category].coaBusiness != null;
      if (!businessCapable && trip.tripType === 'business') {
        // Personal-only category (coaBusiness:null) on a Business trip → BLOCK.
        return NextResponse.json({
          error: `${TRAVEL_COA[category].label} is a personal-only category and can't be committed to a Business trip.`,
        }, { status: 422 });
      }
      // Business-capable → B- on business/mixed, P- on personal. Personal-only →
      // P- (mixed/personal; business already blocked). Never silently file a
      // personal-only category as business.
      placePrefix = businessCapable && (trip.tripType === 'business' || trip.tripType === 'mixed') ? 'B' : 'P';
    }

    // ─── HOTEL-02 (2026-09-22): THE STAY'S TIMES ARE THE PROPERTY'S, NOT OURS ───────────
    // A lodging commit that names the vendor's hotel reads the property's own check-in and
    // check-out HERE — the one content call per booking (GET /data/hotel), reserved once
    // under the existing 'hotelcontent' cap, after validation and before any write. The
    // clock the property states is written to the block window AND the ledger; the clock it
    // does not state is null and the calendar flags it; a call that fails fails the commit
    // loudly with the reason — never a silent null, never a time nobody stated. A caller may
    // not send its own startTime / endTime beside the hotel id: the property states them.
    // A stay that names no hotel (a hand-entered or scanned lodging) keeps the caller's
    // stated clock or null, exactly as HOTEL-01 left it.
    const liteapiHotelId = typeof liteapiHotelIdInput === 'string' && liteapiHotelIdInput.trim() !== '' ? liteapiHotelIdInput.trim() : null;
    let propertyClock: PropertyClock | null = null;
    if (optionType === 'lodging' && liteapiHotelId) {
      if (sentClock(startTime) || sentClock(endTime)) {
        return NextResponse.json(
          { error: 'Validation', field: 'startTime', message: 'startTime / endTime may not be sent with liteapiHotelId — the property states its own check-in and check-out; the commit reads them.' },
          { status: 400 },
        );
      }
      // A row-based stay (the planner's trip_lodging_options row) is checked for existence,
      // ownership and a whole-stay total BEFORE the paid call — a commit that would be refused
      // inside the transaction must not spend a reservation and a vendor read first.
      if (!isSyntheticLodging) {
        const row = await prisma.trip_lodging_options.findFirst({ where: { id: optionId, trip_id: id }, select: { total_price: true } });
        if (!row) return NextResponse.json({ error: 'Option not found' }, { status: 404 });
        const total = Number(row.total_price);
        if (!Number.isFinite(total) || total <= 0) {
          return NextResponse.json({ error: `Lodging option ${optionId} has no total_price — re-save the stay with a total before committing it.` }, { status: 400 });
        }
      }
      try {
        await reserveTravelSearch('hotelcontent');
      } catch (err) {
        if (err instanceof TravelSearchQuotaError) {
          return NextResponse.json({ error: 'Hotel details are temporarily paused (the daily cap is reached) — the stay was not committed. Please try again later.', source: 'liteapi' }, { status: 503 });
        }
        throw err;
      }
      let content;
      try {
        content = await getHotelContent(liteapiHotelId);
      } catch (err) {
        // The reason, in a fixed line: the endpoint and the status — never the vendor's
        // response body (HYG-02 / SEC-02b: a thrown message does not reach the browser).
        if (err instanceof LiteApiError) {
          return NextResponse.json({ error: `The property's check-in and check-out could not be read from LiteAPI — ${err.endpoint} answered ${err.status}. Nothing was committed.`, source: 'liteapi', status: err.status }, { status: 502 });
        }
        if (err instanceof MissingLiteApiKeyError) {
          return NextResponse.json({ error: `The property's check-in and check-out could not be read — no LiteAPI key is configured for ${err.mode}. Nothing was committed.`, source: 'liteapi', kind: 'missing_key' }, { status: 502 });
        }
        throw err;
      }
      if (!content) {
        return NextResponse.json({ error: `LiteAPI returned no content for hotel ${liteapiHotelId} — the property's check-in and check-out could not be read. Nothing was committed.`, source: 'liteapi' }, { status: 502 });
      }
      const read = propertyClockOf(content.checkinCheckoutTimes);
      if ('unreadable' in read) {
        return NextResponse.json({ error: `${read.unreadable} — nothing was committed.`, source: 'liteapi' }, { status: 502 });
      }
      propertyClock = read.clock;
    }
    // The stay's clock as stored — the property's (a LiteAPI stay) or the caller's stated one
    // (any other lodging, any other date-range type), or null. One clock, two columns: the
    // @db.Time block window the calendar draws and the VarChar ledger clock the budget shows.
    const stayStart = propertyClock ? parseTimeOrNull(propertyClock.checkin, 'block_start_time') : blockStartParse;
    if (stayStart.error) return stayStart.error;
    const stayEnd = propertyClock ? parseTimeOrNull(propertyClock.checkout, 'block_end_time') : blockEndParse;
    if (stayEnd.error) return stayEnd.error;
    const ledgerStart: string | null = propertyClock ? propertyClock.checkin : (startTime || null);
    const ledgerEnd: string | null = propertyClock ? propertyClock.checkout : (endTime || null);

    const result = await prisma.$transaction(async (tx) => {
      // A. Verify option exists and get details
      // PR-32: flights AND synthetic lodging (detail-page hotels) build details
      // from the payload directly — no DB option row required.
      // ACTIVITY-01 STEP 4 (2026-09-22): a tour's line is TITLED by the operator's own product
      // title (viatorSave.title) — its note carries the option, the clock, the party, the rate and
      // the calculated figure, and is far longer than the VarChar(255) title column. Every other
      // synthetic commit keeps titling itself from its note, exactly as before.
      const details = (optionType === 'flight' || isSyntheticLodging || isSyntheticActivity)
        ? { title: viatorSave ? viatorSave.title : (notes || (isSyntheticLodging ? 'Lodging' : isSyntheticActivity ? 'Place' : 'Flight')), amount: Number(requestAmount || 0), tripId: id }
        : await getOptionDetails(tx, optionType, optionId, id);
      if (!details) throw new ValidationError('Vendor option not found', { status: 404 });

      // A. Update vendor option status to committed (only for real option rows —
      // flights, synthetic lodging, and synthetic activity have none to update).
      if (optionType !== 'flight' && !isSyntheticLodging && !isSyntheticActivity) {
        await setOptionStatus(tx, optionType, optionId, 'committed', true);
      }

      // B. Create budget_line_item
      const prefix = trip.tripType === 'business' ? 'B' : 'P';

      // For activities, use the category registry for granular COA codes
      let coaNumber = VENDOR_TYPE_TO_COA[optionType] || '9950';
      let activityCategory: string | null = null;
      let activityLocation: string | null = requestLocation || null;
      // PR-35: synthetic activity (Google place) takes its COA from the passed
      // category (no DB row) — PR-35a synced these so the code is correct.
      if (isSyntheticActivity && category) {
        activityCategory = category;
        const registryCode = getCOACode(category);
        if (registryCode !== '9950') coaNumber = registryCode;
      } else if (optionType === 'activity') {
        const actOpt = await tx.trip_activity_expenses.findFirst({ where: { id: optionId, trip_id: id }, select: { category: true, vendor: true, notes: true } });
        if (actOpt?.category) {
          activityCategory = actOpt.category;
          const registryCode = getCOACode(actOpt.category);
          if (registryCode !== '9950') coaNumber = registryCode;
        }
        // If no location passed from frontend, try to find it from scanner results
        if (!activityLocation && actOpt?.category) {
          const scanResult = await tx.trip_scanner_results.findFirst({
            where: { tripId: id, category: actOpt.category },
            select: { destination: true },
          });
          if (scanResult?.destination) activityLocation = scanResult.destination;
        }
      }
      // For row-based lodging, pull location from the lodging option. Synthetic
      // lodging (PR-32) carries its location in the payload (requestLocation =
      // the scan destination), so there's no row to read.
      if (optionType === 'lodging' && !isSyntheticLodging && !activityLocation) {
        const lodgOpt = await tx.trip_lodging_options.findFirst({ where: { id: optionId, trip_id: id }, select: { location: true } });
        if (lodgOpt?.location) activityLocation = lodgOpt.location;
      }
      // For flights, derive location from notes (e.g., "LAX → HND")
      if (optionType === 'flight' && !activityLocation && notes) {
        activityLocation = notes;
      }
      // PR-35: synthetic place commits use placePrefix (enforces the personal-
      // only/business rule); all other commits keep the trip-type prefix.
      const derivedCoaCode = `${isSyntheticActivity ? placePrefix : prefix}-${coaNumber}`;
      // PR 3: the user's validated COA selection wins; absent → derive as today
      // (logged, so a fallback never diverges silently from the new capture path).
      let coaCode: string;
      if (coaCodeInput) {
        coaCode = coaCodeInput;
      } else {
        coaCode = derivedCoaCode;
        console.log(`[vendor-commit] COA fallback (no coa_code in body) → derived ${derivedCoaCode} for optionType=${optionType} category=${category ?? 'n/a'}`);
      }
      const start = new Date(startDate);

      const budgetItem = await tx.budget_line_items.create({
        data: {
          userId: user.id,
          tripId: id,
          coaCode,
          year: start.getFullYear(),
          month: start.getMonth() + 1,
          amount: details.amount,
          description: details.title,
          source: 'trip',
        },
      });

      // C. Create trip_itinerary entries
      const end = endDate ? new Date(endDate) : start;
      const tripStart = trip.startDate ? new Date(trip.startDate) : start;
      const itineraryEntries = [];

      // Transfers are one-time events: arrival on start date, departure on end date
      if (optionType === 'transfer') {
        const transferOpt = await tx.trip_transfer_options.findFirst({ where: { id: optionId, trip_id: id } });
        const transferDate = transferOpt?.direction === 'departure' ? end : start;
        const dayNum = Math.round((transferDate.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const entry = await tx.trip_itinerary.create({
          data: {
            tripId: id, day: dayNum, homeDate: transferDate, homeTime: startTime || null,
            destDate: transferDate, destTime: startTime || null,
            category: optionType, vendor: details.title, cost: Math.round(details.amount * 100) / 100,
            note: notes || null, location: activityLocation, vendorOptionId: optionId, vendorOptionType: optionType,
          },
        });
        itineraryEntries.push(entry);
      } else if (optionType === 'flight') {
        // Flights: single entry with departure date/time and arrival date/time
        const dayNum = Math.round((start.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const flightArriveDate = arriveDate ? new Date(arriveDate) : end;
        const entry = await tx.trip_itinerary.create({
          data: {
            tripId: id, day: dayNum, homeDate: start, homeTime: startTime || null,
            destDate: flightArriveDate, destTime: endTime || null,
            category: optionType, vendor: details.title, cost: Math.round(details.amount * 100) / 100,
            note: notes || null, location: activityLocation, vendorOptionId: optionId, vendorOptionType: optionType,
            // PR-Flight-Duration-1: the true elapsed minutes (from the flight provider) — render depart+duration (PR-2).
            duration_minutes: durationMinutes,
            // PR-tz-1 zones + PR-tz-2-fill instants: the airport IANA zones (passthrough) and the
            // true UTC instant anchor computed from naive+zone (null when no zone/time).
            start_zone: startZone,
            end_zone: endZone,
            start_at: startAt,
            end_at: endAt,
          },
        });
        itineraryEntries.push(entry);
      } else {
        // Date-range bookings (lodging, gym membership, multi-day activities) →
        // ONE recurrence-template row, NOT N amortized per-day rows. cost is the
        // FULL real amount (no division) so the itinerary never penny-drifts from
        // the single honest budget row. recurrence='daily' for a real range,
        // 'once' for a single date. Per-night/per-day display math is the
        // renderer's job (later PR), never stored.
        const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const isRange = totalDays > 1;
        const dayNum = Math.round((start.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;

        // Daily time window (@db.Time(6), 1970-anchored): the stay's clock resolved
        // above — HOTEL-02 (2026-09-22): the property's own, read once at commit, or
        // the caller's stated one for a lodging that names no hotel, or NULL. HOTEL-01
        // (2026-09-22) removed the hotel-standard 15:00 / 11:00 a lodging block used
        // to be given — an invented time, the class GRID-01 removed; when nothing is
        // stated the window is null and the calendar says so.
        const blockStart = stayStart.value;
        const blockEnd = stayEnd.value;

        const entry = await tx.trip_itinerary.create({
          data: {
            tripId: id, day: dayNum, homeDate: start,
            // HOTEL-01 (2026-09-22): the ledger's homeTime / destTime are the stated times
            // or null — the "—" a ledger shows for an unstated check-in is the truth.
            // HOTEL-02: the same clock the block window holds (one clock, two columns).
            // Plain VarChar(10) strings, the same format the flight branch writes.
            homeTime: ledgerStart,
            destDate: end, destTime: ledgerEnd,
            category: optionType, vendor: details.title, cost: Math.round(details.amount * 100) / 100,
            note: notes || null, location: activityLocation, vendorOptionId: optionId, vendorOptionType: optionType,
            // PR 3: the user's recurrence choice wins; absent → span default.
            recurrence: recurrenceOverride ?? (isRange ? 'daily' : 'once'),
            block_start_time: blockStart,
            block_end_time: blockEnd,
            // ACTIVITY-01 STEP 4: the operator's stated zone and the instant it fixes (a tour), else null.
            start_zone: activityZone,
            end_zone: activityZone,
            start_at: activityZone ? startAt : null,
            end_at: activityZone ? endAt : null,
            duration_minutes: viatorSave?.duration?.kind === 'fixed' ? viatorSave.duration.minutes : null,
            // PR 3: clean vendor name + COA captured on the itinerary row.
            vendor_name: vendorNameInput || details.title,
            coa_code: coaCode,
          },
        });
        itineraryEntries.push(entry);
      }

      // Auditable 1:1 link: point the single budget row at its itinerary template
      // (budget_line_items.itineraryId was previously never populated). Every
      // branch now writes exactly one primary itinerary row.
      if (itineraryEntries[0]) {
        await tx.budget_line_items.update({
          where: { id: budgetItem.id },
          data: { itineraryId: itineraryEntries[0].id },
        });
      }

      return { budgetItem, itineraryEntries, optionType, optionId, details };
    }, { maxWait: 10000, timeout: 30000 });

    // D. Write calendar_events for hub visibility (outside transaction — uses raw SQL)
    const OPTION_TYPE_ICONS: Record<string, string> = {
      lodging: '🏨', flight: '✈️', transfer: '🚕', vehicle: '🏍️', activity: '🎯',
    };
    const calIcon = OPTION_TYPE_ICONS[optionType] || '📌';
    const calTitle = `${result.details.title} (${optionType})`;
    const calSourceId = `trip:${id}:vendor:${optionId}`;
    const calStart = new Date(startDate);
    // PR-Flight-Times: a flight is a timed block wheels-up → wheels-down (the OUTBOUND leg).
    // For flights, end_date is the ARRIVAL date (not the roundtrip return date) and the new
    // start_time/end_time carry depart/arrive, so the calendar draws a timed block. Every
    // other option type keeps end_date = endDate and null times (all-day, exactly as before).
    const isFlight = optionType === 'flight';
    const calEnd = isFlight
      ? (arriveDate ? new Date(arriveDate) : calStart)
      : (endDate ? new Date(endDate) : calStart);
    const calStartTime = isFlight ? (startTime || null) : null; // depart (wheels-up), "HH:MM"
    const calEndTime = isFlight ? (endTime || null) : null;     // arrive (wheels-down), "HH:MM"
    // PR-tz-1 zones + PR-tz-2-fill instants: the airport IANA zones (passthrough; flight-only via
    // startZone/endZone) and the true UTC instant anchor (startAt/endAt, computed from naive+zone).
    try {
      await prisma.$queryRaw`
        INSERT INTO calendar_events (user_id, source, source_id, title, category, icon, color, start_date, end_date, start_time, end_time, is_recurring, coa_code, budget_amount, duration_minutes, start_zone, end_zone, start_at, end_at)
        VALUES (${user.id}, 'trip', ${calSourceId}, ${calTitle}, 'trip', ${calIcon}, 'cyan', ${calStart}, ${calEnd}, ${calStartTime}::time, ${calEndTime}::time, false, ${result.budgetItem.coaCode}, ${Math.round(result.details.amount)}, ${durationMinutes}, ${startZone}, ${endZone}, ${startAt}, ${endAt})
      `;
    } catch (calErr) {
      console.error('Calendar event insert failed (non-fatal):', calErr);
    }

    return NextResponse.json({
      success: true,
      budgetItemId: result.budgetItem.id,
      itineraryCount: result.itineraryEntries.length,
      // HOTEL-02: what the commit stored for the stay's clock, in words — the property's
      // stated check-in / check-out, or its silence named. Null for anything but a stay
      // that named its hotel.
      stayTimes: propertyClock ? { ...propertyClock, source: 'property', statement: propertyClockStatement(propertyClock) } : null,
      // ACTIVITY-01 STEP 4: what the commit stored for a tour — the published clock, the stated figures, the rate, the calculated total, the note.
      viatorSave: viatorSave ? { startTime: viatorSave.startTime, endTime: viatorSave.endTime, timeZone: viatorSave.timeZone, duration: viatorSave.duration, native: viatorSave.native, extra: viatorSave.extra, rate: viatorSave.rate, total: viatorSave.total, note: viatorNote } : null,
    });
  } catch (error) {
    return failClosedResponse('Vendor commit', 'Failed to commit vendor option', error);
  }
}

// ═══════════════════════════════════════════════════════════════
// DELETE — Uncommit a vendor option (removes budget + itinerary atomically)
// ═══════════════════════════════════════════════════════════════

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const trip = await prisma.trips.findFirst({ where: { id, userId: user.id } });
    if (!trip) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });

    const { optionType, optionId, notes: deleteNotes } = await request.json();

    if (!optionType || !optionId) {
      return NextResponse.json({ error: 'optionType and optionId are required' }, { status: 400 });
    }

    // Synthetic commits — Google places via PlaceCommitForm (`place-…`,
    // PlaceCommitForm.tsx:52) and LiteAPI hotels via AddToTripButton (`hotel-…`,
    // AddToTripButton.tsx:77) — carry a NON-UUID placeholder in vendorOptionId and
    // have NO option row: the commit POST builds them from the payload and skips
    // the option-row update via its guard (route.ts:158). Mirror that guard here so
    // the uncommit never looks the placeholder up in a @db.Uuid option table (which
    // throws "Error creating UUID"). These `place-`/`hotel-`/`viator-` prefixes are the
    // only three synthetic optionId constructors in the codebase. NON-synthetic optionIds
    // are untouched, so a genuinely malformed UUID still surfaces its error below.
    // ACTIVITY-01 STEP 4 (2026-09-22): a Viator tour's Save is the third synthetic constructor (`viator-`, PublicActivitySearch.tsx).
    const isSynthetic = optionId.startsWith('place-') || optionId.startsWith('hotel-') || optionId.startsWith('viator-');

    // SEC-2: for a real option row, verify it belongs to THIS trip before the
    // uncommit mutates it (flights/synthetic have no option row — skip, same as
    // the setOptionStatus guard below). Defensive 404 for a foreign option.
    if (optionType !== 'flight' && !isSynthetic) {
      const owned = await optionBelongsToTrip(optionType, optionId, id);
      if (!owned) return NextResponse.json({ error: 'Option not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      // A. Reset vendor option status to proposed (real option rows only —
      // flights and synthetic commits have no option row to update).
      if (optionType !== 'flight' && !isSynthetic) {
        await setOptionStatus(tx, optionType, optionId, 'proposed', false);
      }

      // B. Delete budget_line_items created by this vendor option
      if (optionType === 'flight') {
        // For flights, match on itinerary entries to find the budget item description
        const itinEntries = await tx.trip_itinerary.findMany({
          where: { tripId: id, vendorOptionId: optionId, vendorOptionType: 'flight' },
          select: { vendor: true },
        });
        const flightTitle = itinEntries[0]?.vendor || deleteNotes || 'Flight';
        await tx.budget_line_items.deleteMany({
          where: { tripId: id, description: flightTitle, source: 'trip' },
        });
      } else if (isSynthetic) {
        // Synthetic commits have no option row — the budget title lives on the
        // itinerary rows (vendor), exactly as the commit wrote it (route.ts:264),
        // mirroring the flight branch above (no getOptionDetails / UUID lookup).
        const itinEntries = await tx.trip_itinerary.findMany({
          where: { tripId: id, vendorOptionId: optionId, vendorOptionType: optionType },
          select: { vendor: true },
        });
        const syntheticTitle = itinEntries[0]?.vendor || deleteNotes || null;
        if (syntheticTitle) {
          await tx.budget_line_items.deleteMany({
            where: { tripId: id, description: syntheticTitle, source: 'trip' },
          });
        }
      } else {
        const details = await getOptionDetails(tx, optionType, optionId, id);
        if (details) {
          await tx.budget_line_items.deleteMany({
            where: { tripId: id, description: details.title, source: 'trip' },
          });
        }
      }

      // C. Delete trip_itinerary entries linked to this vendor option
      await tx.trip_itinerary.deleteMany({
        where: { tripId: id, vendorOptionId: optionId, vendorOptionType: optionType },
      });
    }, { maxWait: 10000, timeout: 30000 });

    // D. Delete corresponding calendar_events
    const calSourceId = `trip:${id}:vendor:${optionId}`;
    try {
      await prisma.$queryRaw`DELETE FROM calendar_events WHERE source = 'trip' AND source_id = ${calSourceId}`;
    } catch (calErr) {
      console.error('Calendar event delete failed (non-fatal):', calErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return failClosedResponse('Vendor uncommit', 'Failed to uncommit vendor option', error);
  }
}
