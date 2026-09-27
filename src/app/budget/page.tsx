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
 * The view lives in the URL (?view=day&day= · week&weekOf= · year&year=) and the
 * report reads it there — no browser storage, no client state beyond the fetch.
 */
export const dynamic = 'force-dynamic';

export default function BudgetPage() {
  const budget = navToolByName('Budget', TOOL_GATE);

  return (
    <AppLayout page>
      <ToolOpener
        tools={[budget]}
        line="What you planned, what posted, and the difference — by book and account."
      />
      <BudgetReport />
    </AppLayout>
  );
}
