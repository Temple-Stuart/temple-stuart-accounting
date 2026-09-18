'use client';

/**
 * CAL-01 — /calendar, THE CALENDAR. Tool 01's home was /agenda: a planner whose
 * items carry a cadence, a coa_code and a budget_amount, whose commit writes a
 * calendar_events row with those two money columns and then a `budgets` plan row
 * (src/app/api/agenda/[id]/route.ts:84-96, :113-133). That is recurring-spend
 * planning — Budget's work — and it is Budget's now.
 *
 * THE CALENDAR is the merged grid: trip events, daily-plan blocks and routine
 * occurrences over one CalendarGrid. It had no room of its own — it rendered
 * only inside the cockpit's Runway tab (ModuleLauncher.tsx:688) and, since
 * ROOM-02, as Operations' phase 02. This page gives it one.
 *
 * The SAME component, the SAME three sources, no interior edit and no new data
 * path: HubCalendar takes only optional props (demoEvents, onRequireAuth) and
 * self-fetches, which is exactly how both existing mounts use it. Nothing here
 * comes from ModuleLauncher.
 *
 * PLAN-01 (2026-09-17) — THE CALENDAR AUTHORS NOTHING. SectionE_Routines, the
 * routine builder, lived here and is now on /tasks: routines and projects are
 * one act of planning, and the calendar is the VIEW everything logs to. This
 * page draws no phase strip at all now (nav.ts PHASES_RENDERED_AT['/calendar']
 * is []), which no law forbids — tool law 2 iterates the pipes a page DRAWS.
 *
 * CAL-OPEN-01 (2026-09-18) — THE CALENDAR EXPLAINS NOTHING. A ToolOpener sat
 * above the grid and printed two paragraphs: the registry `why` (the tool's
 * line, nav.ts `line: tool.why`) and a `line` prop of this page's own, in the
 * room's words. The tab is self-evident and the prose took space from the
 * view, so the opener is gone and both paragraphs with it. The ruled test was
 * the opener law: its enforced check (scripts/assert-tool-registry.ts, THE
 * OPENER LAW) compares PHASES_RENDERED_AT[route] with the phases a page's
 * import tree draws, and never required a page to mount an opener — so the
 * opener is REMOVED, not reduced. The registry row is untouched: its `why`
 * renders on the sheet (TheSheet.tsx proofLine), which is where it belongs.
 * Nothing renders here but the shell and the grid.
 *
 * ONEOFF-01 (2026-09-18) — THE CALENDAR AUTHORS NOTHING, AN EVENT INCLUDED.
 * EVENT-01's "Add an event" form and its POST are gone from this page: a
 * one-off is a routine that happens once, planned in Tasks with its lines and
 * its place, and it logs here like every other routine. What stays is the
 * correction of an event entered by hand BEFORE this ruling — the calendar's
 * own row (calendar_events, source 'manual'), which its owner may re-state or
 * remove from the day it sits on or from its chain panel. PATCH and DELETE
 * remain on the route; POST does not.
 */
import AppLayout from '@/components/ui/AppLayout';
import HubCalendar from '@/components/hub/HubCalendar';

export default function CalendarPage() {
  return (
    <AppLayout page>
      <div data-calendar-room>
        <HubCalendar />
      </div>
    </AppLayout>
  );
}
