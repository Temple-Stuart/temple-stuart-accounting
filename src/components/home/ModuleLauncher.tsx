'use client';

// HOME-PR-4: the home module launcher = SIX forced-login per-module explainer
// SectionCards (Travel, Trading, Bookkeeping, Tax, Operations, Compliance). Each =
// band (module name + price tag) + body (1-2 sentence explanation + 3 feature
// bullets + a "Log in to launch <Module>" CTA → the existing register/login modal).
// ALL modules are forced-login now — no live form on home (the CreateTripForm /
// ScanFilterForm usage was removed; those components remain on /budgets/trips and
// /trading). Alternating section treatment so the six read as distinct stacked
// modules; one purple band per card (the design rule).

// Editable price map — ALEX sets real prices here. Placeholders for now; do NOT
// invent dollar amounts.
const PRICES: Record<string, string> = {
  travel: 'Pricing TBD',
  trading: 'Pricing TBD',
  bookkeeping: 'Pricing TBD',
  tax: 'Pricing TBD',
  operations: 'Pricing TBD',
  compliance: 'Pricing TBD',
};

interface ModuleDef {
  key: string;
  label: string;
  /** 1-2 sentence explanation (verbatim copy). */
  blurb: string;
  /** Three feature bullets (verbatim copy). */
  features: [string, string, string];
}

// Order: Travel, Trading, Bookkeeping, Tax, Operations, Compliance.
const MODULES: ModuleDef[] = [
  {
    key: 'travel',
    label: 'Travel',
    blurb: 'Plan trips with AI itineraries, real flight + hotel quotes, and automatic crew expense splitting — every booking flows into a budgeted trip ledger.',
    features: ['AI itinerary per category', 'Real flight + hotel quotes', 'Crew splits + settlement matrix'],
  },
  {
    key: 'trading',
    label: 'Trading',
    blurb: 'Institutional options scanner — filters the universe through liquidity, risk, and edge gates with an N(d2) breakeven, three-outcome EV model, and live sentiment.',
    features: ['Institutional pre-filter + 3-tier filter panel', 'Trade Lab: queue, link, grade trades', 'Wash-sale detection + tax compliance'],
  },
  {
    key: 'bookkeeping',
    label: 'Bookkeeping',
    blurb: 'GAAP accounting engine — Plaid-synced transactions map to your Chart of Accounts and commit to the general ledger, with real-time trial balance and period close.',
    features: ['Trial balance, balance sheet + income statement', 'Period close + year-end close to Retained Earnings', 'Bank reconciliation with immutable audit trail'],
  },
  {
    key: 'tax',
    label: 'Tax',
    blurb: 'Tax engine — entity-aware federal forms generated from your bookkeeping ledger.',
    features: ['Form 1040 + Schedule C/D/SE', 'Form 8949 capital gains', 'Estimates from real ledger data'],
  },
  {
    key: 'operations',
    label: 'Operations',
    blurb: 'Your command center — projects, routines, a daily plan, and content, aligned to your North Star.',
    features: ['Projects + routines + daily plan', 'North Star vision alignment', 'Content + compliance workflows'],
  },
  {
    key: 'compliance',
    label: 'Compliance',
    blurb: 'SOC 2-grade controls — change management, access control, and an immutable audit trail across the platform.',
    features: ['Change-management controls', 'User-scoped access control', 'Immutable audit trail'],
  },
];

interface Props {
  /** Opens the existing register/login modal on the home page (the section CTAs). */
  onRequireAuth: () => void;
}

export default function ModuleLauncher({ onRequireAuth }: Props) {
  return (
    <section className="py-10 bg-bg-terminal">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 space-y-4">
        {MODULES.map((m, i) => {
          // Alternating body treatment so the stacked modules read as distinct.
          const altBody = i % 2 === 1;
          return (
            <div key={m.key} className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
              {/* One purple band per card: module name + price tag. */}
              <div className="bg-brand-purple/80 text-white px-4 py-2.5 flex items-center justify-between">
                <span className="text-sm font-semibold">{m.label}</span>
                <span className="text-[11px] font-medium bg-white/15 rounded px-2 py-0.5">{PRICES[m.key]}</span>
              </div>
              <div className={`p-5 ${altBody ? 'bg-bg-row' : 'bg-white'}`}>
                <p className="text-sm text-text-primary leading-relaxed max-w-3xl mb-3">{m.blurb}</p>
                <ul className="space-y-1 mb-4">
                  {m.features.map(feat => (
                    <li key={feat} className="flex items-start gap-2 text-xs text-text-secondary">
                      <span className="text-brand-purple mt-0.5">•</span>
                      <span>{feat}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="px-6 py-2 bg-brand-gold hover:bg-brand-gold-bright text-white font-semibold text-sm rounded"
                >
                  Log in to launch {m.label}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
