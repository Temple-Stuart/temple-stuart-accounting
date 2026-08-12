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
import { ListChecks, Sun } from 'lucide-react';
import { useOperationsEntity } from './EntitySelector';
import TodaysStrip from './routines/TodaysStrip';
import RoutineList from './routines/RoutineList';
import { iconTab, type Surface } from '@/lib/ds';

export default function SectionE_Routines({ surface = 'light' }: { surface?: Surface } = {}) {
  const dk = surface === 'dark';
  const { entities } = useOperationsEntity();
  // Bumping this counter forces both children to refetch. Each child
  // takes onCommitted as a stable callback that increments this counter
  // after a successful mutation.
  const [, setRefreshCounter] = useState(0);
  const bump = () => setRefreshCounter((n) => n + 1);
  // ROUTINES-V2: one presentation useState — the icon-tab toggler (the trade
  // Scan/Lab/Record anatomy, ds.iconTab byte-reused). Both panels stay simple
  // conditional mounts; each still refetches via bump on mutation. The purple
  // 'Routines' heading died (the module band above already titles the tab),
  // and the today/all eyebrows died with it — the tabs carry those labels.
  const [tab, setTab] = useState<'today' | 'all'>('today');

  return (
    <section className="space-y-5">
      <div className="flex items-end gap-1 border-b border-white/10">
        <button type="button" onClick={() => setTab('today')} aria-pressed={tab === 'today'} className={iconTab(tab === 'today')}>
          <Sun className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          <span>Today</span>
        </button>
        <button type="button" onClick={() => setTab('all')} aria-pressed={tab === 'all'} className={iconTab(tab === 'all')}>
          <ListChecks className="h-5 w-5" strokeWidth={1.75} aria-hidden="true" />
          <span>All routines</span>
        </button>
      </div>

      {tab === 'today' ? (
        <TodaysStrip surface={surface} onCommitted={bump} />
      ) : (
        <RoutineList surface={surface} entities={entities} onCommitted={bump} />
      )}
    </section>
  );
}
