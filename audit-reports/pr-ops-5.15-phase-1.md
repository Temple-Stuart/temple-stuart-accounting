PR-OPS-5.15 PHASE 1 AUDIT REPORT
================================

BRANCH STATUS
- main top 3: `5b9afab` (merge #560 PR-Ops-5.13 routine-capture-gap-audit) → `b528629` (5.13 audit commit) → `a26ccd7` (merge #559 PR-Ops-5.12 daily-plan-list audit).
- current branch: `claude/pr-ops-5.15-north-star-column-audit`

A. OVERFLOWING COLUMN

**`operations_north_star` model** — `prisma/schema.prisma:2936-2958`. FULL field list:

| # | line | field | type | cap? |
|---|------|-------|------|------|
| 1 | 2937 | `id` | `String @id @default(uuid()) @db.Uuid` | — |
| 2 | 2938 | `user_id` | `String @unique` | unbounded |
| 3 | 2939 | `mission_statement` | `String? @db.Text` | **unbounded** |
| 4 | **2940** | **`life_stage`** | **`String? @db.VarChar(50)`** | **⚠ CAP 50** |
| 5 | 2941 | `core_values` | `String[] @default([])` | unbounded array (postgres `TEXT[]` per migration) |
| 6 | 2942 | `guiding_principles` | `String? @db.Text` | **unbounded** |
| 7 | 2943 | `one_year_target` | `String? @db.Text` | **unbounded** |
| 8 | 2944 | `three_year_target` | `String? @db.Text` | **unbounded** |
| 9 | **2945** | **`current_location_label`** | **`String? @db.VarChar(200)`** | **⚠ CAP 200** |
| 10 | **2946** | **`current_timezone`** | **`String @default("America/Los_Angeles") @db.VarChar(64)`** | **⚠ CAP 64** |
| 11 | 2947 | `review_cadence_days` | `Int @default(90)` | — |
| 12 | 2948 | `last_reviewed_at` | `DateTime? @db.Timestamptz(6)` | — |
| 13 | 2949 | `next_review_at` | `DateTime? @db.Timestamptz(6)` | — |
| 14 | 2950-52 | audit cols | — | — |

**Cross-verified against the source-of-truth migration `prisma/migrations/20260508000000_pr_ops_1_5_north_star/migration.sql:26-49`** — schema.prisma and the migration agree exactly on every column type.

**Long-prose fields already TEXT (no fix needed):**
- `mission_statement` (line 2939) — already `@db.Text` ✅
- `guiding_principles` (line 2942) — already `@db.Text` ✅
- `one_year_target` (line 2943) — already `@db.Text` ✅
- `three_year_target` (line 2944) — already `@db.Text` ✅
- `core_values` (line 2941) — `String[]` arrays in Prisma + Postgres map to `TEXT[]` by default (no element-level VarChar), confirmed at migration `:31` (`core_values TEXT[] NOT NULL DEFAULT '{}'`). Each element unbounded ✅.

**VarChar fields with caps (potential overflow culprits):**
- **`life_stage`** — `VARCHAR(50)` at line 2940 / migration `:30`. **Most likely culprit.** Per the migration comment (`:60-62`): "Free-text life-stage label chosen by the user (e.g. 'building', 'scaling', 'transitioning')." A 50-char cap is generous for one-word labels but trivially exceeded by a sentence like "Building Temple Stuart accounting platform while preparing for Cal State LA bachelor's program" (108 chars). Alex's institutional voice typically writes phrase-level life-stage descriptors that exceed 50.
- **`current_location_label`** — `VARCHAR(200)` at line 2945 / migration `:35`. Less likely — 200 chars is roomy for a location label, but possible if Alex wrote a compound descriptor ("San Francisco Bay Area, currently between trips for Temple Stuart Trading and Cal State LA enrollment, primary tz America/Los_Angeles" = 153 chars; borderline).
- **`current_timezone`** — `VARCHAR(64)` at line 2946. Effectively safe — IANA timezone strings max out around 30 chars ("America/Argentina/Buenos_Aires" = 30); no realistic overflow path.

**Likely culprit (the column the error references but Postgres can't name):** **`life_stage`** is by far the most probable, given the 50-char cap and the institutional-voice writing style. `current_location_label` is a distant second possibility. The "Column: (not available)" pattern in Prisma's `P2000` error is a known Prisma quirk — the column name isn't exposed when the constraint violation happens at the type level inside the upsert; the migration was the only way to verify which columns are capped.

B. SAVE PATH

**Upsert location:** `src/app/api/operations/north-star/route.ts:100-108` — POST endpoint, idiom `prisma.operations_north_star.upsert({ where: { user_id }, create: { ... }, update: data })`.

**Fields written (all 9 user-editable fields, normalized in `data` at `:81-93`):**
- `mission_statement`, `life_stage`, `guiding_principles`, `one_year_target`, `three_year_target`, `current_location_label` — each normalized via `norm()` at `:75-79` (trim, empty → null).
- `core_values` — filtered to non-empty strings at `:84-86`.
- `current_timezone` — `norm()` + fallback to `'America/Los_Angeles'` at `:91`.
- `review_cadence_days` — validated as positive number at `:59-66`.

**Client-side truncation: NO.** The `norm()` helper (`:75-79`) only trims whitespace and nulls empties — it does NOT truncate length. Whatever the user typed goes to Prisma full-length. Prisma then tries to insert it into the VarChar-capped column, Postgres rejects.

**API-side length validation: NO.** The POST endpoint validates `review_cadence_days > 0` (`:61`) and `core_values` is-array (`:68`) but has **no `maxLength` / character-count check** on any string field. So the request reaches the DB and fails there with the column-overflow error from the prompt.

**Form file:** `src/components/workbench/operations/SectionB_NorthStar.tsx`. Reads/writes the same fields:
- `mission_statement` (`:47`/`:243`)
- `life_stage` (`:47`/`:253`)
- `core_values` (`:48`/`:267`) — chip-style multi-select via `toggleValue` (`:105-115`)
- `guiding_principles` (`:49`/`:299`)
- `one_year_target` / `three_year_target` (`:285`/`:291`)
- `current_location_label` (`:52`/`:258`)

**Form maxLength enforcement: NONE.** Confirmed by `grep -n "maxLength" src/components/workbench/operations/SectionB_NorthStar.tsx` returning zero matches and `grep -rn "maxLength" src/components/workbench/operations/` returning zero north-star-related hits. So the form accepts arbitrary-length input, the API does no length validation, and the DB rejects on VarChar overflow — a clean three-layer failure path: UI permits → API forwards → DB rejects. This means **widening the DB columns is the correct single fix** (no parallel UI/API truncation needed; the absence of UI caps is correct given long-form fields are already TEXT).

C. NORTH STAR → PROJECT AI PROMPT (the critical question)

**Definitive answer: NO. The North Star is NEVER read by any AI module today.**

**Evidence (exhaustive grep):**
- `grep -rn "north_star\|northStar\|north-star\|NorthStar\|north star" src/lib/ai/` → **zero matches.**
- `grep -rn "north_star\|northStar\|north-star\|NorthStar\|north star" src/app/api/operations/ai/` → **zero matches.**
- `grep -rn "operations_north_star\|northStar\|NorthStar" src/` repo-wide returns only the following 4 categories of reference (verified file-by-file):
  1. **The North Star surface itself** — `src/components/workbench/operations/SectionB_NorthStar.tsx`, `src/components/workbench/operations/types.ts` (the `NorthStar` interface).
  2. **The North Star endpoints** — `src/app/api/operations/north-star/route.ts` (GET + POST), `src/app/api/operations/north-star/review/route.ts` (review attestation).
  3. **The Operations page mount** — `src/app/operations/page.tsx:11,17` imports + renders `<SectionB_NorthStar />`.
  4. **Audit enum allowlist** — `src/app/api/audit-log/route.ts:48-50` (lists `operations_north_star_{created,updated,reviewed}` for audit filtering).
- No reads from inside `src/lib/ai/generateProjectDesign.ts`, `src/lib/ai/generateProjectTasks.ts`, or any sibling AI helper.

**`generateProjectDesign.ts` system prompt context inputs (`:97-115`):** the AI receives ONLY:
- `projectTitle`
- `goalItems`
- `problemItems`
- `diagnosisItems`

— and a hardcoded `PROJECT_DESIGN_EXEMPLAR` (Student Loan few-shot). **No call to `prisma.operations_north_star`, no field interpolation.**

**`generateProjectTasks.ts`** — same input set (per `src/lib/ai/generateProjectTasks.ts`). No North Star read.

**Does the column bug degrade AI task quality? NOT CURRENTLY.**
- The AI never sees the North Star, so the column overflow ONLY blocks the user's ability to save the North Star UI form.
- The damage is "the vision lives in Alex's head, not in the DB" — not "the AI scopes projects against a truncated vision".
- Phase 2 of THIS PR is a clean storage fix; AI quality is unaffected because the AI was never wired to read it.

**Future enhancement (NOT IN SCOPE — flagged for Alex):**
- Wiring the North Star (especially `mission_statement` + `core_values` + `guiding_principles` + `one_year_target` / `three_year_target`) INTO `generateProjectDesign.ts` and `generateProjectTasks.ts` as ambient context would be architecturally desirable: every generated project would be scoped against the user's vision rather than treating the project in isolation. This pairs naturally with the PR-Ops-5.14 prompt-grammar update — both touch the AI system prompt + few-shot exemplar. **Recommend a separate future PR** ("PR-Ops-X.X: feed North Star into AI scoping context") rather than folding into this fix. Don't bundle a feature into a bug fix.

D. FIX

**Columns to widen `VarChar` → `Text`:**
- **`life_stage`** (currently `VARCHAR(50)`) — widen to `TEXT`. The migration comment at `:60-62` calls it "free-text life-stage label" — "free-text" semantically means unbounded; 50 chars contradicts the intent.
- **`current_location_label`** (currently `VARCHAR(200)`) — widen to `TEXT`. Less urgent (200 chars is generous), but for consistency: any field the user composes in their own prose voice should be TEXT, full-stop. Belt-and-suspenders against Alex's "I write compound descriptors" pattern.

**Columns to LEAVE as VarChar (intentionally short):**
- **`current_timezone`** (`VARCHAR(64)`) — IANA timezone strings have a real upper bound near 30 chars; 64 is comfortable. Widening to TEXT adds no value and removes a soft-validation hint. Keep.

**ALTER statements (Alex runs via psql):**

```sql
-- PR-Ops-5.15: widen overflowing North Star prose columns from VarChar → Text.
-- Postgres ALTER COLUMN ... TYPE text is non-destructive when widening from
-- VARCHAR(n) to TEXT — existing values fit unchanged. No backfill, no data
-- loss, no app downtime required.

BEGIN;

ALTER TABLE operations_north_star
  ALTER COLUMN life_stage TYPE text,
  ALTER COLUMN current_location_label TYPE text;

COMMIT;
```

**Parallel `prisma/schema.prisma` changes (Phase 2 edits):**

```prisma
-  life_stage             String?   @db.VarChar(50)
+  life_stage             String?   @db.Text
...
-  current_location_label String?   @db.VarChar(200)
+  current_location_label String?   @db.Text
```

(`current_timezone` stays `@db.VarChar(64)`.)

**Prisma client regeneration:**
```
npx prisma generate
```

**Additive / no data loss: CONFIRMED.**
- Postgres `ALTER COLUMN ... TYPE text` from `VARCHAR(n)` is a metadata-only operation in modern Postgres (12+). Existing rows fit unchanged in the wider type; no row rewrite, no table lock beyond the brief catalog update.
- No backfill required (no defaults change).
- Reversible if needed: `ALTER COLUMN life_stage TYPE varchar(50)` would re-narrow — but ONLY if no existing row exceeds 50 chars. After the fix, Alex's full life-stage description will be in the column, so the reversal is gated on length. This is the expected one-way-door of widening: you can re-narrow until someone fills the wider space. Acceptable.

**Existing North Star rows (per Alex's report):**
- Alex tried to save → save FAILED → therefore the row in `operations_north_star` for Alex is **either absent** (no prior successful save) **or stale** (last successful save was a shorter prior version of the North Star, and the failed upsert from the report did NOT overwrite — Prisma rolled the failed transaction back).
- Either way, after Phase 2 ships, Alex re-clicks save → the upsert succeeds because the columns now fit → audit log writes `operations_north_star_created` or `_updated` accordingly.
- **No data loss path exists** because the failed save never landed; the row state is whatever it was before the failed attempt.

**Phase 2 scope (for the implementation PR):**
1. `prisma/migrations/<timestamp>_pr_ops_5_15_north_star_widen/migration.sql` (new) — the ALTER TABLE above. ~10 lines including header comment.
2. `prisma/schema.prisma` (modify) — 2 line edits in `operations_north_star`. Net 0 lines added; just type swaps.
3. `npx prisma generate` (run, regenerate client). No type-shape change for the `NorthStar` TS interface — `String?` stays `String?` in TypeScript regardless of `@db.VarChar(N)` vs `@db.Text` (the constraint only exists at the DB layer).
4. No source code changes required. The form, the API, the types all stay identical.
- **Total: 2 schema files modified (1 new SQL, 1 schema.prisma diff). Zero source files. ~12 lines total. Pure schema widening.**

**Open decisions for Alex:**
1. **Widen `current_location_label` too, or only `life_stage`?** Recommend YES, widen both — consistency principle ("free-text prose → TEXT, no caps"). The cost is zero and the bug-class is closed forever.
2. **Add UI `maxLength` as a soft cap, e.g. 5000 chars per field?** Recommend NO — none of the other prose surfaces in the app (project description, routine description, item notes) enforce UI maxLength on TEXT-backed fields. Don't introduce a new convention here.
3. **Feed the North Star into the project AI prompt — fold in here or separate PR?** Recommend SEPARATE PR. This bug-fix PR is "the North Star can be saved"; the AI-wiring is "the North Star drives project scoping" — different concept, different review surface, different blast radius. Hand-off note for Alex: that future PR would touch `generateProjectDesign.ts` + `generateProjectTasks.ts` and parallels nicely with the PR-Ops-5.14 prompt-grammar update.
4. **Audit-trail: should the widening migration write an `_updated` audit row?** Recommend NO — migrations are infrastructure, not user actions. The audit log captures user-initiated mutations; ALTER TABLE is the developer's responsibility, tracked in git history + the migration directory.

NO SOURCE FILES MODIFIED. Audit report at audit-reports/pr-ops-5.15-phase-1.md.
