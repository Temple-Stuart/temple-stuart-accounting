import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { decryptToken } from '@/lib/secrets/tokenCipher';
import { failureEnvelope, stageFailed, stageOk, sumStageCounts, syncItemsEnvelope, type StageFailed, type StageOutcome } from '@/lib/plaid/failLoud';
// SYNC-01: the run — the paging loop, the walk over items and stages with its resume point, the request's budget and
// the 202 — is written once, pure, in src/lib/plaid/syncRun.ts. This route binds Prisma and Plaid into its ports.
import { SYNC_PAGE_SIZE, askOnce, linkLabels, moreEnvelope, pagedStage, readResume, runBudget, unheldNotes, walkItems, type PageAnswer, type PagedPorts } from '@/lib/plaid/syncRun';
import { summarizePlaidError } from '@/lib/plaid/summarizeError';
import { bankName, clearItemError, isItemError, itemFailure, recordItemError } from '@/lib/plaid/reconnect';
import { wireOf, type WireStamp } from '@/lib/plaid/wire';
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

export async function POST(request: Request) {
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
      select: { id: true, institutionName: true, retired_reason: true, retired_at: true },
      orderBy: [{ institutionName: 'asc' }, { id: 'asc' }],
    });
    type PlaidItem = (typeof plaidItems)[number];

    // SYNC-01: THE RUN CONTINUES ACROSS REQUESTS. A request with no body is a fresh run. A request whose body is
    // { resume: <the `more` of the last answer> } continues exactly there. The point is read here — AFTER the three
    // gates — and checked whole against the caller's own live links from the read above: a foreign or unknown link is
    // the defensive 404 (it confirms nothing), anything else malformed a 400. Nothing is asked twice: one run, cut
    // into requests — never a retry.
    const resumeRead = readResume(await request.text(), plaidItems.map((link) => link.id));
    if (!resumeRead.ok) return NextResponse.json(resumeRead.body, { status: resumeRead.status });
    const resume = resumeRead.resume;
    // The request's clock: after SYNC_BUDGET_MS the run stops BEFORE the next Plaid ask and answers 202.
    const budget = runBudget(() => Date.now());
    // SYNC-01: every link has ONE name in the run — the bank's, or the bank's and the day it was linked when two
    // live links carry the same name. It is the outcome's institution, the name in a failure and in the progress line.
    const labelOf = linkLabels(plaidItems.map((link) => ({ id: link.id, name: bankName(link.institutionName), linked: link.createdAt.toISOString().slice(0, 10) })));

    // BANK-01: a Plaid ITEM_ERROR (ITEM_LOGIN_REQUIRED and its kin) is the ITEM's state, not
    // a one-off fault — record its code on the item (user-scoped) and name the INSTITUTION in
    // the declared failure; never the Plaid item id, never a token. Any other error is
    // declared as before.
    const declareStageFailure = async (stage: string, error: unknown, item: { id: string }): Promise<StageFailed> => {
      const summary = summarizePlaidError(error);
      if (isItemError(summary)) {
        await recordItemError(prisma, { itemRowId: item.id, userId: user.id, code: summary.error_code ?? 'ITEM_ERROR', at: new Date() });
        return itemFailure(stage, labelOf(item.id), error);
      }
      return stageFailed(stage, error);
    };

    // HYG-03: ONE BANK'S FAILURE NEVER BLOCKS ANOTHER. Each item runs every stage and
    // declares its own outcome per stage (ok with counts | failed with the named bank and
    // the summarized Plaid error). Nothing about item A decides whether item B runs.
    // Inside one item a page failure still ends that item's stage and rolls that page
    // back (PR-2, unchanged).

    // ── transactions: the ports of the paged loop (src/lib/plaid/syncRun.ts pagedStage) ──
    type TransactionsAnswer = PageAnswer & { response: Awaited<ReturnType<typeof plaidClient.transactionsGet>>; wire: WireStamp };
    const syncTransactions = (item: PlaidItem): PagedPorts<TransactionsAnswer> => {
      const label = labelOf(item.id);
      const accountIds = item.accounts.map(acc => acc.id);
      // Batch lookup: fetch all existing transactions for this item's accounts — once per request, before its first ask.
      const loadExisting = async () => {
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
        return new Map(
          existingTxns.map(t => [t.transactionId, t])
        );
      };
      let lookup: ReturnType<typeof loadExisting> | null = null;
      const existingMap = () => (lookup ??= loadExisting());
      return {
        stage: 'transactions',
        ask: async (offset, page) => {
          await existingMap();
          let response;
          try {
            response = await plaidClient.transactionsGet({
              access_token: decryptToken(item.accessToken),
              start_date: '2024-01-01',
              end_date: new Date().toISOString().split('T')[0],
              options: {
                offset: offset,
                // SYNC-02: 250 a page — Plaid allows up to 500 (its default is 100), but one stored answer may hold 1,048,576 bytes and a 500-row page crossed that (the note on SYNC_PAGE_SIZE, src/lib/plaid/syncRun.ts).
                count: SYNC_PAGE_SIZE,
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
          return { objects: response.data.transactions.length, total: response.data.total_transactions, response, wire };
        },
        first: async ({ response }) => {
          // Update balances (the answer at offset 0 only) — of the account rows this link already holds.
          if (response.data.accounts) {
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
        },
        land: async ({ response, wire }, page) => {
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
              existing: await existingMap(),
              wire,
              httpStatus: response.status,
              transactions: response.data.transactions,
            },
          );
          const pageMs = Date.now() - pageStarted;
          const pageStats = batch ? (batch as ReturnType<typeof prismaDomain>).stats() : { intents: 0, statements: 0 };
          if (!result.ok) {
            console.error(`Transactions stage failed for ${label} on page ${page} after ${pageMs}ms:`, result.failure.error);
            return { ok: false, failure: result.failure };
          }
          console.log(`[sync] ${label} transactions page ${page}: ${response.data.transactions.length} objects, ${JSON.stringify(result.counts)}, ${pageStats.intents} domain intents → ${pageStats.statements} statements, ${pageMs}ms`);
          return { ok: true, counts: { ...result.counts } };
        },
        answered: async () => {
          // BANK-01: the item answered — a recorded ITEM_ERROR is over (a page failure is
          // local to us, not the item's state).
          if (item.last_error_code !== null) {
            await clearItemError(prisma, { itemRowId: item.id, userId: user.id });
          }
        },
        // SYNC-01: the newest date the app now holds for this link's accounts — read once, when the stage completes.
        through: async () => {
          const newest = await prisma.transactions.aggregate({ where: { accountId: { in: accountIds } }, _max: { date: true } });
          return newest._max.date === null ? null : newest._max.date.toISOString().slice(0, 10);
        },
        // SYNC-01: an account Plaid lists under this link that the app holds no row for is NAMED — no row is created here.
        notes: ({ response }) => unheldNotes(response.data.accounts, item.accounts.map((acc) => acc.accountId)),
        declare: async (error) => {
          const failure = await declareStageFailure('transactions', error, item);
          console.error(`Transactions stage failed for ${label}:`, failure.error);
          return failure;
        },
      };
    };

    // ── investments: the same loop, its own ports ──
    type InvestmentsAnswer = PageAnswer & { response: Awaited<ReturnType<typeof plaidClient.investmentsTransactionsGet>>; wire: WireStamp };
    const syncInvestments = (item: PlaidItem): PagedPorts<InvestmentsAnswer> => {
      const label = labelOf(item.id);
      const accountIds = item.accounts.map(acc => acc.id);
      // Batch lookup: fetch all existing investment transaction IDs for this item's accounts — once per request, before its first ask.
      const loadExisting = async () => {
        const existingInvTxns = await prisma.investment_transactions.findMany({
          where: { accountId: { in: accountIds } },
          select: { investment_transaction_id: true }
        });
        return new Set(
          existingInvTxns.map(t => t.investment_transaction_id)
        );
      };
      let lookup: ReturnType<typeof loadExisting> | null = null;
      const existingInvSet = () => (lookup ??= loadExisting());
      return {
        stage: 'investments',
        ask: async (offset, page) => {
          await existingInvSet();
          let investResponse;
          try {
            investResponse = await plaidClient.investmentsTransactionsGet({
              access_token: decryptToken(item.accessToken),
              start_date: '2024-01-01',
              end_date: new Date().toISOString().split('T')[0],
              options: {
                offset: offset,
                // SYNC-02: 250 a page — Plaid allows up to 500 (its default is 100), but one stored answer may hold 1,048,576 bytes and a 500-row page crossed that (the note on SYNC_PAGE_SIZE, src/lib/plaid/syncRun.ts).
                count: SYNC_PAGE_SIZE
              }
            });
          } catch (askError) {
            // REBUILD-01 PR-2c: a failed ask is evidence of the ask — the non-2xx answer's
            // exact bytes land (no arrivals) before the stage declares the failure.
            await recordFailedAnswer(prismaLanding(prisma as unknown as Prisma.TransactionClient), { userId: user.id, err: askError, resource: INVESTMENT_TRANSACTION });
            throw askError;
          }
          const wire = wireOf(investResponse, `investmentsTransactionsGet page ${page}`);
          return { objects: investResponse.data.investment_transactions.length, total: investResponse.data.total_investment_transactions, response: investResponse, wire };
        },
        land: async ({ response: investResponse, wire }, page) => {
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
              existing: await existingInvSet(),
              wire,
              httpStatus: investResponse.status,
              securities: investResponse.data.securities,
              investmentTransactions: investResponse.data.investment_transactions,
            },
          );
          const pageMs = Date.now() - pageStarted;
          const pageStats = batch ? (batch as ReturnType<typeof prismaInvestmentsDomain>).stats() : { intents: 0, statements: 0 };
          if (!result.ok) {
            console.error(`Investments stage failed for ${label} on page ${page} after ${pageMs}ms:`, result.failure.error);
            return { ok: false, failure: result.failure };
          }
          console.log(`[sync] ${label} investments page ${page}: ${investResponse.data.securities.length} securities + ${investResponse.data.investment_transactions.length} investment transactions, ${JSON.stringify(result.counts)}, ${pageStats.intents} domain intents → ${pageStats.statements} statements, ${pageMs}ms`);
          return { ok: true, counts: { ...result.counts } };
        },
        // SYNC-01: the newest date the app now holds for this link's accounts — read once, when the stage completes.
        through: async () => {
          const newest = await prisma.investment_transactions.aggregate({ where: { accountId: { in: accountIds } }, _max: { date: true } });
          return newest._max.date === null ? null : newest._max.date.toISOString().slice(0, 10);
        },
        declare: async (error) => {
          const failure = await declareStageFailure('investments', error, item);
          console.error(`Investments stage failed for ${label}:`, failure.error);
          return failure;
        },
      };
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
      const label = labelOf(item.id);
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
          console.error(`Holdings stage failed for ${label} after ${ms}ms:`, result.failure.error);
          return result.failure;
        }
        console.log(`[sync] ${label} holdings as of ${result.asOf}: ${holdingsResponse.data.holdings.length} holdings + ${holdingsResponse.data.securities.length} securities, ${JSON.stringify(result.counts)}, ${stats.intents} domain intents → ${stats.statements} statements, ${ms}ms`);
        return stageOk('holdings', { ...result.counts });
      } catch (error) {
        const failure = await declareStageFailure('holdings', error, item);
        console.error(`Holdings stage failed for ${label}:`, failure.error);
        return failure;
      }
    };

    // SYNC-01: THE ONE WALKER (src/lib/plaid/syncRun.ts walkItems) — every live link, every stage, in the order read
    // above; from the resume point when there is one, and never an earlier link or stage.
    const walked = await walkItems<PlaidItem>({
      items: plaidItems,
      key: (item) => item.id,
      label: (item) => labelOf(item.id),
      // A link that holds no accounts in this app has no row its objects could be written to: it is not asked.
      idle: (item) => item.accounts.length === 0,
      stages: [
        ['transactions', (item, from, clock) => pagedStage(syncTransactions(item), from, clock)],
        ['investments', (item, from, clock) => pagedStage(syncInvestments(item), from, clock)],
        ['holdings', (item, _from, clock) => askOnce(clock, () => syncHoldings(item))],
      ],
      resume,
      budget,
    });
    // One log line per request: where it started, where it stopped, asks made, ms.
    console.log(`[sync] request: ${resume === null ? 'a fresh run' : `resumed at ${labelOf(resume.item)} ${resume.stage} ${resume.offset}`} → ${walked.more === null ? 'finished' : `stopped before ${labelOf(walked.more.item)} ${walked.more.stage} ${walked.more.offset}`}; ${budget.asks()} asks; ${budget.elapsedMs()}ms`);

    // SYNC-01: the budget is spent and the run is not done — 202 with the point to continue from. The retired links
    // ride the final answer only.
    if (walked.more !== null) {
      const { status, body } = moreEnvelope(walked.more, walked.items, walked.progress);
      return NextResponse.json(body, { status });
    }

    const items = walked.items;
    // BANK-03: retired items ride the answer with no stages — the banner says "retired", never "failed".
    for (const r of retiredItems) items.push({ institution: bankName(r.institutionName), key: r.id, stages: [], retired: r.retired_reason ?? `retired ${r.retired_at?.toISOString() ?? ''}`.trim() });

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
