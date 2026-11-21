# Execute-Task Routine — Blocked: Fire Payload Missing Task Data
**Date:** 2026-06-20  
**Branch:** claude/modest-volta-nbkoag  
**Auditor:** Claude Code Execute-Task Routine (automated)  
**Status:** BLOCKED — fire payload received as template without interpolated task data

---

## CRITICAL FINDING

The Execute-Task Routine session received the EXECUTE instruction template but NO actual
task data was interpolated into it. The following required fields are ABSENT from this
session's entire context:

| Required Field | Status | Where it should appear |
|---|---|---|
| `Task: [title]` | **MISSING** | Top of fire payload text |
| `What to do: [description]` | **MISSING** | Fire payload text |
| `Why + correctness: [notes]` | **MISSING** | Fire payload text |
| `correlation_id: [uuid]` | **MISSING** | Correlation trailer in payload |
| `project_id: [uuid]` | **MISSING** | Correlation trailer in payload |

The `{project_id}` in the POST-back URL is still a literal `{project_id}` placeholder —
not a real UUID. The "from payload" references in the POST body have nothing to reference.

**This Routine cannot build anything, open any PR, or POST back to exec-ingest.**
Doing so without a real `correlation_id` + `project_id` would return 403 from exec-ingest
(stored-match check at exec-ingest/route.ts:75–83) and write nothing useful to the DB.

---

## ROOT CAUSE

`fireExecutionRoutine.ts:72–77` builds the payload as:

```
Task: ${task.title}

What to do:
${task.description}

Why + correctness (the test that proves it works):
${task.notes}

---
When reporting the result back, include this exact correlation block so it can be matched:
correlation_id: ${correlationId}
project_id: ${projectId}
```

What this Routine received is the EXECUTE template wrapper (the Claude Code session
system prompt) WITHOUT the above `text` content embedded in it. The task title,
description, notes, and correlation trailer are all absent.

**Three possible causes (cannot determine without DB/log access per CLAUDE.md):**

1. `fireExecutionRoutine.ts` was called with an empty/null task (title/description/notes
   all blank), and the correlation trailer was stripped before the Routine was fired.

2. The Routine fire infrastructure substituted the task-description template in place of
   the actual `text` field from `fireExecutionRoutine.ts`.

3. The task exists in DB but has empty `title`, `description`, and `notes` columns — so
   `(no description provided)` / `(no notes provided)` fallbacks fired, and the correlation
   trailer IS present but not in this session's received text (infra strip).

**Cannot determine which without DB access** — Claude Code cannot touch Azure Postgres
(CLAUDE.md constraint).

---

## WHAT WAS VERIFIED (read-only codebase audit)

| File | Line | Verified State |
|---|---|---|
| `src/lib/fireExecutionRoutine.ts` | 72–77 | Payload builder is correct — `task.title`, `description`, `notes`, `correlationId`, `projectId` all referenced |
| `src/lib/fireExecutionRoutine.ts` | 61–66 | Task loaded ownership-scoped (`{ id, project_id, user_id }`) — correct |
| `src/lib/fireExecutionRoutine.ts` | 56–58 | Fails loud if `EXEC_ROUTINE_FIRE_URL` / `EXEC_ROUTINE_TOKEN` unset — correct |
| `src/app/api/operations/projects/[id]/exec-ingest/route.ts` | 41–48 | Token gate first, `EXEC_INGEST_SECRET` checked before any DB work — correct |
| `src/app/api/operations/projects/[id]/exec-ingest/route.ts` | 75–83 | Stored-match check: `exec_correlation_id` must match posted `correlationId` — correct |
| `src/lib/execFireBudget.ts` | (exists) | Budget gate present |

**No code defect found in the fire payload builder.** The defect is in how the payload
was delivered to this Routine session.

---

## DESIGN GAP IDENTIFIED

`fireExecutionRoutine.ts` does NOT validate that the built `text` contains the correlation
trailer before firing. A pre-fire assertion would catch payload truncation:

```typescript
if (!text.includes('correlation_id:') || !text.includes('project_id:')) {
  throw new Error('EXEC payload missing correlation trailer — aborting fire to prevent unrecoverable Routine run');
}
```

This would convert a silent "Routine runs but cannot call back" failure into a loud,
retriable fire-step failure visible in Inngest logs.

---

## WHAT THIS ROUTINE CANNOT DO

Per CLAUDE.md and EXEC-1/EXEC-2 design:
- CANNOT access Azure Postgres — no `DATABASE_URL` in Routine environment
- CANNOT determine the correct `project_id` or `correlation_id`
- CANNOT POST to exec-ingest without valid `project_id` + `correlation_id`
- CANNOT open a PR for an unknown task

**The exec-ingest POST has been intentionally skipped** — a guess would fail the
stored-match (403) and write nothing.

---

## RECOMMENDED ACTIONS FOR ALEX

1. **Check which task triggered this Routine fire** — look for a task with
   `exec_status = 'fire_fired'` and a recently-set `exec_correlation_id` in the DB.
   Verify `title`, `description`, and `notes` are non-null on that task.

2. **Check Routine fire logs** — confirm what `text` was actually POSTed to
   `EXEC_ROUTINE_FIRE_URL`. If the text was blank, the task has empty columns in DB.

3. **Add pre-fire assertion to `fireExecutionRoutine.ts`** (see Design Gap above) to
   catch this failure mode before the Routine fires rather than after.

4. **Re-accept the task** to re-fire the Routine once the root cause is diagnosed.
   The current `exec_correlation_id` is stale (this session cannot call back with it).
   A new accept will generate a new `correlationId` via `fireExecutionRoutine.ts:71`.

---

## CONCLUSION

The EXEC-1/EXEC-2 machinery is structurally sound. This Routine session was fired but
received no actionable task data. No build was attempted, no PR was opened, no exec-ingest
POST was made. This audit file is the paper trail of the blocked run.
