'use client';

import { useState, useEffect } from 'react';
import { FUNCTIONAL_CURRENCY_WORDS, functionalMoneyWords } from '@/lib/books/functionalCurrency';
import { unclassifiedWords, type Statements } from '@/lib/books/statements';
import type { StatementScope } from '@/lib/books/statementsRead';
import StatementScopeSelect, { readScoped, scopeWordsOf, startingChoiceOf, throughWordsOf, type ScopeChoice, type ScopeProps } from '@/components/dashboard/StatementScopeSelect';

/**
 * FX-01b (Alex, 2026-10-30, ruling A): the statements are kept in integer CENTS and every figure is written by the
 * one formatter; nothing is divided into dollars here. The ratios are dimensionless and computed from the same cents.
 *
 * BOOKS-01 (Alex, 2026-11-11 12:08: "get bookkeeping full proof") — THE PANEL SAYS ITS BOOK AND YEAR, AND DRAWS THE
 * ONE FUNCTION'S FIGURES. Until this it asked /api/statements with no year and no book, added Math.abs(debits −
 * credits) per account per month by type, and checked assets against liabilities + equity with no net income in it —
 * so it read "not balanced" over books whose trial balance balanced. Now it reads the route's `scope` and `statements`
 * — the one function over the one read (src/lib/books/statements.ts, statementsRead.ts) — for the book and year its
 * own selects hold, and draws those figures as they are: signed, the balance sheet through the year's last day, the
 * earnings no closing entry has moved into equity yet on their own line. The mark, and the figure the sheet is out
 * by, are the function's. One line is two of the function's totals added — "Liabilities + equity" (totalLiabilities +
 * totalEquity), as the Export's CSV prints it; the function hands no such total.
 */

/** What the panel reads of /api/statements' answer: the scope the route read, and the statements over it. */
export interface StatementsAnswer {
  readonly scope: StatementScope;
  readonly statements: Statements;
}

const unreadableWords = (what: string): string => `statements: the answer carries no readable ${what}`;

/** The figures the panel draws, by the block that holds them — each a whole number of cents, or the answer is refused. */
const DRAWN = {
  incomeStatement: ['totalRevenue', 'totalExpenses', 'netIncome'],
  balanceSheet: ['totalAssets', 'totalLiabilities', 'equityAccounts', 'earningsNotClosed', 'totalEquity', 'difference'],
} as const;

/**
 * THE ANSWER, READ. The scope must say its year, its last day and its book; every figure the panel draws must be a
 * whole number of cents; the mark must be a boolean; every unclassified account must carry its code. Anything else
 * throws by name and the panel prints the words — a missing figure is never a blank or a zero on the screen.
 */
export function statementsAnswerOf(body: unknown): StatementsAnswer {
  const answer = body as { scope?: unknown; statements?: unknown } | null | undefined;
  const scope = answer?.scope as Partial<StatementScope> | null | undefined;
  const statements = answer?.statements as { [block: string]: unknown } | null | undefined;
  if (typeof scope !== 'object' || scope === null) throw new Error(unreadableWords('scope'));
  if (typeof statements !== 'object' || statements === null) throw new Error(unreadableWords('statements'));
  if (!Number.isSafeInteger(scope.year)) throw new Error(unreadableWords('scope.year'));
  if (scope.entityName !== null && typeof scope.entityName !== 'string') throw new Error(unreadableWords('scope.entityName'));
  throughWordsOf(scope.through);
  for (const [block, names] of Object.entries(DRAWN)) {
    const figures = statements[block] as { [name: string]: unknown } | null | undefined;
    for (const name of names) {
      if (typeof figures !== 'object' || figures === null || !Number.isSafeInteger(figures[name])) throw new Error(unreadableWords(`${block}.${name}`));
    }
  }
  if (typeof (statements.balanceSheet as { isBalanced?: unknown }).isBalanced !== 'boolean') throw new Error(unreadableWords('balanceSheet.isBalanced'));
  const unclassified = statements.unclassified;
  if (!Array.isArray(unclassified) || unclassified.some((u) => typeof (u as { code?: unknown } | null)?.code !== 'string')) throw new Error(unreadableWords('unclassified'));
  return { scope: scope as StatementScope, statements: statements as unknown as Statements };
}

/** The read: /api/statements for the panel's own book and year. A failure throws the words the panel prints. */
const fetchStatements = async (choice: ScopeChoice): Promise<StatementsAnswer> => statementsAnswerOf(await readScoped('/api/statements', choice));

/** What a ratio with no divisor prints. */
export const RATIO_NONE_WORDS = 'N/A';

/** A ratio in words. A divisor of 0 is a ratio that does not exist — "N/A", never a zero in its place. */
export function ratioWords(numerator: number, divisor: number, kind: 'percent' | 'times'): string {
  if (divisor === 0) return RATIO_NONE_WORDS;
  const ratio = numerator / divisor;
  return kind === 'percent' ? `${(ratio * 100).toFixed(1)}%` : ratio.toFixed(2);
}

function Figure({ label, cents, tone }: { label: string; cents: number; tone: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-text-secondary">{label}</span>
      <span className={`text-terminal-lg font-semibold ${tone}`}>{functionalMoneyWords(cents)}</span>
    </div>
  );
}

/** THE STATEMENTS, DRAWN — the route's figures as they are, through the one formatter. No state, no fetch. */
export function StatementsView({ scope, statements }: StatementsAnswer) {
  const { incomeStatement, balanceSheet } = statements;
  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-semibold" data-statement-scope-line>{scopeWordsOf(scope)}</div>
        <div className="text-xs text-text-muted font-mono" data-functional-currency>{FUNCTIONAL_CURRENCY_WORDS}</div>
      </div>
      <div className="grid grid-cols-2 gap-6">
        {/* Income Statement */}
        <div className="bg-white border rounded p-6">
          <h3 className="text-sm font-semibold mb-6">{`Income Statement · ${scope.year}`}</h3>

          <div className="space-y-4">
            <Figure label="Revenue" cents={incomeStatement.totalRevenue} tone="text-brand-green" />
            <Figure label="Expenses" cents={incomeStatement.totalExpenses} tone="text-brand-red" />

            <div className="border-t pt-4 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-terminal-lg font-bold">Net income</span>
                <span className={`text-sm font-bold ${incomeStatement.netIncome >= 0 ? 'text-brand-green' : 'text-brand-red'}`} data-net-income>
                  {functionalMoneyWords(incomeStatement.netIncome)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Balance Sheet */}
        <div className="bg-white border rounded p-6">
          <h3 className="text-sm font-semibold mb-6">{`Balance Sheet · through ${throughWordsOf(scope.through)}`}</h3>

          <div className="space-y-4">
            <Figure label="Assets" cents={balanceSheet.totalAssets} tone="" />
            <Figure label="Liabilities" cents={balanceSheet.totalLiabilities} tone="" />
            <Figure label="Equity accounts" cents={balanceSheet.equityAccounts} tone="" />
            <Figure label="Earnings not yet closed" cents={balanceSheet.earningsNotClosed} tone="" />

            <div className="border-t pt-4 mt-4 space-y-2">
              <Figure label="Liabilities + equity" cents={balanceSheet.totalLiabilities + balanceSheet.totalEquity} tone="" />
              <div className={`text-sm font-semibold ${balanceSheet.isBalanced ? 'text-brand-green' : 'text-brand-red'}`} data-balance-mark>
                {balanceSheet.isBalanced ? '✓ Assets = Liabilities + Equity' : `⚠ Out by ${functionalMoneyWords(Math.abs(balanceSheet.difference))}`}
              </div>
            </div>
          </div>
        </div>
      </div>

      {statements.unclassified.length > 0 && (
        <div role="alert" className="text-xs text-brand-red" data-statement-unclassified>{unclassifiedWords(statements.unclassified.map((u) => u.code))}</div>
      )}

      {/* Quick Stats */}
      <div className="bg-white border rounded p-6">
        <h3 className="text-terminal-lg font-semibold mb-4">Quick Ratios</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="border rounded p-4 text-center">
            <div className="text-sm text-text-secondary mb-1">Profit Margin</div>
            <div className="text-sm font-bold" data-ratio="net-income-over-revenue">{ratioWords(incomeStatement.netIncome, incomeStatement.totalRevenue, 'percent')}</div>
          </div>

          <div className="border rounded p-4 text-center">
            <div className="text-sm text-text-secondary mb-1">Assets ÷ Liabilities</div>
            <div className="text-sm font-bold" data-ratio="assets-over-liabilities">{ratioWords(balanceSheet.totalAssets, balanceSheet.totalLiabilities, 'times')}</div>
          </div>

          <div className="border rounded p-4 text-center">
            <div className="text-sm text-text-secondary mb-1">ROE</div>
            <div className="text-sm font-bold" data-ratio="net-income-over-equity">{ratioWords(incomeStatement.netIncome, balanceSheet.totalEquity, 'percent')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** What a read came to, and the choice it was read for. */
type Outcome =
  | { readonly choice: ScopeChoice; readonly ok: true; readonly answer: StatementsAnswer }
  | { readonly choice: ScopeChoice; readonly ok: false; readonly reason: string };

export default function FinancialStatementsTab({ books, defaultBookId, years, currentYear }: ScopeProps) {
  // The panel's OWN choice — it starts on the default book and the current year, and the Export keeps its own.
  const [choice, setChoice] = useState<ScopeChoice>(() => startingChoiceOf(defaultBookId, currentYear));
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    // Only the newest choice's answer is kept: an earlier read that lands late is dropped.
    let newest = true;
    fetchStatements(choice).then(
      (answer) => { if (newest) setOutcome({ choice, ok: true, answer }); },
      (failure: unknown) => { if (newest) setOutcome({ choice, ok: false, reason: failure instanceof Error ? failure.message : String(failure) }); },
    );
    return () => { newest = false; };
  }, [choice]);

  // An outcome is drawn only under the choice it was read for — until that read lands, the panel says it is loading.
  const shown = outcome !== null && outcome.choice === choice ? outcome : null;

  return (
    <div className="p-4 space-y-6">
      <StatementScopeSelect books={books} years={years} currentYear={currentYear} choice={choice} onChange={setChoice} />
      {shown === null && <div className="p-8 text-center">Loading statements...</div>}
      {shown !== null && !shown.ok && <div role="alert" className="p-8 text-center text-brand-red" data-statements-failed>{shown.reason}</div>}
      {shown !== null && shown.ok && <StatementsView scope={shown.answer.scope} statements={shown.answer.statements} />}
    </div>
  );
}
