import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { heldByAccount } from '@/lib/accountsView';

export async function GET(request: NextRequest) {
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
    // TAB-SERVER-GATE: tab:books entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

    // BANK-03: a retired item (replaced by a fresh link) appears nowhere but history.
    const items = await prisma.plaid_items.findMany({
      where: { userId: user.id, retired_at: null },
      include: {
        accounts: true
      }
    });

    // SYNC-01: WHAT THE APP HOLDS for each account — its bank transactions plus its investment transactions, and the
    // newest date among them. Two grouped reads over the account ids of the caller's own live links read just above:
    // never one read per account, and never an id that is not the caller's.
    const accountIds = items.flatMap((item) => item.accounts.map((account) => account.id));
    const [bankHeld, investmentHeld] = await Promise.all([
      prisma.transactions.groupBy({ by: ['accountId'], where: { accountId: { in: accountIds } }, _count: { _all: true }, _max: { date: true } }),
      prisma.investment_transactions.groupBy({ by: ['accountId'], where: { accountId: { in: accountIds } }, _count: { _all: true }, _max: { date: true } }),
    ]);
    const heldOf = heldByAccount(accountIds, bankHeld, investmentHeld);

    const transformedItems = items.map(item => ({
      id: item.id,
      institutionName: item.institutionName,
      // BANK-01: the item's last Plaid ITEM_ERROR, so the Books page can offer Reconnect.
      lastErrorCode: item.last_error_code,
      lastErrorAt: item.last_error_at,
      // ACCOUNTS-01: currentBalance is Float? — nullable. It is sent AS IT IS; the screen
      // renders a missing balance as "—" (src/lib/accountsView.ts money()). The old `|| 0`
      // turned "the institution reported nothing" into "zero dollars".
      accounts: item.accounts.map(account => ({
        id: account.id,
        name: account.name,
        type: account.type,
        subtype: account.subtype,
        mask: account.mask,
        balance: account.currentBalance,
        // FX-01 (2026-10-30): the balance's OWN currency — as Plaid stated it, or NULL (LAW-02); the screen
        // writes the figure in that currency, never as dollars by default (functionalCurrency.ts bankMoneyWords).
        currency: account.isoCurrencyCode,
        entityType: account.entityType || null,
        // ACCOUNTS-01: the row's last write — a sync, or an entity assignment. NOT a sync
        // timestamp: the product records none per account, and the screen says so.
        updatedAt: account.updatedAt,
        // SYNC-01: `held` — the rows the app holds for the account (bank + investment transactions); `latest` — the
        // newest date among them as 'YYYY-MM-DD', or null when it holds none. A day, not an instant: the screen
        // prints it through the one day formatter, never in the viewer's time zone.
        ...heldOf(account.id),
      }))
    }));

    // Dashboard expects { items: [...] }
    return NextResponse.json({ items: transformedItems });
  } catch (error) {
    console.error('Accounts error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
  }
}
