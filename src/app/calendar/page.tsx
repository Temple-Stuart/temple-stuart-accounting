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
 */
import AppLayout from '@/components/ui/AppLayout';
import HubCalendar from '@/components/hub/HubCalendar';
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';

export default function CalendarPage() {
  return (
    <AppLayout page>
      <ToolOpener
        tools={[navToolByName('Calendar', TOOL_GATE)]}
        line="Your trips, the blocks you planned for the day, and the routines that come round — on one grid."
      />
      <div data-calendar-room>
        <HubCalendar />
      </div>
    </AppLayout>
  );
}
