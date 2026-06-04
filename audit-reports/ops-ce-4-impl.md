# OPS-CE-4 — Stage-2 answer flow (question-forward cell editor + Daily Log)

**Branch:** `claude/ops-ce-4` (off `main`; CE-1/2/3/3B merged)
**Date:** 2026-06-03
**One concept:** the **answering experience** — a cell = Alex's **answer** to the
scene's assigned question. Two surfaces: (a) reframe the grid cell editor to be
question-forward + compact; (b) a **Daily Log** view to answer a whole day top to
bottom. **Nothing generates here** — the voiceover from a day's answers is CE-5.
Per the confirmed design + `audit-reports/ops-content-engine-audit.md`.

> ✅ **0-schema, ZERO new write paths.** Storage unchanged — the answer is the
> take's existing `script` column. Reuses `POST /content/grid/cell` (save answer)
> and `POST /content/grid/piece` (create the day). Only labels/framing changed.

---

## STEP 1 — Audit (cited)

### Current cell editor — wrong framing + clunky
- `PieceGrid.tsx` opened the **full-height `ScriptDrawer`** for a cell (pre-change
  `:408-420`): `fixed right-0 top-0 h-full` panel with placeholder *"Write the
  script for this scene…"* (`ScriptDrawer.tsx:96`) — a giant empty drawer, and the
  wrong mental model (a cell is an **answer**, not a script).
- Cell click set `active = { scene, piece }` (`:381`) → drawer → `handleCellSave`
  (`:188-192`) → `upsertCell` (`:161-186`).

### The cell upsert route (reused, unchanged)
`POST /api/operations/content/grid/cell` (`grid/cell/route.ts`): validates
`scene_id`/`piece_id` UUIDs, **both parents must belong to the caller**
(defensive 404, `:66-74`), `entity_id` server-derived from the scene (`:77`),
upserts `operations_content_takes` by `@@unique([scene_id,piece_id])`
(`:84-97`), audits take_created/updated. Header: *"the ONLY write path to cells"*
(`:4-6`). **The `script` field stores the answer** (`:52-63`) — 0-schema.

### The day-create route (reused, unchanged)
`POST /api/operations/content/grid/piece` (`grid/piece/route.ts:28`): creates one
day-column for `{ piece_date, entity_id }` (entity owned → 404), audited.

### Scene fields available to show (all already served)
The grid GET (`grid/route.ts:49-66`) queries scenes with **`include`** (no
narrowing top-level `select`), so **every scalar** of `operations_content_scenes`
is returned — including **`assigned_question_text`** (CE-2/CE-3), `narrative_purpose`,
`b_roll`, plus `routine_step {step_order, activity, time_of_day}` for the label.
Grid GET also returns active scenes only (`routine_step.is_active`, CE-1).
**⇒ No API change needed** — the data is already there; the client types just
needed extending.

### 0-schema + zero-new-write-paths — confirmed (no STOP)
The answer reuses `take.script`; both write routes exist. Nothing new to migrate or
build server-side.

---

## STEP 2 — Reframe the cell editor

New **`AnswerEditor.tsx`** — a compact, question-forward form (shared by both
surfaces):
- header: `N. activity · date` (small).
- **the QUESTION, prominent:** `assigned_question_text` in a purple-accented card
  (`border-l-2 border-brand-purple bg-purple-50/40`); **fallback** to
  `narrative_purpose` ("scene purpose"); **else** the hint *"No question assigned —
  set one in Scenify."* — never a blank prompt.
- **b-roll cue:** small `🎥 b-roll: …` filming reminder (only if present).
- **answer textarea:** labeled *"your answer for today"* (not "script").
- Save semantics mirror `ScriptDrawer` (trim, empty→null, no-change→cancel without a
  write). `onSave(answer)` performs the **same** upsert.

In **`PieceGrid.tsx`**: swapped `ScriptDrawer` → a **compact** panel
(`w-[34%] min-w-[360px] max-w-[520px]`, auto-scroll, **no backdrop** so the grid
stays readable — same non-blocking pattern) rendering `<AnswerEditor>`, wired to the
**unchanged** `handleCellSave`. Extended the `SceneRow` type with
`assigned_question_text` / `narrative_purpose` / `b_roll` (already in the GET
payload). `ScriptDrawer` import dropped from PieceGrid (still used by the legacy
`SectionG_Content` table — untouched).

---

## STEP 3 — The Daily Log view

New **`DailyLog.tsx`**, mounted on `operations/content/page.tsx` (between
`QuestionLibrary` and `PieceGrid`):
- **Pick a day** (date input, default today). Entity from `useOperationsEntity()`.
- Loads the shared **grid GET** (scenes/pieces/cells) scoped to the entity.
- **Find-or-create the piece:** if no day-column exists for the date, shows
  *"No log started for {date}"* + a **"Start {date} log"** button → `POST
  /content/grid/piece` (explicit, no surprise write). Once it exists, the day lists.
- **Lists ACTIVE scenes in step order**, each row: a status bubble (✓ when answered,
  else the step number), `# + activity + time`, the **QUESTION**, and (collapsed) the
  answer text or *"tap to answer."* Tapping expands the **same `AnswerEditor`** inline.
- **Save per scene** → `POST /content/grid/cell` (the same upsert) → updates local
  cells, collapses.
- **Progress indicator:** *"{answered} of {total} answered."*
- Matches the grid family (`bg-white rounded border border-border shadow-sm`,
  `font-mono text-xs`, `brand-purple` accents, `bg-bg-row` empties) and the approved
  mock's shape.

---

## STEP 4 — Verify (cited)

- **Cell editor question-forward + compact + same upsert/payload:** `AnswerEditor`
  shows the question prominently; PieceGrid's panel is compact (not `h-full` empty);
  save still calls `handleCellSave → upsertCell → POST /content/grid/cell` with
  `{ scene_id, piece_id, script }` — **payload identical** (the answer rides the
  existing `script` field). ✅
- **Daily Log full pass works:** pick day → start-if-missing (piece route) → answer
  each scene (cell route) → progress + ✓ update; answers persist on the same cells. ✅
- **Answers appear in the grid cells (same data):** both surfaces write the same
  `operations_content_takes` row keyed by `(scene_id, piece_id)`; the PieceGrid
  reads `cell.script`. Answering in Daily Log shows in the grid and vice-versa. ✅
- **0-schema:** `git diff` has no `prisma/schema.prisma`. ✅
- **0 new write routes (cited reused):** no `api/` files in the diff;
  `/content/grid/cell` + `/content/grid/piece` reused as-is; **auth unchanged**. ✅
- **Home + other tabs untouched:** diff = `AnswerEditor.tsx`, `DailyLog.tsx` (new),
  `PieceGrid.tsx`, `content/page.tsx` only; `ScriptDrawer` + `SectionG_Content`
  (legacy table) untouched. ✅
- **No generation / no AI this PR:** no `recordUsage`, no AI route, no generate
  affordance anywhere in the diff. ✅
- **tsc:** `npx tsc --noEmit` → **exit 0**. **lint:** `npx eslint` on all 4 changed
  files → **exit 0**. ✅

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| A cell = the ANSWER; no generation / no AI this PR | ✅ AnswerEditor framing; zero AI calls |
| 0-schema | ✅ answer = existing `take.script` |
| Reuse existing upsert + piece-create (zero new write paths) | ✅ `/content/grid/cell` + `/content/grid/piece`, no api/ diff |
| Existing palette | ✅ `brand-purple`/`bg-bg-row`/`text-text-*`/`font-mono`, grid family |
| One concept (the answering experience) | ✅ cell reframe + Daily Log only |
| tsc + lint clean | ✅ both exit 0 |

---

## git diff scope
New: `content/AnswerEditor.tsx`, `content/DailyLog.tsx`. Modified:
`content/PieceGrid.tsx` (compact AnswerEditor panel + scene fields + doc),
`operations/content/page.tsx` (mount DailyLog). **No schema, no routes, no other
tab.**

---

## Result
Answering a scene is now question-forward: the cell editor leads with the scene's
assigned question (fallback narrative purpose, else a Scenify hint), shows the
b-roll as a small cue, and captures *"your answer for today"* in a compact panel —
no more giant empty "write the script" drawer. A new **Daily Log** lets Alex answer
a whole day top to bottom — pick the day (create it via the existing piece route if
new), then work down the active scenes with a *n of m answered* progress meter, each
expanding to the same editor. Every save reuses the existing cell upsert
(`take.script` stores the answer), so answers show identically in the grid.
**0-schema, zero new write paths, no generation** (that's CE-5); tsc + lint clean.
