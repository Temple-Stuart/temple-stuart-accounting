# DIAGNOSIS — Why `operations-pipe-run` doesn't fire in production (READ-ONLY)

**Branch:** `claude/diagnose-pipe-not-firing` · **Date:** 2026-06-19 · **Mandate:** Truth-First, read-only, cite `file:line`/config. Evidence: event `operations/pipe.run` shows **Volume 2** but **"Functions triggered: —"**; `operations-pipe-run` is **not in the Runs list**; other functions (Federal Register, Voyage, eCFR, IRS) run fine; the user already **resynced**.

---

## ROOT CAUSE (one line)

**The code is provably correct — every code-side cause is ruled out below.** `operations-pipe-run` is **not registered in Inngest Cloud's _production_ function registry**, so the published event (`Volume 2`) has **no bound consumer** (`Functions triggered: —`). This is a **deploy/sync gap for the NEW function**, not a code bug: the production app that Inngest synced from either (i) serves a **stale bundle** that predates the PHASE2-3 merge, or (ii) the **resync targeted the wrong environment / an old deployment URL**. A single `curl` (below) bisects which.

**Why the "other functions work" comparison is misleading:** every function the user sees running — Federal Register (`fedreg-ingest.ts:64` `cron`), eCFR, IRS, Voyage `embed-pending` — is **cron-triggered** and was synced long ago (PHASE2-3 landed at `52c3abe7`; the cron functions date to PR #716, `f5173efd`). **No event-triggered function has ever been proven to run in production** — `operations-pipe-run` and `health-check` are the only two event functions (grep below), and `health-check` is untested. So "others run" only proves crons synced earlier still fire; it says nothing about the newly-added event function being registered.

---

## The code is correct — every code-side cause ELIMINATED

### (a) `createFunction` signature — CORRECT (ruled out)
The SDK source dictates the exact shape (`node_modules/inngest/components/Inngest.js:551`):
> `"createFunction" expected a handler function as the second argument. Triggers belong in the first argument: createFunction({ id, triggers: { event: "..." } }, handler)`

So this SDK (`inngest@4.2.6`) is **2-arg: `createFunction(options, handler)` with `triggers` inside `options`.** That is exactly what ships:
```
// operations-pipe-run.ts:63-72
export const operationsPipeRun = inngest.createFunction(
  {
    id: 'operations-pipe-run',
    name: 'Operations Pipe Run (auto research → fusion → pending tasks)',
    triggers: [{ event: 'operations/pipe.run' }],
    concurrency: { limit: 1, key: 'event.data.projectId' },
  },
  async ({ event, step }) => { … }
);
```
Identical trigger shape to the working `health-check.ts:20-23` and the cron `fedreg-ingest.ts:60-65` (which uses `triggers: [{ cron: … }]`). `sanitizeTriggers` (`Inngest.js:561-564`) accepts the array as-is. — **Signature correct.**

### (b) Event name — IDENTICAL, byte-for-byte (ruled out)
- SEND: `name: 'operations/pipe.run'` (`run-pipe/route.ts:72`).
- TRIGGER: `event: 'operations/pipe.run'` (`operations-pipe-run.ts:67`).
- Same slash, same dot, same casing, no whitespace — and matches the dashboard's `operations/pipe.run` exactly. — **No mismatch.**

### (c) Import → array → serve chain — UNBROKEN (ruled out)
- `operations-pipe-run.ts:63` `export const operationsPipeRun`.
- `functions/index.ts:20` `import { operationsPipeRun } from './operations-pipe-run';`
- `functions/index.ts:30` listed in the `functions` array; `:33` re-exported.
- `api/inngest/route.ts:46` `export const { GET, POST, PUT } = serve({ client: inngest, functions })`.
- No typo, no conditional, no circular import. — **Served chain intact.**

### (d) The concurrency `key` — VALID, not a rejection (ruled out)
`operations-pipe-run` is the **only** function with a concurrency `key` (grep: all 6 others use `{ limit: 1 }` with no key) — so it's the natural suspect. But it is **valid**:
- The SDK's sync schema accepts it: `concurrency.key` is `z.ZodOptional<z.ZodString>` (`types.d.ts:1342`) — any string passes sync validation (CEL is evaluated at **runtime**, not sync).
- The documented format is exactly this: `ConcurrencyOption.key` examples are `event.data.user_id` (`types.d.ts:974-984`), "The event is passed into this expression as 'event'." `'event.data.projectId'` matches, and the event **carries** `projectId` (`run-pipe/route.ts:73` `data: { projectId, userId: user.id }`).
- **Decisive tell:** a bad key would be a **runtime** error → the function would be **registered** and the event **would** trigger it, producing a **failed run** in the Runs list. The evidence is the opposite — **no run at all** ("never executed", "Functions triggered: —"). A missing *run* with a published *event* means the function isn't **bound** to the event in the registry, i.e. a **registration** failure, not a runtime/key failure. — **Concurrency key is NOT the cause.**

**With (a)–(d) eliminated, the failure is not in the merged code. It is registration/sync.**

## Why a resync didn't fix it

Resyncing tells Inngest Cloud to re-read **a specific app's `/api/inngest` endpoint in a specific environment**. It fails to register `operations-pipe-run` if:
1. **The production deployment serving `/api/inngest` is stale** — older than `52c3abe7` (PHASE2-3) — so the served manifest still lists the old 7 functions, not 8. Resync faithfully registers what it reads: 7. *(Note: the "run pipe" button is PHASE2-4 client code, `7124a733`, merged after PHASE2-3 — but a button rendering only proves the **page** bundle is current; the **serverless** `/api/inngest` route can be a separate build artifact, and Inngest registers from THAT endpoint, not from the page.)*
2. **The resync hit the wrong Inngest environment** — Inngest separates **Production** vs **Branch/Dev**. Resyncing the Branch env (or a preview deployment's URL) leaves Production's registry untouched, so a Production-fired event still has no consumer.

Either way: the **served/synced production manifest for this app does not contain `operations-pipe-run`**, so the event publishes into a registry with nothing bound to it.

## THE EXACT FIX — one curl bisects it, then a targeted action

**Step 1 — read the production manifest (the GET on the serve handler returns the registered-function list):**
```
curl -s https://<PROD_DOMAIN>/api/inngest | grep -o 'operations-pipe-run'
```
- **If it prints nothing → the deployed bundle is STALE.** Production's `/api/inngest` doesn't serve the function. **Fix:** redeploy Production from `main` (the deploy must include commit `52c3abe7` / `src/inngest/functions/operations-pipe-run.ts`). On Vercel: trigger a fresh Production deployment of the latest `main` (Deployments → Redeploy latest `main`, with build cache off to be safe). Then go to Step 2.
- **If it prints `operations-pipe-run` → it's SERVED but not REGISTERED.** The deploy is fine; Inngest Cloud just hasn't bound it. Go straight to Step 2.

**Step 2 — force Inngest to re-register from Production (the serve handler's `PUT` is the sync endpoint, `api/inngest/route.ts:46`):**
```
curl -X PUT https://<PROD_DOMAIN>/api/inngest
```
Equivalent dashboard path: **Inngest → Apps → (your PRODUCTION app) → Sync/Resync** — and **confirm you are in the _Production_ environment** (top-left env switcher), not Branch/Dev.

**Step 3 — verify the binding, then re-fire:** in Inngest → **Functions** (Production env), confirm `operations-pipe-run` is listed with trigger **`operations/pipe.run`**. Then fire "run pipe" again — it now has a consumer; a run appears, and `operations_ai_pipe_usage` gets its first row (the budget step).

**If Step 1 prints the function AND Step 2's PUT returns success AND it still won't trigger:** the only remaining variable is the concurrency `key`; isolate by temporarily removing `key: 'event.data.projectId'` (keep `{ limit: 1 }`) at `operations-pipe-run.ts:69`, redeploy, resync. But per (d) this is unlikely — the schema accepts it and a key fault would surface as a failed *run*, not a missing one.

---

## Explicit answers

**(a) Trigger registration vs a working function — the exact difference.** Shape is the SAME (`triggers: [{ … }]` in the config object; `operations-pipe-run.ts:67` vs `health-check.ts:22` vs `fedreg-ingest.ts:64`). The only field unique to `operations-pipe-run` is `concurrency.key` (`:69`), and that is **valid** (`types.d.ts:1342,974-984`) — not the cause. **No meaningful difference; the trigger is correct.**

**(b) Send vs trigger event string.** **Identical** — `'operations/pipe.run'` in both (`run-pipe/route.ts:72`, `operations-pipe-run.ts:67`), matching the dashboard exactly.

**(c) Is it served by `/api/inngest`?** In the code, **yes** — unbroken `export → import → functions[] → serve()` (`operations-pipe-run.ts:63` → `index.ts:20,30` → `api/inngest/route.ts:46`). Whether the **deployed** endpoint serves it is what Step-1's `curl` confirms.

**(d) Is production current?** Cannot be assumed from the button alone (page bundle ≠ the `/api/inngest` serverless artifact Inngest registers from). **Step-1 `curl` is the definitive check.** PHASE2-3 is `52c3abe7`; the deploy must include it.

**(e) THE root cause + THE fix.** **Root cause:** `operations-pipe-run` is not registered in Inngest Cloud's Production registry (stale served bundle, or resync against the wrong environment) — the event publishes with no bound consumer. The merged code (signature, trigger, event-match, serve chain, concurrency key) is **all correct**. **Fix:** `curl -s https://<PROD_DOMAIN>/api/inngest` → if it lacks `operations-pipe-run`, **redeploy Production from `main`**; then `curl -X PUT https://<PROD_DOMAIN>/api/inngest` (or Inngest → Apps → Production app → Resync, confirming the **Production** environment) to register it; verify it lists with trigger `operations/pipe.run`; re-fire.

### Citation index
- Signature truth: `node_modules/inngest/components/Inngest.js:551` (2-arg, triggers-in-config), `:561-564` (sanitizeTriggers).
- Trigger/event: `operations-pipe-run.ts:63-72,67`; `run-pipe/route.ts:72-73`; working refs `health-check.ts:20-23`, `fedreg-ingest.ts:60-65`.
- Serve chain: `index.ts:20,30,33`; `api/inngest/route.ts:46`.
- Concurrency key validity: `types.d.ts:1342` (zod optional string), `:974-984` (CEL key docs/examples); uniqueness (grep — only `operations-pipe-run.ts:69`).
- Timeline: PHASE2-3 add `52c3abe7`; crons predate at `f5173efd` (#716).
- Env keys (publish works → present): `client.ts:30-31`, `.env.example:96,102-103`.

*Read-only — diagnosis, no code change. The fix is a deploy/sync action, with the exact commands above.*
