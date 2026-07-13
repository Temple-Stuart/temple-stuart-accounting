# BOOKS-FULL-INVENTORY — everything the real Books tab renders, in causal order

**Date:** 2026-07-13 · **Branch:** `claude/books-full-inventory` · **READ-ONLY — no code changed, no design.**
Mirror of TRADE-FULL-INVENTORY (`d8e7bb39`): the map for the Books slide deck (same template as Trade).

**Entry point** (`ModuleLauncher.tsx` Books branch, unlocked): `BookkeepingCockpitBar` (fed by the
launcher's own cockpit fetch) → `BooksPipeline` (`:861-879`). The pipe owns the dashboard's data
layer and renders 13 stages in the dashboard's canonical order (`BooksPipeline.tsx:180-181`).

## THE REAL CAUSAL FLOW (this is the slide order)

1. **Link account** — cockpit "+ Account" → Plaid Link opens (`ModuleLauncher.tsx:340-354`) → on
   success POST `/api/plaid/exchange-token` → the item + its accounts persist
   (`exchange-token/route.ts:61,115`).
2. **Sync** — cockpit "Sync" → POST `/api/transactions/sync-complete` (`ModuleLauncher.tsx:322-326`)
   → transactions land with `merchantName` captured (`sync-complete/route.ts:108`).
3. **Source accounts** — the linked accounts get an ENTITY assignment (personal/business/trading) —
   the pipe-unique control (`BooksPipeline.tsx:213-224`).
4. **Categorize** — uncommitted transactions queue with a PREDICTED chart-of-accounts code
   preselected; the user confirms or overrides, then **Commit**.
5. **Commit = double-entry** — `/api/transactions/commit-to-ledger` writes the journal entry +
   ledger entries AND teaches the categorizer (below).
6. **Journal → Ledger → Trial balance** — entries accumulate; the TB must balance (A = L + E).
7. **Reconcile** — bank reconciliation per account/period (real order: REC comes BEFORE adjusting
   entries and statements in the canonical pipe).
8. **Adjust → Statements** — adjusting entries via manual journal; P&L/balance-sheet statements.
9. **Wash sales / tax lots** (trading accounts) → **Period close** (locks the month; reopening
   REQUIRES a written reason for the audit trail, `BooksPipeline.tsx:350-357`) → **Year-end close**
   → **Position report** → **CPA export**.

## 1. THE COCKPIT HEADER — `BookkeepingCockpitBar.tsx` (115 lines, ZERO fetches)

Pure props component (`BookkeepingCockpitBarProps` `:3-17`): totalAssets / totalLiabilities /
totalEquity / **isBalanced** (+ computed imbalance `:34`), connectedAccounts, periodLabel,
periodStatus open/closed, onSync (+ syncing spinner state), onLinkAccount. Data comes from the
launcher's fail-loud cockpit fetch (`ModuleLauncher.tsx:266-285`): `/api/trial-balance` +
`/api/accounts` + `/api/closing-periods`, with the constitution-grade guard — *"isBalanced MUST
come from the real trial balance — if it's absent, that's an error we surface, never a silent
'true'"* (`:280-281`).

## 2. SOURCE ACCOUNTS — inside BooksPipeline (`:184-242`)

Institution / Account (••••mask) / Type / **Entity select** (personal=blue, business=purple,
trading=green, ⚠ Unassigned=orange, `:203-224`) / Balance, with a total footer (`:233-238`).
Entity assignment is optimistic with revert-to-true-prior-value on failure (`:137-149`). Honest
empty state: "No accounts connected — link one from the cockpit above" (`:230`).

## 3. THE TRANSACTION FLOW — CAT stage (`:244-270`) + `SpendingTab.tsx` (1,527 lines) / `InvestmentsTab.tsx`

- Queue split Spending | Investments with pending counts (`:249-263`); committed vs uncommitted
  derived from `journalProof` (`:151-154`).
- SpendingTab: dense sortable/filterable table (sort by date/merchant/name/amount/account/
  institution, `SpendingTab.tsx:70`), per-transaction COA select **pre-filled with the predicted
  code** (`predicted_coa_code`, `:54,:918`), bulk commit, uncommit, inline COA creation (`:366`).
- **The auto-categorization mechanic is pure DB — no AI call** (confirms PRICING-AUDIT):
  transactions carry `predicted_coa_code` + `prediction_confidence`
  (`api/transactions/route.ts:129`, `review-queue/route.ts:49`); learned mappings live in the
  user-scoped `merchant_coa_mappings` table (confidence_score + usage_count,
  `api/merchant-mappings/route.ts:31-40`); **commit-to-ledger is the learning loop** — a user
  override penalizes/deletes the wrong mapping and reinforces/creates the right one
  (`commit-to-ledger/route.ts:123-195`). The precise write-site of the initial prediction was not
  traced in this audit (served, learned, and consumed sites are cited above).

## 4. JOURNAL — JE stage (`:272-279`) + `JournalEntryEngine.tsx` (971 lines, ZERO fetches)

Props-driven engine (journalTransactions, coaOptions, onSave, onReload): commit writes
debit/credit pairs (the ledger shows `committedCount × 2` entries, `:283`); manual journal entry
exists and is a FREE-tier feature server-side (`api/transactions/manual` — free per its own
header, kept free in TAB-SERVER-GATE; manual accounts are `source: 'manual'`,
`transactions/manual/route.ts:49-55`). Unbalanced entries refuse to commit
(`api/stock-lots/commit/route.ts:272` throws "UNBALANCED JOURNAL ENTRY").

## 5. LEDGER / TRIAL BALANCE

- `GeneralLedger.tsx` (783 lines) — self-fetches on mount (ledger query `:126` via effects
  `:138-156`, `/api/entities` `:141`).
- `TrialBalanceSection.tsx` (141 lines) — self-fetches `/api/trial-balance` on mount (`:46-49`);
  the must-balance mechanic: the TB endpoint returns `totals.isBalanced` and the UI renders the
  "BALANCED ✓ / OUT OF BALANCE ✗" verdict (same field the cockpit guard requires).

## 6. STATEMENTS — `FinancialStatementsTab.tsx` (182 lines)

Self-fetches `/api/statements` on mount (`:22-29`); renders the statement set (income statement /
balance sheet per the statements route; CPAExport's sheets confirm P&L + balance sheet shapes,
`CPAExport.tsx:143,228`).

## 7. RECONCILIATION — REC stage (`:295-314`) + `BankReconciliation.tsx` (405 lines, ZERO fetches)

Props-driven (accounts, transactions, reconciliations, onSave, onReload); renders the
"✓ RECONCILED / ≠ NOT BALANCED" verdict (`BankReconciliation.tsx:273`); saves POST
`/api/bank-reconciliations` via the parent callback (`BooksPipeline.tsx:302-311`).

## 8. CLOSING — CLOSE (`:331-366`) + CLOSE-YE (`:368-373`)

- `PeriodClose.tsx` (258 lines, ZERO fetches — props + callbacks): close POSTs
  `/api/closing-periods/close` (requires an entity); **reopen requires a typed reason** —
  "Reason for reopening (required for audit trail)" (`BooksPipeline.tsx:352-353`). Closed period
  = locked month (the Tax tab's handoff gate keys off this).
- `CloseBooksTab.tsx` (169 lines) — self-fetches `/api/year-end-close?...` on mount (`:26,:37`),
  performs year-end close via POST (`:60`).

## 9. CPA EXPORT + EVERYTHING ELSE

- `CPAExport.tsx` (521 lines) — self-fetches `/api/cpa-export` (`:316` via effect `:329`); builds
  the export package client-side incl. trial balance + balance sheet with the literal
  "BALANCED ✓ / OUT OF BALANCE ✗" cells (`:143,:228,:294`).
- **Wash sales / tax lots** — `WashSaleReportTab.tsx` (265 lines): self-fetches
  `/api/tax/wash-sales` on mount (`:60-67`), recompute via POST (`:81`).
- **Positions** — `PositionReportTab.tsx` (489 lines): self-fetches `/api/positions/summary`
  (`:107-114`).
- **Adjusting entries** — `AdjustingEntriesTab.tsx` (289 lines): fetches COA on mount (`:28-34`),
  posts manual adjusting entries (`:96`).
- **Spending insights (OpenAI)** — the paid route exists (`api/ai/spending-insights`,
  tab:books-gated) but its ONLY consumer component (`SpendingDashboard.tsx`) is mounted nowhere
  in the app (grep: no importers) — **dead UI today; the Books tab makes no OpenAI calls.** A
  Books slide must NOT advertise AI insights as a live feature.
- **Fail-loud spine** — the pipe is a 3-state machine; ANY core fetch failure → explicit error +
  Retry, "the engines stay hidden until the data loads" (`BooksPipeline.tsx:28-31,:165-177`);
  the cockpit's isBalanced guard (`ModuleLauncher.tsx:280-281`).

---

## PHASE 2 — per-section logged-out feasibility (Trade's three-tier ruling)

BooksPipeline itself CANNOT mount logged-out: it fetches six routes on mount and throws to the
error state on any failure (`:77-89,:116-124`) — by design it will never render engines on
fabricated data. The rulings therefore apply per PIECE:

| Section | Verdict | Basis |
|---|---|---|
| Cockpit bar | **DIRECT REUSE** | pure props, zero fetches (`BookkeepingCockpitBarProps:3-17`); mount with declared example totals (A = L + E must reconcile), onSync/onLinkAccount → signup |
| Source accounts table | **STATIC MIRROR** | the table is inline JSX inside self-fetching BooksPipeline (`:184-242`) — replicate columns + entity pills with example rows (real seeded institution/type shapes) |
| Categorize / SpendingTab | **EXAMPLE-FED, with inert-action caveat** | props seam exists (transactions, coaOptions — `BooksPipeline.tsx:266`) and all 4 fetches are ACTION-time (create-COA `:366`, commit `:1185,:1218`, uncommit `:1246`; its useEffects are UI-only `:495-513`) — mountable on example rows, but Commit would fire a real POST → for a showcase either strip actions via a wrapper or mirror the table statically. Show the predicted-COA preselect (`:918`) — the honest star of the mechanic |
| Journal engine | **EXAMPLE-FED** | zero fetches, fully props-driven (journalTransactions, coaOptions, onSave callback routable to signup) |
| General ledger | **STATIC MIRROR** | self-fetches on mount (`:126,:138-156`) |
| Trial balance | **STATIC MIRROR** | self-fetches on mount (`:46-49`); mirror must show the real BALANCED ✓ verdict string |
| Bank reconciliation | **EXAMPLE-FED** | zero fetches, props-driven; onSave routable |
| Adjusting entries | **STATIC MIRROR** | fetches COA on mount (`:28-34`) |
| Statements | **STATIC MIRROR** | self-fetches on mount (`:22-29`) |
| Wash sales | **STATIC MIRROR** | self-fetches on mount (`:60-67`) |
| Period close | **EXAMPLE-FED** | zero fetches, props-driven (transactions, reconciliations, periodCloses + callbacks); the reopen-requires-reason mechanic is showable honestly |
| Year-end close | **STATIC MIRROR** | self-fetches on mount (`:26,:37`) |
| Position report | **STATIC MIRROR** | self-fetches on mount (`:107-114`) |
| CPA export | **STATIC MIRROR** | self-fetches on mount (`:316,:329`) |
| Spending insights | **DO NOT SHOW as live** | dead UI (no mounted consumer); mentioning it would advertise a feature no user can reach |

**Slide-deck implication (design not done here):** like Trade, the strongest slides are the
mechanics the product is proudest of — the A = L + E cockpit with the never-silent isBalanced
guard, the predicted-COA categorize queue that LEARNS from overrides (pure DB, no AI), the
commit-refuses-unbalanced rule, the reopen-requires-reason audit trail, and the BALANCED ✓ trial
balance. Example values must reconcile (assets = liabilities + equity; debits = credits) exactly
as the Trade payload's condor did, and the four EXAMPLE-FED components give Books real mounted
surfaces the way ScanFilterForm did for Trade.
