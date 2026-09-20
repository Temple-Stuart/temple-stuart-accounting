'use client';

/**
 * TOOL-LAW-01 — /tasks, TASKS' ONE PAGE (tool 02, THE WORK).
 *
 * TASKS-01 (2026-09-18) — TASKS IS TWO LISTS. Projects, then routines, then
 * the daily plan, and nothing else: no pipe strip, no phase, no receipts rail.
 * What the two strips used to hold survives as PLAIN CONTROLS on the rows
 * (create, edit, archive, delete, the project's own pipeline behind a button,
 * today's occurrences with mark-done above the routine list) — a control does
 * a job; a phase only filtered the same list. PHASES_RENDERED_AT['/tasks'] is
 * [] (src/lib/nav.ts), and the two-lists law (scripts/assert-tool-registry.ts)
 * refuses a StageStrip anywhere in this page's import tree. The pipes
 * themselves (pipePhases.ts routines/projects, THE SORT's lines) stay defined
 * for the logged-out showcases until PIPES-01 retires them — named in the
 * TASKS-01 PR body with its exact scope.
 *
 * PLAN-01 (2026-09-17) — TASKS IS THE PLANNING TAB. Projects and routines are
 * one act of planning: a routine is a recurring commitment that generates
 * recurring spend, a project is a body of work whose tasks generate spend, and
 * the calendar is the view both log to. THE SORT (nav.ts) names Tasks the
 * owner of both pipes; the routine builder moved here from /calendar.
 *
 * SectionE_Routines needs no new provider: it reads useOperationsEntity, and
 * OperationsEntityProvider is mounted here for the other two sections.
 *
 * The Daily Plan is Tasks' — verified, not assumed: SectionC_DailyPlan writes
 * /api/operations/daily-plan/items (:130), which the grid reads back as blocks
 * (HubCalendar.tsx:147).
 *
 * NORTH-01 (2026-09-18): the North Star is not rendered inline here. It is
 * still Tasks' — reached the way Issue log and Audit trail are, as a sub-row
 * of this tool's rail entry (a `links` entry on the registry row) that opens
 * its own page, src/app/operations/north-star/page.tsx.
 */
import AppLayout from '@/components/ui/AppLayout';
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import { OperationsEntityProvider } from '@/components/workbench/operations/EntitySelector';
import SectionC_DailyPlan from '@/components/workbench/operations/SectionC_DailyPlan';
import SectionD_ProjectBacklog from '@/components/workbench/operations/SectionD_ProjectBacklog';
import SectionE_Routines from '@/components/workbench/operations/SectionE_Routines';

export default function TasksPage() {
  return (
    <AppLayout page>
      <ToolOpener tools={[navToolByName('Tasks', TOOL_GATE)]} />
      <OperationsEntityProvider>
        <div className="space-y-3" data-tool-page="Tasks">
          <SectionD_ProjectBacklog />
          <SectionE_Routines />
          <SectionC_DailyPlan />
        </div>
      </OperationsEntityProvider>
    </AppLayout>
  );
}
