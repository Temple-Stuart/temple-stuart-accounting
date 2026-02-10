import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

const MODULE = 'shopping';
const ICON = '🛒';
const COLOR = 'pink';

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { name, coaCode, amount, cadence } = await request.json() as {
      name: string;
      coaCode: string;
      amount: number;
      cadence: string;
    };

    if (!name || !coaCode || !amount) {
      return NextResponse.json({ error: 'name, coaCode, and amount are required' }, { status: 400 });
    }

    const effectiveCadence = cadence || 'monthly';
    const targetDate = new Date();

    // 1. Create module_expenses row with status='committed'
    const inserted = await prisma.$queryRaw`
      INSERT INTO module_expenses (user_id, module, name, coa_code, amount, cadence, target_date, status, committed_at)
      VALUES (${user.id}, ${MODULE}, ${name}, ${coaCode}, ${amount}, ${effectiveCadence}, ${targetDate.toISOString().split('T')[0]}::date, 'committed', NOW())
      RETURNING id
    ` as { id: string }[];

    const expenseId = inserted[0].id;

    // 2. Generate calendar events for 2 years based on cadence
    const events: Date[] = [];
    const endDate = new Date(targetDate);
    endDate.setFullYear(endDate.getFullYear() + 2);

    if (effectiveCadence === 'once' || effectiveCadence === 'as-needed') {
      events.push(new Date(targetDate));
    } else if (effectiveCadence === 'weekly') {
      const d = new Date(targetDate);
      while (d <= endDate) {
        events.push(new Date(d));
        d.setDate(d.getDate() + 7);
      }
    } else if (effectiveCadence === 'monthly') {
      const d = new Date(targetDate);
      while (d <= endDate) {
        events.push(new Date(d));
        d.setMonth(d.getMonth() + 1);
      }
    } else if (effectiveCadence === 'quarterly') {
      const d = new Date(targetDate);
      while (d <= endDate) {
        events.push(new Date(d));
        d.setMonth(d.getMonth() + 3);
      }
    } else if (effectiveCadence === 'semi-annual') {
      const d = new Date(targetDate);
      while (d <= endDate) {
        events.push(new Date(d));
        d.setMonth(d.getMonth() + 6);
      }
    } else if (effectiveCadence === 'annual') {
      const d = new Date(targetDate);
      while (d <= endDate) {
        events.push(new Date(d));
        d.setFullYear(d.getFullYear() + 1);
      }
    }

    for (const eventDate of events) {
      const dateStr = eventDate.toISOString().split('T')[0];
      await prisma.$queryRaw`
        INSERT INTO calendar_events (user_id, source, source_id, title, category, icon, color, start_date, is_recurring, recurrence_rule, coa_code, budget_amount)
        VALUES (${user.id}, ${MODULE}, ${expenseId}::uuid, ${name}, ${MODULE}, ${ICON}, ${COLOR}, ${dateStr}::date, ${effectiveCadence !== 'once' && effectiveCadence !== 'as-needed'}, ${effectiveCadence}, ${coaCode}, ${amount})
      `;
    }

    // 3. Create budget allocations by year/month
    const budgetMap: Record<string, Record<number, number>> = {};
    for (const eventDate of events) {
      const year = eventDate.getFullYear().toString();
      const month = eventDate.getMonth();
      if (!budgetMap[year]) budgetMap[year] = {};
      budgetMap[year][month] = (budgetMap[year][month] || 0) + amount;
    }

    for (const [yearStr, months] of Object.entries(budgetMap)) {
      const year = parseInt(yearStr);
      await prisma.$queryRaw`
        INSERT INTO budgets (id, "userId", "accountCode", year, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, "createdAt", "updatedAt")
        VALUES (${randomUUID()}, ${user.id}, ${coaCode}, ${year},
          ${months[0] || null}, ${months[1] || null}, ${months[2] || null},
          ${months[3] || null}, ${months[4] || null}, ${months[5] || null},
          ${months[6] || null}, ${months[7] || null}, ${months[8] || null},
          ${months[9] || null}, ${months[10] || null}, ${months[11] || null},
          NOW(), NOW())
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

    return NextResponse.json({ success: true, expenseId, eventsCreated: events.length });
  } catch (error) {
    console.error('Shopping commit error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to commit budget' },
      { status: 500 }
    );
  }
}
