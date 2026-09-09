// ─── LAUNCH-01 SECRET-01 — one secret for the session ────────────────────────
// Before this PR two names did one job: NEXTAUTH_SECRET signed the NextAuth
// session token ([...nextauth]/route.ts) while JWT_SECRET verified it
// (middleware.ts getToken, src/app/page.tsx decode) and signed everything else
// (the userEmail cookie, verification links, IP hashing). The audit ruled that
// JWT_SECRET survives — it has seven readers, NEXTAUTH_SECRET had one — and the
// NextAuth handler now signs with JWT_SECRET too.
//
// This guard runs ONCE at server boot (src/instrumentation.ts, Node runtime).
// It is pure over an env record so node:test drives it without touching
// process.env:
//   - NEXTAUTH_SECRET present (any value, even empty) → throw: the retired name
//     lingering in a deploy is exactly the drift this PR closes — "set
//     JWT_SECRET instead", never silently ignored.
//   - JWT_SECRET missing/empty → throw: the session cannot be signed or verified.
//   - otherwise → the surviving name.

export const SESSION_SECRET = 'JWT_SECRET' as const;
export const RETIRED_SESSION_SECRET = 'NEXTAUTH_SECRET' as const;

export class SecretConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecretConfigError';
  }
}

/** Pure: the one session secret an env record must carry, or a SecretConfigError naming the fix. */
export function secretGuard(env: Record<string, string | undefined>): { secret: typeof SESSION_SECRET } {
  if (env[RETIRED_SESSION_SECRET] !== undefined) {
    throw new SecretConfigError(
      `${RETIRED_SESSION_SECRET} is retired — set ${SESSION_SECRET} instead ` +
        `(one secret signs and verifies the session; remove ${RETIRED_SESSION_SECRET} from the environment)`,
    );
  }
  if (!env[SESSION_SECRET]) {
    throw new SecretConfigError(`${SESSION_SECRET} is not set — the session cannot be signed or verified`);
  }
  return { secret: SESSION_SECRET };
}
