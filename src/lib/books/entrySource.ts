/**
 * DRILL-01 (2026-09-23) — WHERE AN ENTRY CAME FROM, in the customer's words.
 *
 * THE FINDING THIS CLOSES. Every posted journal entry is born carrying a pointer
 * to what produced it — src/lib/journal-entry-service.ts:138-139 writes
 * `source_type: 'plaid_txn'` and `source_id: <the bank transaction's id>`, and
 * :236-237 writes `source_type: 'reversal'` with a null id. The columns are on
 * the table (prisma/schema.prisma:192-193: `source_type String @db.VarChar(20)`,
 * NOT NULL, and `source_id String?`), they are INDEXED together (:217), they are
 * IMMUTABLE after posting (the SOC 2 trigger at
 * prisma/migrations/20260227000100_protect_journal_entries/migration.sql:16-17
 * raises on any change, and :34 blocks DELETE outright), and
 * /api/journal-transactions already puts both on the wire (route.ts:46-47).
 *
 * And no screen read them. JournalEntryEngine.tsx's JournalTxn carried neither
 * field, GeneralLedger.tsx rendered none, and /api/ledger dropped them when it
 * mapped its rows. The audit trail the product is sold on existed in the data
 * and on no screen.
 *
 * THIS FILE IS PURE. No fetch, no env, no clock, no React, no Prisma. It maps a
 * source_type to its words and its target, and nothing else.
 *
 * THE SEVEN KINDS THE DATA ACTUALLY CONTAINS — read from EVERY writer under src,
 * never assumed. An UNKNOWN source_type renders as ITSELF (see entrySourceOf);
 * a guess would be worse than the raw word.
 *
 * THE CENSUS, CLOSED (DRILL-01b, 2026-09-23). Every place under src that WRITES a
 * source_type onto an entry being posted — a literal assigned into the entry
 * object, not a WHERE that reads one back:
 *
 *   plaid_txn        src/lib/journal-entry-service.ts:138
 *                    src/app/api/transactions/route.ts:69
 *                    src/app/api/transactions/uncommit/route.ts:53
 *                    src/app/api/admin/fix-entity-assignment/route.ts:94 · :181
 *   manual           src/app/api/journal-entries/route.ts:110
 *                    src/app/api/journal-entries/manual/route.ts:83
 *   reversal         src/lib/journal-entry-service.ts:236
 *                    src/app/api/investment-transactions/uncommit/route.ts:110
 *                    src/app/api/admin/fix-entity-assignment/route.ts:122
 *   investment_txn   src/lib/batch-trade-processor.ts:995 · :1197 · :1709
 *                    src/lib/position-tracker-service.ts:617
 *                    src/app/api/stock-lots/commit/route.ts:272
 *   trading_position src/app/api/trading/commit-to-ledger/route.ts:184
 *   year_end_close   src/app/api/year-end-close/route.ts:248 · :309
 *   reclass          src/lib/coa/reclassify.ts:145 (the port's type at :121)
 *
 * And the places that only READ or PASS one, so the next reader need not re-check
 * them: the generic posting port (src/lib/posting/postJournal.ts:41 · :131), the
 * two routes that put it on the wire (api/journal-transactions/route.ts:46,
 * api/ledger/route.ts:82), the source read (api/journal-entries/[id]/source/route.ts:38),
 * the WHEREs that find entries by kind (api/investment-transactions/route.ts:48,
 * .../uncommit/route.ts:84, api/trading/commit-to-ledger/route.ts:93,
 * api/year-end-close/route.ts:88, app/trade-log/page.tsx:208 · :213), the SOC 2
 * counters (api/soc2/route.ts:304 · :312 · :336 · :342), the CPA export's type
 * (api/cpa-export/route.ts:111) and the two book surfaces.
 *
 * THE SET IS CLOSED AT SEVEN. A new writer adds a kind here or the surface renders
 * its raw token — which the law forbids by name, so the two move together.
 *
 * NOTHING IS BACKFILLED. An entry written before the pointer existed keeps its
 * silence and says so — "no source recorded for this entry". The legacy-epoch
 * doctrine this repo already applies to vendor_id (schema.prisma:202-205) and to
 * transactions.arrival_id (:558) holds here, and the immutability trigger would
 * refuse a backfill even if doctrine did not.
 */

/** The source kinds written anywhere under src, each cited where it is written. */
export type SourceKind =
  | 'plaid_txn'
  | 'manual'
  | 'reversal'
  | 'investment_txn'
  | 'trading_position'
  | 'reclass'
  | 'year_end_close';

export interface SourceRule {
  type: SourceKind;
  /** What a customer is told the entry came from. */
  words: string;
  /** What source_id holds, named by the row it points into — null when the kind carries no id. */
  idIs: string | null;
  /**
   * Does the surface OPEN the row it points at? Only the bank transaction does
   * today: it is the one target whose stated fields this ruling reads and
   * renders. The others are NAMED — the words and the id are shown, and no
   * screen pretends to fetch a row nobody wrote a reader for.
   */
  opens: boolean;
  /** file:line the value is written at. */
  writtenAt: string;
}

export const SOURCE_RULES: readonly SourceRule[] = [
  {
    type: 'plaid_txn',
    words: 'a bank transaction',
    idIs: 'the transaction id on the bank row (transactions.transactionId)',
    opens: true,
    writtenAt: 'src/lib/journal-entry-service.ts:138-139 · src/app/api/transactions/route.ts:69 · src/app/api/transactions/uncommit/route.ts:53',
  },
  {
    type: 'manual',
    words: 'posted by hand',
    idIs: null,
    opens: false,
    writtenAt: 'src/app/api/journal-entries/route.ts:110 · src/app/api/journal-entries/manual/route.ts:83 (neither writes a source_id)',
  },
  {
    type: 'reversal',
    words: 'a reversal',
    idIs: null,
    opens: false,
    writtenAt: 'src/lib/journal-entry-service.ts:236-237 (source_id null; reverses_entry_id names the entry) · src/app/api/investment-transactions/uncommit/route.ts:110',
  },
  {
    type: 'investment_txn',
    words: 'an investment transaction',
    // DRILL-01b: corrected. Every writer stores the investment_transactions ROW ID,
    // not its investment_transaction_id: batch-trade-processor.ts:996 · :1198 · :1710
    // write `txn.id`; stock-lots/commit/route.ts:273 writes saleTxnId, looked up by
    // `where: { id: saleTxnId }` (:59); position-tracker-service.ts:618 writes
    // `externalTransactionId || null` — a leg's id, and NULL when there is none, so
    // this kind can legitimately carry no pointer. The readers agree:
    // api/investment-transactions/route.ts:39-41 queries source_id against
    // `investmentTxns.map(t => t.id)`.
    idIs: 'the investment transaction row it was posted from (investment_transactions.id)',
    opens: false,
    writtenAt: 'src/lib/batch-trade-processor.ts:995 · :1197 · :1709 · src/lib/position-tracker-service.ts:617 · src/app/api/stock-lots/commit/route.ts:272',
  },
  {
    type: 'trading_position',
    words: 'a trade',
    idIs: 'the trade number',
    opens: false,
    writtenAt: 'src/app/api/trading/commit-to-ledger/route.ts:184 (read back at :93)',
  },
  {
    // DRILL-01b: READ FIRST, and the words follow what the writer stores.
    // postReclassification (reclassify.ts:139-152) posts a NEW entry — "nothing old
    // is edited" (:6-8) — with NO source_id field at all, so the pointer is null by
    // absence, not by choice. What it does store: a description built at :102,
    // `Reclassify <from code> → <to code>: <memo>`, which both book surfaces already
    // render in their own Description column, and metadata.reclass (:104) carrying
    // from_id · from_code · to_id · to_code · amount_cents · memo. So the cell says
    // WHAT HAPPENED and names no target: there is nothing to open.
    type: 'reclass',
    words: 'a move between accounts',
    idIs: null,
    opens: false,
    writtenAt: 'src/lib/coa/reclassify.ts:145 (the posting port declares the literal at :121); no source_id is written',
  },
  {
    type: 'year_end_close',
    words: 'the year-end close',
    idIs: 'the year closed',
    opens: false,
    writtenAt: 'src/app/api/year-end-close/route.ts:88 · :248 · :309',
  },
];

const RULE_BY_TYPE: ReadonlyMap<string, SourceRule> = new Map(SOURCE_RULES.map((r) => [r.type, r]));

export function sourceRuleFor(type: string): SourceRule | undefined {
  return RULE_BY_TYPE.get(type);
}

/** POST-01: what the wire says about the booking a posting documents — the reservation's own stated fields. */
export interface DocumentReservationFacts {
  displayName: string | null;
  providerBookingId: string;
  providerConfirmationCode: string | null;
}

/** POST-01: the money event a refund posting documents — the vendor's stated kind and figure. */
export interface DocumentMoneyEventFacts {
  kind: string;
  /** Integer cents the vendor stated, or NULL when it stated none. */
  amountCents: number | null;
  currency: string | null;
}

/** The shape a row must carry for its source to be read — the three columns, and (POST-01) the document when it has one. */
export interface SourcedEntry {
  source_type?: string | null;
  source_id?: string | null;
  /** The entry a reversal reverses (journal_entries.reverses_entry_id, schema.prisma:196). */
  reverses_entry_id?: string | null;
  /** POST-01: the booking this posting documents (journal_entries.document_reservation_id); NULL renders nothing. */
  document_reservation_id?: string | null;
  /** POST-01: NULL = the booking's charge; set = the money event (a refund) this posting documents. */
  document_money_event_id?: string | null;
  /** POST-01: the booking's stated fields, joined by the route; absent when the route did not join them. */
  document_reservation?: DocumentReservationFacts | null;
  /** POST-01: the money event's stated kind and figure, joined by the route. */
  document_money_event?: DocumentMoneyEventFacts | null;
}

/**
 * What one entry says about where it came from.
 *
 *   opens   — a known kind whose row this surface opens (the bank transaction)
 *   entry   — a reversal: it names the entry it reverses
 *   stated  — a known kind, said in words, with the id it carries when it has one
 *   unknown — a source_type this file does not know: rendered AS ITSELF, never guessed
 *   none    — no source_type at all: the pre-pointer silence, said out loud
 */
export type EntrySource =
  | { kind: 'opens'; type: SourceKind; words: string; id: string; idIs: string }
  | { kind: 'entry'; type: 'reversal'; words: string; entryId: string | null }
  | { kind: 'stated'; type: SourceKind; words: string; id: string | null; idIs: string | null }
  | { kind: 'unknown'; type: string; words: string; id: string | null }
  | { kind: 'none'; words: string };

/** What the surface says when an entry carries no source_type at all. */
export const NO_SOURCE_WORDS = 'no source recorded for this entry';

export function entrySourceOf(entry: SourcedEntry): EntrySource {
  const type = (entry.source_type ?? '').trim();
  if (!type) return { kind: 'none', words: NO_SOURCE_WORDS };
  const rule = RULE_BY_TYPE.get(type);
  if (!rule) {
    // An unrecognised kind is rendered as the word the database holds. Naming it
    // anything else would be inventing a source, which is the one thing this
    // surface may never do.
    return { kind: 'unknown', type, words: type, id: entry.source_id ?? null };
  }
  if (rule.type === 'reversal') {
    return { kind: 'entry', type: 'reversal', words: rule.words, entryId: entry.reverses_entry_id ?? null };
  }
  const id = entry.source_id ?? null;
  if (rule.opens && id) return { kind: 'opens', type: rule.type, words: rule.words, id, idIs: rule.idIs ?? '' };
  return { kind: 'stated', type: rule.type, words: rule.words, id, idIs: rule.idIs };
}

/**
 * POST-01 (2026-09-26) — THE DOCUMENT, in the customer's words. ONE rule.
 *
 * A posting whose document_reservation_id is set is the charge — or, with a
 * money event, the refund — of that booking; the source stays what it is (a bank
 * transaction). The words are built here and nowhere else:
 *   charge  — "Booking: <name> · <confirmation code, or the booking id>"
 *   refund  — "Refund of booking: <name> · <amount currency>"
 * A name the lane has not stated is left out, never invented; a refund whose
 * vendor stated no amount says so. NULL renders NOTHING (kind 'none').
 */
export type EntryDocument =
  | { kind: 'charge'; reservationId: string; words: string }
  | { kind: 'refund'; reservationId: string; moneyEventId: string; words: string }
  | { kind: 'none' };

export function documentOf(entry: SourcedEntry): EntryDocument {
  const reservationId = entry.document_reservation_id ?? null;
  if (!reservationId) return { kind: 'none' };
  const facts = entry.document_reservation ?? null;
  // The reference: the confirmation code the vendor stated, else the booking id; with
  // no joined facts, the reservation id itself — a true pointer, never a blank.
  const reference = facts ? (facts.providerConfirmationCode ?? facts.providerBookingId) : reservationId;
  const name = facts?.displayName ?? null;
  const moneyEventId = entry.document_money_event_id ?? null;
  if (!moneyEventId) {
    return { kind: 'charge', reservationId, words: name ? `Booking: ${name} · ${reference}` : `Booking: ${reference}` };
  }
  const event = entry.document_money_event ?? null;
  const amount = event && event.amountCents !== null
    ? `${(event.amountCents / 100).toFixed(2)}${event.currency ? ` ${event.currency}` : ''}`
    : 'amount not stated';
  const subject = name ?? reference;
  return { kind: 'refund', reservationId, moneyEventId, words: `Refund of booking: ${subject} · ${amount}` };
}

/**
 * COVERAGE IS DECLARED, NEVER IMPUTED. Over the rows actually shown:
 *
 *   sourced        — the entry names a source AND something to point at (a bank
 *                    transaction, an investment transaction, a trade, a year, or —
 *                    for a reversal — the entry it reverses)
 *   withoutPointer — it states an origin with nothing to point at: posted by hand,
 *                    a move between accounts (reclassify.ts writes no source_id at
 *                    all), or any known kind whose id happens to be absent
 *   unrecorded     — it carries no source_type: written before the pointer existed,
 *                    and NOT backfilled
 *
 * DRILL-01b renamed the middle bucket. It was `byHand`, and the line said "N posted
 * by hand" — which was true while `manual` was the only kind with nothing to point
 * at, and became false the moment `reclass` joined it. The words follow the data.
 *
 * Nothing is inferred from silence, and no entry is counted twice.
 */
export interface Coverage {
  total: number;
  sourced: number;
  withoutPointer: number;
  unrecorded: number;
  line: string;
}

export function coverageOf(entries: readonly SourcedEntry[]): Coverage {
  let sourced = 0;
  let withoutPointer = 0;
  let unrecorded = 0;
  for (const e of entries) {
    const s = entrySourceOf(e);
    if (s.kind === 'none') { unrecorded += 1; continue; }
    if (s.kind === 'opens') { sourced += 1; continue; }
    // A reversal points at the entry it reverses; every other kind points at its id.
    const pointsAt = s.kind === 'entry' ? s.entryId : s.id;
    if (pointsAt) sourced += 1; else withoutPointer += 1;
  }
  const total = entries.length;
  const parts = [`${sourced} of ${total} ${total === 1 ? 'entry carries its' : 'entries carry their'} source`];
  if (withoutPointer > 0) parts.push(`${withoutPointer} ${withoutPointer === 1 ? 'names its origin' : 'name their origin'} with nothing to open`);
  if (unrecorded > 0) parts.push(`${unrecorded} with ${NO_SOURCE_WORDS}`);
  return { total, sourced, withoutPointer, unrecorded, line: `${parts.join(' · ')}.` };
}

/** The fields a bank transaction row is asked for. The surface renders only the ones the row actually carries. */
export interface BankTransactionFacts {
  transactionId: string;
  date: string | null;
  name: string | null;
  merchantName: string | null;
  amount: number | null;
  accountName: string | null;
  accountMask: string | null;
  category: string | null;
  pending: boolean | null;
  paymentChannel: string | null;
  transactionType: string | null;
  authorizedDate: string | null;
  website: string | null;
}

/** What the source route answers: the row's facts, or the fact that the row is gone. */
export type SourceAnswer =
  | { found: true; transaction: BankTransactionFacts }
  | { found: false; reason: string };

/** The words a surface says when the pointer names a row that is no longer there. */
export const MISSING_ROW_WORDS = (id: string) =>
  `this entry points at bank transaction ${id}, and no such row is in your account now`;

/** The label under which each fact is shown — one place, so a surface types no field name. */
export const FACT_LABELS: Readonly<Record<keyof BankTransactionFacts, string>> = {
  transactionId: 'Transaction id',
  date: 'Date',
  name: 'Description',
  merchantName: 'Merchant',
  amount: 'Amount',
  accountName: 'Account',
  accountMask: 'Account number',
  category: 'Category',
  pending: 'Pending',
  paymentChannel: 'Payment channel',
  transactionType: 'Transaction type',
  authorizedDate: 'Authorized',
  website: 'Website',
};

/**
 * The facts the row actually carries, in render order — a null field is DROPPED,
 * never shown as a blank or a zero. `amount` and `pending` are kept when they are
 * present at all, including 0 and false, because both are stated values.
 */
export function statedFacts(t: BankTransactionFacts): { label: string; value: string }[] {
  const order: (keyof BankTransactionFacts)[] = [
    'date', 'name', 'merchantName', 'amount', 'accountName', 'accountMask',
    'category', 'pending', 'paymentChannel', 'transactionType', 'authorizedDate', 'website', 'transactionId',
  ];
  const out: { label: string; value: string }[] = [];
  for (const key of order) {
    const v = t[key];
    if (v === null || v === undefined || v === '') continue;
    out.push({ label: FACT_LABELS[key], value: typeof v === 'boolean' ? (v ? 'yes' : 'no') : String(v) });
  }
  return out;
}
