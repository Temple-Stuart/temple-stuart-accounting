/**
 * SELL-05b — THE ADMIN ID, from the deployment env. The one place that says
 * who the admin is: ADMIN_USER_ID (the users.id of the founder's account —
 * User #1). Every admin gate asks here — the entitlement bypass
 * (src/lib/entitlements.ts), /api/auth/me's isAdmin flag (the client twins
 * read THAT, never the id), the admin-only routes.
 *
 * FAIL-LOUD: when a gate asks and the env is unset, this throws
 * AdminConfigError — the gate cannot decide, so it does not; a missing
 * setting is never a silent "nobody is admin" (which would lock the founder
 * out) nor a silent "everybody is" (which would open every bypass). Set it in
 * Vercel before deploying (README, env table).
 *
 * Zero imports; server-only by content (the env is not NEXT_PUBLIC_). The
 * value is injectable so the rule runs in node:test.
 */
export class AdminConfigError extends Error {
  constructor() {
    super('ADMIN_USER_ID is not set — the admin gate cannot decide (set it in the deployment env)');
    this.name = 'AdminConfigError';
  }
}

/** The admin's users.id, or a throw. */
export function adminUserId(value: string | undefined = process.env.ADMIN_USER_ID): string {
  if (typeof value !== 'string' || value.trim() === '') throw new AdminConfigError();
  return value.trim();
}

/** Is this user the admin? Throws AdminConfigError when the env is unset — a gate that cannot decide does not. */
export function isAdminUser(userId: string | null | undefined, value: string | undefined = process.env.ADMIN_USER_ID): boolean {
  const admin = adminUserId(value);
  return typeof userId === 'string' && userId === admin;
}
