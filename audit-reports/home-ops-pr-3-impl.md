# HOME-OPS-PR-3 — Real content table structure on home (fetch-free, gated)

**Branch:** `claude/home-ops-pr-3`
**Date:** 2026-06-02
**Scope:** Replace the **fabricated** "Create content" panel (03) in
`OperationsShowroom` with the **REAL** content surface that exists today — the
genuine 14-column `ContentTable` rendered **empty** + the real badge/entity-filter
row + the real "No scenes yet" empty state — extracted **fetch-free**, with the
create action gated to the login modal. ONE concept — the Content panel only; panel
01 stays sample-data; panels 02/04 untouched. **Only what's BUILT is shown — the
not-yet-built content workspace/piece grouping is NOT invented.** **Safe by
construction: no fetch on mount, no server call logged out.** 1 new component +
`OperationsShowroom.tsx`. **0 endpoint, 0 schema, 0 deps.**

> Mirrors HOME-OPS-PR-1/PR-2 (RoutineCreateForm / EvolutionPreview — grep-proven
> fetch-free, gate→`onRequireAuth`). The real `SectionG_Content` self-fetches 4
> endpoints on mount, so its structure is reproduced here without the fetch — reusing
> the real, fetch-free `ContentTable` exactly as PR-1 reused the real `RRULEBuilder`.

---

## STEP 1 — Audit (cited)

- **Real content INPUTS / surface** (`SectionG_Content.tsx`):
  - **Fetch on mount** — `useEffect:40-84` → **4 parallel** fetches:
    `/api/operations/content/scenes` `:46`, `/api/operations/content/takes` `:47`,
    `/api/operations/routines` `:48`, `/api/entities` `:49`. This is the load to omit.
  - **Real inputs:** the badge row (`N scenes · N takes · N routines`) `:292-294`
    (`badgeClass` `:285-286`) + the **entity filter** select `:296-308`; the create
    flow is **Scenify a routine** (per-routine `ScenifyButton` → `ScenifyModal` POST
    `/content/scenes`) surfaced via the empty state + `AvailableRoutinesList`.
  - **Real empty state** `:311-321`: a centered "🎬 / No scenes yet / Pick a routine
    below to start filming" block.
- **Real content OUTPUT table** (`ContentTable.tsx`): the **14-column** spreadsheet
  — `HEADERS:113-128` = Scene · Title · Focus · Hours · Day · Loc (Base) · Time ·
  Activity · Sub-Activity · Loc (Specific) · Camera · Angle · Notes · Script
  (`:158-205`). With **empty `scenes`** it renders just the `<thead>` (real columns)
  and an empty `<tbody>`.
- **Presentational vs data:** `ContentTable` is **fetch-free** — it takes
  `scenes/takes/routines` + handlers as **props** (`:130-152`); the only content
  fetches live in `SectionG_Content`. So rendering `<ContentTable scenes={[]} …/>` is
  the genuine built output structure, fetch-free.
- **What's BUILT today vs not:** the 14-column `ContentTable` + scenify-from-routine
  flow + the badge/filter row **exist**. The content **workspace** (routines queue +
  projects queue + content list) and the **piece** grouping are **not built** (the
  open OPS-CONTENT engine work) — so they are **not** shown here.
- **Fetch-free pattern mirrored** — `RoutineCreateForm.tsx` (HOME-OPS-PR-1): no
  `useEffect`/`fetch`; gated action → `onRequireAuth`.
- **Fabricated panel 03 replaced** — `OperationsShowroom.tsx` panel `step="03"`
  rendered an invented "Day 2 reel · draft · 8 routines/2 projects · find the story"
  (the **unbuilt** piece concept). That block is removed.

## STEP 2 — Build (real content structure, fetch-free)

**New `src/components/home/ContentPreview.tsx`** — the real built surface, fetch-free:
- **No fetch anywhere:** no `useEffect`, no `fetch`, no `/api/`.
- **Reuses the REAL `<ContentTable>`** with empty arrays (`scenes={[]} takes={[]}
  routines={[]}` + no-op handlers) → the genuine 14 columns, zero rows. `ContentTable`
  is itself fetch-free, so this is the actual built component, not a re-fabrication.
- **Reproduces the real badge row + entity filter** (`SectionG:288-309`) zeroed
  (`0 scenes · 0 takes · 0 routines`) with the filter disabled at neutral "All
  entities" — **no `/api/entities` fetch** (logged-out has no entity list).
- **Reproduces the real empty state** (`SectionG:311-321`): "🎬 / No scenes yet /
  Scenify a routine to start filming — after you log in."
- **Shows only what's built:** no workspace/piece grouping invented; a caption notes
  scenes & takes populate the table once a routine is scenified.

**`OperationsShowroom.tsx` wiring:**
- `import ContentPreview` (top).
- Panel 03 body → `<ContentPreview />`; its gated footer action retitled to the real
  built flow **`action="Scenify a routine"`** (was the unbuilt "Assemble piece") →
  `onRequireAuth`.
- Header comment updated to record panel 03 is now the real fetch-free structure.
- **Design:** the panel adds no purple band; the module card's single
  `bg-brand-purple/80` band (`ModuleLauncher`) stays the only purple. One-purple-per-
  card preserved.

## STEP 3 — Verify (cited)

- **Panel 03 = the REAL content structure (what's actually built); fabricated content
  gone; nothing invented.** It renders `<ContentPreview />` (real `ContentTable`
  empty + real badge/filter + real empty state); the "Day 2 reel" block is removed;
  no workspace/piece UI is shown.
- **grep proof — no fetch / `/api/` / useEffect; actions→onRequireAuth only:**
  `grep -nE "fetch|axios|/api/|useEffect" ContentPreview.tsx ContentTable.tsx` →
  matches are **comment lines in ContentPreview only**; **zero in code**, and
  **zero in ContentTable** (it is fetch-free). The gated control is panel 03's
  `action="Scenify a routine"` footer → `onRequireAuth`.
- **Logged-out fires ZERO server calls:** ContentPreview has no network code;
  ContentTable with empty scenes renders only the header row (its `SceneHeaderRow`/
  `TakeRow`/`formatDay` paths never execute — no rows). Safe by construction.
- **Panel 01 + panels 02/04 UNCHANGED:** `grep 'step="0[1234]"'` confirms panel 01
  (project, `action="Generate tasks"`), 02 (real routine form, no `action`), and 04
  (evolution) are intact.
- **Real /operations Content surface + other 5 modules UNTOUCHED:** `git diff
  --name-only` = `OperationsShowroom.tsx` only (+ the new component + report);
  `ContentTable`/`SectionG_Content`/the `/operations` workbench/`ModuleLauncher` are
  **not** in the diff (`ContentTable` is imported, not modified).
- **One purple band per card; alternating bands preserved:** the showroom adds no
  band; `ModuleLauncher`'s section band + alternating backgrounds unchanged.

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Show only REAL, BUILT content structure; don't invent the unbuilt workspace/piece | ✅ reuses the real `ContentTable` (14 cols) + real badge/filter + real empty state; no workspace/piece shown |
| No fetch on mount; no server call logged out (action→onRequireAuth) | ✅ grep: 0 fetch/`/api/`/useEffect in code; gate = panel footer → `onRequireAuth` |
| Touch ONLY panel 03; don't touch real surfaces or other panels/modules | ✅ diff = `OperationsShowroom.tsx` + new component; panels 01/02/04 + real surfaces unchanged |
| 0 endpoint, 0 schema, 0 deps | ✅ |
| `tsc --noEmit` | ✅ exit 0 |
| eslint (new + changed) | ✅ `ContentPreview.tsx` + `OperationsShowroom.tsx` → 0 problems |
| git diff scoped | ✅ `OperationsShowroom.tsx` + `ContentPreview.tsx` (+ this report) |

---

## Result
The home showroom's **Create content** panel now shows the **real** content surface
that exists today — the genuine 14-column `ContentTable` rendered empty (real
headers, zero rows) above the real badge/entity-filter row and the real "🎬 No scenes
yet — scenify a routine" empty state — extracted **fetch-free** by reusing the real,
prop-only `ContentTable` (just as PR-1 reused the real `RRULEBuilder`). The unbuilt
content workspace/piece grouping is **not** invented; only what's built is shown. No
`useEffect`, no `fetch`, no `/api/` — a logged-out visitor fires **zero** server calls
(grep-proven), and the gated "Scenify a routine → log in" footer calls
`onRequireAuth`. Panel 01 (sample-data) and panels 02/04, the real `/operations`
Content surface, and the other 5 module sections are untouched; one-purple-per-card +
alternating bands preserved. tsc + lint clean; diff scoped to the showroom + the new
preview component.
