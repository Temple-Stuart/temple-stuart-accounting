import BudgetingPage from '@/components/dashboard/BudgetingPage';

export default function PersonalPage() {
  return <BudgetingPage category="Personal" emoji="👤" apiPath="/api/personal" />;
}
