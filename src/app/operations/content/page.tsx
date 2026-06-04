/**
 * /operations/content
 *
 * Section G · Content page. The OperationsEntityProvider is wired in the
 * parent /operations/layout.tsx, so this page just mounts the content
 * surfaces directly — same shape as routines/page.tsx.
 *
 * SectionG_Content is the existing field-list table; PieceGrid (PR-Ops-
 * grid-5) is the pivoted scenes × days cell grid built on the same three
 * content tables. Both live on this tab.
 */

import SectionG_Content from '@/components/workbench/operations/content/SectionG_Content';
import PieceGrid from '@/components/workbench/operations/content/PieceGrid';
import QuestionLibrary from '@/components/workbench/operations/content/QuestionLibrary';
import DailyLog from '@/components/workbench/operations/content/DailyLog';

export default function OperationsContentPage() {
  return (
    <div className="space-y-4">
      <SectionG_Content />
      <QuestionLibrary />
      <DailyLog />
      <PieceGrid />
    </div>
  );
}
