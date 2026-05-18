/**
 * src/app/operations/page.tsx
 *
 * Daily Plan — Operations home. Renders Section B (North Star) and
 * Section C (Daily Plan — operations_daily_plan_items, date-navigated).
 *
 * Chrome (identity bar + sub-nav) is provided by the parent
 * src/app/operations/layout.tsx.
 */

import SectionB_NorthStar from '@/components/workbench/operations/SectionB_NorthStar';
import SectionC_DailyPlan from '@/components/workbench/operations/SectionC_DailyPlan';

export default function OperationsDailyPlanPage() {
  return (
    <>
      <SectionB_NorthStar />
      <SectionC_DailyPlan />
    </>
  );
}
