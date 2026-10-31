import { Prisma, PrismaClient, journal_entries } from '@prisma/client';
import { ValidationError } from '@/lib/errors/ValidationError';
import { assertPeriodOpen } from '@/lib/period-close-guard';
import { balanceDeltaOf, postJournal } from '@/lib/posting/postJournal';
import type { PostingDocument } from '@/lib/posting/documentGate';

export type CommitResult = journal_entries & { alreadyExisted?: boolean };
export type { PostingDocument } from '@/lib/posting/documentGate';

/**
 * POST-01 (2026-09-26): the words for a second posted charge of one booking — the
 * partial unique journal_entries_document_charge_key refuses it in SQL; this names
 * it, before the write and on the P2002 a race leaves. Never a 500.
 */
function chargeAlreadyPostedMessage(reservationId: string, holderId: string): string {
  return `POST-01 this booking already has a posted charge entry ${holderId} — booking ${reservationId} documents one posted charge; uncommit that entry first if this bank row is the charge`;
}

/** P2002 on the one-posted-charge index: Prisma names the index or its column in meta.target (or the message). */
function isDocumentChargeUniqueError(err: unknown): boolean {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== 'P2002') return false;
  const target = err.meta?.target;
  const asText = Array.isArray(target) ? target.join(',') : typeof target === 'string' ? target : '';
  return asText.includes('document_reservation_id') || asText.includes('journal_entries_document_charge_key') || err.message.includes('journal_entries_document_charge_key');
}

/** DIM-3: one PRE-VALIDATED allocation link (the route owns validation —
 *  exactly-one target, owned by the user, 2-decimal percent, sum === 100). */
export interface CommitLink {
  project_id?: string;
  routine_id?: string;
  trip_id?: string;
  module_key?: string;
  percent: number;
}

interface CommitPlaidTransactionParams {
  userId: string;
  entityId: string;
  bankEntityId?: string;
  transactionId: string;
  accountCode: string;
  bankAccountCode: string;
  date: Date;
  amount: number; // Plaid amount in dollars (Float)
  description: string;
  merchantName?: string;
  requestId?: string;
  createdBy?: string;
  /** DIM-3: journal_entries.vendor_id — validated user-owned by the caller. */
  vendorId?: string;
  /** DIM-3: allocation links for the EXPENSE-SIDE line — pre-validated. */
  links?: CommitLink[];
  /**
   * POST-01: THE DOCUMENT — the booking this posting is the charge (moneyEventId
   * null) or refund (moneyEventId set) of. Pre-validated by the route's gate
   * (src/lib/posting/documentGate.ts) from an ACCEPTED transaction_reservation_link;
   * absent = a posting of no booking. The document never chooses the account.
   */
  document?: PostingDocument;
}

interface ReversePlaidTransactionParams {
  userId: string;
  journalEntryId: string;
  transactionId: string;
  requestId?: string;
  createdBy?: string;
}

function dollarsToCents(amount: number): bigint {
  return BigInt(Math.round(amount * 100));
}

/**
 * HYG-04: both writers post through postJournal — SET CONSTRAINTS ALL
 * IMMEDIATE first, the lines in one statement, the entry id read back after
 * commit. The guards (idempotency, period close, account lookups) and the
 * follow-up writes (links, the transaction's status) run inside the same
 * transaction, exactly where they ran before.
 *
 * POST-01 (2026-09-26): THIS IS THE ONE WRITER OF A POSTING'S DOCUMENT. The
 * accepted link's booking rides onto the entry as document_reservation_id (and its
 * money event, a refund, as document_money_event_id) inside the same transaction —
 * the DIM-3 posture: born with the entry or not at all. A charge: the user's
 * account stands, one posted charge per booking (named before the write, and on the
 * P2002 a race leaves). A refund: an inflow, only against the POSTED charge's own
 * account — DR bank / CR that account, derived from the charge entry's debit line,
 * never taken from the caller. No posted charge → refused by name. No fallback:
 * nothing here defaults a document or picks an account for one.
 */
export async function commitPlaidTransaction(
  prisma: PrismaClient,
  params: CommitPlaidTransactionParams
): Promise<CommitResult> {
  const {
    userId,
    entityId,
    bankEntityId,
    transactionId,
    accountCode,
    bankAccountCode,
    date,
    amount,
    description,
    requestId,
    createdBy,
    vendorId,
    links,
    document,
  } = params;

  // MATCH-02 (2026-09-26): a CHARGE document on an INFLOW is refused by name BEFORE
  // any lookup — POST-01's open finding, closed. A booking's charge is money that
  // left the account; money that came in documents a REFUND money event (a link
  // carrying moneyEventId), never a charge. Nothing is read before this refusal.
  if (document && document.moneyEventId === null && amount < 0) {
    throw new ValidationError(
      `MATCH-02 a charge document needs an outflow: transaction ${transactionId} has Plaid amount ${amount} (money came in), so it cannot document the charge of booking ${document.reservationId} — an inflow documents a refund money event, never a charge`
    );
  }

  let posted: { result: CommitResult };
  try {
    posted = await postJournal(prisma, async (tx, post): Promise<CommitResult> => {
      // ═══════════════════════════════════════════════════════════════════
      // IDEMPOTENCY GUARD — Prevent duplicate JEs on retry
      // If a JE with this request_id already exists, return it immediately.
      // ═══════════════════════════════════════════════════════════════════
      if (requestId) {
        const existing = await tx.journal_entries.findFirst({
          where: { request_id: requestId, userId },
        });
        if (existing) {
          return Object.assign(existing, { alreadyExisted: true });
        }
      }

      // Period close enforcement — reject if target period is closed
      await assertPeriodOpen(tx, userId, entityId, date);

      // ─── POST-01: THE DOCUMENT, resolved before any account is looked up ─────
      // A charge (moneyEventId null): one posted charge per booking — the partial
      // unique journal_entries_document_charge_key in SQL, named here first.
      // A refund (moneyEventId set): the Plaid amount must be an INFLOW (< 0); the
      // money event must be this booking's and a refund; the booking's charge must be
      // POSTED (document_reservation_id = the booking, no money event, status
      // 'posted') — else "the charge is not posted; post it first"; the account is
      // the charge entry's DEBIT line's account, and a caller's accountCode that
      // differs is refused by name.
      let refundAgainst: { chargeEntryId: string; account: { id: string; code: string; balance_type: string } } | null = null;
      if (document) {
        if (document.moneyEventId === null) {
          const holder = await tx.journal_entries.findFirst({
            where: { document_reservation_id: document.reservationId, document_money_event_id: null, status: 'posted' },
            select: { id: true },
          });
          if (holder) throw new ValidationError(chargeAlreadyPostedMessage(document.reservationId, holder.id), { status: 409 });
        } else {
          if (!(amount < 0)) {
            throw new ValidationError(
              `POST-01 a refund is money that came back: transaction ${transactionId} has Plaid amount ${amount} (money left the account), so it cannot document refund ${document.moneyEventId} of booking ${document.reservationId}`
            );
          }
          const event = await tx.money_events.findFirst({
            where: { id: document.moneyEventId, reservationId: document.reservationId },
            select: { id: true, kind: true },
          });
          if (!event) {
            throw new ValidationError(`POST-01 money event ${document.moneyEventId} is not a money event of booking ${document.reservationId}`, { status: 404 });
          }
          if (event.kind !== 'refund') {
            throw new ValidationError(`POST-01 money event ${document.moneyEventId} is a ${event.kind}, not a refund — only a refund documents an inflow`);
          }
          const charge = await tx.journal_entries.findFirst({
            where: { userId, document_reservation_id: document.reservationId, document_money_event_id: null, status: 'posted' },
            select: { id: true, ledger_entries: { select: { entry_type: true, account: { select: { id: true, code: true, balance_type: true } } } } },
          });
          if (!charge) {
            throw new ValidationError(
              `POST-01 the charge is not posted; post it first — booking ${document.reservationId} has no posted charge entry, so refund ${document.moneyEventId} has no account to post against`
            );
          }
          const debitLine = charge.ledger_entries.find((l) => l.entry_type === 'D');
          if (!debitLine) throw new ValidationError(`POST-01 charge entry ${charge.id} of booking ${document.reservationId} has no debit line to derive the account from`);
          if (accountCode !== debitLine.account.code) {
            throw new ValidationError(
              `POST-01 a refund posts against the charge's own account ${debitLine.account.code} (entry ${charge.id}), not ${accountCode} — the account of a refund is derived from the posted charge, never chosen`
            );
          }
          refundAgainst = { chargeEntryId: charge.id, account: debitLine.account };
        }
      }

      // Look up expense/income COA account — the user's pick. POST-01: for a refund,
      // the posted charge's own account row, derived above; no lookup by code.
      const expenseOrIncomeAccount = refundAgainst
        ? refundAgainst.account
        : await tx.chart_of_accounts.findUnique({
            where: {
              userId_entity_id_code: { userId, entity_id: entityId, code: accountCode },
            },
          });
      if (!expenseOrIncomeAccount) {
        throw new ValidationError(
          `COA account not found: code=${accountCode}, entityId=${entityId}, userId=${userId}`
        );
      }

      // Look up bank COA account — use bankEntityId (the bank account's entity)
      // which may differ from entityId (the expense COA's entity) in cross-entity
      // categorization scenarios (e.g., personal bank pays business expense).
      const resolvedBankEntityId = bankEntityId || entityId;
      const bankAccount = await tx.chart_of_accounts.findUnique({
        where: {
          userId_entity_id_code: { userId, entity_id: resolvedBankEntityId, code: bankAccountCode },
        },
      });
      if (!bankAccount) {
        throw new ValidationError(
          `Bank COA account not found: code=${bankAccountCode}, entityId=${resolvedBankEntityId}, userId=${userId}`
        );
      }

      const amountCents = dollarsToCents(Math.abs(amount));
      const isExpense = amount > 0;
      // Plaid positive = money left account = EXPENSE: DR expense, CR bank
      // Plaid negative = money entered account = INCOME: DR bank, CR income/revenue
      // POST-01: a refund is a negative amount against the charge's account — the
      // same rule gives DR bank / CR that account, nothing special-cased.

      const debitAccount = isExpense ? expenseOrIncomeAccount : bankAccount;
      const creditAccount = isExpense ? bankAccount : expenseOrIncomeAccount;

      // Create the journal entry — one debit line, one credit line, the balance
      // moves by the rule every writer uses.
      // DIM-3: vendor_id is born WITH the entry (null = dimensionless, the
      // legacy-epoch semantic — never backfilled, never imputed).
      // POST-01: the document is born WITH the entry the same way — source_type
      // stays 'plaid_txn' and source_id the transaction; the booking is what the
      // posting documents, never what it is.
      const entry = await post({
        entry: {
          userId,
          entity_id: entityId,
          date,
          description,
          source_type: 'plaid_txn',
          source_id: transactionId,
          status: 'posted',
          request_id: requestId ?? null,
          created_by: createdBy || null,
          vendor_id: vendorId || null,
          document_reservation_id: document ? document.reservationId : null,
          document_money_event_id: document ? document.moneyEventId : null,
        },
        lines: [
          { account_id: debitAccount.id, entry_type: 'D', amount: amountCents, balanceDelta: balanceDeltaOf('D', debitAccount.balance_type, amountCents), created_by: createdBy || null },
          { account_id: creditAccount.id, entry_type: 'C', amount: amountCents, balanceDelta: balanceDeltaOf('C', creditAccount.balance_type, amountCents), created_by: createdBy || null },
        ],
      });

      // ─── DIM-3: allocation links on the EXPENSE-SIDE line ────────────────────
      // The entry has exactly ONE D + ONE C line; the categorized
      // (expense/income) account rides the DEBIT when the Plaid amount is
      // positive (expense) and the CREDIT when negative (income) — so the
      // links' line is always unambiguously identifiable. Created INSIDE this
      // transaction: a link-write failure (including the DIM-1 CHECK/partial-
      // unique constraints) rolls back the WHOLE entry, loudly — the entry's
      // atomicity is sacred; dimensions are born with it or not at all.
      if (links && links.length > 0) {
        const expenseSideEntryId = isExpense ? entry.lineIds[0] : entry.lineIds[1];
        await tx.ledger_line_links.createMany({
          data: links.map((l) => ({
            ledger_entry_id: expenseSideEntryId,
            project_id: l.project_id ?? null,
            routine_id: l.routine_id ?? null,
            trip_id: l.trip_id ?? null,
            module_key: l.module_key ?? null,
            percent: l.percent,
            created_by: createdBy || null,
          })),
        });
      }

      // Update transaction status
      await tx.transactions.update({
        where: { transactionId },
        data: {
          accountCode: accountCode,
          review_status: 'committed',
        },
      });

      return tx.journal_entries.findUniqueOrThrow({ where: { id: entry.id } });
    });
  } catch (err) {
    // POST-01: a second posted charge for the booking that slipped past the check
    // above (a race) is refused by the database; it is named here, never a 500. The
    // holder is re-read outside the rolled-back transaction.
    if (document && document.moneyEventId === null && isDocumentChargeUniqueError(err)) {
      const holder = await prisma.journal_entries.findFirst({
        where: { document_reservation_id: document.reservationId, document_money_event_id: null, status: 'posted' },
        select: { id: true },
      });
      throw new ValidationError(
        holder
          ? chargeAlreadyPostedMessage(document.reservationId, holder.id)
          : `POST-01 the database refused a second posted charge for booking ${document.reservationId} (journal_entries_document_charge_key), and the entry holding it was not found on re-read — nothing was posted`,
        { status: 409 }
      );
    }
    throw err;
  }

  return posted.result;
}

export async function reversePlaidTransaction(
  prisma: PrismaClient,
  params: ReversePlaidTransactionParams
) {
  const { userId, journalEntryId, transactionId, requestId, createdBy } = params;

  const { result } = await postJournal(prisma, async (tx, post) => {
    // Look up original journal entry with its ledger entries and linked accounts
    const original = await tx.journal_entries.findUnique({
      where: { id: journalEntryId },
      include: {
        ledger_entries: {
          include: {
            account: { select: { id: true, balance_type: true, code: true } },
          },
        },
      },
    });

    if (!original) {
      throw new ValidationError(`Journal entry not found: ${journalEntryId}`, { status: 404 });
    }

    if (original.userId !== userId) {
      throw new Error('Journal entry does not belong to this user');
    }

    if (original.reversed_by_entry_id) {
      throw new ValidationError('Journal entry has already been reversed');
    }

    if (original.is_reversal) {
      throw new ValidationError('Cannot reverse a reversal entry');
    }

    // Period close enforcement — reversals are dated today
    const reversalDate = new Date();
    await assertPeriodOpen(tx, userId, original.entity_id, reversalDate);

    // Create the reversal: the opposite line for every original line, the
    // balances moved back by the same rule.
    // POST-01: the reversal carries NO document — document_reservation_id and
    // document_money_event_id stay NULL on it (the port's default); the original
    // keeps its own. The original's status moves to 'reversed', which takes it
    // out of the one-posted-charge index, so a re-commit posts the charge again.
    const reversal = await post({
      entry: {
        userId,
        entity_id: original.entity_id,
        date: reversalDate,
        description: `REVERSAL: ${original.description}`,
        source_type: 'reversal',
        source_id: null,
        status: 'posted',
        is_reversal: true,
        reverses_entry_id: original.id,
        request_id: requestId ?? null,
        created_by: createdBy || null,
      },
      lines: original.ledger_entries.map((entry) => {
        const oppositeType: 'D' | 'C' = entry.entry_type === 'D' ? 'C' : 'D';
        return {
          account_id: entry.account_id,
          entry_type: oppositeType,
          amount: entry.amount,
          balanceDelta: balanceDeltaOf(oppositeType, entry.account.balance_type, entry.amount),
          created_by: createdBy || null,
        };
      }),
    });

    // Mark original as reversed
    await tx.journal_entries.update({
      where: { id: original.id },
      data: {
        status: 'reversed',
        reversed_by_entry_id: reversal.id,
      },
    });

    // Reset transaction
    await tx.transactions.update({
      where: { transactionId },
      data: {
        accountCode: null,
        review_status: 'pending_review',
      },
    });

    return { originalId: original.id, reversalId: reversal.id };
  });

  return result;
}
