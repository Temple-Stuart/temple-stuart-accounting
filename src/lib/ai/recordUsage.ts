/**
 * recordUsage — wraps an Anthropic message call with cost tracking and
 * audit logging. Every AI feature in the operations workbench should
 * use this wrapper so cost data and evidentiary audit rows are written
 * uniformly.
 *
 * Returns the AI's text output PLUS the usage row id (so callers can
 * include it in their own audit metadata if desired).
 *
 * Order of operations (sequential awaits, matches codebase convention):
 *   1. Call Anthropic.messages.create
 *   2. Compute cost from usage tokens
 *   3. Insert operations_ai_usage row
 *   4. Write audit_log row with action_type='operations_ai_inference',
 *      payload.metadata.usage_id pointing to the usage row
 *   5. Return text + usage_id to caller
 *
 * The audit log target is the AFFECTED entity (e.g., the project being
 * scoped), NOT the usage row itself. This means filtering audit_log by
 * target_table='operations_projects' AND target_id=X surfaces every
 * event affecting the project including AI generations.
 *
 * PR-Ops-3.8: optional `tools` + `toolChoice` enable structured-output
 * synthesis. When the caller passes a forced custom tool_choice plus
 * the web_search_20250305 server tool, Claude can do web research and
 * return structured JSON in one shot. Custom tool_use blocks are
 * extracted into `toolUses` for the caller; server-side blocks
 * (server_tool_use, web_search_tool_result) stay inline in
 * full_response for audit-tail inspection only.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { computeCostUsd, getAnthropicClient } from './client';

interface RecordUsageInput {
  /** Caller identification — used by audit row + usage row. */
  userId: string;
  userEmail: string;

  /** Model + call parameters. */
  model: string;
  systemPrompt: string;
  userMessage: string;
  maxTokens: number;
  temperature: number;

  /** Cost tracking metadata. */
  purpose: string;            // e.g., 'project_design_generation'
  targetTable: string | null; // e.g., 'operations_projects'
  targetId: string | null;    // e.g., the project's UUID
  inputsSummary: string | null;  // human-readable digest
  auditDescription: string;   // e.g., 'Generated design for "Project X"'

  /**
   * Optional tool-use parameters (PR-Ops-3.8). Passing `tools` enables
   * web_search server tools or custom tools; passing `toolChoice` (e.g.,
   * `{ type: 'tool', name: 'return_project_tasks' }`) forces structured
   * JSON output via a custom tool. Both omitted = existing single-shot
   * text behavior.
   */
  tools?: Anthropic.ToolUnion[];
  toolChoice?: Anthropic.ToolChoice;
}

interface RecordUsageOutput {
  text: string;
  usageId: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: string;
  /**
   * Inspection block — the full context of this AI call.
   * Returned to callers so endpoints can include it in their response
   * for real-time transparency (the user sees exactly what went in
   * and what came out before deciding to accept the AI's output).
   *
   * Persisted to operations_ai_usage.full_* columns for audit-tail
   * row expansion (Section K) and post-hoc inspection by regulators,
   * CPAs, or future weight-tuning analysis.
   */
  inspection: {
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
    userMessage: string;
    rawResponse: string;
  };
  /**
   * Custom tool invocations extracted from response.content. Only
   * client-defined tools (e.g., return_project_tasks) appear here.
   * Server-side tools (web_search_20250305) stay in full_response
   * (via JSON.stringify of the raw content array) but are excluded
   * here so callers don't accidentally treat web search inputs as
   * structured outputs.
   */
  toolUses?: Array<{ id: string; name: string; input: unknown }>;
}

export async function recordUsage(input: RecordUsageInput): Promise<RecordUsageOutput> {
  const client = getAnthropicClient();

  const createParams: Anthropic.MessageCreateParamsNonStreaming = {
    model: input.model,
    max_tokens: input.maxTokens,
    temperature: input.temperature,
    system: input.systemPrompt,
    messages: [{ role: 'user', content: input.userMessage }],
  };
  if (input.tools && input.tools.length > 0) {
    createParams.tools = input.tools;
  }
  if (input.toolChoice) {
    createParams.tool_choice = input.toolChoice;
  }

  const response = await client.messages.create(createParams);

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');

  // Custom tool_use blocks (client-defined tools only). server_tool_use
  // and web_search_tool_result blocks are excluded — they live in
  // full_response (raw JSON) for inspection but aren't structured
  // outputs the caller should parse.
  const toolUses = response.content
    .filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    .map((b) => ({ id: b.id, name: b.name, input: b.input }));

  const inputTokens = response.usage.input_tokens;
  const outputTokens = response.usage.output_tokens;
  const costUsd = computeCostUsd(input.model, inputTokens, outputTokens);

  // full_response captures the entire content array (text + tool_use +
  // server_tool_use + web_search_tool_result) when tools are in play,
  // or the plain text when not. JSON.stringify of the array preserves
  // every block for forensic replay; plain text preserves the legacy
  // shape for non-tool callers.
  const fullResponseForPersistence =
    input.tools && input.tools.length > 0
      ? JSON.stringify(response.content)
      : text;

  const outputSummary =
    text.length > 200 ? `${text.length} chars; preview: ${text.slice(0, 180)}…` : text;

  const usageRow = await prisma.operations_ai_usage.create({
    data: {
      user_id: input.userId,
      model: input.model,
      purpose: input.purpose,
      target_table: input.targetTable,
      target_id: input.targetId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      cost_usd: costUsd,
      inputs_summary: input.inputsSummary,
      output_summary: outputSummary,
      full_system_prompt: input.systemPrompt,
      full_user_message: input.userMessage,
      full_response: fullResponseForPersistence,
      created_by: input.userEmail,
    },
  });

  await writeAuditLog({
    actor: {
      user_id: input.userId,
      email: input.userEmail,
      type: 'human_user',
    },
    action: {
      type: 'operations_ai_inference',
      description: input.auditDescription,
    },
    target: {
      table: input.targetTable ?? 'operations_ai_usage',
      id: input.targetId ?? usageRow.id,
    },
    payload: {
      metadata: {
        usage_id: usageRow.id,
        purpose: input.purpose,
        model: input.model,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: costUsd,
      },
    },
  });

  return {
    text,
    usageId: usageRow.id,
    inputTokens,
    outputTokens,
    costUsd,
    inspection: {
      model: input.model,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      systemPrompt: input.systemPrompt,
      userMessage: input.userMessage,
      rawResponse: fullResponseForPersistence,
    },
    toolUses: toolUses.length > 0 ? toolUses : undefined,
  };
}
