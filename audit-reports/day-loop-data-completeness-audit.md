# Audit — Day-Loop Data Completeness (mirrored plan ↔ reflection questions)

**Status:** AUDIT ONLY (read-only investigation, no implementation)
**Date:** 2026-06-05
**Branch:** `claude/audit-day-loop-data`
**Goal context:** The daily reel is built from morning answers (4 planning Qs), the executed
task record, and evening answers (4 reflection Qs). Questions are being redesigned as
mirrored **plan ↔ outcome** pairs (a morning forecast graded by an evening reflection), with
the task record as the objective reality between them. This verifies whether the system
*captures* everything that loop needs before the questions are locked.

Every claim cites `schema model:line` or `file:line`.

---

## 1 · Task execution record — what is captured today

### Fields by model
**`operations_project_tasks`** (`schema.prisma:2673-2713`)
| Field | Line | Written when |
|---|---|---|
| `status` | 2680 | every status change (PATCH) |
| `estimated_minutes` | 2681 | create/edit form only (manual) |
| `estimated_cost_usd` | 2682 | create/edit form only (manual) |
| `actual_cost_usd` | 2692 | **edit form only — never auto** |
| `actual_minutes` | 2693 | **edit form only — never auto** |
| `completed_at` | 2695 | **AUTO on completion** |

**`operations_calendar_blocks`** (`schema.prisma:2739-2759`)
| Field | Line | Written when |
|---|---|---|
| `scheduled_start` / `scheduled_end` | 2744-2745 | when a task is time-committed |
| `actual_start` / `actual_end` | 2746-2747 | **AUTO on "mark done"** (committed tasks) |
| `status` (CalendarBlockStatus) | 2748 | commit / done / uncommit |

**`operations_task_status_history`** (`schema.prisma:2761-2776`)
| Field | Line | Written when |
|---|---|---|
| `previous_status` / `new_status` | 2765-2766 | **AUTO, every transition** |
| `changed_at` | 2767 | "" (timestamp of the transition) |
| `changed_by` / `reason` | 2768-2769 | "" (actor email; optional reason) |

### Write paths (verified)
- **`completed_at` — AUTO.** Task PATCH sets `data.completed_at = new Date()` when status →
  `completed` (unless explicitly patched) (`projects/[id]/tasks/[taskId]/route.ts:9` doc;
  status-completion branch). **Populated on every completion path.**
- **`status_history` — AUTO + atomic.** Every status transition inserts a history row via
  `recordTaskStatusChange` inside the task-update transaction
  (`tasks/[taskId]/route.ts:335-345`; helper `lib/operations/recordTaskStatusChange.ts:20-43`,
  which is required to run inside `$transaction`). Full trail exists.
- **Block `actual_start/actual_end` — AUTO on "mark done".** `TaskBand.markDone` PATCHes the
  block `{ actual_start, actual_end, status:'completed' }` (`TaskBand.tsx:209`), then PATCHes
  the task `{ status:'completed' }` (`TaskBand.tsx:219`). The block route accepts these
  (`daily-plan/blocks/[blockId]/route.ts:4-5`). **Only for tasks that were time-committed
  (have a block).**
- **Task `actual_minutes` / `actual_cost_usd` — schema + route + UI exist, but NOTHING
  auto-populates them.** The PATCH route accepts both (`tasks/[taskId]/route.ts:191-227`),
  the edit form binds inputs for both (`TaskRow.tsx:728-729,750-751`), and `handleSave` sends
  the whole form (`TaskRow.tsx:133`). BUT the two completion flows send **only**
  `{ status:'completed' }` — quick-complete (`TaskRow.tsx:160`) and TaskBand mark-done
  (`TaskBand.tsx:219`). **So unless Alex opens the task and types them, they stay NULL** →
  exactly the "—" in his screenshots (`TaskRow.tsx:573,577` render `?? '—'`).
- **`estimated_minutes` / `estimated_cost_usd`** — capturable at task create
  (`TaskList` create form) and edit (`TaskRow.tsx:717,738`); `'—'` when never entered.

### "—" in the screenshots — verdict
`estimated_minutes`, `estimated_cost_usd`, `actual_minutes`, `actual_cost_usd` are **all
schema-backed with a real UI write path (the task edit form)** — they are **not** schema-only.
They show "—" because **no completion flow populates the actuals**; they require manual entry
that isn't happening. The *real* timing truth for committed tasks lives instead in the block's
`actual_start/actual_end` (and the task's `completed_at`), which never get rolled up into
`actual_minutes`.

### Order-of-execution — can the actual sequence be reconstructed? **YES**
- **`operations_project_tasks.completed_at`** (`schema.prisma:2695`) — the timestamp a task
  was marked done. Ordering tasks by `completed_at` reproduces the true completion sequence
  for **every** completed task (committed or not).
- Corroborated by **`operations_task_status_history.changed_at`** (`:2767`) for each
  `→completed` transition, and by **`operations_calendar_blocks.actual_start`** (`:2746`) for
  committed tasks.
- **Caveat:** the field exists and proves sequence, but the **script generator does not use
  it** (see §2) — it orders by `actual_start ?? scheduled_start` and dumps block-less tasks at
  the end, so a quick-completed task's true position is lost in the reel even though
  `completed_at` knows it.

---

## 2 · What the script generator actually receives — stored vs sent

The generator's task query selects **only** `{ title, project_id }`
(`content/generate-script/route.ts:133`); times/status come from the joined `calendar_blocks`.
Per task it sends: `title`, `project` (name), `status` (block status, or `'planned'`),
`planned` (bool), `scheduled` ("HH:MM–HH:MM"), `actual` ("HH:MM–HH:MM" when block actuals
exist) (`route.ts:150-172`; shapes in `lib/ai/generateReelScript.ts:26-33`). Scenes send
`activity, time, narrative, b_roll, question, answer` (`route.ts:118-126`).

| Captured field | Stored at | Sent to prompt? |
|---|---|---|
| task `title` | tasks:2678 | **Sent** |
| project name | projects | **Sent** (looked up, route:139-145) |
| `status` (block) | blocks:2748 | **Sent** |
| scheduled times | blocks:2744-2745 | **Sent** |
| actual times (clock) | blocks:2746-2747 | **Sent** (HH:MM only) |
| **`completed_at`** | tasks:2695 | **NOT sent** (not selected) |
| **`actual_minutes`** | tasks:2693 | **NOT sent** |
| **`actual_cost_usd`** | tasks:2692 | **NOT sent** |
| **`estimated_minutes` / `estimated_cost_usd`** | tasks:2681-2682 | **NOT sent** |
| **task `description`** | tasks:2679 | **NOT sent** (titles are "labels" by design) |
| **task `notes`** | tasks:2690 | **NOT sent** |
| **`status_history` trail** | status_history | **NOT sent** |
| **`deadline` / `unblocks_label`** | tasks:2683,2688 | **NOT sent** |
| piece `execution_notes` | pieces:2960 | **Sent** (route:182) |

**Diff (stored but not sent):** `completed_at`, `actual_minutes`, est/actual cost,
`estimated_minutes`, `description`, `notes`, `status_history`, `deadline`, `unblocks_label`.
Most relevant to the new loop: **`completed_at` (the actual sequence) and est-vs-actual
minutes are captured-or-capturable but never reach the prompt.**

---

## 3 · Answer storage — the redesign's landing zone

### Where answers live + shape
- **An answer = `operations_content_takes.script`** (`schema.prisma:2990`) — **free-text only**
  (`Text`, nullable). One take per `(scene_id, piece_id)` = one answer per scene per day,
  enforced by `@@unique([scene_id, piece_id])` (`:2998`).
- Write path: `POST /api/operations/content/grid/cell` upserts the cell's `script` (trimmed,
  empty → null) (`content/grid/cell/route.ts:52-95`).
- **No numeric/structured field anywhere** on `operations_content_takes` (only `script`),
  nor on `operations_content_scenes`/`operations_content_pieces`
  (`schema.prisma:2984-3000`). A morning **confidence 1-10** or evening **score 1-10** today
  can only live *inside the prose*.

### Numeric sidecar — what it would require (NOT building)
To chart a number across 30 days you need one of:
1. **A nullable numeric column on `operations_content_takes`** (e.g. `answer_value Int?`,
   range-validated) written alongside `script`. Cleanest; chartable directly; one small
   migration + a field in the cell route + a UI input. **Recommended shape.**
2. **Parse-on-read** from `script` prose (regex "score: 7"). No migration but fragile,
   non-authoritative, breaks on free-text drift — not suitable for a graded forecast loop.
   *(Reject for the mirror loop; numbers must be first-class.)*
   - If numerics become first-class, they likely also want a **question "kind"** (scale vs
     prose) so the UI knows to render a 1-10 input — see §4.

### Question tie — does an old day know what it answered? **NO (longitudinal gap)**
- The **question lives on the SCENE**, not the take: `assigned_question_text` is a snapshot on
  `operations_content_scenes` (`schema.prisma:2922-2923`), and a scene is **one per
  `routine_step`** (`routine_step_id @unique`, `:2908`) — i.e. **shared across all days**.
- The **take stores only the answer** (`script`), with **no question snapshot** (`:2984-3000`).
- The scene's `assigned_question_text` is immutable against *library* question edits (the
  comment at `:2916-2921` — it's a snapshot so a scene keeps its prompt even if the library
  question is edited/soft-deleted). **But it is scene-level, not day-level.** If the scene's
  question is **re-assigned** (CE-3 AI re-populates `assigned_question_id`/`_text`), every
  past day's take silently re-associates to the new wording — days 1-9 have no independent
  record of the question they actually answered.
- **Implication for the loop:** the longitudinal "forecast vs outcome over 30 days" record is
  only safe if the question is *frozen per answer*. Today it is not.

---

## 4 · The mirror linkage (morning ↔ evening pairing)

- **No pairing structure exists.** Scenes carry `scene_number` (on
  `operations_content_scene_groups:2886`, per routine) and `routine_step.step_order`
  (ordering only). Nothing links a specific morning scene to its evening counterpart.
- Pairing today would be **implicit by scene position/order** — brittle (reorder a scene and
  the pairing silently shifts; nothing asserts "this evening verdict grades that morning
  forecast").
- **Lightest honest mechanism (recommend, do NOT build):** a nullable **`pair_key`** (short
  string/uuid) on `operations_content_scenes` — morning scene and its evening mirror share the
  same `pair_key`. The generator/charts then join forecast↔outcome explicitly regardless of
  order. One nullable column, no backfill, no behavior change when null. (A `paired_scene_id`
  self-FK is the alternative but is directional and heavier; `pair_key` is symmetric and
  simplest.)

---

## 5 · Gaps summary + recommended minimal PRs

### Data the new loop needs × current state
| Loop datum | Current state |
|---|---|
| Forecast text (morning prose) | **captured + sent** — `takes.script` → prompt `answer` |
| Obstacle / stake / mindset (morning prose) | **captured + sent** — same channel |
| Settled verdict / surprise / root cause (evening prose) | **captured + sent** — same channel |
| Tomorrow's first move (closing prose) | **captured + sent** — same channel |
| **Confidence numeric (1-10, morning)** | **missing entirely** — no numeric field; prose-only |
| **Day score numeric (1-10, evening)** | **missing entirely** — no numeric field; prose-only |
| **Question-as-asked, per day** | **schema exists, wrong grain** — snapshot is scene-level, not per-take; no per-day freeze |
| **Morning↔evening pairing** | **missing entirely** — no `pair_key`; only implicit by order |
| **Actual task sequence** | **captured, not sent** — `completed_at` exists; generator ignores it |
| Planned-vs-actual times | **captured + sent** — block scheduled/actual → prompt (HH:MM) |
| Est-vs-actual minutes/cost | **schema + UI write path, but not auto-captured; not sent** |

### Recommended minimal PR set (one fix per PR — no implementation here)
1. **PR — Numeric answer sidecar.** Add nullable `answer_value Int?` (1-10, range-checked) to
   `operations_content_takes`; accept it in the cell upsert route; add the input to the take
   UI. Unlocks charting confidence + day-score across 30 days. *(Pairs naturally with a
   nullable question "kind" = `scale | prose` on the scene so the UI knows when to show the
   1-10 input — can be the same PR or its own.)*
2. **PR — Freeze the question per answer.** Snapshot `question_text` (and `question_id`) onto
   `operations_content_takes` at answer time, so each day's answer permanently knows its
   prompt regardless of later scene re-assignment. Closes the longitudinal-integrity gap (§3).
3. **PR — Mirror `pair_key`.** Add nullable `pair_key` to `operations_content_scenes`; link
   morning↔evening scenes; expose forecast↔outcome as an explicit pair to the generator/charts
   (§4).
4. **PR — Send the actual sequence (+ key numbers) to the generator.** Select `completed_at`
   (and est/actual minutes) in the script route; order the proof-burst by true completion time
   and let the prompt cite real planned-vs-actual. Pure data-flow + prompt; no schema. Closes
   the "captured-not-sent" gap (§1/§2). *(Optional sibling: auto-roll block `actual_start/end`
   into task `actual_minutes` on mark-done so actuals stop being "—".)*

> Sequencing note: PRs 1-3 are schema migrations (each small, additive, nullable — no backfill,
> each `ALTER TABLE ... ADD COLUMN`); PR 4 is route + prompt only. None couples to another;
> they can ship in any order. PRs 1 and 2 are the load-bearing ones for the graded
> plan↔outcome loop — without them, confidence/score stay trapped in prose and old days can
> lose their questions.

### Open question for the redesign owner
The morning **confidence** and evening **score** — are they always 1-10 integers (PR 1's
`Int?` range), or could a pair use a different scale? Locking that sets the column type before
any UI is built.
