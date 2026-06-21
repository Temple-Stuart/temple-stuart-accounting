# COA GROUND TRUTH — CODE SIDE AUDIT (read-only)

**Branch:** `claude/audit-coa-ground-truth` · **Date:** 2026-06-21 · **Scope:** what the CODE says about chart-of-accounts codes. Every claim cites `file:line`. DB truth is Alex's; this reports only code. No DB access, no row claims.

**KNOWN DB FACTS (given, used to test the code — not restated as findings):** 162 COAs, ~92% bare numeric; only 13 prefixed (P-6800/P-8161/P-8162/P-2200/P-4250 personal; B-5100..B-5170 sole_prop); **trading has ZERO prefixes**; 7-series = personal expense (no 7-series revenue); same bare code reused across entities, disambiguated by `entity_id`.

---

## HEADLINE VERDICT

**The code carries a split-brain on codes.** The **canonical lookup key is `(userId, entity_id, code)` with BARE codes** (the schema's `@@unique`, and what the seeds + most call sites use) — this matches the DB. **But a cluster of trading + travel sites query PREFIXED codes (`T-*`, `P-9xxx`, `B-9xxx`, `P-8xxx`) that the DB does not have** — those lookups find nothing. The seeds prove the prefixed-trading expectation is wrong: **seeds create bare trading codes, yet `commit-to-ledger`/`trading`/`robinhood-parser` look up `T-`-prefixed ones.** That IS the drift.

---

## 1. HOW CODE LOOKS UP A COA

**Canonical pattern — bare code, scoped by `(userId, entity_id, code)`** via the `@@unique` composite `userId_entity_id_code` or `{ userId, entity_id, code }`:
- `journal-entry-service.ts:78` `userId_entity_id_code: { userId, entity_id: entityId, code: accountCode }` — **the ledger-commit lookup** (bare, entity-scoped). EXISTS / REUSABLE.
- `journal-entry-service.ts:93` — same for the bank account. EXISTS.
- `chart-of-accounts/route.ts:106` `{ userId, entity_id: entityId, code }`. EXISTS.
- `chart-of-accounts/[id]/route.ts:37` `{ userId, entity_id, code, id: { not: id } }`. EXISTS.
- `bank-reconciliations/route.ts:152`, `position-tracker-service.ts:594`, `batch-trade-processor.ts:974,1217`, `stock-lots/commit:224`, `journal-entries/manual:52`, `operations/projects/[id]/tasks/route.ts:181` + `[taskId]/route.ts:249`, `seedDefaultCOA.ts:57`, `seed-entities.ts:72`, `admin/fix-entity-assignment:64,170` — all `code … + entity_id` (bare, entity-scoped). EXISTS / REUSABLE.
- **Entity-scoped via the `entity` RELATION (bare code + entity_type):** `tax/calculate:98` `{ userId, code, entity: { entity_type: 'sole_prop' } }`; `investment-transactions/commit-to-ledger:34` `{ userId, code: '1200', entity: { entity_type: 'trading' } }`. EXISTS (bare, scoped).

**VERDICT — the code EXPECTS BARE codes scoped by entity.** That is consistent with the DB and the schema `@@unique`. The conflicting sites are the **prefixed** ones below (§2) — that's the drift.

---

## 2. HARDCODED CODE LITERALS (the collision risk)

### (a) PREFIXED literals — the DRIFT (DB has only 13 prefixed; none trading)
- **Trading `T-*` lookups — BROKEN vs the DB (trading = zero prefixes):**
  - `trading/commit-to-ledger/route.ts:45,48,51` look up `code: 'T-1010' / 'T-4100' / 'T-5100'`, and `:57-59` push `T-1010/T-4100/T-5100` into a `missing[]` list. RISK — these find nothing; the seed created `1010/4100/5100` (bare, §5).
  - `trading/route.ts:108,111` filter `accountCode === 'T-3200' / 'T-3300'`. RISK.
  - `robinhood-parser.ts:548` `'T-4100'`, `:652` `'T-1200'/'T-1210'`, `:654` `'T-2100'/'T-2110'`. RISK (T-prefixed assignment of COAs that are bare in the DB/seed).
- **Travel `P-9xxx` / `B-9xxx` — GENERATED, likely absent as prefixed:**
  - `trips/[id]/commit/route.ts:53-67` GENERATES `const prefix = trip.tripType === 'business' ? 'B' : 'P'` then `` `${prefix}-9100` `` (flight), `-9200` (hotel/lodging), `-9300` (car), `-9350` (equipment)… RISK — these `P-9xxx`/`B-9xxx` are not among the DB's 13 prefixed (which are P-6800/8161/8162/2200/4250 + B-5100..5170).
  - `travelCOA.ts:30-196` is a large static map of `coaPersonal: 'P-9100'…'P-9700'` / `coaBusiness: 'B-9100'…'B-9700'`. RISK (same — prefixed 9xxx not in the known prefixes).
- **Personal `P-8xxx` — likely absent as prefixed:**
  - `cart-plan/route.ts:24,36,49,62` `coaCode: 'P-8150'/'P-8310'/'P-8320'/'P-8330'`; `meal-planner:114` string-matches `reply.includes('P-81')`. RISK — DB's only P- prefixes are 6800/8161/8162/2200/4250; `P-8150/8310/8320/8330` are not in that set.
- **`year-calendar/route.ts:131`** builds a transactions filter `accountCode: { in: homebaseCodes.map(c => 'P-'+c) }` — i.e. it prepends `P-` to every homebase code for the **`transactions` table** read, while the **ledger** read uses BARE `homebaseCodes` (`:169`). RISK / note: an internal bare-vs-`P-` split between the two tables; if `transactions.accountCode` isn't `P-`-prefixed for those codes, that filter under-matches.

### (b) BARE literals reused across entities — collision risk if a lookup is NOT entity-scoped
- `position-tracker-service.ts:141,190,367,712-713` `TRADING_CASH='1010'`, `STOCK_POSITION='1100'`; `batch-trade-processor.ts:966-967,1199` same; `:971` `PL_ACCOUNT = plCents>=0 ? '4100' : '5100'`. These are **bare** and the surrounding `findMany` is scoped by `userId + entity_id` (`position-tracker:594`, `batch-trade:974,1217`) → **correctly entity-scoped.** EXISTS / REUSABLE.
- **Collision note:** bare `4100` is `revenue` in BOTH personal ("Interest Income", `seed-coa-templates:33`) AND trading ("Trading Gains", `seed-coa-templates:14`); bare `5100` similarly. They are disambiguated ONLY by `entity_id`. Any `4100`/`5100` lookup **not** scoped by `entity_id` would be ambiguous. The bare trading lookups above ARE scoped (safe); flag any future bare lookup that drops `entity_id`.

**VERDICT:** every **prefixed** literal in §2(a) is a drift RISK against the DB; the **bare** literals in §2(b) are correct *because* they're entity-scoped — the danger is dropping `entity_id`.

---

## 3. 7-SERIES AS REVENUE — does code expect it?

**No 7-series revenue expectation in code.** Grep for `7xxx` near `revenue|income|credit` → **zero hits**. The 7-series is consistently treated as **expense**:
- `nomad-budget/route.ts:24-31` maps bare `7100`–`7800` to travel **expense** categories (Flights/Lodging/Vehicle/Activities/Equipment/Ground Transport/Meals/Tips).
- `seedDefaultCOA.ts:32-33` `{ code: '7100'/'7200', account_type: 'expense' }`.
- Revenue codes in code are the **4-series**: `seedDefaultCOA.ts:5-8` (`4000/4200/4500/4600` revenue); `seed-coa-templates.ts:32-34,99-100` (`4000/4100/4200` revenue). **MATCHES DB** (7xxx = expense; no 7-series revenue). No mismatch here.

---

## 4. PREFIX LOGIC — generated, validated, or convention?

**GENERATED inline at one site; otherwise static convention; NO central generator/validator.**
- **Generated:** `trips/[id]/commit/route.ts:53` `const prefix = trip.tripType === 'business' ? 'B' : 'P';` then string-concatenated into `` `${prefix}-9100` `` etc (`:56-67`). This is the only place a prefix is *computed*.
- **Static convention:** `travelCOA.ts:30-196` (hardcoded `P-9xxx`/`B-9xxx`); `cart-plan:24-62` (`P-8xxx`); trading `T-*` literals (§2a).
- **Comments acknowledging the convention (not enforcing it):** `travelCategories.ts:33` "the P-/B- prefix + null-business handling"; `schedule-c-service.ts:179` "no B- prefix — entity-scoped".
- **No validation:** no regex/guard that asserts a code's prefix matches its entity, and no central "make a code for entity X" utility. The `code` field is `VarChar(50)` with no format constraint (§5). — **MISSING** (prefix correctness is unenforced; each call site invents/assumes it).

---

## 5. SCHEMA + SEED

**Model** `chart_of_accounts` (`prisma/schema.prisma:147`):
- `code String @db.VarChar(50)` (`:151` within model — schema line offset) — **no format constraint** (bare or prefixed both valid). NOT VERIFIED as an enum (it isn't; it's free text).
- `account_type String @db.VarChar(50)` — **free string, NOT a Prisma enum** (values by convention: `revenue`/`expense`/`asset`/`liability`/`equity`, seen in seeds §5).
- `balance_type String @db.Char(1)` (`'C'`/`'D'`).
- `entity_id String` (required); `entity_type String? @db.VarChar(10)` (also on the COA, nullable); `module String? @db.VarChar(20)`.
- `@@unique([userId, entity_id, code])` — **the canonical lookup key**; same `code` reused across entities, keyed by `entity_id` (matches DB).
- `@@index([entity_id, account_type])`, `@@index([userId, code])`. **No `@@map`** → DB table `chart_of_accounts`.

**Seeds — MANY, NOT one canonical source (RISK):**
- `src/lib/seedDefaultCOA.ts` — bare personal codes incl. `4000/4200/4500/4600` (revenue), `7100/7200` (expense); creates with `balance_type` derived from `account_type` (`:67`).
- `src/lib/seed-coa-templates.ts` — `TemplateDefinition`s with BARE codes; `TRADING_STANDARD` (`:124`) seeds bare `1010/1100/1200/1210/2100/2110/3000/3200/3300/4100`(revenue) (`:5-14`); personal/business templates `4000/4100/4200` revenue (`:32-34,99-100`).
- `prisma/seed-trading-coa.ts` — bare trading set `1010/1020/1100/1200…/2010…/3010…` (`:7-26`), `account_type` asset/liability/equity. **All BARE — no `T-` prefix.**
- `prisma/seed-coa-complete.ts`, `prisma/seed-coa.ts` — additional seed scripts (NOT VERIFIED line-by-line; listed as seed sources).
- `src/lib/ensure-bookkeeping.ts`, `src/lib/seed-entities.ts`, `src/app/api/admin/seed-missing-coa/route.ts` — additional create/ensure paths.
- **On-demand creates:** `chart-of-accounts/route.ts` (POST stores user-provided `code` as-given), `year-end-close/route.ts` (closing accounts). NOT VERIFIED whether these enforce bare vs prefixed.

**Seed verdict:** **≥8 seed/create sources, all using BARE codes** (esp. trading: `seed-trading-coa:7` + `seed-coa-templates:5` → `1010/4100/…`). This is the proof that the `T-*` lookups in §2(a) are the broken side of the drift — the data is seeded bare; the prefixed lookups never match.

---

## CONSOLIDATED RISK LIST (file:line)

| # | Risk | Sites | Severity |
|---|---|---|---|
| 1 | Trading lookups use `T-*` (DB/seed are bare) | `trading/commit-to-ledger:45,48,51,57-59`; `trading/route:108,111`; `robinhood-parser:548,652,654` | **HIGH** — find nothing |
| 2 | Travel `P-9xxx`/`B-9xxx` generated/expected, not in DB's prefixes | `trips/[id]/commit:53-67`; `travelCOA.ts:30-196` | HIGH |
| 3 | Personal `P-8xxx` literals not in DB's prefixes | `cart-plan:24-62`; `meal-planner:114` | MED |
| 4 | `year-calendar` reads `transactions` with `P-`+code, ledger with bare | `year-calendar:131` vs `:169` | MED — bare/prefix split across tables |
| 5 | Bare `4100`/`5100` are revenue in BOTH personal & trading; safe only while entity-scoped | `seed-coa-templates:14,33`; consumers `batch-trade:971` (scoped) | MED — collision if any lookup drops `entity_id` |
| 6 | No central prefix generator/validator; per-site string concat | `trips/commit:53`; no validator | MED — drift will recur |
| 7 | ≥8 seed sources, no single canonical seed | §5 list | MED — seeds can diverge |

**No-mismatch confirmations:** 7-series is expense everywhere in code (§3) ✓; the canonical `(userId, entity_id, code)` bare lookup is correct and widely used (§1) ✓.

---

*Read-only audit. Code-side only — DB truth is Alex's. No code changed; this `.md` is the only file created.*
