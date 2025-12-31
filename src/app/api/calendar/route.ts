import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: userEmail } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null;

    // Get all calendar events for user
    let events: any[];
    
    if (month) {
      // Specific month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      
      events = await prisma.$queryRaw`
        SELECT * FROM calendar_events 
        WHERE user_id = ${user.id}
        AND (
          (start_date >= ${startDate} AND start_date <= ${endDate})
          OR (end_date >= ${startDate} AND end_date <= ${endDate})
          OR (start_date <= ${startDate} AND end_date >= ${endDate})
          OR (is_recurring = true AND start_date <= ${endDate})
        )
        ORDER BY start_date ASC
      `;
    } else {
      // Full year
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31);
      
      events = await prisma.$queryRaw`
        SELECT * FROM calendar_events 
        WHERE user_id = ${user.id}
        AND (
          (start_date >= ${startDate} AND start_date <= ${endDate})
          OR (end_date >= ${startDate} AND end_date <= ${endDate})
          OR (is_recurring = true AND start_date <= ${endDate})
        )
        ORDER BY start_date ASC
      `;
    }

    // Calculate totals by source
    const homeTotal = events
      .filter(e => e.source === 'home')
      .reduce((sum, e) => sum + (e.budget_amount || 0), 0);
    
    const agendaTotal = events
      .filter(e => e.source === 'agenda')
      .reduce((sum, e) => sum + (e.budget_amount || 0), 0);
    
    const tripTotal = events
      .filter(e => e.source === 'trip')
      .reduce((sum, e) => sum + (e.budget_amount || 0), 0);

    // Group by month for calendar view
    const byMonth: Record<string, any[]> = {};
    events.forEach(e => {
      const monthKey = e.start_date.toISOString().slice(0, 7);
      if (!byMonth[monthKey]) byMonth[monthKey] = [];
      byMonth[monthKey].push(e);
    });

    return NextResponse.json({
      events,
      byMonth,
      summary: {
        totalEvents: events.length,
        homeTotal,
        agendaTotal,
        tripTotal,
        grandTotal: homeTotal + agendaTotal + tripTotal,
        homeCount: events.filter(e => e.source === 'home').length,
        agendaCount: events.filter(e => e.source === 'agenda').length,
        tripCount: events.filter(e => e.source === 'trip').length,
      }
    });
  } catch (error) {
    console.error('Calendar API error:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 500 });
  }
}
