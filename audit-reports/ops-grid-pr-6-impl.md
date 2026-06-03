# OPS-GRID-PR-6 — Scenify creates scene-ROWS per routine step (shot fields → the grid)

**Branch:** `claude/ops-grid-pr-6` (off `main`; PR-1..5 merged)
**Date:** 2026-06-03
**One concept:** reshape Scenify so it writes the **scene-ROWS the PieceGrid reads** —
one `operations_content_scenes` row per routine **step**, capturing Alex's stable shot
fields (camera, angle, shot type, b-roll, narrative purpose). The per-day **script** stays
in the grid's take-cells (PR-5), untouched.
Per `audit-reports/ops-grid-pr-5-impl.md` + `ops-content-table-audit.md`.
**0-schema** — all fields exist (PR-1/PR-2); confirmed below.

> **⚠️ This PR is 0-schema** (git diff carries no `prisma/schema.prisma`) — no Azure
> migration needed. The grid tables + all shot columns already exist in the DB.

---

## 1. Audit (cited)

### Old Scenify wrote the WRONG table + fields
- `ScenifyModal.tsx` (pre-PR) POSTed `scene_number / scene_title / focus_category /
  filming_location_base / estimated_hours / script` to **`/api/operations/content/scenes`**,
  whose `POST` creates **`operations_content_scene_groups`** (the per-routine *container*,
  route header `scenes/route.ts:1-11`). None of those fields/that table feed the grid — so
  Scenify produced "no scenes yet" in the PieceGrid.

### The row table the grid reads (0-schema target)
- `operations_content_scenes` (`schema.prisma:2897`): `routine_step_id @unique`,
  `camera_needed` / `filming_angle` / `shot_type` (`@db.VarChar(200)`), `b_roll` /
  `narrative_purpose` / `notes` (`@db.Text`). **All five shot fields already exist**
  (`camera_needed`/`filming_angle` PR-1, `shot_type`/`b_roll`/`narrative_purpose` PR-2) →
  **0-schema confirmed** (`grep shot_type|b_roll|narrative_purpose schema.prisma` → present).
- Joins `routine_step` → `operations_routine_steps` (`step_order`, `activity`, `time_of_day`)
  for the grid's row label/order; the PieceGrid (PR-5) already orders rows by `step_order`.

### Routine steps available to pre-fill
`operations_routine_steps` (`schema.prisma`): `step_order`, `activity`, `time_of_day`. The
single-routine read `GET /api/operations/routines/[id]` returns `{ routine }` with
`steps: { include: { content_scene: true } }` (`routines/[id]/route.ts:66-77`) — i.e. each
step **with its existing scene-row** — exactly the prefill source.

### Audit enums reused
`operations_content_scene_created` / `operations_content_scene_updated`
(`schema.prisma:74-75`) — the scene-row enums.

---

## 2. Rewired Scenify (per-step rows, shot fields, upsert) — cited

### New route (the write path) — `POST /api/operations/content/scene-rows`
`src/app/api/operations/content/scene-rows/route.ts`:
- Auth mirrors `content/takes/route.ts`: `getVerifiedEmail` → 401, `users.findFirst` → 404.
- Validates `routine_step_id` (UUID, required); shot fields optional — `camera_needed` /
  `filming_angle` / `shot_type` trimmed + capped at 200, `b_roll` / `narrative_purpose`
  trimmed Text; empty → null.
- **Ownership:** the `routine_step` must belong to the caller (`findFirst id+user_id`) →
  defensive **404**. `entity_id` is **server-derived from the step**, never the client.
- **Upsert** on `routine_step_id` (@unique): `findUnique` → `update` existing / `create` new —
  so Scenify is re-openable to refine shot fields ("evolve how I shoot").
- `writeAuditLog`: `operations_content_scene_created` (insert) / `operations_content_scene_updated`
  (update), `target.table = operations_content_scenes`, before/after/metadata payload.

### Rewired form — `ScenifyModal.tsx`
On open, `GET /api/operations/routines/{id}` → the routine's steps (sorted by `step_order`),
each prefilled from its existing `content_scene`. Renders, per step, the read-only
`{order}. {activity} {time}` label + five editable shot inputs (**camera, angle, shot type,
b-roll, narrative purpose**). The **old container fields (Scene#/Title/Focus/Location/Hours/
Script) are gone** from this flow. `save scenes` upserts one scene-row per step via the new
route (so every step becomes a grid row, bare rows valid), then broadcasts a window event
(`CONTENT_SCENES_CHANGED_EVENT`) and closes. Existing palette only
(`border-brand-purple`, `bg-purple-50/30`, `text-text-*`, `font-mono`).

### `ScenifyButton.tsx`
Always offers the form (dropped the container-based "Scenified" badge, since rows are now
editable/re-scenify-able). `onScenify` is **retained as an optional, no-longer-invoked prop**
purely so the existing call sites (`AvailableRoutinesList`, and the Routines tab's
`RoutineRow`/`RoutineList`) compile **without modification** — a `(s: Scene) => void` is
assignable to an optional `(s: Scene) => void` (a `() => void` would not be). The grid
refresh is driven by the modal's window event, not this callback.

### `PieceGrid.tsx` (additive only)
Added a `CONTENT_SCENES_CHANGED_EVENT` listener that refetches `/content/grid` scenes/pieces/
cells (preserving the entity selection). **The take-cell edit logic is unchanged** — this is a
pure refresh hook so newly-scenified rows appear without a manual reload.

---

## 3. Verify (cited)
- **Scenify now writes scene-ROWS, not the container:** `ScenifyModal` POSTs only to
  `/content/scene-rows` (→ `operations_content_scenes`); no reference to `/content/scenes` or
  the container fields remains in the flow.
- **Rows appear in the PieceGrid immediately:** modal dispatches `CONTENT_SCENES_CHANGED_EVENT`;
  PieceGrid refetches → the new `operations_content_scenes` rows render as grid rows
  (PR-5 reads this table).
- **Fields captured** = Scene order/Activity (read-only, from the step) + Camera + Angle +
  Shot Type + B-Roll + Narrative-Purpose. Old container fields removed from the flow.
- **Authed:** new route does cookie verify / user-scope / defensive 404 (step ownership) /
  server-derived entity_id / `writeAuditLog` with the scene enums.
- **0-schema:** no `prisma/schema.prisma` in the diff; all shot columns pre-existed.
- **Existing palette; grid take-cells (PR-5) + home + other tabs untouched:** `git diff`
  touches only `ScenifyModal` / `ScenifyButton` / `PieceGrid` (+ the new route); `ContentTable`,
  `SectionG_Content`, `AvailableRoutinesList`, the Routines tab (`RoutineRow`/`RoutineList`),
  and `home` are **not** in the diff.
- **tsc + lint clean:** `npx tsc --noEmit` → exit 0; `npx eslint` on changed/new files → exit 0.

---

## 4. Scope notes (flagged for follow-ups)
- **Legacy container Scenify superseded.** `/api/operations/content/scenes` (writes
  `operations_content_scene_groups`) and the container fields are no longer used by Scenify.
  The route + table still exist (untouched here to keep scope tight and the Routines tab
  pristine) — **follow-up:** retire the container route/table and the dead
  `SectionG_Content.handleScenify` / `AvailableRoutinesList` container filter.
- **`AvailableRoutinesList`** filters `!content_scene_group`; since containers are no longer
  created, every routine now shows a Scenify button — acceptable (routines are always
  re-scenify-able to refine rows), reconcile in the cleanup follow-up.
- **PR-1 route/vocab mismatch** (legacy `/content/scenes` ↔ container, `/content/takes` ↔
  scene-row) is unchanged; the new write path uses the clean `/content/scene-rows` name.

---

**git diff = the Scenify form (ScenifyModal + ScenifyButton) + its route (/content/scene-rows)
+ an additive PieceGrid refresh hook (+ this report). No schema.** Real authed route
(verify / user-scope / defensive 404 / audit). Existing palette only.
