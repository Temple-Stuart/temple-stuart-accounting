/**
 * The one-off law's seeded regression for the caller TAB13-02a adds (2026-09-27).
 *
 * The one-off law (ONEOFF-01) holds every expansion of a routine to the ONE
 * mechanism: each caller named in ONEOFF_CALLERS passes scheduleAnchor(start_date),
 * so a one-off is one occurrence on its date to every reader, and no other file in
 * src expands a schedule. TAB13-02a adds src/lib/budget/days.ts to that list. This
 * seed is the shape it must never take: the day rules expanding a routine without
 * the anchor, which would put every one-off in 1971 and out of every view.
 *
 * It must fail THE ONE-OFF LAW by name. The anchor occurs exactly once in its file,
 * which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const DAYS = 'src/lib/budget/days.ts';
const CALL = 'occurrences = expandBetween(routine.scheduleRrule, routine.timezone, windowFrom, windowTo, scheduleAnchor(routine.startDate));';

export const SEEDS: Seed[] = [
  {
    name: 'oneoff-a the day rules expand a routine without its anchor',
    file: DAYS,
    find: CALL,
    replace: 'occurrences = expandBetween(routine.scheduleRrule, routine.timezone, windowFrom, windowTo, undefined);',
    expect: 'src/lib/budget/days.ts expands a schedule without the routine',
  },
];
