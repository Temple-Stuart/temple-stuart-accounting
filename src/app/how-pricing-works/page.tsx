'use client';

/**
 * PR-Pricing-Page — the cost-build pricing page. Every price starts as a real bill
 * (a data feed, a server, a service), gets traced to the module that uses it, and is
 * shown with the math. This page is the DECISION TOOL: it lays out the per-module
 * direct-feed ledgers, the shared platform infrastructure, and the TWO fair ways to
 * hand out that infrastructure (Method A allocate vs Method B base fee) so the call
 * can be made with the numbers in view.
 *
 * STATIC by design: every cost/allocated cell is a hand-entered placeholder
 * ($—, TBD, or a known-free $0). NOTHING here fetches or computes a real number —
 * wiring these to live Books data is a later phase, explicitly out of scope.
 */

import { useState } from 'react';
import Link from 'next/link';

// ── The four cost types + their token-based badge styles (no hex — brand tokens). ──
type CostType = 'COGS' | 'FIXED' | 'SHARED' | 'INFRA';

const TYPE_STYLES: Record<CostType, string> = {
  COGS: 'bg-brand-green/10 text-brand-green border-brand-green/30',
  FIXED: 'bg-brand-purple-wash text-brand-purple border-brand-purple/20',
  SHARED: 'bg-brand-amber/10 text-brand-amber border-brand-amber/30',
  INFRA: 'bg-bg-row text-text-muted border-border',
};

function TypeBadge({ type }: { type: CostType }) {
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${TYPE_STYLES[type]}`}>
      {type}
    </span>
  );
}

// A cost cell. Placeholders ($— / TBD) read as "not set yet" — muted + italic. A
// known-free feed ($0) reads as a plain muted value (it IS the real, known number).
function CostCell({ value }: { value: string }) {
  const notSet = value === '$—' || value === 'TBD';
  return (
    <span
      className={notSet ? 'italic text-text-faint' : 'text-text-muted'}
      title={notSet ? 'Not set yet' : undefined}
    >
      {value}
    </span>
  );
}

// ── Data (hand-entered, static). Split % and type are real; costs are placeholders. ──
interface Feed {
  name: string;
  type: CostType;
  split: string;
  monthly: string;
  allocated: string;
}

const LEDGERS: { key: string; title: string; feeds: Feed[] }[] = [
  {
    key: 'trade',
    title: 'Trade',
    feeds: [
      { name: 'TastyTrade', type: 'COGS', split: '100%', monthly: '$—', allocated: '$—' },
      { name: 'Finnhub', type: 'SHARED', split: '60%', monthly: '$—', allocated: '$—' },
      { name: 'FRED', type: 'FIXED', split: '100%', monthly: '$0', allocated: '$0' },
      { name: 'SEC EDGAR', type: 'FIXED', split: '100%', monthly: '$0', allocated: '$0' },
      { name: 'xAI Grok', type: 'SHARED', split: '50%', monthly: '$—', allocated: '$—' },
      { name: 'Anthropic Claude', type: 'SHARED', split: '25%', monthly: '$—', allocated: '$—' },
    ],
  },
  {
    key: 'operations',
    title: 'Operations',
    feeds: [
      { name: 'Anthropic Claude', type: 'SHARED', split: '50%', monthly: '$—', allocated: '$—' },
    ],
  },
  {
    key: 'books',
    title: 'Books',
    feeds: [
      { name: 'Plaid', type: 'COGS', split: '100%', monthly: '$—', allocated: '$—' },
    ],
  },
  {
    key: 'tax',
    title: 'Tax',
    feeds: [
      { name: 'IRS MeF transmitter', type: 'FIXED', split: '100%', monthly: 'TBD', allocated: 'TBD' },
    ],
  },
  {
    key: 'compliance',
    title: 'Compliance',
    feeds: [
      { name: 'eCFR corpus', type: 'FIXED', split: '100%', monthly: 'TBD', allocated: 'TBD' },
    ],
  },
];

const INFRA_FEEDS: { name: string; type: CostType; monthly: string }[] = [
  { name: 'Azure PostgreSQL', type: 'INFRA', monthly: '$—' },
  { name: 'Vercel Pro', type: 'INFRA', monthly: '$—' },
  { name: 'Domain', type: 'INFRA', monthly: '$—' },
  { name: 'GitHub', type: 'INFRA', monthly: '$—' },
  { name: 'Stripe', type: 'COGS', monthly: '$—' },
  { name: 'Anthropic Claude (base)', type: 'INFRA', monthly: '$—' },
];

const METHOD_A_ROWS: { module: string; split: string }[] = [
  { module: 'Trade', split: '30%' },
  { module: 'Operations', split: '25%' },
  { module: 'Books', split: '20%' },
  { module: 'Tax', split: '15%' },
  { module: 'Compliance', split: '10%' },
];

const METHOD_B_MODULES = ['Trade', 'Operations', 'Books', 'Tax', 'Compliance'];

// One paid module's direct-feed ledger (5 columns + a direct-cost footer). Scrolls
// sideways on a phone, sits flat on desktop.
function ModuleLedger({ title, feeds }: { title: string; feeds: Feed[] }) {
  return (
    <div className="rounded-lg border border-border bg-white overflow-hidden">
      <div className="bg-brand-purple/80 px-4 py-2.5 text-sm font-semibold text-white">{title}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-text-muted">
              <th className="px-4 py-2 font-medium">Feed</th>
              <th className="px-4 py-2 font-medium">Type</th>
              <th className="px-4 py-2 font-medium">Split %</th>
              <th className="px-4 py-2 font-medium text-right">Monthly cost</th>
              <th className="px-4 py-2 font-medium text-right">Allocated here</th>
            </tr>
          </thead>
          <tbody>
            {feeds.map((f) => (
              <tr key={f.name} className="border-b border-border-light last:border-0">
                <td className="px-4 py-2.5 font-medium text-text-primary">{f.name}</td>
                <td className="px-4 py-2.5"><TypeBadge type={f.type} /></td>
                <td className="px-4 py-2.5 text-text-secondary">{f.split}</td>
                <td className="px-4 py-2.5 text-right"><CostCell value={f.monthly} /></td>
                <td className="px-4 py-2.5 text-right"><CostCell value={f.allocated} /></td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-bg-row">
              <td className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted" colSpan={4}>
                Direct feed cost
              </td>
              <td className="px-4 py-2.5 text-right font-semibold"><CostCell value="$—" /></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

export default function HowPricingWorksPage() {
  // The infrastructure question has two fair answers; this toggle highlights the one
  // being weighed. BOTH methods always render below — the toggle only emphasizes,
  // it never hides a method (this page exists to compare them).
  const [method, setMethod] = useState<'A' | 'B'>('A');

  return (
    <div className="min-h-screen bg-bg-terminal">
      {/* Top bar — mirrors the landing header so the page feels part of the site. */}
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
            <Link href="/" className="text-xs text-text-faint hover:text-white">
              ← Back to home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 lg:px-8 py-12 space-y-12">
        {/* 1 · HERO */}
        <section>
          <h1 className="text-3xl lg:text-4xl font-light tracking-tight text-text-primary">
            Every price, built from real cost.
            <br />
            <span className="text-brand-purple font-normal">Traced, allocated, and shown.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-text-secondary leading-relaxed">
            We don&apos;t pick a number and hope it feels fair. Every price here starts as a real bill
            we pay — a data feed, a server, a service — then we trace it to the module that uses it and
            show you the math. No markup hidden in the middle.
          </p>
        </section>

        {/* 2 · HOW TO READ THIS — teaching box */}
        <section className="rounded-lg border border-brand-purple/20 bg-brand-purple-wash p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-purple">How to read this</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <div>
              <p className="text-sm font-semibold text-text-primary">Direct</p>
              <p className="mt-1 text-sm text-text-secondary">A cost only one module uses. It belongs to that module, full stop.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Shared</p>
              <p className="mt-1 text-sm text-text-secondary">A cost more than one module uses. We split it by how much each one leans on it — the split %.</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-text-primary">Infrastructure</p>
              <p className="mt-1 text-sm text-text-secondary">The cost of keeping the whole platform on — servers, domain, payments. Every module rides on it.</p>
            </div>
          </div>
        </section>

        {/* 3 · LEGEND */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Legend</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              { type: 'COGS' as CostType, note: 'Cost of goods sold — scales with use. The more you do, the more it costs.' },
              { type: 'FIXED' as CostType, note: 'A flat cost that does not move with use.' },
              { type: 'SHARED' as CostType, note: 'Split across the modules that use it, by the split %.' },
              { type: 'INFRA' as CostType, note: 'Platform overhead — keeps the lights on for everything.' },
            ]).map(({ type, note }) => (
              <div key={type} className="rounded-lg border border-border bg-white p-3">
                <TypeBadge type={type} />
                <p className="mt-2 text-xs text-text-secondary">{note}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 4 · FREE MODULES */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Free modules</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-white p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-base font-semibold text-text-primary">Calendar</span>
                <span className="text-lg font-semibold text-brand-green">$0</span>
              </div>
              <p className="mt-2 text-sm text-text-secondary">Free with an account. Your whole life on one honest timeline.</p>
            </div>
            <div className="rounded-lg border border-border bg-white p-5">
              <div className="flex items-baseline justify-between">
                <span className="text-base font-semibold text-text-primary">Travel</span>
                <span className="text-lg font-semibold text-brand-green">$0</span>
              </div>
              <p className="mt-2 text-sm text-text-secondary">Free to search and plan. No account needed to look — make one only to save a trip.</p>
            </div>
          </div>
        </section>

        {/* 5 · PAID MODULES — direct-feed ledgers, in tab order */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Paid modules — direct feeds</h2>
          <p className="mt-1 text-sm text-text-secondary">Each paid module carries the data feeds it uses directly. Shared feeds show the split % of the bill that lands here.</p>
          <div className="mt-4 space-y-5">
            {LEDGERS.map((l) => (
              <ModuleLedger key={l.key} title={l.title} feeds={l.feeds} />
            ))}
          </div>
        </section>

        {/* 6 · INFRASTRUCTURE card */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-text-muted">Infrastructure</h2>
          <p className="mt-1 text-sm text-text-secondary">The platform overhead every module rides on. One bill, shared by all.</p>
          <div className="mt-4 rounded-lg border border-border bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[480px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-text-muted">
                    <th className="px-4 py-2 font-medium">Service</th>
                    <th className="px-4 py-2 font-medium">Type</th>
                    <th className="px-4 py-2 font-medium text-right">Monthly cost</th>
                  </tr>
                </thead>
                <tbody>
                  {INFRA_FEEDS.map((f) => (
                    <tr key={f.name} className="border-b border-border-light last:border-0">
                      <td className="px-4 py-2.5 font-medium text-text-primary">{f.name}</td>
                      <td className="px-4 py-2.5"><TypeBadge type={f.type} /></td>
                      <td className="px-4 py-2.5 text-right"><CostCell value={f.monthly} /></td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-bg-row">
                    <td className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted" colSpan={2}>
                      Total platform overhead
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold"><CostCell value="$—" /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </section>

        {/* 7 · TWO METHODS — pick one (both render) */}
        <section>
          <h2 className="text-xl font-light tracking-tight text-text-primary">Two fair ways to handle infrastructure — pick one</h2>
          <p className="mt-1 text-sm text-text-secondary">Same overhead, two ways to share it. Here&apos;s both, side by side, so the choice is yours.</p>

          {/* Toggle — highlights the method being weighed. Both cards stay rendered below. */}
          <div className="mt-4 inline-flex rounded-lg border border-border bg-white p-1">
            <button
              type="button"
              onClick={() => setMethod('A')}
              aria-pressed={method === 'A'}
              className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${method === 'A' ? 'bg-brand-purple text-white' : 'text-text-muted hover:text-text-primary'}`}
            >
              Method A — Allocate
            </button>
            <button
              type="button"
              onClick={() => setMethod('B')}
              aria-pressed={method === 'B'}
              className={`rounded px-4 py-1.5 text-sm font-medium transition-colors ${method === 'B' ? 'bg-brand-purple text-white' : 'text-text-muted hover:text-text-primary'}`}
            >
              Method B — Base fee
            </button>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-2">
            {/* Method A — Allocate */}
            <div className={`rounded-lg border bg-white p-5 transition-colors ${method === 'A' ? 'border-brand-purple ring-1 ring-brand-purple/30' : 'border-border opacity-80'}`}>
              <h3 className="text-base font-semibold text-text-primary">Method A — Allocate</h3>
              <p className="mt-1 text-sm text-text-secondary">Spread the overhead across the paid modules by a fixed split, then add each module&apos;s own direct feeds.</p>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-text-muted">
                      <th className="px-3 py-2 font-medium">Module</th>
                      <th className="px-3 py-2 font-medium">Infra split %</th>
                      <th className="px-3 py-2 font-medium text-right">Infra share</th>
                      <th className="px-3 py-2 font-medium text-right">+ Direct feeds</th>
                      <th className="px-3 py-2 font-medium text-right">= Module cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {METHOD_A_ROWS.map((r) => (
                      <tr key={r.module} className="border-b border-border-light last:border-0">
                        <td className="px-3 py-2.5 font-medium text-text-primary">{r.module}</td>
                        <td className="px-3 py-2.5 text-text-secondary">{r.split}</td>
                        <td className="px-3 py-2.5 text-right"><CostCell value="$—" /></td>
                        <td className="px-3 py-2.5 text-right"><CostCell value="$—" /></td>
                        <td className="px-3 py-2.5 text-right"><CostCell value="$—" /></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-bg-row">
                      <td className="px-3 py-2.5 font-semibold text-text-primary">Total</td>
                      <td className="px-3 py-2.5 font-semibold text-text-secondary">100%</td>
                      <td className="px-3 py-2.5 text-right font-semibold"><CostCell value="$—" /></td>
                      <td className="px-3 py-2.5 text-right font-semibold"><CostCell value="$—" /></td>
                      <td className="px-3 py-2.5 text-right font-semibold"><CostCell value="$—" /></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="mt-3 text-xs text-text-secondary">
                <span className="font-semibold text-text-primary">Fairness:</span> heavier modules carry more of the
                overhead. You only pay overhead for the modules you actually turn on.
              </p>
            </div>

            {/* Method B — Base fee */}
            <div className={`rounded-lg border bg-white p-5 transition-colors ${method === 'B' ? 'border-brand-purple ring-1 ring-brand-purple/30' : 'border-border opacity-80'}`}>
              <h3 className="text-base font-semibold text-text-primary">Method B — Base fee</h3>
              <p className="mt-1 text-sm text-text-secondary">One flat platform fee covers the overhead. Each module you add is priced on its own direct feeds.</p>
              <div className="mt-4 space-y-3">
                <div className="flex items-baseline justify-between rounded-lg border border-border bg-bg-row px-4 py-3">
                  <span className="text-sm font-semibold text-text-primary">Base platform fee</span>
                  <span className="text-base font-semibold"><CostCell value="$—" /></span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[320px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-text-muted">
                        <th className="px-3 py-2 font-medium">Module</th>
                        <th className="px-3 py-2 font-medium text-right">Per-module</th>
                      </tr>
                    </thead>
                    <tbody>
                      {METHOD_B_MODULES.map((m) => (
                        <tr key={m} className="border-b border-border-light last:border-0">
                          <td className="px-3 py-2.5 font-medium text-text-primary">{m}</td>
                          <td className="px-3 py-2.5 text-right"><CostCell value="$—" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="rounded-lg border border-brand-purple/20 bg-brand-purple-wash px-4 py-3 text-sm font-medium text-brand-purple">
                  Your bill = base + modules
                </p>
              </div>
              <p className="mt-3 text-xs text-text-secondary">
                <span className="font-semibold text-text-primary">Fairness:</span> dead simple to read — one base, plus
                what you switch on. Everyone shares the overhead evenly through the base fee.
              </p>
            </div>
          </div>
        </section>

        {/* 8 · À LA CARTE NOTE + FOOTNOTE */}
        <section className="border-t border-border pt-8">
          <p className="text-sm text-text-secondary">
            <span className="font-semibold text-text-primary">À la carte:</span> pick only the modules you want. You
            never pay for a module you don&apos;t switch on, under either method.
          </p>
          <p className="mt-4 text-xs italic text-text-faint">
            All costs shown are placeholders while we finish tracing the real numbers. Nothing on this page is a live
            bill yet — the $— and TBD cells are not set.
          </p>
        </section>
      </main>
    </div>
  );
}
