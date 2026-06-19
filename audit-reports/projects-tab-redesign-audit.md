# AUDIT — Projects tab redesign: create form + separated queue + project detail (running appended list + evolution) (READ-ONLY)

**Branch:** `claude/audit-projects-tab-redesign` · **Date:** 2026-06-18 · **Mandate:** Truth-First, read-only, cite `file:line`. Labels: EXISTS / EXISTS-BUT-UNUSED / MISSING / REUSABLE / RISK.

The Projects tab = `SectionD_ProjectBacklog.tsx` — header + `ProjectCreateForm` (A) + `projects.map(ProjectRow)` (B); clicking a row expands `ProjectRowView`, whose pipeline toggle opens `TruthMachineView` (the merged clean-white pipe). This audit scopes restyling all three surfaces into that pipe look, **presentation-only**.

---

## HEADLINE — most of surface C already exists; the data for B needs a small (non-migration) API add

- **Surface C's "running appended list grouped by run + evolution summary" is ALREADY BUILT** — `EvolutionTimelineView.tsx` renders exactly that (per-run version cards, task counts, status pills, done/superseded line-through), fed by `evolution/route.ts`'s `versions[]`. Surface C is mostly a **restyle + relabel**, not new logic.
- **The one data gap for surface B (queue cards):** the projects-list API returns bare rows — **no task count / run count**. Adding them is a small Prisma `_count` change (**no migration**).
- **The one true gap for the evolution summary's "goal added X per run":** there is **no per-run goal provenance** — `goal_items` is a current-state JSON array. Showing "+ goal X" per run needs a **migration** (or prompt-text diffing). Everything else is presentation-only.

---

## 1. SURFACE A — THE CREATE FORM

**Component:** `ProjectCreateForm.tsx`, mounted **only** in `SectionD_ProjectBacklog.tsx:122-132` (toggled by "+ new project" `:103-112`; the Content-tab `0·CREATE` mount was removed in PR-Content-2, so a restyle here touches **one surface**). — EXISTS.

**Contents (the Image-1 form):**
- The **KICKOFF "copy this" prompt** — `ProjectCreateForm.tsx:33-46` (`KICKOFF_PROMPT` const) + a copy affordance (`:72-75`). Matches the screenshot's KICKOFF block.
- **Fields** via `createForm: ProjectForm` (`:64-67`): title, entity dropdown, `goalItems`/`problemItems`/`diagnosisItems` (through `ListManager`), `design`, `claude_code_audit_input` (the reality-audit box). (`DEFAULT_PROJECT_FORM`, `types.ts`.)
- **Handlers:** create = POST `/api/operations/projects` (`:7`); plus the paid AI flow — `generate-design`, `generate-tasks`, `tasks/bulk-create` — with `AITaskPreview` + `InspectionDrawer` (`:6-9, :25, :28`). `onCreated()` fires → `SectionD` refetches (`:126-129`).
- **Where the new project lands:** `onCreated` → `fetchProjects()` (`SectionD:128`) → the queue re-renders with the new row.

**What a restyle touches:** `ProjectCreateForm.tsx` JSX only (the KICKOFF panel, field cards, buttons → clean white pipe). **Separate component** from `ProjectRowView`/`TruthMachineView` — no shared-view risk. The create/AI **engines are untouched** (POST + paid flow unchanged). — REUSABLE (restyle in place).

---

## 2. SURFACE B — THE QUEUE

**Where rendered:** `SectionD_ProjectBacklog.tsx:142-158` — `projects.map((p) => <ProjectRow … />)`. Each project is a `ProjectRow` (container) → `ProjectRowView` (compact row / expanded read / edit). — EXISTS.

**Per-project data available for a card:**
| Field | Source | Status |
|---|---|---|
| title, status, entity, target date, priority | `operations_projects` row (full row in the list response, `projects/route.ts:75-96`) | **EXISTS** |
| **task count** | `operations_project_tasks` (project_id FK) | **MISSING from the list response** — `projects/route.ts:75` is a bare `findMany`, **no `_count`/include** (grep confirmed). Add `_count: { select: { tasks: true } }` → cheap, **no migration**. |
| **evolve-run count** | distinct `source_ai_usage_id` over the project's tasks (the run-marker, `schema:2782`) | **MISSING** — not aggregated today; derivable via a `groupBy` or the evolution endpoint. Small query add, **no migration**. |

**How a row is opened today:** `ProjectRow` compact → `onToggleExpanded` expands `ProjectRowView`; the expanded read view has the **"⊞ pipeline view (Truth Machine)"** button (`ProjectRow` via `readViewAiActions`) → `TruthMachineView`. For the redesign, the card's click should open the **DETAIL (surface C)** directly. — RISK (minor): the queue card replacing `ProjectRow`'s compact row means deciding whether the card opens an inline detail or routes; either is presentation. `ProjectRowView`'s expand/edit must stay reachable (or be folded into the detail).

**What a restyle touches:** either a new `<ProjectQueueCard>` rendered by `SectionD` instead of (or wrapping) `ProjectRow`, **or** restyle `ProjectRowView`'s compact row. The former keeps `ProjectRowView` + its showroom contract stable (recommended, §4). The list-API `_count` add is the only non-CSS change. — REUSABLE + small API add (no migration).

---

## 3. SURFACE C — THE PROJECT DETAIL (running appended list + evolution)

**The running appended list — FEASIBLE from existing data, already rendered.**
- `operations_project_tasks` holds **ALL tasks across runs** (append-only; `bulk-create` never deletes), each tagged `source_ai_usage_id` (`schema:2782`), with `status`, `display_order`, `created_at`, `title` (`schema:2764-2785`).
- `evolution/route.ts:60-151` already returns the **run-grouped running list**: `versions[]` (chronological `version_number`, `usage_id`, `created_at`, `task_count`, and per-task `{id, title, status}`) + an honest `unversioned[]` bucket.
- `EvolutionTimelineView.tsx` **already renders it**: the summary "N re-runs · M tasks total" (`:121-126`), per-version cards (`v{n}`, date, "added X tasks" `:142`, cost `:146`), per-run task lines with **status pills + done/cancelled/superseded line-through** (`:72-92`), and the "original" unversioned bucket (`:161-176`). — **EXISTS / REUSABLE** (this IS the running appended list grouped by run, run 1 → run N).
- "done/new" per task: **done** = the status pill (`completed`/`superseded` → line-through, `:80-83`); **new** = tasks in the latest version. Data supports it; a "new" badge on the latest run is a trivial presentational add.
- The **editable** committed task list (manage/schedule a task) is `TaskListView`/`TaskRowView` (the `taskSection` slot). The detail can compose both: `TaskListView` (act on tasks) + `EvolutionTimelineView` (run history). — REUSABLE.

**The evolution summary — task counts EXIST, per-run goal provenance MISSING.**
- Available per run: `task_count` ("run 3 · +5 tasks"), model, cost, tokens, timestamp (`evolution/route.ts:117-135`). So **"run N · +X tasks"** is fully available. — EXISTS.
- **"goal added X" per run is NOT available.** `goal_items` is a single current-state JSON array (`schema:2727`); there is **no per-goal run/timestamp attribution** (grep: only `goal_items`). The `operations_ai_usage.full_user_message` of each run embeds the goal list *at that time*, so "goal added X" could be **inferred by diffing consecutive runs' prompt text** — fragile, not a first-class field. A clean "goal added X per run" line needs a **MIGRATION** (e.g. structured `goal_items` as `{text, added_run_id}` objects, or a `project_goal_history` table). — **MISSING (migration) — flag explicitly; only if the "goal added" line is required.** The task-count summary needs nothing.

**Where it renders today + reuse:** `EvolutionTimelineView` is mounted as the `evolutionSection` slot in `ProjectRowView` (toggle-gated) and is also used by the showroom. The detail view can **reuse `EvolutionTimelineView` + `TaskListView` via a new composing component** (restyle them, or wrap them) — no new data fetch beyond the existing `evolution` + `tasks` endpoints. — REUSABLE.

---

## 4. THE REDESIGN APPROACH

**Recommend NEW presentational components, composing the existing views — do not bloat `ProjectRowView`:**
- `<ProjectQueueCard project={…} taskCount runCount onOpen />` — the separated card (surface B), rendered by `SectionD` in place of the compact `ProjectRow`. Keeps `ProjectRowView` + its **showroom contract** (`ProjectsPipelineShowroom` renders `ProjectRowView` with locked handlers) **untouched**.
- `<ProjectDetailView>` — the detail (surface C), composing `TaskListView` (editable list) + `EvolutionTimelineView` (run-grouped history + summary), restyled to the pipe. The existing `ProjectRow`/`ProjectRowView`/`TruthMachineView` keep working; the detail is the new clicked-card destination.
- `ProjectCreateForm` — restyle in place (surface A); it's already a standalone component.
- **Reuse the design tokens from `TruthMachineView`** (the merged pipe): soft `#F4F3F8` canvas, white cards, colored `border-l-4` stripes, the `Stage`/`Chevron` pattern. — REUSABLE.

**Showroom-safe:** new components + restyling `ProjectCreateForm` don't touch `ProjectRowView`/`EvolutionTimelineView`'s prop contracts (if the detail **reuses** `EvolutionTimelineView` as-is, the showroom stays byte-stable; a restyle of `EvolutionTimelineView` itself would ripple to the showroom — so either restyle within a wrapper or accept the showroom updates). RISK: restyling shared leaf views (`EvolutionTimelineView`, `TaskRowView`) touches the showroom — prefer **wrapping** over editing them, or update the showroom in the same PR.

---

## 5. PRESENTATION-ONLY CONFIRM + MIGRATION

- **Presentation-only:** YES for surfaces A and C-rendering and the queue-card layout. The **engines are untouched** — create POST, the paid design/tasks flow, `bulk-create` (append), `evolution`/`tasks` reads, the `AITaskPreview` accept-gate all stay as-is.
- **Non-migration data add:** the queue cards' **task count + run count** need a small `projects` list-API enhancement (`_count` / distinct-run) — **not a migration**, just a query change.
- **MIGRATION (flagged, optional):** the evolution summary's **"goal added X per run"** needs per-run goal provenance — a structured `goal_items` or a history table. **Only required if that exact line is wanted**; "run N · +X tasks" needs nothing.
- **Mobile-first:** YES — all three surfaces are single-column stacks of clean cards (matching `TruthMachineView`'s `space-y` + `sm:` breakpoints, e.g. `Stage`'s `p-3 sm:p-4`).

---

## 6. RELATIONSHIP TO TM-4

- Surfaces A/B/C are **VIEWS that surface existing data** — they render the create form, the queue, and the run-grouped task list/evolution from data that already exists. **None depend on TM-4 to render.**
- **TM-4 = the evolve FIRING logic** (re-run research+fusion to append a run) + the **server-side cost ceiling** — scoped, not built (its STEP 1 hard-gate previously stopped on the TM-2 prerequisite; TM-2 is now merged, so TM-4 is unblocked).
- The detail view (C) should expose an **evolve-button slot** (a disabled/placeholder "evolve" affordance) that TM-4 wires to the firing logic + cost guard. The slot renders fine empty; the running list already shows whatever runs exist. — Views ship independently; TM-4 plugs into C's slot later.

---

## Explicit answers

**(a) Create form + restyle scope.** `ProjectCreateForm.tsx` (KICKOFF `:33-46`, fields `:64-67`, create POST + paid AI flow `:6-9`), mounted only at `SectionD_ProjectBacklog.tsx:122-132`. Restyle touches that one component; engines untouched.

**(b) Queue + per-project data.** `SectionD_ProjectBacklog.tsx:142-158` (`projects.map(ProjectRow)`). status/title/etc EXIST in the row; **task count + run count MISSING from the list API** (`projects/route.ts:75` bare `findMany`, no `_count`) — add via `_count` (no migration). Run count = distinct `source_ai_usage_id`.

**(c) Running list + evolution.** Running appended list grouped by run = **already built** (`evolution/route.ts:60-151` → `EvolutionTimelineView.tsx:72-176`), tasks tagged `source_ai_usage_id` + `status` + `created_at` (`schema:2764-2785`). Summary "run N · +X tasks" EXISTS; **"goal added X" per run MISSING** — no per-run goal provenance (`goal_items` current-state only, `schema:2727`) → **migration** if required.

**(d) New components vs extend.** **New `<ProjectQueueCard>` + `<ProjectDetailView>`** composing the existing `TaskListView` + `EvolutionTimelineView`; restyle `ProjectCreateForm` in place. Keeps `ProjectRowView` + showroom stable. Restyling shared leaf views ripples to the showroom → wrap, or update showroom in the same PR.

**(e) Presentation-only + migration.** Presentation-only except: (1) the queue `_count` add (no migration), (2) **optional** per-run goal-provenance migration for the "goal added" line. No other engine/data change.

**(f) Build sequence:**
1. **PR-PD-1 — restyle the create form (SMALL).** `ProjectCreateForm` JSX → clean white pipe (KICKOFF panel + field cards). One component, no API/migration, no showroom touch.
2. **PR-PD-2 — separated queue cards (SMALL-MED).** New `<ProjectQueueCard>` in `SectionD` + add `_count.tasks` (+ distinct-run) to `projects/route.ts`. **No migration.** Card opens the detail. Keep `ProjectRowView` reachable for edit.
3. **PR-PD-3 — project detail view (MED).** New `<ProjectDetailView>` composing `TaskListView` + a pipe-restyled `EvolutionTimelineView` (running appended list grouped by run + "run N · +X tasks" summary + done/new badges). Reuse the `evolution`/`tasks` endpoints. Include the empty **evolve-button slot** for TM-4. Showroom: wrap or update in-PR.
4. **(optional) PR-PD-4 — per-run goal provenance (MED + MIGRATION).** Only if "goal added X per run" is required — structured `goal_items`/history table + populate on append.
5. **[TM-4 separate]** wires the evolve firing + cost ceiling into PD-3's slot.

### Citation index
- Tab/queue: `SectionD_ProjectBacklog.tsx:25-161` (form `:122-132`, queue `:142-158`).
- Create form: `ProjectCreateForm.tsx:33-46, 53-75`; mount `SectionD…:22, 122`.
- List API: `projects/route.ts:40-103` (no `_count`).
- Evolution: `evolution/route.ts:60-151`; `EvolutionTimelineView.tsx:22-180`.
- Tasks/schema: `operations_project_tasks` (`schema:2759-2800`, `source_ai_usage_id:2782`), `goal_items:2727`; `bulk-create/route.ts:198-216` (append).
- Pipe design tokens: `TruthMachineView.tsx` (canvas `#F4F3F8`, `border-l-4` stripes).

*Do not implement — audit only.*
