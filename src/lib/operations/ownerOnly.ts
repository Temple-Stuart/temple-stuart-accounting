/**
 * SEC-TASKS-01 (2026-09-28) — ONLY THE OWNER FIRES A CLAUDE CODE ROUTINE, AND
 * ONLY THE OWNER VERIFIES THE AUDIT CHAIN.
 *
 * The two Routines this app can fire — the audit Routine (fireAuditRoutine, fired
 * by the pipe) and the Execute-Task Routine (fireExecutionRoutine, fired when a
 * pending_review task is accepted) — work on Temple Stuart's own repository under
 * the platform owner's account. The daily caps bound what a run costs; this file
 * says WHO may start one: the admin, by the one admin rule (src/lib/admin.ts
 * isAdminUser). An unset ADMIN_USER_ID throws AdminConfigError — the gate cannot
 * decide, so it does not.
 *
 * Every door asks here: run-pipe (before the project read and the event), the
 * pipe itself (its first step), the task PATCH (before any write, and only for
 * the move that fires a build), and each fire function (before its cap).
 *
 * The audit chain spans every user's audit_log rows, so its verification is the
 * owner's too (src/app/api/audit-log/verify-chain/route.ts).
 */
import { isAdminUser } from '@/lib/admin';

export const OWNER_ONLY = 'owner_only' as const;

/** The 403 a non-owner gets from run-pipe and from accepting a pending_review task. */
export const ROUTINE_OWNER_ONLY_BODY = {
  error: OWNER_ONLY,
  message: 'Build and audit runs are limited to the platform owner.',
} as const;

/** The 403 a non-owner gets from POST /api/audit-log/verify-chain. */
export const AUDIT_CHAIN_OWNER_ONLY_BODY = {
  error: OWNER_ONLY,
  message: 'Audit chain verification is limited to the platform owner.',
} as const;

/** A fire refused because the user is not the owner — thrown before any cap or env read. */
export class RoutineOwnerOnlyError extends Error {
  constructor() {
    super(ROUTINE_OWNER_ONLY_BODY.message);
    this.name = 'RoutineOwnerOnlyError';
  }
}

/** Is this user the owner who may fire a Routine? AdminConfigError when ADMIN_USER_ID is unset. */
export function isRoutineOwner(userId: string, adminValue?: string): boolean {
  return isAdminUser(userId, adminValue);
}

/** Throws RoutineOwnerOnlyError unless the user is the owner (AdminConfigError when ADMIN_USER_ID is unset). */
export function requireRoutineOwner(userId: string, adminValue?: string): void {
  if (!isRoutineOwner(userId, adminValue)) throw new RoutineOwnerOnlyError();
}

/** The one move that fires a build: a pending_review task accepted to open (EXEC-2). */
export function firesBuild(transition: { from: string; to: string } | null): boolean {
  return transition !== null && transition.from === 'pending_review' && transition.to === 'open';
}
