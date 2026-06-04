# OPS-CE-5B — Execution notes (anti-confabulation receipts for the script generator)

**Branch:** `claude/ops-ce-5b` (off `main`; CE-5 merged)
**Date:** 2026-06-03
**One concept:** ground the script's work claims in Alex's actual record. Task titles
are labels, not descriptions — without receipts the AI would articulate the work
infactually. Adds a DAY-AUDIT helper + an authoritative **execution_notes** input.

> ⚠️ **MIGRATION LEADS, MERGE FOLLOWS.** Adds `operations_content_pieces.execution_notes`.
> Run the SQL in Azure, verify `\d`, `npx prisma generate`, **then** merge — the grid
> GET returns all piece scalars + the code reads/writes the column.

---

## Schema (dual-write)
`operations_content_pieces`:
```diff
   script             String?  @db.Text
+  execution_notes    String?  @db.Text
   created_at         DateTime @default(now()) @db.Timestamptz(6)
```
`npx prisma validate` → **valid 🚀**.

### Exact psql (Alex runs in Azure FIRST)
```sql
BEGIN;
ALTER TABLE operations_content_pieces ADD COLUMN execution_notes text;
COMMIT;
```
Then `\d operations_content_pieces` (confirm `execution_notes | text`),
`npx prisma generate`, **then** merge.

---

## Voice-contract addition (`generateReelScript.ts` SYSTEM_PROMPT)
New **GROUNDING THE WORK (anti-confabulation — NON-NEGOTIABLE)** block:
- *"A task TITLE is a LABEL, not a description. You do NOT know what a task actually
  involved from its title."*
- *"The EXECUTION NOTES (when present) are the AUTHORITATIVE account of what got
  built/done. Where the notes and a task title differ, the NOTES WIN."*
- *"You may NOT state any work specific … not grounded in the EXECUTION NOTES, the task
  record, or Alex's answers."*
- *"If there are NO execution notes and the task titles are thin, keep the proof-burst
  HIGH-LEVEL — e.g. 'real hours into the build — receipts tomorrow' — and NEVER invent
  specifics. Honest-and-vague beats confident-and-wrong."*

## Prompt injection (user message)
A dedicated **EXECUTION NOTES** section is injected after the task record:
- **with notes:** *"Alex's authoritative receipts … this is the AUTHORITY; task titles
  are only labels; where this differs from a title, THIS wins:"* + the notes.
- **without notes:** *"(none provided — task titles are LABELS only; keep the
  proof-burst HIGH-LEVEL, never invent work specifics)."*
The closing instruction now reads *"Ground every work claim in the execution notes +
task record + answers."* `inputs_summary` records `execution_notes=yes|no`.

## Route (`generate-script`)
Loads the piece (already fetched) and passes **`executionNotes: piece.execution_notes`**
into `generateReelScript` — one line; the rest of the day-load is unchanged.

## PATCH extension (no new write route — cited)
`PATCH /content/grid/piece/[pieceId]` (CE-5) **extended** to accept `execution_notes`,
and — importantly — rewritten to **only update the fields present in the body**:
```
const data = {};
for (const f of ['script','execution_notes']) if (body[f] !== undefined) data[f] = trim||null;
```
So saving **execution_notes never clobbers the script** (and vice-versa) — the CE-5
version always wrote `script` (would have nulled it on a notes-only save). Same auth
(user-scoped, defensive 404), same `system_other` audit (description + before/after now
cover both fields). **Audit-enum flag carried** (no `operations_content_piece_*` enum).

## S4 surface (`ScriptGenerator`) — above the generate flow, flat + always visible
1. **DAY-AUDIT panel** — label *"Day-audit — run this in Claude Code, paste the output
   below"*, the prompt as a read-only `<pre>` mono block, and a **"copy prompt"** button
   (clipboard → visible **"copied ✓"** for 2s). The prompt is the exact static text
   (read-only git-log audit, plain words, note migration-pending, no jargon/paths/code).
2. **EXECUTION NOTES (optional)** textarea — label + *"what actually got built/done
   today, in your words — the receipts. The script grounds its work claims in this."* —
   **prefilled** from `piece.execution_notes`, saved via the extended PATCH
   (`{ execution_notes }`); disabled with a hint until the day's log exists.
Contrast standard throughout (purple labels, white inputs `border-brand-purple/40` +
focus ring `brand-purple/20`).

---

## Verify
- **Receipts ground the script:** route injects `execution_notes`; prompt makes them
  authoritative (notes win over titles); absent → high-level proof-burst, no invented
  specifics. ✅
- **PATCH extended, no new route; no clobber:** notes-only save leaves the script
  intact (field-conditional update). ✅
- **Day-audit copy works:** clipboard + "copied ✓". ✅
- **Human-gated, flat, contrast standard.** ✅
- **Migration-first;** schema is the only schema change. ✅
- **tsc** exit 0; **eslint** exit 0.

## git diff scope
Schema: `+execution_notes`. Modified: `lib/ai/generateReelScript.ts` (contract +
injection), `content/generate-script/route.ts` (pass notes),
`content/grid/piece/[pieceId]/route.ts` (PATCH extended, field-conditional),
`content/ScriptGenerator.tsx` (day-audit panel + notes input). No new routes. (+ report.)

---

## Result
The script generator is now anti-confabulation: Alex runs the one-paste **DAY-AUDIT**
in Claude Code, drops the receipts into **execution notes**, and the generator treats
them as the **authority** — task titles are labels, the notes win, and the script may
not state any work specific not grounded in the notes + task record + answers (no
notes → an honest high-level proof-burst, never invented). Saved on the piece via the
extended PATCH (no script-clobber, no new route). **Migration leads, merge follows** —
run the one-line `ALTER TABLE`, verify `\d`, then merge. tsc + eslint clean.
