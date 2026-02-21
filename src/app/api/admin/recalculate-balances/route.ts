import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

/**
 * POST /api/admin/recalculate-balances
 *
 * Recomputes settled_balance on every chart_of_accounts row from the
 * source-of-truth: ledger_entries.  This fixes any drift between the
 * running total and the actual entries (e.g. from historical commits
 * that hit accounts before userId was set).
 *
 * Also runs the COA ownership fix first, so accounts are properly
 * attributed before recalculation.
 */
export async function POST() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // ── Step 1: Fix COA ownership (assign userId to null accounts) ──
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
                    chart_of_accounts: { select: { id: true, userId: true, code: true } }
                  }
                }
              }
            }
          }
        }
      }
    });

    const ownershipResults: { code: string; action: string; method: string }[] = [];

    for (const account of orphanedAccounts) {
      let resolvedUserId: string | null = null;
      let method = '';

      // Strategy 1: Trace through sibling COA in same journal transaction
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

      // Strategy 2: Deep search if strategy 1 failed but entries exist
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

      // Strategy 3: No entries, assign to requesting user
      if (!resolvedUserId && account.ledger_entries.length === 0) {
        resolvedUserId = user.id;
        method = 'no ledger entries, assigned to requesting user';
      }

      if (resolvedUserId) {
        await prisma.chart_of_accounts.update({
          where: { id: account.id },
          data: { userId: resolvedUserId }
        });
        ownershipResults.push({ code: account.code, action: 'assigned', method });
      } else {
        ownershipResults.push({ code: account.code, action: 'unresolved', method: 'no attribution path' });
      }
    }

    // ── Step 2: Recalculate settled_balance from ledger_entries ──────
    const userAccounts = await prisma.chart_of_accounts.findMany({
      where: { userId: user.id }
    });

    const recalcResults: { code: string; oldBalance: string; newBalance: string; changed: boolean }[] = [];

    for (const account of userAccounts) {
      // Sum all ledger entries for this account
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

      const oldBalance = account.settled_balance;
      const changed = oldBalance !== computedBalance;

      if (changed) {
        await prisma.chart_of_accounts.update({
          where: { id: account.id },
          data: { settled_balance: computedBalance }
        });
      }

      recalcResults.push({
        code: account.code,
        oldBalance: oldBalance.toString(),
        newBalance: computedBalance.toString(),
        changed
      });
    }

    const ownershipFixed = ownershipResults.filter(r => r.action === 'assigned').length;
    const balancesFixed = recalcResults.filter(r => r.changed).length;

    return NextResponse.json({
      ownership: {
        orphanedFound: orphanedAccounts.length,
        fixed: ownershipFixed,
        results: ownershipResults
      },
      balances: {
        accountsChecked: userAccounts.length,
        balancesFixed,
        results: recalcResults.filter(r => r.changed)
      }
    });
  } catch (error) {
    console.error('Recalculate balances error:', error);
    return NextResponse.json({ error: 'Failed to recalculate balances' }, { status: 500 });
  }
}
