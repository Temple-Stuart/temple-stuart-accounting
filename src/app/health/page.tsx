import BudgetingPage from '@/components/dashboard/BudgetingPage';

export default function HealthPage() {
  return <BudgetingPage category="Health" emoji="🏥" apiPath="/api/health" />;
}
