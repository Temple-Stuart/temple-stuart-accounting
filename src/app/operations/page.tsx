/**
 * src/app/operations/page.tsx
 *
 * Daily Plan — Operations home. Renders Section B (North Star) and
 * Section C (Today's Decision) as placeholders. Real wiring lands in
 * later PRs (PR-Ops-2b for North Star, PR-Ops-4 for Today's Decision).
 *
 * Chrome (identity bar + sub-nav) is provided by the parent
 * src/app/operations/layout.tsx.
 */

import PlaceholderCard from '@/components/workbench/operations/PlaceholderCard';
import SectionB_NorthStar from '@/components/workbench/operations/SectionB_NorthStar';

export default function OperationsDailyPlanPage() {
  return (
    <>
      <SectionB_NorthStar />
      <PlaceholderCard letter="C" title="TODAY'S DECISION" unbuiltLabel="UNBUILT · PR-Ops-4" />
    </>
  );
}
