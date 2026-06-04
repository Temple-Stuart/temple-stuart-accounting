# OPS-CE-5 — The Script Generator (S4 comes alive)

**Branch:** `claude/ops-ce-5` (off `main`; CE-8G merged)
**Date:** 2026-06-03
**One concept:** generate the day's reel VOICEOVER from the answers + task record, in
Alex's voice — human-gated, on the surface, saved to the piece. Mirrors the AI pattern
(immutable `operations_ai_usage` row, auth + `requireTier('ai')`).

> ⚠️ **MIGRATION LEADS, MERGE FOLLOWS.** This adds `operations_content_pieces.script`.
> The committed code reads/writes it (and the grid GET returns all piece scalars), so
> **prod needs the column before deploy** — run the SQL in Azure, verify with `\d`,
> `npx prisma generate`, **then** merge.

---

## Schema (dual-write — the only change)
`prisma/schema.prisma`, `operations_content_pieces`:
```diff
   source_ai_usage_id String?  @db.Uuid
+  script             String?  @db.Text
   created_at         DateTime @default(now()) @db.Timestamptz(6)
```
Nullable (human-gated; last-write-wins, like the project `design` field — the per-run
reasoning lives immutably in `operations_ai_usage`). `npx prisma validate` → **valid 🚀**.

### Exact psql (Alex runs in Azure FIRST)
```sql
BEGIN;
ALTER TABLE operations_content_pieces ADD COLUMN script text;
COMMIT;
```
Then `\d operations_content_pieces` (confirm `script | text`), `npx prisma generate`,
**then** merge.

---

## The prompt assembly — voice contract encoded verbatim (`lib/ai/generateReelScript.ts`)
`SYSTEM_PROMPT` encodes the contract exactly:
- **Alex's raw voice** — plain language a simple person understands; fun, playful;
  built for wild engagement (hook hard, momentum, strong close); "talk like he'd say
  it out loud."
- **HARD BAN** — academic/pretentious verbiage, corporate tone, try-hard vocabulary,
  platitudes; "if a sentence sounds like an essay … rewrite it like he'd actually say
  it."
- **THE LOCKED REEL FORMAT** — (1) HOOK; (2) BODY = planning/goals/stakes/mindset
  answers over the day's life footage in order; (3) PROOF-BURST = the execution (task
  blocks: built / planned-vs-actual / shipped) compressed near the END; (4) CLOSE =
  day score + "catch me tomorrow" from the closing answers.
- **OUTPUT SHAPE** — scene-mapped beats tagged `[scene N · activity]`; ~2:00 / 280–320
  words; **ONLY** what Alex answered + the real task record; **NEVER fabricate** events,
  feelings, or numbers.

The **user message** is ONLY the real day: each answered scene
(`[scene N · activity · time]` + narrative / b-roll / question / **ANSWER**) in clock
order, then the **execution record** (each task: status · planned-vs-actual times).
Run through **`recordUsage`** (`purpose='reel_voiceover_generation'`,
`target_table='operations_content_pieces'`, `target_id=piece.id`, Sonnet-4, temp 0.85)
→ immutable `operations_ai_usage` row + audit; returns the prose text.

## Day load + ordering (`generate-script/route.ts`)
- auth: `getVerifiedEmail` → user → **`requireTier(user.tier, 'ai')`** (mirrors enrich).
- piece ownership → defensive 404.
- **answered scenes** = `operations_content_takes` for the piece with non-empty
  `script`, joined to `scene` (+ `routine_step` activity/time/order); **cross-entity**
  (a take can join a scene of any entity — CE-8). Ordered by the **shared
  `compareDayOrder`** (midnight wraps to day-end), numbered 1..N.
- **task record** = `operations_daily_plan_items` for `piece.piece_date` (+
  `calendar_blocks`, `task`, project names) — planned + committed + DONE (planned vs
  actual), ordered by block time.

## Fail-loud (zero fabrication)
If **no answered scenes** → **400 `InsufficientInput`** with the exact message:
*"This day has no answers yet. Answer the scenes for this day … the reel is built only
from what you actually logged."* Never generates from nothing.

## Save (`grid/piece/[pieceId]/route.ts` — new PATCH)
`PATCH /content/grid/piece/[pieceId] { script }` — user-scoped, **defensive 404**,
trims (empty→null), persists `piece.script`, `writeAuditLog` under **`system_other`**
("Saved reel script on content piece …") with before/after. **Audit-enum flag
(carried):** no `operations_content_piece_*` enum exists — follow-up to add it.

## S4 surface (`ScriptGenerator.tsx`, mounted in ContentPipeline)
Replaces the placeholder. Resolves the day's canonical piece (cross-entity, like
DailyLog), counts its answers, and:
- **"generate script"** — disabled with a **reason** when there's no piece ("start the
  day's log") or zero answers ("answer the day's scenes first"); else POSTs and renders
  the script **inline** (flat law) in an **editable** textarea with the scene tags +
  **word count + ~read-time**.
- **"save to the day"** → the PATCH → `piece.script`. A saved script renders on load.
- **"↻ regenerate"** — a fresh run (new `ai_usage` row); saving overwrites the draft.
Listens to `CONTENT_DAY_PLAN_CHANGED_EVENT` + `CONTENT_SCENES_CHANGED_EVENT` so the
disabled state / saved script stay truthful. Contrast standard (purple header, white
textarea `border-brand-purple/40` + focus ring `brand-purple/20`).

---

## Verify
- **Mirrors the AI pattern:** `recordUsage` immutable version row; auth +
  `requireTier('ai')`; preview-on-surface → human edit → explicit save. ✅
- **Voice contract verbatim** in `SYSTEM_PROMPT`. ✅
- **Cross-entity day load, dayOrder-ordered;** body = answers, proof-burst = task
  record. ✅
- **Fail-loud, zero fabrication:** 400 on no answers; user message carries only real
  data; prompt forbids fabrication. ✅
- **Human-gated:** generate returns to the surface; nothing persists until "save". ✅
- **tsc** exit 0; **eslint** exit 0 (all new files + ContentPipeline).
- **Schema is the only schema change;** SQL provided; migration-first reminder. ✅

## git diff scope
Schema: `operations_content_pieces.script`. New: `lib/ai/generateReelScript.ts`,
`content/generate-script/route.ts`, `content/grid/piece/[pieceId]/route.ts` (PATCH
save), `content/ScriptGenerator.tsx`. Modified: `content/ContentPipeline.tsx` (mount).
(+ this report.)

---

## Result
S4 is live: one **"generate script"** turns the selected day — answered scenes
(Activity + Narrative + B-Roll + Question + **Answer**) in clock order + the day's task
blocks (planned + DONE with actuals) — into the reel **voiceover in Alex's voice**
(hook → body over the life footage → rapid execution proof-burst → day-score + "catch
me tomorrow"), scene-tagged for editing. Human-gated: it renders on the surface,
editable, with word/read-time, and **saves to `piece.script`** only on Alex's action;
regenerate makes a fresh immutable `ai_usage` run. Fail-loud on an empty day; never
fabricates. **Migration leads, merge follows** — run the one-line `ALTER TABLE` in
Azure, verify `\d`, then merge. tsc + eslint clean.
