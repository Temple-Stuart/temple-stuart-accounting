import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const body = await request.json();

    // Handle commit action
    if (body.action === 'commit') {
      // Update status
      await prisma.$queryRaw`
        UPDATE home_expenses 
        SET status = 'committed', committed_at = NOW(), updated_at = NOW()
        WHERE id = ${id}::uuid
      `;

      // Get the expense details
      const expenses = await prisma.$queryRaw`
        SELECT * FROM home_expenses WHERE id = ${id}::uuid
      ` as any[];

      if (expenses.length) {
        const expense = expenses[0];
        const startDate = expense.start_date ? new Date(expense.start_date) : new Date();
        const year = startDate.getFullYear();

        // Create calendar events for each month
        for (let month = startDate.getMonth(); month < 12; month++) {
          const eventDate = new Date(year, month, expense.due_day || 1);
          
          await prisma.$queryRaw`
            INSERT INTO calendar_events (
              user_id, source, source_id, title, category, icon, color,
              start_date, is_recurring, recurrence_rule, coa_code, budget_amount
            ) VALUES (
              ${user.id}, 'home', ${id}::uuid, ${expense.name}, 'home', '🏠', 'orange',
              ${eventDate}, true, ${expense.cadence}, ${expense.coa_code}, ${expense.amount}
            )
          `;
        }

        // Create budget entries
        for (let month = startDate.getMonth() + 1; month <= 12; month++) {
          await prisma.budgets.upsert({
            where: {
              userId_coaCode_year_month: {
                userId: user.id,
                coaCode: expense.coa_code,
                year,
                month
              }
            },
            update: {
              amount: { increment: expense.amount }
            },
            create: {
              userId: user.id,
              coaCode: expense.coa_code,
              year,
              month,
              amount: expense.amount,
              notes: `Home: ${expense.name}`
            }
          });
        }
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update home expense error:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Delete calendar events
    await prisma.$queryRaw`DELETE FROM calendar_events WHERE source = 'home' AND source_id = ${id}::uuid`;
    
    // Delete the expense
    await prisma.$queryRaw`DELETE FROM home_expenses WHERE id = ${id}::uuid`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete home expense error:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
