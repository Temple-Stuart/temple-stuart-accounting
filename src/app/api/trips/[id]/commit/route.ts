import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: userEmail } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse request body - THIS WAS MISSING!
    const body = await request.json();
    const { startDay, budgetItems } = body;
    
    console.log('Commit received:', { startDay, budgetItems });

    // Get the trip
    const trip = await prisma.trips.findUnique({
      where: { id }
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Prevent re-committing - must uncommit first
    if (trip.status === 'committed') {
      return NextResponse.json({ error: 'Trip already committed. Uncommit first.' }, { status: 400 });
    }

    // Calculate dates from startDay + trip.month/year
    const startDate = new Date(trip.year, trip.month - 1, startDay);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + (trip.daysTravel || 7) - 1);

    // Delete old budget items for this trip
    await prisma.budget_line_items.deleteMany({
      where: { tripId: id }
    });

    // COA code mapping - Personal travel + Business cross-entity
    const coaMapping: Record<string, string> = {
      // Flight & Lodging
      'flight': 'P-7100',
      'hotel': 'P-7200',
      'lodging': 'P-7200',
      // Vehicle rentals
      'car': 'P-7300',
      'rental_car': 'P-7300',
      'carRental': 'P-7300',
      // Ground transport
      'transfers': 'P-7600',
      'airportTransfers': 'P-7600',
      'groundTransport': 'P-7600',
      'transport': 'P-7600',
      // Activities & Entertainment
      'activities': 'P-7400',
      'liftTickets': 'P-7400',
      'lift_pass': 'P-7400',
      'lessons': 'P-7400',
      'apres': 'P-7400',
      'yoga': 'P-7400',
      'massage': 'P-7400',
      'conference': 'P-7400',
      'networking': 'P-7400',
      'nightlife': 'P-7400',
      'fitness': 'P-7400',
      'wellness': 'P-7400',
      // Equipment rentals
      'equipment': 'P-7500',
      'equipmentRental': 'P-7500',
      'board_rental': 'P-7500',
      'kite_rental': 'P-7500',
      // Food & Meals
      'meals': 'P-7700',
      'travelMeals': 'P-7700',
      'food': 'P-7700',
      'coffee': 'P-7700',
      // Tips & Misc
      'tips': 'P-7800',
      'tipsMisc': 'P-7800',
      // Personal expense - coworking/bizdev
      'coworking': 'P-8220',
      'bizdev': 'P-8220',
    };

    // Save new budget items from request
    let totalBudget = 0;
    if (budgetItems && budgetItems.length > 0) {
      for (const item of budgetItems) {
        const coaCode = coaMapping[item.category] || coaMapping[item.description] || 'P-7800';
        totalBudget += Number(item.amount);
        
        await prisma.budget_line_items.create({
          data: {
            id: `bli_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            userId: user.id,
            tripId: id,
            coaCode,
            year: startDate.getFullYear(),
            month: startDate.getMonth() + 1,
            amount: item.amount,
            description: item.description || item.category,
            source: 'trip',
            updatedAt: new Date()
          }
        });
      }
    }

    // Update trip with dates and status
    await prisma.trips.update({
      where: { id },
      data: { 
        status: 'committed',
        committedAt: new Date(),
        startDate,
        endDate
      }
    });

    // Delete existing calendar event if any
    await prisma.$queryRaw`
      DELETE FROM calendar_events WHERE source = 'trip' AND source_id::text = ${id}
    `;

    // Create calendar event
    await prisma.$queryRaw`
      INSERT INTO calendar_events (
        user_id, source, source_id, title, description, category, icon, color,
        start_date, end_date, is_recurring, location, latitude, longitude, budget_amount
      ) VALUES (
        ${user.id}, 'trip', ${id}, ${trip.name}, ${trip.destination || null},
        'trip', '✈️', 'cyan',
        ${startDate}, ${endDate}, false,
        ${trip.destination || null}, ${trip.latitude ? parseFloat(String(trip.latitude)) : null}, 
        ${trip.longitude ? parseFloat(String(trip.longitude)) : null}, ${totalBudget}
      )
    `;

    // Create budget table entries (for Budget Review page)
    if (budgetItems && budgetItems.length > 0) {
      const year = startDate.getFullYear();
      const month = startDate.getMonth();
      
      for (const item of budgetItems) {
        const coaCode = coaMapping[item.category] || coaMapping[item.description] || 'P-7800';
        const amount = Number(item.amount);
        
        const jan = month === 0 ? amount : null;
        const feb = month === 1 ? amount : null;
        const mar = month === 2 ? amount : null;
        const apr = month === 3 ? amount : null;
        const may = month === 4 ? amount : null;
        const jun = month === 5 ? amount : null;
        const jul = month === 6 ? amount : null;
        const aug = month === 7 ? amount : null;
        const sep = month === 8 ? amount : null;
        const oct = month === 9 ? amount : null;
        const nov = month === 10 ? amount : null;
        const dec = month === 11 ? amount : null;

        await prisma.$queryRaw`
          INSERT INTO budgets (id, "userId", "accountCode", year, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, "createdAt", "updatedAt")
          VALUES (
            gen_random_uuid(), ${user.id}, ${coaCode}, ${year},
            ${jan}, ${feb}, ${mar}, ${apr}, ${may}, ${jun}, ${jul}, ${aug}, ${sep}, ${oct}, ${nov}, ${dec},
            NOW(), NOW()
          )
          ON CONFLICT ("userId", "accountCode", year) DO UPDATE SET
            jan = CASE WHEN EXCLUDED.jan IS NOT NULL THEN EXCLUDED.jan ELSE budgets.jan END,
            feb = CASE WHEN EXCLUDED.feb IS NOT NULL THEN EXCLUDED.feb ELSE budgets.feb END,
            mar = CASE WHEN EXCLUDED.mar IS NOT NULL THEN EXCLUDED.mar ELSE budgets.mar END,
            apr = CASE WHEN EXCLUDED.apr IS NOT NULL THEN EXCLUDED.apr ELSE budgets.apr END,
            may = CASE WHEN EXCLUDED.may IS NOT NULL THEN EXCLUDED.may ELSE budgets.may END,
            jun = CASE WHEN EXCLUDED.jun IS NOT NULL THEN EXCLUDED.jun ELSE budgets.jun END,
            jul = CASE WHEN EXCLUDED.jul IS NOT NULL THEN EXCLUDED.jul ELSE budgets.jul END,
            aug = CASE WHEN EXCLUDED.aug IS NOT NULL THEN EXCLUDED.aug ELSE budgets.aug END,
            sep = CASE WHEN EXCLUDED.sep IS NOT NULL THEN EXCLUDED.sep ELSE budgets.sep END,
            oct = CASE WHEN EXCLUDED.oct IS NOT NULL THEN EXCLUDED.oct ELSE budgets.oct END,
            nov = CASE WHEN EXCLUDED.nov IS NOT NULL THEN EXCLUDED.nov ELSE budgets.nov END,
            dec = CASE WHEN EXCLUDED.dec IS NOT NULL THEN EXCLUDED.dec ELSE budgets.dec END,
            "updatedAt" = NOW()
        `;
      }
    }

    return NextResponse.json({ success: true, totalBudget, startDate, endDate });
  } catch (error) {
    console.error('Commit trip error:', error);
    return NextResponse.json({ error: 'Failed to commit trip' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: userEmail } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get trip with budget items
    const trip = await prisma.trips.findUnique({
      where: { id },
      include: { budget_line_items: true }
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (trip.status !== "committed") {
      return NextResponse.json({ error: "Trip is not committed" }, { status: 400 });
    }

    // Remove calendar event
    await prisma.$queryRaw`
      DELETE FROM calendar_events 
      WHERE source = 'trip' AND source_id::text = ${id} AND user_id = ${user.id}
    `;

    // Remove budget entries for this trip's COA codes
    if (trip.startDate) {
      const year = trip.startDate.getFullYear();
      for (const item of trip.budget_line_items) {
        if (item.coaCode) {
          await prisma.$queryRaw`
            DELETE FROM budgets 
            WHERE "userId" = ${user.id} 
            AND "accountCode" = ${item.coaCode} 
            AND year = ${year}
          `;
        }
      }
    }

    // Delete budget line items
    await prisma.budget_line_items.deleteMany({
      where: { tripId: id }
    });

    // Reset trip status
    await prisma.trips.update({
      where: { id },
      data: { 
        status: 'planning',
        committedAt: null,
        startDate: null,
        endDate: null
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Uncommit trip error:', error);
    return NextResponse.json({ error: 'Failed to uncommit trip' }, { status: 500 });
  }
}
