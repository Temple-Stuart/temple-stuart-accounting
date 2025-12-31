import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const cookieStore = await cookies();
    const userEmail = cookieStore.get('userEmail')?.value;
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const items = await prisma.$queryRaw`
      SELECT * FROM agenda_items WHERE id = ${id}::uuid
    ` as any[];

    if (!items.length) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const checkins = await prisma.$queryRaw`
      SELECT * FROM agenda_checkins 
      WHERE agenda_item_id = ${id}::uuid
      ORDER BY checkin_date DESC
      LIMIT 30
    ` as any[];

    return NextResponse.json({ item: items[0], checkins });
  } catch (error) {
    console.error('Get agenda item error:', error);
    return NextResponse.json({ error: 'Failed to get agenda item' }, { status: 500 });
  }
}

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
      await prisma.$queryRaw`
        UPDATE agenda_items 
        SET status = 'committed', committed_at = NOW(), updated_at = NOW()
        WHERE id = ${id}::uuid
      `;

      // Get the item
      const items = await prisma.$queryRaw`
        SELECT * FROM agenda_items WHERE id = ${id}::uuid
      ` as any[];

      if (items.length) {
        const item = items[0];
        const startDate = item.start_date ? new Date(item.start_date) : new Date();
        const endDate = item.end_date ? new Date(item.end_date) : new Date(startDate.getFullYear(), 11, 31);
        const year = startDate.getFullYear();

        // Category icons
        const categoryIcons: Record<string, string> = {
          build: '🧱', fitness: '💪', trading: '📊', 
          community: '🤝', shopping: '🛒', vehicle: '🚗'
        };
        const categoryColors: Record<string, string> = {
          build: 'blue', fitness: 'green', trading: 'purple',
          community: 'orange', shopping: 'pink', vehicle: 'gray'
        };

        // Create calendar event
        await prisma.$queryRaw`
          INSERT INTO calendar_events (
            user_id, source, source_id, title, description, category, icon, color,
            start_date, end_date, is_recurring, recurrence_rule, coa_code, budget_amount
          ) VALUES (
            ${user.id}, 'agenda', ${id}::uuid, ${item.name}, ${item.goal || null},
            ${item.category}, ${categoryIcons[item.category] || '📋'}, ${categoryColors[item.category] || 'gray'},
            ${startDate}, ${endDate}, ${item.cadence !== 'once'}, ${item.cadence},
            ${item.coa_code || null}, ${item.budget_amount || 0}
          )
        `;

        // Create budget entries if budget amount set
        if (item.budget_amount > 0 && item.coa_code) {
          for (let month = startDate.getMonth() + 1; month <= 12; month++) {
            await prisma.budgets.upsert({
              where: {
                userId_coaCode_year_month: {
                  userId: user.id,
                  coaCode: item.coa_code,
                  year,
                  month
                }
              },
              update: {
                amount: { increment: item.budget_amount }
              },
              create: {
                userId: user.id,
                coaCode: item.coa_code,
                year,
                month,
                amount: item.budget_amount,
                notes: `Agenda: ${item.name}`
              }
            });
          }
        }
      }

      return NextResponse.json({ success: true });
    }

    // Regular update
    const {
      name, category, subcategory, cadence, startDate, endDate,
      timeBlock, durationMins, intensity, goal, definitionOfDone,
      tags, coaCode, budgetAmount
    } = body;

    await prisma.$queryRaw`
      UPDATE agenda_items SET
        name = COALESCE(${name}, name),
        category = COALESCE(${category}, category),
        subcategory = COALESCE(${subcategory}, subcategory),
        cadence = COALESCE(${cadence}, cadence),
        start_date = COALESCE(${startDate ? new Date(startDate) : null}, start_date),
        end_date = COALESCE(${endDate ? new Date(endDate) : null}, end_date),
        time_block = COALESCE(${timeBlock}, time_block),
        duration_mins = COALESCE(${durationMins}, duration_mins),
        intensity = COALESCE(${intensity}, intensity),
        goal = COALESCE(${goal}, goal),
        definition_of_done = COALESCE(${definitionOfDone ? JSON.stringify(definitionOfDone) : null}::jsonb, definition_of_done),
        tags = COALESCE(${tags}, tags),
        coa_code = COALESCE(${coaCode}, coa_code),
        budget_amount = COALESCE(${budgetAmount}, budget_amount),
        updated_at = NOW()
      WHERE id = ${id}::uuid
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update agenda item error:', error);
    return NextResponse.json({ error: 'Failed to update agenda item' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Delete calendar events
    await prisma.$queryRaw`DELETE FROM calendar_events WHERE source = 'agenda' AND source_id = ${id}::uuid`;
    
    // Delete checkins
    await prisma.$queryRaw`DELETE FROM agenda_checkins WHERE agenda_item_id = ${id}::uuid`;
    
    // Delete the item
    await prisma.$queryRaw`DELETE FROM agenda_items WHERE id = ${id}::uuid`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete agenda item error:', error);
    return NextResponse.json({ error: 'Failed to delete agenda item' }, { status: 500 });
  }
}
