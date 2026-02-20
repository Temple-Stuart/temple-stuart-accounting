// Centralized AI client config
// Reads standard env vars with optional URL overrides for Synthetic.dev, local LLMs, etc.

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// ── Model constants (env-configurable with sensible defaults) ──

export const models = {
  /** OpenAI "smart" model — complex tasks (meal plan, cart plan) */
  primary: process.env.OPENAI_MODEL || 'gpt-4o',
  /** OpenAI "fast" model — simple tasks (spending insights, meal planner chat) */
  light: process.env.OPENAI_MODEL_LIGHT || 'gpt-4.1-nano',
  /** Anthropic model — market brief, strategy analysis, convergence synthesis */
  anthropic: process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514',
  /** xAI Grok model — trip AI with live web/X search */
  xai: process.env.XAI_MODEL || 'grok-4-1-fast-non-reasoning',
};

// ── OpenAI-compatible client (singleton) ──

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  ...(process.env.OPENAI_BASE_URL && { baseURL: process.env.OPENAI_BASE_URL }),
});

// ── Anthropic client factory ──

export function anthropic(): Anthropic {
  return new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    ...(process.env.ANTHROPIC_BASE_URL && { baseURL: process.env.ANTHROPIC_BASE_URL }),
  });
}

// ── Anthropic retry helper (shared by strategy-analysis, convergence-synthesis, market-brief) ──

export async function callAnthropicWithRetry(
  client: Anthropic,
  params: Anthropic.MessageCreateParamsNonStreaming,
  maxRetries = 3,
): Promise<Anthropic.Message> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await client.messages.create(params);
    } catch (e: any) {
      if (e.status === 429 && i < maxRetries - 1) {
        const retryAfter = parseInt(e.headers?.['retry-after'] || '10');
        const wait = Math.min(retryAfter, 120) * 1000;
        console.log(`[Anthropic] Rate limited, retry ${i + 1}/${maxRetries} in ${wait / 1000}s`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      throw e;
    }
  }
  throw new Error('Unreachable: callAnthropicWithRetry exhausted retries');
}
