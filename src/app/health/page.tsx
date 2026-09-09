import AppLayout from '@/components/ui/AppLayout';
import BudgetingPage from '@/components/dashboard/BudgetingPage';

// ACCOUNTS-01: a signed-in room mounts the app shell, so THE RAIL is here too. AppLayout
// is the shell most rooms already use — it authenticates itself (/api/auth/me), bounces a
// guest, and carries the rail beside the page. The room's own body is unchanged.
export default function HealthPage() {
  return (
    <AppLayout>
      <BudgetingPage category="Health" emoji="🏥" apiPath="/api/health" />
    </AppLayout>
  );
}
