import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { decryptToken } from '@/lib/secrets/tokenCipher';
import { failureEnvelope, stageFailed, stageOk, syncEnvelope, type StageFailed } from '@/lib/plaid/failLoud';
import { wireOf } from '@/lib/plaid/wire';
import { prismaLanding } from '@/lib/arrivals/prismaLanding';
import { recordFailedAnswer, runTransactionsPage, type DomainDb } from '@/lib/arrivals/plaidTransactionsPage';
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

    const plaidItems = await prisma.plaid_items.findMany({
      where: { userId: user.id },
      include: { accounts: true }
    });

    let totalTransactions = 0;
    let totalInvestmentTransactions = 0;
    let totalSecurities = 0;
    let skippedTransactions = 0;
    let skippedInvestmentTransactions = 0;
    // REBUILD-01 PR-2: the store's own counts — arrivals landed this run, and objects the
    // table already held (linked, not re-parsed; promise 2 working).
    let landedArrivals = 0;
    let alreadyLanded = 0;
    let correctedArrivals = 0;
    // HYG-01: STOP AND DECLARE. The first failure ends its stage for the whole run;
    // the outcome is declared in the response (200 / 207 / non-2xx), never hidden.
    let transactionsFailure: StageFailed | null = null;
    let investmentsFailure: StageFailed | null = null;

    for (const item of plaidItems) {
      console.log(`Syncing ${item.institutionName || 'Bank'}...`);

      // Sync regular transactions — skipped once this stage has declared a failure.
      if (!transactionsFailure) {
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
            // page back; earlier pages stay landed; the stage declares the failure.
            const result = await runTransactionsPage(
              prisma,
              (tx) => ({ landing: prismaLanding(tx as Prisma.TransactionClient), domain: tx as unknown as DomainDb }),
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
            if (!result.ok) {
              transactionsFailure = result.failure;
              console.error(`Transactions stage failed on page ${page}:`, result.failure.error);
              break;
            }
            totalTransactions += result.counts.synced;
            skippedTransactions += result.counts.skipped;
            landedArrivals += result.counts.landed;
            alreadyLanded += result.counts.already_landed;
            correctedArrivals += result.counts.corrected;

            offset += response.data.transactions.length;
            hasMore = response.data.total_transactions > offset;

            if (!hasMore) {
              console.log(`Synced ${response.data.total_transactions} transactions for ${item.institutionName} (${skippedTransactions} skipped — already complete)`);
            }
          }
        } catch (error) {
          transactionsFailure = stageFailed('transactions', error);
          console.error('Transactions stage failed:', transactionsFailure.error);
        }
      }

      // Sync investment transactions + securities — same rule.
      if (!investmentsFailure) {
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
              totalSecurities++;
            }

            // STORE INVESTMENT TRANSACTIONS
            for (const txn of investResponse.data.investment_transactions) {
              const account = item.accounts.find(acc => acc.accountId === txn.account_id);
              if (!account) continue;

              if (existingInvSet.has(txn.investment_transaction_id)) {
                // Already exists — the original update clause was empty anyway, skip
                skippedInvestmentTransactions++;
                totalInvestmentTransactions++;
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
              totalInvestmentTransactions++;
            }

            offset += investResponse.data.investment_transactions.length;
            hasMore = investResponse.data.total_investment_transactions > offset;
          }
        } catch (error) {
          investmentsFailure = stageFailed('investments', error);
          console.error('Investments stage failed:', investmentsFailure.error);
        }
      }
    }

    const stages = [
      transactionsFailure ?? stageOk('transactions', { synced: totalTransactions, skipped: skippedTransactions, landed: landedArrivals, already_landed: alreadyLanded, corrected: correctedArrivals }),
      investmentsFailure ?? stageOk('investments', { synced: totalInvestmentTransactions, skipped: skippedInvestmentTransactions, securities: totalSecurities }),
    ];
    const { status, body } = syncEnvelope(stages, {
      success: !transactionsFailure && !investmentsFailure,
      synced: {
        transactions: totalTransactions,
        investmentTransactions: totalInvestmentTransactions,
        securities: totalSecurities
      },
      skipped: {
        transactions: skippedTransactions,
        investmentTransactions: skippedInvestmentTransactions
      },
      // REBUILD-01 PR-2: the store's counts for this run.
      landed: { arrivals: landedArrivals, already_landed: alreadyLanded, corrected: correctedArrivals }
    });
    return NextResponse.json(body, { status });
  } catch (error) {
    const { status, body } = failureEnvelope('sync', error);
    console.error('Complete sync error:', body.error);
    return NextResponse.json(body, { status });
  }
}
