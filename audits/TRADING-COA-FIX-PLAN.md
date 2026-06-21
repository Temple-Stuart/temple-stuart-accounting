# TRADING COA LOOKUP — FIX PLAN (read-only confirmation)

**Branch:** `claude/confirm-trading-coa-fix` · **Date:** 2026-06-21 · **Scope:** confirm the trading-COA `T-` lookup bug + map the complete fix surface. Read-only; every claim cites `file:line`. No DB access — code reachability only, no row claims.

**ESTABLISHED FACTS (given, used to test the code):** trading COAs are BARE (1010/1100/1200/1210/2100/2110/3000/3200/3300/4100/4300/5100); zero `T-` prefixes. Audit flagged `T-` lookups at `commit-to-ledger:45,48,51`, `trading/route:108,111`, `robinhood-parser:548,652,654`.

---

## FALLBACK CHECK (per the HARD-STOP rule) — ✅ NONE FOUND

The trading commit path **fails loud** on a missing account and contains **no fallback** (no silent catch, no default account, no on-the-fly account creation). Confirmed below (§2). The inner `try/catch` (`commit-to-ledger:192-206`) is **transparent error reporting**, not a swallow: it pushes each failure into a returned `errors[]` and idempotently `skipped++`s a unique-constraint dup — it never invents or substitutes an account. **No HARD-STOP triggered; no fallback to recommend deciding on.**

---

## 1. FULL TRADING COMMIT PATH (every `T-` lookup + journal purpose)

`trading/commit-to-ledger/route.ts` looks up three accounts (`:43-53`), all via the entity-scoped composite key `userId_entity_id_code`:

| Line | Code queried | Intended account | Used as | Journal purpose |
|---|---|---|---|---|
| `:45` | `'T-1010'` | Trading Cash | `cashAccount` | WIN→**DR**, LOSS→**CR** (`:130-131`) |
| `:48` | `'T-4100'` | Trading Gains | `gainsAccount` | WIN→**CR** (`:131`) |
| `:51` | `'T-5100'` | Trading Losses | `lossesAccount` | LOSS→**DR** (`:130`) |

The posting (`:128-189`): `debitAccount = isWin ? cashAccount : lossesAccount` (`:130`); `creditAccount = isWin ? gainsAccount : cashAccount` (`:131`). It writes a `journal_entries` row (`:140`), a debit `ledger_entries` (`:153-161`, `entry_type:'D'`), a credit `ledger_entries` (`:163-170`, `entry_type:'C'`), and increments `settled_balance` on both COAs (`:173-189`). **Double-entry is correct in intent — only the three lookup codes are wrong (`T-`-prefixed).**

---

## 2. FAILURE-ON-MISS BEHAVIOR — **FAILS LOUD** (decisive)

When any `T-` lookup returns `null` (`:55`):
```
if (!cashAccount || !gainsAccount || !lossesAccount) {
  const missing = [];
  if (!cashAccount) missing.push('T-1010');   // :57
  if (!gainsAccount) missing.push('T-4100');  // :58
  if (!lossesAccount) missing.push('T-5100'); // :59
  return NextResponse.json(
    { error: `Missing Trading COA accounts: ${missing.join(', ')}. Initialize bookkeeping first.` },
    { status: 400 }
  );  // :60-63
}
```
**VERDICT: FAILS LOUD** — a `400` with the missing codes, returned **before** any journal posting (the per-trade loop at `:69` is never entered). No fallback, no silent skip, no account creation. *(Per the facts, with the DB holding only bare codes, this 400 is what fires today — the commit is blocked, not mis-posting.)*

The inner loop catch (`:192-206`): `PeriodClosedError`→`errors.push`+`continue` (`:193-196`); unique-constraint→`skipped++`+`continue` (`:199-202`, idempotency); else→`console.error`+`errors.push` (`:203-205`). Final response `{ committed, skipped, errors }` (`:209`). **Transparent — not a swallow.**

---

## 3. PER-CODE BARE MAPPING TABLE (each confirmed in seeds, account_type matches intent)

| `T-` code | → bare | Seed proof | `account_type` | Serves intent? |
|---|---|---|---|---|
| `T-1010` (Cash) | `1010` | `seed-trading-coa.ts:7` "Trading Cash Account"; `seed-coa-templates.ts:128` "Trading Cash" | **asset** (D) | ✅ DR-on-win / CR-on-loss to cash |
| `T-4100` (Gains) | `4100` | `seed-coa-templates.ts:137` "Trading Gains"; `seed-trading-coa.ts:30` "Options Income - Credit Spreads" | **revenue** (C) | ✅ CR-on-win (gain) |
| `T-5100` (Losses) | `5100` | `seed-coa-templates.ts:138` "Trading Losses"; `seed-trading-coa.ts:41` "Options Losses - Debit Spreads" | **expense** (D) | ✅ DR-on-loss |
| `T-3200` (Contributions) | `3200` | `seed-trading-coa.ts:26` "Capital Contributions - Trading"; `seed-coa-templates.ts:135` "Contributions" | **equity** (C) | ✅ (trading/route filter) |
| `T-3300` (Withdrawals) | `3300` | `seed-trading-coa.ts:27` "Capital Withdrawals - Trading"; `seed-coa-templates.ts:136` "Withdrawals" | **equity** (D) | ✅ (trading/route filter) |

**All five bare equivalents exist in the seeds with the matching `account_type`/purpose. No `account_type` mismatch against the commit's intent.**

**⚠ COLLISION NOTE (why the fix must keep entity scoping):** these bare codes are **reused across entities** — `1010` is also personal "Primary Checking" (`seed-coa-templates.ts:22`) + business "Business Checking" (`:89`); `4100` is also personal "Interest Income" (`:33`) + business "Product Revenue" (`:100`); `3200` is also business "Owner's Contributions" (`:98`). They are disambiguated **only by `entity_id`**. The commit's lookups are already `entity_id`-scoped (`userId_entity_id_code` with `entity_id = tradingEntity.id`, `:40,45`), so changing `T-1010`→`1010` (etc.) while keeping that scope is **safe** — it resolves to the trading entity's row. **Any future bare lookup that drops `entity_id` would collide — keep the entity scope.**

---

## 4. SAME-FILE OTHER LOOKUPS (so the fix is complete, not partial)

**`trading/commit-to-ledger/route.ts`** — only the **three** `T-` COA lookups (`:45,48,51`) + their `missing[]` labels (`:57-59`). No other COA lookup. Fix = 3 codes + 3 labels.

**`trading/route.ts`** —
- `:35-36` `chart_of_accounts.findMany({ where: { module: 'trading' } })` — collects trading codes by `module='trading'` (returns BARE codes per the DB). **⚠ RISK: this query is NOT scoped by `userId`/`entity_id`** (only `module: 'trading'`) — returns all users' trading COAs; cite for review (separate from the prefix bug).
- `:108` filter `t.accountCode === 'T-3200'`; `:111` filter `t.accountCode === 'T-3300'`. **MISMATCH:** the `module='trading'` query returns bare codes, but these filters compare to `T-`-prefixed → never match. Fix = `T-3200`→`3200`, `T-3300`→`3300`.

**`robinhood-parser.ts`** — **writes** `T-`-prefixed COA codes onto parsed legs:
- `:548` `coa: isClosing ? 'T-4100' : this.assignCOA(leg)`.
- `:650-654` `assignCOA` returns `'T-1200'/'T-1210'` (long call/put), `'T-2100'/'T-2110'` (short call/put).
These bake `T-` prefixes into parsed data. Fix = the five `T-` literals → bare (`4100/1200/1210/2100/2110`) — **IF the parser is reachable** (see §5; no importer found).

---

## 5. BLAST RADIUS (code reachability only — no DB/row claims)

**`/api/trading/commit-to-ledger`** — **REACHABLE.** Called from the trading page: `src/app/trading/page.tsx:606` `fetch('/api/trading/commit-to-ledger', { … })` (a UI commit action). This is the **active** path the `T-` bug blocks (the §2 400). HIGH priority. *(Note: the other `commit-to-ledger` fetches in `src/components/dashboard/*` target DIFFERENT routes — `/api/investment-transactions/commit-to-ledger`, `/api/transactions/commit-to-ledger` — not this one.)*

**`GET /api/trading` (`trading/route.ts`)** — **consumer NOT located.** `trading/page.tsx` fetches `/api/trading/trades` (`:422`), `/api/trading-journal` (`:423,699`), `/api/trading/commit-to-ledger` (`:606`) — but **not** the bare `/api/trading` GET. No `fetch('/api/trading')` found in `src`. **NOT VERIFIED reachable** (may be legacy/unused or called via a path I didn't find).

**`robinhood-parser.ts`** — **NO importer found.** `grep -rln` across `src` for the parser returns only the file itself; no `import` of it anywhere in `src`. **EXISTS BUT appears UNUSED / NOT VERIFIED reachable** (could be invoked by a script outside `src` or dynamically). Its `T-` assignments may not flow to any live lookup. **Fix it only if/when its reachability is confirmed** — flag, don't assume.

---

## FIX SURFACE SUMMARY (map only — no code written)

| File | Lines | Change | Priority |
|---|---|---|---|
| `trading/commit-to-ledger/route.ts` | `:45,48,51` + labels `:57-59` | `T-1010/T-4100/T-5100` → `1010/4100/5100` (keep `entity_id` scope) | **HIGH** (reachable, blocks commit) |
| `trading/route.ts` | `:108,111` | `T-3200/T-3300` → `3200/3300` | MED (reachability NOT VERIFIED) |
| `trading/route.ts` | `:35-36` | (separate) `module='trading'` query not user/entity-scoped | MED — flag for review |
| `robinhood-parser.ts` | `:548,652,654` | `T-4100/T-1200/T-1210/T-2100/T-2110` → bare | LOW — only if parser confirmed reachable |

**Confirmed:** all bare targets exist in seeds with matching `account_type` (§3); the path **fails loud** with **no fallback** (§2); the fix must **preserve `entity_id` scoping** (bare codes collide across entities, §3).

---

*Read-only audit. No fallback found → no HARD-STOP. No code changed; this `.md` is the only file created. DB truth is Alex's — reachability reported from code only.*
