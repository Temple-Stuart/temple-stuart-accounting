# OPS — Content Engine Audit (READ-ONLY)

**Branch:** `claude/ops-content-engine-audit`
**Date:** 2026-06-03
**Mode:** READ-ONLY — cite file+line, recommend a one-concept-per-PR sequence,
**do NOT implement.**

**Goal (confirmed with Alex):** map the real pieces for Alex's content engine —

- **ASPECT 1** — three stages over a routine:
  - **Stage 1:** Alex builds/edits a routine (title, times, description, **STEPS**).
    AI validates inputs, then enriches **each STEP** into a scene-row (scene #, time
    distributed start→end, activity from the step, + **suggested** camera angle / shot
    type / b-roll, + an **assigned QUESTION**). Editing the routine **re-adjusts** the
    map but **never wipes logged answers** (append/preserve, like the evolution loop).
  - **Stage 2:** daily — Alex answers each scene's question (the Daily Log). Commit.
  - **Stage 3:** AI turns a day's answers → the reel **VOICEOVER** script.
  - Alex keeps his **own question library**; AI **assigns** best-fit per scene,
    suggesting a new one only where none fits.
- **ASPECT 2** — work narrative: Alex picks project TASKS to work each day, commits them
  to his CALENDAR with time logged; the system auto-builds the **work-scene** narrative
  from what he logged. **Build Aspect 1 first.**

> **Builds on** `ops-content-audit.md`, `ops-content-evolution-audit.md`,
> `ops-content-pr-1-impl.md`, `ops-content-pr-2-impl.md`, and the merged grid PRs
> (`ops-grid-pr-1..6-impl.md`). This audit **extends** them against the current
> on-`main` schema (PR-6 merged: `Merge #725 claude/ops-grid-pr-6`). The content
> data model has been substantially reshaped since the first audits — the citations
> below are read fresh from `main`.

---

## 0. The crux: a working scene/piece/take GRID already exists (rows × days)

Since the early audits, the content layer was rebuilt into a **spreadsheet grid**
(grid PR-1..6). Three tables, all cited from `prisma/schema.prisma`:

| Table | Lines | Grain | Role in Alex's vision |
|---|---|---|---|
| `operations_content_scene_groups` | `2874-2895` | **one per routine** (`routine_id @unique`) | the routine-as-"scene-group" **container** (scene_number, scene_title, focus_category, filming_location_base, estimated_hours, script). **Legacy** — superseded by scene-rows (grid PR-6 §4). |
| `operations_content_scenes` | `2897-2919` | **one per routine STEP** (`routine_step_id @unique`) | the grid **ROWS** — Alex's **shot fields**: `camera_needed`, `filming_angle`, `shot_type`, `b_roll`, `narrative_purpose`, `notes`, `filming_location_specific`. **This is the Stage-1 enrich target.** |
| `operations_content_pieces` | `2927-2949` | **one per day** (`piece_date`) | the grid **COLUMNS** = a day = a reel. Optional `project_id` + `source_ai_usage_id` (the version anchor). **This is the Stage-3 voiceover home.** |
| `operations_content_takes` | `2958-2978` | **one per (scene × piece)** (`@@unique([scene_id, piece_id])`) | the grid **CELLS** = the per-day script for a scene. Holds `script` only. **This is the Stage-2 answer home.** |

So the substrate Alex needs **mostly exists**: routine-step → scene-row (shot fields),
day → piece, (scene × day) → take-cell. The grid is read by
`/api/operations/content/grid` (`grid/route.ts:1-20`: "scenes = ROWS, pieces =
COLUMNS, cells = per-(scene×piece) script") and rendered by `PieceGrid.tsx`.

**What's missing for the vision** (the gaps this audit scopes):
1. **AI does not populate the shot fields** — Scenify is Alex hand-filling
   (`ScenifyModal.tsx`, grid PR-6 §2). Stage 1 wants AI to **suggest** them.
2. **No QUESTION concept anywhere** — `grep -rniE '\bquestion\b' prisma/schema.prisma
   src/lib/ai` → **zero hits.** No library, no per-scene assignment. Fully greenfield (§4).
3. **No time distribution** — scene-rows order by `step_order`, not by a computed
   time across the routine's start→end window (§1).
4. **No Stage-3 voiceover route** — no AI route reads a day's takes → a script (§6).
5. **Edit-adjusts-map is destructive today** — deleting a step **hard-deletes** its
   scene-row and **cascade-deletes every take/answer** (§5). This violates the
   append/preserve rule.

---

## 1. ROUTINE BUILDER + STEPS — what drives Stage 1 (cited)

**Routine model** — `operations_routines` (`schema.prisma:2796-2829`):
`name`, `description`, `schedule_rrule` (+ `timezone`), streak fields,
`start_date`/`end_date` (`@db.Date`, `:2811-2812`) **and**
`start_time`/`end_time` (`@db.Time(6)`, `:2813-2814`), `is_active`. Relations:
`steps`, `completions`, **`content_scene_group`** (`:2822`, 1:1 legacy container).

> **Q (the brief): does a routine carry start/end TIME for distributing scene
> times?** **YES** — `start_time` + `end_time` exist (`:2813-2814`,
> `@db.Time(6)`). So Stage-1 time distribution **has a real window to work in**
> (distribute N steps across `start_time`→`end_time`). `RRULEBuilder` covers
> cadence; `start_date`/`end_date` bound the recurrence span (dates), `start_time`/
> `end_time` bound the **daily** window (times) — exactly what a scene-time
> distribution needs. (Confirmed added by `pr-ops-5.8-hub-routine-time`.)

**Step model** — `operations_routine_steps` (`:2831-2854`): `step_order`,
`time_of_day` (`@db.Time(6)`, `:2837` — a **per-step time already exists** but is
optional/hand-set), `activity` (required), `sub_activity`, `location`,
`duration_minutes`, `notes`; relation `content_scene` (`:2848`, the scene-ROW). So
**a step already has an optional `time_of_day`** — Stage 1's "distribute scene
times across start→end" can **write `time_of_day` on each step** (or carry it on
the scene-row) instead of inventing a new column.

**Create/edit routes + UI:**
- Create/list routine: `POST /api/operations/routines` (`routines/route.ts:1-25` —
  compiles the form to RRULE server-side via `compileFormToRRule`, never trusts a
  client RRULE string; audits `operations_routine_created`).
- Read one (with steps + each step's scene-row): `GET /api/operations/routines/[id]`
  (`routines/[id]/route.ts:66-77`, `steps: { include: { content_scene: true } }`) —
  **the exact prefill source for Stage 1** (grid PR-6 §1 already uses it for Scenify).
- Edit routine: `PATCH /api/operations/routines/[id]` (`:105`).
- Steps are managed **individually**: `POST /routines/[id]/steps`
  (`[id]/steps/route.ts:25-145`, `step_order = max+1`), `PATCH`/`DELETE`
  `/routines/steps/[stepId]` (`steps/[stepId]/route.ts:28`, `:159`). UI:
  `RoutineList.tsx`/`RoutineRow.tsx` (form) + `RoutineStepList.tsx` (steps).
- Today's firing routines: `GET /api/operations/routines/today`
  (`today/route.ts:1-24` — expands each active routine's RRULE into today's window;
  this is the **Stage-2 "which routine/scenes are live today"** feeder).

**What's there to drive Stage 1:** the routine form, the steps (activity + optional
time_of_day), the start/end **time** window, and the per-step scene-row table. **What's
new:** an AI route that reads the steps + window and **returns** suggested shot fields
+ a distributed time + an assigned question per step (preview → gate → write the
scene-rows). Today Scenify makes Alex type the shot fields by hand (grid PR-6 §2).

---

## 2. THE AI-GENERATION PATTERN TO REUSE — cited end-to-end (the template for Stage 1 + Stage 3)

The North Star → task generation flow is the **canonical preview → human-gate →
commit + append-only version-row** pattern. Mirror it for **both** new AI routes.

**(a) Generate (preview, does NOT save)** —
`POST /api/operations/projects/[id]/generate-tasks` (`generate-tasks/route.ts`):
- auth: `getVerifiedEmail` → 401 (`:46`); user lookup → 404 (`:49-52`);
  `operations_projects.findFirst({ id, user_id })` → defensive 404 (`:55-58`).
- resolves inputs (`resolveItems`, `:31-39`), **validates** them before calling the
  model (`:64-72` — "must have at least one goal/problem/diagnosis item"). **This is
  the "AI validates inputs / tells him if more info is needed" hook** the brief wants
  for Stage 1.
- calls `generateProjectTasks(...)` and **returns** `{ tasks, usage_id, cost,
  inspection }` (`:92-99`) — **no DB write.** Header: *"does NOT save … user must
  explicitly accept via the AITaskPreview → bulk-create gate"* (`:9-12`).

**(b) The model call + version row** — `generateProjectTasks.ts`:
- a `SYSTEM_PROMPT` (`:94-202`) + a **forced custom tool** for structured JSON
  (`return_project_tasks`, `TASK_SCHEMA` `:71-92`, `toolChoice: { type:'tool', … }`
  `:262`), optional `web_search` (`:250-256`).
- everything runs through **`recordUsage`** (`recordUsage.ts:102-212`), which:
  Anthropic call (`:119`) → cost (`:136`) → **inserts an append-only immutable
  `operations_ai_usage` row** with `full_system_prompt`/`full_user_message`/
  `full_response` + `purpose`/`target_table`/`target_id` (`:151-168`) → writes an
  `operations_ai_inference` audit row (`:170-194`) → returns `{ toolUses, usageId,
  inspection, cost }`. **The `usageId` is the version anchor** (the same row PR-1
  links tasks to via `source_ai_usage_id`).

**(c) Human gate (UI)** — `AITaskPreview.tsx`: header *"this component IS the
explicit acceptance gate"* (`:17`); shows `source: ai_usage_id …` (`:156`); on
**"accept all"** POSTs the (edited) array + `source_ai_usage_id` to bulk-create
(`:115`, `:125`, `:239`). No partial acceptance.

**(d) Commit (append-only persistence)** —
`POST …/tasks/bulk-create` (`bulk-create/route.ts`):
- re-auth + **ownership-verifies** `source_ai_usage_id` against the user
  (`:163-171`).
- validates every row (`validateTask`, `:50-115`), then **appends** in one
  `$transaction`: `baseOrder = max(display_order)+1` (`:189-194`), each row
  `display_order: baseOrder + suggested_order` (`:209`), **persists
  `source_ai_usage_id` on the row** (`:214`) — the batch is first-class/queryable.
- writes one audit row per created task (`:223-241`).

**What to mirror exactly (BOTH new routes):**

| Element | Stage 1 (enrich map) | Stage 3 (voiceover) |
|---|---|---|
| Generate route (no save) | `POST /routines/[id]/generate-scene-map` | `POST /content/pieces/[id]/generate-voiceover` |
| Input validation = "needs more info" gate | steps present? window set? (mirror `:64-72`) | day has ≥1 answered take? |
| Model call via `recordUsage` + **forced custom tool** | `return_scene_map` (shot fields + time + question per step) | `return_voiceover` (or plain text, mirror generate-design §6) |
| Immutable version row | `operations_ai_usage` (`purpose='routine_scene_map_generation'`, target=routine) | `operations_ai_usage` (`purpose='reel_voiceover_generation'`, target=piece) |
| Human gate UI | a ScenifyPreview (mirror `AITaskPreview`) | a VoiceoverPreview |
| Commit (append/preserve) | upsert scene-rows by `routine_step_id` (grid PR-6 already upserts) | write `voiceover_script` on the piece + `source_ai_usage_id` |

> **Second AI template (text, not structured):** `generate-design`
> (`generate-design/route.ts:1-21`) returns generated **text** for review, *"does
> NOT auto-save … user must explicitly click 'use this'"* — the closer analogue for
> **Stage 3 voiceover** (prose output, single "use this" gate).

---

## 3. SCENE/GRID TABLES — confirmed; what changes so AI populates them (cited)

- **`operations_content_scenes`** (`schema.prisma:2897-2919`) — the grid **ROW**,
  one per routine step (`routine_step_id @unique` `:2901`, `onDelete: Cascade`
  `:2912`). **Shot fields all present:** `filming_location_specific` (`:2902`),
  `camera_needed` (`:2903`), `filming_angle` (`:2904`), `shot_type` (`:2905`),
  `notes` (`:2906`), `b_roll` (`:2907`), **`narrative_purpose`** (`:2908`). Relation
  `takes` (`:2913`).
- **`operations_content_pieces`** (`:2927-2949`) — the **COLUMN/day**: `piece_date`
  (`:2931`), `title` (`:2932`), `project_id?` (`:2933`, `onDelete: SetNull`
  `:2939`), `source_ai_usage_id?` (`:2934`, version anchor `:2940`). Relation
  `takes` (`:2941`).
- **`operations_content_takes`** (`:2958-2978`) — the **CELL**: `scene_id` +
  `piece_id`, `script?` (`:2964`), `@@unique([scene_id, piece_id])` (`:2972`),
  both FKs `onDelete: Cascade` (`:2969-2970`).
- **PR-6 Scenify** (`ops-grid-pr-6-impl.md`): `POST /api/operations/content/scene-rows`
  (`scene-rows/route.ts`) **upserts one scene-row per step** (`routine_step_id`
  @unique), server-derives `entity_id` from the step, audits
  `operations_content_scene_created/updated`. `ScenifyModal.tsx` prefills each step
  from its existing `content_scene` and lets Alex **hand-fill** the 5 shot fields.

**What changes for Stage 1 (AI POPULATES instead of hand-fill):**
1. **Shot fields** become **AI-suggested** — a new generate route (§2 template)
   returns `{ camera_needed, filming_angle, shot_type, b_roll, narrative_purpose }`
   per step; the existing `scene-rows` upsert is the **commit path** (reuse it
   verbatim — it already upserts by `routine_step_id`, so re-runs refine, not
   duplicate). **0 schema change to scenes for the shot fields** (all columns exist).
2. **An assigned QUESTION per scene** — needs a new `assigned_question_id` (or
   `assigned_question_text` snapshot) **column on `operations_content_scenes`** +
   the library table (§4). **+schema** (1 nullable FK + snapshot text).
3. **A distributed TIME per scene** — write to the existing **step**
   `time_of_day` (`routine_steps:2837`) during the same enrich commit (**0 schema**),
   or add `scene_time` to the scene-row if Alex wants the suggested time decoupled
   from the step's own time (flag — recommend reusing `step.time_of_day`).

**Pieces, takes confirmed unchanged for Stage 1.** Stage 2's *answer* lands in the
take cell (§5/§6); Stage 3's *voiceover* lands on the piece (§6, +1 column).

---

## 4. QUESTION LIBRARY — none exists; minimal greenfield design

**Confirmed: NO question/prompt table exists** (`grep -rniE '\bquestion\b|
question_library|prompt_library' prisma/schema.prisma src/lib/ai` → zero hits). The
take cell holds only `script` (`:2964`); nothing stores a reusable prompt or assigns
one to a scene. **Fully greenfield.**

**Minimal new structure** (mirror the existing model idiom — `@db.Uuid` id,
`user_id`/`entity_id`, `@@map`, single-column indexes, like `operations_content_scenes`):

```
operations_content_questions          -- Alex's reusable question LIBRARY
  id          uuid pk
  user_id / entity_id
  text        text          -- "What was today's biggest lesson?" / "Day score 1-10?"
  category    varchar?      -- "scorecard" | "lesson" | "day_score" | "discomfort" …
  is_active   bool default true
  created_at / updated_at
  @@index([user_id]) ; @@index([entity_id])
```

**Assignment = one nullable FK on the scene-row** (AI assigns best-fit per scene;
the library is Alex's, the *assignment* is AI's — "serves his framework, never
randomizes"):

```
operations_content_scenes  (+2 columns)
  assigned_question_id    uuid?  -- FK operations_content_questions, onDelete SetNull
  assigned_question_text  text?  -- SNAPSHOT of the text at assign-time (so editing
                                 -- the library question later never silently rewrites
                                 -- a scene's logged prompt — same immutability spirit
                                 -- as ai_usage snapshots, §2)
  @@index([assigned_question_id])
```

- **AI assigns, doesn't invent:** the Stage-1 generate route receives Alex's
  `operations_content_questions` list in the prompt and returns, per step, the
  **chosen `question_id`** (best fit) — or a **proposed new question text** only
  where no fit exists, surfaced in the preview for Alex to accept-into-library
  (mirrors the "AI suggests, human gates" discipline). The library stays **Alex's**.
- **No new join table needed** — a scene has exactly one assigned question (1:1 via
  the nullable FK), matching the row-per-step grain. Snapshot text keeps the
  assignment honest if the library entry is later edited/deactivated.

> The **answer** to that question (Stage 2) lives in the **take cell** (§6) — the
> question is on the row (recurring), the answer is per-day (the cell), exactly the
> grid's row/cell split.

---

## 5. EDIT-ADJUSTS-MAP WITH HISTORY — the data-loss risk + the append/preserve fix (cited)

**The risk (today's behavior is destructive):**
- A routine step is **hard-deleted**: `prisma.operations_routine_steps.delete(...)`
  (`steps/[stepId]/route.ts:183`; header `:8` "hard delete").
- `operations_content_scenes.routine_step` is `onDelete: Cascade`
  (`schema.prisma:2912`) → deleting the step **deletes the scene-ROW**.
- `operations_content_takes.scene` is `onDelete: Cascade` (`:2969`) → deleting the
  scene-row **deletes every take-CELL across every day** — i.e. **all logged answers
  for that scene are wiped.** This **violates** the brief's rule: *"editing the
  routine RE-ADJUSTS the map but NEVER wipes logged answers."*

**The pattern to mirror (the evolution loop's append/preserve)** — per
`ops-content-evolution-audit.md` (A2) + `bulk-create` (§2d): the project-task loop is
**strictly additive** — re-runs **append** (`display_order = max+1`,
`bulk-create:194,209`), old rows are **never deleted or replaced** on re-run; the
immutable `operations_ai_usage` row preserves each version. Editing the *design*
overwrites current-state, but the **logged substance (tasks) and the version history
(ai_usage) survive.** That is the exact contract Stage 1 needs.

**Recommended edit-adjusts-map behavior (no data loss):**

| Routine edit | Today | Append/preserve fix |
|---|---|---|
| **Add a step** | new step → Scenify creates a new scene-row | ✅ already additive (re-run enrich upserts the new row; old rows + their takes untouched) |
| **Edit a step** (rename activity, change time) | scene-row upsert refines shot fields (grid PR-6 §2) | ✅ upsert by `routine_step_id` — **preserves** the row id, so its take-cells (answers) stay attached |
| **Delete/remove a step** | **hard delete → cascade-wipes scene-row + ALL takes** (`:183`,`:2912`,`:2969`) | ❌ **must change.** Either (a) **soft-delete** the step (`is_active`/`archived_at` column) so the scene-row + its logged takes are **preserved/hidden, not deleted**; or (b) detach: `onDelete: SetNull` + keep the orphaned scene-row flagged "removed from routine". **Recommend soft-delete on the step** (smallest blast radius; the grid filters inactive). |

So **edit re-syncs the map** (upsert rows for current steps, AI re-suggests shot
fields/questions for new/changed steps) **without ever issuing a delete that
cascades into `operations_content_takes`.** The logged answers are append-only, the
same as project tasks. This is a **schema PR** (soft-delete column on
`operations_routine_steps` + relax the cascade) — flagged migration-first (§8).

---

## 6. STAGE 3 VOICEOVER — input shape + output home (cited)

**Input — a day's answers:** a piece (`operations_content_pieces`, one per
`piece_date`) has many `takes` (`:2941`); each take is a (scene × piece) cell with
the per-day text. The **answer** to each scene's assigned question (Stage 2) is the
take's `script` field (`:2964`) — or a new `answer` column if Alex wants to keep the
raw answer distinct from any per-scene script (flag — recommend **reusing
`take.script` as the answer field**, since the grid already edits it per day, or
renaming it `answer` for clarity in a later PR). Each take joins to its scene
(`scene_id`) → the scene's `assigned_question_text` (§4) → the prompt that produced
the answer. So the **input shape** to the Stage-3 AI is:

```
piece { piece_date, project_id?, source_ai_usage_id? }
  + ordered scenes (by routine step_order / scene_time):
      [ { activity, narrative_purpose, assigned_question_text, answer (take.script) } … ]
  + (Aspect 2) the work-scene narrative for that day (§7)
```

**The route (mirror §2, prefer the `generate-design` text variant):**
`POST /api/operations/content/pieces/[id]/generate-voiceover` —
- auth + ownership (`piece.findFirst({ id, user_id })`, defensive 404, like
  `generate-tasks:55-58`).
- **input-validation gate:** the day must have ≥1 answered take (mirror
  `generate-tasks:64-72` "needs more info").
- assemble the prompt (the input shape above), call via `recordUsage`
  (`purpose='reel_voiceover_generation'`, `target_table='operations_content_pieces'`,
  `target_id=piece.id`) → returns generated voiceover **text** + `usage_id` (no save).
- a **VoiceoverPreview** ("use this" gate, like `generate-design`/`AITaskPreview`).

**Output home:** **add `voiceover_script Text?` + `voiceover_ai_usage_id Uuid?`**
to `operations_content_pieces` (the piece already carries `source_ai_usage_id` for
the project version anchor `:2934`; the voiceover gets its **own** usage link so the
two AI provenances don't collide). On accept, PATCH the piece with the script +
the usage id (append-only version row already written by `recordUsage`). **+schema**
(2 nullable columns on pieces).

---

## 7. ASPECT 2 — project TASK → CALENDAR → work-scene narrative (cited)

**Current state — the chain already exists end to end:**
1. **Pick a task for a day:** `POST /api/operations/daily-plan/items`
   (`daily-plan/items/route.ts:1-13`) creates an `operations_daily_plan_items` row
   — `plan_date` (`schema.prisma:2718`), `task_id?` (`:2719`, links a project task)
   or `ad_hoc_title` (`:2720`); `@@unique([task_id, plan_date])` (`:2731`),
   `@@index([user_id, plan_date])` (`:2732`). entity_id derived from the task
   (β-1, never client). UI: `SectionC_DailyPlan.tsx`.
2. **Commit to the CALENDAR with time:** `POST
   /api/operations/daily-plan/items/[itemId]/blocks`
   (`items/[itemId]/blocks/route.ts:36-135`) creates an
   `operations_calendar_blocks` row — `scheduled_start`/`scheduled_end` (`:2743-2744`),
   **`actual_start`/`actual_end`** (`:2745-2746`, the **time logged**), `status`
   (`CalendarBlockStatus`, `:2747`). Overlap-detected (`detectBlockConflicts`,
   409 unless `allow_conflicts`). Audits `operations_calendar_block_created`.
   So **"pick task → commit to calendar with time logged" already works**:
   `daily_plan_item (task_id, plan_date) → calendar_block (scheduled + actual times)`.

**What exists vs new for the work-scene narrative:**

| Need | Exists? | What's new |
|---|---|---|
| "which tasks did I work on day D" | ✅ `daily_plan_items WHERE plan_date=D` (`:2732` index) + their `calendar_blocks` (times) | — |
| time logged per task | ✅ `calendar_blocks.actual_start/actual_end` (`:2745-2746`) | — |
| the task's substance | ✅ `task.title`/`description`/`notes` via `daily_plan_item.task_id` (`:2728`) | — |
| **a "work scene" in the reel grid for that day** | ❌ scenes are per **routine step** only (`:2901`); no scene sourced from a task/calendar block | **new:** synthesize work-scene rows for the piece/day from that day's `daily_plan_items` + blocks |
| **auto-built narrative (no retyping)** | ❌ | **new:** an AI route (or a deterministic assembler) that reads the day's committed tasks + logged times → fills the work-scene take answer |

**Recommended approach (after Aspect 1):** when building the day's reel
(`piece` for `piece_date=D`), **read `daily_plan_items` + `calendar_blocks` for D**
and auto-generate **work-scene takes** whose answer text is composed from
`task.title` + `actual` time logged ("Worked 2h10m on *File FAFSA* — …"). This can be
**deterministic** (string assembly, 0 model cost) or routed through the §2 AI pattern
for prose. Either way the **input already exists** (daily_plan_items + calendar_blocks);
the **new** piece is the join from "today's committed/logged tasks" → work-scene
take rows on the piece, so reel-time needs no retyping. **Build Aspect 1 first**
(Alex's instruction); this rides on the same piece/take grid.

---

## 8. SEQUENCE — one concept per PR (Aspect 1 first; schema PRs flagged migration-first)

> Convention (all PRs): `getVerifiedEmail` + user-scoped + defensive 404 +
> `writeAuditLog`; schema PRs move **`prisma/schema.prisma` + raw SQL in parallel**
> and **Alex runs the migration via `psql` then `npx prisma generate`** (the repo's
> dual-write rule — `prisma migrate` is not used here). Reuse-the-AI-pattern PRs
> mirror §2 (`recordUsage` version row + preview → gate → append commit).

### Aspect 1 (build first)

| PR | Concept | Schema? | Reuses AI pattern? |
|---|---|---|---|
| **CE-1** | **Edit-adjusts-map without data loss** — soft-delete on `operations_routine_steps` (`is_active`/`archived_at`) + relax the `content_scenes`→step cascade so removing a step **preserves** the scene-row + its take answers (§5). Grid filters archived. | ⚠️ **+schema (migration-first)**: 1 col on routine_steps + change `onDelete` on `operations_content_scenes.routine_step` (Cascade→SetNull/Restrict) | no |
| **CE-2** | **Question library** — new `operations_content_questions` (Alex's reusable questions) + a small CRUD UI; + `assigned_question_id`/`assigned_question_text` columns on `operations_content_scenes` (§4). No AI yet — manual assign to prove the model. | ⚠️ **+schema (migration-first)**: new table + 2 cols + index | no |
| **CE-3** | **Stage 1 — AI enrich the scene map** — `POST /routines/[id]/generate-scene-map` (validate steps/window → suggest shot fields + distributed time + **assign best-fit question** from CE-2's library) → **ScenifyPreview gate** → commit via the existing `scene-rows` upsert (§3) + write `step.time_of_day` + `assigned_question_id`. | **0-schema** (all target cols exist after CE-1/CE-2; reuses `scene-rows` upsert) | ✅ §2 (`recordUsage`, forced `return_scene_map` tool, preview→gate) |
| **CE-4** | **Stage 2 — Daily Log answer view** — per-day, per-scene: show the assigned question, capture the **answer** into the take cell (`take.script`/`answer`) for today's piece. Commit. (Reads `routines/today` + grid.) | **0-schema** (or +1 col if renaming `take.script`→`answer`; flag) | no |
| **CE-5** | **Stage 3 — AI voiceover** — `POST /content/pieces/[id]/generate-voiceover` (assemble day's answers → script) → VoiceoverPreview "use this" gate → PATCH piece (§6). | ⚠️ **+schema (migration-first)**: `voiceover_script`, `voiceover_ai_usage_id` on `operations_content_pieces` | ✅ §2 (text variant, like `generate-design`) |

### Aspect 2 (after Aspect 1)

| PR | Concept | Schema? | Reuses AI pattern? |
|---|---|---|---|
| **CE-6** | **Work-scene narrative feeder** — for a piece/day, read that day's `daily_plan_items` + `calendar_blocks` (already committed/logged, §7) and auto-build **work-scene takes** (deterministic assembly first). Surfaces logged work in the reel with no retyping. | likely **0-schema** (reads existing tables; work-scene takes use the existing grid) — *flag if a `source_kind` discriminator on scenes/takes is wanted to distinguish routine-scenes from work-scenes* | optional (prose variant) |
| **CE-7 (opt.)** | **AI polish of the work narrative** — route the CE-6 assembly through §2 for prose, version-rowed. | 0-schema | ✅ §2 |

**Migration-first PRs:** **CE-1, CE-2, CE-5** (and CE-6 *if* a discriminator is
added). **0-schema/reuse PRs:** CE-3, CE-4, CE-6(base), CE-7. **AI-pattern PRs:**
CE-3, CE-5, CE-7.

**Why this order:** CE-1 makes editing safe **before** any AI writes into the map
(so no enrich/re-run can ever trip the cascade-wipe). CE-2 gives the library the
AI assigns from. CE-3 is the headline Stage-1 enrich (depends on both). CE-4/CE-5
complete the daily loop. Aspect 2 (CE-6/7) rides the same grid last.

---

## Sign-off items / open decisions

1. **Edit-adjusts-map fix (CE-1)** — confirm **soft-delete the step** (preserve
   scene-row + take answers) vs **detach (`SetNull`) + flag** the orphaned row.
   Recommend soft-delete (smallest blast radius). **This is the data-loss guard —
   land it first.**
2. **Time distribution target** — write the AI-suggested scene time onto the
   existing `routine_steps.time_of_day` (`:2837`, 0-schema) vs a new `scene_time`
   on the scene-row (decoupled). Recommend reusing `time_of_day`.
3. **Question library shape (§4)** — confirm `operations_content_questions` +
   `assigned_question_id` **+ snapshot `assigned_question_text`** on the scene-row
   (so editing a library question never silently rewrites a logged scene's prompt).
   Confirm `category` values (scorecard / lesson / day_score / discomfort …).
4. **AI assigns, never invents** — confirm the Stage-1 route may **propose a new
   question** only where no library fit exists, surfaced in the preview for Alex to
   accept-into-library (never auto-added). The library stays Alex's.
5. **Answer storage (Stage 2)** — reuse `take.script` as the answer field vs add a
   distinct `answer` column (rename in CE-4). Recommend reuse first; rename only if
   a per-scene *script* must coexist with the *answer*.
6. **Voiceover home (CE-5)** — confirm `voiceover_script` + its **own**
   `voiceover_ai_usage_id` on `operations_content_pieces` (separate from the
   existing project `source_ai_usage_id` `:2934`).
7. **Aspect 2 work-scenes (CE-6)** — confirm work-scenes are **takes on the piece**
   built from `daily_plan_items` + `calendar_blocks` (no new table), and whether a
   `source_kind` discriminator (routine-scene vs work-scene) is wanted on
   scenes/takes (the only thing that would make CE-6 a schema PR).
8. **Legacy container cleanup (carried from grid PR-6 §4)** — the unused
   `operations_content_scene_groups` + `/content/scenes` route are superseded by
   scene-rows; retire in a cleanup PR (out of this engine's critical path).

---

**READ-ONLY audit. No implementation performed.** Every schema item above is a
**recommendation**; any build PR moves `prisma/schema.prisma` + raw SQL in parallel
and Alex runs the `psql` migration. Citations are file+line against `main` at
`Merge #725 (claude/ops-grid-pr-6)`.
