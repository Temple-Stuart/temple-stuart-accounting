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

    // Get the trip
    const trip = await prisma.trips.findUnique({
      where: { id },
      include: { budget_line_items: true }
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Update trip status
    await prisma.trips.update({
      where: { id },
      data: { 
        status: 'committed',
        committedAt: new Date()
      }
    });

    // Calculate total budget
    const totalBudget = trip.budget_line_items.reduce((sum, item) => sum + Number(item.amount), 0);

    // Create calendar event
    await prisma.$queryRaw`
      INSERT INTO calendar_events (
        user_id, source, source_id, title, description, category, icon, color,
        start_date, end_date, is_recurring, location, latitude, longitude, budget_amount
      ) VALUES (
        ${user.id}, 'trip', ${id}, ${trip.name}, ${trip.destination || null},
        'trip', '✈️', 'cyan',
        ${trip.startDate}, ${trip.endDate}, false,
        ${trip.destination || null}, ${trip.latitude ? parseFloat(String(trip.latitude)) : null}, 
        ${trip.longitude ? parseFloat(String(trip.longitude)) : null}, ${totalBudget}
      )
    `;

    // Create budget entries for each line item (raw SQL)
    if (trip.startDate) {
      const year = trip.startDate.getFullYear();
      const startMonth = trip.startDate.getMonth();

      for (const item of trip.budget_line_items) {
        if (item.coaCode && Number(item.amount) > 0) {
          const amount = Number(item.amount);
          
          const jan = startMonth <= 0 ? amount : null;
          const feb = startMonth <= 1 ? amount : null;
          const mar = startMonth <= 2 ? amount : null;
          const apr = startMonth <= 3 ? amount : null;
          const may = startMonth <= 4 ? amount : null;
          const jun = startMonth <= 5 ? amount : null;
          const jul = startMonth <= 6 ? amount : null;
          const aug = startMonth <= 7 ? amount : null;
          const sep = startMonth <= 8 ? amount : null;
          const oct = startMonth <= 9 ? amount : null;
          const nov = startMonth <= 10 ? amount : null;
          const dec = startMonth <= 11 ? amount : null;

          await prisma.$queryRaw`
            INSERT INTO budgets (id, "userId", "accountCode", year, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, "createdAt", "updatedAt")
            VALUES (
              gen_random_uuid(), ${user.id}, ${item.coaCode}, ${year},
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
    }

    return NextResponse.json({ success: true });
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
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Remove calendar event
    await prisma.$queryRaw`
      DELETE FROM calendar_events 
      WHERE source = 'trip' AND source_id = ${id} AND user_id = ${user.id}
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

    // Reset trip status
    await prisma.trips.update({
      where: { id },
      data: { 
        status: 'planning',
        committedAt: null
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Uncommit trip error:', error);
    return NextResponse.json({ error: 'Failed to uncommit trip' }, { status: 500 });
  }
}
