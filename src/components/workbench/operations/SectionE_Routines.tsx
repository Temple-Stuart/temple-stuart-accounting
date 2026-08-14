/**
 * Section E · Routines — the ROUTINES PIPE FRAME (first of the seven
 * future strips; the Trade/Books pattern).
 *
 * Control: the ratified StageStrip reading PIPE_PHASES.routines (01 Define ·
 * 02 Scheduled · 03 Run · 04 Proven — the shared config is the single
 * source; subLabel derivations cited there). The ROUTINES-V2 icon-tab
 * toggler RETIRED with its Today/All labels (the ToggleStrip precedent —
 * strings in git history).
 *
 * Phase → surface (the audit's map, the Trade multi-phase-one-surface
 * precedent):
 *   01 Define    = RoutineList (inline create form + edit affordances)
 *   02 Scheduled = RoutineList (the cadence-grouped schedule view)
 *   03 Run       = TodaysStrip (due today + mark-complete)
 *   04 Proven    = RoutineList (RoutineRow's streak counters, :239-240)
 *
 * MOUNT GRAPH PRESERVED: both panels stay simple conditional mounts (the
 * file's own ROUTINES-V2 contract — each refetches via bump on mutation);
 * the strip changes the CONTROL only. Define/Scheduled/Proven share the
 * mounted RoutineList (stable branch → no remount switching among them).
 * Default phase = 'run' — preserving the old default ('today' opened the
 * TodaysStrip surface; declared).
 *
 * States are DERIVED INDICATORS, never locks (the ratified amendment):
 *   define    done ⇐ an active routine exists      (RoutineList onTotals)
 *   scheduled done ⇐ today's occurrence list ≠ ∅   (TodaysStrip onTotals)
 *   run       done ⇐ a completion happened today   (TodaysStrip onTotals)
 *   proven    done ⇐ a completion streak exists    (RoutineList onTotals)
 * A signal that hasn't reported yet (its surface not yet mounted this
 * session) renders pending — honestly underivable, never imputed (the
 * Books 06 Export precedent). Same for the ProofStrip receipts: absent
 * data renders the honest dashed empty, never a faked value.
 */

'use client';

import { useState } from 'react';
import { useOperationsEntity } from './EntitySelector';
import TodaysStrip from './routines/TodaysStrip';
import RoutineList from './routines/RoutineList';
import StageStrip, { type StagePhase } from '@/components/ui/StageStrip';
import SectionHeader from '@/components/ui/SectionHeader';
import ProofStrip from '@/components/ui/ProofStrip';
import { PIPE_PHASES } from '@/lib/pipePhases';

const [PIPE_DEFINE, PIPE_SCHEDULED, PIPE_RUN, PIPE_PROVEN] = PIPE_PHASES.routines;

type RoutinePhase = 'define' | 'scheduled' | 'run' | 'proven';

export default function SectionE_Routines() {
  const { entities } = useOperationsEntity();
  // Bumping this counter forces both children to refetch. Each child
  // takes onCommitted as a stable callback that increments this counter
  // after a successful mutation.
  const [, setRefreshCounter] = useState(0);
  const bump = () => setRefreshCounter((n) => n + 1);

  const [phase, setPhase] = useState<RoutinePhase>('run');
  // The children's reported tallies (the Books onTotals idiom — zero new
  // fetches). null = not reported yet → the derived states render pending
  // and the receipts render the honest empty.
  const [listTotals, setListTotals] = useState<{ activeCount: number; hasStreak: boolean } | null>(null);
  const [todayTotals, setTodayTotals] = useState<{ entries: number; due: number; done: number; missed: number } | null>(null);

  const activePipe =
    phase === 'define' ? PIPE_DEFINE : phase === 'scheduled' ? PIPE_SCHEDULED : phase === 'run' ? PIPE_RUN : PIPE_PROVEN;

  return (
    <section className="space-y-5">
      <StageStrip
        phases={([
          { key: 'define', num: PIPE_DEFINE.num, label: PIPE_DEFINE.name, subLabel: PIPE_DEFINE.subLabel,
            state: phase === 'define' ? 'active' : (listTotals?.activeCount ?? 0) > 0 ? 'done' : 'pending' },
          { key: 'scheduled', num: PIPE_SCHEDULED.num, label: PIPE_SCHEDULED.name, subLabel: PIPE_SCHEDULED.subLabel,
            state: phase === 'scheduled' ? 'active' : (todayTotals?.entries ?? 0) > 0 ? 'done' : 'pending' },
          { key: 'run', num: PIPE_RUN.num, label: PIPE_RUN.name, subLabel: PIPE_RUN.subLabel,
            state: phase === 'run' ? 'active' : (todayTotals?.done ?? 0) > 0 ? 'done' : 'pending' },
          { key: 'proven', num: PIPE_PROVEN.num, label: PIPE_PROVEN.name, subLabel: PIPE_PROVEN.subLabel,
            state: phase === 'proven' ? 'active' : listTotals?.hasStreak ? 'done' : 'pending' },
        ] as StagePhase[])}
        onSelect={(k) => setPhase(k as RoutinePhase)}
      />

      {phase === 'run' ? (
        <div className="space-y-3">
          <SectionHeader kicker={`${PIPE_RUN.num} / ${PIPE_RUN.name}`} right={`PHASE ${PIPE_RUN.num} OF 04`} />
          {/* ZERO-STATE-1 wiring preserved: the empty state's create button
              now lands on the Define phase (where the create form lives). */}
          <TodaysStrip onCommitted={bump} onCreateRequest={() => setPhase('define')} onTotals={setTodayTotals} />
        </div>
      ) : (
        <div className="space-y-3">
          <SectionHeader kicker={`${activePipe.num} / ${activePipe.name}`} right={`PHASE ${activePipe.num} OF 04`} />
          <RoutineList entities={entities} onCommitted={bump} onTotals={setListTotals} />
        </div>
      )}

      {/* ROUTINES-PIPE: the receipts rail — existing state only, honest
          empties (ProofStrip's own dashed treatment; "not loaded yet" is
          the truthful wording for a surface not yet visited this session). */}
      <ProofStrip
        receipts={[
          { label: 'ACTIVE ROUTINES', value: listTotals ? String(listTotals.activeCount) : undefined, emptyLabel: 'not loaded yet' },
          { label: 'DUE TODAY', value: todayTotals ? String(todayTotals.due) : undefined, emptyLabel: 'not loaded yet' },
          { label: 'DONE TODAY', value: todayTotals ? String(todayTotals.done) : undefined, emptyLabel: 'not loaded yet' },
          { label: 'MISSED TODAY', value: todayTotals ? String(todayTotals.missed) : undefined, emptyLabel: 'not loaded yet' },
        ]}
      />
    </section>
  );
}
