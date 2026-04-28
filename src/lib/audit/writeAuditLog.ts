import { AuditActorType, AuditActionType, audit_log } from '@prisma/client';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

export interface WriteAuditLogInput {
  actor: {
    user_id?: string | null;
    email?: string | null;
    type: AuditActorType;
    session_id?: string | null;
    ip?: string | null;
  };
  action: {
    type: AuditActionType;
    description: string;
  };
  target: {
    table: string;
    id?: string | null;
  };
  payload?: {
    before?: unknown;
    after?: unknown;
    metadata?: unknown;
  };
  request_id?: string;
  user_agent?: string;
}

export async function writeAuditLog(input: WriteAuditLogInput): Promise<audit_log> {
  if (input.request_id) {
    const existing = await prisma.audit_log.findFirst({
      where: { request_id: input.request_id },
    });
    if (existing) return existing;
  }

  return await prisma.$transaction(
    async (tx) => {
      const prev = await tx.audit_log.findFirst({
        orderBy: { sequence_number: 'desc' },
      });

      if (!prev) {
        throw new Error(
          'audit_log has no rows — genesis row missing. ' +
            'PR-C migration should have inserted the genesis row.'
        );
      }

      const content = JSON.stringify({
        prev_hash: prev.content_hash,
        actor_user_id: input.actor.user_id ?? null,
        actor_email: input.actor.email ?? null,
        actor_type: input.actor.type,
        action_type: input.action.type,
        action_description: input.action.description,
        target_table: input.target.table,
        target_id: input.target.id ?? null,
        payload_before: input.payload?.before ?? null,
        payload_after: input.payload?.after ?? null,
        payload_metadata: input.payload?.metadata ?? null,
        request_id: input.request_id ?? null,
      });

      const content_hash = createHash('sha256').update(content).digest('hex');

      return await tx.audit_log.create({
        data: {
          prev_hash: prev.content_hash,
          content_hash,
          actor_user_id: input.actor.user_id ?? null,
          actor_email: input.actor.email ?? null,
          actor_type: input.actor.type,
          actor_session_id: input.actor.session_id ?? null,
          actor_ip: input.actor.ip ?? null,
          action_type: input.action.type,
          action_description: input.action.description,
          target_table: input.target.table,
          target_id: input.target.id ?? null,
          payload_before: input.payload?.before ?? undefined,
          payload_after: input.payload?.after ?? undefined,
          payload_metadata: input.payload?.metadata ?? undefined,
          request_id: input.request_id ?? null,
          user_agent: input.user_agent ?? null,
        },
      });
    },
    { isolationLevel: 'Serializable' }
  );
}
