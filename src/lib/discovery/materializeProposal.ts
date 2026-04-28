import { prisma } from '@/lib/prisma';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import type {
  TaskPriorityTier,
  ResidualRiskLevel,
  DueDateBasis,
  MonitoringFrequency,
  AttestationFrequency,
  DocumentType,
} from '@prisma/client';

interface MaterializedRow {
  table: string;
  id: string;
}

export async function materializeProposal(
  proposalId: string,
  userEmail: string,
  userId: string,
  modifications?: Record<string, unknown>
): Promise<{ materialized: MaterializedRow[] }> {
  const proposal = await prisma.discovery_proposals.findUnique({
    where: { id: proposalId },
    include: {
      discovery_run: true,
      children: { where: { status: 'proposed' }, orderBy: { display_order: 'asc' } },
    },
  });

  if (!proposal) throw new Error('Proposal not found');

  const payload = modifications
    ? { ...(proposal.proposed_payload as Record<string, unknown>), ...modifications }
    : (proposal.proposed_payload as Record<string, unknown>);

  const materialized: MaterializedRow[] = [];
  let createdId: string | null = null;
  let tableName: string | null = null;

  const runUserId = proposal.discovery_run.user_id;

  if (proposal.proposal_type === 'mission') {
    const row = await prisma.missions.create({
      data: {
        user_id: runUserId,
        title: payload.title as string,
        description: (payload.description as string) || null,
        framework_mappings: (payload.framework_mappings as string[]) || [],
        status: 'draft',
      },
    });
    createdId = row.id;
    tableName = 'missions';
    materialized.push({ table: 'missions', id: row.id });

    await writeAuditLog({
      actor: { user_id: userId, email: userEmail, type: 'human_user' },
      action: { type: 'mission_created', description: `Created mission from discovery proposal: ${row.title}` },
      target: { table: 'missions', id: row.id },
      payload: { after: row, metadata: { source_proposal_id: proposalId } },
    });
  } else if (proposal.proposal_type === 'project') {
    const parentProposal = proposal.parent_proposal_id
      ? await prisma.discovery_proposals.findUnique({ where: { id: proposal.parent_proposal_id } })
      : null;
    if (!parentProposal?.materialized_to_id) throw new Error('Parent mission must be materialized first');

    const row = await prisma.projects.create({
      data: {
        mission_id: parentProposal.materialized_to_id,
        title: payload.title as string,
        description: (payload.description as string) || null,
        domain_label: (payload.domain_label as string) || '',
        status: 'not_started',
      },
    });
    createdId = row.id;
    tableName = 'projects';
    materialized.push({ table: 'projects', id: row.id });

    await writeAuditLog({
      actor: { user_id: userId, email: userEmail, type: 'human_user' },
      action: { type: 'project_created', description: `Created project from discovery proposal: ${row.title}` },
      target: { table: 'projects', id: row.id },
      payload: { after: row, metadata: { source_proposal_id: proposalId } },
    });
  } else if (proposal.proposal_type === 'workstream') {
    const parentProposal = proposal.parent_proposal_id
      ? await prisma.discovery_proposals.findUnique({ where: { id: proposal.parent_proposal_id } })
      : null;
    if (!parentProposal?.materialized_to_id) throw new Error('Parent project must be materialized first');

    const row = await prisma.workstreams.create({
      data: {
        project_id: parentProposal.materialized_to_id,
        title: payload.title as string,
        description: (payload.description as string) || null,
        status: 'not_started',
      },
    });
    createdId = row.id;
    tableName = 'workstreams';
    materialized.push({ table: 'workstreams', id: row.id });

    await writeAuditLog({
      actor: { user_id: userId, email: userEmail, type: 'human_user' },
      action: { type: 'workstream_created', description: `Created workstream from discovery proposal: ${row.title}` },
      target: { table: 'workstreams', id: row.id },
      payload: { after: row, metadata: { source_proposal_id: proposalId } },
    });
  } else if (proposal.proposal_type === 'task') {
    const parentProposal = proposal.parent_proposal_id
      ? await prisma.discovery_proposals.findUnique({ where: { id: proposal.parent_proposal_id } })
      : null;
    if (!parentProposal?.materialized_to_id) throw new Error('Parent workstream must be materialized first');

    const row = await prisma.compliance_tasks.create({
      data: {
        workstream_id: parentProposal.materialized_to_id,
        title: payload.title as string,
        description: (payload.description as string) || '',
        priority_tier: ((payload.priority_tier as string) || 'best_practice') as TaskPriorityTier,
        inherent_likelihood: ((payload.inherent_likelihood as string) || 'moderate') as ResidualRiskLevel,
        inherent_impact: ((payload.inherent_impact as string) || 'moderate') as ResidualRiskLevel,
        priority_rationale: (payload.priority_rationale as string) || null,
        due_date_basis: ((payload.due_date_basis as string) || 'not_applicable') as DueDateBasis,
        due_date_rationale: (payload.due_date_rationale as string) || null,
        monitoring_frequency: ((payload.monitoring_frequency as string) || 'not_applicable') as MonitoringFrequency,
        attestation_frequency: ((payload.attestation_frequency as string) || 'not_applicable') as AttestationFrequency,
        penalty_min_amount: payload.penalty_min_amount as number | undefined,
        penalty_max_amount: payload.penalty_max_amount as number | undefined,
        penalty_description: (payload.penalty_description as string) || null,
        penalty_weight: (payload.penalty_weight as number) || 0,
        estimated_effort_hours_min: payload.estimated_effort_hours_min as number | undefined,
        estimated_effort_hours_max: payload.estimated_effort_hours_max as number | undefined,
        estimated_cost_min: payload.estimated_cost_min as number | undefined,
        estimated_cost_max: payload.estimated_cost_max as number | undefined,
        action_steps: (payload.action_steps as string[]) || [],
        module_relevance: (payload.module_relevance as string[]) || [],
        framework_mappings: (payload.framework_mappings as string[]) || [],
      },
    });
    createdId = row.id;
    tableName = 'compliance_tasks';
    materialized.push({ table: 'compliance_tasks', id: row.id });

    const citationPayloads = proposal.proposed_citation_payloads as Array<Record<string, unknown>>;
    for (const cp of citationPayloads) {
      const source = await prisma.regulatory_sources.findFirst({
        where: { domain: cp.regulatory_source_domain as string, is_active: true },
      });
      if (!source) continue;

      const citation = await prisma.citations.upsert({
        where: { stable_uri: cp.stable_uri as string },
        create: {
          regulatory_source_id: source.id,
          document_type: ((cp.document_type as string) || 'other') as unknown as DocumentType,
          citation_string: cp.citation_string as string,
          pinpoint: (cp.pinpoint as string) || null,
          stable_uri: cp.stable_uri as string,
          retrieved_url: cp.retrieved_url as string,
          retrieved_at: new Date(),
          retrieved_content_hash: '',
          retrieval_method: 'ai_discovery',
          version_label: (cp.version_label as string) || '',
          effective_date: cp.effective_date ? new Date(cp.effective_date as string) : null,
        },
        update: {},
      });

      await prisma.task_citations.create({
        data: { task_id: row.id, citation_id: citation.id, relevance_note: (cp.relevance_note as string) || null },
      });
    }

    await writeAuditLog({
      actor: { user_id: userId, email: userEmail, type: 'human_user' },
      action: { type: 'task_created', description: `Created task from discovery proposal: ${row.title}` },
      target: { table: 'compliance_tasks', id: row.id },
      payload: { after: row, metadata: { source_proposal_id: proposalId, citation_count: citationPayloads.length } },
    });
  }

  const proposalStatus = modifications ? 'modified_then_accepted' : 'accepted';
  await prisma.discovery_proposals.update({
    where: { id: proposalId },
    data: {
      status: proposalStatus,
      reviewed_at: new Date(),
      reviewed_by: userEmail,
      materialized_to_table: tableName,
      materialized_to_id: createdId,
      materialized_at: new Date(),
      user_modifications: modifications ? JSON.parse(JSON.stringify(modifications)) : undefined,
    },
  });

  await writeAuditLog({
    actor: { user_id: userId, email: userEmail, type: 'human_user' },
    action: {
      type: 'ai_verification_passed',
      description: `Proposal ${proposalId} ${proposalStatus}: materialized to ${tableName}/${createdId}`,
    },
    target: { table: 'discovery_proposals', id: proposalId },
    payload: {
      metadata: {
        materialized_to_table: tableName,
        materialized_to_id: createdId,
        had_modifications: !!modifications,
      },
    },
  });

  // Recursively materialize children proposals still in 'proposed' status
  for (const child of proposal.children) {
    const childResult = await materializeProposal(child.id, userEmail, userId);
    materialized.push(...childResult.materialized);
  }

  return { materialized };
}
