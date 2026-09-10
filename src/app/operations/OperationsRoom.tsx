'use client';

/**
 * ROOM-02 — the room's body: the phase strip and the phase it opens.
 *
 * Every phase MOUNTS THE EXISTING COMPONENT unchanged — no interior redesign
 * (DS-02 owns that), no new data path, no new API. Each one is a self-fetching
 * client component that took no required props already, so the room adds
 * nothing to them; the OperationsEntityProvider the four workbench sections
 * read is the one src/app/operations/layout.tsx already mounts.
 *
 * ONE PHASE CONTROL, never two (the ratified Pipe Frame): the strip is
 * StageStrip, the same primitive BooksPipeline reads. Selecting a phase
 * NAVIGATES — the selection lives in the URL (?phase=…) so a link is shareable
 * and the back button works. No browser storage.
 *
 * Only the ACTIVE phase mounts. Books keeps all six mounted because its phases
 * share one fetched dataset; these six share nothing — six independent trees
 * would fire every one of their loads on arrival. Stated, not assumed.
 */

import { useRouter } from 'next/navigation';
import StageStrip, { type StagePhase } from '@/components/ui/StageStrip';
import SectionHeader from '@/components/ui/SectionHeader';
import { OPERATIONS_PHASES, operationsHref, type OperationsPhase } from '@/lib/operationsPhases';
import SectionB_NorthStar from '@/components/workbench/operations/SectionB_NorthStar';
import SectionC_DailyPlan from '@/components/workbench/operations/SectionC_DailyPlan';
import SectionE_Routines from '@/components/workbench/operations/SectionE_Routines';
import SectionD_ProjectBacklog from '@/components/workbench/operations/SectionD_ProjectBacklog';
import ContentPipeline from '@/components/workbench/operations/content/ContentPipeline';
import SectionK_AuditTail from '@/components/workbench/operations/SectionK_AuditTail';
import HubCalendar from '@/components/hub/HubCalendar';

function PhaseBody({ phase }: { phase: OperationsPhase }) {
  switch (phase.key) {
    case 'plan':
      return <><SectionB_NorthStar /><SectionC_DailyPlan /></>;
    case 'calendar':
      // The SAME grid /runway mounts — HOME's answer surface and this room's
      // phase 02 render one component (calendar_events + the daily plan +
      // routines). /runway is not moved and not deleted.
      return <HubCalendar />;
    case 'routines':
      return <SectionE_Routines />;
    case 'projects':
      return <SectionD_ProjectBacklog />;
    case 'narrative':
      return <ContentPipeline />;
    case 'log':
      // The same section /operations/audit-log mounts; that page stays the source.
      return <SectionK_AuditTail />;
    default:
      // Unreachable: phaseFor() only ever returns a phase from the const, and
      // the law holds the const's keys to exactly these. Reaching it is a bug,
      // not a state — so it says so rather than rendering an empty room.
      throw new Error(`ROOM-02: phase "${phase.key}" names no surface`);
  }
}

export default function OperationsRoom({ phaseKey }: { phaseKey: string }) {
  const router = useRouter();
  const active = OPERATIONS_PHASES.find((p) => p.key === phaseKey) ?? OPERATIONS_PHASES[0];
  const total = String(OPERATIONS_PHASES.length).padStart(2, '0');

  return (
    <div className="space-y-3" data-operations-room>
      <StageStrip
        phases={OPERATIONS_PHASES.map((p): StagePhase => ({
          key: p.key,
          num: p.num,
          label: p.name,
          subLabel: p.subLabel,
          // The strip's states are DERIVED INDICATORS, never navigation locks.
          // This room derives nothing beyond "you are here": a phase is a place
          // in the day, not a step that completes, and inventing a done/pending
          // signal none of these surfaces reports would be a fabricated state.
          state: p.key === active.key ? 'active' : 'pending',
        }))}
        onSelect={(k) => router.push(operationsHref(k))}
      />
      <SectionHeader kicker={`${active.num} / ${active.name}`} right={`PHASE ${active.num} OF ${total}`} />
      <div data-operations-phase={active.key}>
        <PhaseBody phase={active} />
      </div>
    </div>
  );
}
