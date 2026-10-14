/**
 * Section E · Routines — THE ROUTINES LIST (TASKS-01, 2026-09-18).
 *
 * One list, grouped by cadence, with its controls: "+ new routine", edit,
 * deactivate, delete, "show inactive" (RoutineList / RoutineRow).
 *
 * What came off, and where its capability went:
 *   · the four-phase StageStrip (01 Define · 02 Scheduled · 03 Run · 04 Proven)
 *     — 01, 02 and 04 were filters over this same RoutineList (the create
 *     form, the cadence grouping the list already shows, the streak counters);
 *     03 was TodaysStrip. Filters die; the two surfaces render together.
 *   · the ProofStrip receipts (ACTIVE ROUTINES / DUE TODAY / DONE TODAY /
 *     MISSED TODAY) — the same counts render on the surfaces themselves
 *     ("{n} routines" in the list header, the done/due/missed line in Today).
 *   · the streak counters (🔥) — not rendered anywhere now; the columns and
 *     the evaluator are untouched.
 *
 * TASKS-ONE-02 (2026-10-14) — Alex's ruling: the day card replaces the Today
 * strip. TodaysStrip ("✓ mark done", "{done} done · {due} due · {missed}
 * missed") is deleted, here and in the cockpit's routines block that mounts
 * this section; a stop recorded done on the day card is the routine's done
 * (src/lib/operations/routineCompletion.ts). The two refresh counters that let
 * Today and the list refetch each other, and Today's "+ create a routine"
 * request, went with it — the list is the one surface, and its own "+ new
 * routine" is the one door to creation.
 */

'use client';

import { useOperationsEntity } from './EntitySelector';
import RoutineList from './routines/RoutineList';

export default function SectionE_Routines() {
  const { entities } = useOperationsEntity();

  return (
    <section className="space-y-3" data-routines-list>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-brand-purple">Routines</h2>
      </div>
      <RoutineList entities={entities} />
    </section>
  );
}
