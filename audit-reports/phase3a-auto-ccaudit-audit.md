# AUDIT — Phase 3A: auto CC-audit via a Claude Code Routine, output wired back into `claude_code_audit_input` (READ-ONLY)

**Branch:** `claude/audit-phase3a-auto-ccaudit` · **Date:** 2026-06-19 · **Mandate:** Truth-First, read-only, cite `file:line`/doc. Scope: the pipe auto-runs the Claude Code audit on the repo via a Routine, and the findings land in `claude_code_audit_input` so fusion consumes real audit output instead of `'(none provided)'`.

---

## VERDICT (one paragraph)

The clean seam is a **token-guarded callback endpoint** (option **a**): the app `/fire`s a Claude Code Routine (passing the project's goals + research as context + the `buildAuditPrompt` methodology), the Routine runs the audit on the repo, then **POSTs its findings back** to a new `POST [id]/audit-ingest` endpoint guarded by a bearer token (the **proven `CRON_SECRET` pattern**, `auto-categorize/route.ts:8-24`), which writes the **same column** the manual PATCH writes today (`[id]/route.ts:134`). This avoids a GitHub-API file-read (the app has **no GitHub API client** — only NextAuth) and keeps the app as the sole DB writer. For the full chain (Phase 3B), `operations-pipe-run` fires the Routine after research, then **`step.waitForEvent('operations/audit.ingested')`** (the SDK supports it, `InngestStepTools.d.ts:226`) with a timeout, then fires fusion with the now-real audit. **All gates hold** (Routine pushes claude/-only, no Azure, platform-keyed Anthropic) — but **two hard prerequisites**: (1) Inngest production wiring must be fixed first (the keys gap from the last VERIFY — Phase 3 is dead until events publish/consume), and (2) the Routine is metered on a **separate** Anthropic meter (Alex's Claude account, ~15/day) — `requirePipeBudget` does **not** cover it, so a Routine-fire cap is needed. Routines = **Alex's own loop**; multi-tenant selling = per-customer accounts or the sandboxed Agent-SDK.

---

## ⚠ PREREQUISITE (carried from the last VERIFY) — Inngest prod wiring

Phase 3 rides entirely on Inngest actually running. The prior trace found `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` are *required in production* (`.env.example:96,102-103`) and read straight from env (`client.ts:30-31`); without them `inngest.send` throws / no function is invoked. **Until that config gap is closed and the app is synced to Inngest Cloud, neither Phase-2 nor any Phase-3 chain fires.** Fix that before building Phase 3A. — **BLOCKER, config not code.**

## 1 · THE ROUTINE FIRE PATH

- **What fires:** a server-side `POST` to the Claude Code Routines `/fire` API (per code.claude.com/docs — the Apr-2026 cloud-hosted Routines), with a **bearer token** in the `Authorization` header. The app has **no external-fire client today** (grep for `/fire`/`x-api-key`/external bearer in `src/lib/ai/client.ts` → none) — this is **net-new** (a small `fireAuditRoutine()` lib).
- **Token storage:** server-side env only, **the `CRON_SECRET` pattern** — `auto-categorize/route.ts:8-24` reads `process.env.CRON_SECRET` and checks `authHeader === 'Bearer ' + cronSecret`. The Routine `/fire` token lives in Vercel env (e.g. `CLAUDE_ROUTINE_TOKEN`), used only from server routes / the Inngest job, **never client-exposed** (mirrors the prior `routine-loop-scope-audit.md:42`).
- **The fire payload must carry project context** — the Routine runs on the *repo* (no DB, no auth, can't call the app's prompt routes, per `routine-loop-scope-audit.md:29`). So the app injects the **project's goals + the research findings** (the standard to audit against) into the fire prompt, built from **`buildAuditPrompt(input)`** which already takes exactly `{ projectTitle, goalItems, deepResearchInput }` (`buildAuditPrompt.ts:21-27`) and is literally "copy into Claude Code, read-only, cite file:line" text (`:1-17`). It also must pass the **projectId + callback URL + a one-time correlation id** so the Routine knows where to POST back.
- **Insertion point in `operations-pipe-run`:** today the function is `load-context → research → fusion → land-pending` (`operations-pipe-run.ts`). The audit step inserts **after `research`** (so the audit measures against fresh research) and **before `fusion`** (so fusion reads real audit). In Phase 3A it can be a fire-and-store (manual review still), in Phase 3B a fire-then-`waitForEvent` (§3).

## 2 · THE OUTPUT-INGESTION WIRE (the crux)

The Routine's native output is a **git commit/branch/file** — and **the app cannot read git** (no GitHub API client; `src/lib`/`src/app` grep for `octokit`/`api.github.com`/`GITHUB_TOKEN` → only `auth/[...nextauth]`, which is sign-in, not repo API). Three options:

- **(a) Token-guarded callback endpoint — RECOMMENDED.** The Routine (instructed via its CLAUDE.md/prompt) `POST`s its findings to a new `POST /api/operations/projects/[id]/audit-ingest`, guarded by the **`CRON_SECRET`-style bearer** (`auto-categorize/route.ts:8-24`). The endpoint validates the token, scopes to the project, and writes `claude_code_audit_input` — the **same column** the manual PATCH writes today (`[id]/route.ts:134`, the `['…','claude_code_audit_input']` field loop). 
  - **Pro:** reuses the proven token gate; direct DB write; **no GitHub API client needed**; the app stays the sole, scoped writer; trivially emits the resume event for §3.
  - **Con:** a new auth surface — must validate the bearer + a correlation id (so only the Routine *we* fired can write, and only to *its* project). The token is shared (one secret); the body carries `projectId` + `correlationId`, the token authorizes the write (same trust model as `CRON_SECRET` writing per-user data).
- **(b) App reads the Routine's committed file via GitHub API.** Routine commits `audit-output/<projectId>.md` to a `claude/` branch; app fetches it. **Con:** requires building a **GitHub API client (none exists)** + polling or a webhook + couples the app to git plumbing. Heavier; not recommended.
- **(c) Routine writes to a shared store the app polls.** Vague; same coupling/polling cost as (b), plus a store. Not recommended.

**Recommendation: (a).** It writes to the established column via the established token pattern, needs no new external client, and the same endpoint naturally emits the `operations/audit.ingested` event that unblocks the chain.

**Security of the callback (flag):** token-gate first (401 before any write, like `auto-categorize:18-24`); validate `correlationId` against a value the app stored when it fired (so a leaked token can't write arbitrary projects); cap body size; treat the findings as **untrusted text** (it's stored, never executed — consistent with CLAUDE.md's web-content injection guard).

## 3 · THE CHAIN (Phase 3B) — Inngest waits for the async Routine

Today the audit is an *inline absence* (`fusion` reads empty audit → `'(none provided)'`, `generateProjectTasks.ts:170-172`). With an async Routine, the durable pattern is:

```
load-context → research (write deep_research_input)
  → step.run('fire-audit'): requireRoutineBudget(userId); fireAuditRoutine({ projectId, goals, research, correlationId, callbackUrl, token })
  → step.waitForEvent('await-audit', { event: 'operations/audit.ingested',
        match: 'data.projectId', timeout: '15m' })
  → step.run('fusion'): generateProjectTasks({ …, claudeCodeAuditInput: <now populated> })
  → step.run('land-pending')
```
- **`step.waitForEvent` is supported** (`node_modules/inngest/components/InngestStepTools.d.ts:226`) — the function durably suspends (no compute billed while waiting) until the callback endpoint (§2a) emits `operations/audit.ingested` with the matching `projectId`, or the timeout fires.
- **On timeout (Routine never called back):** the chain should **proceed with empty audit** → `'(none provided)'` (Phase-2 graceful behavior) rather than hang — audit is *optional* grounding, not a hard gate. **Flag this as the design decision** (proceed-degraded vs. mark-pending-and-stop); recommend proceed-degraded + log, so a flaky Routine never blocks tasks.
- **Phase 3A vs 3B split:** 3A = fire the Routine + the callback writes `claude_code_audit_input` (the user still clicks fusion, or the existing pipe reads it next run) — **no waitForEvent yet**. 3B = insert the `waitForEvent` so one "run pipe" does research→audit→fusion end to end. Splitting de-risks: 3A proves the fire+wire in isolation.

## 4 · SECURITY / COST / GATES

- **Firing from the app grants the Routine NO new access** — it still pushes **claude/-only** (can't self-merge; merge = Alex's SOC-2 control, `routine-loop-scope-audit.md:51`), still has **no `DATABASE_URL`** (can't touch Azure, `:35,52`), and uses the **Routine platform's** Anthropic key + the **Claude GitHub App**, not the repo's secrets (`:40-41`). The app firing it is just an HTTP trigger. The Routine **does not get DB access** — it writes `claude_code_audit_input` only *through* the app's token-gated, project-scoped endpoint (the app does the write).
- **Cost — a SEPARATE meter (flag):** the Routine bills **Alex's Claude account** (the ~15/day Routine quota + token cost), which is **distinct from** the app's `ANTHROPIC_API_KEY` calls that `requirePipeBudget` caps (`pipeBudget.ts:60`). So a Routine fire does **not** count against the pipe's daily cap and is **currently uncapped by our code**. **Needed:** a `requireRoutineBudget(userId)` mirroring `pipeBudget.ts` (a per-user/day Routine-fire counter, fail-loud over cap) **before** each `/fire`, so an auto-loop can't burn the Routine quota. Until built, rely on the platform's 15/day ceiling — but that's the *account's*, not per-project.
- **The `/fire` token:** Vercel env only, server-side, `CRON_SECRET` pattern (`auto-categorize:8`), never in the client bundle. The **callback bearer** likewise.

## 5 · MINE vs SELLABLE

- **Routines = Alex's own loop** — his Claude account, ~15 runs/day shared quota (`routine-loop-scope-audit.md:46`). Fine for a solo founder auditing a handful of projects/day.
- **Multi-tenant selling cannot share Alex's account** — each customer needs their **own account/Routine** OR the **sandboxed Agent-SDK** (ephemeral read-only per-tenant runner; the Phase-3 product architecture). **Do not build the SaaS on shared-quota Routines** (`:47`). Phase 3A here is **Alex's loop**, explicitly not the multi-tenant path.

---

## Explicit answers

**(a) The /fire path + token.** Server-side `POST` to the Claude Code Routines `/fire` API with a bearer token stored in Vercel env (`CRON_SECRET` pattern, `auto-categorize/route.ts:8-24`); net-new `fireAuditRoutine()` lib (no external-fire client exists today). The fire payload injects the project's goals + research + `buildAuditPrompt` text (`buildAuditPrompt.ts:21-27`) + projectId + callbackUrl + correlationId, because the Routine has no DB/auth/app-route access (`routine-loop-scope-audit.md:29`).

**(b) The output-ingestion wire — recommend (a).** Token-guarded callback `POST [id]/audit-ingest` (bearer = `CRON_SECRET`-style), validates token + correlationId, writes `claude_code_audit_input` (same column as the manual PATCH, `[id]/route.ts:134`), emits `operations/audit.ingested`. Beats (b) GitHub-API-file-read (no GitHub client exists) and (c) poll-a-store (coupling/polling). Treat findings as untrusted stored text.

**(c) The chain.** `research → fire-audit → step.waitForEvent('operations/audit.ingested', match data.projectId, timeout 15m) → fusion → land-pending`. `waitForEvent` is SDK-supported (`InngestStepTools.d.ts:226`); durable suspend, no billed compute while waiting. On timeout → proceed degraded to `'(none provided)'` (flag the decision).

**(d) Gates + cost.** Gates hold — claude/-only push, no Azure, platform-keyed; app-fire grants no new access; the Routine writes only via the scoped callback. Cost is a **separate meter** (Alex's Claude account, ~15/day) — `requirePipeBudget` does NOT cover it → build `requireRoutineBudget` before auto-firing.

**(e) Mine vs sellable.** Routines = Alex's loop (his account/quota). Multi-tenant = per-customer accounts or the sandboxed Agent-SDK. Don't sell on shared-quota Routines.

**(f) Build sequence (every external call / gate / cost flagged).**
0. **PREREQ — fix Inngest prod wiring (config, SMALL).** Set `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` in Vercel + sync the app to Inngest Cloud (per the last VERIFY). ⚠ nothing fires until this is done.
1. **Routine-fire budget cap — `requireRoutineBudget` (SMALL, MIGRATION).** Mirror `pipeBudget.ts` + a counter table (Alex `psql`). ⚠ separate paid meter — the gate before any `/fire`.
2. **The fire lib — `fireAuditRoutine()` (SMALL→MED, EXTERNAL CALL + TOKEN).** Server-side `/fire` to the Routines API with the bearer (Vercel env). ⚠ new external call; token server-side only.
3. **The callback endpoint — `POST [id]/audit-ingest` (MED, NEW AUTH SURFACE).** Bearer-gate (`CRON_SECRET` pattern) + correlationId, write `claude_code_audit_input`, emit `operations/audit.ingested`. ⚠ new auth surface; untrusted body; project-scoped.
4. **Phase 3A wiring (MED).** Add `fire-audit` step to `operations-pipe-run` after research (fire + store via the callback); user still triggers fusion. Proves fire+wire in isolation.
5. **Phase 3B chain (MED).** Insert `step.waitForEvent` between audit and fusion so one "run pipe" runs research→audit→fusion end to end; timeout → degrade. ⚠ the durable-wait + timeout-policy decision.

**Quick-wire vs real-build:** steps 1 and 5 reuse existing patterns (the `pipeBudget` counter, `waitForEvent`). Steps **2–4 are the genuine Phase-3 build** — the first time the app calls an *external* automation API and exposes an *inbound* token-gated write surface. Nothing should auto-fire until the Inngest wiring (step 0) and the Routine cap (step 1) are in place.

### Citation index
- Fire/token: `auto-categorize/route.ts:8-24` (`CRON_SECRET` bearer pattern); `client.ts:30-31` (env-read keys); no external-fire client (grep).
- Audit prompt/context: `buildAuditPrompt.ts:1-17,21-27` (copy-into-CC text + `{projectTitle, goalItems, deepResearchInput}`); Routine ≠ app routes `routine-loop-scope-audit.md:29`.
- Wire target: `[id]/route.ts:134` (`claude_code_audit_input` PATCH write); no GitHub API client (grep → only `auth/[...nextauth]`).
- Chain: `InngestStepTools.d.ts:226` (`waitForEvent`); `operations-pipe-run.ts` (current steps); empty-audit graceful `generateProjectTasks.ts:170-172`.
- Cost/gates: `pipeBudget.ts:60` (pipe cap, separate meter); `routine-loop-scope-audit.md:35,40-42,46-47,51-52`.
- Prereq: `.env.example:96,102-103` (Inngest keys required in prod); `client.ts:30-31`.

*Do not build — audit only.*
