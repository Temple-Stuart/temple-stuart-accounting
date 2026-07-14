# TAX-FULL-INVENTORY — everything the real Tax tab renders, in causal order

**Date:** 2026-07-14 · **Branch:** `claude/tax-full-inventory` · **READ-ONLY — no code changed, no design.**
Mirror of BOOKS-FULL-INVENTORY (`a705f664`): the map for the Tax slide deck (Bloomberg template, same as Trade/Books).

**Entry point** (`ModuleLauncher.tsx` Tax flush block `:887-899`): entitled →
`<TaxHandoffGate onGoToBooks={() => selectTab('books')} />` (`:897`); locked → `TaxShowcase` + CTA
(`:899`; gate = `isTabLocked('tab:tax', …)` `:222`). The entitled surface is ONE component chain:
**TaxHandoffGate → TaxFilingWizard → 7 step components.** The deprecated `TaxReportTab` is imported
nowhere (`dashboard/page.tsx:16-17` — "superseded by the tax filing wizard"; `/dashboard/tax`
redirects to `/dashboard/tax-filing`, `dashboard/tax/page.tsx:7`), and `TaxSettings` is a dashboard
modal outside this tab. **Every `/api/tax/*`, `/api/tax-estimate`, and `/api/account-tax-mappings`
route is tab:tax-gated server-side** (`requireTabAccess(user.id, 'tab:tax')` — calculate `:55`,
report `:28`, export `:21`, generate-pdf `:23`, wash-sales `:21,:84`, documents `:16,:46,:107`,
overrides `:32`, account-tax-mappings `:36,:130,:210`).

## THE REAL CAUSAL FLOW (this is the slide order)

1. **The handoff gate — "Tax begins at completed books."** The wizard opens ONLY once ≥1 accounting
   period is `status === 'closed'` (`TaxHandoffGate.tsx:63-66`). No closed period → the gold gate
   screen: *"Tax begins at completed books"* + *"Your tax figures come straight from your ledger, so
   the filing wizard opens once you've closed at least one accounting period."* + a **"Go to Books &
   close a period"** button (`:97-119`). Fail-loud: a failed check is neither open nor closed —
   explicit error + Retry, *"Nothing is assumed — the tax wizard stays locked until we can confirm."*
   (`:82-95`).
2. **The wizard shell** (`TaxFilingWizard.tsx`) — "File your taxes", 7 steps (`STEPS :57-107`),
   progress bar + step dots (`:333-407`), no skipping ahead to uncompleted steps (`:250-263`). Tax
   year selector (`:312-328`): **defaults to the PRIOR year before Oct 15** ("people are still filing
   the PRIOR calendar year", `:120-133`) — on 2026-07-14 the real default is **tax year 2025**.
   **Auto-detect on mount** (`:160-242`): a `sole_prop` entity pre-checks "I ran a business"
   (`:172-179`), open positions / any investment transaction pre-checks "I bought or sold
   investments" (`:184-193,:226-229`), retirement keywords in investment subtypes pre-check
   retirement (`:199-223`) — each shows an **"auto-detected"** badge (`LifeEventsStep.tsx:57-61`).
3. **Step 1 — Life events** (`LifeEventsStep.tsx`): 8 checkboxes (`ITEMS :9-22`) — W-2 / business
   (Schedule C) / investments (Schedule D + 8949) / retirement (1099-R) / student loan (1098-E) /
   education (1098-T, Form 8863) / interest & dividends / rental (Schedule E). Drives which forms
   the rest of the wizard asks about.
4. **Step 2 — Documents** (`DocumentsStep.tsx`): structured intake for W-2 (10 box-labeled fields
   `:40-51`), 1099-R (incl. Box 7 distribution codes `:53-74`), 1098-E, 1098-T; multiple entries per
   type ("+ Add another W-2", `:582-590`); saved to `tax_documents` (`POST /api/tax/documents`
   `:294`). **Schedule C and 1099-B render as AUTO-POPULATED cards** — "Already captured …
   Auto-populated from: Your ledger (sole-prop entity)" / "Your trading positions & lot dispositions"
   with a "from your data" badge (`:134-149,:595-617`) — the cross-tab story in the product's own UI.
   Completion checklist + "Skip for now" (`:676-726`).
5. **Step 3 — Income review** (`IncomeReviewStep.tsx`): *"Every income number below is traced back to
   its source."* (`:501-505`). One card per source (W-2, Schedule C, 1099-R, capital gains, 1098-E,
   1098-T) with **source badges** — "✓ from W-2 document(s)", "✓ from your Business entity ledger",
   "✓ from trading positions & lot dispositions", "! from manual override", "✗ no W-2 entered"
   (`:158-179,:443-459`) — ending in the **Form 1040 Income Summary** (Lines 1→9, less ½ SE tax and
   student-loan deduction → **Line 11 AGI**, `:1056-1112`). Mismatch warnings ("You marked … but no
   … entered", `:407-437`); $3,000 capital-loss carryforward note (`:876-882`); wash-sale count
   surfaced (`:883-892`).
6. **Step 4 — Deductions (Schedule C)** (`DeductionsStep.tsx`): the ledger→line derivation on
   display. Overview card (Lines 1 / 2 / 7 / 28 / **31 net profit**, `:251-308`); **3-level
   drill-down: line → account → individual ledger entries** with a per-account reconciliation footer
   "✓ N entries = $X" (`:357-504`; entries served by `/api/tax/calculate`'s traced sources,
   `calculate/route.ts:95-144`). **The account-to-tax-line mapper lives HERE**
   (`AccountTaxMappings.tsx`, toggled `:547-575`): all 23 IRS Schedule C lines (`:17-41`, incl.
   Deductible meals at 0.5 multiplier), auto-save on change (`POST /api/account-tax-mappings`
   `:196`), per-tax-year (`:308-312`); **unmapped accounts default to Line 27a (Other)** with an
   amber warning (`:507-545`; engine at `schedule-c-service.ts:262-274`). Data-quality warnings:
   accounts with no current-year entries but lifetime balances are EXCLUDED, never imputed
   (`:577-602`; engine `:219-225,:247-252`). **Schedule SE preview**: Line 2 → Line 3 (× 92.35%) →
   Line 12 (× 15.3%) → Line 13 (deductible half) (`:604-646`), shown only above the IRS $400
   threshold (`:226`).
7. **Step 5 — Trading (Schedule D + Form 8949)** (`TradingStep.tsx`): Schedule D Part I (Lines
   1a/1b/1c → 7) and Part II (8a/8b/8c → 15) → **Line 16 net** (`:383-452`), with the >$3,000
   loss-carryforward note (`:444-450`). **Wash-sale detection** summary (violations + disallowed $,
   `:454-527`) with the honest in-memory disclosure: *"Wash-sale adjustments are shown in your 8949
   but not yet persisted to the database … Call POST /api/tax/wash-sales to persist."* (`:479-488`);
   detailed `WashSaleReport` toggle (`:529-534`) — "All-time detection · per IRS Pub 550 (30-day
   window)" (`WashSaleReport.tsx:268`), destructive-apply confirm (`:162-198`). **Every 8949 entry
   grouped by IRS Box A–F** with the full Pub-550 box descriptions (`:180-187`), per-entry
   drill-down incl. holding period, **box_reasoning** ("Broker-reported basis (source=plaid),
   short-term" — `tax-report-service.ts:57-75`), W adjustment badges, per-box totals (`:536-749`).
   Trade statistics (win rate, largest gain/loss, `:751-791`) and a **Form 8949 CSV preview** (first
   5 rows, TaxAct/TurboTax column format, `:793-865`).
8. **Step 6 — Review (Form 1040)** (`ReviewStep.tsx`): the complete return **line-by-line** — Income
   (1, 5a/5b, 7 w/ ST-LT split, 8 w/ Schedule C sub-lines, 9) → Adjustments (Schedule 1: ½ SE tax,
   student loan) → **Line 11 AGI** → Deductions (12 standard, 13 QBI "not yet supported — showing
   $0" `:584`, 14) → **Line 15 taxable income** → Tax computation with the **per-bracket table**
   (bracket / rate / in-bracket / tax, `:613-708`; LTCG stacking table when present) → SE tax, early
   withdrawal penalty → **Line 24 total tax** → payments (25a/25b/26, refundable AOTC) → **the
   refund/owed banner** ("Estimated refund / Estimated amount owed", `:790-824`). **Draft PDF
   downloads** for 7 forms (All / 1040 / Schedule 1 / C / D / 8949 / 8863, `PDF_FORMS :111-119`):
   *"Every PDF is watermarked DRAFT — these are for review only, not for filing."* (`:832-835`;
   watermark "DRAFT — NOT FOR FILING", `tax-pdf-service.ts:70`). Continue requires the confirmation
   checkbox "I have reviewed my {year} return and the numbers are correct." (`:860-890`).
9. **Step 7 — File** (`FileStep.tsx`): *"Nothing is submitted from here; Temple Stuart is not a tax
   preparer"* (design comment `:12-13`; the UI routes to third parties). Filing-deadline / Form 4868
   extension banner within 7 days (`:319-351`). "Forms included" list derived from the return
   (`:243-284`). **Export tools** (`:425-580`): Form 8949 CSV (`/api/tax/export` — TurboTax/TaxAct
   format, `tax-report-service.ts:533-561`), Schedule C Line-Summary + Account-Detail CSVs
   (client-generated `:1009-1053`), plain-text **Tax Filing Summary** ("Every number you need for
   TaxAct", `:1055-1184`), All-Forms **DRAFT PDF** (`/api/tax/generate-pdf?form=all`), and the **CPA
   Export Package** — Trial Balance / Income Statement / Balance Sheet / General Ledger CSVs via
   `/api/cpa-export` (`:550-578`) — the same ledger exports the Books tab's EXP stage serves.
   **12-step TaxAct filing instructions** personalized with the user's actual numbers (`:582-834`),
   incl. the ±$50 sanity check against Temple Stuart's estimate (`:819-827`); alternative paths
   (FreeTaxUSA + Form8949.com, TurboTax, file by mail, and "File directly from Temple Stuart —
   coming soon" via Column Tax, `:836-880`); 5-item pre-filing verification checklist (`:882-928`);
   post-filing guidance (`:930-962`).

**The derivation engine under it all** (server-side, every step reads the SAME services):
`generateForm1040` (`form-1040-service.ts:346-584`) = W-2 (priority: override > tax_documents >
Personal-entity ledger COA 4000, `:148-156`) + `generateScheduleC` (sole-prop entity's year-scoped
ledger through `account_tax_mappings`, `schedule-c-service.ts:155-314`) + `generateScheduleSE`
(`:318-329`) + `generateTaxReport` (8949/Schedule D from `lot_dispositions` +
`trading_positions`, wash sales merged in-memory, `tax-report-service.ts:162-528`) → brackets
(2025/2026 tables `:13-31`), standard deduction ($15,000 single, `:33-38`), LTCG stacking
(`:258-296`), AOTC/LLC with phaseouts (`:300-328`), student-loan deduction with phaseout
(`:330-342`). **Closed books → mapped accounts → schedules → 1040 → exports** is real and cited.

*(Legacy: `/api/tax-estimate` (`route.ts:200-261`) is the older quarterly/safe-harbor estimator with
its own disclaimer + 10-assumption list; its only UI consumers are the deprecated `TaxReportTab` and
the dashboard `TaxSettings` POST (`dashboard/page.tsx:416`). It is NOT part of the homepage Tax tab
but IS the formula set the current locked `TaxShowcase` panel was verified against.)*

## DISCLAIMER INVENTORY — the showcase must carry these verbatim

| Where | Verbatim string | Cite |
|---|---|---|
| `/api/tax/calculate` + `form-1040-service` — rendered as italic footer on Income/Deductions/Review/File steps | **"TAX ESTIMATE ONLY — All figures must be verified by a licensed CPA or tax professional before filing."** | `calculate/route.ts:316`; `form-1040-service.ts:537`; rendered `IncomeReviewStep:1114-1116`, `DeductionsStep:667`, `ReviewStep:892`, `FileStep:980` |
| Every PDF page 1 | **"DRAFT — NOT FOR FILING"** (watermark) | `tax-pdf-service.ts:70` |
| Single-form PDFs | "TAX ESTIMATE ONLY — All figures must be verified by a licensed CPA or tax professional before filing. **Temple Stuart is not a tax preparer.**" | `tax-pdf-service.ts:228` |
| All-forms PDF package | "TAX ESTIMATE ONLY — This package contains estimated tax forms generated from your accounting data. All figures must be verified by a licensed CPA or tax professional before filing." | `tax-pdf-service.ts:602` |
| Review step, PDF card | "Every PDF is watermarked DRAFT — these are for review only, not for filing." | `ReviewStep.tsx:832-835` |
| Tax Filing Summary (txt export) | "This summary was generated from Temple Stuart. All figures must be verified by a licensed CPA or tax professional before filing." | `FileStep.tsx:1180-1181` |
| Wash-sale tax impact | "Estimated using 35% short-term rate. Actual impact depends on your tax bracket and whether losses are short-term or long-term." | `api/tax/wash-sales/route.ts:60` |
| Legacy `/api/tax-estimate` | "Estimate only. Not tax advice. Consult a CPA." + the 10-item assumptions list (no AMT, no NIIT, no QBI, simplified state rates, …) | `tax-estimate/route.ts:289,:250-261` |
| Current locked TaxShowcase | "Estimates for informational purposes only — verified by a qualified tax professional before filing, always." | `TabShowcases.tsx` Tax section |

Also honesty strings worth showing verbatim: the wash-sale in-memory persistence warning
(`TradingStep.tsx:479-488`), QBI "not yet supported — showing $0" (`ReviewStep.tsx:584`),
Interest & Dividends "not yet wired" badge (`IncomeReviewStep.tsx:899-917`), and "File directly
from Temple Stuart — coming soon" (`FileStep.tsx:867-878`). A Tax slide must NOT advertise
1099-INT/DIV wiring, QBI, rental (Schedule E), or in-app e-filing as live.

## PHASE 2 — per-section logged-out feasibility (the three-tier ruling)

The Tax tab is the most fetch-heavy surface in the product: **every step except Life events
self-fetches on mount**, so the deck is almost entirely STATIC-MIRROR territory. Per piece:

| Section | Verdict | Basis |
|---|---|---|
| TaxHandoffGate (gate screen) | **STATIC MIRROR** | fetches `/api/entities` + `/api/closing-periods` on mount (`:47,:59`). The gate SCREEN itself (`:97-119`) is plain JSX — trivially mirrorable with the real strings |
| TaxFilingWizard shell (stepper/progress/year selector) | **STATIC MIRROR** | shell runs the auto-detect fetches on mount (`:165-168`) — cannot mount; the stepper chrome (`:294-453`) is inline JSX, faithful to replicate |
| Life events step | **EXAMPLE-FED (the one live candidate)** | ZERO fetches — fully props-driven via `StepProps` (`TaxFilingWizard.tsx:40-47`); mount with declared `lifeEvents` + `autoDetected` badges; `setLifeEvents` is parent state only. The only Tax component that can mount live |
| Documents step | **STATIC MIRROR** | fetches `/api/tax/documents` on mount (`:197,:230-232`); save/delete POSTs (`:294,:331`) |
| Income review step | **STATIC MIRROR** | fetches calculate + documents + report on mount (`:301-305`) |
| Deductions step (Schedule C drill-down + SE preview) | **STATIC MIRROR** | fetches `/api/tax/calculate` on mount (`:130,:144-146`) |
| AccountTaxMappings (the mapper) | **STATIC MIRROR** | fetches `/api/entities` + `/api/account-tax-mappings` on mount (`:117,:142,:162-168`); auto-saves on change (`:196`) |
| Trading step (Schedule D / 8949 / wash sales) | **STATIC MIRROR** | fetches report + wash-sales on mount (`:227-229`) |
| WashSaleReport (detail) | **STATIC MIRROR** | fetches wash-sales + report on mount (`:125-127`); POST apply is destructive (`:162-198`) |
| Review step (1040 line-by-line + brackets) | **STATIC MIRROR** | fetches `/api/tax/calculate` on mount (`:250,:263-265`) |
| File step (exports + instructions) | **STATIC MIRROR** | fetches calculate + documents on mount (`:172-174`); export anchors hit gated routes |
| TaxReportTab / TaxSettings / `/api/tax-estimate` UI | **DO NOT SHOW as live** | TaxReportTab deprecated (no importers); TaxSettings is dashboard chrome; advertising them would show unreachable UI |

**Slide-deck implication (design not done here):** the strongest slides are the mechanics the
product is proudest of — the closed-books handoff gate (Books closes INTO Tax), the auto-detect
life events, Schedule C's ledger→line→entry drill-down with the "✓ N entries = $X" reconciliation,
the account-to-line mapper with the honest Line-27a default, the SE-tax preview, the 8949 box logic
with per-entry `box_reasoning`, the bracket table, the DRAFT-watermarked PDFs, and the TaxAct
handoff with the ±$50 sanity check. Every panel carries the calculate disclaimer verbatim.

## THE EXAMPLE SCENARIO — derive from the Books set vs. a bigger declared year

Both computed with the REAL formulas (`generateScheduleSE` `schedule-c-service.ts:318-329`;
`generateForm1040` bracket/deduction math `form-1040-service.ts:225-254,:444-508`; single filer,
standard deduction $15,000, no W-2/withholding, sole-prop only). Engine `round2` semantics verified
by executing the formulas.

**Option A — derive from the established Books set** (revenue $8,400 − expenses $5,100 = **NI
$3,300**; the cross-tab story "the books you saw close INTO this 1040"):

| Line | Value | Math |
|---|---|---|
| Schedule C 1 / 28 / 31 | 8,400.00 / 5,100.00 / **3,300.00** | the Books set, mapped: 6010 Car & Truck → Line 9 ($900), 6100 Rent → Line 20b ($2,400), 6120 Supplies → Line 22 ($1,800) — all real `SCHEDULE_C_LINES` labels |
| Schedule SE 2 / 3 / 12 / 13 | 3,300.00 / 3,047.55 / **466.28** / 233.14 | 3,300 × 0.9235 = 3,047.55; × 0.153 = 466.28; ½ = 233.14 (> $400 threshold ✓ SE preview shows) |
| 1040 Line 9 / 11 (AGI) | 3,300.00 / 3,066.86 | 3,300 − 233.14 |
| Line 15 taxable | **0.00** | max(0, 3,066.86 − 15,000) |
| Federal income tax | **$0.00** — bracket table EMPTY | ReviewStep renders its real string "No taxable ordinary income." (`:618-621`) |
| Line 24 total tax / owed | **466.28 / 466.28 owed** | 0 + SE 466.28; no payments |

Honest read: NOT degenerate-to-zero — it demonstrates the two mechanics W-2 filers don't know
(SE tax applies even when income tax is $0; the standard deduction swallowing small-business
income), and every number reconciles with the Books deck. Weakness: the bracket-table slide and
the refund/owed drama are thin ($0 federal, one small owed number).

**Option B — the bigger declared year** (the prior TaxShowcase scenario, net profit **$23,400**,
previously verified engine-true in SHOWROOM-TRUTH-FIX):

| Line | Value | Math |
|---|---|---|
| Schedule SE 3 / 12 / 13 | 21,609.90 / **3,306.31** / 1,653.16 | 23,400 × 0.9235; × 0.153 (the audited "$3,306") |
| 1040 Line 11 (AGI) | 21,746.84 | 23,400 − 1,653.16 |
| Line 15 taxable | 6,746.84 | 21,746.84 − 15,000 |
| Federal income tax | **674.68** | all in the 10% bracket ($0–$11,600) — one full bracket-table row (the audited "$675") |
| Line 24 total tax / owed | **3,980.99 / 3,980.99 owed** | 674.68 + 3,306.31 |

Honest read: teaches the full pipeline (bracket row, SE, standard deduction, a real owed number)
and matches the numbers already shown on the locked TaxShowcase — but its Schedule C does NOT
reconcile with the Books deck's $8,400/$5,100/$3,300, so the two decks would show two different
sets of books unless framed.

**The framing that reconciles them (for Alex to consider):** the wizard's real default on today's
date is **tax year 2025** (`defaultTaxYear`, `TaxFilingWizard.tsx:120-133` — before Oct 15 you file
the PRIOR year). The Books deck shows the 2026 books running (June closed, July open); the Tax deck
can honestly file **Maria's completed 2025 year** as a declared scenario (net profit $23,400) —
Option B's numbers, zero contradiction with the 2026 Books set, and it showcases the real
default-year behavior. Requires declaring the 2025 Schedule C breakdown (e.g. gross receipts and
per-line expenses summing to 23,400 net) as example data on its own labeled year. Alternatively,
Option A keeps a single set of books across both decks at the cost of a thin bracket slide.
**Report only — Alex picks.**
