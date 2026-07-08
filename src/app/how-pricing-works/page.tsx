/**
 * PRICING-PAGE — /how-pricing-works, rebuilt on the merged PRICING-AUDIT.
 *
 * Every module below shows the REAL external APIs it fires — the dependency map
 * comes verbatim from audit-reports/PRICING-AUDIT.md (each dependency cited
 * file:line there). Costs and prices render from src/config/pricing-costs.ts,
 * which Alex edits from real invoices. An unfilled cost is an EXPLICIT
 * "— not yet entered" state — never $0, never a fabricated placeholder.
 * The only seeded number is Finnhub $550/mo (known true). TastyTrade is $0
 * because users connect their own account (Alex ruling, 2026-07-08).
 */

import Link from 'next/link';
import {
  API_COSTS,
  INFRA_COSTS,
  PRODUCTS,
  NOT_CONNECTED,
  type ApiCostEntry,
  type CostType,
} from '@/config/pricing-costs';

// ── badges ──────────────────────────────────────────────────────────────────
const TYPE_STYLES: Record<CostType, string> = {
  FIXED: 'bg-brand-purple-wash text-brand-purple border-brand-purple/20',
  PER_USE: 'bg-brand-amber/10 text-brand-amber border-brand-amber/30',
  COMMISSION: 'bg-brand-green/10 text-brand-green border-brand-green/30',
  FREE: 'bg-bg-row text-text-muted border-border',
  UNKNOWN: 'bg-bg-row text-text-faint border-border',
};

const TYPE_LABELS: Record<CostType, string> = {
  FIXED: 'FIXED',
  PER_USE: 'PER-USE',
  COMMISSION: 'COMMISSION',
  FREE: 'FREE',
  UNKNOWN: 'UNKNOWN',
};

function TypeBadge({ type }: { type: CostType }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TYPE_STYLES[type]}`}>
      {TYPE_LABELS[type]}
    </span>
  );
}

// ── money + allocation math (pure display arithmetic on entered values) ─────
function fmtUsd(v: number): string {
  return Number.isInteger(v) ? `$${v.toLocaleString()}` : `$${v.toFixed(2)}`;
}

/** Equal split across every module/sharer that fires the API (audit §2). */
function allocatedShare(e: ApiCostEntry): number | null {
  return e.monthlyCost === null ? null : e.monthlyCost / e.modules.length;
}

// A cost cell: null = deliberately empty (not yet entered from an invoice).
function CostCell({ amount, suffix = '/mo' }: { amount: number | null; suffix?: string }) {
  if (amount === null) {
    return <span className="italic text-text-faint" title="Deliberately empty — fills from a real invoice, never estimated">— not yet entered</span>;
  }
  return <span className="text-text-primary">{fmtUsd(amount)}{amount === 0 ? '' : suffix}</span>;
}

const byId = new Map(API_COSTS.map((e) => [e.id, e]));
const PRODUCT_COUNT = PRODUCTS.length;

// per-product infra share: each FIXED/entered infra bill split equally across all products
const infraEntered = INFRA_COSTS.filter((e) => e.monthlyCost !== null);
const infraShareTotal = infraEntered.reduce((s, e) => s + (e.monthlyCost as number), 0) / PRODUCT_COUNT;
const infraAllEntered = infraEntered.length === INFRA_COSTS.length;

export default function HowPricingWorksPage() {
  return (
    <div className="min-h-screen bg-bg-terminal">
      <header className="bg-brand-purple text-white">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white flex items-center justify-center">
                <span className="text-brand-purple font-bold text-terminal-lg">TS</span>
              </div>
              <div>
                <div className="text-sm font-semibold tracking-tight">Temple Stuart</div>
                <div className="text-[10px] text-text-faint">Personal Back Office</div>
              </div>
            </Link>
            <Link href="/" className="text-xs text-text-faint hover:text-white">← Back to home</Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 lg:px-8 py-12 space-y-10">
        {/* HERO */}
        <section>
          <h1 className="text-3xl lg:text-4xl font-light tracking-tight text-text-primary">
            Every price, traced to a real bill.
          </h1>
          <p className="mt-4 max-w-2xl text-text-secondary leading-relaxed">
            Each module below lists the exact external services it uses — taken from a code audit of
            what actually fires, not a marketing list. Costs are entered from real invoices; a cell that
            hasn&apos;t been filled yet says so instead of showing a made-up number.
          </p>
        </section>

        {/* HOW TO READ */}
        <section className="rounded-lg border border-brand-purple/20 bg-brand-purple-wash p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-purple">How to read this</h2>
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-secondary">
            <span><TypeBadge type="FIXED" /> billed flat, use it or not</span>
            <span><TypeBadge type="PER_USE" /> billed per call / token / booking / item</span>
            <span><TypeBadge type="COMMISSION" /> vendor takes a cut of bookings — not a bill we pay</span>
            <span><TypeBadge type="FREE" /> costs nothing, verified</span>
            <span><TypeBadge type="UNKNOWN" /> billing model unconfirmed — filled from the invoice</span>
          </div>
          <p className="mt-3 text-sm text-text-secondary">
            A service used by more than one module is <span className="font-semibold text-text-primary">shared</span> —
            its bill is split equally across the modules that fire it, and the split is shown.
          </p>
        </section>

        {/* PRODUCTS */}
        <section className="space-y-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">The modules — real dependencies, real math</h2>

          {PRODUCTS.map((p) => {
            const deps = p.deps.map((id) => byId.get(id)).filter((e): e is ApiCostEntry => e != null);
            const shares = deps.map(allocatedShare);
            const enteredShares = shares.filter((s): s is number => s !== null);
            const apiBasis = enteredShares.reduce((s, v) => s + v, 0);
            const allEntered = deps.length === enteredShares.length;
            const basisComplete = allEntered && infraAllEntered;
            const totalBasis = apiBasis + infraShareTotal;

            return (
              <div key={p.id} className="rounded-lg border border-border bg-white overflow-hidden">
                <div className="bg-brand-purple/80 px-4 py-2.5 flex items-baseline justify-between gap-3">
                  <span className="text-sm font-semibold text-white">{p.name}</span>
                  <span className="text-[11px] text-white/80">{p.what}</span>
                </div>

                {deps.length === 0 ? (
                  <div className="px-4 py-4">
                    <p className="text-sm font-medium text-brand-green">
                      Zero external API cost — infrastructure only.
                    </p>
                    <p className="mt-1 text-xs text-text-secondary">
                      Verified in the audit: this module runs entirely on our own database and code. Its only
                      cost is the shared platform infrastructure below.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-text-muted">
                          <th className="px-4 py-2 font-medium">Service</th>
                          <th className="px-4 py-2 font-medium">What it&apos;s for</th>
                          <th className="px-4 py-2 font-medium">Type</th>
                          <th className="px-4 py-2 font-medium">Split</th>
                          <th className="px-4 py-2 font-medium text-right">Monthly bill</th>
                          <th className="px-4 py-2 font-medium text-right">This module&apos;s share</th>
                        </tr>
                      </thead>
                      <tbody>
                        {deps.map((e) => (
                          <tr key={e.id} className="border-b border-border-light last:border-0">
                            <td className="px-4 py-2.5 font-medium text-text-primary whitespace-nowrap">{e.name}</td>
                            <td className="px-4 py-2.5 text-xs text-text-secondary" title={e.note ?? undefined}>
                              {e.usedFor}
                              {e.note ? <span className="block text-[10px] text-text-faint mt-0.5">{e.note}</span> : null}
                            </td>
                            <td className="px-4 py-2.5"><TypeBadge type={e.costType} /></td>
                            <td className="px-4 py-2.5 text-xs text-text-secondary whitespace-nowrap" title={e.modules.join(', ')}>
                              {e.modules.length > 1 ? `shared ÷ ${e.modules.length}` : 'dedicated'}
                            </td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap"><CostCell amount={e.monthlyCost} /></td>
                            <td className="px-4 py-2.5 text-right whitespace-nowrap"><CostCell amount={allocatedShare(e)} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* cost-basis + price summary — honest about incompleteness */}
                <div className="border-t border-border bg-bg-row px-4 py-3 grid gap-1.5 sm:grid-cols-3 text-sm">
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-text-muted">API cost basis (entered so far)</span>
                    <span className="font-semibold text-text-primary">{fmtUsd(apiBasis)}/mo</span>
                    <span className={`ml-2 text-[10px] ${allEntered ? 'text-brand-green' : 'text-brand-amber'}`}>
                      {enteredShares.length}/{deps.length} costs entered{allEntered ? '' : ' — basis incomplete'}
                    </span>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-text-muted">+ infra share (÷ {PRODUCT_COUNT} modules)</span>
                    {infraAllEntered
                      ? <span className="font-semibold text-text-primary">{fmtUsd(infraShareTotal)}/mo</span>
                      : <span className="italic text-text-faint">— infra bills not fully entered ({infraEntered.length}/{INFRA_COSTS.length})</span>}
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase tracking-wider text-text-muted">Price vs basis</span>
                    {p.monthlyPrice === null
                      ? <span className="italic text-text-faint">price not yet set</span>
                      : <span className="font-semibold text-text-primary">{fmtUsd(p.monthlyPrice)}/mo</span>}
                    {p.monthlyPrice !== null && basisComplete ? (
                      <span className={`ml-2 text-[10px] ${p.monthlyPrice - totalBasis >= 0 ? 'text-brand-green' : 'text-brand-red'}`}>
                        margin {fmtUsd(p.monthlyPrice - totalBasis)}/mo
                      </span>
                    ) : (
                      <span className="ml-2 text-[10px] text-text-faint">margin not computable until costs + price are entered</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        {/* INFRASTRUCTURE */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Infrastructure — shared by every module</h2>
          <p className="mt-1 text-sm text-text-secondary">
            One set of platform bills, split equally across all {PRODUCT_COUNT} modules above (the &quot;infra share&quot; line in each card).
          </p>
          <div className="mt-4 rounded-lg border border-border bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-text-muted">
                    <th className="px-4 py-2 font-medium">Service</th>
                    <th className="px-4 py-2 font-medium">What it&apos;s for</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium text-right">Monthly bill</th>
                  </tr>
                </thead>
                <tbody>
                  {INFRA_COSTS.map((e) => (
                    <tr key={e.id} className="border-b border-border-light last:border-0">
                      <td className="px-4 py-2.5 font-medium text-text-primary whitespace-nowrap">{e.name}</td>
                      <td className="px-4 py-2.5 text-xs text-text-secondary">
                        {e.usedFor}
                        {e.note ? <span className="block text-[10px] text-text-faint mt-0.5">{e.note}</span> : null}
                      </td>
                      <td className="px-4 py-2.5"><TypeBadge type={e.costType} /></td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap"><CostCell amount={e.monthlyCost} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* PROVENANCE + NOT CONNECTED */}
        <section className="border-t border-border pt-8 space-y-3">
          <p className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">Where this comes from:</span> the dependency map is a
            line-by-line code audit of which services each module actually calls
            (<span className="font-mono text-xs">audit-reports/PRICING-AUDIT.md</span> in the repo). Nothing is listed
            that the code doesn&apos;t fire; nothing the code fires is left out.
          </p>
          <p className="text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">Named but not connected (zero cost):</span>{' '}
            {NOT_CONNECTED.join(' · ')}
          </p>
          <p className="text-xs italic text-text-faint">
            Empty cells are deliberate: they fill from real invoices as they&apos;re entered — never from estimates.
          </p>
        </section>
      </main>
    </div>
  );
}
