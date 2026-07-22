'use client';

/**
 * TAX-SHOWCASE-BLOOMBERG: the logged-out Tax showcase sections — the Bloomberg
 * slide deck on the proven Trade/Books template, grounded in
 * TAX-FULL-INVENTORY (audit-reports/TAX-FULL-INVENTORY.md, 9acee52e).
 *
 * THE SCENARIO (Alex-approved): the deck files Maria's COMPLETED 2025 tax
 * year — the wizard's REAL default (prior year before Oct 15,
 * TaxFilingWizard.tsx:120-133) — so it reconciles with the Books deck's
 * running 2026 books with zero contradiction.
 *
 * THE ENGINE-EXECUTED NUMBER SET (inventory Option B — every derived figure
 * below was produced by executing the real formulas; none are hand-typed):
 *   Schedule C (declared 2025 books, same COA as the Books deck):
 *     Line 1 gross receipts 36,000.00 − Line 28 expenses 12,600.00
 *     (20b Rent 6,000 + 9 Car & truck 3,900 + 22 Supplies 2,700)
 *     = Line 31 net profit 23,400.00
 *   Schedule SE (schedule-c-service.ts:318-329, generateScheduleSE):
 *     line3 = round2(23,400 × 0.9235) = 21,609.90
 *     line12 = round2(21,609.90 × 0.153) = 3,306.31   ← SE tax
 *     line13 = round2(3,306.31 × 0.5)   = 1,653.16   ← deductible half
 *   Form 1040 (form-1040-service.ts — AGI :444-456, std deduction single
 *   $15,000 :33-38,:460-464, taxable :464, 2025 brackets :13-21 via
 *   computeIncomeTax :225-254, totals :507-508,:528-532):
 *     line9 = 23,400.00 → AGI line11 = 23,400 − 1,653.16 = 21,746.84
 *     line15 taxable = max(0, 21,746.84 − 15,000) = 6,746.84
 *     federal = one bracket row: $0 – $11,600 @ 10.0% → 674.68
 *     line24 total tax = 674.68 + 3,306.31 = 3,980.99 → OWED 3,980.99
 *   Trading (declared, constructed so Schedule D nets to the set's Line 7 = 0):
 *     one 2025 disposition, a FULL wash sale — 20 sh GRNV, basis 820.00,
 *     proceeds 472.00, realized loss 348.00, rebought within 30 days →
 *     code W, adjustment +348.00, reported gain/loss 0.00
 *     (gainOrLoss = proceeds − basis + adjustment, tax-report-service.ts:243-245;
 *     Schedule D line16 = 0.00 → 1040 line7 = 0.00 ✓ the set is unchanged).
 *     Est. additional tax = round2(348 × 0.35) = 121.80
 *     (api/tax/wash-sales/route.ts:49-52) with the route's note verbatim (:60).
 *
 * DISCLAIMERS (inventory's verbatim rows — load-bearing content, not fine
 * print): the calculate disclaimer (calculate/route.ts:316) renders INSIDE
 * the hero panel and as the italic footer on the Income / Deductions /
 * Review / File mirrors exactly where the real steps render it
 * (IncomeReviewStep:1114-1116, DeductionsStep:667, ReviewStep:892,
 * FileStep:980); "DRAFT — NOT FOR FILING" (tax-pdf-service.ts:70) on every
 * 1040/PDF panel; "Temple Stuart is not a tax preparer."
 * (tax-pdf-service.ts:228) on the file-ready surfaces; the wash-sale 35%
 * note (wash-sales/route.ts:60) wherever wash sales render.
 *
 * BANNED CLAIMS (inventory's not-live list): 1099-INT/DIV, QBI, Schedule E,
 * in-app e-filing are advertised NOWHERE in this file's copy. Where the real
 * screen carries a not-supported line (ReviewStep line 13), the mirror omits
 * the line rather than name the feature — noted at the block.
 *
 * SLIDES-1 (Alex's ruling, overrides the Jul-16 faithful-mirror design): the
 * deck is SLIDES ONLY. The former live section (gate + wizard steps, incl.
 * the sole real mount LifeEventsStep) is REMOVED — no deck mounts real app
 * components anymore. What remains is the narrative: hero terminal + the
 * eight causal slide panels + the unlock CTA.
 * SHOW discipline: ZERO fetches in this file, all actions → signup/CTA,
 * every panel example-tagged.
 */

import { ExampleTag } from '@/components/home/TabShowcaseTemplate';

/** id the actions scroll to for logged-in-but-locked viewers. */
export const TAX_UNLOCK_CTA_ID = 'tax-unlock-cta';

function routeAway(currentUserId: string, onRequireAuth: () => void) {
  return () => {
    if (!currentUserId) {
      onRequireAuth();
    } else {
      document.getElementById(TAX_UNLOCK_CTA_ID)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };
}

// ── the engine-executed 2025 example return (derivation in header comment) ──

const EX = {
  year: 2025,
  business: "Maria's Food Truck",
  grossReceipts: 36_000,
  expenses: {
    rent: 6_000,      // Line 20b — Rent (other business property) — COA 6100
    carTruck: 3_900,  // Line 9  — Car and truck expenses — COA 6010
    supplies: 2_700,  // Line 22 — Supplies — COA 6120
    total: 12_600,
  },
  netProfit: 23_400,
  se: { line3: 21_609.9, line12: 3_306.31, line13: 1_653.16 },
  agi: 21_746.84,
  standardDeduction: 15_000,
  taxable: 6_746.84,
  federal: 674.68,
  totalTax: 3_980.99,
  owed: 3_980.99,
};

// The declared supplies drill-down — 4 entries enumerated in full so the
// visible rows SUM to the line total: 812.40 + 626.35 + 703.25 + 558.00
// = 2,700.00 ✓ (the real screen's "✓ N entries = $X" reconciliation footer,
// DeductionsStep.tsx:480-490).
const EX_SUPPLIES_ENTRIES = [
  { date: '2025-02-11', desc: 'Riverside Roasters — beans (bulk)', amount: 812.4 },
  { date: '2025-05-06', desc: 'Harbor Restaurant Supply — packaging', amount: 626.35 },
  { date: '2025-08-19', desc: 'Riverside Roasters — beans (bulk)', amount: 703.25 },
  { date: '2025-11-03', desc: 'Harbor Restaurant Supply — cups & lids', amount: 558.0 },
];

// The one 2025 disposition — a FULL wash sale, so Schedule D nets to 0.00
// and the 1040 set above is untouched (header-comment math).
const EX_8949 = {
  symbol: 'GRNV',
  description: '20 sh GRNV',
  acquired: '03/04/25',
  sold: '04/10/25',
  holdingDays: 37,
  proceeds: 472.0,
  basis: 820.0,
  adjustment: 348.0,
  gainLoss: 0.0,
  box: 'A',
  // The engine's real reasoning string shape (tax-report-service.ts:64-75).
  reasoning: 'Broker-reported basis (source=plaid), short-term',
  disallowed: 348.0,
  estAddlTax: 121.8, // round2(348 × 0.35), wash-sales/route.ts:49-52
};

// Verbatim disclaimer strings (inventory disclaimer table).
const DISCLAIMER =
  'TAX ESTIMATE ONLY — All figures must be verified by a licensed CPA or tax professional before filing.'; // calculate/route.ts:316
const DRAFT_WATERMARK = 'DRAFT — NOT FOR FILING'; // tax-pdf-service.ts:70
const NOT_A_PREPARER = 'Temple Stuart is not a tax preparer.'; // tax-pdf-service.ts:228
const WASH_35_NOTE =
  'Estimated using 35% short-term rate. Actual impact depends on your tax bracket and whether losses are short-term or long-term.'; // wash-sales/route.ts:60

// $ with 2 decimals — the tax steps' fmtMoney shape (IncomeReviewStep.tsx:117-125).
const usd2 = (n: number) =>
  '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── dark slide shell (panel token family, same look as the Trade/Books decks) ─

function DarkSlide({ title, tag = 'Example return', children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-4 font-mono text-[11px] leading-relaxed">
      <div className="flex items-center justify-between gap-2 border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">{title}</span>
        <ExampleTag text={tag} />
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// ── HERO ─────────────────────────────────────────────────────────────────────

export function UnlockTaxButton({ currentUserId, onRequireAuth }: { currentUserId: string; onRequireAuth: () => void }) {
  return (
    <button
      type="button"
      onClick={routeAway(currentUserId, onRequireAuth)}
      className="rounded-lg bg-brand-purple px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover"
    >
      Unlock Tax
    </button>
  );
}

export function TaxHeroTerminal() {
  return (
    <div className="rounded-lg border border-panel-border bg-panel/90 p-4 font-mono text-[11px] leading-relaxed shadow-2xl">
      <div className="flex items-center justify-between border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">Tax · Filing year 2025</span>
        <ExampleTag text="Example return" />
      </div>
      <p className="mt-2 text-brand-green">Tax begins at completed books — 2025: periods closed ✓</p>
      {/* The derivation spine — every figure engine-executed (header comment). */}
      <div className="mt-2 border-t border-panel-border pt-2 text-white/70">
        <p><span className="text-white/50">Schedule C net </span><span className="text-white">{usd2(EX.netProfit)}</span></p>
        <p><span className="text-white/50">→ SE tax </span><span className="text-white">{usd2(EX.se.line12)}</span><span className="text-white/50"> · ½ deductible </span><span className="text-white/80">{usd2(EX.se.line13)}</span></p>
        <p><span className="text-white/50">→ AGI </span><span className="text-white">{usd2(EX.agi)}</span><span className="text-white/50"> − standard deduction </span><span className="text-white/80">{usd2(EX.standardDeduction)}</span></p>
        <p><span className="text-white/50">→ taxable </span><span className="text-white">{usd2(EX.taxable)}</span><span className="text-white/50"> → federal </span><span className="text-brand-amber">{usd2(EX.federal)}</span></p>
        <p><span className="text-white/50">Total tax </span><span className="text-white">{usd2(EX.totalTax)}</span><span className="text-white/50"> · estimated amount owed </span><span className="text-brand-red">{usd2(EX.owed)}</span></p>
      </div>
      {/* The calculate disclaimer INSIDE the panel — verbatim (calculate/route.ts:316). */}
      <p className="mt-2 border-t border-panel-border pt-2 text-[10px] italic text-white/50">{DISCLAIMER}</p>
    </div>
  );
}

// ── THE 8 SLIDE PANELS (the inventory's causal order) ────────────────────────

/** 1. THE HANDOFF GATE — mirrors TaxHandoffGate: the closed-period contract
 *  (:63-66), the gate strings (:103-108), the fail-loud state (:85). */
export function HandoffGatePanel() {
  return (
    <DarkSlide title="The handoff gate — closed books first">
      <div className="space-y-1 text-white/70">
        <p><span className="text-white/50">check</span> closing_periods · 2025 <span className="float-right text-brand-green">12 of 12 months closed ✓</span></p>
        <p className="border-t border-panel-border pt-1 text-white">&ldquo;Tax begins at completed books&rdquo;</p>
        <p className="text-white/50">
          &ldquo;Your tax figures come straight from your ledger, so the filing wizard opens once
          you&rsquo;ve closed at least one accounting period.&rdquo;
        </p>
        <p>No closed period → the wizard stays locked, with one button: <span className="text-brand-amber">Go to Books &amp; close a period</span></p>
        <p className="border-t border-panel-border pt-1 text-white/50">
          And if the check itself fails: <span className="text-brand-red">&ldquo;Nothing is assumed — the tax wizard stays locked until we can confirm.&rdquo;</span>
        </p>
      </div>
    </DarkSlide>
  );
}

/** 2. LIFE EVENTS, AUTO-DETECTED — mirrors the wizard's auto-detect
 *  (TaxFilingWizard.tsx:160-242) + the checklist's auto-detected badge
 *  (LifeEventsStep.tsx:57-61). */
export function LifeEventsPanel() {
  return (
    <DarkSlide title="Life events — detected from your data">
      <div className="space-y-1 text-white/70">
        <p><span className="text-brand-green">☑</span> I ran a business or side gig <span className="rounded border border-brand-green/40 bg-brand-green/10 px-1 text-[9px] uppercase text-brand-green">auto-detected</span></p>
        <p className="pl-4 text-white/50">← your sole-prop entity: {EX.business}</p>
        <p><span className="text-brand-green">☑</span> I bought or sold investments <span className="rounded border border-brand-green/40 bg-brand-green/10 px-1 text-[9px] uppercase text-brand-green">auto-detected</span></p>
        <p className="pl-4 text-white/50">← your investment transactions (1 disposition in 2025)</p>
        <p><span className="text-white/40">☐</span> I had a W-2 job</p>
        <p><span className="text-white/40">☐</span> I contributed to or withdrew from retirement</p>
        <p className="border-t border-panel-border pt-1 text-white/50">
          Detection reads your entities, positions, and investment activity — pre-checked, never
          locked: every box stays yours to toggle.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 3. DOCUMENTS — mirrors DocumentsStep's auto-populated cards (:595-617,
 *  full names :134-149) + the structured intake types (:87-124). */
export function DocumentsPanel() {
  return (
    <DarkSlide title="Documents — half already filled">
      <div className="space-y-1 text-white/70">
        <p className="text-white/50">ALREADY CAPTURED</p>
        <p><span className="text-white">Schedule C</span> — Profit or Loss From Business <span className="rounded border border-brand-green/40 bg-brand-green/10 px-1 text-[9px] uppercase text-brand-green">from your data</span></p>
        <p className="pl-4 text-white/50">Auto-populated from: Your ledger (sole-prop entity)</p>
        <p><span className="text-white">1099-B</span> — Proceeds From Broker Transactions <span className="rounded border border-brand-green/40 bg-brand-green/10 px-1 text-[9px] uppercase text-brand-green">from your data</span></p>
        <p className="pl-4 text-white/50">Auto-populated from: Your trading positions &amp; lot dispositions</p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/50">ENTER THESE FORMS — structured, box-labeled intake for the events you check:</p>
        <p>W-2 <span className="text-white/50">Wage and Tax Statement</span> · 1099-R <span className="text-white/50">Retirement</span></p>
        <p>1098-E <span className="text-white/50">Student Loan Interest</span> · 1098-T <span className="text-white/50">Tuition</span></p>
      </div>
    </DarkSlide>
  );
}

/** 4. INCOME, SOURCE-TRACED — mirrors IncomeReviewStep's cards + source
 *  badges (:158-179,:655-896) and the Form 1040 Income Summary (:1056-1112). */
export function IncomePanel() {
  return (
    <DarkSlide title="Income — every line traced to its source">
      <div className="space-y-1 text-white/70">
        <p><span className="text-white">Business Income (Schedule C)</span> <span className="float-right text-white">{usd2(EX.netProfit)}</span></p>
        <p className="pl-4 text-brand-green">✓ from your Business entity ledger</p>
        <p><span className="text-white">Capital Gains &amp; Losses</span> · 1 disposition <span className="float-right text-white">$0.00</span></p>
        <p className="pl-4 text-brand-green">✓ from trading positions &amp; lot dispositions</p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/50">FORM 1040 — INCOME SUMMARY</p>
        <p>Line 9 — Total income <span className="float-right text-white">{usd2(EX.netProfit)}</span></p>
        <p className="text-white/50">Less: deductible half of SE tax <span className="float-right">{usd2(EX.se.line13)}</span></p>
        <p className="border-t border-panel-border pt-1">Line 11 — Adjusted Gross Income <span className="float-right font-bold text-white">{usd2(EX.agi)}</span></p>
        <p className="mt-1 text-[10px] italic text-white/40">{DISCLAIMER}</p>
      </div>
    </DarkSlide>
  );
}

/** 5. DEDUCTIONS WITH RECEIPTS — mirrors DeductionsStep's 3-level drill-down
 *  (:357-504) with the "✓ N entries = $X" footer (:480-490), the mapper's
 *  honest Line-27a default (AccountTaxMappings.tsx:361-367,:406-408), and
 *  the Schedule SE preview (:604-646). */
export function DeductionsPanel() {
  return (
    <DarkSlide title="Schedule C — drill to the entry behind it">
      <div className="space-y-1 text-white/70">
        <p>Line 20b Rent (other business property) <span className="float-right text-white">{usd2(EX.expenses.rent)}</span></p>
        <p>Line 9 Car and truck expenses <span className="float-right text-white">{usd2(EX.expenses.carTruck)}</span></p>
        <p>▼ Line 22 Supplies <span className="float-right text-white">{usd2(EX.expenses.supplies)}</span></p>
        <p className="pl-4 text-white/50">▼ 6120 Supplies · 4 entries</p>
        {EX_SUPPLIES_ENTRIES.map((e) => (
          <p key={e.date} className="pl-8 text-white/50">{e.date} {e.desc} <span className="float-right text-white/80">{usd2(e.amount)}</span></p>
        ))}
        <p className="pl-8 text-brand-green">✓ 4 entries = {usd2(EX.expenses.supplies)}</p>
        <p className="border-t border-panel-border pt-1">Line 28 Total expenses <span className="float-right text-white">{usd2(EX.expenses.total)}</span> </p>
        <p>Line 31 Net profit <span className="float-right font-bold text-white">{usd2(EX.netProfit)}</span></p>
        <p className="mt-1 text-white/50">Mapper: every expense account assigned to its line — unmapped accounts default to <span className="text-brand-amber">Line 27a (Other expenses)</span> until you assign them, and the screen says so.</p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/50">SCHEDULE SE PREVIEW</p>
        <p>Line 12 — Self-employment tax (15.3%) <span className="float-right text-white">{usd2(EX.se.line12)}</span></p>
        <p className="text-white/50">Line 13 — Deductible half of SE tax <span className="float-right">{usd2(EX.se.line13)}</span></p>
        <p className="mt-1 text-[10px] italic text-white/40">{DISCLAIMER}</p>
      </div>
    </DarkSlide>
  );
}

/** 6. TRADING: 8949 WITH REASONING — mirrors TradingStep's 8949 box groups
 *  (:536-749) with box_reasoning (:690-695), the W adjustment detail
 *  (:696-712), and the wash-sale panel with the route's 35% note verbatim
 *  (wash-sales/route.ts:60; WashSaleReport.tsx:306-310). */
export function TradingPanel() {
  return (
    <DarkSlide title="Form 8949 — every box explained">
      <div className="space-y-1 text-white/70">
        <p><span className="rounded bg-blue-600 px-1 font-bold text-white">A</span> <span className="text-white">Box A</span> · 1 entry <span className="rounded border border-brand-amber/40 bg-brand-amber/10 px-1 text-[9px] font-bold text-brand-amber">W × 1</span></p>
        <p className="text-white/50">Short-term transactions reported on Form 1099-B showing basis was reported to the IRS</p>
        <p className="border-t border-panel-border pt-1">
          <span className="text-white">{EX_8949.description}</span> <span className="text-white/50">{EX_8949.acquired} → {EX_8949.sold}</span>
          <span className="float-right">proceeds {usd2(EX_8949.proceeds)} · basis {usd2(EX_8949.basis)}</span>
        </p>
        <p className="pl-4 text-white/50">box reasoning: <span className="text-white/80">{EX_8949.reasoning}</span></p>
        <p className="pl-4">adjustment <span className="text-brand-amber">W — Wash sale loss disallowed · +{usd2(EX_8949.adjustment)}</span> <span className="float-right">reported G/L <span className="text-white">{usd2(EX_8949.gainLoss)}</span></span></p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/50">WASH SALES · per IRS Pub 550 (30-day window)</p>
        <p>1 violation · <span className="text-brand-red">{usd2(EX_8949.disallowed)} disallowed</span> · est. additional tax <span className="text-brand-amber">{usd2(EX_8949.estAddlTax)}</span></p>
        <p className="text-white/50">&ldquo;{WASH_35_NOTE}&rdquo;</p>
        <p className="text-white/50">The disallowed loss is added to the replacement lot&rsquo;s cost basis — Schedule D nets to <span className="text-white">$0.00</span>.</p>
      </div>
    </DarkSlide>
  );
}

/** 7. THE 1040, LINE BY LINE — mirrors ReviewStep's line-by-line return with
 *  the per-bracket table (:613-658) and the DRAFT PDF language (:832-835);
 *  watermark string verbatim (tax-pdf-service.ts:70). */
export function Form1040Panel() {
  return (
    <DarkSlide title="Form 1040 — derived, not typed">
      <div className="space-y-1 text-white/70">
        <p>Line 8 — Other income (Schedule C) <span className="float-right text-white">{usd2(EX.netProfit)}</span></p>
        <p>Line 11 — Adjusted Gross Income <span className="float-right text-white">{usd2(EX.agi)}</span></p>
        <p>Line 12 — Standard deduction (single) <span className="float-right text-white/80">{usd2(EX.standardDeduction)}</span></p>
        <p>Line 15 — Taxable income <span className="float-right text-white">{usd2(EX.taxable)}</span></p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/50">ORDINARY INCOME BRACKETS <span className="float-right">RATE · IN BRACKET · TAX</span></p>
        <p><span className="text-white/80">$0 – $11,600</span> <span className="float-right">10.0% · {usd2(EX.taxable)} · <span className="text-white">{usd2(EX.federal)}</span></span></p>
        <p>Line 23 — Self-employment tax <span className="float-right text-white">{usd2(EX.se.line12)}</span></p>
        <p className="border-t border-panel-border pt-1">Line 24 — Total tax <span className="float-right font-bold text-white">{usd2(EX.totalTax)}</span></p>
        <p className="text-brand-red">ESTIMATED AMOUNT OWED <span className="float-right font-bold">{usd2(EX.owed)}</span></p>
        <p className="mt-1 border-t border-panel-border pt-1 font-bold tracking-widest text-brand-amber">{DRAFT_WATERMARK}</p>
        <p className="text-white/50">Every PDF is watermarked DRAFT — these are for review only, not for filing.</p>
        <p className="text-[10px] italic text-white/40">{DISCLAIMER}</p>
      </div>
    </DarkSlide>
  );
}

/** 8. FILE-READY — mirrors FileStep's export tools (:425-580), the TaxAct
 *  walkthrough (:582-834) and its ±$50 sanity check (:819-827). */
export function FileReadyPanel() {
  return (
    <DarkSlide title="File-ready — the package">
      <div className="space-y-1 text-white/70">
        <p className="text-white/50">EXPORTS</p>
        <p>· Form 8949 CSV <span className="text-white/50">— for TaxAct Premier+ import (1 transaction)</span></p>
        <p>· Schedule C CSVs <span className="text-white/50">— line summary + account detail</span></p>
        <p>· Tax Filing Summary <span className="text-white/50">— every number you need for TaxAct in one document</span></p>
        <p>· All Forms PDF <span className="text-brand-amber">{DRAFT_WATERMARK}</span></p>
        <p>· CPA Export Package <span className="text-white/50">— trial balance · income statement · balance sheet · general ledger</span></p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/50">THE WALKTHROUGH</p>
        <p>A 12-step TaxAct guide filled with YOUR numbers — and a sanity check:</p>
        <p className="text-white/80">&ldquo;TaxAct should compute approximately {usd2(EX.owed)} owed. If the number differs by more than $50, review each section for data-entry errors.&rdquo;</p>
        <p className="mt-1 border-t border-panel-border pt-1 text-white/50">{NOT_A_PREPARER} The wizard prepares the numbers; you file with your CPA or filing software.</p>
      </div>
    </DarkSlide>
  );
}

