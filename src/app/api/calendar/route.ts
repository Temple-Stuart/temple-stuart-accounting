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

    let events: any[];
    
    if (month) {
      // Filter to specific month only
      const startOfMonth = `${year}-${String(month).padStart(2, '0')}-01`;
      const endOfMonth = month === 12 
        ? `${year + 1}-01-01` 
        : `${year}-${String(month + 1).padStart(2, '0')}-01`;
      
      events = await prisma.$queryRaw`
        SELECT * FROM calendar_events 
        WHERE user_id = ${user.id}
        AND start_date >= ${startOfMonth}::date
        AND start_date < ${endOfMonth}::date
        ORDER BY start_date ASC
      `;
    } else {
      // Full year
      const startOfYear = `${year}-01-01`;
      const endOfYear = `${year + 1}-01-01`;
      
      events = await prisma.$queryRaw`
        SELECT * FROM calendar_events 
        WHERE user_id = ${user.id}
        AND start_date >= ${startOfYear}::date
        AND start_date < ${endOfYear}::date
        ORDER BY start_date ASC
      `;
    }

    // Calculate totals by source (for THIS month/year only)
    const homeTotal = events
      .filter(e => e.source === 'home')
      .reduce((sum, e) => sum + (e.budget_amount || 0), 0);
    
    const agendaTotal = events
      .filter(e => e.source === 'agenda')
      .reduce((sum, e) => sum + (e.budget_amount || 0), 0);
    
    const tripTotal = events
      .filter(e => e.source === 'trip')
      .reduce((sum, e) => sum + (e.budget_amount || 0), 0);

    return NextResponse.json({
      events,
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
