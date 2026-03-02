import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

interface ControlProof {
  id: string;
  name: string;
  description: string;
  status: 'pass' | 'fail' | 'warn';
  proof: {
    query: string;
    result: any;
    explanation: string;
  };
  timestamp: string;
}

function fmtCents(cents: number): string {
  const dollars = Math.abs(cents) / 100;
  return '$' + dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    const now = new Date().toISOString();
    const controls: ControlProof[] = [];

    // ═══════════════════════════════════════════════════════════════════
    // 1. BAL — Accounting Equation
    // ═══════════════════════════════════════════════════════════════════
    const balRows: Array<{ total_debits: string; total_credits: string }> = await prisma.$queryRaw`
      SELECT
        COALESCE(SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END), 0)::text as total_debits,
        COALESCE(SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END), 0)::text as total_credits
      FROM ledger_entries le
      JOIN journal_entries je ON le.journal_entry_id = je.id
      WHERE je."userId" = ${userId}
        AND je.is_reversal = false
        AND je.reversed_by_entry_id IS NULL
    `;
    const totalDebits = Number(balRows[0]?.total_debits || 0);
    const totalCredits = Number(balRows[0]?.total_credits || 0);
    const imbalance = totalDebits - totalCredits;

    controls.push({
      id: 'BAL',
      name: 'Accounting Equation',
      description: 'Verifies that total debits equal total credits across all active ledger entries (SUM(D) = SUM(C)).',
      status: imbalance === 0 && totalDebits > 0 ? 'pass' : imbalance !== 0 ? 'fail' : 'warn',
      proof: {
        query: `SELECT
  SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END) as total_debits,
  SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END) as total_credits
FROM ledger_entries le
JOIN journal_entries je ON le.journal_entry_id = je.id
WHERE je."userId" = $1
  AND je.is_reversal = false
  AND je.reversed_by_entry_id IS NULL`,
        result: { totalDebits, totalCredits, imbalance },
        explanation: `Total debits: ${fmtCents(totalDebits)}. Total credits: ${fmtCents(totalCredits)}. Imbalance: ${fmtCents(imbalance)}.${imbalance === 0 ? ' The books balance perfectly.' : ' WARNING: Books are out of balance!'}`,
      },
      timestamp: now,
    });

    // ═══════════════════════════════════════════════════════════════════
    // 2. BAL_JE — Journal Entry Balance
    // ═══════════════════════════════════════════════════════════════════
    const balJeRows: Array<{ imbalanced_count: string; total_je_count: string }> = await prisma.$queryRaw`
      SELECT
        COUNT(*) FILTER (WHERE dr != cr)::text as imbalanced_count,
        COUNT(*)::text as total_je_count
      FROM (
        SELECT je.id,
          SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END) as dr,
          SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END) as cr
        FROM journal_entries je
        JOIN ledger_entries le ON le.journal_entry_id = je.id
        WHERE je."userId" = ${userId}
          AND je.is_reversal = false
          AND je.reversed_by_entry_id IS NULL
        GROUP BY je.id
      ) sub
    `;
    const imbalancedJeCount = Number(balJeRows[0]?.imbalanced_count || 0);
    const totalJeCount = Number(balJeRows[0]?.total_je_count || 0);

    controls.push({
      id: 'BAL_JE',
      name: 'Journal Entry Balance',
      description: 'Verifies every individual journal entry has balanced debits and credits (DR = CR per JE).',
      status: imbalancedJeCount === 0 && totalJeCount > 0 ? 'pass' : imbalancedJeCount > 0 ? 'fail' : 'warn',
      proof: {
        query: `SELECT COUNT(*) FILTER (WHERE dr != cr) as imbalanced_count,
  COUNT(*) as total_je_count
FROM (
  SELECT je.id,
    SUM(CASE WHEN le.entry_type = 'D' THEN le.amount ELSE 0 END) as dr,
    SUM(CASE WHEN le.entry_type = 'C' THEN le.amount ELSE 0 END) as cr
  FROM journal_entries je
  JOIN ledger_entries le ON le.journal_entry_id = je.id
  WHERE je."userId" = $1
    AND je.is_reversal = false AND je.reversed_by_entry_id IS NULL
  GROUP BY je.id
) sub`,
        result: { totalJournalEntries: totalJeCount, imbalancedEntries: imbalancedJeCount },
        explanation: `${totalJeCount} journal entries examined. ${imbalancedJeCount} imbalanced.${imbalancedJeCount === 0 ? ' Every journal entry balances perfectly.' : ` WARNING: ${imbalancedJeCount} entries have mismatched debits/credits!`}`,
      },
      timestamp: now,
    });

    // ═══════════════════════════════════════════════════════════════════
    // 3. AUTH — Attribution
    // ═══════════════════════════════════════════════════════════════════
    const authRows: Array<{ total: string; attributed: string; missing: string }> = await prisma.$queryRaw`
      SELECT
        COUNT(*)::text as total,
        COUNT(created_by)::text as attributed,
        (COUNT(*) - COUNT(created_by))::text as missing
      FROM journal_entries
      WHERE "userId" = ${userId}
        AND is_reversal = false
        AND reversed_by_entry_id IS NULL
    `;
    const authTotal = Number(authRows[0]?.total || 0);
    const authAttributed = Number(authRows[0]?.attributed || 0);
    const authMissing = Number(authRows[0]?.missing || 0);

    controls.push({
      id: 'AUTH',
      name: 'Attribution',
      description: 'Verifies every journal entry records who or what created it (created_by field).',
      status: authMissing === 0 && authTotal > 0 ? 'pass' : authMissing > 0 ? 'warn' : 'warn',
      proof: {
        query: `SELECT COUNT(*) as total,
  COUNT(created_by) as attributed,
  (COUNT(*) - COUNT(created_by)) as missing
FROM journal_entries
WHERE "userId" = $1
  AND is_reversal = false AND reversed_by_entry_id IS NULL`,
        result: { totalEntries: authTotal, withAttribution: authAttributed, missingAttribution: authMissing },
        explanation: `${authAttributed}/${authTotal} journal entries have created_by attribution. ${authMissing} missing.${authMissing === 0 ? ' Full audit trail coverage.' : ` ${authMissing} entries lack creator attribution.`}`,
      },
      timestamp: now,
    });

    // ═══════════════════════════════════════════════════════════════════
    // 4. TRACE — Traceability
    // ═══════════════════════════════════════════════════════════════════
    const traceRows: Array<{ total: string; has_source: string; orphaned: string }> = await prisma.$queryRaw`
      SELECT
        COUNT(*)::text as total,
        COUNT(source_id)::text as has_source,
        (COUNT(*) - COUNT(source_id))::text as orphaned
      FROM journal_entries
      WHERE "userId" = ${userId}
        AND is_reversal = false
        AND reversed_by_entry_id IS NULL
    `;
    const traceTotal = Number(traceRows[0]?.total || 0);
    const traceHasSource = Number(traceRows[0]?.has_source || 0);
    const traceOrphaned = Number(traceRows[0]?.orphaned || 0);

    controls.push({
      id: 'TRACE',
      name: 'Traceability',
      description: 'Verifies every journal entry links to its source transaction (source_id populated).',
      status: traceOrphaned === 0 && traceTotal > 0 ? 'pass' : traceOrphaned > 0 ? 'warn' : 'warn',
      proof: {
        query: `SELECT COUNT(*) as total,
  COUNT(source_id) as has_source,
  (COUNT(*) - COUNT(source_id)) as orphaned
FROM journal_entries
WHERE "userId" = $1
  AND is_reversal = false AND reversed_by_entry_id IS NULL`,
        result: { totalEntries: traceTotal, withSource: traceHasSource, orphaned: traceOrphaned },
        explanation: `${traceHasSource}/${traceTotal} journal entries traceable to source transaction. ${traceOrphaned} orphaned.${traceOrphaned === 0 ? ' Complete audit trail from JE to source.' : ` ${traceOrphaned} entries cannot be traced to a source transaction.`}`,
      },
      timestamp: now,
    });

    // ═══════════════════════════════════════════════════════════════════
    // 5. IDEMP — Idempotency
    // ═══════════════════════════════════════════════════════════════════
    const idempRows: Array<{ duplicate_groups: string }> = await prisma.$queryRaw`
      SELECT COUNT(*)::text as duplicate_groups
      FROM (
        SELECT request_id
        FROM journal_entries
        WHERE "userId" = ${userId}
          AND is_reversal = false
          AND reversed_by_entry_id IS NULL
          AND request_id IS NOT NULL
        GROUP BY request_id
        HAVING COUNT(*) > 1
      ) sub
    `;
    const duplicateGroups = Number(idempRows[0]?.duplicate_groups || 0);

    controls.push({
      id: 'IDEMP',
      name: 'Idempotency',
      description: 'Verifies no two journal entries share the same request_id (prevents duplicate processing).',
      status: duplicateGroups === 0 ? 'pass' : 'fail',
      proof: {
        query: `SELECT request_id, COUNT(*) as count
FROM journal_entries
WHERE "userId" = $1
  AND is_reversal = false AND reversed_by_entry_id IS NULL
  AND request_id IS NOT NULL
GROUP BY request_id
HAVING COUNT(*) > 1`,
        result: { duplicateRequestIdGroups: duplicateGroups },
        explanation: `${duplicateGroups} duplicate request_id groups found.${duplicateGroups === 0 ? ' Every transaction has a unique request_id — no duplicates possible.' : ` WARNING: ${duplicateGroups} request_ids appear on multiple JEs!`}`,
      },
      timestamp: now,
    });

    // ═══════════════════════════════════════════════════════════════════
    // 6. SCOPE — Entity Separation
    // ═══════════════════════════════════════════════════════════════════
    const scopeRows: Array<{ total: string; with_entity: string; missing: string }> = await prisma.$queryRaw`
      SELECT
        COUNT(*)::text as total,
        COUNT(entity_id)::text as with_entity,
        (COUNT(*) - COUNT(entity_id))::text as missing
      FROM journal_entries
      WHERE "userId" = ${userId}
        AND is_reversal = false
        AND reversed_by_entry_id IS NULL
    `;
    const scopeTotal = Number(scopeRows[0]?.total || 0);
    const scopeWithEntity = Number(scopeRows[0]?.with_entity || 0);
    const scopeMissing = Number(scopeRows[0]?.missing || 0);

    // Also get entity breakdown
    const entityBreakdown: Array<{ entity_name: string; entity_type: string; je_count: string }> = await prisma.$queryRaw`
      SELECT e.name as entity_name, e.entity_type, COUNT(je.id)::text as je_count
      FROM journal_entries je
      JOIN entities e ON je.entity_id = e.id
      WHERE je."userId" = ${userId}
        AND je.is_reversal = false AND je.reversed_by_entry_id IS NULL
      GROUP BY e.name, e.entity_type
    `;

    controls.push({
      id: 'SCOPE',
      name: 'Entity Separation',
      description: 'Verifies every journal entry is scoped to an entity (entity_id populated), ensuring data isolation between personal/business.',
      status: scopeMissing === 0 && scopeTotal > 0 ? 'pass' : scopeMissing > 0 ? 'warn' : 'warn',
      proof: {
        query: `SELECT COUNT(*) as total,
  COUNT(entity_id) as with_entity,
  (COUNT(*) - COUNT(entity_id)) as missing
FROM journal_entries
WHERE "userId" = $1
  AND is_reversal = false AND reversed_by_entry_id IS NULL`,
        result: {
          totalEntries: scopeTotal,
          withEntity: scopeWithEntity,
          missingEntity: scopeMissing,
          entityBreakdown: entityBreakdown.map(r => ({ entity: r.entity_name, type: r.entity_type, count: Number(r.je_count) })),
        },
        explanation: `${scopeWithEntity}/${scopeTotal} journal entries assigned to an entity. ${scopeMissing} missing.${entityBreakdown.length > 0 ? ' Entities: ' + entityBreakdown.map(r => `${r.entity_name} (${r.entity_type}): ${r.je_count}`).join(', ') + '.' : ''}${scopeMissing === 0 ? ' All entries properly scoped.' : ''}`,
      },
      timestamp: now,
    });

    // ═══════════════════════════════════════════════════════════════════
    // 7. COMPL — Pipeline Completeness
    // ═══════════════════════════════════════════════════════════════════
    // committed txns count must join through accounts (transactions has no userId)
    const complRows: Array<{
      committed_txns: string;
      active_jes: string;
      ledger_entries: string;
    }> = await prisma.$queryRaw`
      SELECT
        (SELECT COUNT(*)
         FROM transactions t
         JOIN accounts a ON t."accountId" = a.id
         WHERE a."userId" = ${userId}
           AND t.review_status = 'committed'
        )::text as committed_txns,
        (SELECT COUNT(*)
         FROM journal_entries
         WHERE "userId" = ${userId}
           AND is_reversal = false
           AND reversed_by_entry_id IS NULL
           AND source_type = 'plaid_txn'
        )::text as active_jes,
        (SELECT COUNT(*)
         FROM ledger_entries le
         JOIN journal_entries je ON le.journal_entry_id = je.id
         WHERE je."userId" = ${userId}
           AND je.is_reversal = false
           AND je.reversed_by_entry_id IS NULL
           AND je.source_type = 'plaid_txn'
        )::text as ledger_entries
    `;
    const committedTxns = Number(complRows[0]?.committed_txns || 0);
    const activeJes = Number(complRows[0]?.active_jes || 0);
    const ledgerEntries = Number(complRows[0]?.ledger_entries || 0);
    const expectedLe = activeJes * 2;
    const txnJeMatch = committedTxns === activeJes;
    const leMatch = ledgerEntries === expectedLe;

    controls.push({
      id: 'COMPL',
      name: 'Pipeline Completeness',
      description: 'Verifies the commit pipeline is complete: committed transactions = active JEs, and each JE has exactly 2 ledger entries (debit + credit).',
      status: txnJeMatch && leMatch && committedTxns > 0 ? 'pass' : !txnJeMatch || !leMatch ? 'warn' : 'warn',
      proof: {
        query: `-- Committed transactions (via accounts join)
SELECT COUNT(*) FROM transactions t
JOIN accounts a ON t."accountId" = a.id
WHERE a."userId" = $1 AND t.review_status = 'committed';

-- Active JEs from Plaid
SELECT COUNT(*) FROM journal_entries
WHERE "userId" = $1 AND is_reversal = false
  AND reversed_by_entry_id IS NULL AND source_type = 'plaid_txn';

-- Ledger entries for those JEs
SELECT COUNT(*) FROM ledger_entries le
JOIN journal_entries je ON le.journal_entry_id = je.id
WHERE je."userId" = $1 AND je.is_reversal = false
  AND je.reversed_by_entry_id IS NULL AND je.source_type = 'plaid_txn';`,
        result: {
          committedTransactions: committedTxns,
          activeJournalEntries: activeJes,
          ledgerEntries,
          expectedLedgerEntries: expectedLe,
          txnJeMatch,
          leMatch,
        },
        explanation: `Committed transactions: ${committedTxns}. Active JEs: ${activeJes}. Ledger entries: ${ledgerEntries} (expected ${expectedLe}).${txnJeMatch ? ' Txn→JE pipeline in sync.' : ` Txn/JE mismatch: ${committedTxns} txns vs ${activeJes} JEs.`}${leMatch ? ' Each JE has exactly 2 LEs (DR+CR).' : ` LE count mismatch: ${ledgerEntries} vs expected ${expectedLe}.`}`,
      },
      timestamp: now,
    });

    // ═══════════════════════════════════════════════════════════════════
    // 8. IMMUT — Immutability Triggers
    // ═══════════════════════════════════════════════════════════════════
    let immutControl: ControlProof;
    try {
      const triggerRows: Array<{ tgname: string; tgenabled: string }> = await prisma.$queryRaw`
        SELECT tgname, tgenabled::text
        FROM pg_trigger
        WHERE tgrelid = 'journal_entries'::regclass
          AND tgname IN ('protect_journal_entry_fields', 'no_journal_entry_deletes')
      `;
      const triggerCount = triggerRows.length;
      const allEnabled = triggerRows.every(t => t.tgenabled === 'O');

      immutControl = {
        id: 'IMMUT',
        name: 'Immutability Triggers',
        description: 'Verifies database triggers prevent modification and deletion of journal entries after creation.',
        status: triggerCount >= 2 && allEnabled ? 'pass' : triggerCount > 0 ? 'warn' : 'fail',
        proof: {
          query: `SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgrelid = 'journal_entries'::regclass
  AND tgname IN ('protect_journal_entry_fields', 'no_journal_entry_deletes')`,
          result: {
            triggersFound: triggerCount,
            triggersExpected: 2,
            triggers: triggerRows.map(t => ({ name: t.tgname, enabled: t.tgenabled === 'O' })),
          },
          explanation: `${triggerCount}/2 immutability triggers found.${triggerRows.map(t => ` ${t.tgname}: ${t.tgenabled === 'O' ? 'enabled' : 'DISABLED'}`).join('.')}${triggerCount >= 2 && allEnabled ? ' Journal entries are fully protected against modification and deletion.' : ''}`,
        },
        timestamp: now,
      };
    } catch {
      immutControl = {
        id: 'IMMUT',
        name: 'Immutability Triggers',
        description: 'Verifies database triggers prevent modification and deletion of journal entries after creation.',
        status: 'warn',
        proof: {
          query: `SELECT tgname, tgenabled FROM pg_trigger WHERE tgrelid = 'journal_entries'::regclass`,
          result: { error: 'Insufficient database permissions to query pg_trigger' },
          explanation: 'Could not verify immutability triggers — the database user may not have permission to query pg_trigger. This does not mean triggers are absent, only that verification requires elevated access.',
        },
        timestamp: now,
      };
    }
    controls.push(immutControl);

    // ═══════════════════════════════════════════════════════════════════
    // 9. UNIQ — Unique Index
    // ═══════════════════════════════════════════════════════════════════
    let uniqControl: ControlProof;
    try {
      const indexRows: Array<{ indexname: string; indexdef: string }> = await prisma.$queryRaw`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'journal_entries'
          AND indexname = 'idx_je_request_id_unique'
      `;
      const indexExists = indexRows.length > 0;

      uniqControl = {
        id: 'UNIQ',
        name: 'Unique Index',
        description: 'Verifies the partial unique index on request_id exists, enforcing idempotency at the database level.',
        status: indexExists ? 'pass' : 'fail',
        proof: {
          query: `SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'journal_entries'
  AND indexname = 'idx_je_request_id_unique'`,
          result: {
            indexExists,
            indexDefinition: indexRows[0]?.indexdef || null,
          },
          explanation: indexExists
            ? `Index idx_je_request_id_unique exists: ${indexRows[0].indexdef}. Database enforces unique request_ids at the constraint level.`
            : 'WARNING: Unique index idx_je_request_id_unique not found. Idempotency is only enforced at the application level.',
        },
        timestamp: now,
      };
    } catch {
      uniqControl = {
        id: 'UNIQ',
        name: 'Unique Index',
        description: 'Verifies the partial unique index on request_id exists, enforcing idempotency at the database level.',
        status: 'warn',
        proof: {
          query: `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'journal_entries' AND indexname = 'idx_je_request_id_unique'`,
          result: { error: 'Insufficient database permissions to query pg_indexes' },
          explanation: 'Could not verify index existence — the database user may not have permission to query pg_indexes.',
        },
        timestamp: now,
      };
    }
    controls.push(uniqControl);

    // ═══════════════════════════════════════════════════════════════════
    // 10. DEDUP — Account Deduplication
    // ═══════════════════════════════════════════════════════════════════
    const dedupRows: Array<{ duplicate_groups: string }> = await prisma.$queryRaw`
      SELECT COUNT(*)::text as duplicate_groups
      FROM (
        SELECT mask, type
        FROM accounts
        WHERE "userId" = ${userId}
          AND mask IS NOT NULL
        GROUP BY mask, type
        HAVING COUNT(*) > 1
      ) sub
    `;
    const dedupCount = Number(dedupRows[0]?.duplicate_groups || 0);

    controls.push({
      id: 'DEDUP',
      name: 'Account Deduplication',
      description: 'Verifies no duplicate bank accounts exist (same mask + type combination for a user).',
      status: dedupCount === 0 ? 'pass' : 'warn',
      proof: {
        query: `SELECT mask, type, COUNT(*) as count
FROM accounts
WHERE "userId" = $1 AND mask IS NOT NULL
GROUP BY mask, type
HAVING COUNT(*) > 1`,
        result: { duplicateAccountGroups: dedupCount },
        explanation: `${dedupCount} duplicate account groups found.${dedupCount === 0 ? ' No duplicate bank accounts — each account is unique.' : ` ${dedupCount} groups of accounts share the same mask+type combination.`}`,
      },
      timestamp: now,
    });

    // ═══════════════════════════════════════════════════════════════════
    // Summary
    // ═══════════════════════════════════════════════════════════════════
    const passing = controls.filter(c => c.status === 'pass').length;
    const failing = controls.filter(c => c.status === 'fail').length;
    const warning = controls.filter(c => c.status === 'warn').length;

    return NextResponse.json({
      controls,
      summary: {
        total: controls.length,
        passing,
        failing,
        warning,
        overallStatus: failing > 0 ? 'fail' : warning > 0 ? 'warn' : 'pass',
      },
      timestamp: now,
      // Backward compat: keep 'proofs' for dashboard indicators
      proofs: Object.fromEntries(controls.map(c => [c.id.toLowerCase(), { status: c.status, summary: c.proof.explanation, details: [] }])),
    });
  } catch (error) {
    console.error('SOC2 API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
