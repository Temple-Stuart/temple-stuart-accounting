# OPS-CE-4-flat — flat Daily Log + in-place grid cells + truthful badges (everything visible)

**Branch:** `claude/ops-ce-4-flat` (off `main`; finishes WIP `5adeb8fd`)
**Date:** 2026-06-03
**Design law:** EVERYTHING ON THE SURFACE — no drawers/modals/panels/expanders,
no collapse/expand, no "tap to reveal." A cell = Alex's **answer** to the scene's
question, edited inline. Carries over the CE-4 audit (0-schema; reuses
`POST /content/grid/cell` + `/content/grid/piece`; the grid GET already returns
`assigned_question_text`/`narrative_purpose`/`b_roll` via `include`).

> ✅ **0-schema, zero new write paths, no AI.** The answer is the take's existing
> `script` column. This pass = compile fixes + mount DailyLog + truthful badges +
> flat-law verification.

---

## 1. tsc FIRST — errors found + fixed

`npx tsc --noEmit` on the WIP (`5adeb8fd`) → **exit 0** already: the WIP compiled.
- **`fmtDate` (feared unused):** still used in PieceGrid's day-column header
  (`fmtDate(p.piece_date)`), so not dead — no error.
- **Inline-edit wiring:** `editing`/`draft`/`commitEdit`/`startEdit`/`escRef`
  typed and consistent — no error.
- Net: **0 tsc errors found**; no compile fixes were needed. (Verified again after
  the badge + mount changes below: still exit 0.)

## 2. DailyLog mounted (was built, never mounted)

`src/app/operations/content/page.tsx` — added the import + render:
```diff
 import QuestionLibrary from '@/components/workbench/operations/content/QuestionLibrary';
+import DailyLog from '@/components/workbench/operations/content/DailyLog';
 ...
       <QuestionLibrary />
+      <DailyLog />
       <PieceGrid />
```
**Mount proof:** `grep DailyLog src/app/operations/content/page.tsx` → import (line
16) + `<DailyLog />` (line 22).

## 3. Truth badges → real grid tables (cited)

**The lie (cited):** `SectionG_Content`'s badges read the legacy GETs —
`/api/operations/content/scenes` reads `operations_content_scene_groups`
(per-routine CONTAINER; `scenes/route.ts:44`), and `/api/operations/content/takes`
reads `operations_content_scenes` (the scene-ROWS, misnamed; `takes/route.ts:45`).
So "scenes" counted scene_groups (Alex's 4 scene-rows showed as **0 scenes**) and
"takes" counted scene-rows, not answered cells.

**The fix:** `SectionG_Content` now also fetches `/api/operations/content/grid` and
the badges read the **real grid tables**, filtered by the entity selector:
- **scenes** = scene-ROW count = `grid.scenes` (`operations_content_scenes`).
- **takes** = ANSWERED-cell count = `grid.cells` (`operations_content_takes`) with a
  non-empty `script`.

```diff
-  <span className={badgeClass}>{filteredScenes.length} scenes</span>   // scene_groups (lie)
-  <span className={badgeClass}>{filteredTakes.length} takes</span>     // scene_rows (lie)
+  <span className={badgeClass}>{sceneRowCount} scenes</span>          // operations_content_scenes
+  <span className={badgeClass}>{answeredCellCount} takes</span>       // answered operations_content_takes
   <span className={badgeClass}>{filteredRoutines.length} routines</span>
```
`sceneRowCount` / `answeredCellCount` are computed from `gridSceneRows` /
`gridCells` (new props threaded from the page-level fetch), filtered by
`entityFilter`. The legacy table below still renders its own data — only the
headline counters were repointed to the truth.

## 4. Flat-law verification (the FINAL state)

**CE-4 answering surfaces — 100% flat, no hidden state:**
- **DailyLog** (`DailyLog.tsx`) — a single flat `<table>`: one row per active scene,
  columns `# · Activity(+time) · Question · B-Roll · Answer` **all always
  rendered**. The Answer column is an **always-present inline `<textarea>`** with a
  per-row **Save** button + visible state (`Saving…` / `✓ saved` / error). An
  `n of m answered` line sits above. **No expand/collapse, no "tap to answer."**
  (The only `collapse` token is the `border-collapse` CSS class; the only "expand"
  is a comment saying nothing expands.)
- **PieceGrid** (`PieceGrid.tsx`) — cells edit **IN PLACE**: clicking a cell turns
  it into a `<textarea>` where it sits (no drawer/panel); **blur saves, Esc
  cancels** (`escRef` guards the blur), `Cmd/Ctrl+Enter` saves; `saving…`/error
  visible in-cell. The scene's **question is always rendered in its row cell**
  (purple, under the activity/shot line) so it stays on the surface while
  answering. The old `ScriptDrawer` import + `active` drawer state were **removed**
  from PieceGrid.

**⚠️ Pre-existing hidden-state UI still on the Content tab (NOT in this concept —
flagged for sign-off, not silently passed):**
1. **Legacy `ScriptDrawer` + `SectionG_Content`** — the legacy field-list
   `ContentTable` still opens a `fixed right-0` **drawer** to edit the legacy
   scene_group `script` (`ScriptDrawer.tsx:85`; `SectionG_Content.tsx:42,186,228`).
   This is a genuine drawer in the content surface. It is **superseded** by the grid
   + DailyLog and was also the source of the lying badges. **Recommend a follow-up
   to retire the legacy `SectionG_Content`/`ContentTable`/`ScriptDrawer` entirely.**
   (Not removed here: ripping out the legacy table is beyond "finish the WIP" and
   would need its own PR.)
2. **`ScenifyModal` (via `ScenifyButton`)** — an **inline** expanding form revealed
   by a button toggle (`setOpen`). It is inline (not an overlay; CE-3B reshaped it
   to an inline table), but it is reveal-on-click. It's the Stage-1 Scenify entry,
   not the answering flow.
3. **`QuestionLibrary`** — a collapsible "manage" section (`setOpen`, CE-3).

**My diff adds ZERO hidden-state UI** (hard constraint: "no drawer/modal/panel/
expander anywhere in this diff" — satisfied; I removed one drawer and added two flat
tables). Items 1–3 are pre-existing and flagged for a flattening follow-up.

## 5. Verify — exit codes

- **tsc:** `npx tsc --noEmit` → **exit 0** (my files clean).
- **eslint:** `npx eslint PieceGrid DailyLog SectionG_Content page` → **exit 0**.
- **0-schema:** no `prisma/schema.prisma` in the diff.
- **Zero new write paths:** no `api/` files in the diff; reuses
  `/content/grid/cell` + `/content/grid/piece` + reads `/content/grid`.

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| No drawer/modal/panel/expander **in this diff**; inline only | ✅ removed PieceGrid's ScriptDrawer; DailyLog + grid cells are flat/inline |
| Labels say ANSWER | ✅ "+ answer", "your answer", "Save answer", "answered" |
| No AI calls (CE-5) | ✅ no recordUsage/AI in diff |
| 0-schema; zero new write paths | ✅ `take.script` storage; reused routes |
| Truthful badges point at real grid tables | ✅ scenes=scene-rows, takes=answered cells (cited) |
| Existing palette + contrast standard | ✅ `brand-purple`/`bg-bg-row`/`border-border-light`/`font-mono`, grid family |
| tsc exit 0 + eslint clean | ✅ both exit 0 |

**Flag for sign-off:** the legacy `SectionG_Content`/`ContentTable`/`ScriptDrawer`
still carries a real drawer (item 1). To fully satisfy the flat law on the content
tab, retire that legacy surface in a follow-up — recommended, since the grid +
DailyLog supersede it.

## git diff scope
New: `content/DailyLog.tsx`. Modified: `content/PieceGrid.tsx` (in-place cells +
always-visible question, ScriptDrawer removed), `content/SectionG_Content.tsx`
(truthful badges via grid fetch), `app/operations/content/page.tsx` (mount
DailyLog). **No schema, no routes.**

---

## Result
The answering experience is flat and fully on the surface: **DailyLog** is a single
always-visible table (one row per scene; the answer is an inline textarea with a
per-row Save + visible state; `n of m answered` above), and **PieceGrid** cells edit
in place (blur saves, Esc cancels) with each scene's **question always rendered in
its row**. The Content header **badges now tell the truth** — scenes = scene-row
count, takes = answered-cell count, read from the real grid tables. **0-schema, zero
new write paths, no AI**; tsc + eslint exit 0. One honest flag: the legacy
`SectionG_Content` table still uses a drawer — recommended for retirement in a
follow-up so the whole tab obeys the flat law.
