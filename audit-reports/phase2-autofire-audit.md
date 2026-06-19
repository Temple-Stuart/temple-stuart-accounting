# AUDIT — Phase 2: auto-fire research → fusion in sequence, tasks land pending-review (READ-ONLY)

**Branch:** `claude/audit-phase2-autofire` · **Date:** 2026-06-19 · **Mandate:** Truth-First, read-only, NO build, cite `file:line`. Scope: a user-triggered "run pipe" that fires RESEARCH → waits → FUSION → lands tasks PENDING-REVIEW, cost-capped, CC-audit still manual (Phase 3).

---

## VERDICT (one paragraph)

The orchestration substrate is **all here**: Inngest runs in production with an **event-triggered pattern to mirror** (`health-check.ts`) and a **durable-step + Prisma pattern** (`routine-evaluator.ts`); the engine libs (`generateDeepResearch`, `generateProjectTasks`) **take `userId`/`userEmail` and can be called directly** (no HTTP route needed); `requirePipeBudget` (just shipped) **drops straight into each paid step**; and fusion **already degrades cleanly** with an empty audit (`'(none provided)'`). **The one real gap is "pending-review":** there is **no pending state today** — generated-but-unaccepted tasks live only in **client React state**, and `bulk-create` inserts straight to `status=open`. So Phase 2 needs **(a) a small migration** (a `pending_review` task status — Alex via `psql`), **(b) a user-triggered auth'd trigger route** that `inngest.send`s, and **(c) one new Inngest pipe function**. MED, one migration, every paid call still capped.

---

## 1 · THE TRIGGER — new, user-initiated

- **No auto-trigger exists today.** Research and fusion are **two separate manual buttons**: `ProjectRow.tsx:255` `handleRunResearch` (`onRunResearch`) and `:282` `handleGenerateTasks` (`onGenerateTasks`). Grep for `run.pipe|autoFire|runAll|queue`-as-action across the projects components + routes → **nothing** (the only "queue" hits are the PD-2 ProjectQueueCard *display* name, `ProjectRow.tsx:50`, `types.ts:46` — not an action).
- **Phase 2 adds a NEW user action** — a "run pipe" button on the project → `POST` a new trigger route → that route `inngest.send`s the pipe event. **User-initiated, NOT auto-on-create** (matches the chosen design: the user enters wants, then *chooses* to run the pipe).

## 2 · THE ORCHESTRATION (Inngest) — patterns to mirror

- **Event-trigger pattern** — `health-check.ts:20-23`: `inngest.createFunction({ triggers: [{ event: 'inngest/health.check' }] }, async ({ event, step }) => …)`, fired by `inngest.send()`. **This is the shape for the pipe function** (`triggers: [{ event: 'operations/pipe.run' }]`).
- **Durable-step + Prisma pattern** — `routine-evaluator.ts:29-55`: `inngest.createFunction({ id, name, … }, async ({ step }) => { await step.run('load-…', async () => prisma.…) })`. Each `step.run` is durably checkpointed + retried independently.
- **The chain** (one new function, sequential durable steps):
  1. `step.run('research')` → `requirePipeBudget(userId)` → `generateDeepResearch({ userId, userEmail, projectId, projectTitle, goalItems, … })` → write `deep_research_input` (the **route does this write today** at `research/route.ts:96-98`; the job does the same `prisma.operations_projects.update`).
  2. `step.run('fusion')` → `requirePipeBudget(userId)` → `generateProjectTasks({ … deepResearchInput: <fresh>, claudeCodeAuditInput: project.claude_code_audit_input })` → returns the task array + `usageId`.
  3. `step.run('land-pending')` → insert the tasks as **`pending_review`** rows with `source_ai_usage_id` (mirrors `bulk-create.ts:198-219`, but status = pending, no client accept).
- **Direct lib call vs route — call the libs DIRECTLY (recommended).** The HTTP routes are **cookie-auth bound** (`getVerifiedEmail` reads the request cookie, `research/route.ts:51`) — an Inngest job has **no cookie**, so it cannot (and should not) call its own routes. The libs (`generateDeepResearch:149`, `generateProjectTasks:201`) take **explicit `userId`/`userEmail`** (`GenerateInput`, `generateDeepResearch.ts:31-33`) and call `recordUsage` internally — they're the clean seam. The job passes the user context from the **event payload** (set by the auth'd trigger route, §6).

## 3 · THE COST GUARD IN AN AUTO CONTEXT

- **`requirePipeBudget(userId)` applies unchanged.** It's a pure server function (`pipeBudget.ts:60`) — no request/cookie dependency — so the job calls `await requirePipeBudget(userId)` **inside each paid step, before the lib call**, exactly as the routes do (e.g. `research/route.ts` guard before `generateDeepResearch`). **Auto-firing is capped identically to manual.**
- **2 paid calls per auto-run** (research + fusion) → **2 increments** against the per-user daily cap (=20, `pipeBudget.ts:15`). ~10 auto-runs/user/day before the cap trips.
- **⚠ FLAG — terminal vs retry:** over cap, `requirePipeBudget` **throws `PipeBudgetError`** (`pipeBudget.ts:67`). In a route that's a clean 429; **in an Inngest step a thrown error RETRIES by default** — which would re-increment and spin. The pipe function must treat `PipeBudgetError` as **terminal/non-retriable** (Inngest `NonRetriableError`) and mark the pipe-run "budget exceeded" — **fail-loud, not a silent swallow** (per CLAUDE.md). Flag for the build.

## 4 · TASKS LAND PENDING-REVIEW — needs a small migration

- **How tasks land today:** `generateProjectTasks` **returns** the array (saves nothing, `generateProjectTasks.ts:5-11`); the client holds it in **React state** (`TruthMachineTasksPreview` / `tasksPreview`); the user accepts in `AITaskPreview` → `POST bulk-create` → rows insert with **`status` defaulting to `open`** (`bulk-create.ts:215`, "status defaults to 'open' per Prisma schema default"). **The accept-gate is purely client-side staging** — nothing is persisted until accept.
- **There is NO "pending review" state.** `OperationsTaskStatus` = `open | in_progress | blocked | completed | cancelled | superseded | archived` (`schema.prisma`) — no `pending_review`. `ProjectStatus` has no `queued` either.
- **So the accept-gate does NOT suffice for auto-fire** — at fire-time there's no client to hold the preview, and persisting as `open` would silently drop auto-tasks into the live tracker (violates the chosen "pending-review checkpoint").
- **MIGRATION NEEDED (recommended, smallest):** add **`pending_review`** to `OperationsTaskStatus`. Auto-fire inserts tasks as `pending_review` (first-class, queryable rows, with `source_ai_usage_id` lineage + `status_history`); the user reviews and a flip to `open` accepts them (or `cancelled`/`archived` to reject). **Reuses** the existing status machinery + `operations_task_status_history`. *(Alternative: a JSONB staging column on the project — also a migration, but loses first-class queryability; the enum value is cleaner.)* Either way: **a migration, authored in `schema.prisma`, applied by Alex via `psql`** (enum `ALTER TYPE … ADD VALUE 'pending_review'`).
- **The review checkpoint:** the existing pipe/tasks UI lists tasks by status; a "pending review" group with accept/reject (status flip) is the human gate — same spirit as `AITaskPreview`, now over persisted rows.

## 5 · THE AUDIT-STAGE GAP — degrades cleanly (stays manual Phase 2)

- **Fusion runs fine with an empty audit — confirmed.** `generateProjectTasks` computes `auditText(input)` = `input.claudeCodeAuditInput?.trim() || '(none provided)'` (`generateProjectTasks.ts:170-172`); the fusion prompt embeds `'(none provided)'` when audit is empty (`buildTasksPrompt:178`). No `.map`-on-undefined, no throw.
- So **Phase 2 = research → (skip CC-audit) → fusion**, with `claude_code_audit_input` empty → `'(none provided)'`. **No break.** The CC-audit automation (writing `claude_code_audit_input` programmatically) remains the **Phase-3** piece (per `audit-reports/full-auto-pipe-audit.md` §2 — the output-ingestion wire).

## 6 · RISK / GATES

- **Auth in the Inngest job — at the SEND site, not the job.** `/api/inngest` is **signature-validated** (`INNGEST_SIGNING_KEY`, not cookie auth — `inngest/route.ts` serve handler; `.env.example:102-103`), so the job is not a public unauth path. **The auth gate is the NEW trigger route:** it must run `getVerifiedEmail` → resolve `user.id` → **ownership-scope the project** (`findFirst({ where:{ id, user_id }})`, the defensive-404 pattern) → only then `inngest.send({ name:'operations/pipe.run', data:{ userId, userEmail, projectId } })`. The job **trusts the signed payload** (the user was authed at send). ⚠ FLAG: the trigger route is the security gate — it must auth + ownership-scope before sending; the job must re-load the project by `{id, userId}` defensively too.
- **Migration:** **YES — one** (the `pending_review` enum value). No other schema change (the counter table from COST-GUARD-1 is already in). Authored in `schema.prisma`, applied by Alex via `psql` — Claude Code cannot apply it.
- **Showroom-safe:** the orchestration is **backend** (Inngest function + trigger route + a status value). The showroom renders `ProjectRowView` with demo data and never fires the pipe — **no showroom ripple**. A "run pipe" button added to the live `ProjectRow`/pipe view is not showroom-shared (the showroom uses `ProjectRowView` directly).

---

## Explicit answers

**(a) Trigger.** NEW, user-initiated "run pipe" action (no auto-trigger today; research/fusion are separate manual buttons `ProjectRow.tsx:255,282`). User chooses to run — not auto-on-create.

**(b) Inngest pattern.** Mirror `health-check.ts:20-23` (event trigger `operations/pipe.run`) + `routine-evaluator.ts:29-55` (durable `step.run` + Prisma). Chain: `step.run('research')` → write `deep_research_input` → `step.run('fusion')` → `step.run('land-pending')`. **Call the engine libs directly** (`generateDeepResearch:149`, `generateProjectTasks:201` — they take explicit `userId/userEmail`), NOT the cookie-bound routes.

**(c) Cost guard in auto.** `await requirePipeBudget(userId)` inside each paid step, before the lib call (`pipeBudget.ts:60`, no request dependency) → capped exactly like manual. **2 increments/run** (research + fusion) vs cap=20. ⚠ Treat the over-cap `PipeBudgetError` as **non-retriable terminal** in Inngest (don't let it retry-spin), surfaced fail-loud.

**(d) Pending-review.** The accept-gate does **NOT** suffice (it's client-state only; `bulk-create` lands `open`, `:215`). **A migration is needed** — recommend adding **`pending_review`** to `OperationsTaskStatus` (auto-tasks insert pending; user flips to `open` to accept). Alex applies the enum `ALTER` via `psql`.

**(e) Empty audit.** Fusion degrades gracefully — `auditText()` → `'(none provided)'` (`generateProjectTasks.ts:170-172`). Phase 2 skips the CC-audit; no break. CC-audit automation = Phase 3.

**(f) Auth + migration + showroom.** Auth gate is the **trigger route** (`getVerifiedEmail` + ownership-scope → `inngest.send`); `/api/inngest` is signature-validated (`.env.example:102-103`), not public-unauth; the job trusts the signed payload + re-scopes defensively. **One migration** (`pending_review` enum). **Showroom-safe** (backend orchestration; showroom renders `ProjectRowView` demo, never fires the pipe).

**(g) Recommended BUILD — Phase 2 (MED, one migration).** In order:
1. **Migration — `pending_review` task status (SMALL, MIGRATION).** `schema.prisma` enum + `prisma generate`; SQL `ALTER TYPE "OperationsTaskStatus" ADD VALUE 'pending_review'` for Alex's `psql`. ⚠ HARD-GATE/sign-off (migration). *(Enum `ADD VALUE` is additive + non-breaking.)*
2. **Trigger route — `POST [id]/run-pipe` (SMALL, AUTH).** `getVerifiedEmail` → ownership-scope the project → `inngest.send({ name:'operations/pipe.run', data:{ userId, userEmail, projectId } })` → 202. ⚠ this route is the auth gate.
3. **Inngest pipe function — `operations-pipe-run` (MED, 2 PAID CALLS).** `step.run('research')` [`requirePipeBudget` → `generateDeepResearch` → write `deep_research_input`] → `step.run('fusion')` [`requirePipeBudget` → `generateProjectTasks` (audit empty → `'(none provided)'`)] → `step.run('land-pending')` [insert tasks `pending_review` + `source_ai_usage_id`]. ⚠ every paid call capped; `PipeBudgetError` → non-retriable terminal; re-scope project by `{id, userId}`.
4. **UI — "run pipe" button + pending-review surface (SMALL→MED).** A user-triggered button (calls the trigger route) + a pending-review task group with accept (→`open`)/reject (→`cancelled`). Not showroom-shared.

**Quick-wire vs real-build:** steps 2–4 are bounded reuses (event-send, the engine libs, the status machinery). Step 1 is the **only migration** and the gate. Nothing fires uncapped — `requirePipeBudget` already guards both paid calls. The CC-audit stays manual; this is the safe, capped, human-checkpointed slice of full-auto.

### Citation index
- Trigger today: `ProjectRow.tsx:255` (research), `:282` (fusion); no auto trigger (grep).
- Inngest: `health-check.ts:20-23` (event pattern), `routine-evaluator.ts:29-55` (step.run+Prisma), `inngest/route.ts` (signature serve), `.env.example:102-103` (signing keys).
- Engine libs: `generateDeepResearch.ts:31-33,149,185` (userId/return), `generateProjectTasks.ts:201` (entry), `:170-172` (auditText `'(none provided)'`); research write `research/route.ts:96-98`.
- Cost guard: `pipeBudget.ts:15` (cap=20), `:60-68` (requirePipeBudget + throw).
- Tasks/landing: `bulk-create.ts:198-219` (insert), `:215` (status open default); enums `OperationsTaskStatus` / `ProjectStatus` (no pending_review/queued); model `operations_project_tasks` (`status`, `source_ai_usage_id`, `status_history`).

*Do not build — audit only.*
