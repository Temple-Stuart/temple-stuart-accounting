/**
 * ROOM-02 — THE OPERATIONS PHASES. Step 12 was scattered across the rail: its
 * screen was /projects, with Calendar, Routines, the Issue log, the Audit tail
 * and Narrative hanging off it as sub-links, plus /operations (north star +
 * daily plan) living somewhere else again. Its three jobs — Calendar, Tasks,
 * Time — are ONE day's work seen from six doors.
 *
 * They are ONE room now, read TOP DOWN at /operations, the way Books reads as
 * phases. This file is the ONE const that room's phase strip, its redirects,
 * the steps law and the tests all read. Nothing retypes a phase name.
 *
 * WHY NOT PIPE_PHASES (src/lib/pipePhases.ts): that leaf is keyed by
 * PipePillarId — the DECK's pillars — and Landing.tsx:130-132 throws unless
 * every pillar's phase count matches WALKTHROUGH_LEDGER's step count. Adding
 * an `operations` pillar would mean writing deck copy, which this PR is not.
 * Books keeps its own 13-stage → 6-phase nesting map local to BooksPipeline
 * for the same reason; the RATIFIED PATTERN reused here is StageStrip +
 * SectionHeader, not the pillar leaf.
 */

export interface OperationsPhase {
  /** Two-digit mono ordinal, exactly as the strip renders it. */
  num: string;
  /** The ?phase= value — kebab-case, the URL's word. */
  key: string;
  /** The strip's phase name. */
  name: string;
  /** The micro-label under the name — derived from the mounted surface's own strings, never invented. */
  subLabel: string;
  /** The component this phase mounts, named for the report; the room does the mounting. */
  mounts: string;
}

export const OPERATIONS_PHASES: readonly OperationsPhase[] = [
  { num: '01', key: 'plan',      name: 'PLAN',      subLabel: 'NORTH STAR + TODAY',   mounts: 'SectionB_NorthStar + SectionC_DailyPlan' },
  { num: '02', key: 'calendar',  name: 'CALENDAR',  subLabel: 'EVENTS · PLAN · ROUTINES', mounts: 'HubCalendar' },
  { num: '03', key: 'routines',  name: 'ROUTINES',  subLabel: 'THE RECURRING FORM',   mounts: 'SectionE_Routines' },
  { num: '04', key: 'projects',  name: 'PROJECTS',  subLabel: 'PROJECTS + THEIR TASKS', mounts: 'SectionD_ProjectBacklog' },
  { num: '05', key: 'narrative', name: 'NARRATIVE', subLabel: 'SCENES · TAKES · SCRIPTS', mounts: 'ContentPipeline' },
  { num: '06', key: 'log',       name: 'LOG',       subLabel: 'THE AUDIT TAIL',       mounts: 'SectionK_AuditTail' },
];

/** The room. */
export const OPERATIONS_HOME = '/operations';

/** A shareable link to one phase — the selection lives in the URL, never in browser storage. */
export const operationsHref = (key: string): string => `${OPERATIONS_HOME}?phase=${key}`;

/**
 * The routes ROOM-02 folded into the room. Each becomes a redirect; the steps
 * law reads this so none of them can come back as a rail door.
 */
export const FOLDED_ROUTES: readonly { path: string; phase: string }[] = [
  { path: '/projects', phase: 'projects' },
  { path: '/routines', phase: 'routines' },
  { path: '/content',  phase: 'narrative' },
];

/**
 * The phase named by ?phase=, and whether the name given was not one of ours.
 * An unknown phase falls to 01 and the room SAYS SO — never a silent
 * correction of the URL the viewer typed, never an empty room.
 */
export function phaseFor(raw: string | undefined): { phase: OperationsPhase; fellBack: boolean } {
  const found = raw ? OPERATIONS_PHASES.find((p) => p.key === raw.toLowerCase()) : undefined;
  if (found) return { phase: found, fellBack: false };
  return { phase: OPERATIONS_PHASES[0], fellBack: raw !== undefined && raw !== '' };
}

export class OperationsPhasesLawError extends Error {
  constructor(message: string) {
    super(`OPERATIONS PHASES LAW: ${message}`);
    this.name = 'OperationsPhasesLawError';
  }
}

/** THE LAW — runs at module scope and again at build. */
export function operationsPhasesLaw(opts: { throwOnFail?: boolean; phases?: readonly OperationsPhase[] } = {}): string[] {
  const phases = opts.phases ?? OPERATIONS_PHASES;
  const violations: string[] = [];
  const keys = new Set<string>();
  phases.forEach((p, i) => {
    const n = String(i + 1).padStart(2, '0');
    if (p.num !== n) violations.push(`phase ${i + 1} is numbered "${p.num}" — the strip reads top down, 01..${String(phases.length).padStart(2, '0')} with no gaps`);
    if (!/^[a-z][a-z0-9-]*$/.test(p.key)) violations.push(`"${p.key}" is not a kebab-case URL word`);
    if (keys.has(p.key)) violations.push(`"${p.key}" is used twice — a ?phase= value names exactly one phase`);
    keys.add(p.key);
    for (const field of ['name', 'subLabel', 'mounts'] as const) {
      if (!p[field]) violations.push(`${p.key}: ${field} is empty — a phase names what it is and what it mounts`);
    }
    if (p.name !== p.name.toUpperCase()) violations.push(`${p.key}: name "${p.name}" is not mono-uppercase, which is what the strip renders`);
  });
  for (const r of FOLDED_ROUTES) {
    if (!keys.has(r.phase)) violations.push(`${r.path} folds into phase "${r.phase}", which is not a phase`);
    if (!r.path.startsWith('/')) violations.push(`folded route "${r.path}" is not a root path`);
  }
  if (opts.throwOnFail !== false && violations.length) throw new OperationsPhasesLawError(violations.join('; '));
  return violations;
}

operationsPhasesLaw();
