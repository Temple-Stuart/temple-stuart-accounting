import { PrismaClient } from '@prisma/client';

/**
 * COA Ownership Fix & Data Isolation Audit
 *
 * Usage: DATABASE_URL="postgresql://..." npx tsx scripts/fix-coa-ownership-and-audit.ts
 *
 * This script:
 * 1. Finds all chart_of_accounts with userId = NULL
 * 2. Traces ownership through ledger_entries → journal_transactions → sibling COA
 * 3. Assigns userId to orphaned accounts
 * 4. Recalculates settled_balance from ledger_entries (fixes Balance Sheet)
 * 5. Runs full data isolation verification
 */

const prisma = new PrismaClient();

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  COA OWNERSHIP FIX & DATA ISOLATION AUDIT');
  console.log('═══════════════════════════════════════════════════════\n');

  // ── PHASE 1: Discover orphaned accounts ──────────────────────
  console.log('PHASE 1: Discovering orphaned COA accounts...\n');

  const orphanedAccounts = await prisma.chart_of_accounts.findMany({
    where: { userId: null },
    include: {
      ledger_entries: {
        take: 10,
        include: {
          journal_transactions: {
            include: {
              ledger_entries: {
                include: {
                  chart_of_accounts: {
                    select: { id: true, userId: true, code: true }
                  }
                }
              }
            }
          }
        }
      }
    },
    orderBy: { code: 'asc' }
  });

  console.log(`  Found ${orphanedAccounts.length} accounts with userId = NULL\n`);

  if (orphanedAccounts.length > 0) {
    console.log('  Code       | Name                                    | Ledger Entries');
    console.log('  -----------|------------------------------------------|---------------');
    for (const acc of orphanedAccounts) {
      const entryCount = acc.ledger_entries.length;
      console.log(`  ${acc.code.padEnd(10)} | ${acc.name.padEnd(40)} | ${entryCount > 0 ? `${entryCount}+` : '0'}`);
    }
  }

  // ── PHASE 2: Resolve ownership ───────────────────────────────
  console.log('\n\nPHASE 2: Resolving ownership...\n');

  // Get all users for fallback assignment
  const allUsers = await prisma.users.findMany({
    select: { id: true, email: true, name: true }
  });
  console.log(`  Users in system: ${allUsers.length}`);
  for (const u of allUsers) {
    console.log(`    ${u.id} — ${u.email} (${u.name})`);
  }
  console.log('');

  const results: { code: string; name: string; action: string; userId: string | null; method: string }[] = [];

  for (const account of orphanedAccounts) {
    let resolvedUserId: string | null = null;
    let method = '';

    // Strategy 1: Trace through ledger_entries → journal_transaction → sibling COA
    for (const le of account.ledger_entries) {
      for (const siblingEntry of le.journal_transactions.ledger_entries) {
        if (siblingEntry.chart_of_accounts.userId && siblingEntry.chart_of_accounts.id !== account.id) {
          resolvedUserId = siblingEntry.chart_of_accounts.userId;
          method = `traced via sibling COA ${siblingEntry.chart_of_accounts.code}`;
          break;
        }
      }
      if (resolvedUserId) break;
    }

    // Strategy 2: If has ledger entries but all siblings are also orphaned,
    // do a deeper search — find ANY journal_transaction on this account and
    // check ALL its ledger entries
    if (!resolvedUserId && account.ledger_entries.length > 0) {
      const deepEntries = await prisma.ledger_entries.findMany({
        where: { account_id: account.id },
        take: 50,
        include: {
          journal_transactions: {
            include: {
              ledger_entries: {
                include: {
                  chart_of_accounts: { select: { id: true, userId: true, code: true } }
                }
              }
            }
          }
        }
      });

      for (const le of deepEntries) {
        for (const sibling of le.journal_transactions.ledger_entries) {
          if (sibling.chart_of_accounts.userId && sibling.chart_of_accounts.id !== account.id) {
            resolvedUserId = sibling.chart_of_accounts.userId;
            method = `deep trace via sibling COA ${sibling.chart_of_accounts.code}`;
            break;
          }
        }
        if (resolvedUserId) break;
      }
    }

    // Strategy 3: No ledger entries at all — if only 1 user in system, assign to them
    if (!resolvedUserId && account.ledger_entries.length === 0 && allUsers.length === 1) {
      resolvedUserId = allUsers[0].id;
      method = 'no ledger entries, single-user system';
    }

    if (resolvedUserId) {
      await prisma.chart_of_accounts.update({
        where: { id: account.id },
        data: { userId: resolvedUserId }
      });
      results.push({ code: account.code, name: account.name, action: 'ASSIGNED', userId: resolvedUserId, method });
      console.log(`  ✓ ${account.code} → userId ${resolvedUserId.substring(0, 8)}... (${method})`);
    } else {
      results.push({ code: account.code, name: account.name, action: 'UNRESOLVED', userId: null, method: 'no attribution path found' });
      console.log(`  ✗ ${account.code} → UNRESOLVED (no attribution path)`);
    }
  }

  const assigned = results.filter(r => r.action === 'ASSIGNED').length;
  const unresolved = results.filter(r => r.action === 'UNRESOLVED').length;

  console.log(`\n  Summary: ${assigned} assigned, ${unresolved} unresolved out of ${orphanedAccounts.length} orphaned\n`);

  // ── PHASE 2B: Recalculate settled_balance from ledger_entries ─
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  PHASE 2B: RECALCULATING SETTLED BALANCES');
  console.log('═══════════════════════════════════════════════════════\n');

  const allAccounts = await prisma.chart_of_accounts.findMany({
    where: { userId: { not: null } }
  });

  let balancesFixed = 0;
  let balancesCorrect = 0;

  for (const account of allAccounts) {
    const entries = await prisma.ledger_entries.findMany({
      where: { account_id: account.id }
    });

    let computedBalance = BigInt(0);
    for (const entry of entries) {
      const isNormalBalance = entry.entry_type === account.balance_type;
      if (isNormalBalance) {
        computedBalance += entry.amount;
      } else {
        computedBalance -= entry.amount;
      }
    }

    if (account.settled_balance !== computedBalance) {
      await prisma.chart_of_accounts.update({
        where: { id: account.id },
        data: { settled_balance: computedBalance }
      });
      console.log(`  ✓ ${account.code}: ${account.settled_balance} → ${computedBalance} (${entries.length} entries)`);
      balancesFixed++;
    } else {
      balancesCorrect++;
    }
  }

  console.log(`\n  Summary: ${balancesFixed} corrected, ${balancesCorrect} already correct out of ${allAccounts.length} accounts\n`);

  // ── PHASE 3: Data isolation verification ─────────────────────
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  PHASE 3: DATA ISOLATION VERIFICATION');
  console.log('═══════════════════════════════════════════════════════\n');

  let allPassed = true;

  // Check 1: COA accounts with null userId
  const nullCoaCount = await prisma.chart_of_accounts.count({ where: { userId: null } });
  const check1Pass = nullCoaCount === 0;
  console.log(`  [${check1Pass ? 'PASS' : 'WARN'}] COA accounts with userId = NULL: ${nullCoaCount}`);
  if (!check1Pass) {
    const remaining = await prisma.chart_of_accounts.findMany({
      where: { userId: null },
      select: { code: true, name: true }
    });
    for (const r of remaining) {
      console.log(`         → ${r.code}: ${r.name}`);
    }
  }

  // Check 2: Ledger entries referencing null-userId COA accounts
  const nullCoaLedgerCount = await prisma.ledger_entries.count({
    where: { chart_of_accounts: { userId: null } }
  });
  const check2Pass = nullCoaLedgerCount === 0;
  console.log(`  [${check2Pass ? 'PASS' : 'FAIL'}] Ledger entries on null-userId COA: ${nullCoaLedgerCount}`);
  if (!check2Pass) allPassed = false;

  // Check 3: Journal transactions with ledger entries on null-userId COA
  const nullCoaJournalCount = await prisma.journal_transactions.count({
    where: { ledger_entries: { some: { chart_of_accounts: { userId: null } } } }
  });
  const check3Pass = nullCoaJournalCount === 0;
  console.log(`  [${check3Pass ? 'PASS' : 'FAIL'}] Journal txns linked to null-userId COA: ${nullCoaJournalCount}`);
  if (!check3Pass) allPassed = false;

  // Check 4: Per-user isolation — no COA shared between users
  const sharedAccounts = await prisma.$queryRaw<{ code: string; user_count: number }[]>`
    SELECT code, COUNT(DISTINCT "userId") as user_count
    FROM chart_of_accounts
    WHERE "userId" IS NOT NULL
    GROUP BY code
    HAVING COUNT(DISTINCT "userId") > 1
  `;
  const check4Pass = (sharedAccounts as any[]).length === 0;
  console.log(`  [${check4Pass ? 'PASS' : 'FAIL'}] COA codes shared between users: ${(sharedAccounts as any[]).length}`);
  if (!check4Pass) {
    allPassed = false;
    for (const s of sharedAccounts as any[]) {
      console.log(`         → ${s.code} shared by ${s.user_count} users`);
    }
  }

  // Check 5: Cross-user ledger entries — ensure no journal_transaction has
  // ledger entries pointing to COA accounts owned by different users
  const crossUserJournals = await prisma.$queryRaw<{ txn_id: string; user_count: number }[]>`
    SELECT le.transaction_id as txn_id, COUNT(DISTINCT coa."userId") as user_count
    FROM ledger_entries le
    JOIN chart_of_accounts coa ON le.account_id = coa.id
    WHERE coa."userId" IS NOT NULL
    GROUP BY le.transaction_id
    HAVING COUNT(DISTINCT coa."userId") > 1
  `;
  const check5Pass = (crossUserJournals as any[]).length === 0;
  console.log(`  [${check5Pass ? 'PASS' : 'FAIL'}] Journal txns crossing user boundaries: ${(crossUserJournals as any[]).length}`);
  if (!check5Pass) allPassed = false;

  // Check 6: Per-user account counts
  console.log('\n  Per-user COA ownership:');
  for (const u of allUsers) {
    const count = await prisma.chart_of_accounts.count({ where: { userId: u.id } });
    const ledgerCount = await prisma.ledger_entries.count({
      where: { chart_of_accounts: { userId: u.id } }
    });
    const journalCount = await prisma.journal_transactions.count({
      where: { ledger_entries: { some: { chart_of_accounts: { userId: u.id } } } }
    });
    console.log(`    ${u.email}: ${count} COA accounts, ${ledgerCount} ledger entries, ${journalCount} journal txns`);
  }

  // Final verdict
  console.log('\n═══════════════════════════════════════════════════════');
  if (allPassed && nullCoaCount === 0) {
    console.log('  ✓ ALL CHECKS PASSED — Data isolation is complete');
  } else if (allPassed) {
    console.log('  ~ PARTIAL — Some null-userId accounts remain but no financial data leaks');
  } else {
    console.log('  ✗ ISSUES FOUND — Review output above');
  }
  console.log('═══════════════════════════════════════════════════════\n');

  return { orphanedAccounts: orphanedAccounts.length, assigned, unresolved, balancesFixed, allPassed, nullCoaCount };
}

main()
  .then(result => {
    console.log('Result JSON:', JSON.stringify(result, null, 2));
  })
  .catch(err => {
    console.error('FATAL:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
