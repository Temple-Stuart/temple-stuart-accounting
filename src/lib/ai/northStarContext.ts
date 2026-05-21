/**
 * northStarContext — shared mapper + formatter for injecting the user's
 * North Star vision into the project AI prompts (PR-Ops-5.17).
 *
 * One source of truth for: (a) which North Star fields are injected,
 * (b) how the no-vision case is detected, (c) how the context block is
 * formatted. Used by generateProjectDesign + generateProjectTasks and
 * the 4 generation endpoints.
 *
 * Injected fields (LOCKED — PR-Ops-5.17): mission_statement,
 * one_year_target, three_year_target, guiding_principles, core_values,
 * life_stage. Operational metadata (location, timezone, review cadence,
 * timestamps) is intentionally OMITTED — irrelevant to project scoping.
 *
 * No-vision case: toNorthStarContext returns null when the row is null
 * OR every injected field is empty. formatNorthStarBlock then returns
 * '' so the userMessage is unchanged — the honest "no vision set yet"
 * omission, NOT a fabricated placeholder.
 */

export interface NorthStarContext {
  mission_statement: string | null;
  one_year_target: string | null;
  three_year_target: string | null;
  guiding_principles: string | null;
  core_values: string[];
  life_stage: string | null;
}

/** The subset of the operations_north_star row this module reads. */
interface NorthStarRowLike {
  mission_statement: string | null;
  one_year_target: string | null;
  three_year_target: string | null;
  guiding_principles: string | null;
  core_values: string[];
  life_stage: string | null;
}

function trimOrNull(v: string | null | undefined): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/**
 * Map a prisma operations_north_star row (or null) to the injected
 * context. Returns null when the row is null OR all six injected fields
 * are empty — the no-vision case (block omitted, no fabrication).
 */
export function toNorthStarContext(row: NorthStarRowLike | null): NorthStarContext | null {
  if (!row) return null;
  const mission = trimOrNull(row.mission_statement);
  const oneYear = trimOrNull(row.one_year_target);
  const threeYear = trimOrNull(row.three_year_target);
  const principles = trimOrNull(row.guiding_principles);
  const lifeStage = trimOrNull(row.life_stage);
  const values = Array.isArray(row.core_values)
    ? row.core_values.filter((v) => typeof v === 'string' && v.trim().length > 0).map((v) => v.trim())
    : [];

  const allEmpty =
    mission === null &&
    oneYear === null &&
    threeYear === null &&
    principles === null &&
    lifeStage === null &&
    values.length === 0;
  if (allEmpty) return null;

  return {
    mission_statement: mission,
    one_year_target: oneYear,
    three_year_target: threeYear,
    guiding_principles: principles,
    core_values: values,
    life_stage: lifeStage,
  };
}

/**
 * Format the North Star as a labeled context block to prepend to a
 * generator's userMessage. Returns '' when ctx is null (no-vision case),
 * leaving the userMessage unchanged. Each field is omitted individually
 * when empty — never prints a label with no content.
 */
export function formatNorthStarBlock(ctx: NorthStarContext | null): string {
  if (!ctx) return '';

  const lines: string[] = [];
  lines.push(
    "═══ THE USER'S NORTH STAR (their overarching vision — scope this project as a coherent part of it, aligned to its sequencing and values) ═══"
  );
  if (ctx.mission_statement) lines.push(`MISSION: ${ctx.mission_statement}`);
  if (ctx.one_year_target) lines.push(`1-YEAR TARGET: ${ctx.one_year_target}`);
  if (ctx.three_year_target) lines.push(`3-YEAR TARGET: ${ctx.three_year_target}`);
  if (ctx.guiding_principles) lines.push(`GUIDING PRINCIPLES:\n${ctx.guiding_principles}`);
  if (ctx.core_values.length > 0) lines.push(`CORE VALUES: ${ctx.core_values.join(', ')}`);
  if (ctx.life_stage) lines.push(`LIFE STAGE: ${ctx.life_stage}`);
  lines.push('═══ END NORTH STAR ═══');

  // Trailing separator so the block reads as a distinct preamble before
  // the project inputs that follow.
  return `${lines.join('\n')}\n\n`;
}
