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
 * MOUNTABILITY (inventory Phase 2): every wizard step except Life events
 * self-fetches on mount → STATIC MIRROR with per-block correspondence cites
 * (the Trade/Books discipline). The ONLY live mount is LifeEventsStep —
 * zero fetches, fully props-driven via StepProps (TaxFilingWizard.tsx:40-47).
 * SHOW discipline: ZERO fetches in this file, all actions → signup/CTA,
 * every panel example-tagged.
 */

import { useState } from 'react';
import { BookOpen, Lock } from 'lucide-react';
import LifeEventsStep from '@/components/tax-filing/steps/LifeEventsStep';
import type { LifeEvents } from '@/components/tax-filing/TaxFilingWizard';
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

// ── THE LIVE SECTION — the gate + the wizard's 7 steps in order ──────────────
//
// Composition (the connective line's claim must equal exactly this):
//   • Handoff gate — STATIC MIRROR (self-fetches on mount, TaxHandoffGate:47,:59)
//   • Wizard shell chrome — STATIC MIRROR (shell runs auto-detect fetches on
//     mount, TaxFilingWizard.tsx:165-168; the chrome :294-453 is inline JSX)
//   • Step 1 Life events — THE ONE REAL MOUNT: zero fetches, fully props-
//     driven (StepProps seam, TaxFilingWizard.tsx:40-47) — inventory Phase 2's
//     sole EXAMPLE-FED candidate
//   • Steps 2-7 — STATIC MIRRORS (each self-fetches on mount: DocumentsStep
//     :197, IncomeReviewStep :301-305, DeductionsStep :130, TradingStep
//     :227-229, ReviewStep :250, FileStep :172-174)

/** Showcase chrome (not part of the real screen): declares on each block's
 *  face whether what follows is the real component mounted live or a faithful
 *  static mirror — the Books-deck truth-strip pattern. */
function StepTruthStrip({ real }: { real: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 bg-gray-50/80 px-4 py-1.5">
      <span className={`text-[10px] font-bold uppercase tracking-wider ${real ? 'text-brand-green' : 'text-text-muted'}`}>
        {real ? 'Real component — mounted live' : 'Faithful mirror of the real screen'}
      </span>
      <ExampleTag text="Example return" />
    </div>
  );
}

/** Kills the native control and routes the click to signup/CTA. */
const interceptTo = (away: () => void) => (e: React.SyntheticEvent) => {
  e.preventDefault();
  away();
};

/** The wizard's step card chrome — mirrors TaxFilingWizard.tsx:417-453
 *  (header "N. Label" + description, content, Back/Next footer). */
function StepCardMirror({
  n, label, description, real, away, nextLabel = 'Next →', backDisabled = false, children,
}: {
  n: number; label: string; description: string; real: boolean; away: () => void;
  nextLabel?: string; backDisabled?: boolean; children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <StepTruthStrip real={real} />
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-lg font-semibold text-gray-900">{n}. {label}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      <div className="p-5">{children}</div>
      {/* Footer — mirrors :434-452; both actions route away. */}
      <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
        <button type="button" onClick={away} disabled={backDisabled} className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">← Back</button>
        <button type="button" onClick={away} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">{nextLabel}</button>
      </div>
    </div>
  );
}

/** Small line row — the steps' shared label/amount row shape
 *  (IncomeReviewStep DetailRow :256-282 / DeductionsStep Row :674-708). */
function MirrorRow({ label, value, bold, muted, indent = 0 }: { label: React.ReactNode; value: React.ReactNode; bold?: boolean; muted?: boolean; indent?: number }) {
  return (
    <div className="flex items-center justify-between py-1 text-sm" style={{ paddingLeft: indent * 12 }}>
      <span className={muted ? 'text-gray-500' : bold ? 'font-semibold text-gray-900' : 'text-gray-700'}>{label}</span>
      <span className={`font-mono ${muted ? 'text-gray-500' : bold ? 'font-bold text-gray-900' : 'text-gray-900'}`}>{value}</span>
    </div>
  );
}

/** Source badge — mirrors IncomeReviewStep SourceBadge :158-179 (verified tone). */
function VerifiedBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold border rounded text-emerald-700 bg-emerald-50 border-emerald-200">
      <span>✓</span>{label}
    </span>
  );
}

// 0. THE HANDOFF GATE — mirror of TaxHandoffGate's gate screen (:97-119).
// The gate self-fetches entities + closing-periods on mount (:47,:59) → not
// mountable. This mirror shows the LOCKED state (what you see before books
// are closed); with 2025's periods closed it opens straight to the wizard.
function HandoffGateMirror({ away }: { away: () => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <StepTruthStrip real={false} />
      <div className="p-4">
        {/* Gate card — mirrors :98-118 (gold card, Lock, the real strings). */}
        <div className="rounded-xl border-2 border-brand-gold/50 bg-brand-gold/5 px-6 py-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-gold/15 text-brand-gold">
            <Lock className="h-6 w-6" aria-hidden="true" />
          </div>
          <h3 className="text-lg font-semibold text-text-primary">Tax begins at completed books</h3>
          <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary">
            Your tax figures come straight from your ledger, so the filing wizard opens once
            you&rsquo;ve closed at least one accounting period. No periods are closed yet.
          </p>
          <button
            type="button"
            onClick={away}
            className="mx-auto mt-5 inline-flex items-center gap-2 rounded-lg bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple/90"
          >
            <BookOpen className="h-4 w-4" aria-hidden="true" />
            Go to Books &amp; close a period
          </button>
        </div>
        <p className="mt-3 text-xs text-text-muted">
          This is the locked state. In the 2025 example year every period is closed, so the gate
          opens straight to the wizard below.
        </p>
      </div>
    </div>
  );
}

// The wizard shell — mirror of TaxFilingWizard :294-453 (header, year
// selector pinned to the declared 2025 year, progress bar, step dots), with
// the REAL LifeEventsStep mounted as the current step's content.
function WizardShellWithLiveStep({ away }: { away: () => void }) {
  const block = interceptTo(away);
  // THE ONE REAL MOUNT — LifeEventsStep is zero-fetch and fully props-driven
  // (StepProps, TaxFilingWizard.tsx:40-47). Declared state matches the
  // scenario: business + trading auto-detected (the wizard's real detectors,
  // :172-193,:226-229); the checkboxes genuinely toggle (local state only).
  const [lifeEvents, setLifeEvents] = useState<LifeEvents>({
    hasW2: false,
    hasBusiness: true,
    hasTrading: true,
    hasRetirement: false,
    hasStudentLoan: false,
    hasEducation: false,
    hasInterestDividends: false,
    hasRental: false,
  });
  const steps = ['Life events', 'Documents', 'Income', 'Deductions', 'Trading', 'Review', 'File']; // STEPS :57-107
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <StepTruthStrip real={true} />
      <div className="px-4 py-6">
        {/* Header — mirrors :296-330 ("File your taxes", year selector; the
            real default IS 2025 today per defaultTaxYear :120-133; options
            per availableTaxYears :138-141). */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">File your taxes</h1>
            <p className="text-sm text-gray-500 mt-1">Tax year 2025 · Step 1 of 7 · Life events</p>
          </div>
          <div className="shrink-0">
            <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1 text-right">Tax year</label>
            <select value={2025} onMouseDown={block} onChange={away} className="px-3 py-1.5 text-sm font-mono font-semibold border border-gray-300 rounded bg-white">
              {[2027, 2026, 2025, 2024].map((y) => (<option key={y} value={y}>{y}</option>))}
            </select>
          </div>
        </div>
        {/* Progress bar — mirrors :332-352 (step 1 current = blue). */}
        <div className="mb-4">
          <div className="flex gap-1.5">
            {steps.map((s, i) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${i === 0 ? 'bg-blue-500' : 'bg-gray-200'}`} aria-hidden />
            ))}
          </div>
        </div>
        {/* Step dots — mirrors :354-407. */}
        <div className="mb-6">
          <ol className="grid grid-cols-7 gap-2">
            {steps.map((s, i) => (
              <li key={s}>
                <button type="button" onClick={away} className={`w-full flex flex-col items-center gap-1.5 ${i === 0 ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                  <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-semibold ${i === 0 ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-400 border-gray-300'}`}>{i + 1}</span>
                  <span className={`text-[11px] text-center leading-tight ${i === 0 ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>{s}</span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        {/* Current step card — mirrors :417-453, content = the REAL step. */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">1. Life events</h2>
            <p className="text-sm text-gray-500 mt-0.5">What happened this year</p>
          </div>
          <div className="p-5">
            <LifeEventsStep
              taxYear={2025}
              onComplete={away}
              onBack={away}
              lifeEvents={lifeEvents}
              setLifeEvents={setLifeEvents}
              autoDetected={{ hasBusiness: true, hasTrading: true }}
            />
          </div>
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between rounded-b-lg">
            <button type="button" disabled className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md disabled:opacity-40 disabled:cursor-not-allowed">← Back</button>
            <button type="button" onClick={away} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700">Next →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 2. DOCUMENTS — mirror of DocumentsStep (self-fetches /api/tax/documents on
// mount, :197,:230-232). Scenario-true render: with only business + trading
// checked, no editable intake cards appear — the screen shows the two
// auto-populated cards (:595-617; type definitions :134-149).
function DocumentsMirror({ away }: { away: () => void }) {
  return (
    <StepCardMirror n={2} label="Documents" description="Upload or enter your tax documents" real={false} away={away}>
      <div className="space-y-5">
        {/* Intro — mirrors :624-627. */}
        <p className="text-sm text-gray-600">
          Enter each tax document you received. Only the forms relevant to the life events you
          checked are shown here.
        </p>
        {/* Auto-populated cards — mirrors :655-663 header + :595-617 cards. */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Already captured</h3>
          {[
            { label: 'Schedule C', fullName: 'Profit or Loss From Business', source: 'Your ledger (sole-prop entity)' },
            { label: '1099-B', fullName: 'Proceeds From Broker Transactions', source: 'Your trading positions & lot dispositions' },
          ].map((auto) => (
            <div key={auto.label} className="border border-gray-200 rounded-lg border-l-4 border-l-emerald-500 overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">{auto.label}</span>
                    <span className="text-xs text-gray-500">{auto.fullName}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Auto-populated from: {auto.source}</p>
                </div>
                <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded">from your data</span>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-500">
          Check a W-2, retirement, student-loan, or education life event and its box-labeled intake
          card appears here — multiple entries per type.
        </p>
      </div>
    </StepCardMirror>
  );
}

// 3. INCOME — mirror of IncomeReviewStep (self-fetches calculate + documents
// + report on mount, :301-305). Cards :655-896, AGI summary :1056-1112,
// disclaimer :1114-1116.
function IncomeMirror({ away }: { away: () => void }) {
  return (
    <StepCardMirror n={3} label="Income" description="Review your income sources" real={false} away={away}>
      <div className="space-y-5">
        {/* Intro — mirrors :501-505. */}
        <p className="text-sm text-gray-600">
          Every income number below is traced back to its source. Click any card to see the
          underlying documents, ledger entries, or trading positions.
        </p>
        {/* Business income card — mirrors :655-738 (IncomeCard shell :183-252). */}
        <div className="border border-gray-200 bg-white rounded-lg overflow-hidden">
          <button type="button" onClick={away} className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-gray-400 w-3">▶</span>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">Business Income (Schedule C)</span>
                  <VerifiedBadge label="from your Business entity ledger" />
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{EX.business}</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Net Profit</div>
              <div className="text-lg font-mono font-semibold text-gray-900">{usd2(EX.netProfit)}</div>
            </div>
          </button>
        </div>
        {/* Capital gains card — mirrors :845-896. */}
        <div className="border border-gray-200 bg-white rounded-lg overflow-hidden">
          <button type="button" onClick={away} className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs text-gray-400 w-3">▶</span>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900">Capital Gains &amp; Losses</span>
                  <VerifiedBadge label="from trading positions & lot dispositions" />
                </div>
                <div className="text-xs text-gray-500 mt-0.5">1 disposition</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Net Gain</div>
              <div className="text-lg font-mono font-semibold text-gray-900">$0.00</div>
            </div>
          </button>
        </div>
        {/* AGI summary — mirrors :1056-1112 (labels verbatim). */}
        <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider mb-3">Form 1040 — Income Summary</h3>
          <div className="space-y-0.5">
            <MirrorRow label="Line 1 — W-2 wages" value="$0.00" />
            <MirrorRow label="Line 5b — Pension / IRA taxable" value="$0.00" />
            <MirrorRow label="Line 7 — Capital gain/(loss)" value="$0.00" />
            <MirrorRow label="Line 8 — Schedule C net profit/(loss)" value={usd2(EX.netProfit)} />
            <div className="pt-2 border-t border-blue-200"><MirrorRow label="Line 9 — Total income" value={usd2(EX.netProfit)} bold /></div>
            <MirrorRow label="Less: deductible half of SE tax" value={usd2(EX.se.line13)} muted />
            <MirrorRow label="Less: student loan interest deduction" value="$0.00" muted />
            <div className="pt-2 border-t border-blue-200">
              <div className="flex items-center justify-between py-1">
                <span className="text-sm font-semibold text-blue-900">Line 11 — Adjusted Gross Income</span>
                <span className="font-mono text-lg font-bold text-blue-900">{usd2(EX.agi)}</span>
              </div>
            </div>
          </div>
        </div>
        {/* Disclaimer — verbatim, exactly where the real step renders it (:1114-1116). */}
        <p className="text-xs text-gray-400 italic">{DISCLAIMER}</p>
      </div>
    </StepCardMirror>
  );
}

// 4. DEDUCTIONS — mirror of DeductionsStep (self-fetches /api/tax/calculate
// on mount, :130,:144-146): overview :251-308, drill-down :357-504 with the
// "✓ N entries = $X" footer :480-490, mapper strip :547-575 +
// AccountTaxMappings table :369-458, SE preview :604-646, confirm :648-665.
function DeductionsMirror({ away }: { away: () => void }) {
  const block = interceptTo(away);
  return (
    <StepCardMirror n={4} label="Deductions" description="Business expenses (Schedule C)" real={false} away={away} nextLabel="Confirm Schedule C">
      <div className="space-y-5">
        {/* Overview card — mirrors :251-308. */}
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">{EX.business}</div>
              <div className="text-xs text-gray-500">Schedule C — Profit or Loss From Business · Tax year 2025</div>
            </div>
            <div className="text-right">
              <div className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Net Profit</div>
              <div className="text-xl font-mono font-bold text-gray-900">{usd2(EX.netProfit)}</div>
            </div>
          </div>
          <div className="px-4 py-3 space-y-1">
            <MirrorRow label="Line 1 — Gross receipts" value={usd2(EX.grossReceipts)} />
            <MirrorRow label="Line 7 — Gross profit" value={usd2(EX.grossReceipts)} />
            <MirrorRow label="Line 28 — Total expenses" value={usd2(EX.expenses.total)} />
            <div className="pt-2 border-t border-gray-100"><MirrorRow label="Line 31 — Net profit/(loss)" value={usd2(EX.netProfit)} bold /></div>
          </div>
        </div>
        {/* Part II drill-down — mirrors :357-504; Line 22 expanded through
            account 6120 to its 4 enumerated ledger entries (sum stated in the
            EX_SUPPLIES_ENTRIES comment). */}
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <span className="text-sm font-semibold text-gray-900">Part II — Expenses</span>
            <span className="ml-2 text-xs text-gray-500">sorted by amount · click any line to drill down</span>
          </div>
          <div className="divide-y divide-gray-100">
            <button type="button" onClick={away} className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50">
              <span className="text-sm text-gray-900"><span className="text-xs text-gray-400 mr-1">▶</span><span className="font-mono text-xs text-gray-400 mr-1">Line 20b</span>Rent (other business property)</span>
              <span className="font-mono text-sm font-semibold text-gray-900">{usd2(EX.expenses.rent)}</span>
            </button>
            <button type="button" onClick={away} className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50">
              <span className="text-sm text-gray-900"><span className="text-xs text-gray-400 mr-1">▶</span><span className="font-mono text-xs text-gray-400 mr-1">Line 9</span>Car and truck expenses</span>
              <span className="font-mono text-sm font-semibold text-gray-900">{usd2(EX.expenses.carTruck)}</span>
            </button>
            <div>
              <button type="button" onClick={away} className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-gray-50">
                <span className="text-sm text-gray-900"><span className="text-xs text-gray-400 mr-1">▼</span><span className="font-mono text-xs text-gray-400 mr-1">Line 22</span>Supplies</span>
                <span className="font-mono text-sm font-semibold text-gray-900">{usd2(EX.expenses.supplies)}</span>
              </button>
              <div className="border-l-2 border-blue-100 ml-6 pl-3 pb-2">
                <div className="py-1.5 flex items-center justify-between">
                  <span className="text-sm text-gray-700"><span className="text-xs text-gray-400 mr-1">▼</span><span className="font-mono text-xs text-gray-400 mr-1">6120</span>Supplies <span className="text-[10px] text-gray-400 ml-1">4 entries</span></span>
                  <span className="font-mono text-sm text-gray-900">{usd2(EX.expenses.supplies)}</span>
                </div>
                <div className="border-l border-dashed border-gray-200 ml-3 pl-3 pb-2">
                  {EX_SUPPLIES_ENTRIES.map((e) => (
                    <div key={e.date} className="flex items-center justify-between py-0.5 text-[11px] font-mono">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-gray-400 shrink-0">{e.date}</span>
                        <span className="text-gray-700 truncate">{e.desc}</span>
                      </div>
                      <span className="shrink-0 text-gray-700">{usd2(e.amount)}</span>
                    </div>
                  ))}
                  {/* Reconciliation footer — the real string shape (:480-490). */}
                  <div className="pt-1 mt-1 border-t border-dashed border-gray-200 text-[11px]">
                    <span className="text-emerald-600">✓ 4 entries = {usd2(EX.expenses.supplies)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* The mapper — mirrors AccountTaxMappings :301-467 (three mapped
            accounts, saved; the honest Line-27a default in the select's own
            option label :406-408; the multiplier note :463-467). */}
        <div className="border border-gray-200 rounded-lg bg-gray-50/50 p-4 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Schedule C tax mappings</h3>
            <p className="text-xs text-gray-500">
              Assign each business expense account to a Schedule C line. Mappings are per tax year —
              changes here affect your <strong>2025</strong> Schedule C only.
            </p>
          </div>
          <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="text-left px-3 py-2">Code</th>
                  <th className="text-left px-3 py-2">Account name</th>
                  <th className="text-left px-3 py-2">Schedule C line</th>
                  <th className="text-right px-3 py-2">Multiplier</th>
                  <th className="text-right px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {[
                  { code: '6010', name: 'Car & Truck Expenses', line: 'Line 9 — Car and truck expenses' },
                  { code: '6100', name: 'Rent (Business)', line: 'Line 20b — Rent (other business property)' },
                  { code: '6120', name: 'Supplies', line: 'Line 22 — Supplies' },
                ].map((a) => (
                  <tr key={a.code}>
                    <td className="px-3 py-2 font-mono text-xs text-gray-700">{a.code}</td>
                    <td className="px-3 py-2 text-gray-900">{a.name}</td>
                    <td className="px-3 py-2">
                      <select value={a.line} onMouseDown={block} onChange={away} className="w-full px-2 py-1 text-xs border border-gray-300 rounded">
                        <option value={a.line}>{a.line}</option>
                        <option value="__unmapped__">— Unmapped (Line 27a default) —</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right"><input type="number" value="1.00" readOnly onMouseDown={block} className="w-16 px-1.5 py-0.5 text-xs text-right font-mono border border-gray-300 rounded" /></td>
                    <td className="px-3 py-2 text-right text-xs"><span className="text-emerald-700 font-semibold">✓ saved</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-gray-400 italic">
            Multiplier defaults to 1.00 for everything, 0.50 for Deductible meals (Line 24b). An
            unmapped account defaults to Line 27a (Other expenses) — and the screen says so until
            you assign it.
          </p>
        </div>
        {/* Schedule SE preview — mirrors :604-646 (labels verbatim). */}
        <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider mb-3">Schedule SE — Self-Employment Tax Preview</h3>
          <div className="space-y-0.5">
            <MirrorRow label="Line 2 — Net profit from Schedule C" value={usd2(EX.netProfit)} />
            <MirrorRow label="Line 3 — Net earnings (Line 2 × 92.35%)" value={usd2(EX.se.line3)} muted />
            <div className="pt-2 border-t border-blue-200"><MirrorRow label="Line 12 — Self-employment tax (15.3%)" value={usd2(EX.se.line12)} bold /></div>
            <MirrorRow label="Line 13 — Deductible half of SE tax" value={usd2(EX.se.line13)} muted />
            <p className="pt-2 text-xs text-blue-800">Line 13 flows to Schedule 1 as an adjustment to income, reducing your AGI.</p>
          </div>
        </div>
        {/* Status line — mirrors :648-657. */}
        <div className="text-xs text-gray-500">No warnings — Schedule C is ready.</div>
        {/* Disclaimer — verbatim, where the real step renders it (:667). */}
        <p className="text-xs text-gray-400 italic">{DISCLAIMER}</p>
      </div>
    </StepCardMirror>
  );
}

// 5. TRADING — mirror of TradingStep (self-fetches report + wash-sales on
// mount, :227-229): Schedule D card :383-452, wash-sale summary :454-527
// (in-memory note :479-488), 8949 box group :536-749 with box_reasoning
// :690-695 and the W detail :696-712, WashSaleReport metrics + 35% note
// (WashSaleReport.tsx:293-310; wash-sales/route.ts:60), footer :867-881.
function TradingMirror({ away }: { away: () => void }) {
  return (
    <StepCardMirror n={5} label="Trading" description="Capital gains and losses (Schedule D + 8949)" real={false} away={away} nextLabel="Continue anyway">
      <div className="space-y-5">
        {/* Intro — mirrors :378-381. */}
        <p className="text-sm text-gray-600">
          Review every closed position for 2025. Each entry is classified by IRS Form 8949 box and
          contributes to Schedule D Parts I and II.
        </p>
        {/* Schedule D summary — mirrors :383-452. All lines net to $0.00: the
            one disposition is a FULL wash sale (472.00 − 820.00 + 348.00 = 0). */}
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-gray-900">Schedule D — Capital Gains and Losses</div>
              <div className="text-xs text-gray-500">Tax year 2025</div>
            </div>
            <VerifiedBadge label="from trading positions & lot dispositions" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-200">
            <div className="px-4 py-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Part I — Short-term (held 1 year or less)</h4>
              <MirrorRow label="Line 1a — Box A" value="$0.00" muted />
              <MirrorRow label="Line 1b — Box B" value="$0.00" muted />
              <div className="pt-2 mt-2 border-t border-gray-100"><MirrorRow label="Line 7 — Net ST" value="$0.00" bold /></div>
            </div>
            <div className="px-4 py-3">
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Part II — Long-term (held more than 1 year)</h4>
              <MirrorRow label="Line 8a — Box D" value="$0.00" muted />
              <MirrorRow label="Line 8b — Box E" value="$0.00" muted />
              <div className="pt-2 mt-2 border-t border-gray-100"><MirrorRow label="Line 15 — Net LT" value="$0.00" bold /></div>
            </div>
          </div>
          <div className="px-4 py-3 bg-blue-50 border-t border-blue-200 flex items-center justify-between">
            <span className="text-sm font-semibold text-blue-900">Line 16 — Net capital gain/(loss)</span>
            <span className="font-mono text-lg font-bold text-gray-700">$0.00</span>
          </div>
        </div>
        {/* Wash-sale summary — mirrors :454-527, incl. the in-memory honesty
            note verbatim (:479-488). */}
        <div className="border border-amber-200 bg-amber-50 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-amber-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-amber-900">Wash sales detected</span>
              <span className="text-sm font-mono text-amber-900">{usd2(EX_8949.disallowed)} disallowed</span>
            </div>
            <p className="text-xs text-amber-800 mt-1">1 violation · 1 applied in-memory only (not persisted to DB)</p>
          </div>
          <div className="px-4 py-2 bg-amber-100 text-xs text-amber-900 border-b border-amber-200">
            Wash-sale adjustments are shown in your 8949 but not yet persisted to the database. They
            will be included in your export.
          </div>
          <div className="px-4 py-2">
            <div className="flex items-center justify-between text-xs">
              <span><span className="font-mono font-semibold text-amber-900">{EX_8949.symbol}</span><span className="text-amber-800 ml-2">1 violation · sold {EX_8949.sold}, rebought within 30 days</span></span>
              <span className="font-mono text-amber-900">{usd2(EX_8949.disallowed)} disallowed</span>
            </div>
          </div>
          {/* WashSaleReport metrics — mirrors WashSaleReport.tsx:293-310; the
              est-additional-tax figure is round2(348 × 0.35) = 121.80
              (wash-sales/route.ts:49-52) and the note is the route's verbatim
              string (:60). */}
          <div className="px-4 py-2 border-t border-amber-200 text-xs text-amber-900">
            <span className="font-semibold">Est. additional tax {usd2(EX_8949.estAddlTax)}</span> — {WASH_35_NOTE}
          </div>
          <div className="px-4 py-2 border-t border-amber-200 bg-amber-100/50 text-[11px] text-amber-800">
            All-time detection · per IRS Pub 550 (30-day window)
          </div>
        </div>
        {/* 8949 box group — mirrors :536-749. */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Form 8949 — Sales and Dispositions</h3>
            <span className="text-xs text-gray-500">1 entry</span>
          </div>
          <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-6 h-6 rounded font-mono text-xs font-bold text-white bg-blue-600">A</span>
                <span className="text-sm font-semibold text-gray-900">Box A</span>
                <span className="text-xs text-gray-500">1 entry</span>
                <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold text-amber-800 bg-amber-100 border border-amber-200 rounded">W × 1</span>
              </div>
              <div className="text-right">
                <div className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Gain/Loss</div>
                <div className="font-mono text-sm font-semibold text-gray-700">$0.00</div>
              </div>
            </div>
            {/* Box description verbatim (:181). */}
            <div className="px-4 py-1.5 text-[11px] text-gray-500 border-b border-gray-100">
              Short-term transactions reported on Form 1099-B showing basis was reported to the IRS
            </div>
            {/* Entry row + expanded detail — mirrors :624-722. */}
            <div className="px-4 py-2 grid grid-cols-12 gap-2 items-center text-xs bg-amber-50/40">
              <span className="col-span-3 flex items-center gap-1"><span className="text-gray-400 text-[10px]">▼</span><span className="font-mono font-semibold text-gray-900">{EX_8949.symbol}</span><span className="inline-flex items-center px-1 text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-200 rounded">W</span></span>
              <span className="col-span-2 font-mono text-gray-600">{EX_8949.acquired}</span>
              <span className="col-span-2 font-mono text-gray-600">{EX_8949.sold}</span>
              <span className="col-span-2 text-right font-mono text-gray-700">{usd2(EX_8949.proceeds)}</span>
              <span className="col-span-2 text-right font-mono text-gray-700">{usd2(EX_8949.basis)}</span>
              <span className="col-span-1 text-right font-mono font-semibold text-gray-700">{usd2(EX_8949.gainLoss)}</span>
            </div>
            <div className="px-4 pb-3 bg-gray-50/60 text-xs space-y-1">
              <div className="flex justify-between gap-4 py-0.5"><span className="text-gray-500">Description</span><span className="text-gray-800">{EX_8949.description}</span></div>
              <div className="flex justify-between gap-4 py-0.5"><span className="text-gray-500">Holding period</span><span className="text-gray-800">{EX_8949.holdingDays} days · short-term</span></div>
              <div className="flex justify-between gap-4 py-0.5"><span className="text-gray-500">Box reasoning</span><span className="text-gray-800">{EX_8949.reasoning}</span></div>
              <div className="flex justify-between gap-4 py-0.5"><span className="text-gray-500">Adjustment code</span><span className="text-gray-800">W — Wash sale loss disallowed</span></div>
              <div className="flex justify-between gap-4 py-0.5"><span className="text-gray-500">Adjustment amount</span><span className="text-gray-800">{usd2(EX_8949.adjustment)}</span></div>
              <p className="text-amber-800 pt-1">
                The wash sale loss is disallowed on this sale and must be added to the cost basis of
                the replacement security.
              </p>
            </div>
          </div>
        </div>
        {/* Status line — mirrors :867-873 (scenario-true: 1 in-memory merge). */}
        <div className="text-xs text-gray-500">Wash-sale adjustments pending DB persistence.</div>
      </div>
    </StepCardMirror>
  );
}

// 6. REVIEW — mirror of ReviewStep (self-fetches /api/tax/calculate on mount,
// :250,:263-265): header + warnings :371-422, the 1040 line-by-line
// :424-788, bracket table :613-658, result banner :790-824, DRAFT PDF grid
// :827-858, confirmation :860-890, disclaimer :892.
// NOTE: the real screen's Line 13 carries a §199A not-supported note
// (:579-585); the mirror omits that line entirely per the banned-claims
// mandate — Line 14 total deductions equals the standard deduction here.
// The real screen's effective-rate sub-note (:607-611) is also omitted from
// this condensed mirror.
function ReviewMirror({ away }: { away: () => void }) {
  const block = interceptTo(away);
  return (
    <StepCardMirror n={6} label="Review" description="Form 1040 complete return review" real={false} away={away} nextLabel="Continue to File">
      <div className="space-y-5">
        {/* Header — mirrors :373-398. Scenario-true warnings: the calculate
            route flags absent 1098-T/1098-E unconditionally
            (calculate/route.ts:300-301) → the real screen shows these two. */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Review your 2025 return</h2>
            <p className="text-sm text-gray-500 mt-0.5">Filing status: <span className="capitalize">single</span></p>
          </div>
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded">! 2 items need attention</span>
        </div>
        <div className="border border-amber-200 bg-amber-50 rounded-lg p-3">
          <div className="text-sm font-semibold text-amber-900 mb-1">Review these before filing</div>
          <ul className="space-y-1">
            <li className="flex items-center justify-between text-xs text-amber-900"><span>• Missing: 1098T — expected but no document entered</span><span className="text-amber-700 italic ml-2 shrink-0">→ fix in Documents step</span></li>
            <li className="flex items-center justify-between text-xs text-amber-900"><span>• Missing: 1098E — expected but no document entered</span><span className="text-amber-700 italic ml-2 shrink-0">→ fix in Documents step</span></li>
          </ul>
        </div>
        {/* Form 1040 line-by-line — mirrors :424-788. */}
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="text-sm font-semibold text-gray-900">Form 1040 — U.S. Individual Income Tax Return</div>
            <div className="text-xs text-gray-500">Tax year 2025 · line-by-line</div>
          </div>
          <div className="px-4 py-3 space-y-0">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-1 pt-2">Income</div>
            <MirrorRow label="1 — Wages, salaries, tips (W-2 Box 1)" value="$0.00" muted />
            <MirrorRow label="7 — Capital gain or (loss)" value="$0.00" muted />
            <MirrorRow label="8 — Other income (Schedule 1)" value={usd2(EX.netProfit)} />
            <div className="pt-1 border-t border-gray-100 mt-1"><MirrorRow label="9 — Total income" value={usd2(EX.netProfit)} bold /></div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-1 pt-2">Adjustments to income</div>
            <MirrorRow label="10 — Adjustments from Schedule 1 (½ SE tax)" value={usd2(EX.se.line13)} />
            <div className="pt-1 border-t-2 border-gray-200 mt-1 mb-2"><MirrorRow label="11 — Adjusted Gross Income (AGI)" value={usd2(EX.agi)} bold /></div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-1 pt-2">Deductions</div>
            <MirrorRow label="12 — Standard deduction (single)" value={usd2(EX.standardDeduction)} />
            <MirrorRow label="14 — Total deductions" value={usd2(EX.standardDeduction)} />
            <div className="pt-1 border-t-2 border-gray-200 mt-1 mb-2"><MirrorRow label="15 — Taxable income" value={usd2(EX.taxable)} bold /></div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-1 pt-2">Tax computation</div>
            <MirrorRow label="16 — Tax (from brackets)" value={usd2(EX.federal)} />
            {/* Bracket table — mirrors :613-658 (headers + the one 10% row;
                bracket string shape per form-1040-service.ts:242-249). */}
            <div className="ml-6 my-1 border-l-2 border-blue-100 pl-3 py-1 text-xs text-gray-700">
              <div className="font-semibold text-gray-700 mb-1">Ordinary income brackets</div>
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-gray-500">
                    <th className="text-left font-medium pb-1">Bracket</th>
                    <th className="text-right font-medium pb-1">Rate</th>
                    <th className="text-right font-medium pb-1">In bracket</th>
                    <th className="text-right font-medium pb-1">Tax</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="py-0.5 font-mono">$0 – $11,600</td>
                    <td className="py-0.5 text-right font-mono">10.0%</td>
                    <td className="py-0.5 text-right font-mono">{usd2(EX.taxable)}</td>
                    <td className="py-0.5 text-right font-mono">{usd2(EX.federal)}</td>
                  </tr>
                  <tr className="border-t border-gray-200">
                    <td colSpan={3} className="py-1 text-right font-semibold">Ordinary tax</td>
                    <td className="py-1 text-right font-mono font-semibold">{usd2(EX.federal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <MirrorRow label="23 — Self-employment tax" value={usd2(EX.se.line12)} />
            <div className="pt-1 border-t-2 border-gray-200 mt-1 mb-2"><MirrorRow label="24 — Total tax" value={usd2(EX.totalTax)} bold /></div>
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-200 pb-1 pt-2">Payments and credits</div>
            <MirrorRow label="25a — Federal income tax withheld from W-2" value="$0.00" muted />
            <div className="pt-1 border-t border-gray-200 mt-1"><MirrorRow label="33 — Total payments" value="$0.00" bold /></div>
          </div>
          {/* Result banner — mirrors :790-824. */}
          <div className="px-6 py-5 border-t-2 bg-red-50 border-red-200">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-red-700">Estimated amount owed</div>
                <div className="text-xs mt-0.5 text-red-600">Total tax {usd2(EX.totalTax)} − Payments $0.00</div>
              </div>
              <div className="font-mono text-3xl font-bold text-red-700">{usd2(EX.owed)}</div>
            </div>
          </div>
        </div>
        {/* Draft PDF downloads — mirrors :827-858 (PDF_FORMS :111-119); the
            watermark string verbatim (tax-pdf-service.ts:70). */}
        <div className="border border-gray-200 rounded-lg bg-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-900">Draft PDF downloads</h3>
            <span className="font-mono text-[10px] font-bold tracking-widest text-amber-700">{DRAFT_WATERMARK}</span>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Every PDF is watermarked DRAFT — these are for review only, not for filing. The final
            export happens in the File step.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              ['All Forms', 'Combined PDF package'],
              ['Form 1040', 'Individual Income Tax Return'],
              ['Schedule 1', 'Additional Income & Adjustments'],
              ['Schedule C', 'Profit or Loss From Business'],
              ['Schedule D', 'Capital Gains and Losses'],
              ['Form 8949', 'Sales & Dispositions'],
            ].map(([label, description]) => (
              <button key={label} type="button" onClick={away} className="block text-left border border-gray-200 rounded px-3 py-2 hover:bg-gray-50 hover:border-blue-300">
                <div className="text-xs font-semibold text-gray-900">{label}</div>
                <div className="text-[10px] text-gray-500 mt-0.5">{description}</div>
                <div className="text-[10px] text-blue-600 mt-1">Download PDF →</div>
              </button>
            ))}
          </div>
        </div>
        {/* Confirmation — mirrors :860-890; interaction routes away. */}
        <div className="border-2 border-blue-200 bg-blue-50 rounded-lg p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" onMouseDown={block} onChange={away} className="mt-0.5 w-4 h-4 accent-blue-600" />
            <span className="text-sm text-gray-800">I have reviewed my 2025 return and the numbers are correct.</span>
          </label>
        </div>
        {/* Disclaimer — verbatim, where the real step renders it (:892). */}
        <p className="text-xs text-gray-400 italic">{DISCLAIMER}</p>
      </div>
    </StepCardMirror>
  );
}

// 7. FILE — mirror of FileStep (self-fetches calculate + documents on mount,
// :172-174): filing summary :353-423, export tools :425-580, the TaxAct
// walkthrough :582-834 (this scenario renders steps 1/2/3/6/7/11/12 — the
// W-2/1099-R/1098/estimated-payment steps are conditional and absent, so the
// real screen shows exactly these, gaps included), checklist :882-928,
// disclaimer :980.
// NOTE: the real screen's "Alternative filing paths" block (:836-880) is
// omitted — its fourth card advertises a not-live in-app path, which the
// banned-claims mandate keeps out of this showcase entirely.
function FileMirror({ away }: { away: () => void }) {
  const block = interceptTo(away);
  const taxActSteps: Array<[number, React.ReactNode]> = [
    [1, <>Go to taxact.com and create an account (or sign in).</>],
    [2, <>Select the <strong>Premier+</strong> tier — this is required for CSV import of trades.</>],
    [3, <>Enter your personal info: name, SSN, address, and filing status (single).</>],
    [6, <><strong>Import Form 8949:</strong> in TaxAct&rsquo;s Capital Gains section, click <em>Import</em> and upload the Form 8949 CSV you downloaded above. Total dispositions imported: 1 (1 short-term, 0 long-term).</>],
    [7, <>Enter Schedule C business data: <strong>{EX.business}</strong> — Line 1 {usd2(EX.grossReceipts)}, Line 9 {usd2(EX.expenses.carTruck)}, Line 20b {usd2(EX.expenses.rent)}, Line 22 {usd2(EX.expenses.supplies)}, Line 28 {usd2(EX.expenses.total)}, Line 31 {usd2(EX.netProfit)}. TaxAct will compute Schedule SE automatically from Schedule C net profit.</>],
    [11, <>Review TaxAct&rsquo;s computed return. TaxAct should compute approximately {usd2(EX.owed)} owed. If the number differs by more than <strong>$50</strong>, review each section for data-entry errors.</>],
    [12, <>E-file through TaxAct. You&rsquo;ll get confirmation emails from both TaxAct and the IRS (typically within 24-48 hours of submission).</>],
  ];
  return (
    <StepCardMirror n={7} label="File" description="Export and filing options" real={false} away={away} nextLabel="Finish">
      <div className="space-y-5">
        {/* Filing summary — mirrors :353-423. */}
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <div className="text-lg font-semibold text-gray-900">2025 Federal Tax Return</div>
            <div className="text-xs text-gray-500 mt-0.5">Filing status: <span className="capitalize">single</span></div>
          </div>
          <div className="px-5 py-4 bg-red-50 border-b border-red-200 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-red-700">Estimated amount owed</div>
              <div className="text-xs mt-0.5 text-red-600">Total tax {usd2(EX.totalTax)} − Payments $0.00</div>
            </div>
            <div className="font-mono text-3xl font-bold text-red-700">{usd2(EX.owed)}</div>
          </div>
          {/* Forms-included list — mirrors :243-284 logic for this return; the
              8949 count string shape is the component's own (:276). */}
          <div className="px-5 py-3">
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Forms included</h4>
            <ul className="space-y-1">
              {[
                ['Form 1040', 'Individual Income Tax Return'],
                ['Schedule 1', 'Additional Income and Adjustments'],
                ['Schedule 2', 'Additional Taxes (includes SE tax)'],
                ['Schedule C', 'Profit or Loss From Business'],
                ['Schedule SE', 'Self-Employment Tax'],
                ['Schedule D', 'Capital Gains and Losses'],
                ['Form 8949', 'Sales & Dispositions (1 entries)'],
              ].map(([name, description]) => (
                <li key={name} className="flex items-center gap-2 text-sm">
                  <span className="text-emerald-600">✓</span>
                  <span className="font-medium text-gray-900">{name}</span>
                  <span className="text-gray-500 text-xs">— {description}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* Export tools — mirrors :425-580 (copy strings verbatim). */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Export your data</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <div className="border border-gray-200 rounded-lg bg-white p-4 flex flex-col">
              <div className="text-sm font-semibold text-gray-900">Form 8949 CSV</div>
              <div className="text-[11px] text-gray-500 mt-0.5">For TaxAct Premier+ import.</div>
              <div className="mt-3 flex-1 text-[11px] text-gray-600">
                <div className="font-mono">1 transaction</div>
                <div className="text-gray-500 mt-1">1 short-term · 0 long-term</div>
              </div>
              <button type="button" onClick={away} className="mt-3 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700">Download CSV</button>
            </div>
            <div className="border border-gray-200 rounded-lg bg-white p-4 flex flex-col">
              <div className="text-sm font-semibold text-gray-900">Schedule C Export</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Business income + expense reference for TaxAct entry.</div>
              <div className="mt-3 flex-1 text-[11px] text-gray-600">
                <div className="font-mono">3 expense lines</div>
                <div className="text-gray-500 mt-1">Gross: {usd2(EX.grossReceipts)} · Net: {usd2(EX.netProfit)}</div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                <button type="button" onClick={away} className="px-2 py-1.5 text-[10px] font-semibold text-center text-blue-700 border border-blue-200 rounded hover:bg-blue-50">Line Summary</button>
                <button type="button" onClick={away} className="px-2 py-1.5 text-[10px] font-semibold text-center text-blue-700 border border-blue-200 rounded hover:bg-blue-50">Account Detail</button>
              </div>
            </div>
            <div className="border border-gray-200 rounded-lg bg-white p-4 flex flex-col">
              <div className="text-sm font-semibold text-gray-900">Tax Filing Summary</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Every number you need for TaxAct in one document.</div>
              <div className="mt-3 flex-1 text-[11px] text-gray-600">Schedule C lines, Schedule D totals, Form 1040 key lines, and warnings — all in plain text.</div>
              <button type="button" onClick={away} className="mt-3 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700">Download Summary</button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="border border-gray-200 rounded-lg bg-white p-4 flex flex-col">
              <div className="text-sm font-semibold text-gray-900">All Forms PDF</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Draft watermark — review and reference only.</div>
              <div className="mt-3 flex-1 text-[11px] text-gray-600">Combined package including 1040, Schedules, and Form 8949 as applicable. <span className="font-mono font-bold text-amber-700">{DRAFT_WATERMARK}</span></div>
              <button type="button" onClick={away} className="mt-3 px-3 py-2 text-xs font-semibold text-white bg-blue-600 rounded hover:bg-blue-700">Download PDF</button>
            </div>
            <div className="border border-gray-200 rounded-lg bg-white p-4 flex flex-col">
              <div className="text-sm font-semibold text-gray-900">CPA Export Package</div>
              <div className="text-[11px] text-gray-500 mt-0.5">Ledger-sourced, double-entry verified.</div>
              <div className="mt-3 flex-1 text-[11px] text-gray-600">Trial Balance, Income Statement, Balance Sheet, and General Ledger CSV files.</div>
              <div className="mt-3 grid grid-cols-2 gap-1.5">
                {['Trial Balance', 'Income Stmt', 'Balance Sheet', 'Gen Ledger'].map((label) => (
                  <button key={label} type="button" onClick={away} className="px-2 py-1.5 text-[10px] font-semibold text-center text-blue-700 border border-blue-200 rounded hover:bg-blue-50">{label}</button>
                ))}
              </div>
            </div>
          </div>
        </div>
        {/* TaxAct instructions — mirrors :582-834; steps 4/5/8/9/10 are
            conditional on documents this scenario doesn't have, so the real
            screen shows this exact numbered subset. */}
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
            <div className="text-sm font-semibold text-gray-900">How to file using TaxAct</div>
            <div className="text-xs text-gray-500">Primary recommended path · TaxAct Premier+ supports Form 8949 CSV import</div>
          </div>
          <ol className="divide-y divide-gray-100">
            {taxActSteps.map(([n, body]) => (
              <li key={n} className="px-4 py-3 flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-blue-600 text-white font-mono text-xs font-bold flex items-center justify-center">{n}</span>
                <div className="flex-1 text-sm text-gray-800">{body}</div>
              </li>
            ))}
          </ol>
        </div>
        {/* Pre-filing checklist — mirrors :882-928 (item strings verbatim,
            the ±$50 item bound to this return's number). */}
        <div className="border border-gray-200 rounded-lg bg-white p-4">
          <h3 className="text-sm font-semibold text-gray-900 mb-2">Before filing, verify</h3>
          <ul className="space-y-2">
            {[
              'All W-2 data entered correctly',
              '1099-R data matches your form',
              'Schedule C expenses match your bank statements',
              'Form 8949 trades match your broker 1099-B',
              `TaxAct's computed tax matches Temple Stuart's estimate (±$50 of ${usd2(EX.owed)})`,
            ].map((label) => (
              <li key={label}>
                <label className="flex items-start gap-2 cursor-pointer">
                  <input type="checkbox" onMouseDown={block} onChange={away} className="mt-0.5 w-4 h-4 accent-blue-600" />
                  <span className="text-sm text-gray-800">{label}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-gray-500">{NOT_A_PREPARER} The wizard prepares the numbers; you file through your CPA or filing software.</p>
        {/* Disclaimer — verbatim, where the real step renders it (:980). */}
        <p className="text-xs text-gray-400 italic">{DISCLAIMER}</p>
      </div>
    </StepCardMirror>
  );
}

export function LiveTaxSection({ currentUserId, onRequireAuth }: { currentUserId: string; onRequireAuth: () => void }) {
  const away = routeAway(currentUserId, onRequireAuth);
  return (
    <div className="space-y-4">
      <HandoffGateMirror away={away} />
      <WizardShellWithLiveStep away={away} />
      <DocumentsMirror away={away} />
      <IncomeMirror away={away} />
      <DeductionsMirror away={away} />
      <TradingMirror away={away} />
      <ReviewMirror away={away} />
      <FileMirror away={away} />
      <p className="text-xs text-text-muted">
        The blocks above are the handoff gate and the wizard&rsquo;s seven steps in their real order,
        on the declared 2025 example return (Schedule C net {usd2(EX.netProfit)} → total tax{' '}
        {usd2(EX.totalTax)}). The Life events step is the real component mounted live — the one step
        that fetches nothing; every other block is a faithful static mirror of the real screen,
        labeled on its face. Nothing on this page fetches; every action takes you to sign-up.{' '}
        {DISCLAIMER}
      </p>
    </div>
  );
}
