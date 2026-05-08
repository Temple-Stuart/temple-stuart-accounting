/**
 * Singleton Anthropic client for the operations workbench AI features.
 *
 * Centralizes the SDK instantiation that was previously scattered across
 * 5 API routes. All new AI features (PR-Ops-3.5 onward) use this client;
 * existing routes can incrementally migrate without behavior change.
 *
 * Model alias convention: callers pass the dated model ID directly (e.g.,
 * 'claude-sonnet-4-20250514') matching existing codebase usage. Future PR
 * may centralize model selection but v0 keeps the choice with the caller.
 */

import Anthropic from '@anthropic-ai/sdk';

let _client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in environment');
  }
  _client = new Anthropic({ apiKey });
  return _client;
}

/**
 * Sonnet 4 (dated 2025-05-14) — current production model in this codebase.
 * Matches the convention used by /api/ai/* and /api/ops/* routes.
 */
export const MODEL_SONNET_4 = 'claude-sonnet-4-20250514';

/**
 * Cost per million tokens for cost tracking. Source: Anthropic pricing page.
 * Update when pricing changes; future PR may move this to a per-model
 * config that auto-syncs.
 */
export const COST_PER_MILLION_INPUT_USD: Record<string, number> = {
  'claude-sonnet-4-20250514': 3.0,
};

export const COST_PER_MILLION_OUTPUT_USD: Record<string, number> = {
  'claude-sonnet-4-20250514': 15.0,
};

/**
 * Compute USD cost for a completed call. Returns Decimal-precision
 * dollar amount as a string (suitable for Prisma.Decimal).
 *
 * Throws if model isn't in the cost table — defensive against silently
 * recording $0 for an unknown model.
 */
export function computeCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number
): string {
  const inputRate = COST_PER_MILLION_INPUT_USD[model];
  const outputRate = COST_PER_MILLION_OUTPUT_USD[model];
  if (inputRate === undefined || outputRate === undefined) {
    throw new Error(
      `[ai-client] no cost rate registered for model "${model}". ` +
      `Add to COST_PER_MILLION_*_USD in src/lib/ai/client.ts`
    );
  }
  const cost = (inputTokens * inputRate + outputTokens * outputRate) / 1_000_000;
  // Format with 6 decimal places to match Decimal(10,6) schema column.
  return cost.toFixed(6);
}
