// Next.js instrumentation hook — runs ONCE when the server boots (Node runtime;
// the Edge runtime boots middleware separately and is skipped here).
// LAUNCH-01 SECRET-01: the session-secret guard. A deploy still carrying the
// retired NEXTAUTH_SECRET, or missing JWT_SECRET, refuses to boot with the fix
// named — no request is served on a misconfigured secret.
// ENV-01: the site-URL guard. In production NEXTAUTH_URL must be an https
// origin whose host equals NEXT_PUBLIC_APP_URL's — next-auth builds every OAuth
// callback from it, and a bare-domain value broke GitHub sign-in silently.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  const { secretGuard } = await import('@/lib/secretGuard');
  secretGuard(process.env);
  const { siteUrlGuard } = await import('@/lib/siteUrlGuard');
  const site = siteUrlGuard(process.env);
  console.log(site.checked ? `[boot] NEXTAUTH_URL checked — host ${site.host}` : `[boot] NEXTAUTH_URL check skipped — ${site.reason}`);
}
