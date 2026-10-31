/**
 * DOCUMENTS-02 (Alex, 2026-10-30, ruling B) — THE BOOK SIDE IS THE BOOKS: the one bank-side resolver.
 *
 * A bank reconciliation compares the bank's statement with the BOOKS — the GL balance of the chart-of-
 * accounts row that the bank account posts to. That row is resolved exactly as the postings resolve it
 * (src/app/api/transactions/commit-to-ledger/route.ts :245-268): the code is accounts.accountCode, the
 * entity is the caller's entities row whose entity_type equals accounts.entityType. Nothing else is
 * read — not accounts.entity_id, not a default entity, never accounts.currentBalance (the bank's own
 * number, which the old screen showed under the name "book").
 *
 * A missing piece is refused by name, in the commit route's own words for the code, so the two
 * resolutions cannot drift apart silently (documents02.test.ts pins both).
 *
 * THIS FILE IS PURE: no Prisma, no fetch, no React.
 */
import type { Refusal } from './sourceDocuments';

export interface BankSideAccount {
  readonly name: string;
  readonly accountCode: string | null;
  readonly entityType: string | null;
}

export interface BankSideEntity {
  readonly id: string;
  readonly entity_type: string;
}

export interface BankSide {
  readonly ok: true;
  readonly entityId: string;
  readonly accountCode: string;
}

/** The commit route's words, verbatim (commit-to-ledger/route.ts :251). */
export const noAccountCodeWords = (name: string): string =>
  `Linked account "${name}" has no accountCode mapped. Set accountCode on the accounts table first.`;
/** The entity comes from the Banking tab's dropdown (BooksPipeline.tsx updateAccountEntity → /api/accounts/update-entity). */
export const noEntityWords = (name: string): string =>
  `account "${name}" has no entity — choose one on the Banking tab first`;

/** The books' side of a bank account: its chart-of-accounts code and the entity that holds the row — or a refusal by name. */
export function bankSideOf(account: BankSideAccount, entities: readonly BankSideEntity[]): BankSide | Refusal {
  const accountCode = (account.accountCode ?? '').trim();
  if (accountCode === '') return { ok: false, status: 409, error: noAccountCodeWords(account.name) };
  const entityType = (account.entityType ?? '').trim();
  if (entityType === '') return { ok: false, status: 409, error: noEntityWords(account.name) };
  const entity = entities.find((e) => e.entity_type === entityType);
  if (entity === undefined) return { ok: false, status: 409, error: noEntityWords(account.name) };
  return { ok: true, entityId: entity.id, accountCode };
}
