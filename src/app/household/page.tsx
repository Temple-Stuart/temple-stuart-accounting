import AppLayout from '@/components/ui/AppLayout';
import BudgetingPage from '@/components/dashboard/BudgetingPage';

// SHELL-02: this room moved /home → /household so /home could become the app's
// front door (THE ANSWERS). Its LABEL is unchanged — the registry still calls it
// "Home", the household budget, a flat sibling of /personal /auto /growth /health.
// ACCOUNTS-01: a signed-in room mounts the app shell, so THE RAIL is here too. AppLayout
// is the shell most rooms already use — it authenticates itself (/api/auth/me), bounces a
// guest, and carries the rail beside the page. The room's own body is unchanged.
export default function HouseholdPage() {
  return (
    <AppLayout>
      <BudgetingPage category="Home" emoji="🏠" apiPath="/api/home" />
    </AppLayout>
  );
}
