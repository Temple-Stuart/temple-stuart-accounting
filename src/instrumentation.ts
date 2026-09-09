// Next.js instrumentation hook — runs ONCE when the server boots (Node runtime;
// the Edge runtime boots middleware separately and is skipped here).
// LAUNCH-01 SECRET-01: the session-secret guard. A deploy still carrying the
// retired NEXTAUTH_SECRET, or missing JWT_SECRET, refuses to boot with the fix
// named — no request is served on a misconfigured secret.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { secretGuard } = await import('@/lib/secretGuard');
  secretGuard(process.env);
}
