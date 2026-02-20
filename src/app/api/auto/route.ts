import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

const MODULE = 'auto';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const expenses = await prisma.$queryRaw`
      SELECT * FROM module_expenses WHERE user_id = ${user.id} AND module = ${MODULE} ORDER BY created_at DESC
    `;
    return NextResponse.json({ expenses });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, coa_code, amount, cadence, target_date } = await request.json();
    
    const result = await prisma.$queryRaw`
      INSERT INTO module_expenses (user_id, module, name, coa_code, amount, cadence, target_date)
      VALUES (${user.id}, ${MODULE}, ${name}, ${coa_code}, ${amount}, ${cadence || 'monthly'}, ${target_date}::date)
      RETURNING *
    `;
    return NextResponse.json({ expense: (result as any[])[0] });
  } catch (error) {
    console.error('Create error:', error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
