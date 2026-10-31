/**
 * localToday — THE BROWSER'S DATE, read in one place (WEEK-01, 2026-09-30).
 *
 * The viewer's local date, 'YYYY-MM-DD'. Moved out of BudgetReport.tsx so
 * /budget and the Tasks tab's week read today the same way. It reads the clock,
 * so it lives outside src/lib/budget and outside every file the budget report
 * purity law reads; a screen calls it on mount, never during the server render
 * (whose clock and zone are the server's).
 */
export function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}
