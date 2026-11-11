import { NextRequest, NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
// BOOKS-01: the statements come from ONE function (src/lib/books/statements.ts) over ONE read (statementsRead.ts) —
// the same pair /api/cpa-export calls, so the two screens cannot disagree.
import { statementsOf } from '@/lib/books/statements';
import { readStatements } from '@/lib/books/statementsRead';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // TAB-SERVER-GATE: tab:books entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

    const { searchParams } = new URL(request.url);
    // BOOKS-01: the year is checked as the Export checks it (src/app/api/cpa-export/route.ts) — an integer from 2000
    // to 2100, else 400. No year asked for is the current one, as before.
    const yearParam = searchParams.get('year');
    const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ error: 'Invalid year parameter' }, { status: 400 });
    }
    const entityId = searchParams.get('entityId');

    // Verify entity belongs to authenticated user before filtering
    if (entityId) {
      const entity = await prisma.entities.findFirst({
        where: { id: entityId, userId: user.id },
      });
      if (!entity) {
        return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
      }
    }

    // Build dynamic WHERE clauses — same pattern as trial-balance/route.ts
    const conditions: Prisma.Sql[] = [
      Prisma.sql`je."userId" = ${user.id}`,
      Prisma.sql`je.is_reversal = false`,
      Prisma.sql`je.reversed_by_entry_id IS NULL`,
      Prisma.sql`EXTRACT(YEAR FROM je.date) = ${year}`,
    ];

    if (entityId) {
      conditions.push(Prisma.sql`je.entity_id = ${entityId}`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');

    // Aggregate ledger entries by COA account and month
    const rows: any[] = await prisma.$queryRaw`
      SELECT
        coa.id,
        coa.code,
        coa.name,
        coa.account_type,
        coa.entity_id,
        e.name as entity_name,
        EXTRACT(MONTH FROM je.date)::int as month,
        SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END)::text as debits,
        SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END)::text as credits
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      JOIN chart_of_accounts coa ON le.account_id = coa.id
      LEFT JOIN entities e ON coa.entity_id = e.id
      WHERE ${whereClause}
      GROUP BY coa.id, coa.code, coa.name, coa.account_type,
               coa.entity_id, e.name, EXTRACT(MONTH FROM je.date)
      ORDER BY coa.account_type, coa.code, month
    `;

    // Build year-available query with same entity scoping
    const yearConditions: Prisma.Sql[] = [
      Prisma.sql`"userId" = ${user.id}`,
      Prisma.sql`is_reversal = false`,
      Prisma.sql`reversed_by_entry_id IS NULL`,
    ];

    if (entityId) {
      yearConditions.push(Prisma.sql`entity_id = ${entityId}`);
    }

    const yearWhereClause = Prisma.join(yearConditions, ' AND ');

    const yearRows: any[] = await prisma.$queryRaw`
      SELECT DISTINCT EXTRACT(YEAR FROM date)::int as year
      FROM journal_entries
      WHERE ${yearWhereClause}
      ORDER BY year DESC
    `;

    const accounts = rows.map(r => ({
      id: r.id,
      code: r.code,
      name: r.name,
      accountType: r.account_type,
      entityId: r.entity_id,
      entityName: r.entity_name,
      month: Number(r.month),
      debits: Number(r.debits),
      credits: Number(r.credits),
    }));

    const availableYears = yearRows.map(r => Number(r.year));

    // BOOKS-01: THE STATEMENTS — the income statement of the year (closing entries out) and the balance sheet through
    // Dec 31 of it (every earlier year in), signed, from the one function over the one read. `accounts` above keeps
    // its shape for the answers page (src/components/answers/AnswersClient.tsx) and `availableYears` for the Books
    // page; neither is what the statements are summed from.
    const read = await readStatements(prisma, { userId: user.id, entityId: entityId ? entityId : null, year });
    const statements = statementsOf({ toDate: read.toDate, inPeriod: read.inPeriod });

    return NextResponse.json({ accounts, availableYears, scope: read.scope, statements });
  } catch (error) {
    return failClosedResponse('Statements API', 'Statements read failed', error);
  }
}
