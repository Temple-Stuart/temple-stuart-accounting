# ENTITY-SCOPED CASH — FEASIBILITY AUDIT (read-only)

**Branch:** `claude/audit-entity-cash` · **Date:** 2026-06-21 · **Scope:** how to TRUTHFULLY show operating
cash (Personal + Business, excl. Trading) given `accounts.entity_id` is nullable — without ever silently
dropping money. Read-only; every claim cites `file:line`. **No DB access** — code only; row checks flagged
for Alex. Unread = "NOT VERIFIED."

---

## ⚠ HEADLINE CORRECTION (truth-first — the question's premise is partly wrong)

The brief frames the options around filtering cash by **`accounts.entity_id`**. **CODE shows
`accounts.entity_id` (the FK) is NEVER set by any path → it is always NULL.** The only populated
account-level entity signal is **`accounts.entityType` (a string)**, set MANUALLY and often null. So:
- Filtering cash by `accounts.entity_id` would match **nothing → operating cash = $0** (catastrophic).
- Any entity-scoping of cash must use **`accounts.entityType`**, not `entity_id`.

This reframes Q4 entirely (below).

---

## VERDICT TABLE (Q1–Q5)

| Q | Finding | Key `file:line` | Status |
|---|---|---|---|
| **Q1 Current cash query** | `SUM(currentBalance)` over ALL user accounts, no entity filter | `runway/route.ts:97-101` | **COMBINED** (no split) |
| **Q2 Accounts entity attribution** | `entity_id` FK NEVER set (always null); `entityType` string set MANUALLY, often null | `schema:48-49`; `exchange-token:114-130`; `update-entity:38-41` | **`entityType` only** |
| **Q3 Trading account** | No code auto-tags trading; only manual `entityType='trading'`; trading ledger cash = COA 1010 (not a Plaid acct) | `update-entity:24`; `commit-to-ledger` | **MANUAL / DB-fact** |
| **Q4 Null-cash risk** | Filtering by `entity_id` → $0; by `entityType IN (...)` → drops nulls; exclude-trading keeps nulls | (analysis below) | **Option (b)** |
| **Q5 Reconciliation** | Burn excludes trading by `coa.entity_id`; cash by `accounts.entityType` — different keys, same intent | `runway/route.ts:138` (burn) | **PARTIAL** (tagging gap) |

---

## Q1 — CURRENT CASH QUERY → COMBINED, no entity filter

`api/runway/route.ts:97-101`:
```sql
SELECT COUNT(*)::int AS n, COALESCE(SUM("currentBalance")::numeric, 0)::text AS total
FROM accounts
WHERE "userId" = ${userId}      -- :100 — ONLY userId; no entity predicate
```
It sums **every** account the user owns. `accountsLinked` = `n` (`:102`), `cashDollars` = `total` (`:103`).
**Confirmed: combined cash, no entity split.**

## Q2 — ACCOUNTS ENTITY ATTRIBUTION → only `entityType` (string), often null

**Schema** (`prisma/schema.prisma`, `model accounts`):
- `entityType String?` (`:48`) — nullable string.
- `entity_id String?` (`:49`) — nullable FK; relation `entity entities? @relation(... [entity_id] ...)` (`:53`); index `@@index([userId, entity_id])` (`:59`).

**Where each is SET:**
- **`entity_id` (FK): NEVER set.** Plaid account creation `exchange-token/route.ts:114-130` writes
  id/accountId/name/type/balances/plaidItemId/userId — **no `entity_id`, no `entityType`.** The dedup
  update (`:99-108`) and `transactions/sync-complete/route.ts:76` refresh **balances only**. Grep of
  `src/app/api/plaid/**` for `entity_id|entityType` → **zero hits.** **No code anywhere sets
  `accounts.entity_id`** → it stays NULL for every account.
- **`entityType` (string): set MANUALLY**, via `accounts/update-entity/route.ts:38-41`
  (`data: { entityType }`, valid types `['personal','business','trading','retirement']` `:24`). It is
  **read** by `admin/fix-entity-assignment:162` (`txn.accounts.entityType`) and returned by
  `api/accounts/route.ts:38`. **Plaid link does NOT set it** → null until the user tags the account.

→ **Linked accounts receive NEITHER field automatically. `entity_id` is always null; `entityType` is
null until a manual tag.** The usable attribution key is **`entityType`** (a string, and note it uses
`'business'`/`'trading'` — different spellings than the ledger's `sole_prop`/entity_ids).

## Q3 — THE TRADING ACCOUNT QUESTION → only if manually tagged; DB-fact

- **No code auto-creates or auto-tags a Trading-entity account.** The only way an account becomes
  trading is a manual `entityType='trading'` via `update-entity` (`:24` allows it).
- **Trading cash in the ledger is COA `1010`** (Trading Cash, incremented by `commit-to-ledger:174-189`)
  — that is a **chart_of_accounts** balance, **not** a Plaid `accounts` row. So "trading cash as a Plaid
  account" exists **only** if Alex manually tagged a brokerage account `entityType='trading'`.
- **Whether any such account exists is a DB-row fact — NOT VERIFIED** (flagged for Alex). If none is
  tagged, "exclude trading cash" is a **no-op** on the Plaid cash total (and combined cash is already
  effectively operating cash).

## Q4 — NULL-CASH RISK (decisive) — reframed onto `entityType`

Because `entity_id` is always null, the three options must be expressed over **`entityType`**:

| Option | Predicate | Operating cash becomes | Silent drop? |
|---|---|---|---|
| **(a) personal+business only** | `entityType IN ('personal','business')` | **Drops every null-`entityType` AND retirement account** → likely collapses to ≈ $0 (most accounts are untagged) | **YES — catastrophic** |
| **(b) exclude only trading** | `entityType IS DISTINCT FROM 'trading'` | Keeps personal + business + **null** + retirement; removes only accounts explicitly tagged `'trading'` | **NO** |
| **(c) keep all (current)** | (no filter) | All accounts (current combined) | NO (but no split) |
| ✗ filter by `entity_id` | `entity_id IN (...)` / `!= trading` | **$0 — entity_id is always null** | **YES — total wipeout** |

**RECOMMENDATION: Option (b)** — `WHERE "entityType" IS DISTINCT FROM 'trading'`.
- **`IS DISTINCT FROM` keeps NULLs** (`NULL IS DISTINCT FROM 'trading'` = true), so **no untagged dollar
  is ever dropped** — the cash total stays truthful.
- It removes trading cash **only when an account is explicitly tagged** `'trading'` — the only case where
  we actually know it's trading.
- If nothing is tagged trading (likely), (b) **degenerates to (c)** — i.e. operating cash == combined
  cash, which is the truthful answer when no trading account is separable.
- **Never use `entity_id`** for this — it would zero the numerator.

**Honest residual risk (must be surfaced, not hidden):** a trading brokerage the user **forgot to tag**
would have `entityType=NULL` and its cash would sit in operating cash under (b). That is a **data-tagging
gap**, not a code error — (b) keeps it truthfully (we don't *know* it's trading) rather than guessing.
The real null/trading distribution is a **DB fact only Alex's psql can confirm** (below).

## Q5 — RECONCILIATION IMPACT → consistency is intent-level, not key-level

Today: **cash is combined**; **burn excludes trading** via `coa.entity_id != TRADING_ENTITY_ID`
(`runway/route.ts:138`, the ledger FK which IS populated on COAs). If we entity-scope cash, it would
exclude trading via **`accounts.entityType`** — a **different field on a different table**.

- **Consistency requirement:** for `runway = cash ÷ burn` to be truthful, the **operating cash basis must
  match the operating burn basis** (both = Personal + Business, Trading excluded).
- **Achievable in intent** with Option (b): both sides aim at "non-trading." **But the keys differ** —
  burn uses the **ledger** `coa.entity_id` (reliable, populated); cash uses the **account** `entityType`
  (manual, nullable). They can disagree only for an **untagged trading account** (its P&L is excluded
  from burn via the ledger, but its cash stays in operating because the account isn't tagged).
- **Do nulls force a labeled "unattributed cash" line?** **No, under Option (b)** — nulls are *kept in
  operating* (not split out), so no separate line is required and nothing vanishes. (Option (a) is what
  would force an "unattributed" line — or worse, silently drop it — which is why (a) is rejected.)
- Optional polish (not required): a small note "untagged accounts counted as operating" so the basis is
  transparent. No fabricated number either way.

---

## RECOMMENDED APPROACH (do NOT build yet — this audit decides the safe path)

**Option (b): `SUM(currentBalance) WHERE userId = … AND "entityType" IS DISTINCT FROM 'trading'`**, using
the **`entityType` string** (the only populated signal), **never `entity_id`** (always null). This:
1. **Never drops money** — nulls/retirement/personal/business all remain in operating cash.
2. **Separates trading only when truthfully known** (an explicit `entityType='trading'` tag).
3. **Degenerates safely to current combined cash** if no trading account is tagged.
4. Keeps `runway = cash ÷ burn` truthful (both target non-trading), with the one honest caveat that an
   *untagged* trading account is a data-tagging gap surfaced — not hidden.

A follow-up build would also keep the existing `accountsLinked` "no bank linked" guard, and may add a
transparency note. **Blocked-pending:** the trading→personal withdrawal bridge (still no data) is
unrelated to this and remains separate.

---

## DB CHECKS FOR ALEX (psql — schema names only; not run here)

1. **The real null distribution + whether trading cash exists** (drives the whole decision):
   ```sql
   SELECT id, name, type, "entityType", entity_id, "currentBalance"
   FROM accounts WHERE "userId" = '$UID' ORDER BY "currentBalance" DESC NULLS LAST;
   ```
2. **What each option would include/drop** (one row):
   ```sql
   SELECT
     COUNT(*)                                                          AS total_accounts,
     COUNT(*) FILTER (WHERE "entityType" IS NULL)                      AS untagged_accounts,
     COALESCE(SUM("currentBalance"),0)                                 AS total_cash,
     COALESCE(SUM("currentBalance") FILTER (WHERE "entityType" IS NULL),0)        AS untagged_cash,      -- option (a) would DROP this
     COALESCE(SUM("currentBalance") FILTER (WHERE "entityType" = 'trading'),0)    AS trading_cash,       -- option (b) excludes this
     COALESCE(SUM("currentBalance") FILTER (WHERE "entityType" IS DISTINCT FROM 'trading'),0) AS operating_cash_option_b
   FROM accounts WHERE "userId" = '$UID';
   ```
3. **Confirm the FK is entirely unpopulated** (validates "never use entity_id"):
   ```sql
   SELECT COUNT(*) AS total, COUNT(entity_id) AS with_entity_id
   FROM accounts WHERE "userId" = '$UID';
   -- Expected: with_entity_id = 0  → entity_id is always NULL; entityType is the only usable key.
   ```

---

*Read-only audit. No code changed; this `.md` is the only file created. The headline premise correction
(`entity_id` never populated; `entityType` is the real key) is the core finding. DB-row checks flagged
for Alex's psql — not run here. Every claim cites `file:line`; the trading-account tagging + null
distribution are NOT VERIFIED (DB facts).*
