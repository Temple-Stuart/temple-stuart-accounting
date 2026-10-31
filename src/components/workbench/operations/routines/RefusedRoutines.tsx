/**
 * RefusedRoutines — the routines a today read could not place, each named with
 * its reason (WEEK-01, 2026-09-30). A routine whose zone cannot be read or whose
 * schedule does not parse is never dropped and never placed in UTC: Today, the
 * Daily Plan and the week each show this list. Nothing renders when it is empty.
 */

'use client';

import type { RefusedRoutine } from './types';

export default function RefusedRoutines({ refused }: { refused: readonly RefusedRoutine[] }) {
  if (refused.length === 0) return null;
  return (
    <div className="px-3 py-2 rounded border bg-amber-50 border-amber-200 text-amber-900 text-xs space-y-0.5" data-refused-routines>
      <div className="font-medium">
        {refused.length === 1 ? '1 routine cannot be placed' : `${refused.length} routines cannot be placed`}
      </div>
      {refused.map((r) => (
        <div key={`${r.routine_id}:${r.reason}`} data-refused-routine={r.routine_id}>
          <span className="font-medium">{r.name}</span> — {r.reason}
          <span className="text-amber-700"> ({r.detail})</span>
        </div>
      ))}
    </div>
  );
}
