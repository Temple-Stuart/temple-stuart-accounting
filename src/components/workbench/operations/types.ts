/**
 * Shared types for the Operations workbench.
 *
 * NorthStar mirrors the operations_north_star Prisma model 1:1 with two
 * adjustments: timestamps are serialized as ISO strings over the wire
 * (since JSON.stringify on Date produces ISO), and the row is nullable
 * (the API returns null when no row exists for the user yet).
 */

export interface NorthStar {
  id: string;
  user_id: string;
  mission_statement: string | null;
  life_stage: string | null;
  core_values: string[];
  guiding_principles: string | null;
  one_year_target: string | null;
  three_year_target: string | null;
  current_location_label: string | null;
  current_timezone: string;
  review_cadence_days: number;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/**
 * Form-side shape: same as NorthStar but without server-managed fields
 * (id, user_id, timestamps, created_by). Nullable fields become empty
 * string for form binding, then are coerced back to null on submit when
 * empty.
 */
export interface NorthStarForm {
  mission_statement: string;
  life_stage: string;
  core_values: string[];
  guiding_principles: string;
  one_year_target: string;
  three_year_target: string;
  current_location_label: string;
  current_timezone: string;
  review_cadence_days: number;
}

export const DEFAULT_NORTH_STAR_FORM: NorthStarForm = {
  mission_statement: '',
  life_stage: '',
  core_values: [],
  guiding_principles: '',
  one_year_target: '',
  three_year_target: '',
  current_location_label: '',
  current_timezone: 'America/Los_Angeles',
  review_cadence_days: 90,
};

/**
 * The North Star sections the optimize-from-reality feature supports.
 * life_stage is intentionally excluded (too short to benefit from
 * reality-grounded optimization); current_location_label / timezone /
 * review_cadence are operational metadata, not vision content.
 */
export type OptimizableSection =
  | 'mission_statement'
  | 'one_year_target'
  | 'three_year_target'
  | 'guiding_principles'
  | 'core_values';

/** Prose sections produce replacement text; core_values produces a list of chips. */
export type OptimizableKind = 'prose' | 'chips';

export interface OptimizeSectionRequest {
  section_name: OptimizableSection;
  project_ids: string[];
}

export interface OptimizeSectionInspection {
  model: string;
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
  userMessage: string;
  rawResponse: string;
}

export interface OptimizeSectionResponse {
  /** Prose sections → the proposed text. Chips → the proposed array of values. */
  proposed_value: string | string[];
  usage_id: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: string;
  inspection: OptimizeSectionInspection;
}
