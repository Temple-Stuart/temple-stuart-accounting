# OPS — Content × Project-Evolution Audit (READ-ONLY)

**Branch:** `claude/ops-content-evolution-audit`
**Date:** 2026-06-02
**Scope:** Two halves, designed **together**: **(A)** how a project's task list
*evolves* over re-runs (the recursive append/preserve loop — the SUBSTANCE the
content documents), and **(B)** how the content workspace + a `content_pieces`
grouping should wire to that evolution. Truth-first: every claim below is read
from the code, cited file+line. **No implementation. Recommendations only.**

> Builds on the prior `ops-content-audit.md` (commit `fb27bc98`, on
> `claude/...content` — **not on main**), which established the
> scenes/takes 1:1 substrate and first proposed `operations_content_pieces`.
> This audit *refines* that proposal against how evolution **actually** works.

---

# PART A — The project evolution loop

## A1. Project + task model + history structure

| Model | Lines | What it holds | Evolution role |
|---|---|---|---|
| `operations_projects` | `prisma/schema.prisma:2632-2669` | `goal`/`problem`/`diagnosis` + `goal_items`/`problem_items`/`diagnosis_items Json`, `design`, `deep_research_input`, `claude_code_audit_input`, status/priority | **Current-state only.** No content relation. |
| `operations_project_tasks` | `:2671-2708` | title/description/status/estimates/`display_order`/`completed_at`/notes/coa | The append target. **No `source_ai_usage_id` column** (see A3 gap). |
| `operations_task_status_history` | (read this audit) | `previous_status → new_status`, `changed_at`, `changed_by`, `reason`; `@@index([task_id, changed_at desc])` | **STATUS transitions only — NOT task-list/content versioning.** |
| `operations_ai_usage` | `:2913-2937` | `full_system_prompt`, `full_user_message`, `full_response`, `inputs_summary`, `output_summary`, `target_table`/`target_id`, `purpose`, `created_at`; `@@index([target_table, target_id])`, `@@index([purpose, created_at desc])` | **The real per-re-run version record** — append-only, immutable snapshots. |

**Key correction to a common assumption:** the per-task **"history" button** does
**not** show task-list versions. `TaskRow.tsx:333-340` calls
`/projects/[id]/tasks/[taskId]/history`, which reads
`operations_task_status_history` (`history/route.ts:43-55`) — i.e. *this one task's
status changes* (open → in_progress → completed), rendered at `TaskRow.tsx:391-424`.
It is a **per-task status timeline**, not a project evolution view.

## A2. The re-run mechanism — WORKING, append-only

The loop is **two endpoints with an explicit acceptance gate** between them:

1. **`generate-tasks/route.ts`** (re-run) — **does NOT save.** Resolves
   `*_items` (JSONB, with legacy paragraph fallback), passes `deep_research_input`
   + `claude_code_audit_input` to `generateProjectTasks`, returns the parsed task
   array + `usage_id` + cost. The header comment states it plainly: *"does NOT
   save tasks to the DB … user must explicitly accept via the AITaskPreview →
   bulk-create gate."* (`generateProjectTasks.ts:1-19` repeats: *"does NOT
   auto-save … explicit acceptance gate."*)
2. **`tasks/bulk-create/route.ts`** (the real persistence) — **APPEND.**
   - `baseOrder = (maxOrderRow?.display_order ?? -1) + 1` (`:188-194`)
   - then per task: `create({ … display_order: baseOrder + task.suggested_order })`
     inside a `$transaction` (`:198-214`)
   - requires an ownership-verified `source_ai_usage_id` (`:152-168`) — you cannot
     persist tasks that aren't tied to a real generation row.

**Verdict — which of append / preserve / supersede / replace:**

| Behavior | Status | Evidence |
|---|---|---|
| **Append** new tasks after the existing max order | ✅ **WORKING** | `bulk-create:194,209` |
| **Preserve** old tasks (never deleted on re-run) | ✅ **WORKING** | no delete/update of existing tasks anywhere in the re-run path |
| **Supersede** (mark old tasks stale when re-run replaces them) | ❌ **does not exist** | no `superseded`/`replaced_by` field or logic |
| **Replace** (clear + regenerate) | ❌ **does not exist** | bulk-create only `create()`s |

So the loop is **strictly additive**: every re-run *grows* the list. There is no
de-duplication, no supersede, no replace. Old tasks always survive (a task is only
removed by the explicit per-task `DELETE` in `TaskRow.handleDelete`).

## A3. AI design-reasoning storage + per-re-run versioning

- **`generate-design/route.ts`** mirrors generate-tasks: *"does NOT save … user
  must explicitly accept and PATCH the project"* (`:1-17`). It returns
  `generated_design` + `usage_id`. So the project's `design` field (and the
  `*_items`) is **current-state, last-write-wins** — accepting a new design
  **overwrites** the old one on `operations_projects`.
- **BUT every generation writes a fresh `operations_ai_usage` row** (via
  `recordUsage`) carrying the **full system prompt, full user message, full
  response, and summaries**, tagged `target_table='operations_projects'`,
  `target_id=projectId`. Indexed by `[target_table, target_id]`.

  **⇒ The per-re-run AI reasoning IS preserved** — as an **append-only,
  immutable log** queryable per project, ordered by `created_at`. The *project
  fields* hold only the latest accepted state; the *reasoning history* lives in
  `operations_ai_usage`. Each row is effectively "the project's brain at re-run N."

- **GAP (important for Part B):** there is **no column linking a created task to
  the `operations_ai_usage` row that produced it.** `bulk-create` writes
  `source_ai_usage_id` **only into the audit-log metadata** (`:226-234`), *not*
  onto `operations_project_tasks` (confirmed — no such field at `:2671-2708`). So
  "which re-run / batch produced task X" is recoverable **only by scanning the
  audit log**, not from the task row. The append *batches* are real but **implicit**.

## A4. Evolution visibility — recorded, but NOT surfaced

| Signal | Stored? | Surfaced in UI? |
|---|---|---|
| Per-task status changes | ✅ `task_status_history` | ✅ per-task "history" button (`TaskRow.tsx:333`) |
| Per-re-run AI reasoning (prompts/response) | ✅ `operations_ai_usage` (append-only) | ❌ **no project-level view** reads it |
| Append batches ("re-run N added tasks 7–11") | ⚠️ implicit (audit-log metadata only) | ❌ tasks render as one flat list by `display_order` |
| Project design over time | ⚠️ current-state only on project; reasoning in ai_usage | ❌ no diff/timeline |

`grep` for `history|timeline|version|evolution` across
`src/components/workbench/operations/` returns only `TaskRow.tsx`,
`RoutineRow.tsx`, `SectionB_NorthStar.tsx` — **none is a project evolution
timeline.** So the substrate to show "how this project evolved" **exists**
(ai_usage log + append ordering + status history) but **nothing renders it as a
narrative**. This is the seam Part B's content piece both *needs* and *would make
legible*.

---

# PART B — Wiring the content workspace to the evolution

The design principle that ties the halves together: **a reel documents the project
*as it was on a given day*.** Because the project's own fields are last-write-wins
(A3), a content piece must pin to a **point in time**, not just `project_id`. The
**immutable `operations_ai_usage` row is the natural version anchor** — it is the
frozen snapshot of the reasoning + the batch of tasks that re-run produced (A2/A3).

## B5. Refined `content_pieces` — link to a re-run *version*, not just current state

The prior audit proposed `operations_content_pieces` (with `piece_date`) +
`piece_id` on scenes + a project-item join. **Refinement:** the piece should carry
**both** the project *and* the version it documents:

```
operations_content_pieces
  id            uuid pk
  user_id / entity_id
  piece_date    date         -- the day (the daily-reel anchor; see prior §5)
  title         varchar
  status        ...
  script        text         -- overall running order
  project_id            uuid?  -- FK operations_projects (the subject), nullable
  source_ai_usage_id    uuid?  -- FK operations_ai_usage (the VERSION anchor), nullable
```

- `project_id` = *which* project this reel is about (current-state pointer).
- `source_ai_usage_id` = *which re-run* it documents — the immutable snapshot, so
  the reel still means "Day 2 of the project" even after the project's design is
  later overwritten. **This is the refinement:** version link, not just
  current-state link.
- A reel **not** about a project (a pure routine scene) leaves both null and
  attaches scenes/takes only.

**Prerequisite schema change (recommended, flagged): add
`source_ai_usage_id String? @db.Uuid` to `operations_project_tasks`** so the
append *batch* becomes first-class on the task (today it's audit-log-only, A3 gap).
Once tasks carry their batch id, "tasks 3–5 added by re-run N" is a single indexed
query — the data the narrative link (B7) needs.

## B6. The Content workspace = three existing surfaces + inline-create

The workspace is a **new Content-tab layout that composes forms that already
exist** — no new form primitives, just mounting + a "use for content" pre-flag:

| Workspace column | Reuse (existing component) | "Use for content" pre-flag |
|---|---|---|
| **Routines queue** (recurring scenes) | `RoutineList.tsx` / `RoutineRow.tsx` + `RRULEBuilder` (the routine form), `ScenifyButton` (`RoutineRow.tsx:298`) | the **isContent toggle** from prior OPS-CONTENT-PR-1 → creates `operations_content_scenes` |
| **Open-projects queue** (per-day substance) | `SectionD_ProjectBacklog.tsx` (create `:344-579`) + the AI design/tasks loop | the **isContent toggle** from prior OPS-CONTENT-PR-2 → creates the project-content item |
| **Content list** (the reels) | `ContentTable.tsx` (14-col) + `ScenifyModal` / `AvailableRoutinesList` already in `SectionG_Content.tsx` | the piece rows (B5) |

Inline-create = mount the **same** RoutineList / SectionD_ProjectBacklog forms
inside the workspace with the content flag pre-set, so creating a routine/project
*from the content workspace* lands it already marked as content (and, for projects,
ready to be pinned to a piece). The forms, their APIs, and validation are
unchanged — the workspace is composition, not a fork.

## B7. The project → content narrative link

Goal string: **"this reel = Day 2 of the project, tasks 3–5 added."** Each clause
is *derivable* once B5's two FKs + the B6 task batch column exist:

| Clause | Source |
|---|---|
| "the project" | `piece.project_id → operations_projects.title` |
| "Day 2" | rank of `piece.source_ai_usage_id.created_at` among that project's `operations_ai_usage` rows (`target_table/target_id` index), or `piece_date` |
| "tasks 3–5 added" | `operations_project_tasks WHERE source_ai_usage_id = piece.source_ai_usage_id` (the batch — **needs the B6 task column**), ordered by `display_order` |

So the narrative is a **read-only view** over `piece → ai_usage → its task batch`.
No new "narrative" storage — it falls out of the version anchor + the batch column.
This is also exactly the **project-evolution timeline that A4 found missing**:
building it for content gives the project tab the same view for free.

---

# Build sequence (one concept per PR)

> Convergent with the prior audit's PR-1/PR-2/PR-3, with **two evolution-aware
> additions** (★). Schema PRs: `prisma/schema.prisma` **+ raw SQL migration move
> in parallel** (dual-write rule); **Alex runs the migration via `psql`** (not
> `prisma migrate`). All routes stay `getVerifiedEmail` + user-scoped + audit-logged.

| PR | Concept | Schema? |
|---|---|---|
| **OPS-CONTENT-PR-1** | isContent toggle + scene sub-form on the Routine form (reuse scenes/takes) | likely **0-schema** (toggle = "has a content_scene"); optional `is_content` bool — flag |
| **OPS-CONTENT-PR-2** | isContent toggle + content sub-form on the Project form | **+schema**: `operations_content_project_items` + new API |
| **★ OPS-CONTENT-PR-2.5** | **Make append batches first-class:** add `source_ai_usage_id` to `operations_project_tasks`; backfill from the audit log; bulk-create writes it onto the task too | **+schema** (1 nullable col + index `[source_ai_usage_id]`); backfill SQL |
| **OPS-CONTENT-PR-3** | `operations_content_pieces` (+ `piece_date`, `project_id`, **`source_ai_usage_id`** version anchor) + `piece_id` on scenes + the project-item link; the "group today's items into a reel" surface | **+schema**: piece table + relations |
| **★ OPS-CONTENT-PR-4** | The Content **workspace** (routines + open-projects + content-list, inline-create) **and** the project→content **narrative/evolution view** (B7, read-only over the new FKs) | **0-schema** (composition + read view) |

**Schema changes flagged:** PR-2, PR-2.5, PR-3 each add tables/columns → prisma +
raw SQL in parallel, Alex runs psql. PR-2.5 additionally needs a **backfill** of
`source_ai_usage_id` onto existing tasks from the audit-log metadata (recoverable;
each `operations_project_task_created` audit row carries it — A3) — backfill is
best-effort (tasks predating bulk-create stay null).

---

# Sign-off items (decisions for Alex)

1. **Version anchor on the piece** — confirm `operations_content_pieces` carries
   **both** `project_id` (subject) **and** `source_ai_usage_id` (the immutable
   re-run it documents), so a reel keeps meaning "Day 2" after the project's design
   is later overwritten (A3 last-write-wins). Recommended.
2. **Append batches first-class (PR-2.5)** — add `source_ai_usage_id` to
   `operations_project_tasks` (today it's audit-log-only, A3 gap)? This is what
   makes "tasks 3–5 added by re-run N" a query instead of a log scan, and powers
   both the content narrative (B7) and the missing project evolution view (A4).
   Recommended. Confirm the backfill is acceptable as best-effort.
3. **Re-run stays append-only** — confirm we are **not** adding supersede/replace
   (A2): the loop grows, dedup/cleanup remains the user's per-task delete. (The
   content version anchor assumes immutable, ever-growing batches.)
4. **No project-evolution view exists today (A4)** — confirm building it as the
   read-only narrative view in PR-4 (shared by the content workspace **and** the
   project tab) is the intended home, vs. a standalone project-timeline PR first.
5. **Workspace = composition, forms unchanged** — confirm the workspace mounts the
   existing `RoutineList` / `SectionD_ProjectBacklog` / `ContentTable` with a
   pre-set content flag (B6), rather than new forms.
6. **isContent toggle vs Scenify** (carried from prior audit) — toggle creates the
   scene on save; keep ScenifyButton as the from-the-list path. Confirm.
7. **Daily anchor** (carried) — group by `piece_date` = the day, pulling
   RRULE-firing routines + `daily_plan_items` for that date. Confirm.

---

**READ-ONLY audit. No implementation performed.** All schema items above are
**recommendations**; any build PR moves prisma + raw SQL in parallel and Alex runs
the psql migration.
