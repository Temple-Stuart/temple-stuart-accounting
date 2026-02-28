import BudgetingPage from '@/components/dashboard/BudgetingPage';

export default function HomePage() {
  return <BudgetingPage category="Home" emoji="🏠" apiPath="/api/home" />;
}
