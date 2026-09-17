/**
 * LINK-01 — THE ACTUAL IS THE SUM OF ITS LINKS, NEVER AN IMPUTATION.
 *
 * DAY-01 proved the automatic event→Books join unsound. DRILL-01 rendered that
 * verdict. This leaf is the answer to it: an item's actual is the sum of the
 * postings a PERSON linked to it, and nothing else. No matcher writes here, no
 * amount is suggested, and an item with no links reads NOT LINKED — never $0.
 *
 * WHAT IT REFUSES TO DO, AND WHY IT IS WRITTEN DOWN. EDGE-01 found this exact
 * bug in the trade link route, twice:
 *     src/app/api/trade-card-links/route.ts:80  and  :255
 *     positions.reduce((sum, p) => sum + (p.realized_pl ?? 0), 0)
 * A NULL realized_pl is summed as ZERO, so a closed position with an unknown
 * P&L contributes nothing and the total looks complete when it is not. This
 * leaf does the opposite: a posting whose amount cannot be read is REPORTED,
 * by id, and the sum is declared incomplete. It is never counted as zero.
 */

/** One posting, as this leaf needs it. `amountCents` is null when unreadable. */
export interface LinkedPosting {
  readonly journalEntryId: string;
  readonly date: string;
  readonly description: string;
  /** Cents. NULL means the entry carried no readable amount — NOT zero. */
  readonly amountCents: number | null;
}

export interface LinkedActual {
  /** Dollars, from the postings whose amount COULD be read. Null when none could. */
  readonly actual: number | null;
  /** How many links there are in total. */
  readonly count: number;
  /** How many of them contributed to the sum. */
  readonly counted: number;
  /** The ids whose amount could not be read — reported, never summed as zero. */
  readonly unreadable: readonly string[];
  /** True when every link contributed. A caller must not print a bare total when false. */
  readonly complete: boolean;
}

/**
 * The sum of an item's links.
 *
 * Zero links → `actual: null` and `count: 0`. The caller reads that as NOT
 * LINKED. It is NOT a zero, and nothing here ever returns one to stand in for
 * an unknown.
 */
export function sumLinks(postings: readonly LinkedPosting[]): LinkedActual {
  const unreadable: string[] = [];
  let cents = 0;
  let counted = 0;
  for (const p of postings) {
    if (p.amountCents === null || !Number.isFinite(p.amountCents)) {
      unreadable.push(p.journalEntryId);
      continue;
    }
    cents += p.amountCents;
    counted += 1;
  }
  return {
    actual: counted === 0 ? null : cents / 100,
    count: postings.length,
    counted,
    unreadable,
    complete: postings.length > 0 && unreadable.length === 0,
  };
}

/** The source label an actual built from links wears. It names the COUNT. */
export function linkedSourceLine(a: LinkedActual): string {
  const n = a.counted;
  const base = `linked to ${n} posting${n === 1 ? '' : 's'} in Books`;
  if (a.unreadable.length === 0) return base;
  return `${base}; ${a.unreadable.length} more ${a.unreadable.length === 1 ? 'is' : 'are'} linked but carry no readable amount and are NOT in this total (${a.unreadable.join(', ')})`;
}

/**
 * The variance: planned minus actual. Null unless BOTH are known — a variance
 * against an unknown actual would be the planned figure wearing a second name.
 */
export function variance(planned: number | null, actual: number | null): number | null {
  if (planned === null || actual === null) return null;
  if (!Number.isFinite(planned) || !Number.isFinite(actual)) return null;
  return planned - actual;
}

/**
 * STEP 0.4 — THE FREE-TEXT CONFLICT, PROPOSED (Alex rules; this is not decided).
 *
 * A project task's actual has TWO writers:
 *   1. PATCH /api/operations/projects/[id]/tasks/[taskId] (route.ts:206-226) —
 *      a free-text field, typed by a person, stored as Decimal(15,2).
 *   2. LINK-01's links — the sum of postings that really exist in Books.
 *
 * THE PROPOSED RULE: the LINKS win as the rendered actual, because a link points
 * at a posting and a typed number is a claim about one. The typed figure is not
 * deleted and not overwritten — this PR writes nothing to actual_cost_usd — and
 * where the two disagree the panel shows BOTH and says which it is using.
 */
export const FREE_TEXT_RULE =
  'Where a task’s typed actual and its links disagree, the links are the actual: a link points at a posting in Books, a typed number is a claim about one. The typed figure is kept and shown beside it, never overwritten. (LINK-01 STEP 0.4 — proposed, awaiting a ruling.)';

/** Do a typed actual and a linked actual disagree? Null-safe; equal is not a conflict. */
export function typedVsLinked(typed: number | null, linked: number | null): boolean {
  if (typed === null || linked === null) return false;
  return Math.abs(typed - linked) >= 0.005;
}
