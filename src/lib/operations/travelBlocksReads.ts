import type { PrismaClient } from '@prisma/client';
import { readOwnReservationIds, readPlannedTravel, readSegments } from '@/lib/operations/travelDayReads';
import { clockOf, dayOf, instantOf, type InstantRange, type PlannedIn, type SegmentIn } from '@/lib/operations/travelDay';
import { plannedKindOf, plannedNameOf, type TravelBlock, type TravelBlocksLeftOut } from '@/lib/operations/supersession';

/**
 * SUPERSEDE-01b (Alex, 2026-11-08, ruling A; SUPERSEDE-00 ruling 3) — THE RANGE'S TRAVEL BLOCKS, ONE READ.
 *
 * Budget stops counting the routine occurrences travel supersedes. The rule is the leaf's (supersession.ts
 * supersessionOf — the card's since TRAVEL-01c); what it needs from the travel side is the range's BLOCKS: a travel fact
 * with BOTH instants. They are read here, on READS-01a's functions (travelDayReads.ts) and by the SAME selections the
 * card's day is read by — plannedSelectionOf: 'once' rows by homeDate in [from, to), 'daily' rows spanning it;
 * segmentsSelectionOf: segments by start_date in [from, to) — so a block is read by the same rule on both pages.
 * Bookings are NOT read: a booking carries no instants (dayCard.ts bookingTravelStop) — never a block, and the answer
 * says so.
 *
 * THE FLAT LIST. A planned row with recurrence 'once' AND start_at AND end_at → a block: key `planned:<id>`, kind by the
 * one planned-category rule (plannedKindOf), name as the card names a planned stop (plannedNameOf — the clean name, else
 * the legacy title), time the stated start clock as the card shows it (the stored homeTime, 'HH:MM' or null — the card
 * prints the stated clock, never one converted through a zone), startAt/endAt as ISO text by the leaf's instantOf. A
 * segment with both instants → key `segment:<source_id>:<start_date>`, kind 'flight', name its stated title, time its
 * stated start clock (the leaf's clockOf), startAt/endAt. The rows LEFT OUT are counted by name, never assumed: the
 * daily band, a once row with no instant, a once row with one instant (cannot supersede — the card's
 * CANNOT_SUPERSEDE_NO_END_WORDS case), a segment with none, a segment with one. The blocks are handed over ordered by
 * startAt, endAt, key, so the rule's tie (the earliest block by start, then end, then order) is the same on every read.
 *
 * Names no money column — the blocks carry instants only (the budget report route law, clause 2b, reads this file's
 * text). Every where names the caller, through the four functions. No `||`, no `?? <default>`; a row with start_at and
 * no start_zone states its clock as stored, never a guessed zone; a recurrence that is neither 'once' nor 'daily' is the
 * read's error, thrown by name.
 */

type Db = Pick<PrismaClient, 'trip_itinerary' | 'reservations' | 'calendar_events'>;

export const BOOKINGS_NEVER_A_BLOCK = 'never a block';

export interface TravelBlocksRead {
  readonly blocks: readonly TravelBlock[];
  /** The rows the range holds that are no block — each kind counted (the leaf's shape, so the pure half carries it). */
  readonly leftOut: TravelBlocksLeftOut;
  readonly bookings: typeof BOOKINGS_NEVER_A_BLOCK;
}

const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
/** By instant — start, then end (ISO text orders as time) — then key: the order the rule's tie falls to, the same on every read. */
const byInstant = (a: TravelBlock, b: TravelBlock): number => {
  const start = cmp(a.startAt, b.startAt);
  if (start !== 0) return start;
  const end = cmp(a.endAt, b.endAt);
  if (end !== 0) return end;
  return cmp(a.key, b.key);
};

/** The range's travel blocks for the caller, through READS-01a's reads, by the card's selections — the rows read, then the flat list. */
export async function readTravelBlocks(db: Db, userId: string, range: InstantRange): Promise<TravelBlocksRead> {
  const planned = await readPlannedTravel(db, userId, range);
  const segments = await readSegments(db, userId, (await readOwnReservationIds(db, userId)).map((r) => r.id), range);
  return blocksOfRows(planned, segments);
}

/** What the flat list reads of a planned row and of a segment (travelDay.ts PlannedIn, SegmentIn — the rows as the reads select them). */
export type BlockPlannedRow = Pick<PlannedIn, 'id' | 'category' | 'vendor' | 'vendor_name' | 'recurrence' | 'homeTime' | 'start_at' | 'end_at'>;
export type BlockSegmentRow = Pick<SegmentIn, 'source_id' | 'title' | 'start_date' | 'start_time' | 'start_at' | 'end_at'>;

/**
 * THE FLAT LIST, pure — the rows the two reads returned → the blocks, the rows left out counted by name, bookings never a block.
 * Pure so a test hands it the same rows the card's travel day is built from (the day card's tests feed Budget's marks through it).
 */
export function blocksOfRows(planned: readonly BlockPlannedRow[], segments: readonly BlockSegmentRow[]): TravelBlocksRead {
  const blocks: TravelBlock[] = [];
  const leftOut = { plannedDaily: 0, plannedNoInstants: 0, plannedOneInstant: 0, segmentsNoInstants: 0, segmentsOneInstant: 0 };

  for (const r of planned) {
    if (r.recurrence === 'daily') {
      leftOut.plannedDaily += 1;
      continue;
    }
    if (r.recurrence !== 'once') throw new Error(`travelBlocksReads: trip_itinerary ${r.id} carries recurrence ${JSON.stringify(r.recurrence)} — the selection reads once and daily rows`);
    const startAt = instantOf(r.start_at);
    const endAt = instantOf(r.end_at);
    if (startAt === null && endAt === null) {
      leftOut.plannedNoInstants += 1;
      continue;
    }
    if (startAt === null) {
      leftOut.plannedOneInstant += 1;
      continue;
    }
    if (endAt === null) {
      leftOut.plannedOneInstant += 1;
      continue;
    }
    blocks.push({ key: `planned:${r.id}`, kind: plannedKindOf(r.category), name: plannedNameOf({ vendorName: r.vendor_name, vendor: r.vendor }), time: r.homeTime, startAt, endAt });
  }

  for (const s of segments) {
    if (s.source_id === null) throw new Error('travelBlocksReads: a reservation calendar row with no source_id was handed over — the where names the keys');
    const startAt = instantOf(s.start_at);
    const endAt = instantOf(s.end_at);
    if (startAt === null && endAt === null) {
      leftOut.segmentsNoInstants += 1;
      continue;
    }
    if (startAt === null) {
      leftOut.segmentsOneInstant += 1;
      continue;
    }
    if (endAt === null) {
      leftOut.segmentsOneInstant += 1;
      continue;
    }
    blocks.push({ key: `segment:${s.source_id}:${dayOf(s.start_date)}`, kind: 'flight', name: s.title, time: clockOf(s.start_time), startAt, endAt });
  }

  blocks.sort(byInstant);
  return { blocks, leftOut, bookings: BOOKINGS_NEVER_A_BLOCK };
}
