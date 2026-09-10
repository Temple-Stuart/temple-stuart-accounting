/**
 * SHELL-01 — THE STEPS. The rail walks the sheet in FLOW ORDER: what you own,
 * then the proof of it, then what you owe, then money in, money out, and the
 * work that keeps it moving. Six families, twelve steps, twenty-five jobs.
 *
 * The registry (src/lib/toolRegistry.ts) stays the ONE source for what a tool
 * is, where it lives and how true its status is. This file adds ONE thing: the
 * order a human walks them in, and which jobs sit in which step. Nothing here
 * restates a status, a home or a link — every one is derived.
 *
 * THE LAW (stepsLaw — module scope, re-run at build by
 * scripts/assert-tool-registry.ts):
 *   1. every registry tool sits in exactly one step;
 *   2. every step sits in exactly one family, and its tools are that family's
 *      (the registry decides which family a tool is in — never this file);
 *   3. the families appear in FLOW_ORDER and are the registry's six;
 *   4. steps are numbered 1..12 with no gaps, in the order listed;
 *   5. a step's screen is a route or null; a step with no screen holds no LIVE
 *      tool (nothing finished hides behind an honest page);
 *   6. slugs are unique and kebab-case;
 *   7. (ROOM-01) step 11 BUDGET opens /budget, and no category page it replaced
 *      is a sub-link anywhere — six near-identical pages were eight doors in the
 *      rail; they are one room with a switcher now;
 *   8. (ROOM-02) step 12 OPERATIONS opens /operations, and none of the routes it
 *      folded in (/projects, /routines, /content) is a sub-link anywhere — one
 *      day's work was six doors in the rail; it is one room with a phase strip;
 *   9. (ACCOUNTS-01b) a job's HOME lives inside its own step — neither the home
 *      the registry names nor the DOOR the rail opens for it (doorOf, which
 *      prefers a cockpit path) may be another step's screen. Without this the
 *      rail sent step 1 ACCOUNTS to /books, step 3's room.
 * The build adds what only the filesystem can answer: every non-null screen
 * resolves to a page file.
 */
import { doorOf, doorOfLink, TOOL_REGISTRY, type ToolDoor, type ToolEntry, type ToolStatus } from './toolRegistry';
import { BUDGET_CATEGORIES, BUDGET_HOME } from './budgetCategories';
import { FOLDED_ROUTES, OPERATIONS_HOME } from './operationsPhases';
import type { FamilyName, ToolName } from './problemSheet';

/** The six families in the order a human walks them — NOT the deck's teaching order (PROBLEM_SHEET), which the sheet on HOME still shows. */
export const FLOW_ORDER: readonly FamilyName[] = [
  'WHAT YOU OWN',
  'THE PROOF',
  'WHAT YOU OWE',
  'MONEY IN',
  'MONEY OUT',
  'THE WORK',
];

export interface Step {
  /** 1..12, the walking order. */
  number: number;
  slug: string;
  name: string;
  family: FamilyName;
  /** The jobs this step holds — registry names, never retyped copy. */
  tools: readonly ToolName[];
  /** The room this step opens, or null: a step with no room opens /step/<slug>, which says so. */
  screen: string | null;
}

export const STEPS: readonly Step[] = [
  // ACCOUNTS-01b: Brokerage walks with step 2, not step 1. Its home is /trading —
  // step 2's screen — and rule 7 below holds a job's home inside its own step. Both
  // steps are WHAT YOU OWN, so rule 2 is untouched; the counts and every status are.
  // It also fixes a gate mismatch: /api/accounts is tab:books-gated (route.ts:22),
  // so step 1 carrying Brokerage's tab:trade told a trade-only viewer the step was
  // open when its data route would 403 them.
  { number: 1, slug: 'accounts', name: 'ACCOUNTS', family: 'WHAT YOU OWN', tools: ['Banking', 'Retirement', 'Fixed Assets'], screen: '/accounts' },
  { number: 2, slug: 'trading', name: 'TRADING', family: 'WHAT YOU OWN', tools: ['Brokerage', 'Trade Log'], screen: '/trading' },
  { number: 3, slug: 'books', name: 'BOOKS', family: 'THE PROOF', tools: ['Bookkeeping'], screen: '/books' },
  { number: 4, slug: 'tax', name: 'TAX', family: 'THE PROOF', tools: ['Tax'], screen: '/tax' },
  { number: 5, slug: 'compliance', name: 'COMPLIANCE', family: 'THE PROOF', tools: ['Compliance'], screen: '/compliance' },
  { number: 6, slug: 'fpa', name: 'FP&A', family: 'THE PROOF', tools: ['FP&A'], screen: null },
  { number: 7, slug: 'owed', name: 'OWED', family: 'WHAT YOU OWE', tools: ['Debt', 'Sales Tax', 'Ent Filings'], screen: null },
  { number: 8, slug: 'sales', name: 'SALES', family: 'MONEY IN', tools: ['CRM', 'Contracts', 'Invoicing', 'Payments'], screen: null },
  { number: 9, slug: 'spend', name: 'SPEND', family: 'MONEY OUT', tools: ['Bill Pay', 'Payroll', 'Expenses', 'Mileage'], screen: null },
  { number: 10, slug: 'travel', name: 'TRAVEL', family: 'MONEY OUT', tools: ['Travel'], screen: '/travel' },
    // ROOM-01: the route matches the tab name. Six category pages became one room
  // with a switcher; /business is a redirect like the other five.
  { number: 11, slug: 'budget', name: 'BUDGET', family: 'MONEY OUT', tools: ['Budget'], screen: '/budget' },
  // ROOM-02: step 12 opens THE ROOM, not one of its phases. /projects is a redirect into phase 04.
  { number: 12, slug: 'operations', name: 'OPERATIONS', family: 'THE WORK', tools: ['Calendar', 'Tasks', 'Time'], screen: '/operations' },
];

/**
 * SHELL-01: a room's name in the rail where it differs from the tool that owns
 * it. LABEL ONLY — the route, its API and its component are untouched.
 *
 * ROOM-02: its one entry ('/content' → 'Narrative') is GONE because the door it
 * renamed is gone — /content is a redirect into the room now, not a rail row.
 * The Narrative label did not disappear with it: it is phase 05's name in
 * src/lib/operationsPhases.ts, which is where the room reads it. Empty, not
 * deleted — the mechanism is the next renamed room's, and an entry pointing at
 * a route the rail no longer opens would be config that lies.
 */
export const ROOM_LABELS: Readonly<Record<string, string>> = {};

/** Where a step with no room opens: an honest page that states its jobs, their statuses and their citations. */
export const stepHref = (step: Step): string => step.screen ?? `/step/${step.slug}`;

export function stepBySlug(slug: string): Step | undefined {
  return STEPS.find((s) => s.slug === slug);
}

export function stepsOf(family: FamilyName): readonly Step[] {
  return STEPS.filter((s) => s.family === family);
}

/** The step a tool sits in. Throws when the tool is in none — the law makes that unreachable, so reaching it is a bug, not a state. */
export function stepOfTool(name: ToolName): Step {
  const step = STEPS.find((s) => (s.tools as readonly string[]).includes(name));
  if (!step) throw new StepsLawError(`${name} sits in no step`);
  return step;
}

export function toolsOfStep(step: Step): readonly ToolEntry[] {
  return step.tools.map((name) => {
    const tool = TOOL_REGISTRY.find((t) => t.name === name);
    if (!tool) throw new StepsLawError(`${name} is not a registry tool`);
    return tool;
  });
}

/** A step's status, DERIVED from its jobs: LIVE when every one is, NOT_BUILT when every one is, else PARTIAL. */
export function stepStatus(step: Step, tools: readonly ToolEntry[] = toolsOfStep(step)): ToolStatus {
  if (tools.every((t) => t.status === 'LIVE')) return 'LIVE';
  if (tools.every((t) => t.status === 'NOT_BUILT')) return 'NOT_BUILT';
  return 'PARTIAL';
}

/** The entitlement keys a step's jobs are gated by (TOOL_GATE lives in offer.ts; the caller passes the gate so this leaf stays prisma- and offer-free). */
export function stepGates(step: Step, gate: Readonly<Record<string, string | null>>): string[] {
  const keys = step.tools.map((n) => gate[n]).filter((g): g is string => typeof g === 'string' && g.startsWith('tab:'));
  return [...new Set(keys)];
}

export interface StepLink {
  label: string;
  door: ToolDoor;
}

/**
 * A step's sub-links, DERIVED: each job's own door (the registry's doorOf — a
 * cockpit section keeps its cockpit URL, exactly as the family navigation drove
 * it) and each of its related surfaces (doorOfLink). The step's own screen is
 * dropped (the step row is that door) and an href is listed once.
 * Every page that had a door under the family navigation has one here.
 */
export function stepLinks(step: Step, tools: readonly ToolEntry[] = toolsOfStep(step)): readonly StepLink[] {
  const out: StepLink[] = [];
  const seen = new Set<string>([...(step.screen ? [step.screen] : [])]);
  const add = (label: string, door: ToolDoor) => {
    if (door.kind === 'none') return;
    const href = door.href;
    if (seen.has(href)) return;
    seen.add(href);
    out.push({ label, door });
  };
  for (const tool of tools) {
    const own = doorOf(tool);
    if (own.kind !== 'none') add(ROOM_LABELS[own.href] ?? tool.name, own);
    for (const link of tool.links ?? []) add(link.label, doorOfLink(tool, link));
  }
  return out;
}

export class StepsLawError extends Error {
  constructor(message: string) {
    super(`STEPS LAW: ${message}`);
    this.name = 'StepsLawError';
  }
}

/** THE LAW. Throws on the first violation; returns the violations list when asked not to throw. Everything is injectable so a test can hand in a broken set. */
export function stepsLaw(opts: { throwOnFail?: boolean; steps?: readonly Step[]; registry?: readonly ToolEntry[]; families?: readonly FamilyName[] } = {}): string[] {
  const steps = opts.steps ?? STEPS;
  const registry = opts.registry ?? TOOL_REGISTRY;
  const flow = opts.families ?? FLOW_ORDER;
  const violations: string[] = [];

  // 3. the flow order names the registry's six families, once each
  const registryFamilies = [...new Set(registry.map((t) => t.family))];
  for (const f of flow) if (!registryFamilies.includes(f)) violations.push(`FLOW_ORDER names "${f}", which no registry tool is in`);
  for (const f of registryFamilies) if (!flow.includes(f)) violations.push(`FLOW_ORDER is missing the family "${f}"`);
  if (new Set(flow).size !== flow.length) violations.push('FLOW_ORDER repeats a family');

  // 4. numbered 1..n with no gaps, in the order listed; 6. unique kebab-case slugs
  const slugs = new Set<string>();
  steps.forEach((s, i) => {
    if (s.number !== i + 1) violations.push(`${s.name}: numbered ${s.number} at position ${i + 1} — the steps are 1..${steps.length} with no gaps`);
    if (!/^[a-z][a-z0-9-]*$/.test(s.slug)) violations.push(`${s.name}: slug "${s.slug}" is not kebab-case`);
    if (slugs.has(s.slug)) violations.push(`${s.name}: duplicate slug "${s.slug}"`);
    slugs.add(s.slug);
    if (!s.name.trim()) violations.push(`step ${s.number}: no name`);
    if (s.tools.length === 0) violations.push(`${s.name}: holds no job`);
    if (s.screen !== null && !s.screen.startsWith('/')) violations.push(`${s.name}: screen "${s.screen}" is not a route`);
  });

  // 3. the steps walk the families in flow order — a family's steps are contiguous and the families appear in FLOW_ORDER
  const familyRun = steps.map((s) => s.family).filter((f, i, all) => i === 0 || all[i - 1] !== f);
  const expected = flow.filter((f) => steps.some((s) => s.family === f));
  if (familyRun.join(' | ') !== expected.join(' | ')) {
    violations.push(`the steps walk the families as [${familyRun.join(', ')}] — FLOW_ORDER is [${expected.join(', ')}] (a family's steps are contiguous, in flow order)`);
  }

  // 1. every registry tool in exactly one step; 2. and in its own family's step
  const homes = new Map<string, string[]>();
  for (const s of steps) {
    for (const name of s.tools) {
      homes.set(name, [...(homes.get(name) ?? []), s.name]);
      const tool = registry.find((t) => t.name === name);
      if (!tool) { violations.push(`${s.name}: "${name}" is not a registry tool`); continue; }
      if (tool.family !== s.family) violations.push(`${name} is a ${tool.family} tool but sits in ${s.name}, a ${s.family} step`);
    }
  }
  for (const t of registry) {
    const held = homes.get(t.name) ?? [];
    if (held.length === 0) violations.push(`${t.name} sits in no step — every job is walked`);
    else if (held.length > 1) violations.push(`${t.name} sits in ${held.length} steps [${held.join(', ')}] — a job is walked once`);
  }

  // 5. a step with no room holds nothing finished
  for (const s of steps) {
    if (s.screen !== null) continue;
    const live = s.tools.filter((n) => registry.find((t) => t.name === n)?.status === 'LIVE');
    if (live.length) violations.push(`${s.name}: no screen, but ${live.join(', ')} ${live.length === 1 ? 'is' : 'are'} LIVE — a finished job has a room`);
  }

  // 7. BUDGET is one room (ROOM-01): its screen is /budget, and none of the six
  // category routes it replaced may reappear as a step sub-link.
  const budget = steps.find((s) => s.slug === 'budget');
  if (budget && budget.screen !== BUDGET_HOME) {
    violations.push(`BUDGET: screen "${budget.screen}" — step 11 opens ${BUDGET_HOME}, the room whose switcher holds the six categories (ROOM-01)`);
  }
  const legacy = new Set(BUDGET_CATEGORIES.map((c) => c.legacyPath));
  for (const s of steps) {
    const tools = s.tools.map((n) => registry.find((t) => t.name === n)).filter((t): t is ToolEntry => Boolean(t));
    for (const tool of tools) {
      for (const link of tool.links ?? []) {
        if (link.href && legacy.has(link.href)) {
          violations.push(`${s.name}: "${link.label}" → ${link.href} is a budget category page — it is a switch inside ${BUDGET_HOME}, not a door (ROOM-01)`);
        }
      }
    }
  }

  // 8. OPERATIONS is one room (ROOM-02): its screen is /operations, and none of
  // the routes it folded in may reappear as a step sub-link OR as a job's door.
  // Unlike ROOM-01's rule this also checks doorOf: /projects and /content were
  // COCKPIT keys, so a leftover cockpitKey would send the rail back to a
  // redirect page while the registry's `home` looked correct.
  const operations = steps.find((s) => s.slug === 'operations');
  if (operations && operations.screen !== OPERATIONS_HOME) {
    violations.push(`OPERATIONS: screen "${operations.screen}" — step 12 opens ${OPERATIONS_HOME}, the room whose phase strip reads the day top down (ROOM-02)`);
  }
  const folded = new Set(FOLDED_ROUTES.map((r) => r.path));
  for (const s of steps) {
    const tools = s.tools.map((n) => registry.find((t) => t.name === n)).filter((t): t is ToolEntry => Boolean(t));
    for (const tool of tools) {
      const own = doorOf(tool);
      if (own.kind !== 'none' && folded.has(own.href)) {
        violations.push(`${s.name}: ${tool.name}'s door is ${own.href} — that route folded into ${OPERATIONS_HOME} and is a phase inside it, not a door (ROOM-02)`);
      }
      for (const link of tool.links ?? []) {
        const door = doorOfLink(tool, link);
        if (door.kind !== 'none' && folded.has(door.href)) {
          violations.push(`${s.name}: "${link.label}" → ${door.href} folded into ${OPERATIONS_HOME} — it is a phase inside the room, not a door (ROOM-02)`);
        }
      }
    }
  }

  // 9. a job's home is inside its own step — never another step's screen
  // (ACCOUNTS-01b). Both the registry's `home` and the door the rail actually
  // opens are checked: doorOf prefers a tool's cockpit path over its home, so a
  // home inside the step with a cockpitKey pointing out of it would still send
  // the rail to another step's room — the exact bug this rule exists to stop.
  const screenOwner = new Map<string, Step>();
  for (const s of steps) if (s.screen) screenOwner.set(s.screen, s);
  for (const s of steps) {
    for (const name of s.tools) {
      const tool = registry.find((t) => t.name === name);
      if (!tool || tool.home === null) continue;
      const seen = new Set<string>();
      const door = doorOf(tool);
      for (const [what, href] of [['home', tool.home], ['door', door.kind === 'none' ? null : door.href]] as const) {
        if (href === null || seen.has(href)) continue;
        seen.add(href);
        const owner = screenOwner.get(href);
        if (owner && owner.slug !== s.slug) {
          violations.push(`${name}: ${what} ${href} is ${owner.name}'s screen, but ${name} sits in ${s.name} — a job's home is inside its own step`);
        }
      }
    }
  }

  if (violations.length && opts.throwOnFail !== false) throw new StepsLawError(violations.join('\n  '));
  return violations;
}

stepsLaw();
