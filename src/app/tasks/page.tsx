'use client';

/**
 * TOOL-LAW-01 — /tasks, TASKS' ONE PAGE (tool 02, THE WORK).
 *
 * It renders Tasks' own component and nothing else. The only phase strip on it
 * is the PROJECTS pipe's, from src/lib/pipePhases.ts, rendered where it already
 * lives: PER PROJECT ROW, inside TruthMachineView (:374-376 — "the per-project
 * strip — position indicator + scroll-jump nav … It never mounts or hides
 * anything"), behind that row's own pipelineMode toggle (ProjectRow.tsx:556).
 *
 * That is a real difference from every other tool's page and it is recorded
 * rather than smoothed over: the law's rule 2 requires the page to render only
 * this tool's phases from pipePhases.ts — it does NOT require a page-level
 * strip, and lifting these six phases to page level would mean restructuring a
 * 644-line component whose phases are scroll targets inside one render.
 *
 * PLAN-01 (2026-09-17) — TASKS IS THE PLANNING TAB. It draws TWO pipes now:
 * PROJECTS (per project row, as above) and ROUTINES (SectionE_Routines, moved
 * from /calendar, component intact). They are one act of planning — a routine
 * is a recurring commitment that generates recurring spend, a project is a body
 * of work whose tasks generate spend — and the calendar is the view both log to.
 *
 * TOOL-LAW-01 permits this EXPLICITLY, not by omission: THE SORT (nav.ts:118-119)
 * names Tasks the owner of both pipes, and the law's amendment (assert-tool-registry.ts,
 * PLAN-01) requires every pipe a page draws to be owned by that page's tool AND
 * every strip to be labelled with its pipe. A foreign pipe still fails.
 *
 * SectionE_Routines needed NO new provider: it reads useOperationsEntity, and
 * OperationsEntityProvider was already mounted here for the other three sections.
 *
 * North Star and the Daily Plan are Tasks' — verified, not assumed:
 * src/lib/ai/northStarContext.ts feeds generate-tasks, generate-design,
 * projects/[id]/research, projects/[id]/generate-tasks, projects/[id]/prompts
 * and projects/[id]/generate-design (phase 01 Input); SectionC_DailyPlan writes
 * /api/operations/daily-plan/items (:130), which the grid reads back as blocks
 * (HubCalendar.tsx:141) — phase 05 Plan.
 */
import AppLayout from '@/components/ui/AppLayout';
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import { OperationsEntityProvider } from '@/components/workbench/operations/EntitySelector';
import SectionB_NorthStar from '@/components/workbench/operations/SectionB_NorthStar';
import SectionC_DailyPlan from '@/components/workbench/operations/SectionC_DailyPlan';
import SectionD_ProjectBacklog from '@/components/workbench/operations/SectionD_ProjectBacklog';
import SectionE_Routines from '@/components/workbench/operations/SectionE_Routines';
import { PIPE_LABEL } from '@/lib/pipePhases';

export default function TasksPage() {
  return (
    <AppLayout page>
      <ToolOpener tools={[navToolByName('Tasks', TOOL_GATE)]} />
      <OperationsEntityProvider>
        <div className="space-y-3" data-tool-page="Tasks">
          <SectionB_NorthStar />
          {/* PLAN-01: each pipe's surface says WHICH pipe it is, so a reader is
              never left guessing which strip belongs to which body of work. */}
          <div data-pipe-section="projects">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-text-faint" data-pipe-label="projects">
              {PIPE_LABEL.projects}
            </div>
            <SectionD_ProjectBacklog />
          </div>
          <div data-pipe-section="routines">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-text-faint" data-pipe-label="routines">
              {PIPE_LABEL.routines}
            </div>
            <SectionE_Routines />
          </div>
          <SectionC_DailyPlan />
        </div>
      </OperationsEntityProvider>
    </AppLayout>
  );
}
