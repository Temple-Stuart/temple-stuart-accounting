import type { Prisma, OperationsTaskStatus } from '@prisma/client';

/**
 * Records a task status change in operations_task_status_history.
 *
 * MUST be called inside an active prisma.$transaction so the history insert
 * and the task update commit atomically. If the caller does not pass a
 * transaction client, the history insert is not transactionally bound to
 * the corresponding task update — that violates the PR-Ops-4.2 single-funnel
 * invariant.
 *
 * @param tx             Prisma transaction client (REQUIRED)
 * @param taskId         UUID of the task whose status changed
 * @param userId         Owner user id of the task (audit scope)
 * @param previousStatus Status before the change (null only if no prior state — should not happen in PR-Ops-4.2 callers)
 * @param newStatus      Status after the change
 * @param changedBy      Actor email (matches writeAuditLog actor.email convention)
 * @param reason         Optional free-text context (e.g. "clicked complete by mistake")
 */
export async function recordTaskStatusChange(
  tx: Prisma.TransactionClient,
  taskId: string,
  userId: string,
  previousStatus: OperationsTaskStatus | null,
  newStatus: OperationsTaskStatus,
  changedBy: string,
  reason?: string | null
): Promise<void> {
  if (previousStatus === newStatus) {
    // No-op: not a transition. Caller bug if this is hit.
    return;
  }
  await tx.operations_task_status_history.create({
    data: {
      task_id: taskId,
      user_id: userId,
      previous_status: previousStatus,
      new_status: newStatus,
      changed_by: changedBy,
      reason: reason ?? null,
    },
  });
}
