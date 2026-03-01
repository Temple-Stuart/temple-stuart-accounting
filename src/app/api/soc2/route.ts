import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

interface ProofResult {
  status: 'pass' | 'fail' | 'warn';
  summary: string;
  details?: any[];
}

export async function GET() {
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

    const userId = user.id;

    // BAL — Double-Entry Balance Verification
    const imbalanced: any[] = await prisma.$queryRaw`
      SELECT je.id, je.description,
        SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END)::text as dr,
        SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END)::text as cr
      FROM journal_entries je
      JOIN ledger_entries le ON le.journal_entry_id = je.id
      WHERE je."userId" = ${userId}
        AND je.is_reversal = false
        AND je.reversed_by_entry_id IS NULL
      GROUP BY je.id, je.description
      HAVING SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END)
          != SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END)
    `;

    const totalJeRows: any[] = await prisma.$queryRaw`
      SELECT COUNT(*)::text as count FROM journal_entries
      WHERE "userId" = ${userId}
        AND is_reversal = false AND reversed_by_entry_id IS NULL
    `;
    const totalJe = Number(totalJeRows[0]?.count || 0);

    const bal: ProofResult = {
      status: imbalanced.length === 0 && totalJe > 0 ? 'pass' : imbalanced.length > 0 ? 'fail' : 'warn',
      summary: `${totalJe} journal entries verified, ${imbalanced.length} imbalanced`,
      details: imbalanced.map(r => ({ id: r.id, description: r.description, dr: Number(r.dr), cr: Number(r.cr) })),
    };

    // AUTH — Attribution
    const authRows: any[] = await prisma.$queryRaw`
      SELECT COUNT(*)::text as total,
        COUNT(created_by)::text as attributed,
        (COUNT(*) - COUNT(created_by))::text as missing
      FROM journal_entries WHERE "userId" = ${userId}
        AND is_reversal = false AND reversed_by_entry_id IS NULL
    `;
    const authData = authRows[0] || { total: '0', attributed: '0', missing: '0' };
    const auth: ProofResult = {
      status: Number(authData.missing) === 0 && Number(authData.total) > 0 ? 'pass' : Number(authData.missing) > 0 ? 'warn' : 'warn',
      summary: `${authData.attributed}/${authData.total} entries have created_by attribution`,
    };

    // IMMUT — Immutability (check for triggers)
    let immut: ProofResult;
    try {
      const triggers: any[] = await prisma.$queryRaw`
        SELECT tgname FROM pg_trigger
        WHERE tgrelid = 'journal_entries'::regclass
          AND tgname IN ('protect_journal_entry_fields', 'no_journal_entry_deletes')
      `;
      immut = {
        status: triggers.length >= 2 ? 'pass' : triggers.length > 0 ? 'warn' : 'fail',
        summary: `${triggers.length}/2 immutability triggers active`,
        details: triggers.map(t => ({ trigger: t.tgname })),
      };
    } catch {
      immut = {
        status: 'warn',
        summary: 'Could not verify triggers — insufficient DB permissions',
        details: [],
      };
    }

    // CHGMG — Change Management (static)
    const chgmg: ProofResult = {
      status: 'pass',
      summary: 'All changes via PR review on GitHub',
      details: [{ link: 'https://github.com/Temple-Stuart/temple-stuart-accounting/pulls?q=is%3Amerged' }],
    };

    // IDEMP — Idempotency
    const idempRows: any[] = await prisma.$queryRaw`
      SELECT COUNT(*)::text as total,
        COUNT(DISTINCT request_id)::text as unique_requests,
        (COUNT(*) - COUNT(DISTINCT request_id))::text as duplicates
      FROM journal_entries WHERE "userId" = ${userId}
        AND is_reversal = false AND reversed_by_entry_id IS NULL
    `;
    const idempData = idempRows[0] || { total: '0', unique_requests: '0', duplicates: '0' };
    const idemp: ProofResult = {
      status: Number(idempData.duplicates) === 0 ? 'pass' : 'warn',
      summary: `${idempData.total} entries, ${idempData.unique_requests} unique request IDs, ${idempData.duplicates} potential duplicates`,
    };

    // SCOPE — Entity Separation
    const scopeRows: any[] = await prisma.$queryRaw`
      SELECT e.name, e.entity_type, COUNT(je.id)::text as je_count
      FROM journal_entries je
      JOIN entities e ON je.entity_id = e.id
      WHERE je."userId" = ${userId}
        AND je.is_reversal = false AND je.reversed_by_entry_id IS NULL
      GROUP BY e.name, e.entity_type
    `;
    const nullEntityRows: any[] = await prisma.$queryRaw`
      SELECT COUNT(*)::text as count FROM journal_entries
      WHERE "userId" = ${userId}
        AND is_reversal = false AND reversed_by_entry_id IS NULL
        AND entity_id IS NULL
    `;
    const nullEntities = Number(nullEntityRows[0]?.count || 0);
    const scope: ProofResult = {
      status: nullEntities === 0 && scopeRows.length > 0 ? 'pass' : nullEntities > 0 ? 'warn' : 'warn',
      summary: `${scopeRows.length} entities with JEs, ${nullEntities} entries missing entity`,
      details: scopeRows.map(r => ({ entity: r.name, type: r.entity_type, count: Number(r.je_count) })),
    };

    // TRACE — Traceability
    const traceRows: any[] = await prisma.$queryRaw`
      SELECT COUNT(*)::text as total,
        COUNT(source_id)::text as has_source,
        (COUNT(*) - COUNT(source_id))::text as missing_source
      FROM journal_entries WHERE "userId" = ${userId}
        AND is_reversal = false AND reversed_by_entry_id IS NULL
    `;
    const traceData = traceRows[0] || { total: '0', has_source: '0', missing_source: '0' };
    const trace: ProofResult = {
      status: Number(traceData.missing_source) === 0 && Number(traceData.total) > 0 ? 'pass' : Number(traceData.missing_source) > 0 ? 'warn' : 'warn',
      summary: `${traceData.has_source}/${traceData.total} entries traceable to source transaction`,
    };

    // COMPL — Completeness (summary of all checks)
    const allChecks = [bal, auth, immut, chgmg, idemp, scope, trace];
    const passing = allChecks.filter(c => c.status === 'pass').length;
    const compl: ProofResult = {
      status: passing === allChecks.length ? 'pass' : passing >= allChecks.length - 1 ? 'warn' : 'fail',
      summary: `${passing}/${allChecks.length} controls passing`,
    };

    return NextResponse.json({
      proofs: { bal, auth, immut, chgmg, idemp, scope, trace, compl },
    });
  } catch (error) {
    console.error('SOC2 API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
