import { user_profiles } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { recordUsage } from '@/lib/ai/recordUsage';
import { MODEL_SONNET_4 } from '@/lib/ai/client';
import { DISCOVERY_SYSTEM_PROMPT_V2 } from './prompts/v2/system';
import { profileToQueries } from './prompts/v1/profileToQueries';
import { DISCOVERY_USAGE_PURPOSE, frameUntrusted, requireDiscoveryBudget } from './discoveryGate';

// SEC-03: the model id comes from the one cost-registered constant so recordUsage can
// price the call (computeCostUsd throws on an unregistered model — fail loud, not $0).
const MODEL = MODEL_SONNET_4;
// SEC-03: prompt v2 = v1 + the untrusted-web-data clause (prompts/v2/system.ts).
const PROMPT_VERSION = 'v2';
const MAX_TOKENS = 16000;
// The API default; recordUsage requires an explicit value. The v1 call passed none.
const TEMPERATURE = 1;

export interface DiscoveryRunInput {
  userId: string;
  userEmail: string;
  profile: user_profiles;
}

export async function runDiscovery(input: DiscoveryRunInput): Promise<{ discoveryRunId: string }> {
  const { userId, userEmail, profile } = input;

  // SEC-03 gate 1 — daily budget from RECORDED spend, BEFORE any row or paid call.
  // Over cap → DiscoveryBudgetError, declared by the route; the run never starts.
  const budget = await requireDiscoveryBudget(userId);

  const sources = await prisma.regulatory_sources.findMany({
    where: { is_active: true },
    select: { id: true, domain: true },
  });
  const activeDomains = sources.map((s) => s.domain);

  const searchQueries = profileToQueries(
    {
      business_description: profile.business_description,
      operating_jurisdictions: profile.operating_jurisdictions,
      customer_jurisdictions: profile.customer_jurisdictions,
      products_services: profile.products_services,
      ai_use_in_product: profile.ai_use_in_product,
      handles_personal_data: profile.handles_personal_data,
      handles_financial_data: profile.handles_financial_data,
      handles_health_data: profile.handles_health_data,
      revenue_stage: profile.revenue_stage,
      employee_count: profile.employee_count,
      planned_actions_24mo: profile.planned_actions_24mo,
    },
    activeDomains
  );

  const run = await prisma.discovery_runs.create({
    data: {
      user_id: userId,
      user_profile_id: profile.id,
      user_profile_snapshot: JSON.parse(JSON.stringify(profile)),
      status: 'initiated',
      model_used: MODEL,
      prompt_version: PROMPT_VERSION,
      sources_queried_ids: sources.map((s) => s.id),
    },
  });

  await writeAuditLog({
    actor: { email: userEmail, type: 'human_user' },
    action: { type: 'ai_generation_started', description: `Started discovery run ${run.id}` },
    target: { table: 'discovery_runs', id: run.id },
    payload: {
      metadata: {
        model: MODEL,
        prompt_version: PROMPT_VERSION,
        query_count: searchQueries.length,
        budget_spent_today_usd: budget.spentUsd,
        budget_cap_usd: budget.capUsd,
      },
    },
  });

  try {
    await prisma.discovery_runs.update({ where: { id: run.id }, data: { status: 'web_search_running', status_message: 'Searching regulatory sources...' } });

    const userMessage = buildUserMessage(profile, searchQueries, activeDomains);

    // SEC-03: the call goes through recordUsage, as every other pipe does — tokens
    // and cost land in operations_ai_usage (purpose 'compliance_discovery', the row
    // the daily budget reads) plus the audit row, with the full prompt and response
    // kept for the audit tail. web_search results arrive as server-side tool blocks
    // inside the model's context; nothing fetched is concatenated by this code.
    const result = await recordUsage({
      userId,
      userEmail,
      model: MODEL,
      systemPrompt: DISCOVERY_SYSTEM_PROMPT_V2,
      userMessage,
      maxTokens: MAX_TOKENS,
      temperature: TEMPERATURE,
      purpose: DISCOVERY_USAGE_PURPOSE,
      targetTable: 'discovery_runs',
      targetId: run.id,
      inputsSummary: `profile_id=${profile.id}; query_count=${searchQueries.length}; allowed_domains=${activeDomains.length}`,
      auditDescription: `Discovery run ${run.id}: web search + compliance scoping`,
      tools: [
        { type: 'web_search_20250305', name: 'web_search', allowed_domains: activeDomains },
      ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    });

    const inputTokens = result.inputTokens;
    const outputTokens = result.outputTokens;
    // recordUsage does not surface cache-read tokens; this call sets no cache_control,
    // so the API reports none. Recorded as 0, not imputed.
    const cacheReadTokens = 0;
    const cost = result.costUsd;

    // Count the server-side web searches from the persisted raw content array.
    let webSearchCount = 0;
    try {
      const blocks = JSON.parse(result.inspection.rawResponse) as Array<{ type?: string }>;
      webSearchCount = blocks.filter((b) => b?.type === 'server_tool_use').length;
    } catch {
      throw new Error('discovery: recordUsage returned a non-JSON raw response with tools enabled');
    }

    await prisma.discovery_runs.update({ where: { id: run.id }, data: { status: 'synthesis_running', status_message: 'Parsing AI response...' } });

    const jsonText = result.text;

    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI response did not contain valid JSON');

    const parsed = JSON.parse(jsonMatch[0]);
    const missions = parsed.missions || [];

    await prisma.discovery_runs.update({ where: { id: run.id }, data: { status: 'citation_verification', status_message: 'Verifying citations...' } });

    let proposalCount = 0;
    let citationCount = 0;
    let displayOrder = 0;

    for (const mission of missions) {
      const missionProposal = await prisma.discovery_proposals.create({
        data: {
          discovery_run_id: run.id,
          proposal_type: 'mission',
          proposed_payload: { title: mission.title, description: mission.description, framework_mappings: mission.framework_mappings || [] },
          ai_rationale: mission.ai_rationale || '',
          ai_priority_score: mission.ai_priority_score ?? null,
          ai_confidence: mission.ai_confidence ?? null,
          display_order: displayOrder++,
        },
      });
      proposalCount++;

      for (const project of mission.projects || []) {
        const projectProposal = await prisma.discovery_proposals.create({
          data: {
            discovery_run_id: run.id,
            proposal_type: 'project',
            parent_proposal_id: missionProposal.id,
            proposed_payload: { title: project.title, description: project.description, domain_label: project.domain_label || '' },
            ai_rationale: project.ai_rationale || '',
            display_order: displayOrder++,
          },
        });
        proposalCount++;

        for (const workstream of project.workstreams || []) {
          const wsProposal = await prisma.discovery_proposals.create({
            data: {
              discovery_run_id: run.id,
              proposal_type: 'workstream',
              parent_proposal_id: projectProposal.id,
              proposed_payload: { title: workstream.title, description: workstream.description },
              ai_rationale: workstream.ai_rationale || '',
              display_order: displayOrder++,
            },
          });
          proposalCount++;

          for (const task of workstream.tasks || []) {
            const taskCitations = (task.citations || []).filter((c: Record<string, string>) => activeDomains.includes(c.regulatory_source_domain));
            citationCount += taskCitations.length;

            await prisma.discovery_proposals.create({
              data: {
                discovery_run_id: run.id,
                proposal_type: 'task',
                parent_proposal_id: wsProposal.id,
                proposed_payload: {
                  title: task.title,
                  description: task.description,
                  priority_tier: task.priority_tier,
                  priority_rationale: task.priority_rationale,
                  inherent_likelihood: task.inherent_likelihood,
                  inherent_impact: task.inherent_impact,
                  due_date_basis: task.due_date_basis,
                  due_date_rationale: task.due_date_rationale,
                  monitoring_frequency: task.monitoring_frequency,
                  attestation_frequency: task.attestation_frequency,
                  penalty_min_amount: task.penalty_min_amount,
                  penalty_max_amount: task.penalty_max_amount,
                  penalty_description: task.penalty_description,
                  penalty_weight: task.penalty_weight,
                  estimated_effort_hours_min: task.estimated_effort_hours_min,
                  estimated_effort_hours_max: task.estimated_effort_hours_max,
                  estimated_cost_min: task.estimated_cost_min,
                  estimated_cost_max: task.estimated_cost_max,
                  action_steps: task.action_steps || [],
                  module_relevance: task.module_relevance || [],
                  framework_mappings: task.framework_mappings || [],
                },
                proposed_citation_payloads: taskCitations,
                ai_rationale: task.ai_rationale || '',
                ai_confidence: task.ai_confidence ?? null,
                display_order: displayOrder++,
              },
            });
            proposalCount++;
          }
        }
      }
    }

    await prisma.discovery_runs.update({
      where: { id: run.id },
      data: {
        status: 'completed',
        status_message: null,
        completed_at: new Date(),
        anthropic_input_tokens: inputTokens,
        anthropic_output_tokens: outputTokens,
        anthropic_cache_read_tokens: cacheReadTokens,
        web_searches_run: webSearchCount,
        estimated_cost_usd: cost,
        proposals_generated_count: proposalCount,
        citations_generated_count: citationCount,
      },
    });

    await writeAuditLog({
      actor: { email: userEmail, type: 'ai_agent' },
      action: { type: 'ai_generation_completed', description: `Discovery run ${run.id} completed: ${proposalCount} proposals, ${citationCount} citations` },
      target: { table: 'discovery_runs', id: run.id },
      payload: {
        metadata: {
          input_tokens: inputTokens,
          output_tokens: outputTokens,
          cache_read_tokens: cacheReadTokens,
          web_searches: webSearchCount,
          cost_usd: cost,
          proposals: proposalCount,
          citations: citationCount,
          research_gaps: parsed.research_gaps || [],
          // SEC-03: instructions the model found inside web results or the profile
          // block — reported, never followed (prompts/v2/system.ts rule 7).
          untrusted_instructions_observed: parsed.untrusted_instructions_observed || [],
          usage_id: result.usageId,
        },
      },
    });

    return { discoveryRunId: run.id };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await prisma.discovery_runs.update({
      where: { id: run.id },
      data: { status: 'failed', failure_reason: errorMessage, failed_at: new Date(), status_message: null },
    });

    await writeAuditLog({
      actor: { email: userEmail, type: 'ai_agent' },
      action: { type: 'ai_generation_failed', description: `Discovery run ${run.id} failed: ${errorMessage}` },
      target: { table: 'discovery_runs', id: run.id },
      payload: { metadata: { error: errorMessage } },
    });

    throw error;
  }
}

function buildUserMessage(
  profile: user_profiles,
  searchQueries: Array<{ query: string; allowed_domains: string[]; practice_areas: string[] }>,
  activeDomains: string[]
): string {
  // SEC-03: the profile is user-supplied free text — framed as delimited, labeled DATA
  // (frameUntrusted), not concatenated raw; the v2 system prompt tells the model the
  // block is never an instruction. Web results never pass through this function: the
  // web_search server tool inserts them as tool-result blocks the same clause covers.
  const profileBlock = frameUntrusted('compliance profile (user-supplied)', `Business: ${profile.business_description}
Operating Jurisdictions: ${profile.operating_jurisdictions.join(', ') || 'None specified'}
Customer Jurisdictions: ${profile.customer_jurisdictions.join(', ') || 'Same as operating'}
Products/Services: ${profile.products_services.join(', ') || 'Not specified'}
AI in Product: ${profile.ai_use_in_product ? `Yes — ${profile.ai_use_description || 'details not provided'}` : 'No'}
Handles Personal Data: ${profile.handles_personal_data}
Handles Financial Data: ${profile.handles_financial_data}
Handles Health Data: ${profile.handles_health_data}
Revenue Stage: ${profile.revenue_stage}
Employees: ${profile.employee_count}
Planned Actions (24mo): ${profile.planned_actions_24mo.join('; ') || 'None'}
Completed Filings: ${profile.known_completed_filings.join('; ') || 'None'}
Notes: ${profile.notes || 'None'}`);

  return `COMPLIANCE PROFILE:
${profileBlock}

SEARCH QUERIES TO RUN (use web_search for each):
${searchQueries.map((q, i) => `${i + 1}. "${q.query}" [domains: ${q.allowed_domains.join(', ')}] [areas: ${q.practice_areas.join(', ')}]`).join('\n')}

ALLOWED DOMAINS (citations MUST come from these):
${activeDomains.join(', ')}

Generate a comprehensive compliance scoping analysis following the JSON schema in your system prompt. Run web searches to ground every citation in real, current regulatory text.`;
}
