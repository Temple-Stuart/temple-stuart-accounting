# OPS-GRID-PR-2 — Add the three missing scene-row fields

**Branch:** `claude/ops-grid-pr-2` (off `main`, which already has PR-1 merged — PR #720, `578ee127`)
**Date:** 2026-06-03
**One concept:** add Alex's three missing shot-list columns to the scene-**row** table —
`shot_type`, `b_roll`, `narrative_purpose`. **Additive, nullable, schema-only.**
Per `audit-reports/ops-content-table-audit.md` (scene-column gap).
**No piece table, no cell table, no view, no route/component change** — those are later PRs.

---

## 0. Dependency check (audit before action)
PR-2 targets `operations_content_scenes` **as renamed by PR-1** (the former `takes` table, per
`routine_step`). Confirmed PR-1 is **merged into `main`** (PR #720, merge `15b7d7f5`, commit
`578ee127`), so `main` already carries the renamed row model `operations_content_scenes`
(`prisma/schema.prisma:2896`). Branching from `main` is therefore correct — the table this PR
extends exists there under the right name.

---

## 1. Audit — current scene-row model (cited) + the gap

`model operations_content_scenes` — `prisma/schema.prisma:2896-2914`, grain = **per routine_step**
(`routine_step_id String @unique @db.Uuid :2900`). Fields present **before** this PR:

| Field | Line | Type | Maps to Alex's reel column |
|---|---|---|---|
| `filming_location_specific` | `:2901` | `String? @db.VarChar(200)` | (location detail) |
| `camera_needed` | `:2902` | `String? @db.VarChar(200)` | **Camera** |
| `filming_angle` | `:2903` | `String? @db.VarChar(200)` | **Angle** |
| `notes` | `:2904` | `String? @db.Text` | (notes) |

Time / Activity / Scene# live on `operations_routine_steps` (per the audit), so the only reel
columns **missing from the scene row** are **Shot Type, B-Roll, Narrative-Purpose**.

**Confirmed absent:** `grep -nE 'shot_type|b_roll|narrative_purpose' prisma/schema.prisma`
returned **no matches** anywhere in the schema before this change.

**Convention mirrored:** short categorical labels use `String? @db.VarChar(200)`
(`camera_needed :2902`, `filming_angle :2903`); free text uses `String? @db.Text`
(`notes :2904`). The three new columns follow exactly that split.

---

## 2. The change

### schema.prisma diff (3 nullable columns added; nothing else)
```diff
@@ model operations_content_scenes @@
   filming_angle             String?  @db.VarChar(200)
+  shot_type                 String?  @db.VarChar(200)
   notes                     String?  @db.Text
+  b_roll                    String?  @db.Text
+  narrative_purpose         String?  @db.Text
   created_at                DateTime @default(now()) @db.Timestamptz(6)
```
- `shot_type` → `VarChar(200)` (sibling of `camera_needed`/`filming_angle` — a short label),
  placed next to the other shot descriptors.
- `b_roll`, `narrative_purpose` → `Text` (sibling of `notes` — free prose; narrative_purpose =
  "what this captures/says"), placed next to `notes`.
- All three **nullable** (`String?`) — existing rows have no values, so **no backfill, no
  `NOT NULL`, no default**. Field-order placement is cosmetic (Postgres appends physically).

### The psql ALTER — Alex runs this in Azure **BEFORE** merge (transaction-wrapped)
```sql
BEGIN;
ALTER TABLE operations_content_scenes ADD COLUMN shot_type varchar(200);
ALTER TABLE operations_content_scenes ADD COLUMN b_roll text;
ALTER TABLE operations_content_scenes ADD COLUMN narrative_purpose text;
COMMIT;
```
Types match the schema declarations exactly: `@db.VarChar(200)` → `varchar(200)`,
`@db.Text` → `text`. Columns are nullable (no `NOT NULL`/`DEFAULT`), so the `ADD COLUMN`s are
metadata-only — instant even on a populated table, no row rewrite.

---

## 3. Verify (cited)
- **3 nullable columns present on the right table:** `schema.prisma` now shows `shot_type`
  (VarChar 200), `b_roll` (Text), `narrative_purpose` (Text) inside
  `model operations_content_scenes` (`:2896`). All `String?` → nullable.
- **tsc:** `npx prisma generate` (schema valid) → `npx tsc --noEmit` → **exit 0**.
- **lint:** no `.ts/.tsx` files changed (`git status` = `M prisma/schema.prisma` only), so the
  ESLint scope is empty — **clean** by construction. No route/component/view touched.
- **Scope:** `git diff --stat` = `prisma/schema.prisma` only (+ this report). **No other
  model/table** modified; **no piece table, no cell table, no view, no route, no component.**
- **No fabricated data:** additive nullable columns; non-financial table; no INSERT/backfill.

---

## 4. ORDERING reminder (hard rule)
1. **Alex runs the psql `ALTER` in Azure FIRST** (the transaction in §2).
2. Then **`npx prisma generate`** (regenerate client against the extended schema).
3. **THEN merge** this PR (code that reads the columns deploys only after they exist).

prisma + raw SQL move in parallel; Alex runs psql; the columns exist in Azure before merge.

---

**git diff = `prisma/schema.prisma` (3 nullable columns) + this report.**
**Migration is run by Alex (psql) — not applied from the repo.** Additive nullable only; no data touched.
