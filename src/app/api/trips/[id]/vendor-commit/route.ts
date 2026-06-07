import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { getCOACode } from '@/lib/travelCategories';
import { TRAVEL_COA, isValidTravelCoaCode } from '@/lib/travelCOA';
import { parseTimeOrNull } from '@/lib/operations/parseTime';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

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
      return { title: opt.title || 'Lodging', amount: Number(opt.total_price || opt.price_per_night || 0), tripId: opt.trip_id };
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

    const { optionType, optionId, startDate, endDate, startTime, endTime, arriveDate, notes, amount: requestAmount, location: requestLocation, synthetic, category,
      // PR 3 — commit-time capture (all optional; absent = old client → derive/default):
      recurrence: recurrenceInput, coa_code: coaCodeInput, vendor_name: vendorNameInput } = await request.json();

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
      if (!Number.isFinite(amt) || amt <= 0) {
        return NextResponse.json({ error: 'A positive amount is required — Google places have no price, so enter the expected cost.' }, { status: 400 });
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

    const result = await prisma.$transaction(async (tx) => {
      // A. Verify option exists and get details
      // PR-32: flights AND synthetic lodging (detail-page hotels) build details
      // from the payload directly — no DB option row required.
      const details = (optionType === 'flight' || isSyntheticLodging || isSyntheticActivity)
        ? { title: notes || (isSyntheticLodging ? 'Lodging' : isSyntheticActivity ? 'Place' : 'Flight'), amount: Number(requestAmount || 0), tripId: id }
        : await getOptionDetails(tx, optionType, optionId, id);
      if (!details) throw new Error('Vendor option not found');

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

        // Daily time window (@db.Time(6), 1970-anchored): use the commit's time
        // inputs when present; lodging falls back to an overnight 22:00–07:00 stay
        // window; other types stay NULL (no fabricated window).
        const blockStart =
          parseTimeOrNull(startTime, 'block_start_time').value ??
          (optionType === 'lodging' ? parseTimeOrNull('22:00', 'block_start_time').value : null);
        const blockEnd =
          parseTimeOrNull(endTime, 'block_end_time').value ??
          (optionType === 'lodging' ? parseTimeOrNull('07:00', 'block_end_time').value : null);

        const entry = await tx.trip_itinerary.create({
          data: {
            tripId: id, day: dayNum, homeDate: start, homeTime: startTime || null,
            destDate: end, destTime: endTime || null,
            category: optionType, vendor: details.title, cost: Math.round(details.amount * 100) / 100,
            note: notes || null, location: activityLocation, vendorOptionId: optionId, vendorOptionType: optionType,
            // PR 3: the user's recurrence choice wins; absent → span default.
            recurrence: recurrenceOverride ?? (isRange ? 'daily' : 'once'),
            block_start_time: blockStart,
            block_end_time: blockEnd,
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
    const calEnd = endDate ? new Date(endDate) : calStart;
    try {
      await prisma.$queryRaw`
        INSERT INTO calendar_events (user_id, source, source_id, title, category, icon, color, start_date, end_date, is_recurring, coa_code, budget_amount)
        VALUES (${user.id}, 'trip', ${calSourceId}, ${calTitle}, 'trip', ${calIcon}, 'cyan', ${calStart}, ${calEnd}, false, ${result.budgetItem.coaCode}, ${Math.round(result.details.amount)})
      `;
    } catch (calErr) {
      console.error('Calendar event insert failed (non-fatal):', calErr);
    }

    // Audit — mirrors the operations sibling (daily-plan/blocks/[blockId]:163-179).
    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'trip_itinerary_committed',
        description: `Committed ${optionType} "${result.details.title}" to trip ${id}`,
      },
      target: { table: 'trip_itinerary', id: result.itineraryEntries[0]?.id ?? result.budgetItem.id },
      payload: {
        after: { itineraryEntries: result.itineraryEntries, budgetItem: result.budgetItem },
        metadata: { tripId: id, optionType, optionId, budgetItemId: result.budgetItem.id },
      },
    });

    return NextResponse.json({
      success: true,
      budgetItemId: result.budgetItem.id,
      itineraryCount: result.itineraryEntries.length,
    });
  } catch (error) {
    console.error('Vendor commit error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to commit vendor option',
    }, { status: 500 });
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
    // throws "Error creating UUID"). These `place-`/`hotel-` prefixes are the only
    // two synthetic optionId constructors in the codebase. NON-synthetic optionIds
    // are untouched, so a genuinely malformed UUID still surfaces its error below.
    const isSynthetic = optionId.startsWith('place-') || optionId.startsWith('hotel-');

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

    // Audit — mirrors the operations sibling (daily-plan/blocks/[blockId]:213-226).
    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'trip_itinerary_uncommitted',
        description: `Uncommitted ${optionType} (${optionId}) from trip ${id}`,
      },
      target: { table: 'trip_itinerary', id: optionId },
      payload: { metadata: { tripId: id, optionType, optionId } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Vendor uncommit error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to uncommit vendor option',
    }, { status: 500 });
  }
}
