# DIAGNOSIS — `/api/inngest` returns `{"message":"Unauthorized"}` (401) on the www host (READ-ONLY)

**Branch:** `claude/diagnose-inngest-401` · **Date:** 2026-06-19 · **Mandate:** Truth-First, read-only, cite `file:line`. Fact: `curl -s https://www.templestuart.com/api/inngest` → exactly `{"message":"Unauthorized"}` (401).

---

## ROOT CAUSE (one line) — the 401 is **NORMAL Inngest behavior**, not the bug

The `{"message":"Unauthorized"}` comes from the **Inngest SDK itself** (`node_modules/inngest/components/InngestCommHandler.js:1012-1023`): for a **GET** when `client.mode === "cloud"` (production), the SDK **requires a valid request signature** and returns `401 {"message":"Unauthorized"}` when there isn't one. **A plain unsigned `curl`/browser GET has no signature, so a 401 is the *expected, correct* response.** Inngest Cloud's own sync/introspection requests are **signed** with `INNGEST_SIGNING_KEY`, so *they* pass validation and receive the **200** function manifest. **It is NOT `middleware.ts` and NOT `auth-helpers.ts`.** This 401 is a **red herring** — it actually proves the endpoint is deployed, reachable, and running the Inngest handler on www. **Diagnosing with an unsigned curl can never succeed (it will always 401 in cloud mode); registration must be checked via Inngest Cloud's signed path, not curl.**

---

## (a) The EXACT source of `{"message":"Unauthorized"}` — the Inngest SDK, not app code

Grepping the exact shape (`message` key, not `error`) yields two candidates:

- **`src/lib/auth-helpers.ts:28`** — `throw { status: 401, message: 'Unauthorized' };` — **RULED OUT.** It's only reached via `requireUser()`, and the Inngest route does **not** import it: `api/inngest/route.ts:17-19` imports only `serve`, `inngest`, `functions` — no `auth-helpers`, no `requireUser`, no auth wrapper. So this throw cannot fire on `/api/inngest`.

- **`node_modules/inngest/components/InngestCommHandler.js`** — **THE SOURCE.** It returns `status: 401, body: stringify({ message: "Unauthorized" })` at **`:798-800`, `:806-810`, and `:1016-1022`.** The one our GET hits (`:1012-1022`):
```js
1012  if (method === "GET") {
1013    if (this.client.mode === "cloud") {
1014      const validationResult = await signatureValidation;
1015      if (!validationResult.success) {
1016        this.client[…].error({ err: validationResult.err }, "Signature validation failed");
1017        return {
1018          status: 401,
…1020          body: stringify({ message: "Unauthorized" }),
1022        };
1023      }
1024    }
1025    return { status: 200, body: stringify(await this.introspectionBody(…)) }; // ← signed GET gets the manifest
```
The body is byte-identical to the curl output. The 401 is the **SDK's** response to an **unsigned GET in cloud mode** — by design. (The `:798/:808` variants are the POST/execute path's missing-body and signature-failure 401s — same shape, same cause: no valid signature.)

## (b) Does the middleware matcher run on `/api/inngest`, or exclude it?

**It RUNS on it — and passes it through (no 401 from middleware).** The matcher (`middleware.ts:117-126`):
```
matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']
```
This excludes only `_next/static`, `_next/image`, `favicon.ico`, and image files — **`/api/inngest` is NOT excluded**, so middleware **executes** on it. Inside, `isPublic('/api/inngest')` is **true** (`PUBLIC_PATHS` contains `'/api/inngest'`, `:60`; `isPublic` matches `pathname === p`, `:90`), so middleware returns `NextResponse.next()` at `:98` — **before** the auth redirect (`:111`). So middleware neither redirects nor 401s it; it hands off to the route, and the **Inngest SDK** produces the 401. (Note: middleware returns a *redirect*, never `{"message":"Unauthorized"}` — it cannot be the source regardless.)

**Host (www vs non-www) is irrelevant to the 401** — middleware has no host/origin check; the 401 is signature-based, identical on any host that reaches the handler. (The apex `templestuart.com` returns "Redirecting..." because of the separate Vercel domain redirect from the prior diagnosis; **www is the canonical host that actually reaches the handler** — which is why www returns the SDK's real 401 instead of a redirect. That's progress: www is the working endpoint.)

## (c) Is a 401 on an UNSIGNED GET normal? — YES, fully expected

`InngestCommHandler.js:1012-1023` only 401s a GET when **`mode === "cloud"`** AND the signature is absent/invalid. In production the client auto-detects `mode === "cloud"` (no `isDev`, `client.ts:27-32`). So:
- **Unsigned curl/browser GET → 401** `{"message":"Unauthorized"}`. **Normal. Expected. Not a misconfiguration.**
- **Inngest Cloud's signed GET (introspection) / PUT (sync) / POST (invoke)** → signature validates against `INNGEST_SIGNING_KEY` → **passes** → 200 manifest / sync / function run.

**Decisive corroboration that the signing key is VALID in prod:** the user's cron functions (Federal Register, eCFR, IRS, Voyage) **run** — and Inngest Cloud invokes them via **signed POST** to this same endpoint. If the signing key were wrong, *every* invocation (and the crons) would 401 and nothing would run. They run → the key is correct → signed requests pass → the unsigned-curl 401 is purely the absence of a signature, nothing more.

## What this means for `operations-pipe-run`

The 401 is **not** what's blocking the function. www reaches the handler and authenticates signed requests fine (crons prove it). So the real blocker is **upstream of this 401**, consistent with the prior diagnosis:
- The **apex `templestuart.com` redirects** (Vercel domain canonicalization) — if **Inngest Cloud's app URL is the apex**, its signed sync gets the "Redirecting..." 3xx and never reaches the handler → `operations-pipe-run` never registers, while older crons persist from an earlier registration.
- **www is the canonical, working URL** (it returns the SDK 401 to unsigned, and would return the 200 manifest — including `operations-pipe-run`, which is provably in the served array: `index.ts:20,30` → `route.ts:46`) to **signed** requests.

## THE EXACT FIX

1. **Stop using unsigned curl to judge the endpoint** — it will always 401 in cloud mode (`InngestCommHandler.js:1013`). That output tells you nothing about registration.
2. **In Inngest Cloud → Apps → (production app)**, set/confirm the **app URL = `https://www.templestuart.com/api/inngest`** (the canonical host that *reaches* the handler — not the apex `templestuart.com`, which redirects). **Resync.** Inngest signs the sync, so it passes the `:1013` check and reads the manifest including `operations-pipe-run`.
3. **Verify registration in the dashboard** (Functions list, Production env) — `operations-pipe-run` should now appear with trigger `operations/pipe.run`. This is the correct check (signed), not curl.
4. **Confirm `INNGEST_SIGNING_KEY` (and `INNGEST_EVENT_KEY`) in Vercel** match the Inngest **Production** environment's keys — already implied-valid by the running crons, but verify they're the *production* (not Branch/Dev) keys for the same app.
5. **Re-fire** `run-pipe` → the event now has a registered consumer; a run appears and `operations_ai_pipe_usage` gets its first row.

*(Optional hardening: make the Inngest-target host the Vercel **primary** domain so the apex redirect can never intercept a sync.)*

---

## Explicit answers

**(a) Exact file:line of the 401, and does it fire on `/api/inngest`?** The **Inngest SDK** — `InngestCommHandler.js:1016-1022` (GET, cloud mode, unsigned) — body `{"message":"Unauthorized"}`. **Yes, it fires on `/api/inngest`** (the serve handler). **NOT** `auth-helpers.ts:28` (the route doesn't import it, `route.ts:17-19`) and **NOT** middleware (which `next()`s it, `middleware.ts:98`).

**(b) Matcher runs on `/api/inngest` or excludes it?** **Runs on it** (matcher `:125` excludes only `_next`/images, not `/api/inngest`), but `isPublic` lets it through (`:60,:90,:98`) — no middleware 401/redirect.

**(c) Is the unsigned-GET 401 normal?** **Yes — expected Inngest cloud-mode behavior** (`:1013`). Inngest Cloud's signed requests pass; the running crons prove the signing key is valid. The 401 is a **red herring**, not a real block.

**(d) Root cause + fix.** **Root cause of the 401 string:** normal SDK signature-required response to an unsigned curl GET — the endpoint is healthy on www. **Root cause of `operations-pipe-run` not firing:** unchanged from the prior diagnosis — Inngest Cloud is (most likely) pointed at the **redirecting apex** instead of the canonical **www** host, so its signed sync never reaches the handler to register the function. **Fix:** point Inngest Cloud's production app URL at `https://www.templestuart.com/api/inngest`, resync, verify `operations-pipe-run` registers (in the dashboard, not via curl), re-fire. **No code change.**

### Citation index
- The 401 source: `node_modules/inngest/components/InngestCommHandler.js:1012-1022` (GET/cloud/unsigned), `:798-810` (POST variants).
- Not app auth: `api/inngest/route.ts:17-19` (imports — no auth-helpers); `auth-helpers.ts:28` (requireUser throw, unreached here).
- Middleware: `middleware.ts:117-126` (matcher — `/api/inngest` not excluded), `:60` (PUBLIC_PATHS), `:90` (isPublic), `:98` (next()), `:111` (redirect — for non-public only).
- Cloud mode + key validity: `client.ts:27-32` (no isDev → cloud); crons running ⇒ signed invocations pass.
- Function served: `index.ts:20,30` → `api/inngest/route.ts:46`.

*Read-only — the 401 is expected; the fix is the Inngest app-URL alignment to the canonical host, verified via the dashboard (signed), not curl. No code change.*
