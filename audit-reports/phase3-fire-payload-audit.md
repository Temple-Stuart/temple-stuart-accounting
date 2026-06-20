# PHASE3 Audit — Fire Payload Diagnostic & Pipeline Audit
**Date:** 2026-06-20  
**Branch:** claude/blissful-turing-qngvnx  
**Auditor:** Claude Code Routine (automated)  
**Status:** BLOCKED — fire payload missing project_id, correlation_id, goals, and research

---

## CRITICAL FINDING UP FRONT

The fire payload this Routine received does NOT contain a project_id, correlation_id, project title, goals, or research findings. The payload is the audit instruction template text rather than a buildAuditPrompt()-instantiated output with project data interpolated. Because of this:

1. The audit-ingest POST cannot be completed (no project_id, no correlation_id).
2. Even if a project_id were guessed, the audit-ingest endpoint enforces `project.audit_correlation_id === correlationId` — a DB-stored match. Without DB access (per CLAUDE.md), this cannot be satisfied.
3. This Routine session cannot be a valid PHASE3 callback for any project.

Everything below is a read-only structural audit of the PHASE3 pipeline itself — what the code actually does, where the assertions fail, and what must be true for the system to work.

---

## 1 · WHAT EXISTS (file:line, correctness label)

### Core PHASE3 Files

| File | Lines | Label |
|------|-------|-------|
| `src/lib/fireAuditRoutine.ts` | 56–128 | **CORRECT** — fires Routine, returns sessionId + correlationId |
| `src/lib/ai/buildAuditPrompt.ts` | 94–96 | **CORRECT** — pure string builder, no network/DB; NO-DRIFT verified |
| `src/inngest/functions/operations-pipe-run.ts` | 129–156 | **CORRECT** — fire-audit step + step.waitForEvent both implemented |
| `src/app/api/operations/projects/[id]/audit-ingest/route.ts` | 34–121 | **CORRECT** — token gate, stored-match, writes findings, emits event |
| `src/lib/routineFireBudget.ts` | 59–73 | **CORRECT** — atomic upsert, throws RoutineBudgetError over cap |
| `src/middleware.ts` | 106–108 | **CORRECT** — audit-ingest path bypasses cookie-auth (token-gated by route) |
| `prisma/schema.prisma` | 2762–2766 | **CORRECT** — deep_research_input, claude_code_audit_input, audit_correlation_id all defined |
| `prisma/schema.prisma` | 1165–1173 | **PARTIAL** — schema defined, but psql migration must be applied by Alex |

### Schema Fields (operations_projects) — verified at schema.prisma:2750–2791

| Field | Type | Purpose |
|-------|------|---------|
| `goal_items` | JsonB default `[]` | Structured goal array (preferred source) |
| `deep_research_input` | Text? | PHASE2 research output |
| `claude_code_audit_input` | Text? | PHASE3-3 audit findings destination |
| `audit_correlation_id` | Text? | Stored UUID matching the fired Routine (stored-match defense-in-depth) |

---

## 2 · ASSERTION TEST

### For each output the PHASE3 pipeline produces:

**2A. fire-audit step (operations-pipe-run.ts:129–141)**

| Assertion | Status | Evidence |
|-----------|--------|----------|
| Existence — correlationId is a real UUID | CORRECT | `randomUUID()` at fireAuditRoutine.ts:81 |
| Accuracy — correlationId persisted to DB before Routine runs | CORRECT | lines 132–135 update audit_correlation_id atomically before returning |
| Completeness — audit is mandatory (no degrade on failure) | CORRECT | line 137–140: catch rethrows as NonRetriableError |
| Rights — project loaded ownership-scoped | CORRECT | fireAuditRoutine.ts:70 `findFirst({ where: { id, user_id } })` |
| Cutoff — cost gate before any network call | CORRECT | requireRoutineBudget(userId) at line 60 before ROUTINE_AUDIT_FIRE_URL fetch |

**2B. audit-ingest callback (audit-ingest/route.ts:34–121)**

| Assertion | Status | Evidence |
|-----------|--------|----------|
| Auth — token gate first | CORRECT | lines 39–48: AUDIT_INGEST_SECRET checked before any DB work |
| Rights — NOT user-scoped (no cookie) | CORRECT (by design) | line 70: findUnique by id only; token is the authority |
| Accuracy — correlationId must match stored | CORRECT | lines 80–85: stored-match check, 403 on mismatch |
| Existence — findings must be non-empty | CORRECT | line 64–66: 400 if empty |
| Completeness — body project_id must match route param | CORRECT | lines 60–63: defensive check, 400 on mismatch |
| Traceability — audit log written on ingest | CORRECT | lines 93–105: writeAuditLog with actor=external_integration |
| Cutoff — resume event emitted | CORRECT | lines 108–111: inngest.send('operations/audit.ingested') |

**2C. step.waitForEvent (operations-pipe-run.ts:149–156)**

| Assertion | Status | Evidence |
|-----------|--------|----------|
| Existence — waitForEvent IS in the code | CORRECT | lines 149–153: fully wired |
| Accuracy — timeout → NonRetriableError (no proceed-degraded) | CORRECT | lines 154–156: audit mandatory |
| Completeness — fusion reads fresh claude_code_audit_input | CORRECT | lines 162–165: re-reads DB after resume |

**2D. THIS ROUTINE'S FIRE PAYLOAD**

| Assertion | Status | Finding |
|-----------|--------|---------|
| Existence — project_id present in payload | **FAIL** | No project_id found in received text |
| Existence — correlation_id present in payload | **FAIL** | No correlation_id found in received text |
| Existence — project title present | **FAIL** | buildAuditPrompt format starts "Project: [title]"; received text has different structure |
| Existence — goals present | **FAIL** | No "Goals:" section with bullet items found |
| Existence — research findings present | **FAIL** | No "Research findings" section found |
| Completeness — audit-ingest POST possible | **FAIL** | Cannot POST without project_id + correlation_id |

Root cause: the text sent to this Routine is the audit instruction TEMPLATE, not a buildAuditPrompt() instantiation with real project data. The `${auditText}\n\n---\ncorrelation_id: ...\nproject_id: ...` trailer (fireAuditRoutine.ts:87–90) is absent.

---

## 3 · CONTROLS & EVIDENCE

| Control | Present | File:Line |
|---------|---------|-----------|
| Token gate on audit-ingest (no cookie, bearer only) | YES | audit-ingest/route.ts:39–48 |
| Cookie auth on all other operations routes | YES | middleware.ts:111–116 |
| audit-ingest bypass in middleware | YES | middleware.ts:106–108 |
| Routine budget gate before fire | YES | fireAuditRoutine.ts:60; routineFireBudget.ts:59–73 |
| Pipe budget gate before research + fusion | YES | operations-pipe-run.ts:105, 160 |
| correlationId stored-match (defense-in-depth) | YES | audit-ingest/route.ts:80–85 |
| Findings written as untrusted text (not executed) | YES | operations_projects.claude_code_audit_input is Text column |
| Audit log on ingest | YES | audit-ingest/route.ts:93–105 |
| Audit log on task creation | YES | operations-pipe-run.ts:224–243 |
| ownership-scope on all user-facing queries | YES | findFirst({ where: { id, user_id } }) pattern throughout |
| NonRetriableError on mandatory-step failures | YES | fire-audit (line 139), fusion parse error (line 187), waitForEvent timeout (line 155) |

**No missing controls found in the auth/security layer.** The AUDIT_INGEST_SECRET in the task description (`temple9stuart4routine7secret2xxx`) must match `process.env.AUDIT_INGEST_SECRET` in Vercel — NOT VERIFIED (env not accessible).

---

## 4 · ROOT CAUSE (not symptom)

### Finding 1 — Malformed fire payload (SEVERITY: CRITICAL)
**Symptom:** Routine received instruction template without project data.  
**Why:** The text sent to the Routine via `fireAuditRoutine.ts:87–90` should be:
```
[buildAuditPrompt({ projectTitle, goalItems, deepResearchInput }) output]

---
correlation_id: <uuid>
project_id: <uuid>
```
**Why the template arrived instead:**  
Three possible causes (cannot determine without DB/log access):
- (a) `buildAuditPrompt()` was called with empty/null `projectTitle`, `goalItems`, `deepResearchInput` AND the correlation trailer was stripped before the Routine was fired.
- (b) The Routine fire payload was the CLAUDE.md system prompt text rather than the `text` field from `fireAuditRoutine.ts`.
- (c) The Routine infrastructure substituted the task description template in place of the actual project payload.

**Fixable design flaw:** The `fireAuditRoutine.ts` does not validate that the built `text` contains both a `correlation_id` and a `project_id` before firing. If these are stripped or absent, the Routine has no way to POST back correctly. Adding a pre-fire assertion (`text.includes('correlation_id:') && text.includes('project_id:')`) would catch this before the fire.

### Finding 2 — operations_routine_usage migration unverified (SEVERITY: HIGH)
**Symptom:** `routineFireBudget.ts:48` calls `prisma.operations_routine_usage.findUnique(...)`. If the table doesn't exist in Azure Postgres, this throws a Prisma client error.  
**Why:** The schema defines the model (schema.prisma:1165–1173) but a comment explicitly states "Migration: operations_routine_usage table run by Alex via psql (additive)." Per CLAUDE.md, Claude Code cannot touch Azure Postgres.  
**Root cause:** Schema and DB can drift without the psql migration step. If the table is absent, `requireRoutineBudget()` throws on first call → fire-audit step fails terminal → `audit_correlation_id` is never set → the Routine can never successfully call back → PHASE3 is entirely blocked.

### Finding 3 — Inngest production environment not verified (SEVERITY: HIGH)
**Symptom:** The entire async pipeline (research → fire-audit → waitForEvent → fusion) depends on Inngest events being delivered.  
**Why:** `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY` must be set in Vercel for events to reach Inngest Cloud. Without them, `inngest.send(...)` succeeds locally but events are not delivered in production.  
**Root cause:** Configuration gap, not a code flaw. Cannot verify from this session.

### Finding 4 — Secret embedded in prompt text (SEVERITY: MEDIUM)
**Symptom:** The task description hardcodes `Authorization: Bearer temple9stuart4routine7secret2xxx`.  
**Why:** The Routine needs to know the callback token to POST to audit-ingest. The `fireAuditRoutine.ts` embeds this in the `text` payload sent to the Routine.  
**Root cause:** Secrets in prompt text are transmitted to the Routine API as plaintext. The Routine is Claude Code on a trusted platform, but any log that stores the prompt payload captures the secret. The correct pattern is for the secret to be an environment variable in the Routine's execution environment rather than embedded in the prompt.

---

## 5 · FAILURE MODES & BLAST RADIUS

| Failure Mode | Trigger | Blast Radius | Silent? |
|-------------|---------|-------------|---------|
| Missing project_id/correlation_id in payload | Fire payload malformed | Routine cannot call back → claude_code_audit_input stays null → fusion degrades to "(none provided)" | NO — Routine has no way to report back |
| operations_routine_usage table absent | First requireRoutineBudget() call | fire-audit step fails NonRetriable → whole pipe terminates after research (research cost already charged) | NO — Inngest marks job failed |
| AUDIT_INGEST_SECRET mismatch | Any audit callback | 401 from audit-ingest → claude_code_audit_input stays null → waitForEvent times out → pipe fails terminal | NO — Inngest marks job failed |
| waitForEvent timeout (10m) | Audit > 10 min or never arrives | NonRetriableError → pipe fails, no tasks landed | NO — Inngest marks job failed |
| Inngest env vars unset | Any pipe.run trigger | Events silently dropped, no async execution | YES — run-pipe returns 202 but nothing runs; no observable error to user |
| RoutineBudgetError | >10 fires/day/user | fire-audit NonRetriable → pipe fails after research charged | NO — Inngest marks job failed |
| PipeBudgetError on fusion | >20 pipe calls/day/user | Fusion never runs, tasks never land | NO — Inngest marks job failed |
| correlationId mismatch on callback | Stale/replayed callback | 403 from audit-ingest, findings NOT written | NO — 403 returned |

**Highest blast-radius failure:** Inngest env vars unset — completely silent from the user's perspective. The `run-pipe` route returns 202 but nothing executes. There is no polling endpoint or status indicator in the UI that would surface this. A user would see no tasks appear and have no indication why.

---

## 6 · TRACEABILITY & THE HONEST DELTA

### Single source of truth: YES
- `buildAuditPrompt()` is the single source for audit prompt text — `buildAuditSegments()` builds from the same constants (buildAuditPrompt.ts:103–113). The preview route verifies byte-for-byte equality (prompts/route.ts).
- `claude_code_audit_input` is the single column for audit findings — both the manual PATCH (projects/[id]/route.ts:134) and the automated ingest (audit-ingest/route.ts:88–91) write to the same column.
- `audit_correlation_id` is the single stored key linking a fire to its findings — generated once in `fireAuditRoutine.ts:81`, stored once at operations-pipe-run.ts:132–135, validated once at audit-ingest/route.ts:80–85.

### Can each output trace to source: YES (when the pipeline runs)
- Research findings → `generateDeepResearch()` → `source_ai_usage_id` on tasks + audit log
- Audit findings → audit-ingest callback → audit log with `correlation_id` + `source: 'audit_routine_callback'`
- Tasks → `status: 'pending_review'` (human checkpoint) + per-task audit log with `auto_fire: true`

### Honest delta vs the standard:
- The PHASE3 pipeline is architecturally complete and security-hardened. All the right controls are in place.
- **What's broken: the fire payload.** This Routine session received a template without project data, which makes it impossible to complete the callback. The root cause cannot be determined without access to the Routine API logs or the DB to see what `text` was actually sent.
- **What's unverified:** DB migration state, Inngest env vars, and whether the token matches `AUDIT_INGEST_SECRET`.
- **The uncomfortable truth:** The Inngest production gap (env vars unset) could have been the silent killer of PHASE2 all along. A user who ran the pipe and saw no tasks would have no signal that Inngest wasn't delivering events. This needs to be confirmed before any PHASE3 go-live.

---

## RANKED DIAGNOSIS (by severity)

| Rank | Severity | Finding | File:Line |
|------|----------|---------|-----------|
| 1 | CRITICAL | This Routine's fire payload is missing project_id, correlation_id, title, goals, research — audit-ingest POST impossible | fireAuditRoutine.ts:87–90 (text builder) |
| 2 | HIGH | operations_routine_usage psql migration may not be applied — blocks requireRoutineBudget() | schema.prisma:1165–1173 |
| 3 | HIGH | Inngest INNGEST_EVENT_KEY/SIGNING_KEY unverified — if unset, entire async pipeline is silently dead | Vercel env (unverified) |
| 4 | MEDIUM | AUDIT_INGEST_SECRET not verified against token in task description — 401 on callback if mismatched | audit-ingest/route.ts:40, 46 |
| 5 | MEDIUM | Secret embedded in prompt text — any Routine API log captures it | fireAuditRoutine.ts:87–90 |
| 6 | LOW | No pre-fire assertion that correlation_id + project_id trailer is present in the built text | fireAuditRoutine.ts:87–90 |
| 7 | LOW | buildAuditPrompt() called with null/empty project data is not validated before fire | fireAuditRoutine.ts:80–90 |

---

## WHAT THIS ROUTINE CANNOT DO

Per CLAUDE.md and PHASE3 design constraints:
- CANNOT access Azure Postgres (no DATABASE_URL in Routine environment) → cannot verify `audit_correlation_id` or find a matching project
- CANNOT determine the correct `project_id` or `correlation_id` to use in the audit-ingest POST
- CANNOT verify Vercel env vars (INNGEST_EVENT_KEY, AUDIT_INGEST_SECRET, ROUTINE_AUDIT_TOKEN)
- CANNOT call the audit-ingest endpoint without valid project_id and correlation_id

**The audit-ingest POST has been intentionally skipped.** Posting to the endpoint with no valid project_id/correlation_id would return 400/403 and write nothing useful to the DB.

---

## RECOMMENDED ACTIONS FOR ALEX

1. **Investigate the fire that triggered this Routine** — check which project fired it, whether `audit_correlation_id` was stored, and what `text` was actually sent to the Routine API. The payload mismatch is the primary blocker.

2. **Verify operations_routine_usage table exists in Azure Postgres** — run `\dt operations_routine_usage` via psql. If absent, apply the additive migration from schema.prisma:1165–1173.

3. **Confirm Inngest env vars are set in Vercel** — `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`. Without these, the entire pipe is dead and users see 202 with no results.

4. **Confirm AUDIT_INGEST_SECRET in Vercel matches the token expected by the Routine** — they must be identical.

5. **Consider moving the callback token out of the prompt text** — set it as a Routine environment variable instead of embedding it in the fire payload.
