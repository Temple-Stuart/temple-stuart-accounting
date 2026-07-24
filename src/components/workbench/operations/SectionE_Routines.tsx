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
import { themed, type Surface } from '@/lib/ds';

export default function SectionE_Routines({ surface = 'light' }: { surface?: Surface } = {}) {
  const dk = surface === 'dark';
  const { entities } = useOperationsEntity();
  // Bumping this counter forces both children to refetch. Each child
  // takes onCommitted as a stable callback that increments this counter
  // after a successful mutation.
  const [, setRefreshCounter] = useState(0);
  const bump = () => setRefreshCounter((n) => n + 1);

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-brand-purple">
          Routines
        </h2>
      </div>

      <div>
        <div className={themed('text-xs text-text-faint uppercase tracking-wide mb-2', dk)}>
          today
        </div>
        <TodaysStrip surface={surface} onCommitted={bump} />
      </div>

      <div className={themed('pt-3 border-t border-border-light', dk)}>
        <div className={themed('text-xs text-text-faint uppercase tracking-wide mb-2', dk)}>
          all routines
        </div>
        <RoutineList surface={surface} entities={entities} onCommitted={bump} />
      </div>
    </section>
  );
}
