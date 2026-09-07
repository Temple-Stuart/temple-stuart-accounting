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

        while (hasMore) {
          const investResponse = await plaidClient.investmentsTransactionsGet({
            access_token: decryptToken(item.accessToken),
            start_date: '2024-01-01',
            end_date: new Date().toISOString().split('T')[0],
            options: {
              offset: offset,
              count: 100
            }
          });

          // STORE SECURITIES DATA (includes option contract details)
          for (const security of investResponse.data.securities) {
            const optionContract = (security as any).option_contract;

            await prisma.securities.upsert({
              where: { securityId: security.security_id },
              create: {
                securityId: security.security_id,
                isin: security.isin,
                cusip: security.cusip,
                sedol: security.sedol,
                ticker_symbol: security.ticker_symbol,
                name: security.name,
                type: security.type,
                close_price: security.close_price,
                close_price_as_of: security.close_price_as_of ? new Date(security.close_price_as_of) : null,
                option_contract_type: optionContract?.contract_type || null,
                option_strike_price: optionContract?.strike_price || null,
                option_expiration_date: optionContract?.expiration_date ? new Date(optionContract.expiration_date) : null,
                option_underlying_ticker: optionContract?.underlying_security_ticker || null,
                id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                updatedAt: new Date()
              },
              update: {
                close_price: security.close_price,
                close_price_as_of: security.close_price_as_of ? new Date(security.close_price_as_of) : null,
                option_contract_type: optionContract?.contract_type || null,
                option_strike_price: optionContract?.strike_price || null,
                option_expiration_date: optionContract?.expiration_date ? new Date(optionContract.expiration_date) : null,
                option_underlying_ticker: optionContract?.underlying_security_ticker || null
              }
            });
            securities++;
          }

          // STORE INVESTMENT TRANSACTIONS
          for (const txn of investResponse.data.investment_transactions) {
            const account = item.accounts.find(acc => acc.accountId === txn.account_id);
            if (!account) continue;

            if (existingInvSet.has(txn.investment_transaction_id)) {
              // Already exists — the original update clause was empty anyway, skip
              skipped++;
              synced++;
              continue;
            }

            await prisma.investment_transactions.create({
              data: {
                id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                investment_transaction_id: txn.investment_transaction_id,
                accountId: account.id,
                amount: txn.amount,
                cancel_transaction_id: txn.cancel_transaction_id,
                date: new Date(txn.date),
                fees: txn.fees,
                iso_currency_code: txn.iso_currency_code,
                name: txn.name,
                price: txn.price,
                quantity: txn.quantity,
                security_id: txn.security_id,
                subtype: txn.subtype,
                type: txn.type,
                unofficial_currency_code: txn.unofficial_currency_code,
                updatedAt: new Date()
              }
            });
            synced++;
          }

          offset += investResponse.data.investment_transactions.length;
          hasMore = investResponse.data.total_investment_transactions > offset;
        }
        return stageOk('investments', { synced, skipped, securities });
      } catch (error) {
        const failure = await declareStageFailure('investments', error, item);
        console.error(`Investments stage failed for ${bankName(item.institutionName)}:`, failure.error);
        return failure;
      }
    };

    const items = await syncEachItem(
      plaidItems,
      (item) => { console.log(`Syncing ${item.institutionName || 'Bank'}...`); return bankName(item.institutionName); },
      [
        ['transactions', syncTransactions],
        ['investments', syncInvestments],
      ],
    );
    // BANK-03: retired items ride the answer with no stages — the banner says "retired", never "failed".
    for (const r of retiredItems) items.push({ institution: bankName(r.institutionName), stages: [], retired: r.retired_reason ?? `retired ${r.retired_at?.toISOString() ?? ''}`.trim() });

    // The run's totals — summed over the stages that succeeded (a failed stage has no counts).
    const tx = sumStageCounts(items, 'transactions');
    const inv = sumStageCounts(items, 'investments');
    const allOk = items.every((i) => i.stages.every((s) => s.ok));
    const { status, body } = syncItemsEnvelope(items, {
      success: allOk,
      synced: {
        transactions: tx.synced ?? 0,
        investmentTransactions: inv.synced ?? 0,
        securities: inv.securities ?? 0
      },
      skipped: {
        transactions: tx.skipped ?? 0,
        investmentTransactions: inv.skipped ?? 0
      },
      // REBUILD-01 PR-2: the store's counts for this run.
      landed: { arrivals: tx.landed ?? 0, already_landed: tx.already_landed ?? 0, corrected: tx.corrected ?? 0 }
    });
    return NextResponse.json(body, { status });
  } catch (error) {
    const { status, body } = failureEnvelope('sync', error);
    console.error('Complete sync error:', body.error);
    return NextResponse.json(body, { status });
  }
}
