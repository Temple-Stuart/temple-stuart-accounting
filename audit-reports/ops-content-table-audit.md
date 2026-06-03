# OPS — Content Table / Reel-Grid Audit (READ-ONLY)

**Branch:** `claude/ops-content-table-audit`
**Date:** 2026-06-03
**Mode:** READ-ONLY. Recommendations only — no implementation.
**Scope:** Map Alex's daily-reel **table** (his Excel grid) onto the existing content
schema, find the exact gap, and design the in-app **content-piece table view**
(scene-rows × piece-columns, take-cells).

> **Extends — does not redo —** `ops-content-audit.md` (the scenes/takes 1:1 substrate
> + first `operations_content_pieces` proposal) and `ops-content-evolution-audit.md`
> (the version anchor: `piece.source_ai_usage_id`, and `source_ai_usage_id` on tasks).
> **Foundation already built & verified on main:** PR-1 = `source_ai_usage_id` on
> `operations_project_tasks` (`prisma/schema.prisma:2694`, relation `:2700`, index
> `:2709`); PR-2 = the read-only evolution endpoint
> (`src/app/api/operations/projects/[id]/evolution/route.ts:1-21` — groups tasks by
> that link into `versions[]`). This audit picks up at the **table structure** the
> prior two did not dissect.

---

## 0. The crux up front: the vocabulary is INVERTED, and the cell table does not exist

Alex's grid and the codebase use the **same three words for different grains**:

| Alex's term | Alex's meaning | Closest existing table | Grain match? |
|---|---|---|---|
| **scene** (a ROW) | one stable **shot** — Scene#, Time, Activity, Camera Angle, Shot Type, B-Roll, Narrative-Purpose | `operations_content_takes` (per **routine_step**, `:2896-2913`) | ✅ this is the per-shot grain |
| **content piece** (a COLUMN) | one **day's** reel / per-day script | — (none) | ❌ **no table** |
| **take** (a CELL) | the **script for one scene on one day**; evolves day to day | — (none) | ❌ **no table** |

And the codebase's own `operations_content_scenes` (per **routine**, `routine_id @unique`
`:2877`) is **not** Alex's scene-row — it is a per-routine **shot-list container** (one
`scene_number` per routine). So:

- **Codebase "scene" (per routine)** ≈ Alex's reel **section header** (the routine).
- **Codebase "take" (per step)** ≈ Alex's **scene ROW** (the stable shot).
- **Alex's "take" (the per-day script cell)** = **a concept with NO table today.**

Today a script is a **single** `Text` field on the per-routine scene
(`operations_content_scenes.script`, `:2883`; the Scenify modal's "script (optional)",
`ScenifyModal.tsx:191`). There is **one script per routine-scene, not one per day** — so
the per-day **evolution** Alex's cells need has nowhere to live. This is the central gap;
everything below follows from it.

---

## 1. Scene fields vs Alex's columns — the exact gap

Alex's **scene-row** columns map to the per-step grain (codebase "take" + its
`routine_step`), **not** to `operations_content_scenes`:

| Alex scene column | Where it lives today | Status |
|---|---|---|
| **Scene# / order** | `operations_content_scenes.scene_number` (`:2878`, per routine) / `operations_routine_steps.step_order` (`:2835`, per shot) | ✅ exists (routine grain; per-shot uses `step_order`) |
| **Time** | `operations_routine_steps.time_of_day` (`:2836`) | ✅ exists — at **step** grain (displayed via `formatTime`, `ContentTable.tsx:93-96`) |
| **Activity** | `operations_routine_steps.activity` (`:2837`) (+ `sub_activity` `:2838`) | ✅ exists — at **step** grain |
| **Camera Angle** | `operations_content_takes.filming_angle` (`:2903`) (+ `camera_needed` `:2902`) | ⚠️ exists but on the **take** — correct grain (per shot), but see §2: the take must split into stable-row vs per-day-cell |
| **Shot Type** | — | ❌ **MISSING** |
| **B-Roll** | — | ❌ **MISSING** |
| **Narrative-Purpose** ("what this captures/says") | closest: `scenes.scene_title` (`:2879`) / `focus_category` (`:2880`) | ❌ **MISSING** — neither is "what this shot captures/says" |

> Note the **14-col `ContentTable` headers** (`ContentTable.tsx:113-128`):
> `Scene/Title/Focus/Hours/Day/Loc(Base)/Time/Activity/Sub-Activity/Loc(Specific)/Camera/Angle/Notes/Script`.
> It carries **Camera + Angle** but has **no Shot-Type, no B-Roll, no Narrative-Purpose**
> column — confirming the same three-field gap at the UI layer.

**Exact scene-schema gap:** add **`shot_type`**, **`b_roll`**, **`narrative_purpose`** as
stable per-shot columns (Camera/Angle already exist on the take; Time/Activity already
exist on the routine_step and are displayed, not duplicated).

---

## 2. Take fields vs the per-day script — what must change

`operations_content_takes` (`:2896-2913`) holds: `filming_location_specific` (`:2901`),
`camera_needed` (`:2902`), `filming_angle` (`:2903`), `notes` (`:2904`). Two hard facts:

1. **A take holds no script.** There is **no `script` column** on the take. The only
   script is the per-routine `scenes.script` (`:2883`). So a take cannot be Alex's cell
   (which *is* the per-day script).
2. **A take is 1:1, locked to a step.** `routine_step_id String @unique` (`:2900`) +
   the 1:1 relation (`routine_steps.content_take`, `:2847`). A step can have **exactly
   one** take — so a scene **cannot** have multiple takes (one per day/piece). The grid's
   cells are impossible under this constraint.

**What changes so a take becomes the per-scene-per-piece cell:** the take must split into
two grains —

- **Stable SHOT ROW** (Alex's "scene", 1 per step): the unchanging shot setup —
  `camera`/`camera_angle`/`shot_type`/`b_roll`/`narrative_purpose`/`loc_specific`. This
  is what the existing per-step take already is (minus the 3 missing fields, §1).
- **Per-day CELL** (Alex's "take", many per shot — one per piece/day): holds the
  **evolving `script`** for that shot on that day. Keyed `(shot_row, piece)` with
  `@@unique([…, piece_id])` so each shot has **one script per day** but **many days**.

So the change is: **keep the per-step record as the stable row, and introduce a NEW
per-(row × piece) record that carries the day's `script`.** (The 1:1 `@unique` on the
stable row stays; the new cell table is what multiplies per day.)

---

## 3. The piece entity (refined) + how piece / scene / take relate

The prior audits' `operations_content_pieces` is **confirmed** and carries (from
`ops-content-evolution-audit.md` B5): `piece_date Date` (the day anchor), `project_id?`
(subject), **`source_ai_usage_id?`** (the immutable re-run it documents — the version
anchor, so a reel still means "Day 2" after the project design is overwritten;
`evolution/route.ts:4-12`), `title`, `status`, `script`/`notes`.

**Refinement this audit adds — scene↔piece is MANY-to-MANY, realized by the cell:**
the prior audit proposed a single `piece_id` FK **on the scene** ("a scene belongs to ≤1
piece"). That models *bundling* (which routines were filmed in one reel) — but it is
**wrong for the grid**: in Alex's table a single stable shot-row **recurs across every
day-column**, scripted differently each day. A scene-row is therefore in **many** pieces,
not one. The M:N is realized by the **cell table** `(shot_row × piece)`, not a scalar FK.

```
piece (day column)  ─┐
                     ├─ cell = (shot_row × piece) → script   ← Alex's "take"
shot_row (per step) ─┘                                          (the evolving day-cell)
        ▲
        └─ belongs to a routine-scene (the shot-list container, operations_content_scenes)
```

- **piece : shot_row** = many-to-many, via the **cell**.
- **shot_row : routine_step** = 1:1 (the stable row, today's take grain).
- **routine-scene : shot_rows** = 1:many (a routine's container holds its step-rows).
- **piece : project / version** = `project_id` + `source_ai_usage_id` (evolution audit).

---

## 4. The in-app table view — extend `ContentTable` or build new?

**`ContentTable` (`ContentTable.tsx:130-206`) is structurally NOT Alex's grid.** It renders
**vertically**: `orderedScenes.map(... SceneHeaderRow + one TakeRow per step ...)`
(`:171-201`), with **fixed FIELD columns** (`HEADERS`, `:113-128`) and a **single "Day"
value** derived from the routine's RRULE (`formatDay`, `:74-90`) — there is **no
per-day/per-piece column axis at all.** It is a *shot-list field editor*, one scene at a
time.

Alex's table is a **pivot**: **fixed scene-metadata columns on the left** (Scene#, Time,
Activity, Camera Angle, Shot Type, B-Roll, Narrative-Purpose) **+ dynamic piece columns on
the right** (one per day), each cell = that shot's script for that day.

**Recommendation: BUILD A NEW pivoted component** (`PieceGrid` / `ReelTable`), **reusing
`ContentTable`'s primitives** rather than reshaping it:

| Reuse from existing | For |
|---|---|
| `SceneHeaderRow` / `TakeRow` inline-edit idiom (`ContentTable.tsx:185-197`) | the left fixed scene-metadata cells |
| `ScriptDrawer` (script editor, `SectionG_Content.tsx`, `onScriptClick` `:151`) | editing a day-cell's script |
| `formatTime` / `formatDay` / `dashOrValue` (`:92-111`) | rendering helpers |
| the `font-mono` spreadsheet language (`:159-160`) | visual consistency |

Keep `ContentTable` as the **single-scene definition editor**; the **grid is the new
multi-day view** (scenes × pieces). The grid is closest to Alex's Excel table; the current
`ContentTable` is closest to a per-routine shot-list editor. (Two surfaces, shared cells.)

---

## 5. Routine → scene-row population

Today the shot list is built by two manual actions (no auto-from-routine):

- **Scenify** (per routine): `ScenifyButton.tsx` → `ScenifyModal.tsx` → POST
  `/api/operations/content/scenes` with `scene_number`/`scene_title` (+ optional
  `focus_category`/`filming_location_base`/`estimated_hours`/`script`,
  `ScenifyModal.tsx:63-68,191`). Lists only routines with `!content_scene`
  (`AvailableRoutinesList.tsx`).
- **Takeify** (per step): `TakeifyButton.tsx` → **bare** POST `{routine_step_id}` to
  `/content/takes` (details filled later inline).

**Recommendation:** make **Scenify generate the shot-ROWS from the routine's STEPS** —
one stable row per `operations_routine_steps` (ordered by `step_order` `:2835`), Time +
Activity pre-filled from the step (`:2836-2837`), and the shot fields
(camera_angle/shot_type/b_roll/narrative_purpose) blank to fill. This makes the shot list
**build from Alex's actual routine** in one action instead of per-step Takeify clicks. The
existing Takeify becomes the "add one shot row" fallback. (The per-routine
`operations_content_scenes` row stays as the section container.)

---

## 6. Project → scene / version link

For **work shots that reference a project**, the link is at the **piece** level (per
`ops-content-evolution-audit.md` B5): `piece.project_id` (which project) +
`piece.source_ai_usage_id` (which **re-run/version** it documents — the immutable
`operations_ai_usage` snapshot, so the reel keeps meaning "Day 2 of the project, tasks
3–5" even after the project's design is later overwritten — last-write-wins on the project
fields, evolution audit A3). The narrative "tasks 3–5 added by re-run N" is then a single
indexed query over `operations_project_tasks WHERE source_ai_usage_id = piece.source_ai_usage_id`
— the column PR-1 already added (`schema.prisma:2694`), consumed by the PR-2 evolution
endpoint.

**Optional finer link (flag):** a per-row `project_task_id?` on the shot-row, for a single
work-shot that documents one specific task — vs. the piece-level link that documents the
whole project/version. The prior audit's `operations_content_project_items` join
(piece → projects) remains the home for project-as-content substance. **Recommend
piece-level link as the default; per-row task link only if Alex wants shot↔task precision.**

---

## 7. Schema delta + build sequence

### Exact schema delta (this audit, mostly ADDITIVE)

| # | Change | Table | Kind |
|---|---|---|---|
| D1 | ADD `shot_type VarChar`, `b_roll Text`, `narrative_purpose Text` (the missing stable scene-row columns, §1) | `operations_content_takes` (the per-step stable row) | **ALTER** (3 cols) |
| D2 | CREATE the **day COLUMN**: `operations_content_pieces` (`piece_date Date`, `title`, `status`, `project_id? FK`, `source_ai_usage_id? FK`, `script/notes`, user/entity) | new | **CREATE** (overlaps prior PR-3; confirmed) |
| D3 | CREATE the **CELL** (Alex's "take"): `operations_content_take_scripts` — `id`, user/entity, `take_id FK` (the stable row), `piece_id FK` (the day), **`script Text`**, `status?`, timestamps, `@@unique([take_id, piece_id])` (one script per shot per day) | new | **CREATE** (NEW — prior audits never modelled a per-cell script) |
| D4 | (prior) CREATE `operations_content_project_items` (piece → projects substance) | new | **CREATE** (prior PR-2/3) |
| D5 | Migrate the legacy single `scenes.script` (`:2883`) into Day-1 cells; thereafter `scenes.script` = template/default only | data | **BACKFILL** |

> **Vocabulary sign-off (naming):** if Alex insists **"take" = the cell**, rename at
> build time — the per-step stable row → `operations_content_shots` (or keep `takes` but
> document it as the *row*), and D3 → `operations_content_takes`. The **data shape is the
> same**; only labels differ. Decide before D1 to avoid a later rename migration.

### Build sequence (one concept per PR) — dovetails the prior PR-1/PR-2 (built)

| PR | Concept | Schema |
|---|---|---|
| **TABLE-PR-1** | Stable scene-row fields: ALTER `content_takes` ADD `shot_type`/`b_roll`/`narrative_purpose`; surface in `TakeRow`/`ContentTable` + Scenify-from-steps (§5) | **ALTER** (D1) |
| **TABLE-PR-2** | The **piece** (day column): `operations_content_pieces` (D2) + "create a piece for `piece_date`" UX; carries `project_id` + `source_ai_usage_id` (§3, §6) | **CREATE** (D2) |
| **TABLE-PR-3** | The **cell**: `operations_content_take_scripts` (D3) + backfill legacy script (D5) — the per-day evolving script | **CREATE + BACKFILL** (D3,D5) |
| **TABLE-PR-4** | The **grid view** — new pivoted `PieceGrid` (scene-rows × piece-columns, cells = take-scripts), reusing `ContentTable` primitives + `ScriptDrawer` (§4) | **0 schema** |
| **(prior)** | `operations_content_project_items` + workspace + read-only narrative/evolution view (`ops-content-evolution-audit.md` PR-2/PR-4) | per that audit |

### Migration discipline — FLAGS (carried + reinforced)

- **Dual-write:** every schema PR moves **`prisma/schema.prisma` + a raw SQL migration in
  parallel** — Alex applies migrations via **`psql`**, not `prisma migrate` (this repo's
  flow). Confirmed pattern: existing `prisma/migrations/*/migration.sql` are hand-authored
  raw SQL (e.g. `20260508000000_pr_ops_1_5_north_star/migration.sql`).
- **ALTER-before-merge ordering (learned):** the **column must exist in Azure before the
  code that reads it deploys.** So for D1/D2/D3: run the `ALTER`/`CREATE` in Azure **first**,
  confirm, **then** merge the PR whose code reads the new column/table. Never merge
  read-code ahead of the migration.
- **Cell table is the only re-grain risk:** D3 changes where "script" lives (scene → cell).
  Keep `scenes.script` readable during the transition (D5 backfills Day-1 cells; the column
  is deprecated, not dropped, until the grid is the sole script surface).

---

## Sign-off items (decisions for Alex)

1. **Vocabulary** — confirm the inverted mapping (§0): codebase "take" (per step) = your
   **scene ROW**; your **"take"** = the **new per-day cell** (`take_scripts`). Pick the
   final table names **before TABLE-PR-1** (rename later = extra migration).
2. **Missing scene columns** (§1) — confirm `shot_type`, `b_roll`, `narrative_purpose` are
   the gap (Camera/Angle already exist on the take; Time/Activity on the routine_step).
3. **Per-day cell** (§2, §3) — confirm the script becomes **per-(shot × piece)** (many
   takes per shot, one per day) via a new cell table — vs. today's single `scenes.script`.
4. **Scene↔piece is M:N** (§3) — confirm the grid recurs a shot across every day-column
   (cell table), **superseding** the prior audit's scalar `piece_id`-on-scene (which was
   for bundling, not the grid).
5. **Grid = new component** (§4) — confirm building a new pivoted `PieceGrid` (reusing
   `ContentTable` primitives) rather than reshaping the vertical `ContentTable`.
6. **Scenify-from-steps** (§5) — confirm Scenify should auto-generate one shot-row per
   routine step (Time/Activity prefilled), vs. keeping per-step Takeify.
7. **Project link grain** (§6) — confirm **piece-level** `project_id` + `source_ai_usage_id`
   (version anchor) as default; per-row `project_task_id` only if shot↔task precision is
   wanted.
8. **Sequence + migration** — confirm TABLE-PR-1 (ALTER) → PR-2 (piece) → PR-3 (cell +
   backfill) → PR-4 (grid); dual-write prisma + raw SQL; **ALTER in Azure before merging
   read-code**; Alex runs `psql`.

---

**READ-ONLY audit. No implementation performed.** All schema items are
**recommendations**; any build PR moves prisma + raw SQL in parallel, applies the
ALTER/CREATE in Azure first, and Alex runs the `psql` migration.
