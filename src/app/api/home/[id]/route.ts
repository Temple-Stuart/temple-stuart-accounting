import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';
import { getCurrentUser } from '@/lib/auth-helpers';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();

    // Handle UNCOMMIT
    if (body.action === 'uncommit') {
      // Delete calendar events for this expense
      await prisma.$queryRaw`DELETE FROM calendar_events WHERE source = 'home' AND source_id::text = ${id}`;
      
      // Reset status
      await prisma.$queryRaw`
        UPDATE home_expenses 
        SET status = 'draft', committed_at = NULL, updated_at = NOW()
        WHERE id = ${id}::uuid
      `;
      return NextResponse.json({ success: true });
    }

    // Handle COMMIT
    if (body.action === 'commit') {
      const expenses = await prisma.$queryRaw`
        SELECT * FROM home_expenses WHERE id = ${id}::uuid
      ` as any[];

      if (!expenses.length) {
        return NextResponse.json({ error: 'Expense not found' }, { status: 404 });
      }

      const expense = expenses[0];
      
      // FIRST: Delete any existing calendar events for this expense (prevents duplicates)
      await prisma.$queryRaw`DELETE FROM calendar_events WHERE source = 'home' AND source_id::text = ${id}`;
      
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      
      const isMonthly = expense.cadence === 'monthly';
      const isQuarterly = expense.cadence === 'quarterly';
      const isAnnual = expense.cadence === 'annual';
      const dueDay = expense.due_day || 1;

      const eventsToCreate: { year: number; month: number }[] = [];
      
      for (let m = currentMonth; m < 12; m++) {
        if (isQuarterly && m % 3 !== 0) continue;
        if (isAnnual && m !== 0) continue;
        eventsToCreate.push({ year: currentYear, month: m });
      }
      
      for (let m = 0; m < 12; m++) {
        if (isQuarterly && m % 3 !== 0) continue;
        if (isAnnual && m !== 0) continue;
        eventsToCreate.push({ year: currentYear + 1, month: m });
      }

      console.log(`Creating ${eventsToCreate.length} calendar events for ${expense.name}`);

      // Create calendar events
      for (const { year, month } of eventsToCreate) {
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(dueDay).padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dayStr}`;
        
        await prisma.$queryRaw`
          INSERT INTO calendar_events (
            user_id, source, source_id, title, category, icon, color,
            start_date, is_recurring, recurrence_rule, coa_code, budget_amount
          ) VALUES (
            ${user.id}, 'home', ${id}::uuid, ${expense.name}, 'home', '🏠', 'orange',
            ${dateStr}::date, ${isMonthly}, ${expense.cadence}, ${expense.coa_code}, ${expense.amount}
          )
        `;
      }

      // Update budgets - group by year
      const yearMonths: Record<number, number[]> = {};
      eventsToCreate.forEach(({ year, month }) => {
        if (!yearMonths[year]) yearMonths[year] = [];
        yearMonths[year].push(month);
      });

      for (const [yearStr, months] of Object.entries(yearMonths)) {
        const year = parseInt(yearStr);
        const amount = expense.amount;
        
        // Build month values - SET not INCREMENT
        const jan = months.includes(0) ? amount : null;
        const feb = months.includes(1) ? amount : null;
        const mar = months.includes(2) ? amount : null;
        const apr = months.includes(3) ? amount : null;
        const may = months.includes(4) ? amount : null;
        const jun = months.includes(5) ? amount : null;
        const jul = months.includes(6) ? amount : null;
        const aug = months.includes(7) ? amount : null;
        const sep = months.includes(8) ? amount : null;
        const oct = months.includes(9) ? amount : null;
        const nov = months.includes(10) ? amount : null;
        const dec = months.includes(11) ? amount : null;

        // Use SET instead of increment to avoid doubling
        await prisma.$queryRaw`
          INSERT INTO budgets (id, "userId", "accountCode", year, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, "createdAt", "updatedAt")
          VALUES (
            ${randomUUID()}, ${user.id}, ${expense.coa_code}, ${year},
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

      // Update expense status
      await prisma.$queryRaw`
        UPDATE home_expenses 
        SET status = 'committed', committed_at = NOW(), updated_at = NOW()
        WHERE id = ${id}::uuid
      `;

      return NextResponse.json({ success: true, eventsCreated: eventsToCreate.length });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update home expense error:', error);
    return NextResponse.json({ error: 'Failed to update: ' + (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify ownership before deleting
    const existing = await prisma.$queryRaw`
      SELECT user_id FROM home_expenses WHERE id = ${id}::uuid
    ` as any[];
    if (!existing.length || existing[0].user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await prisma.$queryRaw`DELETE FROM calendar_events WHERE source = 'home' AND source_id::text = ${id}`;
    await prisma.$queryRaw`DELETE FROM home_expenses WHERE id = ${id}::uuid`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete home expense error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
