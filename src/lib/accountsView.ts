/**
 * ACCOUNTS-01 — what step 1's screen shows, as pure functions over the API's
 * real shape (/api/accounts → { items: [{ institutionName, accounts: [...] }] }).
 *
 * Two rules the old page broke, kept here so no renderer can break them again:
 *   1. A NUMBER IS NEVER INVENTED. A null / undefined / non-finite balance
 *      renders "—", never NaN and never a silent 0 (the old page called
 *      account.balance.toFixed(2) straight, and read a fabricated lastSync of
 *      `new Date()` — a value the database never held).
 *   2. A MISSING WORD SAYS SO. A null type or subtype renders
 *      "unknown — reported by the institution", never a guess.
 *
 * GROUPING is by what the account IS, from Plaid's own type/subtype:
 *   depository, credit → Banking      (a card is a bank feed; what is owed on
 *                                      it shows as its balance)
 *   loan               → Debt
 *   investment         → Retirement when the subtype is a retirement wrapper,
 *                        else Brokerage (an unrecognized investment subtype
 *                        stays in its type's group and is labelled unknown —
 *                        it is never re-filed on a guess)
 *   anything else      → Unrecognized (named, never hidden, never re-filed)
 * Fixed Assets has no feed at all: the screen states that; this module gives it
 * a group with no members so the renderer never invents one.
 */

export interface ApiAccount {
  id: string;
  name: string;
  type: string | null;
  subtype: string | null;
  mask: string | null;
  balance: number | null;
  entityType: string | null;
  /** The row's last write (a sync, or an entity assignment) — accounts.updatedAt. NOT a sync timestamp: the product records none. */
  updatedAt?: string | null;
}

export interface ApiItem {
  id: string;
  institutionName: string | null;
  lastErrorCode: string | null;
  lastErrorAt?: string | null;
  accounts: ApiAccount[];
}

/** One row of the screen: the account, flattened onto its institution. */
export interface AccountRow extends ApiAccount {
  itemId: string;
  institutionName: string | null;
  lastErrorCode: string | null;
}

export type GroupKey = 'banking' | 'brokerage' | 'retirement' | 'debt' | 'fixed-assets' | 'unrecognized';

export interface GroupDef {
  key: GroupKey;
  label: string;
  /** What WOULD appear here — shown verbatim when the group is empty. Never "nothing yet". */
  empty: string;
  /** A group no feed can ever fill (Fixed Assets): stated, never a form. */
  noFeed?: string;
}

export const ACCOUNT_GROUPS: readonly GroupDef[] = [
  { key: 'banking', label: 'Banking', empty: 'Checking, savings and credit-card accounts you connect through your bank.' },
  { key: 'brokerage', label: 'Brokerage', empty: 'Taxable investment accounts — brokerage and cash management.' },
  { key: 'retirement', label: 'Retirement', empty: 'Retirement wrappers your institution reports as such — 401(k), 403(b), IRA, Roth, HSA, 529.' },
  { key: 'debt', label: 'Debt', empty: 'Loan accounts — mortgage, student, auto. A credit card is listed under Banking, where the balance is what you owe.' },
  { key: 'fixed-assets', label: 'Fixed Assets', empty: 'Property and equipment.', noFeed: 'No feed — a fixed asset is entered by hand, and that is not built. Nothing here is connected, and nothing here is estimated.' },
  { key: 'unrecognized', label: 'Unrecognized', empty: 'Accounts whose type this product does not yet file.' },
];

/**
 * The investment subtypes that mean "retirement wrapper". Matched case- and
 * punctuation-insensitively against what the institution actually reports
 * (Plaid sends e.g. "401k", "403B", "roth", "ira", "hsa", "529"). An investment
 * subtype outside this set is NOT assumed to be one — it stays in Brokerage and
 * shows the institution's own word.
 */
export const RETIREMENT_SUBTYPES: readonly string[] = ['401k', '401a', '403b', '457b', '529', 'ira', 'roth', 'roth 401k', 'sep ira', 'simple ira', 'sarsep', 'hsa', 'keogh', 'pension', 'retirement', 'stock plan', 'thrift savings plan'];

const norm = (s: string | null | undefined): string => (typeof s === 'string' ? s.trim().toLowerCase().replace(/[_-]+/g, ' ') : '');

export const UNKNOWN_WORD = 'unknown — reported by the institution';

/** A type or subtype as the institution reported it; a missing one says it is missing. */
export function describeWord(value: string | null | undefined): string {
  return typeof value === 'string' && value.trim() ? value.trim() : UNKNOWN_WORD;
}

/** Whether a word is one the institution actually gave (drives the "unknown" styling). */
export function isReported(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * A balance as money. Null, undefined, NaN and Infinity all render "—" — the
 * screen says it does not know, and never shows a number the data never had.
 */
export function money(value: number | null | undefined, currency = 'USD'): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return value.toLocaleString('en-US', { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A timestamp as a date, or "—". Never "just now", never today's date as a stand-in. */
export function when(value: string | null | undefined): string {
  if (typeof value !== 'string' || !value.trim()) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Which group an account belongs in — from its own type and subtype, never from its name. */
export function groupOf(account: Pick<ApiAccount, 'type' | 'subtype'>): GroupKey {
  const type = norm(account.type);
  if (type === 'depository' || type === 'credit') return 'banking';
  if (type === 'loan') return 'debt';
  if (type === 'investment') {
    return RETIREMENT_SUBTYPES.includes(norm(account.subtype)) ? 'retirement' : 'brokerage';
  }
  return 'unrecognized';
}

export interface AccountGroup extends GroupDef {
  rows: AccountRow[];
  /** The group's total, or null when NO row carries a number — null renders "—", never 0. */
  total: number | null;
}

/** Every item's accounts flattened onto their institution, in the order the API gave them. */
export function rowsOf(items: readonly ApiItem[]): AccountRow[] {
  return items.flatMap((item) =>
    (item.accounts ?? []).map((account) => ({
      ...account,
      itemId: item.id,
      institutionName: item.institutionName,
      lastErrorCode: item.lastErrorCode ?? null,
    })),
  );
}

/** The screen's groups, in ACCOUNT_GROUPS order, each with its rows and its honest total. */
export function groupAccounts(rows: readonly AccountRow[]): AccountGroup[] {
  return ACCOUNT_GROUPS.map((group) => {
    const mine = rows.filter((r) => groupOf(r) === group.key);
    const numbers = mine.map((r) => r.balance).filter((b): b is number => typeof b === 'number' && Number.isFinite(b));
    return { ...group, rows: mine, total: numbers.length ? numbers.reduce((a, b) => a + b, 0) : null };
  });
}
