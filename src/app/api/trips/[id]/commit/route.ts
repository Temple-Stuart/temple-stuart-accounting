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
        ${user.id}, 'trip', ${id}::uuid, ${trip.name}, ${trip.destination || null},
        'trip', '✈️', 'cyan',
        ${trip.startDate}, ${trip.endDate}, false,
        ${trip.destination || null}, ${trip.latitude ? parseFloat(trip.latitude) : null}, 
        ${trip.longitude ? parseFloat(trip.longitude) : null}, ${totalBudget}
      )
    `;

    // Create budget entries for each line item
    if (trip.startDate) {
      const year = trip.startDate.getFullYear();
      const month = trip.startDate.getMonth() + 1;

      for (const item of trip.budget_line_items) {
        if (item.coaCode && item.amount > 0) {
          await prisma.budgets.upsert({
            where: {
              userId_coaCode_year_month: {
                userId: user.id,
                coaCode: item.coaCode,
                year,
                month
              }
            },
            update: {
              amount: { increment: item.amount }
            },
            create: {
              userId: user.id,
              coaCode: item.coaCode,
              year,
              month,
              amount: item.amount,
              notes: `Trip: ${trip.name}`
            }
          });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Commit trip error:', error);
    return NextResponse.json({ error: 'Failed to commit trip' }, { status: 500 });
  }
}
