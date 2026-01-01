import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

const MODULE = 'personal';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const user = await prisma.users.findFirst({ where: { email: userEmail } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

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

      await prisma.$queryRaw`DELETE FROM calendar_events WHERE source = ${MODULE} AND source_id::text = ${id}`;

      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth();
      const dueDay = expense.due_day || 1;

      for (let y = currentYear; y <= currentYear + 1; y++) {
        const startMonth = y === currentYear ? currentMonth : 0;
        for (let m = startMonth; m < 12; m++) {
          if (expense.cadence === 'quarterly' && m % 3 !== 0) continue;
          if (expense.cadence === 'annual' && m !== 0) continue;
          const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
          await prisma.$queryRaw`
            INSERT INTO calendar_events (user_id, source, source_id, title, category, icon, color, start_date, is_recurring, recurrence_rule, coa_code, budget_amount)
            VALUES (${user.id}, ${MODULE}, ${id}::uuid, ${expense.name}, ${MODULE}, '👤', 'purple', ${dateStr}::date, ${expense.cadence === 'monthly'}, ${expense.cadence}, ${expense.coa_code}, ${expense.amount})
          `;
        }
      }

      const amount = Number(expense.amount);
      for (let y = currentYear; y <= currentYear + 1; y++) {
        const months: number[] = [];
        const startMonth = y === currentYear ? currentMonth : 0;
        for (let m = startMonth; m < 12; m++) {
          if (expense.cadence === 'quarterly' && m % 3 !== 0) continue;
          if (expense.cadence === 'annual' && m !== 0) continue;
          months.push(m);
        }
        if (months.length === 0) continue;
        
        await prisma.$queryRaw`
          INSERT INTO budgets (id, "userId", "accountCode", year, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, "createdAt", "updatedAt")
          VALUES (${randomUUID()}, ${user.id}, ${expense.coa_code}, ${y},
            ${months.includes(0) ? amount : null}, ${months.includes(1) ? amount : null}, ${months.includes(2) ? amount : null},
            ${months.includes(3) ? amount : null}, ${months.includes(4) ? amount : null}, ${months.includes(5) ? amount : null},
            ${months.includes(6) ? amount : null}, ${months.includes(7) ? amount : null}, ${months.includes(8) ? amount : null},
            ${months.includes(9) ? amount : null}, ${months.includes(10) ? amount : null}, ${months.includes(11) ? amount : null},
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
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
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
