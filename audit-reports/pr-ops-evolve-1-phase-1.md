# PR-Ops-Evolve-1 — Phase 1 Audit (read-only)

Mapping the task-generation pipeline so we can add two manual-paste context inputs
— **Deep Research Input** (Claude-app research output) and **Claude Code Audit
Input** (audit of the shipped scope) — to the dependency section, then re-run the
generation prompt with both in context to reconcile the task list against reality.
Manual paste only; per-project; evolve = refine + keep history. No edits made.

---

## 1. The task-generation pipeline (prompt 5.17)

**4 generation endpoints** (2 tasks, 2 design — stateless create-form + per-project):

| # | Route | File |
|---|-------|------|
| 1 | `POST /api/operations/ai/generate-tasks` (stateless, create form) | `src/app/api/operations/ai/generate-tasks/route.ts` |
| 2 | `POST /api/operations/projects/[id]/generate-tasks` (per-project) | `src/app/api/operations/projects/[id]/generate-tasks/route.ts` |
| 3 | `POST /api/operations/ai/generate-design` (stateless) | `src/app/api/operations/ai/generate-design/route.ts` |
| 4 | `POST /api/operations/projects/[id]/generate-design` (per-project) | `src/app/api/operations/projects/[id]/generate-design/route.ts` |

**The evolve loop targets endpoint #2** (per-project tasks). It resolves sections
from the project row (`generate-tasks/route.ts:60-62`):
```
const goalItems      = resolveItems(project.goal_items, project.goal);
const problemItems   = resolveItems(project.problem_items, project.problem);
const diagnosisItems = resolveItems(project.diagnosis_items, project.diagnosis);
```
then calls `generateProjectTasks({ userId, userEmail, projectId, projectTitle,
goalItems, problemItems, diagnosisItems, northStar })` (`:78-87`).

**Prompt assembly** — `src/lib/ai/generateProjectTasks.ts`:
- `SYSTEM_PROMPT` (`:89-195`) — institutional-rigor framework naming
  GOAL/PROBLEM/DIAGNOSIS/NORTH STAR inputs, STEP-voice rules.
- `userMessage` (`:197-209`):
  ```
  ${formatNorthStarBlock(...)}Project title: "${projectTitle}"
  GOAL items: …  PROBLEM items: …  DIAGNOSIS items: …
  Web-search to verify vendor URLs (max 8). Then call return_project_tasks …
  ```
- Input type `GenerateInput` (`:26-35`): `{ projectId, projectTitle, goalItems,
  problemItems, diagnosisItems, northStar? }`.

**➜ Where the two inputs go:** add two optional fields to `GenerateInput`
(`deepResearchInput?: string`, `claudeCodeAuditInput?: string`), append them as
two labelled blocks in `userMessage` (e.g. `DEEP RESEARCH (external, what's
true/best):` and `CLAUDE CODE AUDIT (what's actually shipped/stale/missing):`),
and extend the `SYSTEM_PROMPT` with a short reconciliation instruction (use
research as ground truth for "best", audit as ground truth for "current state";
add/retire/sharpen tasks accordingly). Endpoint #2 reads the two new persisted
fields off the project and passes them through.

**AI wrapper** — `src/lib/ai/recordUsage.ts` (`recordUsage()` `:102-212`).
Model `claude-sonnet-4-20250514` (`client.ts:31`), cost $3/$15 per M tok
(`client.ts:38-44`). Persists an `operations_ai_usage` row (`:151-168`) with
`full_system_prompt`, `full_user_message`, `full_response`, tokens, cost, plus an
`audit_log` row (`:170-194`). The evolve rerun reuses this wrapper unchanged.

**Append vs replace** — generation does **not** write tasks directly; the
accept-gate is `POST /api/operations/projects/[id]/tasks/bulk-create`
(`src/app/api/operations/projects/[id]/tasks/bulk-create/route.ts`). It **APPENDS**
(`:188-194`): `display_order = max(existing) + 1 + suggested_order`, atomic
`$transaction` insert (`:198-214`), **never deletes** old tasks. Per-task audit
rows link `source_ai_usage_id` (`:218-236`). So re-run already = append + keep
history; lineage is via the audit log, not a column.

---

## 2. Project sections + dependency section (where the boxes go)

**Model `operations_projects`** (`prisma/schema.prisma:2559`):
- Text: `goal`, `problem`, `diagnosis`, `design` (`:2564-2567`).
- JsonB structured lists: `goal_items`, `problem_items`, `diagnosis_items`
  (`:2568-2570`, PR-3.7).
- **No** `design_items`, **no** `vision`/research/audit columns (vision/North Star
  is a separate table via `toNorthStarContext`). Confirmed by grep — none exist.
- Relations `outgoing_dependencies` / `incoming_dependencies` (`:2584-2585`) →
  `operations_project_dependencies` (`:2698`): project→project edges
  (`depends_on_project_id`, `dependency_type` blocks/informs/derived_from,
  `rationale`). **This is the "dependency section."**

**UI**: `src/components/workbench/operations/projects/ProjectRow.tsx` renders the
expanded project — the sections, the generate buttons (`handleGenerateDesign`
`:171`, generate-tasks fetch `:215`), and the dependency section via
`<DependencyList projectId=… />` (`:388`,
`src/components/workbench/operations/projects/DependencyList.tsx`).

**➜ Where the two boxes go (UI):** in `ProjectRow.tsx`, in/adjacent to the
dependency section around `:388` — two `<textarea>` paste boxes (Deep Research
Input, Claude Code Audit Input) with a save handler, plus an "evolve / regenerate
tasks" action that POSTs to endpoint #2.

**➜ Where they persist (recommend):** two nullable `Text` columns on
`operations_projects` — `deep_research_input` and `claude_code_audit_input` —
mirroring the existing `goal`/`problem`/`diagnosis`/`design` Text pattern.
Simplest, per-project, no new table. (Per-rerun *history* of what was pasted is
already captured in `operations_ai_usage.full_user_message`, so a separate
revision table isn't needed for traceability.) **This is a schema addition (2
columns) — flagged.**

---

## 3. Task model + history / never-destroy

**Status enum `OperationsTaskStatus`** (`schema.prisma:2521-2527`):
`open | in_progress | blocked | completed | cancelled`. **No
`superseded`/`obsolete`/`archived`/`retired`.**

**➜ Retire-without-destroy decision (flagged):**
- **Option A (no schema change):** reuse `cancelled` to mark evolve-retired tasks.
  Semantically loose (mixes "user cancelled" with "evolve-superseded") but zero
  migration.
- **Option B (schema enum add):** add `superseded` to `OperationsTaskStatus` so
  evolve-retired tasks are distinguishable. Cleaner for the "evolve" semantics and
  for filtering history. **Recommended** — one enum value addition.

**Never-destroy mechanism (already exists, we extend it):** bulk-create only
appends and never deletes (`bulk-create/route.ts:188-214`); every task carries an
audit-log row with `source_ai_usage_id` (`:218-236`). Evolve extends this: the
rerun appends the reconciled tasks; stale ones are **status-flagged** (A or B
above), never deleted — preserving the guarantee. (No soft-delete column or
revision id exists today; status-flag + audit lineage is the mechanism.)

---

## 4. Inspection / transparency (3.6)

`operations_ai_usage` stores the **full** prompt: `full_system_prompt`,
`full_user_message`, `full_response` (`schema.prisma:2838-2862`;
`recordUsage.ts:151-168`). Inspection UI: `InspectionDrawer.tsx`,
`SectionK_AuditTail.tsx`, route `src/app/api/operations/ai-usage/[id]/route.ts`.

**➜ Traceability is automatic:** because the two pasted inputs get concatenated
into `userMessage`, they are persisted verbatim in `full_user_message` and shown
in the inspection drawer — every evolved task list traces back to the exact
research + audit text that shaped it, with **no inspection-layer change needed**.

---

## RECOMMENDED BUILD PLAN (minimal)

1. **Schema (flagged):**
   - Add 2 nullable Text columns to `operations_projects`:
     `deep_research_input`, `claude_code_audit_input`.
   - Add `superseded` to `OperationsTaskStatus` (Option B; or skip and reuse
     `cancelled` for Option A — decide before building).
2. **Persistence API:** a small PATCH on the project (or extend the existing
   project-update route) to save the two pasted strings. *(Phase-2 should confirm
   the existing project section-save endpoint to reuse it rather than add one.)*
3. **UI** (`ProjectRow.tsx`, dependency section ~`:388`): two `<textarea>` paste
   boxes + save, and an "evolve" button that re-runs generate-tasks.
4. **Prompt wiring** (`generateProjectTasks.ts`): add the two optional fields to
   `GenerateInput`, append two labelled blocks to `userMessage`, and add a
   reconciliation instruction to `SYSTEM_PROMPT` (research=truth/best,
   audit=shipped/stale/missing → add/retire/sharpen). Endpoint #2
   (`generate-tasks/route.ts:60-87`) reads the two columns and passes them in.
5. **Reconciliation behavior:** keep the existing append-on-accept flow
   (bulk-create) for new/sharpened tasks; for retire, set stale tasks'
   status to `superseded` (or `cancelled`) — never delete. History preserved via
   the existing audit-log + `source_ai_usage_id` lineage.
6. **Inspection:** no change — the two inputs ride in `full_user_message`.

### Hub-only-safe vs schema/shared flags
- **Schema additions (flagged):** 2 project columns + (optional) 1 enum value —
  the only migration-level changes.
- The prompt/UI/endpoint changes are additive and scoped to the Operations
  projects feature (no shared-component / app-wide blast radius).
- **Open decisions for Phase 2:** (a) reuse `cancelled` vs add `superseded`;
  (b) confirm/reuse the existing project section-save endpoint for persistence;
  (c) whether retire is automatic (AI flags) or an explicit accept-gate like
  bulk-create (recommend an accept-gate to stay consistent with never-destroy +
  human-in-the-loop).

NO edits made.
