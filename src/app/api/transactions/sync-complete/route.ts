import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { decryptToken } from '@/lib/secrets/tokenCipher';
import { failureEnvelope, stageFailed, stageOk, sumStageCounts, syncEachItem, syncItemsEnvelope, type StageFailed, type StageOutcome } from '@/lib/plaid/failLoud';
import { summarizePlaidError } from '@/lib/plaid/summarizeError';
import { bankName, clearItemError, isItemError, itemFailure, recordItemError } from '@/lib/plaid/reconnect';
import { wireOf } from '@/lib/plaid/wire';
import { prismaLanding } from '@/lib/arrivals/prismaLanding';
import { recordFailedAnswer, runTransactionsPage } from '@/lib/arrivals/plaidTransactionsPage';
// PERF-01: the domain writes of a page land in one statement per kind, not one per row.
import { prismaDomain } from '@/lib/arrivals/prismaDomain';
// REBUILD-01 PR-2c: the investments phase lands raw-first too — securities and investment
// transactions as arrivals, the parser reading them, one statement per kind.
import { INVESTMENT_TRANSACTION, runInvestmentsPage } from '@/lib/arrivals/plaidInvestmentsPage';
import { prismaInvestmentsDomain } from '@/lib/arrivals/prismaInvestmentsDomain';
// REBUILD-01 PR-2d: holdings land as SNAPSHOTS — one holdings answer per item per sync,
// raw-first, the composed their_id labeled, one statement per kind.
import { HOLDING, runHoldingsPage } from '@/lib/arrivals/plaidHoldingsPage';
import { prismaHoldingsDomain } from '@/lib/arrivals/prismaHoldingsDomain';
import type { Prisma } from '@prisma/client';

export const maxDuration = 300; // 5 minutes for Pro plan

export async function POST() {
  try {
    const userEmail = await getVerifiedEmail();

    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findUnique({
      where: { email: userEmail }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    // TAB-SERVER-GATE: tab:books entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:books');
    if (tabGate) return tabGate;

    // HYG-03: a stable run — items by institution, then id. BANK-03: a retired item
    // (replaced by a fresh link) is skipped and reported as retired, never as failed.
    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId: user.id, retired_at: null },
      include: { accounts: true },
      orderBy: [{ institutionName: 'asc' }, { id: 'asc' }],
    });
    const retiredItems = await prisma.plaid_items.findMany({
      where: { userId: user.id, retired_at: { not: null } },
      select: { institutionName: true, retired_reason: true, retired_at: true },
      orderBy: [{ institutionName: 'asc' }, { id: 'asc' }],
    });
    type PlaidItem = (typeof plaidItems)[number];

    // BANK-01: a Plaid ITEM_ERROR (ITEM_LOGIN_REQUIRED and its kin) is the ITEM's state, not
    // a one-off fault — record its code on the item (user-scoped) and name the INSTITUTION in
    // the declared failure; never the Plaid item id, never a token. Any other error is
    // declared as before.
    const declareStageFailure = async (stage: string, error: unknown, item: { id: string; institutionName: string | null }): Promise<StageFailed> => {
      const summary = summarizePlaidError(error);
      if (isItemError(summary)) {
        await recordItemError(prisma, { itemRowId: item.id, userId: user.id, code: summary.error_code ?? 'ITEM_ERROR', at: new Date() });
        return itemFailure(stage, item.institutionName, error);
      }
      return stageFailed(stage, error);
    };

    // HYG-03: ONE BANK'S FAILURE NEVER BLOCKS ANOTHER. Each item runs both stages and
    // declares its own outcome per stage (ok with counts | failed with the named bank and
    // the summarized Plaid error). Nothing about item A decides whether item B runs.
    // Inside one item a page failure still ends that item's stage and rolls that page
    // back (PR-2, unchanged).

    const syncTransactions = async (item: PlaidItem): Promise<StageOutcome> => {
      let synced = 0;
      let skipped = 0;
      let landed = 0;
      let alreadyLanded = 0;
      let corrected = 0;
      try {
        // Batch lookup: fetch all existing transactions for this item's accounts
        const accountIds = item.accounts.map(acc => acc.id);
        const existingTxns = await prisma.transactions.findMany({
          where: { accountId: { in: accountIds } },
          select: {
            transactionId: true,
            personal_finance_category: true,
            amount: true,
            name: true,
            date: true
          }
        });
        const existingMap = new Map(
          existingTxns.map(t => [t.transactionId, t])
        );

        let hasMore = true;
        let offset = 0;
        let page = 0;
        let pageFailure: StageFailed | null = null;

        while (hasMore) {
          page += 1;
          let response;
          try {
            response = await plaidClient.transactionsGet({
              access_token: decryptToken(item.accessToken),
              start_date: '2024-01-01',
              end_date: new Date().toISOString().split('T')[0],
              options: {
                offset: offset,
                count: 100,
                include_personal_finance_category: true
              }
            });
          } catch (askError) {
            // REBUILD-01 PR-2: a failed ask is evidence of the ask — the non-2xx answer's
            // exact bytes land (no arrivals) before the stage declares the failure.
            await recordFailedAnswer(prismaLanding(prisma as unknown as Prisma.TransactionClient), { userId: user.id, err: askError });
            throw askError;
          }
          // REBUILD-01 PR-2: the exact wire bytes ride the response (src/lib/plaid/wire.ts);
          // their absence is a fault, never a silent skip.
          const wire = wireOf(response, `transactionsGet page ${page}`);

          // Update balances (first iteration only)
          if (offset === 0 && response.data.accounts) {
            for (const plaidAccount of response.data.accounts) {
              const dbAccount = item.accounts.find(acc => acc.accountId === plaidAccount.account_id);
              if (dbAccount) {
                await prisma.accounts.update({
                  where: { id: dbAccount.id },
                  data: {
                    currentBalance: plaidAccount.balances.current || 0,
                    availableBalance: plaidAccount.balances.available || 0
                  }
                });
              }
            }
          }

          // REBUILD-01 PR-2: raw-first, in ONE database transaction per page —
          // provider_responses (the wire) → arrivals (one per object, promise 2 on
          // (provider, their_id)) → the existing parser, reading the ARRIVAL payloads →
          // transactions.arrival_id → read / status = done. A parser throw rolls this
          // page back; earlier pages stay landed; this item's stage declares the failure.
          // PERF-01: the batching domain binding — the parser's per-row intents replay as one
          // statement per kind inside the page's transaction (finish); one log line per page.
          let batch: ReturnType<typeof prismaDomain> | null = null;
          const pageStarted = Date.now();
          const result = await runTransactionsPage(
            prisma,
            (tx) => {
              batch = prismaDomain(tx as Prisma.TransactionClient);
              return { landing: prismaLanding(tx as Prisma.TransactionClient), domain: batch, finish: () => batch!.finish() };
            },
            {
              page,
              userId: user.id,
              connection: item.itemId,
              accounts: item.accounts.map((acc) => ({ id: acc.id, accountId: acc.accountId })),
              existing: existingMap,
              wire,
              httpStatus: response.status,
              transactions: response.data.transactions,
            },
          );
          const pageMs = Date.now() - pageStarted;
          const pageStats = batch ? (batch as ReturnType<typeof prismaDomain>).stats() : { intents: 0, statements: 0 };
          if (!result.ok) {
            pageFailure = result.failure;
            console.error(`Transactions stage failed for ${bankName(item.institutionName)} on page ${page} after ${pageMs}ms:`, result.failure.error);
            break;
          }
          console.log(`[sync] ${bankName(item.institutionName)} transactions page ${page}: ${response.data.transactions.length} objects, ${JSON.stringify(result.counts)}, ${pageStats.intents} domain intents → ${pageStats.statements} statements, ${pageMs}ms`);
          synced += result.counts.synced;
          skipped += result.counts.skipped;
          landed += result.counts.landed;
          alreadyLanded += result.counts.already_landed;
          corrected += result.counts.corrected;

          offset += response.data.transactions.length;
          hasMore = response.data.total_transactions > offset;

          if (!hasMore) {
            console.log(`Synced ${response.data.total_transactions} transactions for ${item.institutionName} (${skipped} skipped — already complete)`);
          }
        }
        // BANK-01: the item answered — a recorded ITEM_ERROR is over (a page failure is
        // local to us, not the item's state).
        if (item.last_error_code !== null) {
          await clearItemError(prisma, { itemRowId: item.id, userId: user.id });
        }
        if (pageFailure) return pageFailure;
        return stageOk('transactions', { synced, skipped, landed, already_landed: alreadyLanded, corrected });
      } catch (error) {
        const failure = await declareStageFailure('transactions', error, item);
        console.error(`Transactions stage failed for ${bankName(item.institutionName)}:`, failure.error);
        return failure;
      }
    };

    const syncInvestments = async (item: PlaidItem): Promise<StageOutcome> => {
      let synced = 0;
      let skipped = 0;
      let securities = 0;
      let landed = 0;
      let alreadyLanded = 0;
      let corrected = 0;
      try {
        // Batch lookup: fetch all existing investment transaction IDs for this item's accounts
        const accountIds = item.accounts.map(acc => acc.id);
        const existingInvTxns = await prisma.investment_transactions.findMany({
          where: { accountId: { in: accountIds } },
          select: { investment_transaction_id: true }
        });
        const existingInvSet = new Set(
          existingInvTxns.map(t => t.investment_transaction_id)
        );

        let offset = 0;
        let hasMore = true;
        let page = 0;
        let pageFailure: StageFailed | null = null;

        while (hasMore) {
          page += 1;
          let investResponse;
          try {
            investResponse = await plaidClient.investmentsTransactionsGet({
              access_token: decryptToken(item.accessToken),
              start_date: '2024-01-01',
              end_date: new Date().toISOString().split('T')[0],
              options: {
                offset: offset,
                count: 100
              }
            });
          } catch (askError) {
            // REBUILD-01 PR-2c: a failed ask is evidence of the ask — the non-2xx answer's
            // exact bytes land (no arrivals) before the stage declares the failure.
            await recordFailedAnswer(prismaLanding(prisma as unknown as Prisma.TransactionClient), { userId: user.id, err: askError, resource: INVESTMENT_TRANSACTION });
            throw askError;
          }
          const wire = wireOf(investResponse, `investmentsTransactionsGet page ${page}`);

          // REBUILD-01 PR-2c: raw-first, in ONE database transaction per page —
          // provider_responses (the wire) → arrivals (one per security, one per
          // investment transaction; promise 2 on (provider, their_id, fingerprint)) →
          // the existing parser, reading the ARRIVAL payloads → securities.arrival_id and
          // investment_transactions.arrival_id → read / status = done. A parser throw rolls
          // this page back; earlier pages stay; this item's stage declares the failure.
          // The batching domain binding replays the parser's per-row intents as one
          // statement per kind inside the page's transaction (finish); one log line per page.
          let batch: ReturnType<typeof prismaInvestmentsDomain> | null = null;
          const pageStarted = Date.now();
          const result = await runInvestmentsPage(
            prisma,
            (tx) => {
              batch = prismaInvestmentsDomain(tx as Prisma.TransactionClient);
              return { landing: prismaLanding(tx as Prisma.TransactionClient), domain: batch, finish: () => batch!.finish() };
            },
            {
              page,
              userId: user.id,
              connection: item.itemId,
              accounts: item.accounts.map((acc) => ({ id: acc.id, accountId: acc.accountId })),
              existing: existingInvSet,
              wire,
              httpStatus: investResponse.status,
              securities: investResponse.data.securities,
              investmentTransactions: investResponse.data.investment_transactions,
            },
          );
          const pageMs = Date.now() - pageStarted;
          const pageStats = batch ? (batch as ReturnType<typeof prismaInvestmentsDomain>).stats() : { intents: 0, statements: 0 };
          if (!result.ok) {
            pageFailure = result.failure;
            console.error(`Investments stage failed for ${bankName(item.institutionName)} on page ${page} after ${pageMs}ms:`, result.failure.error);
            break;
          }
          console.log(`[sync] ${bankName(item.institutionName)} investments page ${page}: ${investResponse.data.securities.length} securities + ${investResponse.data.investment_transactions.length} investment transactions, ${JSON.stringify(result.counts)}, ${pageStats.intents} domain intents → ${pageStats.statements} statements, ${pageMs}ms`);
          synced += result.counts.synced;
          skipped += result.counts.skipped;
          securities += result.counts.securities;
          landed += result.counts.landed;
          alreadyLanded += result.counts.already_landed;
          corrected += result.counts.corrected;

          offset += investResponse.data.investment_transactions.length;
          hasMore = investResponse.data.total_investment_transactions > offset;
        }
        if (pageFailure) return pageFailure;
        return stageOk('investments', { synced, skipped, securities, landed, already_landed: alreadyLanded, corrected });
      } catch (error) {
        const failure = await declareStageFailure('investments', error, item);
        console.error(`Investments stage failed for ${bankName(item.institutionName)}:`, failure.error);
        return failure;
      }
    };

    // REBUILD-01 PR-2d: the holdings stage — one /investments/holdings/get per item per
    // sync (the natural place: the item loop already runs every stage per item under
    // HYG-03's isolation). Raw-first in ONE transaction: the wire → arrivals (the
    // answer's securities, one per holding with a COMPOSED their_id —
    // holding:<account_id>:<security_id>:<as_of>, the as_of being the UTC date the
    // answer arrived — labeled composed, kind snapshot by the rule book) → the parser
    // reading the ARRIVAL payloads → holdings rows, one per account + security +
    // as_of (the same snapshot again is already_landed and writes nothing; a
    // position moved the same day is corrected; a new day is a new row) → read /
    // status = done. The batching binding replays the writes as one statement per
    // kind. /api/investments reads what this stores — Plaid is asked once.
    const syncHoldings = async (item: PlaidItem): Promise<StageOutcome> => {
      try {
        let holdingsResponse;
        try {
          holdingsResponse = await plaidClient.investmentsHoldingsGet({
            access_token: decryptToken(item.accessToken),
          });
        } catch (askError) {
          // A failed ask is evidence of the ask — the non-2xx answer's exact bytes land
          // (no arrivals) before the stage declares the failure.
          await recordFailedAnswer(prismaLanding(prisma as unknown as Prisma.TransactionClient), { userId: user.id, err: askError, resource: HOLDING });
          throw askError;
        }
        const wire = wireOf(holdingsResponse, 'investmentsHoldingsGet');

        let batch: ReturnType<typeof prismaHoldingsDomain> | null = null;
        const started = Date.now();
        const result = await runHoldingsPage(
          prisma,
          (tx) => {
            batch = prismaHoldingsDomain(tx as Prisma.TransactionClient);
            return { landing: prismaLanding(tx as Prisma.TransactionClient), domain: batch, finish: () => batch!.finish() };
          },
          {
            userId: user.id,
            connection: item.itemId,
            accounts: item.accounts.map((acc) => ({ id: acc.id, accountId: acc.accountId })),
            wire,
            httpStatus: holdingsResponse.status,
            securities: holdingsResponse.data.securities,
            holdings: holdingsResponse.data.holdings,
          },
        );
        const ms = Date.now() - started;
        const stats = batch ? (batch as ReturnType<typeof prismaHoldingsDomain>).stats() : { intents: 0, statements: 0 };
        if (!result.ok) {
          console.error(`Holdings stage failed for ${bankName(item.institutionName)} after ${ms}ms:`, result.failure.error);
          return result.failure;
        }
        console.log(`[sync] ${bankName(item.institutionName)} holdings as of ${result.asOf}: ${holdingsResponse.data.holdings.length} holdings + ${holdingsResponse.data.securities.length} securities, ${JSON.stringify(result.counts)}, ${stats.intents} domain intents → ${stats.statements} statements, ${ms}ms`);
        return stageOk('holdings', { ...result.counts });
      } catch (error) {
        const failure = await declareStageFailure('holdings', error, item);
        console.error(`Holdings stage failed for ${bankName(item.institutionName)}:`, failure.error);
        return failure;
      }
    };

    const items = await syncEachItem(
      plaidItems,
      (item) => { console.log(`Syncing ${item.institutionName || 'Bank'}...`); return bankName(item.institutionName); },
      [
        ['transactions', syncTransactions],
        ['investments', syncInvestments],
        ['holdings', syncHoldings],
      ],
    );
    // BANK-03: retired items ride the answer with no stages — the banner says "retired", never "failed".
    for (const r of retiredItems) items.push({ institution: bankName(r.institutionName), stages: [], retired: r.retired_reason ?? `retired ${r.retired_at?.toISOString() ?? ''}`.trim() });

    // The run's totals — summed over the stages that succeeded (a failed stage has no counts).
    const tx = sumStageCounts(items, 'transactions');
    const inv = sumStageCounts(items, 'investments');
    const hold = sumStageCounts(items, 'holdings');
    const allOk = items.every((i) => i.stages.every((s) => s.ok));
    const { status, body } = syncItemsEnvelope(items, {
      success: allOk,
      synced: {
        transactions: tx.synced ?? 0,
        investmentTransactions: inv.synced ?? 0,
        securities: inv.securities ?? 0,
        // REBUILD-01 PR-2d: holdings rows written this run (a snapshot already stored writes none).
        holdings: hold.holdings ?? 0
      },
      skipped: {
        transactions: tx.skipped ?? 0,
        investmentTransactions: inv.skipped ?? 0
      },
      // REBUILD-01 PR-2 / PR-2c / PR-2d: the store's counts for this run — all three phases.
      landed: {
        arrivals: (tx.landed ?? 0) + (inv.landed ?? 0) + (hold.landed ?? 0),
        already_landed: (tx.already_landed ?? 0) + (inv.already_landed ?? 0) + (hold.already_landed ?? 0),
        corrected: (tx.corrected ?? 0) + (inv.corrected ?? 0) + (hold.corrected ?? 0)
      }
    });
    return NextResponse.json(body, { status });
  } catch (error) {
    const { status, body } = failureEnvelope('sync', error);
    console.error('Complete sync error:', body.error);
    return NextResponse.json(body, { status });
  }
}
