import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { getCOACode } from '@/lib/travelCategories';

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

    const { optionType, optionId, startDate, endDate, startTime, endTime, arriveDate, notes, amount: requestAmount, location: requestLocation } = await request.json();

    if (!optionType || !optionId || !startDate) {
      return NextResponse.json({ error: 'optionType, optionId, and startDate are required' }, { status: 400 });
    }

    const validTypes: OptionType[] = ['lodging', 'transfer', 'vehicle', 'activity', 'flight'];
    if (!validTypes.includes(optionType)) {
      return NextResponse.json({ error: `Invalid optionType: ${optionType}` }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      // A. Verify option exists and get details
      const details = optionType === 'flight'
        ? { title: notes || 'Flight', amount: Number(requestAmount || 0), tripId: id }
        : await getOptionDetails(tx, optionType, optionId, id);
      if (!details) throw new Error('Vendor option not found');

      // A. Update vendor option status to committed
      if (optionType !== 'flight') {
        await setOptionStatus(tx, optionType, optionId, 'committed', true);
      }

      // B. Create budget_line_item
      const prefix = trip.tripType === 'business' ? 'B' : 'P';

      // For activities, use the category registry for granular COA codes
      let coaNumber = VENDOR_TYPE_TO_COA[optionType] || '9950';
      let activityCategory: string | null = null;
      let activityLocation: string | null = requestLocation || null;
      if (optionType === 'activity') {
        const actOpt = await tx.trip_activity_expenses.findFirst({ where: { id: optionId, trip_id: id }, select: { category: true, vendor: true } });
        if (actOpt?.category) {
          activityCategory = actOpt.category;
          const registryCode = getCOACode(actOpt.category);
          if (registryCode !== '9950') coaNumber = registryCode;
        }
      }
      // For lodging, pull location from the lodging option
      if (optionType === 'lodging' && !activityLocation) {
        const lodgOpt = await tx.trip_lodging_options.findFirst({ where: { id: optionId, trip_id: id }, select: { location: true } });
        if (lodgOpt?.location) activityLocation = lodgOpt.location;
      }
      const coaCode = `${prefix}-${coaNumber}`;
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
        // Multi-day bookings (lodging, vehicles, etc.) — create entry per day
        const current = new Date(start);
        const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        const dailyCost = details.amount / totalDays;

        while (current <= end) {
          const dayNum = Math.round((current.getTime() - tripStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
          const entry = await tx.trip_itinerary.create({
            data: {
              tripId: id, day: dayNum, homeDate: current, homeTime: startTime || null,
              destDate: current, destTime: endTime || null,
              category: optionType, vendor: details.title, cost: Math.round(dailyCost * 100) / 100,
              note: notes || null, location: activityLocation, vendorOptionId: optionId, vendorOptionType: optionType,
            },
          });
          itineraryEntries.push(entry);
          current.setDate(current.getDate() + 1);
        }
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

    await prisma.$transaction(async (tx) => {
      // A. Reset vendor option status to proposed
      if (optionType !== 'flight') {
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
    console.error('Vendor uncommit error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to uncommit vendor option',
    }, { status: 500 });
  }
}
