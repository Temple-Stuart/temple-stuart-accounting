/**
 * INTAKE-01 (2026-09-28) — A PLAN'S MONEY IS CHECKED WHEN IT IS SAVED.
 *
 * Routines, their lines and project tasks are where money is planned, and
 * /budget reads them (src/app/api/budget/report/route.ts). Seven writers save
 * that money (the routine create and edit, the line create and edit, the task
 * create and edit, and the assign route); before this file no two checked it
 * the same way. Every one of them asks here before its first write, and a
 * refusal is a 400 naming the writer's own field — nothing is written.
 *
 * THE ACCOUNT (Alex, rulings B · M, 2026-09-28). Blank or absent → no account.
 * Otherwise it is read by the chart's own rule (scheme.ts parseCode, the book's
 * entity type — its words are the refusal, verbatim); exactly one row of the
 * book's chart (archived rows included) must read as that account — none is
 * "not an account", two or more are refused by name, as the budget report's own
 * collision rule refuses them (src/lib/budget/reportInputs.ts); that row must be
 * open; and it must be an income or expense account — account_type 'revenue' or
 * 'expense', the two the report reads (report/route.ts:82). Income is planned the
 * same way as spending (ruling G). What is stored is the chart row's code EXACTLY
 * as the chart saves it. A chart row the rule cannot read is no account at all;
 * the budget report refuses such a row on its own.
 *
 * THE AMOUNT. Blank or absent → no amount (null, never 0). Otherwise the one
 * amount rule (routineInput.ts parseBudgetAmountOrNull): non-negative, at most two
 * decimals, never rounded. It must also fit its column — Decimal(12,2) for a
 * routine or a line, Decimal(15,2) for a task (prisma/schema.prisma).
 *
 * THE PAIR (ruling F). An amount needs its account and an account needs its
 * amount: a plan /budget cannot place is not saved.
 *
 * Every message shows an account as its account string (accountString.ts) —
 * B-6110, never 6110. Pure: no Prisma client, no request, no clock.
 */
import { ValidationError } from '@/lib/errors/ValidationError';
import { parseCode } from '@/lib/coa/scheme';
import { deriveAccountString } from '@/lib/accountString';
import { parseBudgetAmountOrNull, type InputRefusal } from '@/lib/operations/routineInput';

/** Which column the amount lands in: a routine's or a line's Decimal(12,2), or a task's Decimal(15,2). */
export type PlanColumn = 'routine' | 'task';

/** Digits before the point each column holds (precision − scale). */
export const PLAN_COLUMN_DIGITS: Readonly<Record<PlanColumn, number>> = { routine: 10, task: 13 };

/** One chart row as the book's chart saves it. */
export interface PlanChartRow {
  readonly code: string;
  readonly name: string;
  readonly account_type: string;
  readonly is_archived: boolean;
}

/** The book a plan's money is checked against: its entity and its whole chart (loadPlanBook.ts). */
export interface PlanBook {
  readonly id: string;
  readonly name: string;
  readonly entityType: string;
  readonly chart: readonly PlanChartRow[];
}

/** The amount and the account as the writer received them — or, on an edit, as they will be. */
export interface PlanMoneySent {
  readonly amount: unknown;
  readonly account: unknown;
}

/** The writer's own names for the two fields, as a refusal names them. */
export interface PlanMoneyFields {
  readonly amount: string;
  readonly account: string;
}

/** What the writer stores: the amount as the rule reads it, and the chart row's code as saved. */
export interface PlanMoney {
  readonly amount: string | null;
  readonly coaCode: string | null;
}

/** Blank: absent, null, or a string of nothing but spaces. */
export function isBlankPlanValue(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
}

/** Does this pair carry any money? A pair that does not never needs its book — the chart is not read. */
export function carriesPlanMoney(sent: PlanMoneySent): boolean {
  return !isBlankPlanValue(sent.amount) || !isBlankPlanValue(sent.account);
}

/** A money column as stored — Prisma's Decimal, or null. */
export interface StoredPlanMoney {
  readonly amount: { toString(): string } | null;
  readonly account: string | null;
}

const storedAmount = (stored: StoredPlanMoney): string | null => (stored.amount === null ? null : stored.amount.toString());

/**
 * R6 · AN EDIT (the routine, line and task edits). Neither key sent → null: the
 * pair is untouched and nothing is read. Either sent → the EFFECTIVE pair, the
 * body's value where its key was sent, else the stored one — checked whole, and
 * both columns written.
 */
export function editedPlanMoney(sentAmount: unknown, sentAccount: unknown, stored: StoredPlanMoney): PlanMoneySent | null {
  if (sentAmount === undefined && sentAccount === undefined) return null;
  return {
    amount: sentAmount !== undefined ? sentAmount : storedAmount(stored),
    account: sentAccount !== undefined ? sentAccount : stored.account,
  };
}

/**
 * R6 · THE ASSIGN ROUTE. A blank field counts as not sent (as that route always
 * read it); nothing sent → null, and the task's money is not touched. Otherwise
 * the pair that will be STORED: the account sent, else the stored one; and the
 * cost the route keeps — the stored cost when there is one (never overwritten),
 * else the cost sent.
 */
export function assignedPlanMoney(sentAmount: unknown, sentAccount: unknown, stored: StoredPlanMoney): PlanMoneySent | null {
  const accountSent = !isBlankPlanValue(sentAccount);
  const amountSent = !isBlankPlanValue(sentAmount);
  if (!accountSent && !amountSent) return null;
  const kept = storedAmount(stored);
  return {
    account: accountSent ? sentAccount : stored.account,
    amount: kept !== null ? kept : amountSent ? sentAmount : null,
  };
}

/** The four digits a saved chart code reads as by the chart's rule, or null for a row the rule cannot read. */
function readsAs(saved: string, entityType: string): string | null {
  try {
    return parseCode(saved, entityType);
  } catch (error) {
    if (error instanceof ValidationError) return null;
    throw error;
  }
}

const articled = (word: string): string => (/^[aeiou]/i.test(word) ? `an ${word}` : `a ${word}`);

/**
 * The rule. Both blank → no money. Otherwise the amount, the pair and the
 * account, in that order; the first refusal is returned, naming its field.
 * A pair that carries money must come with its book — a missing book is the
 * caller's bug, thrown, never a refusal and never a pass.
 */
export function planMoney(
  sent: PlanMoneySent,
  book: PlanBook | null,
  column: PlanColumn,
  fields: PlanMoneyFields,
): { value: PlanMoney } | { error: InputRefusal } {
  const noAmount = isBlankPlanValue(sent.amount);
  const noAccount = isBlankPlanValue(sent.account);
  if (noAmount && noAccount) return { value: { amount: null, coaCode: null } };

  // R3 · the amount — the one amount rule, then the column it lands in.
  let amount: string | null = null;
  if (!noAmount) {
    const read = parseBudgetAmountOrNull(sent.amount);
    if ('error' in read) return { error: { field: fields.amount, message: read.error.message } };
    amount = read.value;
    if (amount !== null) {
      const whole = amount.split('.')[0].replace(/^0+(?=\d)/, '');
      const digits = PLAN_COLUMN_DIGITS[column];
      if (whole.length > digits) {
        return { error: { field: fields.amount, message: `${amount} is too large — ${column === 'routine' ? "a routine's" : "a task's"} amount holds at most ${digits} digits before the point` } };
      }
    }
  }

  // R4 · the pair — both or neither.
  if (noAccount) {
    return { error: { field: fields.account, message: 'an amount needs its account — choose the income or expense account this money goes on' } };
  }
  if (noAmount) {
    return { error: { field: fields.amount, message: 'an account needs its amount — enter the amount, or clear the account' } };
  }
  if (book === null) {
    throw new Error('planMoney: a plan carrying money was checked without its book — the writer loads the book first');
  }

  // R2 (a) · the chart's rule reads the account; its words are the refusal.
  let code: string;
  try {
    code = parseCode(sent.account, book.entityType);
  } catch (error) {
    if (error instanceof ValidationError) return { error: { field: fields.account, message: error.message } };
    throw error;
  }
  const account = deriveAccountString({ entityType: book.entityType, code });

  // R2 (b) · exactly one row of the book's chart reads as it — archived rows included.
  const rows = book.chart.filter((row) => readsAs(row.code, book.entityType) === code);
  if (rows.length === 0) {
    return { error: { field: fields.account, message: `${account} is not an account in ${book.name}'s chart` } };
  }
  if (rows.length > 1) {
    const named = rows.map((row) => `code ${JSON.stringify(row.code)}, ${JSON.stringify(row.name)}`).join(' and ');
    return { error: { field: fields.account, message: `${account} is ${rows.length} accounts in ${book.name}'s chart — ${named} — fix the chart in Books first` } };
  }
  const row = rows[0];

  // R2 (c) · open.
  if (row.is_archived) {
    return { error: { field: fields.account, message: `${account} ${row.name} is archived in ${book.name}'s chart — choose an open account` } };
  }

  // R2 (d) · an income or expense account — the two /budget reads.
  if (row.account_type !== 'revenue' && row.account_type !== 'expense') {
    return { error: { field: fields.account, message: `${account} ${row.name} is ${articled(row.account_type)} account — a plan's money goes on an income or expense account` } };
  }

  // R2 (e) · the chart row's code exactly as the chart saves it.
  return { value: { amount, coaCode: row.code } };
}
