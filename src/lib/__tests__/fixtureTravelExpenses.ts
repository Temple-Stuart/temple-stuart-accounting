/**
 * TRAVEL-02b (Alex, 2026-11-03) — THE TYPED TRAVEL EXPENSES' FIXTURES: the `expenses` GET /api/travel-expenses answers for
 * one caller, in the route's order (paid_on newest first). Five rows, each proving one rule of the ledger:
 *   · a visa in PHP, unattached, no account, not matched — the plain typed row;
 *   · an eSIM in USD on a trip, its account P-9200 (BOOK Personal), matched to a posting with a USD bank row and a receipt;
 *   · an "other" in THB, voided — struck, out of both sum lines, counted, its link still readable;
 *   · an "other" in USD whose one linked posting was reversed — it pays nothing: not matched, counted;
 *   · a visa in USD split over two postings, one with no bank row — the parts joined, the missing row said.
 * CASH-02a (2026-11-08): every row here was typed before CASH-02a — paid_with null, 'not stated' (never backfilled);
 * cash02a.test.ts types its own cash and account rows.
 */
import type { TravelExpenseIn } from '../reservations/travelLedger';

const CREATED = '2026-11-03T08:00:00.000Z';

export const VISA_PHP: TravelExpenseIn = {
  id: 'te-visa', kind: 'visa', paid_on: '2026-10-20', amount_minor: 350000, currency: 'PHP', vendor: 'Bureau of Immigration',
  note: null, trip: null, coa_code: null, paid_with: null, voided_at: null, void_reason: null, created_at: CREATED, postings: [],
};

export const ESIM_USD: TravelExpenseIn = {
  id: 'te-esim', kind: 'esim', paid_on: '2026-10-21', amount_minor: 1800, currency: 'USD', vendor: 'Airalo', note: 'Asia 10 GB',
  trip: { id: 'trip-bali', name: 'Bali 2026' }, coa_code: 'P-9200', paid_with: null, voided_at: null, void_reason: null, created_at: CREATED,
  postings: [{ journal_entry_id: 'je-esim', posted_on: '2026-10-22', reversed: false, bank: { amount: 18, currency: 'USD', date: '2026-10-21' }, receipts: 1 }],
};

export const OTHER_VOIDED: TravelExpenseIn = {
  id: 'te-other', kind: 'other', paid_on: '2026-10-23', amount_minor: 5000, currency: 'THB', vendor: 'Grab', note: null,
  trip: null, coa_code: 'B-6100', paid_with: null, voided_at: '2026-10-24T09:00:00.000Z', void_reason: 'typed twice', created_at: CREATED,
  postings: [{ journal_entry_id: 'je-other', posted_on: '2026-10-23', reversed: false, bank: { amount: 50, currency: 'THB', date: '2026-10-23' }, receipts: 0 }],
};

export const OTHER_REVERSED: TravelExpenseIn = {
  id: 'te-reversed', kind: 'other', paid_on: '2026-10-25', amount_minor: 2000, currency: 'USD', vendor: 'Visa agent', note: null,
  trip: null, coa_code: null, paid_with: null, voided_at: null, void_reason: null, created_at: CREATED,
  postings: [{ journal_entry_id: 'je-rev', posted_on: '2026-10-25', reversed: true, bank: { amount: 20, currency: 'USD', date: '2026-10-25' }, receipts: 0 }],
};

export const VISA_SPLIT: TravelExpenseIn = {
  id: 'te-split', kind: 'visa', paid_on: '2026-10-26', amount_minor: 6000, currency: 'USD', vendor: 'Embassy', note: null,
  trip: null, coa_code: null, paid_with: null, voided_at: null, void_reason: null, created_at: CREATED,
  postings: [
    { journal_entry_id: 'je-a', posted_on: '2026-10-26', reversed: false, bank: { amount: 30, currency: 'USD', date: '2026-10-26' }, receipts: 0 },
    { journal_entry_id: 'je-b', posted_on: '2026-10-27', reversed: false, bank: null, receipts: 2 },
  ],
};

/** The route's order: paid_on newest first. */
export const TYPED_FIXTURE: readonly TravelExpenseIn[] = [VISA_SPLIT, OTHER_REVERSED, OTHER_VOIDED, ESIM_USD, VISA_PHP];
