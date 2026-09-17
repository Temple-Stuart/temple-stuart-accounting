/**
 * DRILL-01 — THE CHAIN BEHIND ONE ROW ON THE DAY.
 *
 * The calendar is the view. Clicking a row should say what was budgeted, what
 * actually hit Books, and the link between them. The objects on a day know
 * DIFFERENT parts of that chain, and this leaf is where that difference is
 * written down once — as a table the law and the tests read, never as prose.
 *
 * IT INVENTS NO JOIN. DAY-01 established that calendar_events → Books by
 * (start_date, coa_code) is NOT sound, for four independent reasons
 * (src/lib/calendar/actuals.ts). This file renders that verdict; it does not
 * overturn it. Where the actual cannot be known, the row says so and names why.
 *
 * THREE STATES, NEVER A FOURTH:
 *   PLANNED             — a planned amount, and the object's OWN tool can record
 *                         an actual against it later. Nothing is missing yet.
 *   PLANNED AND SETTLED — both figures, and the actual carries its SOURCE, because
 *                         a hand-typed number and a posted one are not the same
 *                         claim and must never look alike.
 *   NOT LINKED          — a planned amount and no way to know the actual at all.
 *                         The reason is DAY-01's verdict, quoted, not a guess.
 * A row with NO planned amount and no actual has no chain: buildChain returns
 * null and the panel renders nothing. That is the absence of a state, not a
 * fourth one — and it is why a blank never becomes $0.
 */
import { ACTUALS_JOIN_SOUND, ACTUALS_NOT_JOINABLE_LINE } from './actuals';

export const CHAIN_STATES = ['PLANNED', 'PLANNED_AND_SETTLED', 'NOT_LINKED'] as const;
export type ChainState = (typeof CHAIN_STATES)[number];

export const CHAIN_LABEL: Record<ChainState, string> = {
  PLANNED: 'PLANNED',
  PLANNED_AND_SETTLED: 'PLANNED AND SETTLED',
  NOT_LINKED: 'NOT LINKED',
};

/**
 * Where an actual came from. An amount is never rendered without one of these —
 * that is the point of the label, and the law holds it.
 *   posted       — a real posted amount read out of Books.
 *   hand-entered — a person typed it. True today of the ONLY actual the day can show.
 *   model        — a number the app computed or estimated.
 */
export const ACTUAL_SOURCES = ['linked', 'posted', 'hand-entered', 'model'] as const;
export type ActualSource = (typeof ACTUAL_SOURCES)[number];

export const ACTUAL_SOURCE_LABEL: Record<ActualSource, string> = {
  // LINK-01: the only actual that is EVIDENCE rather than a claim — it is the
  // sum of postings a person linked to this item, and it names how many.
  linked: 'the sum of the postings linked to it in Books',
  posted: 'posted to Books',
  'hand-entered': 'hand-entered',
  model: 'a model number',
};

/** The kinds of thing that can appear on a day. */
export const DRILL_KINDS = ['calendar_event', 'routine', 'project_task', 'trade', 'task'] as const;
export type DrillKind = (typeof DRILL_KINDS)[number];

/**
 * LINK-01 (2026-09-17): every kind below still says what its OWN object knows —
 * that census is unchanged and still true. What changed is that an actual no
 * longer has to come from the object at all: a LINK to a posting in Books is an
 * actual for any kind, and it is the only one that is evidence rather than a
 * claim. `actualColumn` therefore still means "a column on the object itself";
 * `linkable` says whether the founder can link a posting to it.
 */

/**
 * THE STEP 0.2 CENSUS, IN CODE. For each kind: the column that carries the
 * planned amount, the column that carries an actual (or null when none exists),
 * what such an actual WOULD be, the COA column, and any link to a posted
 * transaction. A test reads this table; the PR body prints it.
 */
export interface KindFacts {
  readonly kind: DrillKind;
  /** The column the planned amount comes from, or null when the kind has none. */
  readonly plannedColumn: string | null;
  /** The column an actual comes from, or null — and null is why NOT LINKED exists. */
  readonly actualColumn: string | null;
  /** What an actual from that column IS. Null exactly when actualColumn is null. */
  readonly actualSource: ActualSource | null;
  /** The column carrying a COA / category, or null. */
  readonly coaColumn: string | null;
  /** A link to a posted transaction, or null. NOTHING has one today. */
  readonly postedLink: string | null;
  /** The tool that owns the object — the panel's one door. */
  readonly owner: string;
  /**
   * LINK-01: can a posting be linked to this kind? It needs a stable target key
   * (STEP 0.3). A daily-plan task is a line in a Json column with no id of its
   * own, and no trade row reaches the grid — neither is linkable yet, and the
   * panel says so rather than offering a button that cannot work.
   */
  readonly linkable: boolean;
  readonly note: string;
}

export const KIND_FACTS: readonly KindFacts[] = [
  {
    kind: 'calendar_event',
    linkable: true,
    plannedColumn: 'calendar_events.budget_amount',
    actualColumn: null,
    actualSource: null,
    coaColumn: 'calendar_events.coa_code',
    postedLink: null,
    owner: 'by source',
    note: "No column carries an actual, and the date+code join to Books is not sound (DAY-01). The trip path writes coa_code PREFIXED ('P-9200'); every other source writes the bare four digits.",
  },
  {
    kind: 'routine',
    linkable: true,
    plannedColumn: 'operations_routines.budget_amount (per occurrence)',
    actualColumn: null,
    actualSource: null,
    coaColumn: 'operations_routines.coa_code',
    postedLink: null,
    owner: 'Tasks',
    note: 'An occurrence is synthesised for the window (id `routine:<id>:<iso>`), not a stored row, so there is nothing an actual could even be written against yet.',
  },
  {
    kind: 'project_task',
    linkable: true,
    plannedColumn: 'operations_project_tasks.estimated_cost_usd',
    actualColumn: 'operations_project_tasks.actual_cost_usd',
    actualSource: 'hand-entered',
    coaColumn: 'operations_project_tasks.coa_code',
    postedLink: null,
    owner: 'Tasks',
    note: 'The ONLY actual a day row can show. It is hand-entered: the one writer is PATCH /api/operations/projects/[id]/tasks/[taskId] (route.ts:206-226), fed by two text inputs (TaskRowView.tsx:607, HubEventCard.tsx:136). It is not posted and it is not a model number, and the panel says so.',
  },
  {
    kind: 'trade',
    linkable: false,
    plannedColumn: null,
    actualColumn: null,
    actualSource: null,
    coaColumn: null,
    postedLink: null,
    owner: 'Trade Log',
    note: 'No trade row reaches the merged grid today — nothing in the app emits source:"trade"; the layer exists in the legend config only. The door is here so it resolves if one ever does.',
  },
  {
    kind: 'task',
    linkable: false,
    plannedColumn: 'daily_plans.tasks[].cost (when stored; null is the normal case)',
    actualColumn: null,
    actualSource: null,
    coaColumn: null,
    postedLink: null,
    owner: 'Tasks',
    note: 'A daily-plan task is a line in a Json column, with no account and no actual.',
  },
] as const;

export function factsOf(kind: DrillKind): KindFacts {
  const f = KIND_FACTS.find((x) => x.kind === kind);
  if (!f) throw new ChainLawError(`no census row for kind "${kind}"`);
  return f;
}

export class ChainLawError extends Error {
  constructor(message: string) {
    super(`CHAIN LAW: ${message}`);
    this.name = 'ChainLawError';
  }
}

export interface ChainInput {
  readonly kind: DrillKind;
  /** Dollars, or null. NULL IS NOT ZERO. */
  readonly planned: number | null;
  readonly actual: number | null;
  /** Required whenever `actual` is a number — an amount without its source throws. */
  readonly actualSource?: ActualSource | null;
  /**
   * LINK-01: the line a LINKED actual prints, which names how many postings it
   * is the sum of and any that carried no readable amount. Built by
   * linkedSourceLine() in src/lib/calendar/links.ts, never assembled here.
   */
  readonly linkLine?: string | null;
}

export interface Chain {
  readonly state: ChainState;
  readonly label: string;
  /** The sentence under the figures. */
  readonly line: string;
  /** Set exactly when the state is PLANNED_AND_SETTLED. */
  readonly actualSource: ActualSource | null;
}

/**
 * The chain for one row, or null when the row has no amounts at all.
 *
 * Fails LOUD rather than guessing: an actual with no source throws, and so does
 * a source with no actual — both would put an unlabelled number on the screen.
 */
export function buildChain(input: ChainInput): Chain | null {
  const facts = factsOf(input.kind);
  const hasPlanned = input.planned !== null && Number.isFinite(input.planned);
  const hasActual = input.actual !== null && Number.isFinite(input.actual);

  if (hasActual && !input.actualSource) {
    throw new ChainLawError(`${input.kind}: an actual of ${input.actual} with no source — every amount names where it came from`);
  }
  if (!hasActual && input.actualSource) {
    throw new ChainLawError(`${input.kind}: an actual source "${input.actualSource}" with no actual — a label with nothing under it`);
  }
  // LINK-01: an actual may now arrive one of two ways — from a column ON the
  // object, or from the postings LINKED to it. A linked actual is legal for any
  // linkable kind; anything else must still name the column it came from.
  if (hasActual && input.actualSource !== 'linked' && facts.actualColumn === null) {
    throw new ChainLawError(`${input.kind}: carries an actual, but the census says no column holds one — one of the two is wrong`);
  }
  if (hasActual && input.actualSource === 'linked' && !facts.linkable) {
    throw new ChainLawError(`${input.kind}: carries a LINKED actual, but nothing can be linked to it (no stable target key)`);
  }
  // No planned amount and no actual: there is no chain to show. NOT a fourth
  // state — the panel renders nothing here, which is how a blank stays a blank.
  if (!hasPlanned && !hasActual) return null;

  if (hasActual) {
    const src = input.actualSource as ActualSource;
    return {
      state: 'PLANNED_AND_SETTLED',
      label: CHAIN_LABEL.PLANNED_AND_SETTLED,
      line: src === 'linked'
        ? (input.linkLine ?? `The actual is ${ACTUAL_SOURCE_LABEL.linked}.`)
        : `The actual is ${ACTUAL_SOURCE_LABEL[src]}, from ${facts.actualColumn}.`,
      actualSource: src,
    };
  }
  // A planned amount, no actual. Which of the two remaining states depends on
  // whether the OBJECT ITSELF can carry one. LINK-01 does NOT move an item out
  // of NOT LINKED by making linking possible — NOT LINKED is precisely the state
  // an item is in until a posting is linked to it, and it is where the panel
  // offers the link. Zero links means NOT LINKED, never $0.
  if (facts.actualColumn !== null) {
    return {
      state: 'PLANNED',
      label: CHAIN_LABEL.PLANNED,
      line: `No actual recorded yet. When one is, it comes from ${facts.actualColumn} \u2014 ${ACTUAL_SOURCE_LABEL[facts.actualSource as ActualSource]}${facts.linkable ? ', or from a posting you link to it in Books' : ''}. Nothing is matched for you.`,
      actualSource: null,
    };
  }
  return {
    state: 'NOT_LINKED',
    label: CHAIN_LABEL.NOT_LINKED,
    line: ACTUALS_JOIN_SOUND
      ? // Unreachable while the verdict stands. It is written this way so that if
        // the verdict is ever overturned by a later ruling, this branch is the
        // one place that has to change — and it fails loud until it is.
        (() => { throw new ChainLawError('the actuals verdict changed; NOT LINKED must be re-derived'); })()
      : facts.linkable
        ? `${ACTUALS_NOT_JOINABLE_LINE} Link the posting that settled it and the actual becomes the sum of what you linked.`
        : ACTUALS_NOT_JOINABLE_LINE,
    actualSource: null,
  };
}

/**
 * STEP 3 — THE DOOR. Every row's owner is the tool whose path WROTE it, taken
 * from the allowlist's own `writtenBy` (src/lib/calendar/sources.ts):
 *   manual   ← /api/calendar/events            → Calendar's own row
 *   trip     ← /api/trips/[id]/commit          → Travel
 *   agenda   ← /api/agenda/[id]                → Budget (its /agenda sub-row)
 *   shopping ← /api/shopping/[id]              → Budget (its /shopping sub-row)
 *   home     ← /api/home/[id] (home_expenses)  → Budget
 *   personal · auto · growth · health ← /api/budget/[module]/[id] → Budget
 * The HREF is never typed here: it is read from the registry, so a tool that
 * moves house takes its doors with it.
 */
export const EVENT_SOURCE_OWNER: Readonly<Record<string, string>> = {
  manual: 'Calendar',
  trip: 'Travel',
  agenda: 'Budget',
  home: 'Budget',
  shopping: 'Budget',
  personal: 'Budget',
  auto: 'Budget',
  growth: 'Budget',
  health: 'Budget',
};

/** The tool that owns a row — by source for a calendar_event, by kind otherwise. */
export function ownerOf(kind: DrillKind, source: string): string {
  if (kind !== 'calendar_event') return factsOf(kind).owner;
  const owner = EVENT_SOURCE_OWNER[source];
  if (!owner) throw new ChainLawError(`calendar source "${source}" has no owner — every rendered source names the tool that writes it`);
  return owner;
}

/** The kind a merged-grid row belongs to, from the source the grid gave it. */
export function kindOfSource(source: string): DrillKind {
  if (source === 'routines') return 'routine';
  if (source === 'project' || source === 'operations') return 'project_task';
  if (source === 'trade') return 'trade';
  if (source === 'task') return 'task';
  return 'calendar_event';
}

/** One row, as the panel renders it. Every field is something the object KNOWS. */
export interface DrillRow {
  readonly id: string;
  readonly kind: DrillKind;
  readonly source: string;
  readonly title: string;
  readonly owner: string;
  readonly startDate: string;
  readonly endDate: string | null;
  readonly startTime: string | null;
  readonly endTime: string | null;
  readonly location: string | null;
  readonly pin: { lat: number; lon: number } | null;
  readonly coaCode: string | null;
  readonly planned: number | null;
  readonly actual: number | null;
  readonly actualSource: ActualSource | null;
  readonly chain: Chain | null;
  readonly facts: KindFacts;
}

export interface DrillEventInput {
  id: string;
  source: string;
  title: string;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coaCode?: string | null;
  budgetAmount?: number | null;
}

/**
 * What a project block's task actually carries, keyed by the BLOCK id the grid
 * uses. It is supplied by the caller that already holds the daily-plan items —
 * this leaf fetches nothing.
 *
 * It exists because mapOperationsBlocks.ts:51-53 COLLAPSES the two figures into
 * one `budgetAmount` (`actual_cost_usd ?? estimated_cost_usd`), so a task with an
 * actual shows that actual as if it were the budget, unlabelled. The mapper is
 * left exactly as it is — the grid and every total keep their current numbers —
 * and the panel reads the two columns apart instead.
 */
export interface TaskCosts {
  estimated: number | null;
  actual: number | null;
  /**
   * The task's OWN coa_code. mapOperationsBlocks never emits one (it folds the
   * code into a display `details` line instead), so without this a project block
   * would show a blank COA while its task plainly carries one — the panel would
   * be under-reporting what the object knows.
   */
  coaCode: string | null;
}

export function buildDrill(e: DrillEventInput, taskCosts?: TaskCosts | null): DrillRow {
  const kind = kindOfSource(e.source);
  const facts = factsOf(kind);
  const num = (v: number | null | undefined): number | null => (v == null || !Number.isFinite(v) ? null : v);

  const planned = kind === 'project_task' && taskCosts ? num(taskCosts.estimated) : num(e.budgetAmount);
  const actual = kind === 'project_task' && taskCosts ? num(taskCosts.actual) : null;
  const actualSource = actual === null ? null : facts.actualSource;

  return {
    id: e.id,
    kind,
    source: e.source,
    title: e.title,
    owner: ownerOf(kind, e.source),
    startDate: e.startDate,
    endDate: e.endDate ?? null,
    startTime: e.startTime ?? null,
    endTime: e.endTime ?? null,
    location: e.location ?? null,
    pin: e.latitude != null && e.longitude != null ? { lat: e.latitude, lon: e.longitude } : null,
    coaCode: (kind === 'project_task' && taskCosts ? taskCosts.coaCode : e.coaCode) ?? null,
    planned,
    actual,
    actualSource,
    chain: buildChain({ kind, planned, actual, actualSource }),
    facts,
  };
}
