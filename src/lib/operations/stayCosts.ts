/**
 * TRAVEL-02c (Alex, 2026-11-03, rulings D and F) — A STAY'S COST PER DAY AGAINST THE LA BASELINE, PURE.
 *
 * Per stay, every figure CALCULATED and naming its inputs:
 *   · DAYS — stay.ts stayLength: both ends counted (one user's stays never share a day — the STAY_OVERLAP trigger).
 *   · CHARGES — the postings linked by hand to the stay (planned_item_links kind 'stay' — TRAVEL-02c ruling A, the one
 *     link rule), each worth the books' own figure: postingAmount.ts amountCentsOf, the debit's cents — in the
 *     functional currency by FX-01. A reversed posting pays nothing (isReversedPosting) and is counted out by name; a
 *     posting whose amount cannot be read is never summed as zero — the stay's figures are not computed, by name.
 *   · BY ACCOUNT — each debit line's account (code · name) with its sum.
 *   · TOTAL — the sum. PER DAY — TOTAL ÷ DAYS, rounded half away from zero ONCE ('$1,389.50 ÷ 29 days').
 *   · BASELINE — the living baseline in force on the stay's first day: the live row (not voided) with the latest
 *     effective_from on or before it (prisma/schema.prisma living_baselines — TRAVEL-02c ruling B); its per day is
 *     monthly × 12 ÷ 365, rounded once ('$2,500.00 × 12 ÷ 365'); none → 'no baseline in force on <day>'.
 *   · FOR THE STAY — monthly × 12 × DAYS ÷ 365, rounded once — never per day × days.
 *   · UNDER / OVER — TOTAL − FOR THE STAY: 'under by $X' · 'over by $X' · 'even'. A baseline stated in another
 *     currency than the books' is shown and NOT compared (FX-02 owns any conversion).
 *
 * Integer arithmetic only, and BigInt throughout (monthly × 12 × DAYS can pass 2^53 for a long enough stay), so every
 * division is the one rounding its figure takes. Here too: the words (ruling F), the table's spec in the one idiom
 * (src/lib/table), and the stays DELETE's refusal — LINK-LAW-01's rule for a routine (linkHold.ts), applied to a stay.
 * Pure: no Prisma, no fetch, no clock, no React.
 */
import { FUNCTIONAL_CURRENCY, functionalMoneyWords, statedMoneyWords } from '@/lib/books/functionalCurrency';
import { amountCentsOf, isReversedPosting } from '@/lib/calendar/postingAmount';
import { stayLength, stayLengthWords } from '@/lib/operations/stay';
import { columnOf, type TableColumn } from '@/lib/table/columns';
import { csvMoney } from '@/lib/table/csv';
import { numberKey, textKey } from '@/lib/table/sort';
import { BLANK } from '@/lib/table/words';

// ── THE INTEGERS ────────────────────────────────────────────────────────────

const ZERO = BigInt(0);
const TWO = BigInt(2);
const MONTHS_A_YEAR = BigInt(12);
const DAYS_A_YEAR = BigInt(365);

/** n ÷ d, rounded half away from zero — ONCE. d is a count of days or 365, never 0 or less. */
export function divideRoundedOnce(n: bigint, d: bigint): bigint {
  if (d <= ZERO) throw new Error(`stayCosts: a divisor of ${d} — the rule divides by a count of days or by 365`);
  const negative = n < ZERO;
  const magnitude = negative ? -n : n;
  const q = (TWO * magnitude + d) / (TWO * d);
  return negative ? -q : q;
}

/** A BigInt the leaf computed, back to the number the screen and the wire carry — refused if it would lose a cent. */
function centsNumber(n: bigint): number {
  const out = Number(n);
  if (!Number.isSafeInteger(out)) throw new Error(`stayCosts: ${n} is past the safe integers — no figure here is rounded by a float`);
  return out;
}

// ── THE WORDS (ruling F) ────────────────────────────────────────────────────

export const STAYS_COST_HEADING = 'STAYS · CALCULATED';
export const CALCULATED_WORDS = 'CALCULATED';
export const NO_CHARGE_WORDS = "no charge linked — link the stay's lodging and flights";
export const noBaselineWords = (day: string): string => `no baseline in force on ${day}`;
export const notComparedWords = (code: string): string =>
  `the baseline is stated in ${code}; the books are kept in ${FUNCTIONAL_CURRENCY} — not compared (FX-02)`;
export const underByWords = (cents: number): string => `under by ${functionalMoneyWords(cents)}`;
export const overByWords = (cents: number): string => `over by ${functionalMoneyWords(cents)}`;
export const EVEN_WORDS = 'even';
export const REVERSED_PAYS_NOTHING_WORDS = 'reversed — pays nothing';
export const NO_READABLE_AMOUNT_WORDS = 'no readable debit amount';
/** PER DAY's formula: '$1,389.50 ÷ 29 days'. */
export const perDayFormulaWords = (totalCents: number, days: number): string => `${functionalMoneyWords(totalCents)} ÷ ${stayLengthWords(days)}`;
/** The baseline's per day: '$2,500.00 × 12 ÷ 365' — in the currency it is stated in. */
export const baselinePerDayFormulaWords = (monthlyMinor: number, currency: string): string => `${statedMoneyWords(monthlyMinor, currency)} × 12 ÷ 365`;
/** FOR THE STAY: '$2,500.00 × 12 × 29 days ÷ 365' — the product first, one division. */
export const forTheStayFormulaWords = (monthlyMinor: number, currency: string, days: number): string =>
  `${statedMoneyWords(monthlyMinor, currency)} × 12 × ${stayLengthWords(days)} ÷ 365`;
/** A stay as its link's audit and its refusals name it: '<place> <starts_on> → <ends_on>'. */
export const stayWords = (stay: { readonly place: string; readonly starts_on: string; readonly ends_on: string }): string =>
  `${stay.place} ${stay.starts_on} → ${stay.ends_on}`;
/** The STAY column: '2026-10-22 → 2026-11-19'. */
export const staySpanWords = (startsOn: string, endsOn: string): string => `${startsOn} → ${endsOn}`;
const charges = (n: number): string => `${n} charge${n === 1 ? '' : 's'}`;
/** The CHARGES cell: the paying count — or NO_CHARGE_WORDS — and the postings counted out, by name. */
export function chargesWords(paying: number, reversed: number, unreadable: number): string {
  const parts = [paying === 0 ? NO_CHARGE_WORDS : charges(paying)];
  if (reversed > 0) parts.push(`${reversed} ${REVERSED_PAYS_NOTHING_WORDS} (counted out)`);
  if (unreadable > 0) parts.push(`${unreadable} with ${NO_READABLE_AMOUNT_WORDS}`);
  return parts.join(' · ');
}
/** A charge whose debit cannot be read stops the stay's figures — never a zero summed in. */
export const notComputedWords = (n: number): string =>
  `not computed — ${n} linked ${n === 1 ? 'charge carries' : 'charges carry'} ${NO_READABLE_AMOUNT_WORDS}`;
/** BY ACCOUNT reads each debit line; the books' amount reads a posting's first — when the two disagree, it is said. */
export const byAccountDisagreesWords = (byAccountCents: number, totalCents: number): string =>
  `BY ACCOUNT sums to ${functionalMoneyWords(byAccountCents)}; TOTAL is ${functionalMoneyWords(totalCents)} — a linked posting carries more than one debit line, and the books' amount reads its first`;
/** The BASELINE cell: 'LA rent · $2,500.00 a month · $82.19 a day'. */
export const baselineCellWords = (label: string, monthlyWords: string, perDayWords: string): string => `${label} · ${monthlyWords} a month · ${perDayWords} a day`;
/** The stays DELETE's refusal (ruling A — LINK-LAW-01's rule for a routine, applied to a stay): unlink first. */
export const stayHoldsLinksWords = (n: number, stay: { readonly place: string; readonly starts_on: string; readonly ends_on: string }): string =>
  `the stay ${stayWords(stay)} has ${n} posting${n === 1 ? '' : 's'} linked in Books — unlink ${n === 1 ? 'it' : 'them'} first`;
/** The links a stay holds — the stays DELETE counts them before it deletes. */
export const stayLinksWhere = (userId: string, stayId: string) => ({ user_id: userId, target_kind: 'stay', target_id: stayId });

// ── THE INPUTS ──────────────────────────────────────────────────────────────

/** A stay as the routes answer it — stay.ts StayRow's shape. */
export interface StayIn {
  readonly id: string;
  readonly place: string;
  readonly starts_on: string;
  readonly ends_on: string;
}

/** A linked posting as the costs route reads it: postingAmount.ts BILL_POSTING_SELECT (each line with its account) and the posting's day and words. */
export interface StayPostingIn {
  readonly id: string;
  readonly date: Date;
  readonly description: string;
  readonly status: string;
  readonly is_reversal: boolean;
  readonly reversed_by_entry_id: string | null;
  readonly ledger_entries: readonly {
    readonly entry_type: string;
    readonly amount: bigint;
    readonly account: { readonly code: string; readonly name: string; readonly entity_id: string };
  }[];
}

/** A living baseline as the routes answer it: the DAY as 'YYYY-MM-DD', the void instant as ISO. */
export interface LivingBaselineRow {
  readonly id: string;
  readonly label: string;
  readonly effective_from: string;
  readonly monthly_minor: number;
  readonly currency: string;
  readonly voided_at: string | null;
  readonly void_reason: string | null;
  readonly created_at: string;
}

/** What both routes select of a living baseline — every column the wire carries. */
export const LIVING_BASELINE_SELECT = {
  id: true, label: true, effective_from: true, monthly_minor: true, currency: true, voided_at: true, void_reason: true, created_at: true,
} as const;

/** One baseline on the wire, from its row: the DAY as 'YYYY-MM-DD' (@db.Date is UTC midnight), the instants as ISO. */
export function livingBaselineRowOf(row: {
  readonly id: string; readonly label: string; readonly effective_from: Date; readonly monthly_minor: number; readonly currency: string;
  readonly voided_at: Date | null; readonly void_reason: string | null; readonly created_at: Date;
}): LivingBaselineRow {
  return {
    id: row.id,
    label: row.label,
    effective_from: row.effective_from.toISOString().slice(0, 10),
    monthly_minor: row.monthly_minor,
    currency: row.currency,
    voided_at: row.voided_at === null ? null : row.voided_at.toISOString(),
    void_reason: row.void_reason,
    created_at: row.created_at.toISOString(),
  };
}

// ── THE ANSWER ──────────────────────────────────────────────────────────────

/** One linked posting under its stay — the drill's line: date · description · account · amount · reversed. */
export interface StayCharge {
  readonly journalEntryId: string;
  readonly date: string;
  readonly description: string;
  readonly accountWords: string;
  readonly cents: number | null;
  readonly amountWords: string;
  readonly reversed: boolean;
  readonly reversedWords: string | null;
}

/** One account of BY ACCOUNT: its words (code · name) and the sum of its debit lines over the paying charges. */
export interface StayAccountSum {
  readonly key: string;
  readonly words: string;
  readonly cents: number;
  readonly amountWords: string;
}

/** The baseline in force on a stay's first day, with its per day — in the currency it is stated in. */
export interface StayBaseline {
  readonly id: string;
  readonly label: string;
  readonly effectiveFrom: string;
  readonly currency: string;
  readonly monthlyMinor: number;
  readonly monthlyWords: string;
  readonly perDayMinor: number;
  readonly perDayWords: string;
  readonly perDayFormula: string;
}

export type UnderOver =
  | { readonly kind: 'under' | 'over' | 'even'; readonly cents: number; readonly words: string }
  | { readonly kind: 'no-charge' | 'no-baseline' | 'not-compared' | 'not-computed'; readonly cents: null; readonly words: string };

export interface StayCost {
  readonly id: string;
  readonly place: string;
  readonly starts_on: string;
  readonly ends_on: string;
  readonly days: number;
  readonly charges: readonly StayCharge[];
  readonly paying: number;
  readonly reversed: number;
  readonly unreadable: number;
  readonly chargesWords: string;
  readonly totalCents: number | null;
  readonly totalWords: string;
  readonly perDayCents: number | null;
  readonly perDayWords: string;
  readonly perDayFormula: string | null;
  readonly byAccount: readonly StayAccountSum[];
  readonly byAccountWords: string | null;
  readonly baseline: StayBaseline | null;
  readonly baselineWords: string;
  readonly forTheStayMinor: number | null;
  readonly forTheStayWords: string;
  readonly forTheStayFormula: string | null;
  readonly underOver: UnderOver;
}

// ── THE RULES ───────────────────────────────────────────────────────────────

const accountWordsOf = (account: { readonly code: string; readonly name: string }): string => `${account.code} · ${account.name}`;
const isoDayOf = (d: Date): string => d.toISOString().slice(0, 10);

/** One linked posting as a charge: the books' amount (amountCentsOf), its reversal (isReversedPosting), its debit accounts. */
export function stayChargeOf(posting: StayPostingIn): StayCharge {
  const cents = amountCentsOf(posting);
  const reversed = isReversedPosting(posting);
  const debits = posting.ledger_entries.filter((l) => l.entry_type === 'D');
  return {
    journalEntryId: posting.id,
    date: isoDayOf(posting.date),
    description: posting.description,
    accountWords: debits.length === 0 ? BLANK : debits.map((l) => accountWordsOf(l.account)).join(' + '),
    cents,
    amountWords: cents === null ? NO_READABLE_AMOUNT_WORDS : functionalMoneyWords(cents),
    reversed,
    reversedWords: reversed ? REVERSED_PAYS_NOTHING_WORDS : null,
  };
}

/** The live baseline in force on `day`: the latest effective_from on or before it; a voided one never is. Two live rows on one day are refused — the partial unique holds one. */
export function baselineInForce(baselines: readonly LivingBaselineRow[], day: string): LivingBaselineRow | null {
  const live = baselines.filter((b) => b.voided_at === null && b.effective_from <= day);
  if (live.length === 0) return null;
  const latest = live.reduce((a, b) => (b.effective_from > a.effective_from ? b : a));
  const same = live.filter((b) => b.effective_from === latest.effective_from);
  if (same.length > 1) throw new Error(`stayCosts: ${same.length} live baselines start on ${latest.effective_from} (${same.map((b) => b.id).join(', ')}) — the partial unique holds one`);
  return latest;
}

/** A baseline's per day — monthly × 12 ÷ 365, rounded once — with its words and formula. */
export function stayBaselineOf(row: LivingBaselineRow): StayBaseline {
  const perDay = centsNumber(divideRoundedOnce(BigInt(row.monthly_minor) * MONTHS_A_YEAR, DAYS_A_YEAR));
  return {
    id: row.id,
    label: row.label,
    effectiveFrom: row.effective_from,
    currency: row.currency,
    monthlyMinor: row.monthly_minor,
    monthlyWords: statedMoneyWords(row.monthly_minor, row.currency),
    perDayMinor: perDay,
    perDayWords: statedMoneyWords(perDay, row.currency),
    perDayFormula: baselinePerDayFormulaWords(row.monthly_minor, row.currency),
  };
}

/** One stay's figures, every one calculated from its linked postings and the baseline in force on its first day. */
export function stayCostOf(stay: StayIn, postings: readonly StayPostingIn[], baselines: readonly LivingBaselineRow[]): StayCost {
  const days = stayLength({ startsOn: stay.starts_on, endsOn: stay.ends_on });
  const all = postings.map(stayChargeOf).sort((a, b) => (a.date === b.date ? a.description.localeCompare(b.description) : a.date.localeCompare(b.date)));
  const reversed = all.filter((c) => c.reversed).length;
  const notReversed = postings.filter((p) => !isReversedPosting(p));
  const unreadable = notReversed.filter((p) => amountCentsOf(p) === null).length;
  const paying = notReversed.length - unreadable;
  const computed = paying > 0 && unreadable === 0;

  // TOTAL and BY ACCOUNT over the paying charges — never a reversed one, never a zero for an unreadable one.
  let total = ZERO;
  const byKey = new Map<string, { words: string; cents: bigint }>();
  let byAccountTotal = ZERO;
  if (computed) {
    for (const p of notReversed) {
      total += BigInt(amountCentsOf(p) as number);
      for (const line of p.ledger_entries) {
        if (line.entry_type !== 'D') continue;
        const key = `${line.account.entity_id} ${line.account.code}`;
        const held = byKey.get(key);
        if (held === undefined) byKey.set(key, { words: accountWordsOf(line.account), cents: line.amount });
        else held.cents += line.amount;
        byAccountTotal += line.amount;
      }
    }
  }
  const totalCents = computed ? centsNumber(total) : null;
  const perDayCents = computed ? centsNumber(divideRoundedOnce(total, BigInt(days))) : null;
  const byAccount: StayAccountSum[] = [...byKey.entries()]
    .map(([key, v]) => ({ key, words: v.words, cents: centsNumber(v.cents), amountWords: functionalMoneyWords(v.cents) }))
    .sort((a, b) => a.words.localeCompare(b.words, 'en', { numeric: true }));
  const byAccountWords = computed && byAccountTotal !== total ? byAccountDisagreesWords(centsNumber(byAccountTotal), centsNumber(total)) : null;

  const inForce = baselineInForce(baselines, stay.starts_on);
  const baseline = inForce === null ? null : stayBaselineOf(inForce);
  const forTheStay = inForce === null ? null : centsNumber(divideRoundedOnce(BigInt(inForce.monthly_minor) * MONTHS_A_YEAR * BigInt(days), DAYS_A_YEAR));

  let underOver: UnderOver;
  if (unreadable > 0) underOver = { kind: 'not-computed', cents: null, words: notComputedWords(unreadable) };
  else if (paying === 0) underOver = { kind: 'no-charge', cents: null, words: NO_CHARGE_WORDS };
  else if (inForce === null) underOver = { kind: 'no-baseline', cents: null, words: noBaselineWords(stay.starts_on) };
  else if (inForce.currency !== FUNCTIONAL_CURRENCY) underOver = { kind: 'not-compared', cents: null, words: notComparedWords(inForce.currency) };
  else {
    const diff = (totalCents as number) - (forTheStay as number);
    underOver = diff < 0
      ? { kind: 'under', cents: diff, words: underByWords(-diff) }
      : diff > 0
        ? { kind: 'over', cents: diff, words: overByWords(diff) }
        : { kind: 'even', cents: 0, words: EVEN_WORDS };
  }

  return {
    id: stay.id,
    place: stay.place,
    starts_on: stay.starts_on,
    ends_on: stay.ends_on,
    days,
    charges: all,
    paying,
    reversed,
    unreadable,
    chargesWords: chargesWords(paying, reversed, unreadable),
    totalCents,
    totalWords: totalCents === null ? BLANK : functionalMoneyWords(totalCents),
    perDayCents,
    perDayWords: perDayCents === null ? BLANK : functionalMoneyWords(perDayCents),
    perDayFormula: totalCents === null ? null : perDayFormulaWords(totalCents, days),
    byAccount,
    byAccountWords,
    baseline,
    baselineWords: baseline === null ? noBaselineWords(stay.starts_on) : baselineCellWords(baseline.label, baseline.monthlyWords, baseline.perDayWords),
    forTheStayMinor: forTheStay,
    forTheStayWords: forTheStay !== null && baseline !== null ? statedMoneyWords(forTheStay, baseline.currency) : BLANK,
    forTheStayFormula: baseline === null ? null : forTheStayFormulaWords(baseline.monthlyMinor, baseline.currency, days),
    underOver,
  };
}

/** Every stay of the caller with its figures — the stays in the order given (first day first), each with only its own linked postings. */
export function stayCostsOf(stays: readonly StayIn[], postingsOf: ReadonlyMap<string, readonly StayPostingIn[]>, baselines: readonly LivingBaselineRow[]): StayCost[] {
  return stays.map((s) => stayCostOf(s, postingsOf.has(s.id) ? (postingsOf.get(s.id) as readonly StayPostingIn[]) : [], baselines));
}

// ── THE BASELINES UNDER THE TABLE ───────────────────────────────────────────

export const BASELINE_LIVE_WORDS = 'live';
const dayOfInstant = (iso: string): string => iso.slice(0, 10);
export const baselineVoidedWords = (voidedAt: string, reason: string): string => `voided ${dayOfInstant(voidedAt)} — ${JSON.stringify(reason)}`;

/** A baseline as the list under the table shows it: label · effective from · monthly · per day · status. */
export interface BaselineView {
  readonly id: string;
  readonly label: string;
  readonly effectiveFrom: string;
  readonly monthlyWords: string;
  readonly perDayWords: string;
  readonly perDayFormula: string;
  readonly voided: boolean;
  readonly statusWords: string;
}

export function baselineViewOf(row: LivingBaselineRow): BaselineView {
  const b = stayBaselineOf(row);
  const voided = row.voided_at !== null;
  if (voided && row.void_reason === null) throw new Error(`stayCosts: baseline ${row.id} carries half a void — the void pair CHECK forbids it`);
  return {
    id: row.id,
    label: row.label,
    effectiveFrom: row.effective_from,
    monthlyWords: b.monthlyWords,
    perDayWords: b.perDayWords,
    perDayFormula: b.perDayFormula,
    voided,
    statusWords: voided ? baselineVoidedWords(row.voided_at as string, row.void_reason as string) : BASELINE_LIVE_WORDS,
  };
}

/** The list under the table, newest effective day first; voided ones stay, marked. */
export const baselineViewsOf = (rows: readonly LivingBaselineRow[]): BaselineView[] =>
  [...rows].sort((a, b) => (a.effective_from === b.effective_from ? b.created_at.localeCompare(a.created_at) : b.effective_from.localeCompare(a.effective_from))).map(baselineViewOf);

// ── THE TABLE (the one idiom — ruling E: Alex's column order) ───────────────

export const STAY_COST_COLUMNS = ['stay', 'place', 'days', 'charges', 'total', 'perDay', 'baseline', 'forTheStay', 'underOver', 'id'] as const;
export type StayCostColumn = (typeof STAY_COST_COLUMNS)[number];

export const STAY_COST_HEAD_WORDS: Readonly<Record<StayCostColumn, string>> = {
  stay: 'STAY', place: 'PLACE', days: 'DAYS', charges: 'CHARGES', total: 'TOTAL', perDay: 'PER DAY', baseline: 'BASELINE', forTheStay: 'FOR THE STAY', underOver: 'UNDER / OVER', id: 'ID',
};

/** The heads' tooltips — every calculated column names its rule (ROUTINES-03's `title`). */
export const STAY_COST_TITLES: Readonly<Partial<Record<StayCostColumn, string>>> = {
  days: `${CALCULATED_WORDS} — the stay's days, both ends counted`,
  charges: `${CALCULATED_WORDS} — the postings linked to the stay by hand; a reversed one pays nothing`,
  total: `${CALCULATED_WORDS} — the sum of the linked postings' debits, as the books hold them`,
  perDay: `${CALCULATED_WORDS} — TOTAL ÷ DAYS, rounded half away from zero once`,
  baseline: `${CALCULATED_WORDS} — the live baseline in force on the stay's first day; its day is monthly × 12 ÷ 365, rounded once`,
  forTheStay: `${CALCULATED_WORDS} — monthly × 12 × DAYS ÷ 365, rounded once`,
  underOver: `${CALCULATED_WORDS} — TOTAL − FOR THE STAY`,
};

/** The cell as the table prints it — and the words a filter matches. */
export function stayCostCellWords(row: StayCost, column: StayCostColumn): string {
  switch (column) {
    case 'stay': return staySpanWords(row.starts_on, row.ends_on);
    case 'place': return row.place;
    case 'days': return String(row.days);
    case 'charges': return row.chargesWords;
    case 'total': return row.totalWords;
    case 'perDay': return row.perDayWords;
    case 'baseline': return row.baselineWords;
    case 'forTheStay': return row.forTheStayWords;
    case 'underOver': return row.underOver.words;
    case 'id': return row.id;
  }
}

/** The CSV's field — the fact bare: money as csvMoney (a USD figure; a baseline's in its own currency says its code). */
function stayCostCsvOf(row: StayCost, column: StayCostColumn): string {
  switch (column) {
    case 'total': return csvMoney(row.totalCents);
    case 'perDay': return csvMoney(row.perDayCents);
    case 'forTheStay': return row.forTheStayMinor !== null && row.baseline !== null ? `${csvMoney(row.forTheStayMinor)}${row.baseline.currency === FUNCTIONAL_CURRENCY ? '' : ` ${row.baseline.currency}`}` : '';
    // Signed: under is negative. Not compared (or nothing to compare) is the empty field — its reason is in CHARGES, BASELINE or FOR THE STAY.
    case 'underOver': return csvMoney(row.underOver.cents);
    default: return stayCostCellWords(row, column);
  }
}

function stayCostSortOf(row: StayCost, column: StayCostColumn) {
  switch (column) {
    case 'stay': return textKey(row.starts_on);
    case 'days': return numberKey(row.days);
    case 'charges': return numberKey(row.paying);
    case 'total': return numberKey(row.totalCents);
    case 'perDay': return numberKey(row.perDayCents);
    case 'forTheStay': return numberKey(row.forTheStayMinor);
    case 'underOver': return numberKey(row.underOver.cents);
    default: return textKey(stayCostCellWords(row, column));
  }
}

const MONEY_CENTS: Partial<Record<StayCostColumn, (row: StayCost) => number | null>> = {
  total: (row) => row.totalCents,
  perDay: (row) => row.perDayCents,
  underOver: (row) => row.underOver.cents,
};

/** THE SPEC: TOTAL, PER DAY and UNDER / OVER are MONEY columns (the books' USD); FOR THE STAY and BASELINE are VALUE columns (a baseline may be stated in another currency); ID a TEXT column. */
export const STAY_COST_TABLE: readonly TableColumn<StayCost, StayCostColumn>[] = STAY_COST_COLUMNS.map((key): TableColumn<StayCost, StayCostColumn> => {
  const title = STAY_COST_TITLES[key];
  const base = {
    key,
    label: STAY_COST_HEAD_WORDS[key],
    ...(title === undefined ? {} : { title }),
    words: (row: StayCost) => stayCostCellWords(row, key),
    sortKey: (row: StayCost) => stayCostSortOf(row, key),
    csv: (row: StayCost) => stayCostCsvOf(row, key),
  };
  const money = MONEY_CENTS[key];
  if (money !== undefined) return { ...base, kind: 'money', cents: money };
  if (key === 'id') return { ...base, kind: 'text', text: (row) => row.id };
  return { ...base, kind: 'value' };
});
export const stayCostColumnOf = (column: StayCostColumn): TableColumn<StayCost, StayCostColumn> => columnOf(STAY_COST_TABLE, column);
export const STAY_COST_CSV_FILE_NAME = 'stays-calculated.csv';

// ── THE READ (TRAVEL-02b-fix's rule: a 200 without a list it promises fails by name) ─────

export const STAY_COSTS_ROUTE = '/api/operations/stays/costs';
export const STAY_COSTS_UNREADABLE_WORDS = 'the stays and their costs could not be read';
export const STAY_COSTS_LOADING_WORDS = 'calculating the stays…';
export const NO_STAYS_WORDS = 'no stay kept yet';
