# EXEC Routine — Blocked: Fire Payload Malformed
**Date:** 2026-06-20  
**Branch:** claude/modest-volta-lyiycm  
**Auditor:** Claude Code Routine (automated, unwatched)  
**Status:** BLOCKED — same root cause as prior audit-routine sessions on 2026-06-20

---

## CRITICAL FINDING

This EXEC ("Execute Task") Routine was fired with the **meta-instruction template**, not a
`fireExecutionRoutine.ts`-assembled payload. The received text is:

> "EXECUTE — build the single task described in the fire payload. The payload contains a task
> (what to build, why, and the correctness test) plus a project_id and correlation_id."

The POST-back URL contains `{project_id}` as a **literal unsubstituted placeholder**.
No `Task:`, no `What to do:`, no `correlation_id:`, no real `project_id` are present.

**Result:** Nothing can be built. The exec-ingest POST cannot be completed.
This is the third consecutive Routine session (audit×2, exec×1) to fail with this same cause.

---

## 1 · WHAT `fireExecutionRoutine.ts` SHOULD HAVE SENT

Per `src/lib/fireExecutionRoutine.ts:72–77`, the correct payload is:

```
Task: <task.title>

What to do:
<task.description>

Why + correctness (the test that proves it works):
<task.notes>

---
When reporting the result back, include this exact correlation block so it can be matched:
correlation_id: <randomUUID()>
project_id: <projectId>
```

**What arrived instead:** The generic Routine instructions with `{project_id}` unsubstituted.

---

## 2 · WHAT THIS ROUTINE CANNOT DO

| Constraint | Source |
|-----------|--------|
| Cannot build any task | No task title, description, or notes provided |
| Cannot POST to exec-ingest | No real `project_id` or `correlationId` |
| Cannot access Azure Postgres | Per CLAUDE.md — no DATABASE_URL in Routine env |
| Cannot guess or invent a task | CLAUDE.md: "never guess, never improvise around a rule" |

---

## 3 · ASSERTION TEST — EXEC Pipeline Inputs

| Assertion | Status | Evidence |
|-----------|--------|----------|
| Existence — `Task:` line present | **FAIL** | Not in received payload |
| Existence — `What to do:` section | **FAIL** | Not present |
| Existence — `Why + correctness:` section | **FAIL** | Not present |
| Existence — `correlation_id:` trailer | **FAIL** | Not present |
| Existence — `project_id:` trailer | **FAIL** | `{project_id}` is a literal template placeholder |
| Accuracy — payload came from `fireExecutionRoutine.ts` | **FAIL** | Wrong prompt format |
| Completeness — exec-ingest POST possible | **FAIL** | Cannot POST without real ids |

---

## 4 · ROOT CAUSE DIAGNOSIS

**Dalio step 1–2 (goal vs problem):**  
Goal — EXEC Routine receives a fully-assembled task payload from `fireExecutionRoutine.ts`,
builds the change on a `claude/` branch, opens a PR, and POSTs back to exec-ingest.  
Problem — EXEC Routine received a generic instruction template; no task data present.

**Dalio step 3 (root cause, not symptom):**

`fireExecutionRoutine.ts:80–89` POSTs the assembled `text` to the Routine /fire endpoint.
That path is only reached via EXEC-2 (`src/app/api/operations/projects/[id]/tasks/[taskId]/accept`
or the wired Inngest handler). The payload received here is the meta-instruction shell,
not a `fireExecutionRoutine.ts` output. Three possible causes:

1. The Routine was triggered manually/experimentally with the wrong prompt (same as audit×2).
2. The EXEC-2 wiring calls a different prompt path than `fireExecutionRoutine.ts`.
3. The Routine infrastructure substituted a default template in place of the actual `text` field.

**Prior occurrence context:**  
`audit-reports/ROUTINE-AUDIT-2026-06-20-SECOND-OCCURRENCE.md` and
`audit-reports/phase3-fire-payload-audit.md` document the identical failure for the audit
Routine. Three failures in one day strongly suggests a systemic infrastructure issue with how
the Routine /fire payload is being constructed or substituted.

---

## 5 · BLAST RADIUS

| Failure | Impact | Severity |
|---------|--------|----------|
| Task not built | PR never opened; task stays in `pending` state in UI | HIGH |
| exec-ingest POST not sent | `pr_url` + `exec_status` never written to task; Inngest `operations/exec.ingested` never emitted | HIGH |
| EXEC budget slot consumed | Per `src/lib/execFireBudget.ts` — a slot is consumed at fire; this bad fire counts against the daily cap | MEDIUM |
| Third consecutive blocked session today | Pattern suggests systemic problem; repeated bad fires drain budget and produce no output | HIGH |

---

## 6 · CONTROLS VERIFIED (code-level, file:line)

| Control | Status | File:Line |
|---------|--------|-----------|
| Token gate on exec-ingest | CORRECT | `exec-ingest/route.ts:40–48` |
| Stored-match: `exec_correlation_id` must match | CORRECT | `exec-ingest/route.ts:75–83` |
| `middleware.ts` `/exec-ingest` bypass | CORRECT | `middleware.ts` (per exec-ingest route comment) |
| `requireExecBudget` before fire | CORRECT | `fireExecutionRoutine.ts:51` |
| Ownership-scoped task load | CORRECT | `fireExecutionRoutine.ts:61–65` |
| EXEC_ROUTINE_TOKEN in env, never hardcoded | CORRECT | `fireExecutionRoutine.ts:55` |
| FAIL LOUD on non-2xx fire | CORRECT | `fireExecutionRoutine.ts:92–94` |
| FAIL LOUD on missing session pointer | CORRECT | `fireExecutionRoutine.ts:103–105` |

No security issues found in the EXEC infrastructure code. **The problem is in the trigger, not the code.**

---

## RANKED FINDINGS BY SEVERITY

| Rank | Severity | Finding |
|------|----------|---------|
| 1 | CRITICAL | EXEC Routine received meta-template, not a `fireExecutionRoutine.ts` payload — task unexecutable |
| 2 | HIGH | Third Routine session today (audit×2, exec×1) with the same root cause — systemic |
| 3 | MEDIUM | Daily exec budget slot wasted on each bad fire |
| 4 | LOW | No pre-fire assertion in `fireExecutionRoutine.ts` that `correlation_id:` and `project_id:` trailer exist |

---

## RECOMMENDED ACTIONS FOR ALEX

1. **Investigate what fired this Routine** — check the Routine API logs for today's session
   to see what `text` was actually POSTed to the /fire endpoint. The meta-template arriving
   here means the fire bypassed `fireExecutionRoutine.ts`.

2. **Check EXEC-2 wiring** — `src/app/api/operations/projects/[id]/tasks/[taskId]/route.ts`
   (or the accept handler) to confirm it calls `fireExecutionRoutine()` with real task data,
   not a fallback prompt.

3. **Add a pre-fire assertion** to `fireExecutionRoutine.ts:77–79`:
   ```ts
   if (!text.includes('correlation_id:') || !text.includes('project_id:')) {
     throw new Error('exec payload missing correlation trailer — refusing to fire');
   }
   ```
   This catches the bad-payload case before the budget slot is consumed.

4. **Do not manually re-fire** until the root cause is confirmed — each bad fire wastes a
   budget slot and produces no usable output.
