import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({ where: { email: userEmail } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const items = await prisma.$queryRaw`
      SELECT * FROM agenda_items WHERE id = ${id}::uuid AND user_id = ${user.id}
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
    const userEmail = await getVerifiedEmail();
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
        WHERE id = ${id}::uuid AND user_id = ${user.id}
      `;

      // Get the item
      const items = await prisma.$queryRaw`
        SELECT * FROM agenda_items WHERE id = ${id}::uuid AND user_id = ${user.id}
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

        // Create budget entries if budget amount set (raw SQL)
        if (item.budget_amount > 0 && item.coa_code) {
          const amount = item.budget_amount;
          const startMonth = startDate.getMonth();
          
          const jan = startMonth <= 0 ? amount : null;
          const feb = startMonth <= 1 ? amount : null;
          const mar = startMonth <= 2 ? amount : null;
          const apr = startMonth <= 3 ? amount : null;
          const may = startMonth <= 4 ? amount : null;
          const jun = startMonth <= 5 ? amount : null;
          const jul = startMonth <= 6 ? amount : null;
          const aug = startMonth <= 7 ? amount : null;
          const sep = startMonth <= 8 ? amount : null;
          const oct = startMonth <= 9 ? amount : null;
          const nov = startMonth <= 10 ? amount : null;
          const dec = startMonth <= 11 ? amount : null;

          await prisma.$queryRaw`
            INSERT INTO budgets (id, "userId", "accountCode", year, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, "createdAt", "updatedAt")
            VALUES (
              gen_random_uuid(), ${user.id}, ${item.coa_code}, ${year},
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
      WHERE id = ${id}::uuid AND user_id = ${user.id}
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
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const user = await prisma.users.findFirst({ where: { email: userEmail } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // Delete calendar events
    await prisma.$queryRaw`DELETE FROM calendar_events WHERE source = 'agenda' AND source_id = ${id}::uuid AND user_id = ${user.id}`;

    // Delete checkins
    await prisma.$queryRaw`DELETE FROM agenda_checkins WHERE agenda_item_id = ${id}::uuid AND agenda_item_id IN (SELECT id FROM agenda_items WHERE user_id = ${user.id})`;

    // Delete the item
    await prisma.$queryRaw`DELETE FROM agenda_items WHERE id = ${id}::uuid AND user_id = ${user.id}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete agenda item error:', error);
    return NextResponse.json({ error: 'Failed to delete agenda item' }, { status: 500 });
  }
}
