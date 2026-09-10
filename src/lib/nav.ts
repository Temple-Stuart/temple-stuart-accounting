/**
 * NAV-25 — THE RAIL IS THE SHEET.
 *
 * SHELL-01 invented a grouping layer — twelve "steps" — between the six
 * families and the twenty-five tools. It cost the app its mirror of the home
 * page: the rail showed 12 rows, so 19 of the 25 tools appeared nowhere at all.
 * The steps layer is gone (src/lib/steps.ts deleted with it). This file is what
 * replaced it, and it INVENTS NOTHING:
 *
 *   · the families are TOOL_REGISTRY's, in TOOL_REGISTRY's order;
 *   · each family's tools are TOOL_REGISTRY's, in TOOL_REGISTRY's order;
 *   · a tool's number is its position in TOOL_REGISTRY, 1..25;
 *   · a tool's status, home and links are the registry's;
 *   · a tool's PHASES are pipePhases.ts's, assigned by THE SORT below;
 *   · a tool's gate is offer.ts's TOOL_GATE.
 *
 * Every heading the rail or a screen renders is therefore a family name from
 * the registry, a tool name from the registry, or a phase name from
 * pipePhases.ts. Nothing is retyped, reordered, renamed or invented.
 */
import { PIPE_PHASES, type PipePhase, type PipePillarId } from './pipePhases';
import { TOOL_REGISTRY, doorOf, doorOfLink, type ToolDoor, type ToolEntry, type ToolStatus } from './toolRegistry';
import type { FamilyName, ToolName } from './problemSheet';

/**
 * THE ONE NON-TOOL OWNER. Runway's 02 History and 03 Burn answer "how long can
 * I last?" — the read on HOME — and belong to no tool. navLaw accepts exactly
 * this name beside the twenty-five and rejects any other, so the exception
 * cannot quietly become a second grouping layer.
 */
/** A door that actually opens — `doorOf` returns { kind: 'none' } for a not-built tool, and a sub-row never holds one. */
export type OpenDoor = Exclude<ToolDoor, { kind: 'none' }>;

export const HOME_OWNER = 'HOME' as const;
export const HOME_ANSWER = 'How long can I last?';
export type PhaseOwner = ToolName | typeof HOME_OWNER;

export interface PhaseAssignment {
  pipe: PipePillarId;
  /** The phase's own number, exactly as pipePhases.ts numbers it — never renumbered. */
  num: string;
  owner: PhaseOwner;
  /**
   * Does this phase render a surface anywhere? TRUE for 47 of the 49. The two
   * exceptions are DECLARED IN THE CODE, not judged here, and are recorded
   * rather than tidied away: a phase that computes but does not render is
   * still its owner's phase.
   */
  rendersSurface: boolean;
  /** Required when rendersSurface is false: the file:line that declares it. */
  surfaceNote?: string;
}

/**
 * THE SORT — every one of the 49 phases, to exactly one owner.
 *
 * Verified row by row against pipePhases.ts and the components. Two rows of the
 * ruled table are CORRECTED because the code contradicts them; both are
 * reported rather than silently applied:
 *
 *  · travel 04 Ledger / 05 Reconcile were ruled to Expenses. The registry's own
 *    Expenses row says the opposite in as many words — "trip cost split on the
 *    trip planner … is Travel's, not an expenses tool" (toolRegistry.ts:140) —
 *    and Expenses is NOT_BUILT with no home. Both phases render inside the
 *    travel tab's own strip (ModuleLauncher.tsx:758). CODE WINS: they are
 *    Travel's, and Expenses stays a not-built row with no phases.
 *
 *  · runway 01 Source and 02 History render NO SURFACE. ModuleLauncher declares
 *    it: "01 Source / 02 History are STATE-ONLY cells (no surface exists in
 *    this tab …); clicking them no-ops" (:619-626), and the handler excludes
 *    their keys by type (:646-648). The assignment stands as ruled; the fact is
 *    recorded on the phase.
 */
export const THE_SORT: readonly PhaseAssignment[] = [
  // books — 01 is the account feed (Banking's), 02..06 are the ledger's.
  { pipe: 'books', num: '01', owner: 'Banking', rendersSurface: true },
  { pipe: 'books', num: '02', owner: 'Bookkeeping', rendersSurface: true },
  { pipe: 'books', num: '03', owner: 'Bookkeeping', rendersSurface: true },
  { pipe: 'books', num: '04', owner: 'Bookkeeping', rendersSurface: true },
  { pipe: 'books', num: '05', owner: 'Bookkeeping', rendersSurface: true },
  { pipe: 'books', num: '06', owner: 'Bookkeeping', rendersSurface: true },
  // trade — the split is at the existing 03/04 boundary; 06 already carries the
  // link target 'books', which is Bookkeeping's, and stays Trade Log's phase.
  { pipe: 'trade', num: '01', owner: 'Brokerage', rendersSurface: true },
  { pipe: 'trade', num: '02', owner: 'Brokerage', rendersSurface: true },
  { pipe: 'trade', num: '03', owner: 'Brokerage', rendersSurface: true },
  { pipe: 'trade', num: '04', owner: 'Trade Log', rendersSurface: true },
  { pipe: 'trade', num: '05', owner: 'Trade Log', rendersSurface: true },
  { pipe: 'trade', num: '06', owner: 'Trade Log', rendersSurface: true },
  // travel — all five are Travel's (the correction above).
  { pipe: 'travel', num: '01', owner: 'Travel', rendersSurface: true },
  { pipe: 'travel', num: '02', owner: 'Travel', rendersSurface: true },
  { pipe: 'travel', num: '03', owner: 'Travel', rendersSurface: true },
  { pipe: 'travel', num: '04', owner: 'Travel', rendersSurface: true },
  { pipe: 'travel', num: '05', owner: 'Travel', rendersSurface: true },
  // runway — the four-way split as ruled, with the two declared state-only cells.
  { pipe: 'runway', num: '01', owner: 'Banking', rendersSurface: false,
    surfaceNote: 'src/components/home/ModuleLauncher.tsx:619-626 — "STATE-ONLY cells (no surface exists in this tab: accounts link in Books 01 Feed)"; the handler excludes its key at :646-648' },
  { pipe: 'runway', num: '02', owner: HOME_OWNER, rendersSurface: false,
    surfaceNote: 'src/components/home/ModuleLauncher.tsx:619-626 — "ledger history renders only THROUGH the burn/budget figures"; the handler excludes its key at :646-648' },
  { pipe: 'runway', num: '03', owner: HOME_OWNER, rendersSurface: true },
  { pipe: 'runway', num: '04', owner: 'Bookkeeping', rendersSurface: true },
  { pipe: 'runway', num: '05', owner: 'Budget', rendersSurface: true },
  // the five pipes that belong whole to one tool
  ...(['01', '02', '03', '04', '05', '06', '07'] as const).map((num): PhaseAssignment => ({ pipe: 'tax', num, owner: 'Tax', rendersSurface: true })),
  ...(['01', '02', '03', '04', '05', '06'] as const).map((num): PhaseAssignment => ({ pipe: 'compliance', num, owner: 'Compliance', rendersSurface: true })),
  ...(['01', '02', '03', '04'] as const).map((num): PhaseAssignment => ({ pipe: 'routines', num, owner: 'Calendar', rendersSurface: true })),
  ...(['01', '02', '03', '04', '05', '06'] as const).map((num): PhaseAssignment => ({ pipe: 'projects', num, owner: 'Tasks', rendersSurface: true })),
  ...(['01', '02', '03', '04'] as const).map((num): PhaseAssignment => ({ pipe: 'content', num, owner: 'Time', rendersSurface: true })),
];

/** A phase as a screen renders it: the pipe's own row, plus who owns it. */
export interface NavPhase extends PipePhase {
  pipe: PipePillarId;
  rendersSurface: boolean;
  surfaceNote?: string;
}

/** A tool's row in the rail, and the model its screen reads. */
export interface NavTool {
  /** 1..25 — the tool's position in TOOL_REGISTRY, never a typed number. */
  n: number;
  name: ToolName;
  family: FamilyName;
  status: ToolStatus;
  phases: readonly NavPhase[];
  /** What a customer opens, or null when there is nothing to open. */
  href: string | null;
  /** The registry's own door — a cockpit section keeps its cockpit key, so the rail switches the tab in place exactly as before. */
  door: OpenDoor | null;
  /** The offer gate the tool's routes carry, or null when it is free. */
  gate: string | null;
  /** The registry line the screen prints under the tool's name. */
  line: string;
  /**
   * The pages this tool OWNS that are not its screen — the registry's own
   * `links`, through the registry's own doors. They render as sub-rows beneath
   * the tool's row when it is the open one, which is how /chart-of-accounts,
   * /dashboard/tax-filing, /soc2, /budgets/trips, /shopping and /hub/itinerary
   * keep their doors: inside the tool they belong to under THE SORT, never as a
   * top-level row and never pointing at another tool's screen (navLaw rule 7).
   */
  subRows: readonly { label: string; door: OpenDoor }[];
}

export interface NavFamily {
  name: FamilyName;
  tools: readonly NavTool[];
}

const phaseRow = (a: PhaseAssignment): NavPhase => {
  const row = (PIPE_PHASES[a.pipe] as readonly PipePhase[]).find((p) => p.num === a.num);
  if (!row) throw new NavLawError(`${a.pipe} has no phase ${a.num} — THE SORT names one pipePhases.ts does not hold`);
  return { ...row, pipe: a.pipe, rendersSurface: a.rendersSurface, surfaceNote: a.surfaceNote };
};

/** Every phase this owner holds, in the sort's own order — never re-sorted by name. */
export function phasesOf(owner: PhaseOwner, sort: readonly PhaseAssignment[] = THE_SORT): readonly NavPhase[] {
  return sort.filter((a) => a.owner === owner).map(phaseRow);
}

/** The phases HOME's "how long can I last?" read owns — the one non-tool owner. */
export const HOME_PHASES: readonly NavPhase[] = phasesOf(HOME_OWNER);

/**
 * The door the rail opens for a tool: its OWN HOME first, and the cockpit key
 * only when that home IS the cockpit path — so a cockpit-hosted tool still
 * switches the tab in place, exactly as before.
 *
 * `doorOf` prefers the cockpit path over the home, which is right for a
 * registry link but wrong for a rail row: Compliance's home is the standalone
 * page /compliance (with nine child pages beneath it) while its cockpit path is
 * the /?tab=compliance carve-out. Preferring the cockpit there is what the old
 * rail did for LINKS, not for the step's own row — its row opened /compliance —
 * and taking it as the tool's door would leave all nine pages doorless.
 */
const railDoor = (tool: ToolEntry): OpenDoor | { kind: 'none' } => {
  const door = doorOf(tool);
  if (door.kind !== 'cockpit' || !tool.home || tool.home === door.href) return door;
  return { kind: 'route', href: tool.home };
};

const navTool = (tool: ToolEntry, i: number, gate: Readonly<Record<string, string | null>>, sort: readonly PhaseAssignment[]): NavTool => {
  const door = railDoor(tool);
  return {
    n: i + 1,
    name: tool.name,
    family: tool.family,
    status: tool.status,
    phases: phasesOf(tool.name, sort),
    href: door.kind === 'none' ? null : door.href,
    door: door.kind === 'none' ? null : door,
    gate: gate[tool.name] ?? null,
    line: tool.why?.trim() ? tool.why : tool.citation,
    subRows: (tool.links ?? [])
      .map((l) => ({ label: l.label, door: doorOfLink(tool, l) }))
      .filter((r): r is { label: string; door: OpenDoor } => r.door.kind !== 'none'),
  };
};

/**
 * THE MODEL the rail renders. Families in TOOL_REGISTRY's order, each holding
 * its tools in TOOL_REGISTRY's order. `gate` is injected so this leaf stays
 * offer-free (the steps layer's one good idea, kept).
 */
export function navFamilies(
  gate: Readonly<Record<string, string | null>>,
  registry: readonly ToolEntry[] = TOOL_REGISTRY,
  sort: readonly PhaseAssignment[] = THE_SORT,
): readonly NavFamily[] {
  const out: NavFamily[] = [];
  registry.forEach((tool, i) => {
    let family = out.find((f) => f.name === tool.family);
    if (!family) { family = { name: tool.family, tools: [] }; out.push(family); }
    (family.tools as NavTool[]).push(navTool(tool, i, gate, sort));
  });
  return out;
}

/** The 25 rows, flattened — the rail's reading order, which IS the registry's. */
export function navRows(
  gate: Readonly<Record<string, string | null>>,
  registry: readonly ToolEntry[] = TOOL_REGISTRY,
  sort: readonly PhaseAssignment[] = THE_SORT,
): readonly NavTool[] {
  return navFamilies(gate, registry, sort).flatMap((f) => f.tools);
}

/** The tool a name belongs to. Throws when it is not one of the 25 — a bug, not a state. */
export function navToolByName(name: string, gate: Readonly<Record<string, string | null>>): NavTool {
  const row = navRows(gate).find((t) => t.name === name);
  if (!row) throw new NavLawError(`"${name}" is not one of the twenty-five`);
  return row;
}

/** Every tool whose screen is this href — several tools share /trading and /operations. */
export function navToolsOfScreen(href: string, gate: Readonly<Record<string, string | null>>): readonly NavTool[] {
  return navRows(gate).filter((t) => t.href === href);
}

export class NavLawError extends Error {
  constructor(message: string) {
    super(`NAV LAW: ${message}`);
    this.name = 'NavLawError';
  }
}

/**
 * THE LAW. Runs at module scope and again at build.
 *   1. the rail's flattened rows deep-equal TOOL_REGISTRY — name AND order;
 *   2. the families appear in registry order, each once;
 *   3. no rail row that is not one of the 25;
 *   4. a NOT_BUILT tool has no link;
 *   5. every phase rendered anywhere comes from pipePhases.ts, and each phase
 *      belongs to EXACTLY ONE owner — no phase owned by nothing, by two things,
 *      or by a second non-tool name;
 *   6. a phase declaring it renders no surface cites where the code says so.
 * The build adds what only the filesystem can answer: every non-null href
 * resolves to a page file.
 */
export function navLaw(opts: {
  throwOnFail?: boolean;
  registry?: readonly ToolEntry[];
  sort?: readonly PhaseAssignment[];
  gate?: Readonly<Record<string, string | null>>;
  /**
   * The model AS RENDERED. It defaults to the derived one, so the law's subject
   * is the rail the app actually draws — and a test can hand in a rail that
   * reordered a family or grew a legacy row and watch it throw. Without this the
   * order check compares the derivation to its own source and can never fail.
   */
  families?: readonly NavFamily[];
} = {}): string[] {
  const registry = opts.registry ?? TOOL_REGISTRY;
  const sort = opts.sort ?? THE_SORT;
  const gate = opts.gate ?? {};
  const violations: string[] = [];

  // 1 + 3. the rows ARE the registry, in order
  const families = opts.families ?? navFamilies(gate, registry, sort);
  const rows = families.flatMap((f) => f.tools);
  const rowNames = rows.map((t) => t.name);
  const registryNames = registry.map((t) => t.name);
  if (rowNames.length !== registryNames.length || rowNames.some((n, i) => n !== registryNames[i])) {
    violations.push(`the rail's rows are not TOOL_REGISTRY in order — rail [${rowNames.join(', ')}] vs registry [${registryNames.join(', ')}]`);
  }
  for (const t of rows) if (!registryNames.includes(t.name)) violations.push(`"${t.name}" is a rail row that is not one of the twenty-five`);
  rows.forEach((t, i) => { if (t.n !== i + 1) violations.push(`${t.name} is numbered ${t.n} but sits at ${i + 1} — a number is a position, never typed`); });

  // 2. families in registry order, each once
  const familyOrder = [...new Set(registry.map((t) => t.family))];
  const railFamilies = families.map((f) => f.name);
  if (railFamilies.length !== familyOrder.length || railFamilies.some((f, i) => f !== familyOrder[i])) {
    violations.push(`the families are not in registry order — rail [${railFamilies.join(', ')}] vs registry [${familyOrder.join(', ')}]`);
  }

  // 4. nothing finished-looking behind a not-built row
  for (const t of rows) {
    if (t.status === 'NOT_BUILT' && t.href) violations.push(`${t.name} is NOT_BUILT but links to ${t.href} — a not-built tool is a row with a status chip and no link`);
    if (t.status === 'NOT_BUILT' && t.phases.length) violations.push(`${t.name} is NOT_BUILT but owns ${t.phases.length} phase(s) — a phase is something the product renders`);
  }

  // 5. every phase, exactly one owner; every owner a tool or the ONE declared non-tool
  const owners = new Map<string, PhaseOwner[]>();
  for (const a of sort) {
    const key = `${a.pipe} ${a.num}`;
    const pipe = PIPE_PHASES[a.pipe] as readonly PipePhase[] | undefined;
    if (!pipe) { violations.push(`THE SORT names the pipe "${a.pipe}", which pipePhases.ts does not hold`); continue; }
    if (!pipe.some((p) => p.num === a.num)) violations.push(`${key} is not a phase of ${a.pipe} in pipePhases.ts`);
    owners.set(key, [...(owners.get(key) ?? []), a.owner]);
    if (a.owner !== HOME_OWNER && !registryNames.includes(a.owner)) {
      violations.push(`${key} is owned by "${a.owner}", which is neither one of the twenty-five nor the one declared non-tool owner (${HOME_OWNER})`);
    }
    if (!a.rendersSurface && !a.surfaceNote?.trim()) {
      violations.push(`${key} declares it renders no surface without citing where the code says so`);
    }
  }
  for (const [key, held] of owners) {
    if (held.length > 1) violations.push(`${key} is owned by ${held.length} — [${held.join(', ')}]; a phase belongs to exactly one`);
  }
  for (const [pid, phases] of Object.entries(PIPE_PHASES)) {
    for (const p of phases) {
      if (!owners.has(`${pid} ${p.num}`)) violations.push(`${pid} ${p.num} ${p.name} is owned by nothing — every phase belongs to exactly one owner`);
    }
  }

  // 7. a sub-row belongs to its own tool. A tool's sub-rows are the pages IT
  // owns; one pointing at another tool's screen is the old rail's disease —
  // Banking sending you to /books, Calendar to another room — and it is exactly
  // what made the legacy sub-links unreadable as doors.
  const screens = new Map<string, string>();
  for (const t of rows) if (t.href) screens.set(t.href.split('?')[0], t.name);
  for (const t of rows) {
    for (const r of t.subRows) {
      const owner = screens.get(r.door.href.split('?')[0]);
      if (owner && owner !== t.name) {
        violations.push(`${t.name}: the sub-row "${r.label}" opens ${r.door.href}, which is ${owner}'s screen — a tool's sub-row is a page it owns, never another tool's door`);
      }
    }
  }

  if (opts.throwOnFail !== false && violations.length) throw new NavLawError(violations.join('; '));
  return violations;
}

navLaw();
