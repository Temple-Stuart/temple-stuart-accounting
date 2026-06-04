# OPS-CE-3B — Scenify form: card-stack → editable TABLE (presentation only)

**Branch:** `claude/ops-ce-3b` (off `main`; CE-3 merged)
**Date:** 2026-06-03
**One concept:** reshape the Scenify form from a stack of per-step cards into a
single editable **table** — rows = routine steps, columns = the editable shot
fields — so it reads as one family with the PieceGrid below it (Alex: *"table is
more compact and easier to analyze,"* matches his Excel).
**Presentation only — no route, no logic, no schema, no payload change.**

> ✅ **0-schema, 0-route.** `git diff` = `ScenifyModal.tsx` (+ this report) only.
> Every CE-3 behavior preserved exactly (AI-suggest prefill, library/proposed-new
> badges, hand-edit→detach, the same upsert, the fail-loud no-steps message).

---

## STEP 1 — Audit (cited)

### Current Scenify render (before) — card stack
`ScenifyModal.tsx` rendered `steps.map(...)` as one bordered **card per step**
(`:305` `border border-border-light rounded p-2 ... bg-white`), each card a
`grid grid-cols-3` of stacked label+input pairs: `camera`, `angle`, `shot type`
(`<input>`), then full-width `b-roll`, `narrative purpose`, `question`
(`<textarea>`), with the question badge row. Field constants `inputClass`
(bordered input) + `labelClass` (faint uppercase label) at `:26-28`.

### State shape per step (the `Draft`, unchanged)
`Draft` (`:46-62`): `camera_needed`, `filming_angle`, `shot_type`, `b_roll`,
`narrative_purpose`, `assigned_question_id`, `assigned_question_text`,
`proposed_new`. Mutated only by `setField` (`:140`) and `setQuestionText` (`:147`,
the detach-to-proposed-new path). **None of this changed.**

### PieceGrid table styling matched (one family)
`PieceGrid.tsx:287-393`: `<div className="overflow-x-auto">` →
`<table className="border-collapse text-xs font-mono">`; header cells
`bg-bg-row border border-border-light px-3 py-2 ...` with the accent column header
in **`text-brand-purple font-semibold`** (`:297`); body cells
`border border-border-light p-0 align-top` with a borderless full-cell editor
(`:375-390`). CE-3B mirrors all of it: same `border-collapse text-xs font-mono`,
same `border-border-light` grid lines, same gray (`bg-bg-row`) header band, purple
column headers, borderless white cell editors with purple focus.

---

## STEP 2 — Reshape (what changed — render only)

Replaced the card-stack branch with a single table inside
`overflow-x-auto max-h-[460px] overflow-y-auto` (horizontal scroll on narrow
widths; vertical scroll preserved):

- **Header row** (`sticky top-0`, gray band, **purple uppercase labels**):
  `# · Activity · Camera · Angle · Shot Type · B-Roll · Narrative · Question`.
- **One `<tr>` per step:**
  - `#` — read-only step_order, `text-text-muted` centered.
  - `Activity` — a `<th scope="row">` (semantics + grid-family row header),
    prefilled from the step, **de-emphasized** (plain text, not an input) with the
    time muted beneath.
  - `Camera / Angle / Shot Type` — borderless `<input>` cells (`maxLength={200}`).
  - `B-Roll / Narrative / Question` — borderless `<textarea>` cells (`rows={2}`,
    `resize-y`), taller.
  - **Question cell** keeps the badge — **purple "from library"** /
    **amber "proposed new"** — above its editable textarea.
- **AI-suggest** button stays in the header area (`:267-274`, untouched).
- **Tokens:** only existing palette — `bg-bg-row`, `border-border-light`,
  `text-brand-purple`, `text-text-primary/muted/faint`, `bg-purple-50/40` focus,
  `brand-purple`/`amber` badges (same as CE-3). **Zero new colors.** New consts
  `headerCellClass` + `cellInputClass` replace the now-unused `inputClass`/
  `labelClass` (removed to keep lint clean).

### On column set (decision — flagged)
The brief lists columns *Activity / Camera Angle / Shot Type / B-Roll / Question*,
but the CE-3 form also makes **`camera_needed`** and **`narrative_purpose`**
editable and sends them in the save payload. The HARD CONSTRAINT is **identical
behavior/payload** — dropping those two columns would remove editability and
change the payload. So I **kept all five** shot fields as columns
(`Camera · Angle · Shot Type · B-Roll · Narrative`) plus `Question`. Nothing is
lost; the payload is byte-for-byte identical (proof below). The table is wider, so
horizontal scroll handles narrow widths (explicitly allowed by the brief).

---

## STEP 3 — Verify (cited)

- **Renders as a table; all fields editable:** `<table>` with one `<tr>` per step;
  `camera/angle/shot_type` `<input>`, `b_roll/narrative/question` `<textarea>`, all
  wired to the **unchanged** `setField` / `setQuestionText`.
- **AI-suggest prefill + badges + detach identical:** `handleEnrich` (`:163-220`)
  is **untouched**; the question cell still renders the purple/amber badge from
  `d.assigned_question_id`; `setQuestionText` still detaches to proposed-new on
  hand-edit. Verified no diff lines touch these handlers.
- **Save payload identical (cited proof):**
  `git diff ScenifyModal.tsx | grep '^[+-].*<payload key>:'` → **empty** — no
  payload key (`routine_step_id`, `camera_needed`, `filming_angle`, `shot_type`,
  `b_roll`, `narrative_purpose`, `assigned_question_id`, `assigned_question_text`,
  `routine_id`) was added, removed, or changed. `handleSubmit` (`:222-260`) still
  POSTs the same body to `/content/scene-rows`; `handleEnrich` still POSTs
  `{ routine_id }` to `/content/enrich-routine`. **Auth, routes, upsert unchanged.**
- **Fail-loud unchanged:** the no-steps branch still renders *"This routine has no
  steps yet — add steps on the Routines tab first."* (`:294-297`); the route's
  `InsufficientInput` 400 is untouched (not in this diff).
- **0-schema, 0-route:** `git diff --name-only` = `ScenifyModal.tsx` only.
- **tsc:** `npx tsc --noEmit` → **exit 0** (ScenifyModal clean).
- **lint:** `npx eslint ScenifyModal.tsx` → **exit 0** (removed the now-unused
  `inputClass`/`labelClass` so no unused-var errors).

---

## Hard-constraint compliance

| Constraint | Status |
|---|---|
| Presentation only | ✅ only the steps render branch + style consts changed |
| Identical behavior/payload | ✅ handlers untouched; payload-key diff empty (proof above) |
| Existing palette (purple headers, defined fields, white-on-gray, purple focus) | ✅ `text-brand-purple` headers, white cell editors, `bg-bg-row` header band, `focus:ring-brand-purple` — zero new colors |
| Diff scoped to the modal | ✅ `ScenifyModal.tsx` (+ report) |
| tsc + lint clean | ✅ tsc exit 0; eslint exit 0 |

---

## before → after (structure)
- **Before:** `steps.map →` one `<div>` card each, `grid grid-cols-3` of stacked
  label+input pairs (6 editable fields + badge), vertical card stack.
- **After:** one `<table className="border-collapse text-xs font-mono">`,
  sticky purple header row (`# · Activity · Camera · Angle · Shot Type · B-Roll ·
  Narrative · Question`), one `<tr>` per step with borderless white cell editors
  (purple focus) and the question badge in-cell — matching `PieceGrid.tsx:287-393`.

## git diff scope
`src/components/workbench/operations/content/ScenifyModal.tsx` (+ this report).
**No schema, no route, no other component.**

---

## Result
The Scenify form is now a compact editable table — rows are the routine's steps,
columns are the shot fields + the assigned question — styled to read as one family
with the PieceGrid beneath it (Alex's Excel mental model). Every CE-3 behavior is
preserved verbatim: AI-suggest prefills the cells, library/proposed-new badges
render in the question cell, hand-editing a question detaches it to proposed-new,
"save scenes" posts the **identical** payload to the **same** upsert, and the
fail-loud no-steps message is unchanged. Presentation-only; 0-schema, 0-route;
tsc + lint clean; diff scoped to the modal.
