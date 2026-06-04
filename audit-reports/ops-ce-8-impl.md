# OPS-CE-8 — Four-section Content pipeline

**Branch:** `claude/ops-ce-8` (off `main`)
**Date:** 2026-06-03
**One concept:** rebuild the Content tab to Alex's four-section spec —
**1 · INPUTS → 2 · AI SCRIPT MAP → 3 · ANSWER + RECORD → 4 · SCRIPT**.
**0-schema** (verified); the only backend change is generalizing the existing enrich
route (cameras param + virality prompt). Flat law; contrast standard on every touched
surface. **No script generation** (CE-5).

> ✅ `git diff` = 6 files, **no `prisma/schema.prisma`, no NEW api routes**
> (`enrich-routine` is the allowed enrich generalization). tsc exit 0; eslint exit 0;
> no `text-text-faint` added.

---

## Audit (cited)
- **Composition (post-CE-7C intent):** `ContentPipeline.tsx` is the page (mounted by
  `app/operations/content/page.tsx`), stacking sources → draft → grid → day.
- **Assign route (S1):** `POST /api/operations/daily-plan/items`
  (`daily-plan/items/route.ts`): requires `plan_date`, exactly one of `task_id` /
  `ad_hoc_title`; **task-linked derives `entity_id` from the task** (`:63`). `@@unique
  ([task_id, plan_date])` — re-add throws P2002 → the route returns **500** (no 409
  branch, `:248-252`). So a clean **assign-to-date exists** (no new write path);
  duplicates are handled client-side by a read (below).
- **Enrich signature:** `POST /content/enrich-routine {routine_id}` →
  `enrichRoutineScenes({...})` (`enrich-routine/route.ts:86`). Extended with `cameras`.
- **DailyLog columns + grid GET:** DailyLog (CE-6 timeline) had `# · Activity ·
  Question · B-Roll · Answer`; the grid GET returns `narrative_purpose` on each scene
  (`grid/route.ts` uses `include`, all scalars) — so the Narrative column needs no
  route change.
- **Piece-per-date:** `operations_content_pieces` rows are entity-scoped
  (`entity_id` + `piece_date`); DailyLog/PieceGrid filtered by the selected entity.
- **0-schema confirmed** — no STOP.

---

## S1 · INPUTS (cited)
Routines (click-to-select, ordered, **cross-entity**, entity-labeled) + project tasks
as **selectable inputs**. Each task gets an **"+ add to day"** action →
`POST /daily-plan/items { task_id, plan_date: date }` (entity derived server-side).
- **Duplicate-safe with zero new write paths:** `loadDayItems` (a **read** of
  `/daily-plan/items?from=date&to=date`) pre-marks tasks already on the day as
  "✓ on day" (an unblocked plan-item still shows "unscheduled", and re-adding would
  hit the unique constraint); `addTaskToDay` resyncs from that read on completion, so
  the **route is never modified** and the 500-on-duplicate path is avoided.
  **FLAG:** the daily-plan POST could return 409 on the unique violation (cleaner than
  500) — a future route polish, out of scope here.

## S2 · AI SCRIPT MAP (cited)
`ScenifyDraft` (the inline multi-routine table) gains:
- a **"cameras available"** free-text input (default `iPhone`) in the section header,
  passed per enrich call (`body: { routine_id, cameras }`). **No persistence** — the
  enrich route forwards `cameras` to `enrichRoutineScenes`; the **gear library is the
  schema follow-up (flagged)**.
- **Virality-tuned enrich prompt** (`enrichRoutineScenes.ts` SYSTEM_PROMPT): a new
  *"OPTIMIZE THE MAP FOR VIRALITY"* block — HOOK on the opening scene, visual VARIETY,
  PATTERN INTERRUPTS, a STRONG CLOSE — explicitly *"never from inventing, embellishing,
  or reordering steps; use ONLY the cameras provided."* `camera_needed` description +
  the user message now carry the AVAILABLE CAMERAS.
- Fully editable; **save unchanged** (the existing `/content/scene-rows` upsert).

## S3 · ANSWER + RECORD (merged 3+4; cross-entity)
One section: a **date picker at top** (local-date, default today; lifted to
`ContentPipeline`, shared with S1's add-to-day), then:
- **The answer timeline** (`DailyLog`, controlled `date` prop) gains a **NARRATIVE
  column** — per row `# · Activity(+time) · Narrative · Question · B-Roll · Answer`
  (narrative from the scene row; task blocks span `colSpan={6}`). Narrative is visible
  while answering, as Alex requires.
- Beneath it, the day-over-day grid **retitled "DAY-TO-DAY RECORD — scenes × days"**
  (full shot cards retained).

**Cross-entity day (decided + implemented, 0-schema):** the day is ONE reel.
- DailyLog + PieceGrid now **read cross-entity** (no entity filter on scenes / pieces /
  cells / task blocks).
- **Piece resolution:** the day's **canonical piece** = the first piece for the date
  across ALL entities (the grid GET orders `piece_date, created_at`, so this is
  deterministic). All cross-entity scenes answer against that one piece — the
  `/content/grid/cell` route checks **user** ownership, not entity match, so a
  personal scene's answer can attach to the canonical piece regardless of entity
  (**0-schema**). If no piece exists, "Start log" creates one under the selected
  entity. The header entity selector now governs **only** which entity a *new* piece
  is filed under.
- **Note:** legacy days that already have multiple per-entity pieces show the
  earliest as canonical; that is acceptable forward behavior (early-stage data).

## S4 · SCRIPT
A quiet dashed band, labeled with its inputs: *"generates from Scene + Narrative +
B-Roll + Question + Answer + the day's task blocks — next (CE-5)."* No AI this PR.

---

## Contrast standard (HOME-STYLE-PR-1) — pass
Every touched surface: section headers `text-brand-purple font-medium`; the cameras /
day / entity inputs are white bg with `border-brand-purple/40` + focus ring
`brand-purple/20`; body text `text-text-primary` / `text-text-muted`. **`text-text-faint`
swept to `text-text-muted` across `ContentPipeline` / `DailyLog` / `PieceGrid` /
`ScenifyDraft`** — `git diff | grep '^+.*text-text-faint'` → **none**. No new hex
(amber accents on task blocks are pre-existing palette).

---

## Verify
- **S1:** routines selectable/ordered/cross-entity-labeled; tasks "+ add to day" →
  daily-plan item route; pre-marked + resynced via read; zero new write paths. ✅
- **S2:** cameras input → enrich body; virality prompt; save unchanged. ✅
- **S3:** Narrative column present; date at top (controlled); cross-entity read;
  canonical-piece resolution; record retitled. ✅
- **S4:** input-labeled placeholder; no generation. ✅
- **0-schema:** no `prisma/schema.prisma`. **No new write paths:** only `enrich-routine`
  (allowed) modified among `api/`; writes reuse scene-rows / grid cell+piece /
  daily-plan item. **Flat law:** sections stacked, draft inline, no drawer/modal. ✅
- **tsc** exit 0; **eslint** exit 0.

## Hard-constraint compliance
| Constraint | Status |
|---|---|
| 0-schema (STOP-gate) | ✅ none needed |
| Zero NEW write paths (reuse daily-plan + upsert + piece) | ✅ enrich generalized; add-to-day reuses daily-plan item route |
| Flat law | ✅ stacked sections, inline draft |
| Contrast standard, no text-faint in diff | ✅ swept + verified |
| One page-level concept (the restructure) | ✅ |
| No script generation | ✅ S4 is a placeholder |
| tsc + lint clean | ✅ both exit 0 |

## Flags (follow-ups)
1. **Gear library** — persist cameras/lenses/devices (schema) so suggestions draw from
   stored gear instead of a per-call free-text field.
2. **daily-plan POST 409** — return 409 (not 500) on the `@@unique([task_id, plan_date])`
   violation for a cleaner add-to-day; worked around here with a read.
3. **Cross-entity piece canonicalization** — legacy multiple-per-date pieces; consider a
   read-time unify-by-`piece_date` if Alex accumulates per-entity dupes.

## git diff scope
`enrich-routine/route.ts`, `enrichRoutineScenes.ts`, `ContentPipeline.tsx`,
`DailyLog.tsx`, `PieceGrid.tsx`, `ScenifyDraft.tsx` (+ this report). No schema, no new
routes, no other tab.

---

## Result
The Content tab is now the four-section pipeline: **INPUTS** (selectable routines +
add-tasks-to-the-day), **AI SCRIPT MAP** (virality-tuned, gear-aware draft), **ANSWER +
RECORD** (one merged section — date at top, a narrative-bearing answer timeline over the
retitled day-to-day record, reading **cross-entity** so the day is one reel), and a
**SCRIPT** mount point labeled with its inputs. 0-schema, no new write paths, contrast
standard throughout; tsc + eslint exit 0. Gear library + a 409 on add-to-day are flagged
as follow-ups.
