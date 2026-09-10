import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { COLLAPSED_MODULES } from '@/lib/budgetCategories';

/**
 * ROOM-01 — the four category routes that were PROVABLY identical, collapsed.
 *
 * /api/personal, /api/auto, /api/growth and /api/health were byte-identical
 * apart from `const MODULE = '<name>'` (verified by normalising that one line:
 * all four hashed to 6c5bfcde47). They are this one route now, with the module
 * as a path parameter and validated against the ONE const so an unknown module
 * is a 404, never a query with an unchecked string in it.
 *
 * NOT collapsed, and why: /api/business returns an extra coaAccounts payload
 * (entities + chart_of_accounts) that these four do not, and /api/home reads and
 * writes a DIFFERENT TABLE — home_expenses, with due_day/start_date/end_date/
 * status where these have target_date. Both keep their own routes untouched.
 *
 * Every gate is preserved verbatim: the same getVerifiedEmail() → users lookup →
 * user-scoped WHERE the four carried.
 */
function moduleOf(raw: string): string | null {
  return COLLAPSED_MODULES.includes(raw) ? raw : null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ module: string }> }) {
  const MODULE = moduleOf((await params).module);
  if (!MODULE) return NextResponse.json({ error: 'Unknown budget category' }, { status: 404 });
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const expenses = await prisma.$queryRaw`
      SELECT * FROM module_expenses WHERE user_id = ${user.id} AND module = ${MODULE} ORDER BY created_at DESC
    `;
    return NextResponse.json({ expenses });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ module: string }> }) {
  const MODULE = moduleOf((await params).module);
  if (!MODULE) return NextResponse.json({ error: 'Unknown budget category' }, { status: 404 });
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    
    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { name, coa_code, amount, cadence, target_date } = await request.json();
    
    const result = await prisma.$queryRaw`
      INSERT INTO module_expenses (user_id, module, name, coa_code, amount, cadence, target_date)
      VALUES (${user.id}, ${MODULE}, ${name}, ${coa_code}, ${amount}, ${cadence || 'monthly'}, ${target_date}::date)
      RETURNING *
    `;
    return NextResponse.json({ expense: (result as any[])[0] });
  } catch (error) {
    console.error(`Create error (${MODULE}):`, error);
    return NextResponse.json({ error: 'Failed to create' }, { status: 500 });
  }
}
