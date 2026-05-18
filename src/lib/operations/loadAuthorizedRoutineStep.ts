import { prisma } from '@/lib/prisma';

/**
 * Returns the routine step if it exists AND is owned by userId.
 * Returns null for any other case (not found OR cross-user) — defensive
 * non-disclosure per Citadel posture.
 */
export async function loadAuthorizedRoutineStep(stepId: string, userId: string) {
  return prisma.operations_routine_steps.findFirst({
    where: { id: stepId, user_id: userId },
  });
}
