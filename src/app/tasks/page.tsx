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
 * WEEK-01 (2026-09-30): THIS WEEK comes first — Monday to Sunday, every
 * routine on every day, done with its note, each paid routine's place and
 * amount for the day, each day's tasks (week/WeekSection.tsx). It reads
 * useOperationsEntity, so it sits inside the provider with the lists.
 *
 * NORTH-01 (2026-09-18): the North Star is not rendered inline here. It is
 * still Tasks' — reached the way Issue log and Audit trail are, as a sub-row
 * of this tool's rail entry (a `links` entry on the registry row) that opens
 * its own page, src/app/operations/north-star/page.tsx.
 *
 * TASKS-ONE-01 (2026-10-14) — Alex's ruling: the day card is the first section
 * of Tasks — one Tasks page, no sub-tabs. DayCard (day/DayCard.tsx) mounts
 * first, above the week; its ‹ › and step controls push /tasks?date=&step=, so
 * the URL stays here, and /tasks/day is one hop to it. The card reads the URL
 * through useSearchParams and this page is a client page that Next prerenders,
 * so the card sits in its own <Suspense> boundary — the one Next requires
 * there; the page around it still prerenders, and the card renders in the
 * browser from the URL, as it did at /tasks/day. It reads no entity: it is in
 * the provider only because the sections share one container. The Issue log
 * link is gone with its page; North Star and Audit trail stay.
 *
 * TASKS-ONE-02 (2026-10-14) — Alex's ruling: the day card replaces the week
 * grid, the Daily plan and the Today strip. THREE sections now: the day card,
 * Projects, Routines. week/WeekSection.tsx (WEEK-01 above) and
 * SectionC_DailyPlan.tsx (the Daily Plan above) are deleted with WeekCell,
 * weekPlan, DailyPlanItemRow, DailyPlanRoutineRow and TodaysStrip; a stop
 * recorded done on the day card is the routine's done
 * (src/lib/operations/routineCompletion.ts). Projects' "↗ schedule" still puts
 * a task on a day; week/weekReads.ts stays — the day card reads through it.
 *
 * LEDGER-01 (Alex, 2026-10-16) — THE CITY LEDGER is the fourth section, under
 * Routines: every stop recorded, by date, city, country, COA and vendor, with
 * its totals and a summary over time and by place (ledger/LedgerSection.tsx).
 * It reads no entity: the ledger is every book, and the COA says which.
 */
import { Suspense } from 'react';
import AppLayout from '@/components/ui/AppLayout';
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import { OperationsEntityProvider } from '@/components/workbench/operations/EntitySelector';
import SectionD_ProjectBacklog from '@/components/workbench/operations/SectionD_ProjectBacklog';
import SectionE_Routines from '@/components/workbench/operations/SectionE_Routines';
import DayCard from '@/components/workbench/operations/day/DayCard';
import LedgerSection from '@/components/workbench/operations/ledger/LedgerSection';

export default function TasksPage() {
  return (
    <AppLayout page>
      <ToolOpener tools={[navToolByName('Tasks', TOOL_GATE)]} />
      <OperationsEntityProvider>
        <div className="space-y-3" data-tool-page="Tasks">
          <Suspense>
            <DayCard />
          </Suspense>
          <SectionD_ProjectBacklog />
          <SectionE_Routines />
          <LedgerSection />
        </div>
      </OperationsEntityProvider>
    </AppLayout>
  );
}
