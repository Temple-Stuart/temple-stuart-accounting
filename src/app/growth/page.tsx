import BudgetingPage from '@/components/dashboard/BudgetingPage';

export default function GrowthPage() {
  return <BudgetingPage category="Growth" emoji="📈" apiPath="/api/growth" />;
}
