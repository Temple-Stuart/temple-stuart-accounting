import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : null;

    let events: any[];
    
    if (month) {
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

    // Calculate totals by source
    const calcTotal = (source: string) => events.filter(e => e.source === source).reduce((sum, e) => sum + Number(e.budget_amount || 0), 0);
    const calcCount = (source: string) => events.filter(e => e.source === source).length;

    const homeTotal = calcTotal('home');
    const autoTotal = calcTotal('auto');
    const shoppingTotal = calcTotal('shopping');
    const personalTotal = calcTotal('personal');
    const healthTotal = calcTotal('health');
    const growthTotal = calcTotal('growth');
    const tripTotal = calcTotal('trip');

    return NextResponse.json({
      events,
      summary: {
        totalEvents: events.length,
        homeTotal,
        autoTotal,
        shoppingTotal,
        personalTotal,
        healthTotal,
        growthTotal,
        tripTotal,
        grandTotal: homeTotal + autoTotal + shoppingTotal + personalTotal + healthTotal + growthTotal + tripTotal,
        homeCount: calcCount('home'),
        autoCount: calcCount('auto'),
        shoppingCount: calcCount('shopping'),
        personalCount: calcCount('personal'),
        healthCount: calcCount('health'),
        growthCount: calcCount('growth'),
        tripCount: calcCount('trip'),
      }
    });
  } catch (error) {
    console.error('Calendar API error:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar' }, { status: 500 });
  }
}
