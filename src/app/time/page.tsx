'use client';

/**
 * TOOL-LAW-01 — /time, TIME'S ONE PAGE (tool 03, THE WORK).
 *
 * It renders Time's own component and nothing else. The only phase strip on it
 * is the CONTENT pipe's four phases, from src/lib/pipePhases.ts, rendered by
 * ContentPipeline itself (:371) — a PAGE-LEVEL strip, the same shape
 * BooksPipeline uses.
 *
 * DayCalendarView rides phase 03 (ContentPipeline.tsx:537) and is NOT a
 * violation of rule 5: it renders the day's blocks as a clock-ordered list, not
 * the merged grid. Its own doc says so — "a dense, ONE-LINE stacked list in
 * clock order (NOT an hour-grid)". It is this phase's own surface, so it is
 * Time's. The law names it as an explicit non-violation so this is not
 * re-litigated.
 */
import AppLayout from '@/components/ui/AppLayout';
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import { OperationsEntityProvider } from '@/components/workbench/operations/EntitySelector';
import ContentPipeline from '@/components/workbench/operations/content/ContentPipeline';

export default function TimePage() {
  return (
    <AppLayout page>
      <ToolOpener tools={[navToolByName('Time', TOOL_GATE)]} />
      <OperationsEntityProvider>
        <div data-tool-page="Time">
          <ContentPipeline />
        </div>
      </OperationsEntityProvider>
    </AppLayout>
  );
}
