# OPS-CE-7B — Pipeline coherence + polish

**Branch:** `claude/ops-ce-7b` (off `main`; CE-6 + CE-7 merged)
**Date:** 2026-06-03
**Scope:** six live-review fixes to the Content pipeline. **0-schema, no new write
paths.** Flat law throughout; existing palette; shared components unmounted-not-deleted.

> ✅ `git diff` = 5 files: `ContentPipeline.tsx`, `ScenifyDraft.tsx`, `PieceGrid.tsx`,
> `DailyLog.tsx`, `lib/ai/enrichRoutineScenes.ts`. **No `prisma/schema.prisma`, no
> `api/` routes.** tsc exit 0; eslint exit 0.

---

## Audit (cited)
- **Page composition:** `app/operations/content/page.tsx` renders only
  `<ContentPipeline />` (CE-7). `ContentPipeline.tsx` stacked: header → 1·SOURCES →
  `QuestionLibrary` → 2·draft → `PieceGrid` → `DailyLog` → a standalone "4 · SCRIPT
  OUTPUT" band.
- **DailyLog mount:** rendered by `ContentPipeline` (CE-6 timeline; `DailyLog.tsx`).
- **Entity-gate scolds:** `DailyLog.tsx:262`, `PieceGrid.tsx:228-229`
  ("Select an entity first."), `QuestionLibrary.tsx:62` (now off-page).
- **Grid scene cell:** `PieceGrid.tsx` `<th>` showed only `step. activity` +
  `angle · shot_type` + question (`:404-415`).
- **Draft cells:** `ScenifyDraft.tsx` camera/angle/shot_type were single-line
  `<input>` → truncation.
- **Enrich camera guidance:** `enrichRoutineScenes.ts` suggested only filming_angle /
  shot_type / b_roll — no camera; angle described as "camera angle".
- **0-schema confirmed** (all data already served; reuse existing routes) — no STOP.

---

## 1 · Numbering + structure
- **Grid header:** `PieceGrid.tsx` `G · PIECE GRID` → **`3 · CONFIRMED`** (faint
  "scenes × days").
- **4 · DAY → SCRIPT:** `ContentPipeline` now wraps `DailyLog` (the day's input
  preview) **and** the script-output placeholder under a single `4 · DAY → SCRIPT`
  heading — one coherent step, the CE-5 mount point sits directly beneath the day.
  The old orphaned "4 · SCRIPT OUTPUT" section is gone.

## 2 · QuestionLibrary off the page
- Removed the `<QuestionLibrary />` import + mount from `ContentPipeline`. **No
  component/route/table deleted** — the file, its CRUD routes, and the
  `operations_content_questions` table are untouched (0-schema). **Questions remain
  fully editable per scene:** the snapshot lives on the scene-row
  (`assigned_question_text`) and is edited in the **draft table's Question column**
  (`ScenifyDraft` — library-purple / proposed-new-amber, hand-edit detaches to
  proposed-new), exactly as before.

## 3 · One entity selector (no scolding)
- `ContentPipeline` header now renders **one `<select>`** bound to the shared
  `useOperationsEntity()` context (`setSelectedEntityId`) — it scopes the **whole
  pipeline**: sources, draft saves (entity derived server-side from the step), the
  grid, the day log, and piece creation.
- **Sensible default:** an effect ensures a **concrete** entity is always selected
  (`is_default` else first) — no "All", so the scolding gates never fire.
- **Grid dropdown merged in:** `PieceGrid` dropped its own `entityId` state +
  `<select>` + `/api/entities` fetch and now reads `selectedEntityId` from context
  (`visibleScenes`/`visiblePieces`/`+ day` all use it). The red
  "Select an entity (top of the Operations tab)" lines in `PieceGrid` + `DailyLog`
  are replaced with a neutral "Pick an entity in the pipeline header" (effectively
  unreachable now).

## 4 · Full shot card in the grid scene column
- `PieceGrid` left column is now the **full shot card**, wrapped + compact: a
  `shotLine(label,value)` helper renders `activity + time`, then **camera · angle ·
  shot · b-roll · narrative** (each only if filled), then the **question** (purple).
  The `<th>` is `whitespace-normal break-words w-[300px]` — no clipped text. Reads
  every saved draft field per scene (the grid GET already returns all scalars).

## 5 · Draft table wrapping
- `ScenifyDraft` **camera / angle / shot type** cells converted from `<input>`
  (single-line, "eye-level straigh…") to **wrapping `<textarea rows={2} resize-y>`**
  (same `cellInputClass`). B-roll / narrative / question were already textareas — now
  **no draft cell truncates.**

## 6 · Camera semantics (iPhone rig + placement)
- `enrichRoutineScenes.ts`: **CAMERA is now an AI-suggested field**
  (`camera_needed`) defined as **rig + placement assuming iPhone** — schema
  description + a SYSTEM_PROMPT craft line: *"He shoots iPhone-ONLY … never name a
  different device … 'tripod bedside', 'handheld', 'desk tripod', 'selfie stick'."*
  `ScenifyDraft` consumes the suggestion (prefills the wrapping Camera cell).
  **Scope note:** the brief said "prompt-text change only" — I interpreted that as
  *define camera in the prompt + let the model suggest it; do **not** build the gear
  library*. The change is confined to the enrich file's prompt/schema text + the
  draft's prefill mapping (both in the listed scope).
  **⚠️ FLAG (follow-up, not built):** device variety (lenses/bodies/other cameras)
  belongs to a future **gear library** — out of scope here.

---

## Verify
- **0-schema:** no `prisma/schema.prisma` in the diff. ✅
- **No new write paths:** no `api/` files changed; draft still saves via
  `/content/scene-rows`, grid via `/content/grid/cell`+`/piece`, enrich via the
  existing `/content/enrich-routine` (per-routine). ✅
- **Flat law:** no drawer/modal/expander added; the draft renders inline when
  routines are selected (the intended pipeline reveal, no hide/show toggle). ✅
- **Shared components unmounted-not-deleted:** `QuestionLibrary` file/routes/table
  intact (off-page only); `ScenifyModal`/`ScenifyButton`/`SectionG_Content`/
  `ContentTable`/`RoutineRow` **not in the diff**. ✅
- **Existing palette:** `brand-purple`/`bg-bg-row`/`border-border-light`/`font-mono`,
  amber for proposed-new; no new tokens. ✅
- **tsc:** `npx tsc --noEmit` → **exit 0 (0 errors)**. **eslint:** → **exit 0**.

## Hard-constraint compliance
| Constraint | Status |
|---|---|
| 0-schema | ✅ |
| No new write paths | ✅ existing routes only |
| Flat law | ✅ inline, no hidden UI added |
| Existing palette | ✅ |
| Shared components unmounted not deleted | ✅ QuestionLibrary off-page; no shared edits |
| tsc + lint clean | ✅ both exit 0 |
| Diff scoped to content surfaces + enrich prompt | ✅ 5 files, all in scope |

## git diff scope
`ContentPipeline.tsx` (entity selector, library off-page, 3·/4· restructure),
`PieceGrid.tsx` (3·CONFIRMED, context entity, full shot card), `ScenifyDraft.tsx`
(wrapping camera/angle/shot + camera suggestion), `DailyLog.tsx` (gate wording),
`lib/ai/enrichRoutineScenes.ts` (iPhone-rig camera). **No schema, no routes.**

---

## Result
The Content tab now reads as a coherent numbered pipeline — **1 · SOURCES → 2 ·
SCENIFY DRAFT → 3 · CONFIRMED → 4 · DAY → SCRIPT** — governed by **one entity
selector** in the header (no scolding, sensible default; the grid's own dropdown is
gone). The grid's left column is the **full wrapped shot card** (camera/angle/shot/
b-roll/narrative/question), draft text cells **wrap** (no truncation), the question
library moved **off-page** (still fully editable per scene in the draft), and the
enrich prompt now treats **CAMERA as iPhone rig + placement** (gear library flagged
as a follow-up). 0-schema, no new write paths, flat law intact; tsc + eslint exit 0.
