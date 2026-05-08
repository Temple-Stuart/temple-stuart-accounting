/**
 * Section E · Routines.
 *
 * Top: TodaysStrip — what's due today + mark-complete.
 * Below: RoutineList — cadence-grouped (Daily / Weekly / Monthly / Quarterly /
 *        Yearly / Custom) with create + edit affordances.
 *
 * Both surfaces refetch on mutation: completing a routine refetches the
 * RoutineList (streak counters update), creating/editing/toggling a
 * routine refetches the TodaysStrip (new occurrences may appear).
 */

'use client';

import { useState } from 'react';
import { useOperationsEntity } from './EntitySelector';
import TodaysStrip from './routines/TodaysStrip';
import RoutineList from './routines/RoutineList';

export default function SectionE_Routines() {
  const { entities } = useOperationsEntity();
  // Bumping this counter forces both children to refetch. Each child
  // takes onCommitted as a stable callback that increments this counter
  // after a successful mutation.
  const [, setRefreshCounter] = useState(0);
  const bump = () => setRefreshCounter((n) => n + 1);

  return (
    <section className="bg-white rounded border border-border shadow-sm p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-primary">
          E · ROUTINES
        </h2>
      </div>

      <div>
        <div className="text-xs font-mono text-text-faint uppercase tracking-wide mb-2">
          today
        </div>
        <TodaysStrip onCommitted={bump} />
      </div>

      <div className="pt-3 border-t border-border-light">
        <div className="text-xs font-mono text-text-faint uppercase tracking-wide mb-2">
          all routines
        </div>
        <RoutineList entities={entities} onCommitted={bump} />
      </div>
    </section>
  );
}
