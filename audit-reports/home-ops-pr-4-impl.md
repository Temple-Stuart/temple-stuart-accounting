# HOME-OPS-PR-4 — Real project form + empty task table on home (fetch-free, AI hard-gated)

**Branch:** `claude/home-ops-pr-4`
**Date:** 2026-06-02
**Scope:** Replace the **fabricated** "Make a project" panel (01) in
`OperationsShowroom` with the **REAL** 5-step project input form + the real task
output table rendered **empty**, extracted **fetch-free**, with **every** action
gated to the login modal. **HARD SECURITY LINE:** the two paid AI buttons
(generate-design, generate-tasks) route to `onRequireAuth` and **NEVER fetch** — a
logged-out visitor cannot trigger a paid AI call. ONE concept — the Project panel
only. 1 new component + `OperationsShowroom.tsx`. **0 endpoint, 0 schema, 0 deps.**

> Mirrors HOME-OPS-PR-1's fetch-free extraction (RoutineCreateForm — grep-proven no
> fetch, submit→`onRequireAuth`). `SectionD_ProjectBacklog` is the **only paid
> surface** on the showroom, so this PR carries the hard line.
>
> **Branch state note:** on `main` today only HOME-OPS-PR-1 (routine, panel 02) is
> merged; HOME-OPS-PR-2 (evolution, 04) and HOME-OPS-PR-3 (content, 03) are on their
> own branches. So **this PR retires panel 01's fabrication**; panels 03/04 here
> remain their pre-existing sample-data until their PRs merge. Full retirement of all
> fabricated showroom content completes once PR-2/PR-3/PR-4 are all merged.

---

## STEP 1 — Audit (cited)

- **Real project surface** (`SectionD_ProjectBacklog.tsx`):
  - **Fetch on mount** — `useEffect:267-270` → `fetchProjects()` → `fetch('/api/operations/projects…')` `:252`; plus `useOperationsEntity()` `:35` (the `EntitySelector` context fetches `/api/entities`); plus child `TaskList`/`EvolutionTimeline` fetches. All omitted here.
  - **Real 5-step INPUT form** `:344-578`: title `:355`, entity select `:366`, target date `:381`, **goal/problem/diagnosis** via the real `ListManager` `:392/402/413`
    (verb prefixes "I WANT to " / "I HAVE NOT "+"I KEEP " / "Because "+"The root cause is "), **design** `:435` with the "↑ generate plan" button `:425-433`, est minutes/cost `:510/520`, and the buttons "create project" `:531-538` + "↑ preview tasks" `:539-547`.
  - **The TWO paid AI call sites (the hard line):**
    - **generate-design** — `handleGenerateCreateDesign` onClick `:427` → `fetch('/api/operations/ai/generate-design')` **`:93`**.
    - **generate-tasks** — `handleGenerateTasksPreview` onClick `:541` → `fetch('/api/operations/ai/generate-tasks')` **`:154`**.
  - **Real task OUTPUT table:** the project's task list (step 5 · execute) — `ProjectRow` `:590-604` → `TaskList`/`TaskRow` (index · title · status · due).
- **`ListManager` is fetch-free** (pure list editor; `grep` → no `fetch`/`/api/`/`useEffect`) — reusable here exactly as PR-1 reused `RRULEBuilder`.
- **Fetch-free pattern mirrored** — `RoutineCreateForm.tsx` (HOME-OPS-PR-1): no `useEffect`/`fetch`; gated actions → `onRequireAuth`.
- **Fabricated panel 01 replaced** — `OperationsShowroom.tsx` panel `step="01"` rendered the "Apply for SBA microloan" 5-line glimpse + `SAMPLE_TASKS` list. That block (and the now-dead `SAMPLE_TASKS`/`PILL`/`SamplePill`) is removed.

## STEP 2 — Build (real 5-step form + empty task table, AI hard-gated)

**New `src/components/home/ProjectCreateForm.tsx`** — the extracted, fetch-free
project surface:
- **No fetch anywhere:** no `useEffect`, no `fetch`, no `/api/`, and crucially **no
  generate-design / generate-tasks**. A single `gate()` helper (`:45-46`) calls
  `onRequireAuth()`.
- **Real 5-step inputs, local state only:** holds a `ProjectForm`
  (`DEFAULT_PROJECT_FORM`); renders title, entity (neutral disabled placeholder —
  **no `/api/entities` fetch**), target date, the **real `ListManager`** for
  goal/problem/diagnosis (verb prefixes verbatim from SectionD), the design section
  with a gated "↑ generate plan → log in", est minutes/cost.
- **HARD LINE — every action gates, none fetch:** the **generate plan** button
  (`:122`), **create project** (`:162`), and **preview tasks** (the generate-tasks
  trigger, `:169`) all `onClick={gate}` → `onRequireAuth()`. The paid AI endpoints
  are unreachable from this component.
- **Real task OUTPUT structure, EMPTY:** a "5 · execute (tasks)" table with the real
  columns (# · Task · Status · Due) and an empty-state row "Your tasks appear here
  once you generate or add them — after you log in." No data, no fetch.

**`OperationsShowroom.tsx` wiring:**
- `import ProjectCreateForm` (top).
- Panel 01 → `<ProjectCreateForm onRequireAuth={onRequireAuth} />`; `action` prop
  dropped (the form carries its own gated buttons).
- **Dead fabricated helpers removed** (grep-confirmed used only by panel 01):
  `SAMPLE_TASKS`, `PILL`, `SamplePill`. `SAMPLE_VERSIONS` is **kept** (panel 04 still
  uses it on this branch).
- Header comment updated.
- **Design:** the panel adds no purple band; the module card's single
  `bg-brand-purple/80` band (`ModuleLauncher`) stays the only purple. One-purple-per-
  card preserved.

## STEP 3 — Verify (security-critical, cited)

- **Panel 01 = the REAL 5-step form + real empty task table; fabricated content gone.**
  It renders `<ProjectCreateForm>`; the "Apply for SBA microloan"/`SAMPLE_TASKS` block
  is removed.
- **grep proof (HARD LINE) — no fetch / `/api/` / generate-design / generate-tasks:**
  `grep -nE "fetch|axios|/api/|generate-design|generate-tasks|useEffect"
  ProjectCreateForm.tsx ListManager.tsx` → matches are **comment lines in
  ProjectCreateForm only**; **zero in code**, and **zero in ListManager**. The three
  action buttons (`:122/:162/:169`) all `onClick={gate}`; `gate` (`:45-46`) calls
  `onRequireAuth()` only. **No paid AI call is reachable logged-out.**
- **Logged-out fires ZERO server calls (especially zero AI):** no network code on any
  render or submit path; `ListManager` is pure. Safe by construction.
- **Panels 02/03/04 UNCHANGED:** `grep 'step="0[1234]"'` confirms panel 02 (real
  routine), 03 (content), 04 (evolution) intact — only panel 01 changed.
- **Real /operations Projects surface + other 5 modules UNTOUCHED:** `git diff
  --name-only` = `OperationsShowroom.tsx` only (+ the new component + report);
  `SectionD_ProjectBacklog`/`ListManager`/the `/operations` workbench/`ModuleLauncher`
  are **not** in the diff (`ListManager` is imported, not modified).
- **One purple band per card; alternating bands preserved:** the showroom adds no
  band; `ModuleLauncher`'s section band + alternating backgrounds unchanged.
- **Fabrication retirement:** panel 01's fabricated data + the now-dead
  `SAMPLE_TASKS`/`PILL`/`SamplePill` are removed (grep zero-other-use confirmed).
  Panels 03/04 here remain sample-data until PR-3/PR-2 merge; once all four HOME-OPS
  PRs land, the showroom carries no fabricated data.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| HARD LINE: no paid AI call possible logged-out (generate-design + generate-tasks → onRequireAuth, never fetch) | ✅ grep: 0 fetch/AI in code; all 3 buttons → `gate` → `onRequireAuth` |
| Real form + real empty task table; no fabricated data; no fetch on mount | ✅ real 5-step + real `ListManager`; empty task table; no `useEffect`/`fetch` |
| Touch ONLY panel 01; don't touch real surfaces or other panels/modules | ✅ diff = `OperationsShowroom.tsx` + new component; panels 02/03/04 + real surfaces unchanged |
| Dead fabricated helpers removed only after grep zero-other-use | ✅ `SAMPLE_TASKS`/`PILL`/`SamplePill` removed (only-panel-01 use); `SAMPLE_VERSIONS` kept (panel 04) |
| 0 endpoint, 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint (new + changed) | ✅ `ProjectCreateForm.tsx` + `OperationsShowroom.tsx` → 0 problems |
| git diff scoped | ✅ `OperationsShowroom.tsx` + `ProjectCreateForm.tsx` (+ this report) |

---

## Result
The home showroom's **Make a project** panel is now the **real** 5-step input form —
title, entity, target date, the real `ListManager` goal/problem/diagnosis lists, the
design section, est minutes/cost — above the **real task table rendered empty** (# ·
Task · Status · Due), extracted **fetch-free** by reusing the real, pure `ListManager`
(as PR-1 reused `RRULEBuilder`). **The hard security line holds:** the two paid AI
buttons (generate plan / preview tasks) and create all call `onRequireAuth` and
**never fetch** — there is no `generate-design`/`generate-tasks`/`fetch` anywhere in
the new code (grep-proven), so a logged-out visitor cannot fire a paid AI call. Panels
02/03/04, the real `/operations` Projects surface, and the other 5 module sections are
untouched; the now-dead `SAMPLE_TASKS`/`PILL`/`SamplePill` are removed;
one-purple-per-card + alternating bands preserved. tsc + lint clean; diff scoped to
the showroom + the new project-form component.
