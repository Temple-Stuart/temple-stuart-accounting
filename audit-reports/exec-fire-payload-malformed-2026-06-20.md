# EXEC ROUTINE AUDIT — Malformed Fire Payload (EXEC-1)
**Date:** 2026-06-20  
**Branch:** `claude/modest-volta-z8i7aq`  
**Auditor:** Claude Code Routine (automated, unwatched)  
**Status:** BLOCKED — no actual task payload received; cannot build or POST back

---

## CRITICAL FINDING — EXEC ROUTINE RECEIVED TEMPLATE TEXT, NOT A REAL PAYLOAD

This is the **third occurrence** of the malformed Routine payload problem on this repo:

| Occurrence | Routine | Branch | Issue/Audit |
|------------|---------|--------|-------------|
| 1st | Audit (PHASE3) | `claude/blissful-turing-qngvnx` | Issue #1066 |
| 2nd | Audit (PHASE3) | `claude/blissful-turing-nwn7pc` | `audit-reports/ROUTINE-AUDIT-2026-06-20-SECOND-OCCURRENCE.md` |
| **3rd (this session)** | **Execute-Task (EXEC-1)** | `claude/modest-volta-z8i7aq` | **This document** |

**What I received** (the EXECUTE instruction message):
- Generic meta-instructions for the Execute-Task Routine methodology
- `{project_id}` as a **literal unsubstituted template placeholder** — curly braces included
- `{correlation_id}` / `"<from payload>"` — literal placeholder, not a real UUID
- No `task.title`, no `task.description`, no `task.notes`
- Auth token `temple7exec3routine9secret2build5pr8xkqz` visible in the payload (**SECURITY — see §3**)

**What `fireExecutionRoutine.ts:72–77` should have sent:**
```
Task: <task.title>

What to do:
<task.description>

Why + correctness (the test that proves it works):
<task.notes>

---
When reporting the result back, include this exact correlation block so it can be matched:
correlation_id: <randomUUID()>
project_id: <project.id>
```

---

## 1 · WHAT EXISTS (file:line, correctness label)

| File | Line | Label | Note |
|------|------|-------|------|
| `src/lib/fireExecutionRoutine.ts` | 56–115 | **CORRECT** | Fire mechanism correctly coded — cost gate → ownership-scoped task load → text assembly → POST → fail loud |
| `src/lib/fireExecutionRoutine.ts` | 72–77 | **CORRECT** | Payload text builder — `task.title` + `task.description` + `task.notes` + `correlation_id`/`project_id` trailer |
| `src/lib/execFireBudget.ts` | 57–71 | **CORRECT** | Atomic upsert, `ExecBudgetError` on cap — no silent fallback |
| `src/lib/execFireBudget.ts` | 16 | **CORRECT** | Default cap = 5/day (conservative for the heaviest, most consequential fire type) |
| `src/app/api/operations/projects/[id]/exec-ingest/route.ts` | 41–48 | **CORRECT** | Token gate FIRST before DB work — the entire auth boundary |
| `src/app/api/operations/projects/[id]/exec-ingest/route.ts` | 75–83 | **CORRECT** | Stored-match on `exec_correlation_id` within the project — binds result to the exact fire |
| `src/app/api/operations/projects/[id]/exec-ingest/route.ts` | 86–89 | **CORRECT** | Writes `pr_url` + `exec_status` onto the task (never fabricates a PR) |
| `src/app/api/operations/projects/[id]/exec-ingest/route.ts` | 105–109 | **CORRECT** | Emits `operations/exec.ingested` for future EXEC-3 serial queue |
| `src/middleware.ts` | 115–116 | **CORRECT** | `/exec-ingest` bypass for dynamic path — lets token-gated callback through without cookie |
| `prisma/schema.prisma` | 2836–2841 | **CORRECT** | `exec_correlation_id`, `pr_url`, `exec_status` fields defined on `operations_project_tasks` |
| `prisma/schema.prisma` | 1180–? | **CORRECT** | `operations_exec_usage` model defined for budget tracking |
| **The EXEC FIRE PAYLOAD itself** | — | **BROKEN** | This session received generic meta-prompt, not `fireExecutionRoutine.ts` output |

---

## 2 · ASSERTION TEST — EXEC-1 Pipeline Inputs

| Assertion | Status | Evidence |
|-----------|--------|----------|
| **Existence** — `project_id` present in payload | **FAIL** | `{project_id}` is a literal placeholder, never substituted |
| **Existence** — `correlation_id` present | **FAIL** | `"<from payload>"` — template text, not a UUID |
| **Existence** — `task.title` in payload | **FAIL** | Not present |
| **Completeness** — `task.description` in payload | **FAIL** | Not present |
| **Completeness** — `task.notes` (why + correctness test) in payload | **FAIL** | Not present |
| **Accuracy** — `fireExecutionRoutine.ts` text builder was used | **FAIL** | Different prompt text path was used |
| **Rights** — exec-ingest POST would pass stored-match | **FAIL** | No real `correlation_id` to match against `task.exec_correlation_id` |
| **Auth gate** — EXEC_INGEST_SECRET in POST instructions | PRESENT (SECURITY CONCERN) | `temple7exec3routine9secret2build5pr8xkqz` visible in payload — see §3 |
| **Cost gate** — `requireExecBudget` checked before fire | CANNOT VERIFY | Budget gate is in server code that runs before this session starts — if the fire came through `fireExecutionRoutine.ts`, one slot is consumed |

---

## 3 · SECURITY FINDING — EXEC_INGEST_SECRET IN PAYLOAD

The instructions I received contain this token verbatim:

```
temple7exec3routine9secret2build5pr8xkqz
```

This token is the `EXEC_INGEST_SECRET` — the **entire auth boundary** for the exec-ingest endpoint
(`exec-ingest/route.ts:41–48`). If this is the real production value, it is now in this session's
transcript (accessible via any Anthropic session log, any intermediate Routine API log, or anyone
with transcript access).

**REQUIRED ACTION:** Rotate `EXEC_INGEST_SECRET` in Vercel environment variables immediately if
this is the production secret. The same concern applies to `temple9stuart4routine7secret2xyz`
(the `AUDIT_INGEST_SECRET` visible in the second malformed audit Routine session — flagged in
`audit-reports/ROUTINE-AUDIT-2026-06-20-SECOND-OCCURRENCE.md:88`).

**Root cause:** The token is being delivered in the Routine's prompt text rather than via a
Routine environment variable. The correct pattern is:
- Prompt text = task data only (no secrets)
- Secrets = Routine environment variables (never enter transcript)

---

## 4 · ROOT CAUSE DIAGNOSIS (same as prior occurrences)

**Why is the payload generic instead of task-specific?**

`fireExecutionRoutine.ts:72–77` correctly assembles the payload from the DB-loaded task. This
code path is only reachable when `fireExecutionRoutine()` is called by an Inngest job (EXEC-2)
that itself requires `INNGEST_EVENT_KEY`/`INNGEST_SIGNING_KEY` to be configured.

**What actually triggered this Routine:**  
The payload does not match `fireExecutionRoutine.ts` output. It contains unsubstituted template
placeholders (`{project_id}`). This is inconsistent with the code path and points to a manual
or test Routine fire using a template instead of the real fire function.

**Most probable cause:**
1. `fireExecutionRoutine.ts` was never invoked — the fire came from a different trigger (manual
   test, Routines dashboard direct fire, or a test script that has the prompt template but not
   the data substitution)
2. The Inngest EXEC-2 pipeline that calls `fireExecutionRoutine()` has not yet been wired
   (confirmed by `fireExecutionRoutine.ts:27`: "NOT yet wired to accept")

---

## 5 · FAILURE MODES & BLAST RADIUS

| Failure Mode | Blast Radius | Severity |
|-------------|--------------|----------|
| `EXEC_INGEST_SECRET` in prompt payload | Anyone with transcript/log access can POST arbitrary `pr_url`/`exec_status` to any project task (until stored-match blocks it on `exec_correlation_id`) | **CRITICAL** — if this is the real production secret |
| No actual task built / no PR opened | The user's task remains unexecuted; the Inngest `waitForEvent('await-exec')` will timeout | **HIGH** — the intended work was not done |
| Budget slot consumed per bad fire | 1 of 5 daily exec slots wasted per bad fire | **MEDIUM** |
| Accumulated "BLOCKED" audit docs | SOC 2 paper trail noise (3rd occurrence now) | **LOW** |

---

## 6 · ACTIONS REQUIRED (for Alex)

1. **[CRITICAL] Rotate `EXEC_INGEST_SECRET`** if `temple7exec3routine9secret2build5pr8xkqz` is the production value — it is in this transcript.
2. **[CRITICAL] Rotate `AUDIT_INGEST_SECRET`** if not already done — `temple9stuart4routine7secret2xyz` was exposed in the prior session (flagged in `SECOND-OCCURRENCE.md:88`).
3. **[HIGH] Do NOT fire this Routine with a generic template** — the `{project_id}` placeholder is never substituted outside of `fireExecutionRoutine.ts`; manually-triggered fires will always receive template text.
4. **[MEDIUM] Wire EXEC-2** — `fireExecutionRoutine.ts:27` confirms the function is not yet called from the accept flow. Until EXEC-2 lands and Inngest is configured in production, no Routine fire can receive real task data.
5. **[MEDIUM] Move secrets to Routine env vars** — the ingest token should arrive in the session as an environment variable, not embedded in the prompt text. Prompt text must be treated as a transcript that external parties can read.
6. **[LOW] Consider a payload validation guard** — before any Routine session executes, detect `{project_id}` as a literal string and fail loud immediately rather than attempting to build on a non-existent task.

---

## HONEST DELTA

| Layer | State |
|-------|-------|
| `fireExecutionRoutine.ts` (the fire code) | **Correctly implemented and merged** |
| `exec-ingest/route.ts` (the callback) | **Correctly implemented and merged** |
| `execFireBudget.ts` (the cost gate) | **Correctly implemented and merged** |
| `prisma/schema.prisma` fields | **Correctly defined** (migration applied by Alex) |
| EXEC-2 wire (calls `fireExecutionRoutine` on accept) | **NOT YET WIRED** — `fireExecutionRoutine.ts:27` |
| Inngest prod config (`INNGEST_EVENT_KEY`/`SIGNING_KEY`) | **UNKNOWN** — cannot verify from this session |
| Fire payload actually received by this session | **MALFORMED** — template text, no project data |

The execution infrastructure is correctly built. The payload problem is in the trigger mechanism,
not the code. Every fire with a template-text payload wastes one daily budget slot, exposes the
ingest secret in transcript, and produces no usable output.
