# OPS CONTENT Audit: the content engine — isContent toggle, sub-form, routine+project grouping

**Branch:** `claude/ops-content-audit`
**Date:** 2026-06-01
**Mode:** READ-ONLY.
**Goal:** Design the content engine — an "is this content?" toggle on the Routine +
Project forms → a content sub-form, and a **Content entity that GROUPS** multiple
content-flagged routines + projects into ONE piece (one reel = one day). Audit
before designing — much already exists.

---

## 0. The crux up front: a content layer ALREADY EXISTS (for routines, 1:1)

There is a working content system — but it's **per-routine 1:1, not grouped**:
- **`operations_content_scenes`** (`schema.prisma:2870-2891`) — **one scene per
  routine** (`routine_id String @unique`), fields `scene_number`, `scene_title`,
  `focus_category`, `filming_location_base`, `estimated_hours`, `script`.
- **`operations_content_takes`** (`:2893-2911`) — **one take per routine-step**
  (`routine_step_id @unique`), fields `filming_location_specific`, `camera_needed`,
  `filming_angle`, `notes`.
- **Routine relations** (`:2818,2844`): `operations_routines.content_scene` (1:1),
  `operations_routine_steps.content_take` (1:1).

So today: **routine → "scene", routine-step → "take"** via Scenify/Takeify, rendered
in a 14-column spreadsheet on the Content tab. **Projects have ZERO content wiring.**
The two gaps vs Alex's ask: (1) **no isContent toggle/sub-form on the forms** (scene
creation is a separate Scenify action, not a form toggle); (2) **no grouping** — a
"piece"/reel that bundles **many** routines + projects for **one day**.

## 1. Routines — schema + form + content hook

- **Schema:** `operations_routines` (`:2792-2825`) — `name`, `description`,
  `schedule_rrule`, `timezone`, `start/end_date`, `start/end_time`, streaks,
  `is_active`; relations `steps`, `completions`, **`content_scene`** (`:2818`).
  `operations_routine_steps` (`:2827-2850`): `step_order`, `time_of_day`,
  `activity`, `sub_activity`, `location`, `duration_minutes`, `notes`,
  **`content_take`** (`:2844`).
- **Form:** create in `RoutineList.tsx` / edit in `RoutineRow.tsx:303-411` (shared
  `RoutineForm`, `routines/types.ts:140-182`), schedule via `RRULEBuilder.tsx`
  (5 cadence modes: daily / weekly / monthly_day / monthly_nth_weekday / custom —
  **not "3 patterns"**). Sub-steps in `RoutineStepList.tsx:89-499`
  (activity/sub_activity/location/duration/notes).
- **Existing content affordances already on Routines:** a `ScenifyButton`
  (`RoutineRow.tsx:298`) + per-step `TakeifyButton` (`RoutineStepList.tsx:398`).
- **isContent hook point:** the routine create form action row
  (`RoutineList.tsx:302`, the `pt-2 border-t` block) and the edit form
  (`RoutineRow.tsx:393`). An "is this content?" toggle there → reveal the content
  sub-form (scene metadata) → on save, create the `operations_content_scenes` row
  (replacing/supplementing the separate Scenify action).

## 2. Projects — schema + form + content hook (greenfield)

- **Schema:** `operations_projects` (`:2632-2669`) — `title`, `goal`/`problem`/
  `diagnosis`/`design` (+ `*_items` JsonB), `status`, `target_completion_date`,
  `estimated_total_minutes/cost`, priority fields; relations `tasks`,
  dependencies, `linked_issues`. **No content relation.**
  `operations_project_tasks` (`:2671-2708`): title/description/status/estimates/
  deadline/`coa_code`/`actual_*`. **No content relation.**
- **Form:** `SectionD_ProjectBacklog.tsx` (create `:344-579`, edit in
  `projects/ProjectRow.tsx`). 5-step Bridgewater scoping (goal/problem/diagnosis/
  design — design AI-generated `:93`) + AI task decomposition (`generate-tasks`
  preview → bulk-create).
- **isContent hook point:** the project create form action row
  (`SectionD_ProjectBacklog.tsx:530`). **No existing Scenify/Takeify on projects** —
  this is greenfield: a toggle + sub-form here needs a **new project↔content
  relation** (a project-as-content row), mirroring the scenes pattern.

## 3. The existing Content tab — exactly what's there

- **Route/shell:** `/operations/content` → `SectionG_Content.tsx:30-229`. On mount
  fetches `/api/operations/content/scenes`, `/content/takes`, `/routines`,
  `/entities`.
- **Spreadsheet:** `ContentTable.tsx:130-206` — a **14-column** table
  (Scene/Title/Focus/Hours/Day/Loc-Base/Time/Activity/Sub-Activity/Loc-Specific/
  Camera/Angle/Notes/Script). Per scene: one `SceneHeaderRow` + one `TakeRow` per
  routine step (ordered by `step_order`); the "Day" column is derived from the
  routine's RRULE (`formatDay`, `:74-90`). Inline edit → optimistic PATCH to
  `/content/scenes/[id]` + `/content/takes/[id]` (`SectionG_Content.tsx:104-170`),
  script via `ScriptDrawer`.
- **Scenify:** `AvailableRoutinesList.tsx` lists routines with `!content_scene`;
  `ScenifyButton` → `ScenifyModal.tsx:22-224` (scene_number* + scene_title* + the
  optional metadata) → POST `/api/operations/content/scenes`.
- **Takeify:** `TakeifyButton.tsx` → **bare** POST `{routine_step_id}` to
  `/content/takes` (details filled later inline).
- **API** (`src/app/api/operations/content/{scenes,takes}[/[id]]/route.ts`): GET/
  POST/PATCH/DELETE, all **`getVerifiedEmail`-gated + user-scoped**, deriving
  `entity_id` server-side from the routine/step, enforcing the 1:1 uniques, writing
  audit-log entries (`operations_content_scene_created` etc.).

**So the Content tab is a scene/take builder over routines — exactly the substrate
to extend.** It is **not** grouped: each scene = one routine; there is no "reel" /
"piece" entity bundling multiple routines+projects.

## 4. Grouping — existing join patterns + recommended many-to-many

**There is NO Content↔Routine / Content↔Project grouping today** (scenes are 1:1
per routine; nothing bundles multiple). The codebase's join idiom is an **explicit
join table** — see **`operations_project_dependencies`** (`:2773-2790`): a row with
two FK columns, named `@relation`s, `@@unique([...])`, per-FK `@@index`, and a
`@@map`. Match that style (don't invent a new one).

**Recommended new model — `operations_content_pieces`** (the "reel"/piece) + a
**join table** linking it to many scenes (routines-as-content) and many
project-content rows:
- **`operations_content_pieces`**: `id`, `user_id`, `entity_id`, `title`,
  `piece_date Date` (the daily anchor — §5), `status`, `script`/`notes`, timestamps.
- **Link to routines:** reuse the existing `operations_content_scenes` and add a
  nullable `piece_id` FK on it (a scene belongs to ≤1 piece) — **one-to-many
  piece→scenes**, the simplest fit since a scene is already 1:1 with a routine.
- **Link to projects:** a **new `operations_content_project_items`** join (mirroring
  the scenes shape) — `id`, `piece_id` FK, `project_id` (or `task_id`) FK,
  `user_id`, `entity_id`, the project-substance content fields (§6), `@@unique
  ([piece_id, project_id])`. This gives **piece → many projects**.

Net: a **piece groups many scenes (routines) + many project-content items** — a
one-to-many fan-out per side, matching the existing FK+join idiom. (A full M:N
[scene in multiple pieces] isn't needed — one reel = one day, items belong to that
day's piece.) **Confirm with Alex** (sign-off #2).

## 5. Daily Plan / the date anchor for daily grouping

- **`operations_daily_plan_items`** (`:2710-2732`): **`plan_date Date`** + `task_id`
  (a project task scheduled that day) or `ad_hoc_title`; `@@unique([task_id,
  plan_date])`, `@@index([user_id, plan_date])`. So **a day's projects = the tasks
  in `daily_plan_items` for that `plan_date`.**
- **A routine's "day"** is derived from its RRULE (the Content tab's `formatDay`),
  not a stored date — so "today's routines" = routines whose RRULE fires today.
- **Grouping anchor:** **`piece_date`** on the new piece = the day; "group today's
  items" = the routines firing today (via RRULE) + the `daily_plan_items` for
  today's `plan_date`. That's the natural "his routine + that day's projects = one
  reel" surface. Cite both: RRULE-derived routine day + `plan_date` for projects.

## 6. Recommended content sub-form fields

Split by **routine-as-content (recurring scene — stable shot metadata)** vs
**project-as-content (per-project substance)**, reusing the existing columns:

- **Routine → scene sub-form** (maps to `operations_content_scenes`): `scene_title`,
  `focus_category`, `filming_location_base`, `estimated_hours`, `script`. Per-step
  **take** metadata (recurring shot setup): `filming_location_specific`,
  `camera_needed`, `filming_angle`, `notes` (the `operations_content_takes` fields).
  These are **stable** (a recurring scene's shot setup) — fill once on the routine.
- **Project → content sub-form** (new `operations_content_project_items`): the
  **substance** of that project as content — `segment_title`, `hook`/`angle`,
  `script`/`voiceover`, `b_roll_notes`, `shot_type`, optional `camera`/`location`.
  Per-project (not recurring), tied to the day's piece.
- **Piece-level** (the reel): `title`, `piece_date`, overall `script`/running order,
  `status`.

(These mirror the by-hand daily reel — scene/camera-angle/shot-type/b-roll/script —
already captured for routines; projects add the per-piece narrative substance.)

## 7. Scope + sequence (one concept per PR)

- **OPS-CONTENT-PR-1:** **isContent toggle + scene sub-form on the Routine form**
  (`RoutineList.tsx:302` / `RoutineRow.tsx:393`). When on, reveal the scene
  metadata sub-form; on save create/update `operations_content_scenes` (and
  per-step takes). Reuses the existing scenes/takes tables + API — **likely 0
  schema** (the toggle is "has a content_scene"); maybe add a convenience
  `is_content` boolean to routines if a flag is wanted independent of the scene row
  (flag for Alex). Files: routine form components + the content API (reuse).
- **OPS-CONTENT-PR-2:** **isContent toggle + content sub-form on the Project form**
  (`SectionD_ProjectBacklog.tsx:530`). **Schema:** new
  `operations_content_project_items` (project-as-content) — the project-substance
  fields. New API route mirroring `/content/scenes`.
- **OPS-CONTENT-PR-3:** **the grouping entity + "group today's items into a reel"
  UX** — new `operations_content_pieces` (+ `piece_id` on scenes + the project-item
  join), a Content-tab surface to create a piece for a `piece_date` and attach
  today's firing routines + today's `daily_plan_items` projects. **Schema:** the
  piece table + the relations.

**Schema/migration discipline (flag):** PR-2 and PR-3 add tables/columns —
`prisma/schema.prisma` + a **raw SQL migration must move in parallel** (the
dual-write rule), and **Alex runs migrations via `psql`** (not `prisma migrate` in
this repo's flow). PR-1 may be **0-schema** (reuses scenes). All routes stay
`getVerifiedEmail` + user-scoped + audit-logged (the established ops pattern).

> **North Star auto-evolves (no form) + Logs are monitoring (no input)** — confirmed
> out of scope; the content engine touches Routines, Projects, and the Content tab
> only.

## Sign-off items
1. **isContent toggle vs the existing Scenify action** — does the toggle on the
   routine form **replace** ScenifyButton (auto-create the scene on save) or
   **coexist** with it? Recommend the toggle creates the scene; keep Scenify as the
   from-the-list path.
2. **Grouping model** — `operations_content_pieces` + `piece_id` on scenes + a new
   `operations_content_project_items` join (recommended, one-to-many per side) vs a
   full M:N. Confirm the shape.
3. **Project-as-content fields (§6)** — confirm the per-project substance fields
   (hook/angle/script/b-roll/shot-type) and whether content attaches to the
   **project** or to individual **tasks**.
4. **Daily anchor** — group by `piece_date` = the day, pulling RRULE-firing routines
   + `daily_plan_items` for that date (recommended). Confirm.
5. **`is_content` boolean on routines/projects** — add a convenience flag, or infer
   "is content" from the presence of a content_scene / content_project_item row?
6. **Sequence** — PR-1 routine toggle (0-schema) → PR-2 project toggle (+schema) →
   PR-3 grouping (+schema). Confirm; confirm Alex runs the psql migrations.

---

**READ-ONLY audit. No implementation performed.**
