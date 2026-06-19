# AUDIT — Full-auto pipe: orchestrating research → CC-audit → fusion → tasks from a user "enter wants" trigger (READ-ONLY)

**Branch:** `claude/audit-full-auto-pipe` · **Date:** 2026-06-19 · **Mandate:** Truth-First, read-only, NO build, cite `file:line`/doc. This is the highest-stakes build (an app-triggered autonomous Claude Code loop) — map exactly what exists, what's manual, and what the orchestration requires before any code.

---

## VERDICT (one paragraph)

**Two of the three stages are already app-controlled API calls** (research `POST [id]/research`, fusion `POST [id]/generate-tasks`) — auto-firing them is a **quick wire**. **The audit stage is the real Phase-3 build:** `claude_code_audit_input` is written ONLY by a manual paste today, and getting Claude Code to run the code-audit and feed its findings *back into that column* is a genuinely **unbuilt integration** (the "output-ingestion wire"). **A durable orchestrator already exists** (Inngest, in production) — so chaining the stages reuses infrastructure, not greenfield. **The hard blocker before ANY full-auto: there is NO cost ceiling** (`requireEvolveBudget` is unbuilt; research + fusion fire paid Anthropic/web_search calls with no cap) — this is a **HARD PREREQUISITE**, and a reusable pattern already exists (`travelSearchQuota.ts`). The gates (claude/-only push, no Azure) **hold** for app-fired CC. Routines (15/day) = **Alex's own loop only**; multi-tenant selling needs the sandboxed Agent-SDK.

---

## 1 · CURRENT STAGE WIRING

### Research — **app-controlled API ✓ (auto-fireable today)**
- Route: `src/app/api/operations/projects/[id]/research/route.ts` — `POST`. Auth-first (`getVerifiedEmail` + ownership `:51-63`), then `generateDeepResearch(...)` (`:85`, web_search + Anthropic), then **writes `deep_research_input`** (`:97`).
- Trigger: `ProjectRow.tsx:255` `handleRunResearch` → `fetch('…/research', {POST})` (`:259`) → wired to `onRunResearch` (`:431/497`), the TruthMachineView research button.
- **It is already an HTTP API the app fully controls** → an orchestrator can fire the same path (or call `generateDeepResearch` directly server-side). Paid (web_search), **no budget gate** (auth only).

### Audit — **MANUAL ONLY (the crux) ✗**
- **Nothing programmatic writes `claude_code_audit_input`.** Exhaustive grep of `src/app` shows only TWO writers, both manual:
  - create POST: `operations/projects/route.ts:263` (`trimNullable(body.…)`), inserted `:333`.
  - generic project PATCH: `operations/projects/[id]/route.ts:134` — `claude_code_audit_input` in the manual-passthrough field loop (`:134-138`); the comment is explicit: *"deep_research_input / claude_code_audit_input are **manual paste targets** (reality inputs)"* (`:132-133`). This is the path `ProjectRow.tsx:189` `handleSaveInputs` hits (`PATCH …/${id}` with `claude_code_audit_input: auditInput`, `:193-198`).
- The UI says it outright — `TruthMachineView.tsx:340`: *"Copy this prompt → run it in Claude Code (read-only) → paste the findings into the output below. **(Phase 3 automates this.)**"* and `:348` placeholder *"Paste Claude Code audit findings here… (Phase 3 will populate this automatically)"*, badge `"paste"` (`:339`).
- **There is NO auto path. Claude Code never runs programmatically today.** The audit prompt itself (`buildAuditPrompt.ts`) is pure copy-ready text designed for a human to paste into CC. — **THIS is the stage full-auto must solve.**

### Fusion — **app-controlled API ✓ (auto-fireable, but has a human-accept gate)**
- Route: `src/app/api/operations/projects/[id]/generate-tasks/route.ts` — `POST`. Auth-first, then `generateProjectTasks(...)` **reading both** `deepResearchInput: project.deep_research_input` + `claudeCodeAuditInput: project.claude_code_audit_input` (`:89-91`). **Returns** the task array — **does NOT save** (truth-first, `:5-11`).
- Trigger: `ProjectRow.tsx:282` `handleGenerateTasks` → `fetch('…/generate-tasks', {POST})` (`:287`).
- **Task landing is a SEPARATE, explicit acceptance gate:** `POST [id]/tasks/bulk-create` inserts rows only after the user accepts in `AITaskPreview` (bulk-create header `:1-24`: *"the explicit acceptance gate"*). Paid (Anthropic + web_search), **no budget gate** (auth only).

## 2 · THE AUDIT-STAGE AUTOMATION (the hard part)

For the CC audit to run **automatically**, the two options:

**(a) Claude Code Routine the app `/fires`** — *the Alex-loop path.* Requires: the loop encoded as the Routine's standing instructions (the institutional `buildAuditPrompt` text is **already** "run this in Claude Code, read-only, cite file:line" — `buildAuditPrompt.ts:1-17` — directly reusable); CC clones the repo **read-only** (it reads code to cite `file:line`) and runs the audit; the per-Routine `/fire` token stored server-side.

**(b) Agent SDK in a sandboxed runner** — *the multi-tenant path.* An ephemeral read-only repo clone per tenant. Heavier; the real product architecture.

**THE INTEGRATION UNKNOWN (flagged honestly):** *How does the Routine's output get back INTO `claude_code_audit_input`?* A Routine's native output is **a commit / a `claude/` branch / a file in the repo** — **the app does not read git branches.** So a wire is needed, none of which exists today:
- **Option i — callback webhook:** the Routine (per its CLAUDE.md instructions) `POST`s its findings to a new authenticated app endpoint (e.g. `POST [id]/audit-ingest`) guarded by a server-side token (the **`CRON_SECRET` pattern**, `.env.example:91`), which writes `claude_code_audit_input`. Cleanest, but **the endpoint + token + the Routine-side "post your findings here" instruction are all unbuilt.**
- **Option ii — file + GitHub API pull:** the Routine commits `audit-output/<projectId>.md` to a `claude/` branch; the app fetches it via the GitHub API and writes the column. Reuses the GitHub integration but couples the app to git plumbing.
- **Option iii — Agent SDK inline:** if (b), the runner returns findings in-process → write the column directly (no git round-trip). Only viable once the sandboxed runner exists.
- **Repo access for the audit: YES, required** — the audit reads code to cite `file:line`; the Routine/runner must clone the repo **read-only** (it never needs write to run the audit; write is only for the *implement* stage, which full-auto-to-tasks does NOT do — tasks land in the DB, not as code).

## 3 · THE ORCHESTRATOR

- **A durable job orchestrator ALREADY EXISTS — Inngest, in production.** `package.json` (`inngest ^4.2.6`); client `src/inngest/client.ts` (signing-key wired); serve handler `src/app/api/inngest/route.ts` (`maxDuration = 800` s, signature-auth, in middleware `PUBLIC_PATHS`); **7 registered functions** (`functions/index.ts`) — ingestion (ecfr/uscode/fedreg/irb), `embedPending`, `routineEvaluator`, `healthCheck`. **None touch the project pipe** — but the substrate (durable `step.run`, event-driven, retries, 13-min ceiling) is exactly what stage-chaining needs.
- **Today there is NO orchestrator for the pipe — it's manual button-clicks.** Sequencing (research done → run audit → audit done → generate tasks) is the **user clicking three buttons** in `TruthMachineView` (`onRunResearch` → copy/paste/save → `onGenerateTasks` → accept). No code chains them.
- **"Enter wants → full auto" would need:** a trigger (on project create, or a "run pipe" button) that **emits an Inngest event** → an Inngest function runs `step.run('research')` → `step.run('audit')` (the §2 wire) → `step.run('fusion')` → land tasks. **EXISTS:** the Inngest substrate + all three engine libs (`generateDeepResearch`, `buildAuditPrompt`, `generateProjectTasks`). **NEEDED:** the pipe Inngest function, the audit wire (§2), the cost guard (§4), and a decision on the human-accept gate (below).

## 4 · THE COST GUARD (mandatory before full-auto)

- **`requireEvolveBudget` / TM-4 is UNBUILT — confirmed.** Grep across `src` for `requireEvolveBudget|evolveBudget|EvolveBudget` → **zero hits anywhere.**
- **No budget/reserve gate on the AI pipe routes** — `research/route.ts` and `generate-tasks/route.ts` gate on **auth only** (grep `reserve|budget|requireTier|daily` → none). `recordUsage` **tracks** cost *after the fact* (`operations_ai_usage` + `audit_log`, `recordUsage.ts:151-201`) but **does not CAP** anything.
- **Full-auto fires paid calls with no ceiling:** per project = research (web_search **+** Anthropic) + fusion (Anthropic + web_search) + the Routine run. Chained and unwatched, that is a **runaway-cost risk**. — **HARD PREREQUISITE: build the cost ceiling BEFORE any auto-firing.**
- **Reusable pattern EXISTS:** `src/lib/travelSearchQuota.ts` — `reserveTravelSearch(provider)` is a **durable daily spend-cap kill-switch** that increments a DB counter and **fails LOUD** (`TravelSearchQuotaError`) when the cap is crossed (`:3-7,:93-105`), env-configurable per provider (`:63`), with a warn ratio. The AI pipe needs the same shape (per-user + global daily AI-spend cap, fail-loud) — **mirror it, don't reinvent.** Aligns with CLAUDE.md's "every paid external call gates first" + "fail-loud / no silent fallback."

## 5 · THE GATES (do they hold for APP-FIRED CC?)

- **YES — both hold, unchanged.** App-firing a Routine is **just a trigger**; it grants the Routine no new capability:
  - **claude/-only push** — the Routine still pushes to a `claude/` branch and **cannot self-merge** (merge = Alex's GitHub action = SOC 2 control). Confirmed established convention (100+ `claude/` branches; prior `routine-loop-scope-audit.md:23,51`).
  - **No Azure** — the repo commits **no `DATABASE_URL`** (`.env.example:9`, names-only) → a Routine cloning the repo **physically cannot reach Azure Postgres** (`routine-loop-scope-audit.md:35,65`). For full-auto-to-tasks the Routine doesn't even need the DB — it returns *audit findings* (text), and the **app** (already DB-authed) writes `claude_code_audit_input` + lands tasks.
- **The `/fire` token:** store **server-side** in Vercel env, gated like the existing `CRON_SECRET` (`.env.example:91`) / Inngest signing keys (`:102-103`) — invoked only from a server route, **never client-exposed**. No new secret reaches the browser. — **No new exposure.**
- **One honest caveat (carried from prior audit):** `main` **branch protection is NOT verifiable** from the available GitHub tools — the claude/-only default is the *primary* gate, but enabling branch protection (block direct push, require PR) is the belt-and-suspenders Alex should confirm in GitHub settings.

## 6 · MINE vs SELLABLE

- **Routines (~15 runs/day, the account's shared quota) = Alex's own loop — fine.** A solo founder iterating a few projects/day fits (`routine-loop-scope-audit.md:46`).
- **Multi-tenant ceiling (flagged):** the 15/day is **Alex's account's** quota. **Selling cannot share it** — each customer would need their own account/Routine **OR** the **sandboxed Agent-SDK** (ephemeral read-only runner per tenant). **Routines are the right tool for Alex's loop, NOT the product's multi-tenant path** (`routine-loop-scope-audit.md:47,69`). Build the SaaS on the Agent-SDK, not shared-quota Routines.

---

## Explicit answers

**(a) Current wiring.** Research = **app-controlled API** (`research/route.ts` POST, writes `deep_research_input:97`, fired by `ProjectRow.tsx:255-259`) → auto-fireable. Audit = **manual-only** (`claude_code_audit_input` written solely by create POST `route.ts:263/333` + manual PATCH `[id]/route.ts:134` via `handleSaveInputs ProjectRow.tsx:189-198`; UI `TruthMachineView.tsx:340` "Phase 3 automates this"). Fusion = **app-controlled API** (`generate-tasks/route.ts` reads research+audit `:89-91`, returns tasks; landing gated by `bulk-create` human-accept).

**(b) Audit-stage automation + the integration unknown.** A Routine (or Agent-SDK runner) runs `buildAuditPrompt`'s text on a **read-only repo clone**, citing `file:line`. **The unknown:** its native output is a commit/branch/file, and **the app doesn't read git** — so a wire is needed (none exists): a token-guarded **callback endpoint** (CRON_SECRET pattern) the Routine POSTs findings to, OR a **file the app pulls via the GitHub API**, OR **in-process return** from the Agent SDK. This wire is the genuinely-unbuilt hard part.

**(c) Orchestrator.** **Inngest EXISTS in production** (`client.ts`, `/api/inngest`, 7 functions) — durable substrate ready, but **no pipe function**; stages are chained by **manual button clicks** today. Full-auto needs a new Inngest pipe function (research→audit→fusion→land) + the §2 audit wire + §4 cost guard + a human-gate decision.

**(d) Cost guard.** **UNBUILT** (`requireEvolveBudget` → zero hits; no reserve/budget gate on the pipe routes; `recordUsage` tracks but doesn't cap). **HARD PREREQUISITE before full-auto.** Reuse `travelSearchQuota.ts:93-105` (durable daily cap, fail-loud).

**(e) Gates hold for app-fired CC.** YES — claude/-only push (no self-merge) + no `DATABASE_URL` (no Azure) are unchanged by app-firing; the `/fire` token lives server-side (CRON_SECRET pattern, `.env.example:91`); no new access/exposure. Caveat: confirm `main` branch protection (unverifiable here).

**(f) Mine vs sellable.** Routines/15-per-day = **Alex's loop only**; multi-tenant needs per-tenant accounts or the **sandboxed Agent-SDK** — do not build the SaaS on shared-quota Routines.

**(g) Recommended BUILD SEQUENCE (honest, phased).**
1. **Cost guard FIRST — MED, HARD PREREQUISITE.** Mirror `travelSearchQuota.ts` for AI: a durable per-user + global **daily AI-spend cap**, fail-loud, gating `research` + `generate-tasks` (and any auto-fire) **before the paid call**. ⚠ paid-call gate — the un-skippable blocker. *(Migration: a small counter table → schema.prisma + ALTER authored, Alex applies via psql.)*
2. **Auto-fire research + fusion in-app — SMALL→MED.** They're already API calls; an Inngest function can call `generateDeepResearch` / `generateProjectTasks` **directly** (server context), behind the §1 cost guard. ⚠ **Human-gate decision (flag):** fusion currently lands tasks only after the `AITaskPreview` accept gate (`bulk-create`); full-auto must either **auto-land** tasks or land them as **"pending review"**. Per CLAUDE.md (human sign-off on irreversible; tasks are revertible, not money/migration) → **recommend land-as-pending-review** to preserve the checkpoint. ⚠ external paid calls.
3. **CC-audit automation via Routine + the output-ingestion wire — LARGE (the real Phase-3 build).** The Routine runs the audit read-only; build the token-guarded **ingest endpoint** (CRON_SECRET pattern) that writes `claude_code_audit_input`; encode the "post findings here" instruction in CLAUDE.md. ⚠ new external trigger + new auth surface + the integration unknown — flag every gate; start on a **low-risk presentation-only project**.
4. **The orchestrator — MED.** A single Inngest pipe function chaining `step.run('research') → step.run('audit', the §3 wire) → step.run('fusion') → land`, event-triggered by "enter wants". Reuses Inngest; depends on 1–3.

**Quick-wire vs real-build, plainly:** stages 1, 2, 4 are **reuses** of existing infrastructure (Inngest + the engine libs + the quota pattern) — real but bounded. Stage **3 (app-fired CC + the output wire) is the genuine Phase-3 build** and carries the new-auth-surface + integration-unknown risk. **Nothing should auto-fire until the cost guard (step 1) ships.**

### Citation index
- Research: `research/route.ts:51-63,85,97`; trigger `ProjectRow.tsx:255-259,431/497`.
- Audit (manual-only): writers `operations/projects/route.ts:263,333` + `[id]/route.ts:132-138`; save path `ProjectRow.tsx:189-198`; UI `TruthMachineView.tsx:339-348`; prompt text `buildAuditPrompt.ts:1-17`.
- Fusion: `generate-tasks/route.ts:89-91`; accept gate `tasks/bulk-create/route.ts:1-24`; trigger `ProjectRow.tsx:282-287`.
- Orchestrator: `package.json` (inngest ^4.2.6); `inngest/client.ts`; `app/api/inngest/route.ts` (maxDuration 800); `inngest/functions/index.ts` (7 fns).
- Cost guard: `requireEvolveBudget` → none; pipe routes auth-only; tracker `recordUsage.ts:151-201`; reuse `travelSearchQuota.ts:3-7,63,93-105`.
- Gates/secrets: `.env.example:9` (no DATABASE_URL), `:91` (CRON_SECRET), `:102-103` (Inngest keys); prior `audit-reports/routine-loop-scope-audit.md:23,35,46,47,51,65,69`.

*Do not build — audit only.*
