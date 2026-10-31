/**
 * DOCUMENTS-02 (Alex, 2026-10-30, ruling G) — THE PIPELINE'S WORD ON RECONCILIATION.
 *
 * BooksPipeline said "complete" when any one account-month had ever been reconciled. The one rule now:
 * for the previous calendar month (UTC), M = the caller's depository accounts the bank-side resolver can
 * resolve (bankSide.ts), N = those with a CURRENT reconciled row for that month; 'complete' iff M > 0 and
 * N = M; otherwise 'pending'. The subtitle says "<N> of <M> accounts reconciled for <Month YYYY>", and
 * "no mapped depository account" when M = 0. The REC section, the strip's phase and the prose all read
 * this — computed on the reconciliations GET from the same rows it answers.
 *
 * THIS FILE IS PURE: no Prisma, no fetch, no clock (today is passed in), no React.
 */
import { bankSideOf, type BankSideAccount, type BankSideEntity } from './bankSide';
import { previousMonthOf, type Period } from './period';

export interface StatusAccount extends BankSideAccount {
  readonly id: string;
  readonly type: string;
}

export interface CurrentReconciliation {
  readonly accountId: string;
  /** 'YYYY-MM' */
  readonly period: string;
  readonly status: string;
}

export interface ReconciliationStatus {
  readonly state: 'complete' | 'pending';
  /** The month judged — 'YYYY-MM'. */
  readonly period: string;
  /** "October 2026" */
  readonly words: string;
  /** M — the depository accounts the resolver resolves. */
  readonly resolvable: number;
  /** N — of those, the ones with a current reconciled row for the month. */
  readonly reconciled: number;
  readonly subtitle: string;
}

export const NO_MAPPED_ACCOUNT_WORDS = 'no mapped depository account';
export const statusSubtitleWords = (n: number, m: number, period: Period): string =>
  m === 0 ? NO_MAPPED_ACCOUNT_WORDS : `${n} of ${m} accounts reconciled for ${period.words}`;

/** The pipeline's word for the previous calendar month of `today` ('YYYY-MM-DD', the UTC day). */
export function reconciliationStatusOf(input: {
  readonly today: string;
  readonly accounts: readonly StatusAccount[];
  readonly entities: readonly BankSideEntity[];
  readonly current: readonly CurrentReconciliation[];
}): ReconciliationStatus {
  const period = previousMonthOf(input.today);
  const resolvable = input.accounts.filter((a) => a.type === 'depository' && bankSideOf(a, input.entities).ok);
  const reconciled = resolvable.filter((a) =>
    input.current.some((r) => r.accountId === a.id && r.period === period.period && r.status === 'reconciled'));
  const m = resolvable.length, n = reconciled.length;
  return {
    state: m > 0 && n === m ? 'complete' : 'pending',
    period: period.period,
    words: period.words,
    resolvable: m,
    reconciled: n,
    subtitle: statusSubtitleWords(n, m, period),
  };
}
