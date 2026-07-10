# SHOWROOM-TRUTH-AUDIT — the four SHOW surfaces vs. the real pipes

**Date:** 2026-07-10 · **Branch:** `claude/showroom-truth-audit` · **READ-ONLY — no code changed.**

Scope: the four TAB-SHOW-AND-GATE showcases in `src/components/home/TabShowcases.tsx`, rendered to
**locked viewers** — logged-out visitors AND logged-in users without the tab entitlement
(`ModuleLauncher.tsx:820-821` Trade, `:880-881` Books, `:897-898` Tax, `:915-916` Compliance; the
unlocked branch mounts the real module). Every showcase is static — zero fetches, zero paid calls
(`TabShowcases.tsx:7-11` states the discipline). Each header carries an amber **"Example data"**
badge (`DemoTag`, `:26-32`, mounted via `ShowcaseHeader` `:34-42`).

**Headline ruling:** Books, Tax, and Compliance are **honest illustrations** (clearly labeled,
shape-faithful, minor drift noted below). Trade is honestly **labeled** but its third demo row
**contradicts the real engine on three counts** — the one row built to demonstrate the honesty
gate misrepresents how the gate actually behaves. Details and the honest-showroom target per tab.

---

## 1. TRADE — `TradeShowcase` (`TabShowcases.tsx:114-179`)

### What it renders
- Header line (`:125`): "Live prices from TastyTrade, company numbers from Finnhub, macro from
  FRED, filings from SEC EDGAR, the mood from Grok — scored through four gates… on example tickers."
- A 7-column table (Ticker / Vol edge / Quality / Regime / Info edge / Composite / Suggestion) with
  three fictional tickers (`DEMO_SCAN_ROWS`, `:114-118`): ACME, GLOBEX, INITECH.
- Three claim tiles (`:155-168`): "computed from 14/16 signals" exclusion honesty, the survival
  brake (`REGIME BRAKE: OFF`), the self-graded track record.
- Footer (`:169`): "Example tickers; nothing above is a live price or a recommendation."

### The real pipe (logged-in)
`ModuleLauncher.tsx:807-819`: TradingDataDisclaimer → CoverageDeclaration → ScanFilterForm →
ConvergenceIntelligence → TradeRecord → TradeLabPanel. The engine: `scoreAll()`
(`src/lib/convergence/composite.ts:118`) scores 4 gates, combines with renormalizing exclusion
(`:128-137`), then the convergence gate (`:157-171`).

### Claim-by-claim verification
| Demo claim | Real code | Verdict |
|---|---|---|
| Feeds: TastyTrade/Finnhub/FRED/EDGAR/Grok | pipeline.ts `:384/:765/:650/:1034/:1571`; sentiment = xAI `grok-4-1-fast` (`sentiment.ts:159,225`) | ✅ TRUE |
| Four gates + composite columns | Real gate names "Vol Edge/Quality/Regime/Info Edge", "Composite Score" (`ConvergenceIntelligence.tsx:261-269,452,874,877`) | ✅ shape-faithful (real UI is scorebar cards, not this flat table — acceptable simplification) |
| "Iron Condor · 45 DTE" / "Short Put Spread · 45 DTE" | Real strategy names (`composite.ts:330`, `regime.ts:372-373`); 45 is the real default suggested DTE (`composite.ts:311,331`) | ✅ TRUE |
| "computed from 14/16 signals" | Real N/M declaration convention (`types.ts:492-505`, `vol-edge.ts:1220`, `quality-gate.ts:1172`) | ✅ TRUE (illustrative counts) |
| `REGIME BRAKE: OFF` | Real declarations (`regime.ts:110-117`); real UI flags on `REGIME BRAKE` prefix (`ConvergenceIntelligence.tsx:1334`) | ✅ TRUE |
| Snapshot + self-graded record | scan_snapshots + TradeRecord (TRACK-1, `ModuleLauncher.tsx:30-32`) | ✅ TRUE |
| **INITECH row: `41 / 68 / 58 / 38`, composite `—`, "NO TRADE — 1/4 gates above 50"** | see below | ❌ **THREE contradictions** |

### ❌ The INITECH row vs. the real engine (`TabShowcases.tsx:117`)
1. **It miscounts its own numbers.** Gates above 50 in the row: quality 68 ✓, regime 58 ✓ → **2/4**,
   not the "1/4" the suggestion string claims. The fabricated caption contradicts the fabricated data
   in the same row.
2. **2/4 is not NO TRADE in the real engine.** `composite.ts:157-171`: `< 2` above 50 → NO TRADE;
   `=== 2` → **"2/4 above 50 → 20% position size (marginal signal)"**; `3+` → continuous sizing.
   A real scan of those four scores yields a marginal 20% position, not NO TRADE. (The separate 3/4
   rule the demo may have conflated is the Step-S trade-**card** filter —
   `ConvergenceIntelligence.tsx:4147` — which suppresses the card but still shows the scored row.)
3. **Composite would not be null.** Composite is null only when **all four** gates are excluded
   (`composite.ts:128-131`); INITECH has all four scored, so the real engine computes a composite
   (≈51 equal-weighted). The demo's `—` (`:117,148`) misrepresents the null-composite rule — the
   exact honesty mechanic the tile next to it (`:156-159`) is selling.

### Ruling: **honest-labeled, engine-unfaithful in one row**
The framing is honest (badge, "example tickers", data-not-directives footer). But the NO-TRADE row —
the one that demonstrates the product's discipline — depicts gating behavior the product does not
have. A visitor concludes the scanner refuses anything under 2 strong gates; the real product sizes
it at 20% and declares it marginal. Fabrication drift, material to what's being sold.

### The honest version
Keep the table, regenerate the rows so every value obeys `composite.ts`: e.g. a true NO-TRADE row
(one gate above 50, composite present, string `"1/4 above 50 → NO TRADE (convergence too weak)"` —
the real format at `composite.ts:159`), or keep 2/4 and show the real marginal string. Quote the
engine's own strings verbatim rather than paraphrasing them.

---

## 2. BOOKS — `BooksShowcase` (`TabShowcases.tsx:183-240`)

### What it renders
- Header (`:194`): Plaid feed → journal entries → trial balance → close, "Below: Maria's food-truck
  books, as an example." (Maria = the same fictional persona the Operations showroom uses,
  `TabShowcases.tsx:10-11`.)
- Four stat tiles (`:196-203`): Assets $12,400 / Liabilities $3,100 / Equity $9,300 / Trial balance
  "BALANCED ✓".
- A 3-row demo journal (`DEMO_JOURNAL`, `:183-187`): coffee beans, farmers-market sales, truck fuel,
  with codes `5010 Supplies / 1010 Cash / 4010 Sales / 5040 Vehicle / 2010 Card`.
- Pipe line (`:228-230`): "import → categorize → journal → ledger → trial balance → reconcile →
  adjusting entries → statements → period close → year-end → CPA export."

### The real pipe (logged-in)
`BookkeepingCockpitBar` + `BooksPipeline` (`ModuleLauncher.tsx:869-878`). Real canonical order
(`BooksPipeline.tsx:180-182`): SRC → CAT → JE → LDG → TB → REC → ADJ → STMT → **TAX-LOT** → CLOSE →
CLOSE-YE → **POS** → EXP.

### Verification
- Balance-sheet identity holds: 12,400 = 3,100 + 9,300 ✅ (internally consistent example).
- "BALANCED ✓" is the real product string, verbatim (`CPAExport.tsx:143,228,294`) ✅.
- Pipe description matches the real stage order ✅ — omitting tax-lot/wash-sales and positions
  (present in the real pipe) is a summary omission, not an invention; note the Books demo *undersells*
  here.
- Debit/credit/memo journal shape matches real journal entries ✅.
- ❌ Minor drift: **codes `4010`, `5010`, `5040` exist in no seed template.** Real business COA:
  `4000 Service Revenue / 4100 Product Revenue` (`seed-coa-templates.ts:99-100`); `1010` and `2010`
  are real (`:22,89` and `:28,94`). Half-real, half-invented account codes.

### Ruling: **honest-illustration** (minor drift)
Clearly labeled fictional business; shape faithful; the only infidelity is cosmetic account codes.
Labeling note: the "Example data" badge sits in the header only — a screenshot of just the tiles or
the journal table carries no label. Low risk, but the honest version should stamp the label on each
panel (as Compliance already does per-card).

### The honest version
Same surface, with demo codes drawn from the real seed templates (`4000 Service Revenue`, etc.) and
a per-panel example marker. Optionally show the real stage list including wash-sale/tax-lot and
positions — the real pipe is more complete than the demo claims.

---

## 3. TAX — `TaxShowcase` (`TabShowcases.tsx:244-279`)

### What it renders
- Header (`:249`): "Because the books are already clean, the tax estimate is derived — not re-typed.
  Below: an example year for Maria's food truck."
- Four tiles (`:251-263`): Schedule C net profit $23,400 / Self-employment tax $3,306 / Estimated
  federal tax $5,120 / Form 8949 lots "12 exported".
- Pipe line (`:264-266`) + disclaimer (`:267-269`): "Estimates for informational purposes only…
  Example numbers above."

### The real pipe (logged-in)
`TaxHandoffGate` (`ModuleLauncher.tsx:895-896`) — wizard only after a closed period, else a
"close your books first" screen. Real wizard steps (`src/components/tax-filing/steps/`): Documents →
IncomeReview → Trading → Deductions → LifeEvents → Review → File. Real engines:
`schedule-c-service.ts`, `form-1040-service.ts`, `tax-pdf-service.ts`, `api/tax-estimate`,
`api/cpa-export`.

### Verification
- Schedule C net profit is a real wizard figure (Line 31, `DeductionsStep.tsx:213,296`) ✅.
- **The SE-tax figure is arithmetically faithful to the real formula**: real code computes
  net × 0.9235 × 0.153 (`api/tax-estimate/route.ts:201-202`, `schedule-c-service.ts:324` +
  `:56-57`); $23,400 × 0.9235 × 0.153 = **$3,306** — the demo number is what the product would
  actually compute ✅. (Also consistent with the real $400 SE threshold, `DeductionsStep.tsx:225-226`.)
- "Estimated federal tax $5,120" — not derivable without filing-status assumptions; an invented but
  plausible figure, covered by the explicit "Example numbers above" footer ✅⚠️.
- Form 8949 / wash-sale / CPA export are real capabilities (Trading step, `form_8949` tax-form-line
  mappings `seed-coa-templates.ts:137-138`, `api/cpa-export`) ✅.
- Closed-books precondition is honestly stated and is truly how the real tab behaves (handoff gate) ✅.

### Ruling: **honest-illustration**
The strongest of the four: derived-from-books framing matches the real gate, one headline number is
computed with the product's real formula, and the invented figures sit under an explicit example
disclaimer plus the filing-professional caveat.

### The honest version
As-is, with two upgrades: derive the "estimated federal tax" tile from the real
`form-1040-service` bracket math for a declared example input (so every number is engine-true), and
mention the wizard's real step names — the actual flow is richer than four tiles.

---

## 4. COMPLIANCE — `ComplianceShowcase` (`TabShowcases.tsx:283-318`)

### What it renders
- Header (`:288`): real regulation text (eCFR, US Code, Federal Register, IRS) ingested/searchable,
  citations verified and pinned, tamper-evident audit chain.
- A citation card (`:290-299`): **26 U.S.C. §162(a)** with quoted text, a green "Verified" pill, and
  "Pinned to the ingested US Code corpus · re-verified on ingest updates **(example row)**".
- An audit-chain card (`:300-305`): "audit_log #4812 · permission_granted · hash-chained to #4811 ·
  actor: stripe-webhook **(example row)**".
- Sections line (`:306-308`): "A–J: identity → registry → citations → discovery → missions → tasks →
  attestations → evidence → audit chain → SOC 2 view."

### The real pipe (logged-in)
`ComplianceWorkbench` (`ModuleLauncher.tsx:913-914`) — the A–J institutional workbench. Real
backends: corpus ingestors for all four sources (`src/lib/corpus/ingest/uscode-persist.ts`,
`ecfr-persist.ts`, `fedreg-persist.ts`, `irb-persist.ts`), citation verify
(`api/citations/[id]/verify`), discovery, missions, tasks, audit chain.

### Verification
- **The 26 U.S.C. §162(a) card is NOT a fake citation.** The quoted sentence is the actual statute
  text of 26 USC §162(a), correctly cited — a real legal provision, presented as "what a verified
  citation looks like" with an inline "(example row)" label. The concern in the mandate ("a fake 26
  USC citation card") does not hold: the citation is genuine; only the *row's presence in a user's
  workspace* is the example.
- "Verified" is a real citation status the product sets (`api/citations/[id]/verify/route.ts:49`) ✅.
- **The hash chain is real, not marketing**: `writeAuditLog.ts:73-104` — every row stores
  `prev_hash` = previous row's `content_hash`, SHA-256 over the canonical content, serializable
  transaction + genesis row; "#4812/#4811" plausibly render the real `sequence_number` (`:74`) ✅.
- `permission_granted` is a real `AuditActionType` (used by the entitlement webhook) ✅.
- ❌ Minor drift: **"actor: stripe-webhook" is not a value the product can store.** The real
  `AuditActorType` enum is `human_user | ai_agent | system_automation | external_integration`
  (`schema.prisma:2205-2210`); the webhook writes `external_integration`. A real row could never
  read "actor: stripe-webhook".

### Ruling: **honest-illustration** (one label drift)
Both cards depict real, verified product capabilities with per-card example labels — the strongest
labeling discipline of the four tabs. Fix the actor label to the real enum value.

### The honest version
As-is with `actor: external_integration (stripe webhook)` — i.e., the real enum value with the
integration named in prose, matching what `writeAuditLog` actually stores.

---

## 5. PHASE 2 — could the real components drive the demos?

**Ruling: keep separate static showcases; make the static content engine-generated or
engine-quoted. Do not feed fabricated data into the real components.**

- The real modules are self-fetching and fail-loud by design (`BooksPipeline.tsx:77` — "any non-OK
  response throws → 'error' state (no fabricated empty data)"; ConvergenceIntelligence renders live
  pipeline results; TaxHandoffGate demands a real closed period; ComplianceWorkbench queries the
  real corpus). Injecting fictional data through them would (a) require adding demo props/branches
  to production components, and (b) blur exactly the real-vs-example boundary the fail-loud
  discipline exists to protect. The separate-static-showcase architecture (the
  OperationsPipelineShowroom precedent, `TabShowcases.tsx:7`) is the right one.
- **What IS reusable — and closes the fidelity gap:**
  - `scoreAll(input)` (`composite.ts:118`) is a pure function. The Trade demo rows can be **generated
    by running the real scorer on a declared synthetic input** (build-time or checked-in fixture), so
    every score, composite, and gate string is mechanically the engine's own output. That fixes the
    INITECH-class errors permanently — the demo cannot drift from the engine again.
  - Real strings quotable verbatim: convergence-gate formats (`composite.ts:159,162,170`), regime
    declarations (`regime.ts:110-117`), "BALANCED ✓" (`CPAExport.tsx:143`), seed COA names/codes
    (`seed-coa-templates.ts`), the SE formula (`tax-estimate/route.ts:201-202`), audit-log field
    shapes (`writeAuditLog.ts:84-97`).

## 6. Side findings (read-only; not fixed here)

1. **Stale comment** `ModuleLauncher.tsx:784-786`: "the scan API stays requireAdmin server-side
   until item 4 … an entitled non-admin sees the real UI but a scan returns the server's 403" —
   false since TAB-SERVER-GATE flipped the scan route to `requireTabAccess('tab:trade')`
   (`api/trading/convergence/route.ts:65-66` on main). An entitled non-admin's scan now works.
2. Labeling density is uneven: Compliance labels per-card, Trade/Tax label header + footer, Books
   labels header only (its tiles/table are unlabeled if viewed in isolation).

## 7. Summary table

| Tab | Labeled? | Shape vs real pipe | Fabrication findings | Ruling |
|---|---|---|---|---|
| Trade | badge + footer | gates/feeds/strategies real | INITECH row: miscounted gates, wrong NO-TRADE rule, impossible null composite | **honest-labeled, engine-unfaithful (1 row)** |
| Books | badge + "as an example" | stage order real; TB string verbatim | invented COA codes 4010/5010/5040 | **honest-illustration** (minor) |
| Tax | badge + "Example numbers" | derived-from-close is the real gate; SE math engine-true | fed-tax figure invented (labeled) | **honest-illustration** |
| Compliance | badge + per-card "(example row)" | citation verify + hash chain are real capabilities | "actor: stripe-webhook" not a real enum value | **honest-illustration** (minor) |
