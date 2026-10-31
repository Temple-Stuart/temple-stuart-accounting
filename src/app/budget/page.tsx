import AppLayout from '@/components/ui/AppLayout';
import BudgetReport from '@/components/budget/BudgetReport';
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';

/**
 * /budget — Budget's ONE page (STEP 11's room, ROOM-01).
 *
 * TAB13-02b (2026-09-27): the room renders THE BUDGET REPORT — what you planned,
 * what posted, and the difference, by book and account (src/components/budget/
 * BudgetReport.tsx, reading GET /api/budget/report). The six-category switcher,
 * its unknown-category line and the BudgetingPage mount left this page with it.
 * Nothing was deleted: BudgetingPage.tsx and src/lib/budgetCategories.ts stay,
 * and the six legacy category URLs still redirect here (ROOM-01).
 *
 * BUDGET-02 (Alex, 2026-10-20): Budget is one page — the three tables, every
 * revenue and expense account × month, each figure drilling to its plan or
 * ledger lines. The year lives in the URL (?year=YYYY, its only key) and the
 * report reads it there — no browser storage; the open drill is React state.
 * The opener's line is ruling I's.
 */
export const dynamic = 'force-dynamic';

export default function BudgetPage() {
  const budget = navToolByName('Budget', TOOL_GATE);

  return (
    <AppLayout page>
      <ToolOpener
        tools={[budget]}
        line="Budget vs actual by account, month by month — click a figure for the lines behind it."
      />
      <BudgetReport />
    </AppLayout>
  );
}
