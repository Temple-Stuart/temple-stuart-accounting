import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { getCurrentUser } from '@/lib/auth-helpers';

const MODULE = 'auto';
const ICON = '🚗';
const COLOR = 'gray';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { action } = await request.json();

    if (action === 'uncommit') {
      await prisma.$queryRaw`DELETE FROM calendar_events WHERE source = ${MODULE} AND source_id::text = ${id}`;
      await prisma.$queryRaw`UPDATE module_expenses SET status = 'draft', committed_at = NULL WHERE id = ${id}::uuid`;
      return NextResponse.json({ success: true });
    }

    if (action === 'commit') {
      const expenses = await prisma.$queryRaw`SELECT * FROM module_expenses WHERE id = ${id}::uuid` as any[];
      if (!expenses.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const expense = expenses[0];

      // Clear old events
      await prisma.$queryRaw`DELETE FROM calendar_events WHERE source = ${MODULE} AND source_id::text = ${id}`;

      const targetDate = expense.target_date ? new Date(expense.target_date) : new Date();
      const amount = Number(expense.amount);
      const cadence = expense.cadence;

      // Generate calendar events based on cadence
      const events: Date[] = [];
      const endDate = new Date(targetDate);
      endDate.setFullYear(endDate.getFullYear() + 2); // 2 years out

      if (cadence === 'once') {
        events.push(new Date(targetDate));
      } else if (cadence === 'weekly') {
        let d = new Date(targetDate);
        while (d <= endDate) {
          events.push(new Date(d));
          d.setDate(d.getDate() + 7);
        }
      } else if (cadence === 'monthly') {
        let d = new Date(targetDate);
        while (d <= endDate) {
          events.push(new Date(d));
          d.setMonth(d.getMonth() + 1);
        }
      } else if (cadence === 'quarterly') {
        let d = new Date(targetDate);
        while (d <= endDate) {
          events.push(new Date(d));
          d.setMonth(d.getMonth() + 3);
        }
      } else if (cadence === 'semi-annual') {
        let d = new Date(targetDate);
        while (d <= endDate) {
          events.push(new Date(d));
          d.setMonth(d.getMonth() + 6);
        }
      } else if (cadence === 'annual') {
        let d = new Date(targetDate);
        while (d <= endDate) {
          events.push(new Date(d));
          d.setFullYear(d.getFullYear() + 1);
        }
      }

      // Create calendar events
      for (const eventDate of events) {
        const dateStr = eventDate.toISOString().split('T')[0];
        await prisma.$queryRaw`
          INSERT INTO calendar_events (user_id, source, source_id, title, category, icon, color, start_date, is_recurring, recurrence_rule, coa_code, budget_amount)
          VALUES (${user.id}, ${MODULE}, ${id}::uuid, ${expense.name}, ${MODULE}, ${ICON}, ${COLOR}, ${dateStr}::date, ${cadence !== 'once'}, ${cadence}, ${expense.coa_code}, ${amount})
        `;
      }

      // Create budget entries grouped by year/month
      const budgetMap: Record<string, Record<number, number>> = {}; // year -> month -> amount
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
          VALUES (${randomUUID()}, ${user.id}, ${expense.coa_code}, ${year},
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

      await prisma.$queryRaw`UPDATE module_expenses SET status = 'committed', committed_at = NOW() WHERE id = ${id}::uuid`;
      return NextResponse.json({ success: true, eventsCreated: events.length });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed: ' + (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.$queryRaw`DELETE FROM calendar_events WHERE source = ${MODULE} AND source_id::text = ${id}`;
    await prisma.$queryRaw`DELETE FROM module_expenses WHERE id = ${id}::uuid`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
