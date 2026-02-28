import BudgetingPage from '@/components/dashboard/BudgetingPage';

export default function BusinessPage() {
  return <BudgetingPage category="Business" emoji="💼" apiPath="/api/business" />;
}
