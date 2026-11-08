/**
 * The home month law's seeded regressions — clause 6 as SUPERSEDE-01b (Alex, 2026-11-08, ruling I) left it.
 *
 * THE BANK ROW AND THE SUPERSEDED ROW: BudgetReport prints the book tables, then the BANK row, then the SUPERSEDED BY
 * TRAVEL row (the #1886 gap line retired) — on /budget and on /home. Each seed breaks one check and must fail THE HOME
 * MONTH LAW by name:
 *
 *   a. the SUPERSEDED row removed from the screen;
 *   b. the SUPERSEDED row printed before the BANK row;
 *   c. the row's label retyped;
 *   d. the gap line brought back;
 *   e. a SUPERSEDED cell printed without supersededCellWords.
 *
 * No seeds file existed for this law before SUPERSEDE-01b (HOME-LEDGER-02a, which wrote it, proved it by its tests);
 * this one covers the clause this PR edits. The anchors occur exactly once in their file, which the harness enforces
 * before it runs anything.
 */
import type { Seed } from '../prove';

const REPORT = 'src/components/budget/BudgetReport.tsx';
const VIEW = 'src/lib/budget/reportView.ts';
const ROW = '            <SupersededRow columns={report.columns} totals={report.totals} />';
const BANK = '            <BankRow columns={report.columns} notInBooks={notInBooks} />';
const LABEL = "export const SUPERSEDED_ROW_LABEL = 'SUPERSEDED BY TRAVEL — not counted';";
const CELL = '{supersededCellWords(totals[i].superseded)}';

export const SEEDS: Seed[] = [
  {
    name: 'homemonth-a the SUPERSEDED row is removed from the screen',
    file: REPORT,
    find: ROW,
    replace: '',
    expect: 'src/components/budget/BudgetReport.tsx does not print the book tables, then the BANK row, then the SUPERSEDED row',
  },
  {
    name: 'homemonth-b the SUPERSEDED row prints before the BANK row',
    file: REPORT,
    find: BANK,
    replace: `${ROW}\n${BANK}`,
    expect: 'src/components/budget/BudgetReport.tsx does not print the book tables, then the BANK row, then the SUPERSEDED row',
  },
  {
    name: 'homemonth-c the row label is retyped',
    file: VIEW,
    find: LABEL,
    replace: "export const SUPERSEDED_ROW_LABEL = 'SUPERSEDED — not counted';",
    expect: 'src/lib/budget/reportView.ts does not declare SUPERSEDED_ROW_LABEL',
  },
  {
    name: 'homemonth-d the gap line comes back',
    file: VIEW,
    find: LABEL,
    replace: `${LABEL}\nexport const SUPERSEDED_GAP_WORDS = 'Budget counts every routine occurrence; the day card leaves out the ones superseded by travel — this table does not yet (SUPERSEDE-01)';`,
    expect: 'still holds the gap line — Budget leaves a superseded occurrence out',
  },
  {
    name: 'homemonth-e a SUPERSEDED cell prints its count raw',
    file: REPORT,
    find: CELL,
    replace: '{totals[i].superseded.count}',
    expect: 'src/components/budget/BudgetReport.tsx does not print each SUPERSEDED cell through supersededCellWords',
  },
];
