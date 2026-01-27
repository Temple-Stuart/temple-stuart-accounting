import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

const MODULE = 'business';

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
      // Delete budget_line_items for this expense
      await prisma.$queryRaw`
        DELETE FROM budget_line_items 
        WHERE "userId" = ${user.id} 
        AND source = ${MODULE} 
        AND description LIKE ${'expense:' + id + '%'}
      `;
      await prisma.$queryRaw`UPDATE module_expenses SET status = 'draft', committed_at = NULL WHERE id = ${id}::uuid`;
      return NextResponse.json({ success: true });
    }

    if (action === 'commit') {
      const expenses = await prisma.$queryRaw`SELECT * FROM module_expenses WHERE id = ${id}::uuid` as any[];
      if (!expenses.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
      const expense = expenses[0];

      // Clear old budget_line_items for this expense
      await prisma.$queryRaw`
        DELETE FROM budget_line_items 
        WHERE "userId" = ${user.id} 
        AND source = ${MODULE} 
        AND description LIKE ${'expense:' + id + '%'}
      `;

      const targetDate = expense.target_date ? new Date(expense.target_date) : new Date();
      const amount = Number(expense.amount);
      const cadence = expense.cadence;

      // Generate dates based on cadence
      const dates: Date[] = [];
      const endDate = new Date(targetDate);
      endDate.setFullYear(endDate.getFullYear() + 2); // 2 years out

      if (cadence === 'once') {
        dates.push(new Date(targetDate));
      } else if (cadence === 'weekly') {
        let d = new Date(targetDate);
        while (d <= endDate) {
          dates.push(new Date(d));
          d.setDate(d.getDate() + 7);
        }
      } else if (cadence === 'monthly') {
        let d = new Date(targetDate);
        while (d <= endDate) {
          dates.push(new Date(d));
          d.setMonth(d.getMonth() + 1);
        }
      } else if (cadence === 'quarterly') {
        let d = new Date(targetDate);
        while (d <= endDate) {
          dates.push(new Date(d));
          d.setMonth(d.getMonth() + 3);
        }
      } else if (cadence === 'semi-annual') {
        let d = new Date(targetDate);
        while (d <= endDate) {
          dates.push(new Date(d));
          d.setMonth(d.getMonth() + 6);
        }
      } else if (cadence === 'annual') {
        let d = new Date(targetDate);
        while (d <= endDate) {
          dates.push(new Date(d));
          d.setFullYear(d.getFullYear() + 1);
        }
      }

      // Create budget_line_items grouped by year/month
      const budgetMap: Record<number, Record<number, number>> = {}; // year -> month -> amount
      for (const eventDate of dates) {
        const year = eventDate.getFullYear();
        const month = eventDate.getMonth() + 1; // 1-indexed for budget_line_items
        if (!budgetMap[year]) budgetMap[year] = {};
        budgetMap[year][month] = (budgetMap[year][month] || 0) + amount;
      }

      // Insert budget_line_items
      for (const [yearStr, months] of Object.entries(budgetMap)) {
        const year = parseInt(yearStr);
        for (const [monthStr, monthAmount] of Object.entries(months)) {
          const month = parseInt(monthStr);
          await prisma.budget_line_items.create({
            data: {
              userId: user.id,
              coaCode: expense.coa_code,
              year: year,
              month: month,
              amount: monthAmount,
              description: `expense:${id}:${expense.name}`,
              source: MODULE
            }
          });
        }
      }

      await prisma.$queryRaw`UPDATE module_expenses SET status = 'committed', committed_at = NOW() WHERE id = ${id}::uuid`;
      return NextResponse.json({ success: true, itemsCreated: dates.length });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Business PATCH error:', error);
    return NextResponse.json({ error: 'Failed: ' + (error as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const user = await prisma.users.findFirst({ where: { email: userEmail } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Delete associated budget_line_items
    await prisma.$queryRaw`
      DELETE FROM budget_line_items 
      WHERE "userId" = ${user.id} 
      AND source = ${MODULE} 
      AND description LIKE ${'expense:' + id + '%'}
    `;
    await prisma.$queryRaw`DELETE FROM module_expenses WHERE id = ${id}::uuid`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Business DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
