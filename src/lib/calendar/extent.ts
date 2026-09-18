/**
 * extent — THE ONE PLACE A BLOCK'S EXTENT IS DECIDED, AND IT NEVER INVENTS ONE
 * (GRID-01, 2026-09-18).
 *
 * A block is as long as it says. A row with a start and an end draws start → end,
 * exactly. A row with a start and NO end is not given a length: it draws a
 * MINIMAL MARKER (MARKER_MINUTES tall) on its start, visibly flagged, its label
 * carrying the start time only. That is the policy the trip path already held
 * for a flight whose duration is unverified ("never reconstruct start→end —
 * that is the 34h bug"); the non-trip path used to give the same case a silent
 * two-hour extent and then stretch anything shorter than an hour to an hour.
 * Both paths call this leaf now, and the extent law (scripts/assert-tool-registry.ts)
 * refuses any expression in the grid that adds minutes to a start.
 *
 * Lanes: blocks that intersect in one day column are laid out side by side —
 * the standard interval partition (sort by start; each block takes the first
 * lane whose last block has ended; a lane count per overlap cluster). Geometry
 * only: nothing about a block's data changes, and the order the caller gave is
 * the order it gets back.
 */

/** The minimal marker: the height a block with no end is drawn at. It is a flag, not a duration. */
export const MARKER_MINUTES = 30;

export type ExtentFlag = 'no-end' | 'end-before-start' | 'duration-unverified';

export const FLAG_TEXT: Record<ExtentFlag, string> = {
  'no-end': 'no end time',
  'end-before-start': 'end before start',
  'duration-unverified': 'duration unverified',
};

export interface Extent {
  startMin: number;
  endMin: number;
  /** null → the extent is what the row says; otherwise WHY the block is a marker. */
  flag: ExtentFlag | null;
}

/** A row's own extent. No end → a flagged marker; an end before the start → a flagged marker; else exact. */
export function blockExtent(startMin: number, endMin: number | null | undefined): Extent {
  if (endMin === null || endMin === undefined || Number.isNaN(endMin)) {
    return { startMin, endMin: startMin + MARKER_MINUTES, flag: 'no-end' };
  }
  if (endMin < startMin) return { startMin, endMin: startMin + MARKER_MINUTES, flag: 'end-before-start' };
  return { startMin, endMin, flag: null };
}

/** A flight whose elapsed duration is unverified: the same marker, its own flag (the trip path's ruled policy). */
export function unverifiedDurationExtent(startMin: number): Extent {
  return { startMin, endMin: startMin + MARKER_MINUTES, flag: 'duration-unverified' };
}

export interface Lane {
  /** 0-based lane within the block's overlap cluster. */
  lane: number;
  /** How many lanes the cluster needs — the block's width is 1/lanes of the column. */
  lanes: number;
}

/**
 * The interval partition. `minSpan` is the DRAWN span a block can never be
 * shorter than (the grid's one-line floor, in minutes), so two slivers that
 * would overlap on screen share no lane. Results are in the caller's order.
 */
export function assignLanes<T>(items: readonly T[], startOf: (t: T) => number, endOf: (t: T) => number, minSpan = 0): Lane[] {
  const result: Lane[] = items.map(() => ({ lane: 0, lanes: 1 }));
  // By start, then the caller's order — a tie is never reordered by anything else.
  const order = items.map((_, i) => i).sort((a, b) => startOf(items[a]) - startOf(items[b]) || a - b);
  let laneEnds: number[] = [];
  let cluster: number[] = [];
  let clusterEnd = -Infinity;
  const close = () => {
    for (const i of cluster) result[i].lanes = laneEnds.length;
    cluster = [];
    laneEnds = [];
    clusterEnd = -Infinity;
  };
  for (const i of order) {
    const s = startOf(items[i]);
    const e = Math.max(endOf(items[i]), s + minSpan);
    if (cluster.length > 0 && s >= clusterEnd) close();
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e);
    } else {
      laneEnds[lane] = e;
    }
    result[i].lane = lane;
    cluster.push(i);
    if (e > clusterEnd) clusterEnd = e;
  }
  close();
  return result;
}
