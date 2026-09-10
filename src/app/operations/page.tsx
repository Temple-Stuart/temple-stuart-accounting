/**
 * src/app/operations/page.tsx — ROOM-02: STEP 12's ONE ROOM, read top down.
 *
 * Step 12 was scattered: its screen was /projects, with Calendar (/agenda),
 * Routines, the Issue log, the Audit tail and Narrative (/content) hanging off
 * it as rail sub-links, and this page — north star + daily plan — living
 * somewhere else again. Six doors onto one day's work. They are ONE screen
 * now, six phases in the order the day runs, the way Books reads as phases.
 *
 * The active phase lives in the URL (?phase=…) so a link is shareable and the
 * back button works — no localStorage, no sessionStorage, no cookie.
 *
 * An unknown ?phase= falls to 01 and SAYS SO on screen: never an empty room,
 * never a silent correction of the URL the viewer typed.
 *
 * Chrome (AppLayout, the entity provider, the identity bar) is the parent
 * src/app/operations/layout.tsx's.
 */
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolsOfScreen } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import { OPERATIONS_PHASES, phaseFor } from '@/lib/operationsPhases';
import OperationsRoom from './OperationsRoom';

export const dynamic = 'force-dynamic';

export default async function OperationsPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = typeof params.phase === 'string' ? params.phase : undefined;
  const { phase, fellBack } = phaseFor(raw);
  // NAV-25: /operations is TWO tools' screen — Tasks (02) and Time (03). Each is named.
  const tools = navToolsOfScreen('/operations', TOOL_GATE);

  return (
    <>
      <ToolOpener
        tools={tools}
        line="One day, top down — the plan, the calendar, the routines, the projects, the narrative, the log."
      />

      {fellBack && (
        <p role="status" data-phase-fellback className="mb-3 font-mono text-[11px] text-brand-amber">
          There is no “{raw}” phase — showing {phase.name}. The six are{' '}
          {OPERATIONS_PHASES.map((p) => p.name).join(', ')}.
        </p>
      )}

      <OperationsRoom phaseKey={phase.key} />
    </>
  );
}
