import { Prisma, AuditActorType, AuditActionType, audit_log } from '@prisma/client';
import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

const MAX_RETRY_ATTEMPTS = 5;

/**
 * Postgres serializable isolation will abort one of two concurrent
 * writers with code 40001 (Prisma maps this to P2034). P2024 covers
 * transaction-acquire timeouts under heavy contention. Both are safe
 * to retry — the hash chain re-reads the latest prev_hash inside the
 * retried transaction, so retries naturally resolve the race.
 */
function isRetryableError(err: unknown): boolean {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    (err.code === 'P2034' || err.code === 'P2024')
  );
}

/**
 * Exponential backoff with ±50% jitter to avoid thundering-herd
 * resync on multiple concurrent retriers. Floor at 10ms.
 */
function sleepWithJitter(baseMs: number): Promise<void> {
  const jitter = baseMs * (Math.random() - 0.5);
  return new Promise((r) => setTimeout(r, Math.max(10, baseMs + jitter)));
}

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
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          // Idempotency check INSIDE the transaction so the lookup
          // shares a snapshot with the subsequent insert. Prevents
          // double-write races when a retry coincides with another
          // writer's commit.
          if (input.request_id) {
            const existing = await tx.audit_log.findFirst({
              where: { request_id: input.request_id },
            });
            if (existing) return existing;
          }

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
    } catch (err) {
      lastError = err;
      if (isRetryableError(err) && attempt < MAX_RETRY_ATTEMPTS - 1) {
        const backoff = 50 * Math.pow(2, attempt);
        console.warn(
          `[writeAuditLog] retry attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS} ` +
            `due to ${(err as Prisma.PrismaClientKnownRequestError).code}`
        );
        await sleepWithJitter(backoff);
        continue;
      }
      throw err;
    }
  }

  // Unreachable in practice — the loop either returns on success or
  // throws on the final attempt. Kept for TS exhaustiveness.
  throw lastError;
}
