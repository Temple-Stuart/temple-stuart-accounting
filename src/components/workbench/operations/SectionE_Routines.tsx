/**
 * Section E · Routines — THE ROUTINES LIST (TASKS-01, 2026-09-18).
 *
 * One list, grouped by cadence, with its controls: "+ new routine", edit,
 * deactivate, delete, "show inactive" (RoutineList / RoutineRow). Above it,
 * TODAY: the occurrences due today with "✓ mark done" and the honest line
 * "{done} done · {due} due · {missed} missed" (TodaysStrip).
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
 * The two surfaces refetch each other on a commit: a routine created, edited
 * or deleted in the list refreshes Today (listVersion); an occurrence marked
 * done in Today refreshes the list (todayVersion). Two counters, so neither
 * child refetches its own commit twice.
 */

'use client';

import { useState } from 'react';
import { useOperationsEntity } from './EntitySelector';
import TodaysStrip from './routines/TodaysStrip';
import RoutineList from './routines/RoutineList';

export default function SectionE_Routines() {
  const { entities } = useOperationsEntity();
  const [listVersion, setListVersion] = useState(0);
  const [todayVersion, setTodayVersion] = useState(0);
  // Today's zero-state offers "+ create a routine"; it opens the list's own
  // create form (the one door to creation) rather than a second form.
  const [createRequest, setCreateRequest] = useState(0);

  return (
    <section className="space-y-3" data-routines-list>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-brand-purple">Routines</h2>
      </div>
      <div className="space-y-1" data-routines-today>
        <div className="text-xs text-text-faint uppercase tracking-wide">Today</div>
        <TodaysStrip
          refreshKey={listVersion}
          onCommitted={() => setTodayVersion((n) => n + 1)}
          onCreateRequest={() => setCreateRequest((n) => n + 1)}
        />
      </div>
      <RoutineList
        entities={entities}
        refreshKey={todayVersion}
        createRequest={createRequest}
        onCommitted={() => setListVersion((n) => n + 1)}
      />
    </section>
  );
}
