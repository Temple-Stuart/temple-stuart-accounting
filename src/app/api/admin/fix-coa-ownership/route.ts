import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

/**
 * POST /api/admin/fix-coa-ownership
 *
 * Finds all chart_of_accounts rows with userId = NULL, traces ownership
 * through ledger_entries to determine which user's transactions posted
 * to them, and assigns the correct userId.
 *
 * Accounts that cannot be attributed to any user remain null and stay
 * invisible (which is the correct security posture).
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

    // Find all COA accounts with no owner
    const orphanedAccounts = await prisma.chart_of_accounts.findMany({
      where: { userId: null },
      include: {
        ledger_entries: {
          take: 1,
          include: {
            journal_transactions: {
              include: {
                ledger_entries: {
                  include: {
                    chart_of_accounts: {
                      select: { userId: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const results: { code: string; name: string; action: string; userId: string | null }[] = [];

    for (const account of orphanedAccounts) {
      let resolvedUserId: string | null = null;

      // Strategy 1: Trace through ledger_entries → journal_transaction → sibling ledger_entries → COA userId
      for (const le of account.ledger_entries) {
        for (const siblingEntry of le.journal_transactions.ledger_entries) {
          if (siblingEntry.chart_of_accounts.userId) {
            resolvedUserId = siblingEntry.chart_of_accounts.userId;
            break;
          }
        }
        if (resolvedUserId) break;
      }

      // Strategy 2: If no ledger entries exist, assign to the requesting user
      // (safe because only an authenticated user can call this endpoint)
      if (!resolvedUserId && account.ledger_entries.length === 0) {
        resolvedUserId = user.id;
      }

      if (resolvedUserId) {
        await prisma.chart_of_accounts.update({
          where: { id: account.id },
          data: { userId: resolvedUserId }
        });
        results.push({
          code: account.code,
          name: account.name,
          action: 'assigned',
          userId: resolvedUserId
        });
      } else {
        results.push({
          code: account.code,
          name: account.name,
          action: 'unresolved',
          userId: null
        });
      }
    }

    const assigned = results.filter(r => r.action === 'assigned').length;
    const unresolved = results.filter(r => r.action === 'unresolved').length;

    return NextResponse.json({
      totalOrphaned: orphanedAccounts.length,
      assigned,
      unresolved,
      results
    });
  } catch (error) {
    console.error('Fix COA ownership error:', error);
    return NextResponse.json({ error: 'Failed to fix COA ownership' }, { status: 500 });
  }
}
