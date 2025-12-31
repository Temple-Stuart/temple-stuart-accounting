import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function GET() {
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

    const items = await prisma.$queryRaw`
      SELECT * FROM agenda_items 
      WHERE user_id = ${user.id}
      ORDER BY 
        CASE WHEN status = 'committed' THEN 0 ELSE 1 END,
        created_at DESC
    ` as any[];

    // Group by category
    const byCategory: Record<string, any[]> = {};
    items.forEach(item => {
      if (!byCategory[item.category]) byCategory[item.category] = [];
      byCategory[item.category].push(item);
    });

    // Calculate totals
    const totalBudget = items
      .filter(i => i.status === 'committed')
      .reduce((sum, i) => sum + (i.budget_amount || 0), 0);

    const draftCount = items.filter(i => i.status === 'draft').length;
    const committedCount = items.filter(i => i.status === 'committed').length;

    return NextResponse.json({
      items,
      byCategory,
      summary: {
        totalItems: items.length,
        draftCount,
        committedCount,
        totalBudget
      }
    });
  } catch (error) {
    console.error('Agenda API error:', error);
    return NextResponse.json({ error: 'Failed to fetch agenda items' }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

    const body = await request.json();
    const {
      name, category, subcategory, cadence, startDate, endDate,
      timeBlock, startTime, endTime, durationMins, customDays,
      intensity, goal, definitionOfDone, tags, coaCode, budgetAmount
    } = body;

    const result = await prisma.$queryRaw`
      INSERT INTO agenda_items (
        user_id, name, category, subcategory, cadence, start_date, end_date,
        time_block, start_time, end_time, duration_mins, custom_days,
        intensity, goal, definition_of_done, tags, coa_code, budget_amount, status
      ) VALUES (
        ${user.id}, ${name}, ${category}, ${subcategory || null}, ${cadence || 'once'},
        ${startDate ? new Date(startDate) : null}, ${endDate ? new Date(endDate) : null},
        ${timeBlock || null}, ${startTime || null}, ${endTime || null}, ${durationMins || 60},
        ${customDays || null}, ${intensity || null}, ${goal || null},
        ${definitionOfDone ? JSON.stringify(definitionOfDone) : null},
        ${tags || null}, ${coaCode || null}, ${budgetAmount || 0}, 'draft'
      )
      RETURNING *
    `;

    return NextResponse.json({ item: (result as any[])[0] });
  } catch (error) {
    console.error('Create agenda item error:', error);
    return NextResponse.json({ error: 'Failed to create agenda item' }, { status: 500 });
  }
}
