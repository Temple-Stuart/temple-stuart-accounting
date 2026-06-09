/**
 * Showroom demo seed for the two new content surfaces (PR D) — both tied to
 * Maria's food truck, for continuity with the project already on the showroom.
 *
 * PURE STATIC DATA. Consumed ONLY by the showroom (a later PR), never wired as a
 * live-path fallback. No I/O here: no fetch, no effect, no server import — just
 * typed literals.
 *
 *   - demoDay: ONE full, believable day for DayCalendarView — a morning routine,
 *     receipts sorted (done), sales typed (in process), truck prep, a drive to
 *     the market, costs to add up, and one unscheduled call. A mix of scene /
 *     task / travel rows, timed + untimed, planned + actual.
 *   - demoScript / demoExecNotes: a scene-tagged reel voiceover + the receipts
 *     for ScriptGeneratorView, in the locked plain 5th-grade first-person voice.
 *
 * Every literal is typed against the SAME types the views import (TimelineRow /
 * Entity via the dayCalendarTypes shim; the two View prop types). Shapes are
 * never redefined here. The `_check` block at the bottom proves each export is
 * assignable to the matching view-prop contract.
 */

import type { TimelineRow, Entity } from '../dayCalendarTypes';
import type { DayCalendarViewProps } from '../DayCalendarView';
import type { ScriptGeneratorViewProps } from '../ScriptGeneratorView';

// Stable demo identifiers, prefixed so they read clearly as showroom seed rows.
const TRUCK = 'demo-entity-truck';
const HOME = 'demo-entity-home';
const BOOKS_PROJECT = 'demo-project-books';
const BOOKS_PROJECT_NAME = 'Get the food truck books ready for tax time';

/** The day the calendar shows (matches the rows below). */
export const demoDayDate = '2026-06-09';

// ── Entities (label + color the rows; one business, one personal) ───────────
export const demoDayEntities: Entity[] = [
  { id: TRUCK, name: "Maria's Food Truck", entity_type: 'business', is_default: true },
  { id: HOME, name: 'Maria (home)', entity_type: 'personal', is_default: false },
];

// ── One full day, in clock order ────────────────────────────────────────────
// minute = minutes from midnight (drives ordering). Task block times use
// local-parsed ISO (no trailing Z) so the wall clock reads as written; travel
// times use the @db.Time shape the view reads by string. Rows do not overlap.
export const demoDay: TimelineRow[] = [
  {
    kind: 'scene',
    minute: 420, // 07:00
    order: 1,
    scene: {
      id: 'demo-scene-morning',
      entity_id: HOME,
      assigned_question_text: 'What is the one thing that has to get done today?',
      narrative_purpose: 'Set the day up',
      b_roll: 'coffee on the counter, notebook open',
      routine_step: {
        id: 'demo-step-morning',
        step_order: 1,
        activity: 'Morning coffee and plan the day',
        time_of_day: '1970-01-01T07:00:00.000Z',
        routine_id: 'demo-routine-morning',
        duration_minutes: 30,
      },
    },
  },
  {
    kind: 'task',
    minute: 480, // 08:00
    order: 2,
    block: {
      id: 'demo-block-receipts',
      itemId: 'demo-item-receipts',
      blockId: 'demo-block-receipts',
      taskId: 'demo-task-receipts',
      projectId: BOOKS_PROJECT,
      title: 'Sort the receipts into one folder',
      projectName: BOOKS_PROJECT_NAME,
      status: 'completed',
      scheduledStart: '2026-06-09T08:00:00',
      scheduledEnd: '2026-06-09T08:30:00',
      label: 'task',
      minute: 480,
      order: 2,
      planned: true,
      entity_id: TRUCK,
      actualStart: '2026-06-09T08:05:00',
      actualEnd: '2026-06-09T08:35:00',
    },
  },
  {
    kind: 'task',
    minute: 540, // 09:00
    order: 3,
    block: {
      id: 'demo-block-sales',
      itemId: 'demo-item-sales',
      blockId: 'demo-block-sales',
      taskId: 'demo-task-sales',
      projectId: BOOKS_PROJECT,
      title: "Type last week's sales into the app",
      projectName: BOOKS_PROJECT_NAME,
      status: 'in_progress',
      scheduledStart: '2026-06-09T09:00:00',
      scheduledEnd: '2026-06-09T10:00:00',
      label: 'task',
      minute: 540,
      order: 3,
      planned: true,
      entity_id: TRUCK,
      actualStart: null,
      actualEnd: null,
    },
  },
  {
    kind: 'scene',
    minute: 630, // 10:30
    order: 4,
    scene: {
      id: 'demo-scene-prep',
      entity_id: TRUCK,
      assigned_question_text: 'What did you cook first?',
      narrative_purpose: 'Show the work',
      b_roll: 'onions on the flat top, order tickets',
      routine_step: {
        id: 'demo-step-prep',
        step_order: 2,
        activity: 'Prep the truck for the lunch rush',
        time_of_day: '1970-01-01T10:30:00.000Z',
        routine_id: 'demo-routine-truck',
        duration_minutes: 60,
      },
    },
  },
  {
    kind: 'travel',
    minute: 690, // 11:30
    order: 5,
    travel: {
      id: 'demo-travel-market',
      tripId: 'demo-trip-market',
      entity_id: TRUCK,
      title: 'Drive to the farmers market spot',
      cost: 15,
      coaCode: '5000',
      recurrence: 'none',
      blockStartTime: '1970-01-01T11:30:00.000Z',
      blockEndTime: '1970-01-01T12:00:00.000Z',
      label: 'travel',
      minute: 690,
      order: 5,
    },
  },
  {
    kind: 'task',
    minute: 840, // 14:00
    order: 6,
    block: {
      id: 'demo-block-costs',
      itemId: 'demo-item-costs',
      blockId: 'demo-block-costs',
      taskId: 'demo-task-costs',
      projectId: BOOKS_PROJECT,
      title: 'Add up the food and gas costs',
      projectName: BOOKS_PROJECT_NAME,
      status: 'open',
      scheduledStart: '2026-06-09T14:00:00',
      scheduledEnd: '2026-06-09T14:45:00',
      label: 'task',
      minute: 840,
      order: 6,
      planned: true,
      entity_id: TRUCK,
      actualStart: null,
      actualEnd: null,
    },
  },
  {
    kind: 'task',
    minute: null, // unscheduled — no time set yet
    order: 99,
    block: {
      id: 'demo-block-call',
      itemId: 'demo-item-call',
      blockId: null,
      taskId: 'demo-task-call',
      projectId: BOOKS_PROJECT,
      title: 'Call the bank about the business account',
      projectName: BOOKS_PROJECT_NAME,
      status: 'open',
      scheduledStart: null,
      scheduledEnd: null,
      label: 'task',
      minute: null,
      order: 99,
      planned: false,
      entity_id: TRUCK,
      actualStart: null,
      actualEnd: null,
    },
  },
];

// ── Sample reel script (locked voice: plain, 5th-grade, fun, first-person) ──
export const demoScript = `[scene 1 · morning coffee] Okay, real talk. Today I finally fix my food truck money.
[scene 2 · sorting receipts] First job: every receipt goes in one folder. No more shoebox. Done before my coffee got cold.
[scene 3 · typing sales] Then I typed last week's sales into the app. Watching that number add up? Kind of fun.
[scene 4 · truck prep] Lunch rush prep — onions, tacos, go. The truck does not run itself.
[scene 5 · drive to the market] Quick drive to the market spot. Fifteen bucks in gas, and yes, I wrote it down.
[scene 6 · adding up costs] Back home I add up food and gas. Now I know what I really spend.
[close] One messy pile turned into clean books. Tax time can't scare me now. Catch me tomorrow.`;

// ── Sample execution notes (the receipts, in Maria's words) ─────────────────
export const demoExecNotes = `Sorted every receipt into one folder. Typed all of last week's sales into the app. Spent $15 on gas driving to the market. Still need to call the bank about the business account.`;

/**
 * Type-conformance proofs. Each line fails to compile if the matching export
 * drifts from the pure view's prop contract. Not exported; erased by the compiler.
 */
const _checkTimeline: DayCalendarViewProps['timeline'] = demoDay;
const _checkEntities: DayCalendarViewProps['entities'] = demoDayEntities;
const _checkScript: ScriptGeneratorViewProps['draft'] = demoScript;
const _checkExecNotes: ScriptGeneratorViewProps['execNotes'] = demoExecNotes;
void [_checkTimeline, _checkEntities, _checkScript, _checkExecNotes];
