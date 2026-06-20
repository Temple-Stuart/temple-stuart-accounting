# Audit: EXEC Routine fired with malformed payload

**Date:** 2026-06-20  
**Branch:** `claude/modest-volta-24mam9`  
**Session:** `cse_01YHSsApoANAZx1qEDboG3Cr`  
**Severity:** HIGH — exec Routine cannot proceed; Inngest `await-exec` step will timeout

---

## What happened

The Execute-Task Routine received the Routine instruction **template text** as its user message
instead of a `fireExecutionRoutine()`-instantiated payload containing real task data.

The received user message was literally:

> "EXECUTE — build the single task described in the fire payload. The payload contains a task
> (what to build, why, and the correctness test) plus a project_id and correlation_id."

Missing entirely:

| Field | Required by | Impact if absent |
|-------|------------|-----------------|
| `project_id` | exec-ingest callback URL (`/api/operations/projects/{project_id}/exec-ingest`) | Cannot POST result back |
| `correlation_id` | `exec-ingest` stored-match (`exec_correlation_id` on task) | 403 even if project_id guessed |
| Task title | The WHAT to build | No code to write |
| Task description | The HOW | No code to write |
| Task notes (why + test) | Correctness criterion | No way to verify correctness |

The Routine halted immediately per CLAUDE.md fail-loud mandate — **no code was written, no
branch modified, no PR opened.**

---

## Precedent

Issue #1066 documents an identical failure on the **audit** Routine
(branch `claude/blissful-turing-qngvnx`). The exec Routine is now exhibiting the same
pathology, suggesting a shared infrastructure defect in payload delivery — not a
Routine-specific bug.

---

## Root cause candidates

### `fireExecutionRoutine.ts:72–77` — the `text` build is correct

```ts
const text =
  `Task: ${task.title}\n\n` +
  `What to do:\n${task.description?.trim() || '(no description provided)'}\n\n` +
  `Why + correctness (the test that proves it works):\n${task.notes?.trim() || '(no notes provided)'}\n\n` +
  `---\nWhen reporting the result back, include this exact correlation block so it can be matched:\n` +
  `correlation_id: ${correlationId}\nproject_id: ${projectId}`;
```

The string builder is correct. The defect is downstream.

### Candidate 1 — `text` field never delivered as user message (highest probability)

`fireExecutionRoutine.ts:88` sends `JSON.stringify({ text })` to `EXEC_ROUTINE_FIRE_URL`.
If the Routine infrastructure maps the `--append-system-prompt` template as the user
message instead of the `text` field from the fire body, the session receives the
instruction template rather than the task payload. The Routine's user turn should be
populated from `body.text` of the fire POST — not from the system-prompt template.

### Candidate 2 — `text` field empty / undefined at fire time (medium probability)

EXEC-2 (`tasks/[taskId]/route.ts:403–426`) triggers `fireExecutionRoutine()` on the
`pending_review → open` transition. If `task.title`, `task.description`, and `task.notes`
were all null/empty, the text would reduce to `"Task: \n\nWhat to do:\n(no description
provided)\n\n..."` — still not a blank string, so this alone doesn't explain receiving
the pure template text.

### Candidate 3 — Routine fire infrastructure substituted system-prompt for user message

The same defect that afflicted issue #1066. The fire endpoint may be replacing the user
message with the Routine's pre-configured system prompt template when `text` is empty
or when a configuration mismatch exists. Because both the audit and exec Routines show
the same symptom, the common layer (the `/fire` endpoint or Routine session init) is
the most likely culprit.

---

## Secondary findings

| Priority | Finding | File:line |
|----------|---------|-----------|
| HIGH | No `exec_correlation_id` saved to task yet — if Routine had completed, exec-ingest would 403 | `tasks/[taskId]/route.ts:406–408` |
| HIGH | `operations_exec_usage` migration must be applied before EXEC-2 accepts any task | `execFireBudget.ts:60` / schema.prisma:1180 |
| MEDIUM | The correlation_id is embedded in `text` (plain text), not in a structured header — easy to misparse | `fireExecutionRoutine.ts:75–77` |

---

## What the Routine did NOT do

Per CLAUDE.md:
- ❌ Did not write any code
- ❌ Did not modify any branch files
- ❌ Did not open a PR
- ❌ Did not call `exec-ingest` (no valid `project_id` or `correlationId` to use)
- ✅ Halted with this audit report

---

## Actions needed (for Alex)

1. **Find the task that triggered this fire** — check which task's `exec_correlation_id`
   was just set to a UUID (or attempted). That's the task whose `pending_review → open`
   transition fired this session.
2. **Diagnose the fire body actually sent** — inspect the POST body that reached
   `EXEC_ROUTINE_FIRE_URL`. Was `text` populated? Did it match what
   `fireExecutionRoutine.ts:72–77` constructs?
3. **Cross-reference with issue #1066** — the audit Routine saw the exact same symptom.
   The common layer is the Routine fire infrastructure, not the app code.
4. **Re-fire the task** once the payload issue is fixed. The task's `exec_status` may
   still read `building` (set optimistically by EXEC-2:408) even though the build never
   ran — update it to `fire_failed` if re-firing.
5. **Verify `operations_exec_usage` table** — `\dt operations_exec_usage` via psql.
   If absent, the `requireExecBudget()` call will throw on the re-fire.
