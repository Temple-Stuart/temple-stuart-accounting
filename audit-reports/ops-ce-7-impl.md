# OPS-CE-7 — Content tab restructured into Alex's 4-step pipeline

**Branch:** `claude/ops-ce-7` (off `main`)
**Date:** 2026-06-03
**One concept:** the Content tab reads top to bottom as one flat pipeline —
**1 · SOURCES** (routines + project tasks) → **2 · SCENIFY DRAFT** (inline,
multi-routine) → **3 · CONFIRMED** (PieceGrid + Daily Log) → **4 · SCRIPT OUTPUT**
(CE-5 mount point). The legacy `SectionG_Content` surface is **retired from this
page**. Per the brief + `audit-reports/ops-content-engine-audit.md`.

> ✅ **0-schema, zero new write paths.** The only writes are the existing
> `/content/scene-rows` upsert (via the draft) and the grid cell/piece routes (via
> PieceGrid/DailyLog). The multi-routine "generalization" = calling the **existing**
> enrich route once per routine. No schema, no migration, no new routes.

**DESIGN LAW:** everything on the surface — one flat page, no drawer/modal/expander
added in the diff.

---

## STEP 1 — Audit (cited)

### Current page composition (retired)
`src/app/operations/content/page.tsx` (pre-change) stacked `SectionG_Content` (the
legacy container UI — "No scenes yet" + `AvailableRoutinesList` Scenify buttons +
legacy `ContentTable` + `ScriptDrawer`) → `QuestionLibrary` → `DailyLog` →
`PieceGrid`. What `SectionG_Content` still provided that matters: the **routine list +
Scenify entry** (everything else it renders is legacy). 

### What breaks if removed — checked (don't delete shared components)
- `ContentTable` is **shared**: imported by `home/ContentPreview.tsx:23` (renders it
  with empty arrays). **Kept** — not deleted.
- `ScriptDrawer` is imported **only** by `SectionG_Content` → dead-on-this-page once
  unmounted, but left in place.
- `ScenifyModal`/`ScenifyButton` are **shared**: used by
  `routines/RoutineRow.tsx` (Routines tab). **Left fully intact** — the new draft is
  a separate component.
- `SectionG_Content` importers: only `content/page.tsx` (unmounted here) +
  `EditableCell` (type) — **file left in place, flagged dead-on-page.**

### The two source lists (read routes, cited — no new routes)
- **Routines (left):** `GET /api/operations/routines?entity_id=` (`routines/route.ts`)
  returns `routines` with active `steps` + `name` + `entity_id` → name + step count.
- **Project tasks (right):** `GET /api/operations/tasks/unscheduled`
  (`tasks/unscheduled/route.ts:32-53`) — the actionable pool (open/in_progress/
  blocked), `select { id, title, status, project: { id, title, entity_id } }`,
  user-scoped, **read-only**. Exactly title · project · status.

### Scenify flow to generalize (cited)
- `ScenifyModal` (CE-3B): single routine → `GET /routines/{id}` steps → editable shot
  table → `✨ AI suggest` POSTs `/content/enrich-routine {routine_id}` → `save scenes`
  upserts each step via `/content/scene-rows`. **Generalized** to multiple routines by
  looping the **same** per-routine calls in selection order (recordUsage stays
  per-call — clean attribution, no mega-prompt).

### 0-schema — confirmed (no STOP)
All endpoints exist; the draft reuses the scene-rows upsert. Nothing needs schema.

---

## STEP 2 — The pipeline page (built)

**New `ContentPipeline.tsx`** (the orchestrator, replaces the legacy stack on the
page) + **new `ScenifyDraft.tsx`** (the de-modalized multi-routine draft). `page.tsx`
now renders just `<ContentPipeline />`.

- **Header — truthful counts:** `{n} scenes` / `{n} answered` read the **real grid
  tables** via `GET /content/grid` (scene-rows count; cells with non-empty `script`),
  entity-filtered — the CE-4-flat truthful sources, refreshed on
  `CONTENT_SCENES_CHANGED_EVENT`.
- **1 · SOURCES** — a 2-column flat band, both lists always visible:
  - **Left routines:** each a click-to-select row with a **selection-order number
    badge** (purple), name, and step count. Selection order is tracked in an ordered
    array.
  - **Right project tasks:** read-only rows `title · project · status` (status pill),
    with a `commit on Daily Plan →` link to `/operations` (where `SectionC_DailyPlan`
    lives). Committing blocks stays there — this list is reference/import only.
- **Question library** — `<QuestionLibrary />` mounted compactly between sources and
  draft (it feeds the draft's question assignment; the brief keeps it).
- **2 · SCENIFY DRAFT** — when `selectedRoutines.length > 0`, `<ScenifyDraft>` renders
  **inline** under the sources: one combined table, the selected routines' steps in
  **selection order**, each group preceded by a purple routine separator band, the
  **# column = combined scene number** across the whole table. `✨ AI suggest`
  enriches the whole selection (per-routine enrich calls, in order); `save scenes`
  upserts every step and broadcasts the refresh. Fully editable; library-purple /
  proposed-new-amber question badges preserved.
- **3 · CONFIRMED** — `<PieceGrid />` + `<DailyLog />` under the draft.
- **4 · SCRIPT OUTPUT** — a quiet dashed structural band ("the day's answers →
  voiceover script — next (CE-5)") as the clean mount point.

**Retired:** `<SectionG_Content />` is removed from `page.tsx` (the "No scenes yet"
box, legacy `ContentTable`, its `ScriptDrawer`). **No component files deleted** —
`ContentTable` stays (home uses it); `SectionG_Content`/`ScriptDrawer`/
`AvailableRoutinesList`/`SceneHeaderRow`/`TakeRow` are now dead-on-this-page and
**flagged for a cleanup PR**.

---

## STEP 3 — Verify (cited)

- **Reads top to bottom:** header → SOURCES → QuestionLibrary → (DRAFT when selected)
  → PieceGrid + DailyLog → SCRIPT-OUTPUT placeholder. ✅
- **Legacy section gone from the page:** `page.tsx` renders only `ContentPipeline`;
  no `SectionG_Content` import. ✅
- **Multi-routine scenify → one combined ordered draft:** `ScenifyDraft` loads steps
  per selected routine in order, renders grouped rows with combined numbering, AI
  suggest loops per-routine enrich, save upserts all. ✅
- **Save lands rows in the grid:** uses the unchanged `/content/scene-rows` payload +
  dispatches `CONTENT_SCENES_CHANGED_EVENT` → PieceGrid refetches + counts refresh. ✅
- **Truthful counts:** header reads `/content/grid` scene-rows + answered cells. ✅
- **Flat law:** no modal/drawer/expander **in the diff** — `ContentPipeline` is
  stacked sections, `ScenifyDraft` is an inline table (de-modalized; the draft simply
  renders when routines are selected — the intended pipeline reveal, no hide/show
  toggle). The pre-existing `QuestionLibrary` collapse is unchanged and endorsed by
  the brief. ✅
- **0-schema; write paths = existing upsert + generalized enrich calls:** `git diff`
  has no `prisma/schema.prisma`, no `api/`. Auth unchanged. ✅
- **Home + other tabs untouched:** diff = `page.tsx` + 2 new components; `ContentTable`
  (home), `ScenifyModal`/`RoutineRow` (Routines tab) not in the diff. ✅
- **tsc:** `npx tsc --noEmit` → **exit 0**. **eslint:** → **exit 0**.

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Flat law throughout (no modal/drawer/expander in diff) | ✅ stacked sections + inline draft table |
| 0-schema | ✅ no schema change |
| No new write routes (enrich = per-routine existing calls) | ✅ reuses enrich + scene-rows + grid cell/piece |
| Don't delete shared components — unmount + flag dead code | ✅ ContentTable kept (home); legacy unmounted, flagged |
| One concept: the pipeline page; no script generation (CE-5) | ✅ step 4 is a placeholder only |
| Existing palette; tables match grid family | ✅ `border-collapse text-xs font-mono`, purple headers, `bg-bg-row`, amber badges |
| tsc + lint clean | ✅ both exit 0 |

---

## Unmounted vs deleted
- **Unmounted from the page (not deleted):** `SectionG_Content` (+ its legacy deps
  `ScriptDrawer`, `AvailableRoutinesList`, `SceneHeaderRow`, `TakeRow`).
- **Kept (shared):** `ContentTable` (home `ContentPreview`), `ScenifyModal` /
  `ScenifyButton` (Routines tab `RoutineRow`).
- **Cleanup-PR flag:** delete the now-dead content-page-only legacy files once
  confirmed unreferenced (`SectionG_Content`/`ScriptDrawer`/`AvailableRoutinesList`/
  `SceneHeaderRow`/`TakeRow`) — out of scope here (the brief says flag, don't delete).

## git diff scope
Modified: `src/app/operations/content/page.tsx`. New:
`content/ContentPipeline.tsx`, `content/ScenifyDraft.tsx` (+ this report). **No
schema, no routes, no shared-component edits.**

---

## Result
The Content tab is now Alex's pipeline on one flat page: **sources** (selectable
routines with order badges + a read-only project-task reference list) → an **inline
multi-routine scenify draft** (combined, ordered, AI-suggestable, saving to the same
upsert) → the **confirmed** PieceGrid + Daily Log → a quiet **CE-5 script-output**
mount point. Truthful scene/answer counts sit in the header. The legacy
`SectionG_Content` container UI is retired from the page (files kept, dead code
flagged; `ContentTable` preserved for the home preview). **0-schema, zero new write
paths, no AI generation**, flat law intact; tsc + eslint exit 0.
