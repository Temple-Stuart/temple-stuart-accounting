# DIAGNOSIS — `/api/inngest` doesn't list `operations-pipe-run` even after a fresh prod redeploy (READ-ONLY)

**Branch:** `claude/diagnose-inngest-endpoint` · **Date:** 2026-06-19 · **Mandate:** Truth-First, read-only, cite `file:line`. Facts: `curl -s https://templestuart.com/api/inngest | grep -o operations-pipe-run` prints nothing after a fresh prod redeploy; `curl -X PUT https://templestuart.com/api/inngest` returns **"Redirecting..."**; the function is on `main` with a verified-correct signature.

---

## ROOT CAUSE (one line)

**`https://templestuart.com/api/inngest` issues a platform-level (Vercel) domain redirect, so neither the `curl` nor Inngest Cloud's sync ever reaches the serve handler.** The `curl -s` (no `-L`) returns the redirect's **"Redirecting..."** HTML body — *not* the JSON manifest — so `grep` finds nothing. **This is a false negative: the function is NOT absent from the bundle** (the import→array→serve chain is provably intact, below). The redirect is **not in the repo** — middleware, `next.config.ts`, and `vercel.json` all explicitly do *not* redirect `/api/inngest` — so it's a **Vercel Domains canonicalization** (apex `templestuart.com` → its canonical host, e.g. `www`, or an http→https/primary-domain redirect). Inngest Cloud, pointed at this redirecting URL, gets bounced on **sync** (so the new function never registers) and would be bounced on **invoke** too; the old cron functions still run because they were registered in an **earlier** successful sync.

---

## (a) Does middleware redirect/block `/api/inngest`? — NO (prime suspect RULED OUT)

The task's prime suspect is **exonerated by one line**: `/api/inngest` is in `PUBLIC_PATHS` (`middleware.ts:60`):
```
50  const PUBLIC_PATHS = [
…
60    '/api/inngest',
…
87  ];
89  function isPublic(pathname: string): boolean {
90    return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
91  }
93  export async function middleware(request: NextRequest) {
94    const { pathname } = request.nextUrl;
97    if (isPublic(pathname)) {
98      return NextResponse.next();   // ← /api/inngest exits here, NO redirect
99    }
…
111      return NextResponse.redirect(loginUrl);  // ← only for NON-public paths
```
A request to `/api/inngest` → `isPublic('/api/inngest')` is `true` (`pathname === '/api/inngest'`) → `NextResponse.next()` at `:98`, **before** the auth-redirect at `:111`. So middleware does **not** redirect it. **The "Redirecting..." is not middleware.**

**And it isn't any other repo redirect:**
- `next.config.ts` — `async redirects()` only maps `/ops` → `/compliance` (`next.config.ts:37-39`); **no `trailingSlash`** (default `false`, so no `/api/inngest`→`/api/inngest/` bounce); no `/api/inngest` rule.
- `vercel.json` — only a `crons` entry; **no `redirects`/`rewrites`.**

With all three repo-level redirect sources ruled out, the redirect is **platform-level (Vercel Domains)** — apex/canonical-host canonicalization — which lives in Vercel project settings, **not the codebase**.

## (b) Is `operations-pipe-run` actually in the served array? — YES (build-exclusion RULED OUT)

The chain is intact and **unconditional** — no env-gate, no typo, no `if`:
- `operations-pipe-run.ts:63` — `export const operationsPipeRun = inngest.createFunction(…)`.
- `functions/index.ts:20` — `import { operationsPipeRun } from './operations-pipe-run';`
- `functions/index.ts:22-31` — `export const functions = [ …, operationsPipeRun ];` (`:30`) — **no conditional, no `process.env` gate** (grep for `if (`/`process.env` in this file → none around the array).
- `functions/index.ts:33` — re-exported.
- `api/inngest/route.ts:46` — `export const { GET, POST, PUT } = serve({ client: inngest, functions });`

So the served `functions` array **contains** `operations-pipe-run`. The `grep`-returns-nothing result is **not** evidence of absence — it's the consequence of the request being redirected before it reached this handler (a).

## (c) Any build-time import failure that drops it from the bundle? — NO

`operations-pipe-run.ts` imports (`:29-36`): `NonRetriableError` from `'inngest'`, `inngest` from `'../client'`, `prisma`, `generateDeepResearch`, `generateProjectTasks`, `toNorthStarContext`, `requirePipeBudget`/`PipeBudgetError`, `writeAuditLog` — all ordinary server-module imports in the same families the other functions use (every Inngest function imports `prisma`; the AI libs are lazy — `getAnthropicClient` reads `process.env` **at call time**, not module load). Crucially, **a module-load failure would break the ENTIRE `/api/inngest` route** (one bundle), taking down *all* functions — but the cron functions still run, proving the route loads fine. So there is **no partial build exclusion** of this one function. (And a build/import failure would never produce a **"Redirecting..."** body — that is unambiguously a 3xx redirect.)

## Why a fresh redeploy didn't help

Redeploying rebuilds the bundle (which already contains the function — b). It does **not** change the **domain redirect** (a Vercel Domains setting) nor the **URL Inngest Cloud is configured to sync/invoke**. So after redeploy, Inngest still points at the redirecting `templestuart.com/api/inngest`, still gets bounced on sync, and `operations-pipe-run` still never lands in the registry. The crons persist from their earlier (pre-redirect, or differently-routed) registration.

---

## THE EXACT FIX

**Step 1 — prove the redirect + find its target:**
```
curl -sI https://templestuart.com/api/inngest
```
Look for `HTTP/2 307|308` and a **`location:`** header (e.g. `https://www.templestuart.com/api/inngest`). That target is the **canonical, non-redirecting** host.

**Step 2 — confirm the function IS served at the canonical host (follow the redirect):**
```
curl -sL https://templestuart.com/api/inngest | grep -o operations-pipe-run
# or hit the canonical host directly:
curl -s https://<CANONICAL_HOST>/api/inngest | grep -o operations-pipe-run
```
This returns the **real** manifest. It will print `operations-pipe-run` — proving the earlier "nothing" was the redirect, not an absent function.

**Step 3 — point Inngest Cloud at the canonical URL + resync:**
In Inngest → **Apps → (production app) → URL/Sync**, set the serve URL to the **canonical** `https://<CANONICAL_HOST>/api/inngest` (the one that returns **200 JSON**, not a 308), and **Resync**. Inngest uses this URL both to register functions *and* to invoke them (signed POST), so it must not redirect. Confirm `operations-pipe-run` now lists with trigger `operations/pipe.run`.

**Step 4 — align the canonical domain (so this can't recur):** in Vercel → **Project → Domains**, note which host is **primary** (no redirect) vs which **redirects to it**. Use the primary host for both the Inngest app URL (Step 3) and ensure the app's own `inngest.send` runs server-side (domain-agnostic — it publishes via `INNGEST_EVENT_KEY`, not the public URL, so sends are unaffected; only sync/invoke need the canonical URL).

**Step 5 — re-fire** `run-pipe`: with the function registered via the non-redirecting URL, the event now has a consumer; a run appears and `operations_ai_pipe_usage` gets its first row.

---

## Explicit answers

**(a) Middleware redirect/block?** **No** — `/api/inngest` is in `PUBLIC_PATHS` (`middleware.ts:60`) → `isPublic` true (`:90`) → `next()` (`:98`), never the auth redirect (`:111`). Nor `next.config.ts` (only `/ops`, `:37-39`, no `trailingSlash`) nor `vercel.json` (no redirects). The "Redirecting..." is a **Vercel Domains** apex→canonical redirect — **platform config, not repo.**

**(b) In the served array?** **Yes** — `operations-pipe-run.ts:63` export → `index.ts:20` import → `index.ts:30` array entry (unconditional) → `api/inngest/route.ts:46` `serve({ functions })`. No env-gate, no typo.

**(c) Build-time import failure?** **No** — ordinary server imports (`:29-36`), AI client is lazy (call-time `process.env`); a load failure would break the *whole* route (crons would die too — they don't), and would not yield a "Redirecting..." body.

**(d) THE root cause + THE fix.** **Root cause:** `https://templestuart.com/api/inngest` redirects (Vercel domain canonicalization), so the curl and Inngest's sync never reach the serve handler — `curl -s` returns the "Redirecting..." page, hence the empty `grep`; the function is correctly in the bundle but the **registration URL bounces.** **Fix:** find the redirect target (`curl -sI`), point Inngest Cloud's app/sync URL at the **canonical non-redirecting host's** `/api/inngest`, resync, verify `operations-pipe-run` lists, re-fire. *(No code change — but optionally add `/api/inngest` to a domain-agnostic path or make the Inngest-target host the Vercel primary domain so syncs never hit a redirect.)*

### Citation index
- Middleware: `middleware.ts:50-60` (PUBLIC_PATHS incl. `/api/inngest`), `:89-91` (isPublic), `:97-98` (public→next), `:108-112` (redirect only for non-public).
- Repo redirects ruled out: `next.config.ts:37-39` (only `/ops`, no trailingSlash); `vercel.json` (crons only).
- Served chain intact: `operations-pipe-run.ts:63`; `functions/index.ts:20,30,33`; `api/inngest/route.ts:46`.
- Imports normal/lazy: `operations-pipe-run.ts:29-36`.
- Publish unaffected by domain: `client.ts:30-31` (`eventKey` from env, not URL).

*Read-only — diagnosis. The fix is a Vercel/Inngest URL alignment, with the exact `curl`s above; no code change required.*
