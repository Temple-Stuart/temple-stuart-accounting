'use client';

export interface BookkeepingCockpitBarProps {
  // Accounting equation
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  isBalanced: boolean;
  // Pipeline health
  uncategorized: number;
  uncommitted: number;
  unreconciled: number;
  trialBalanceStatus: 'balanced' | 'unbalanced' | 'unknown';
  // Status
  connectedAccounts: number;
  periodLabel: string;
  periodStatus: 'open' | 'closed';
  // Actions
  onSync: () => void;
  syncing: boolean;
  onLinkAccount: () => void;
}

const fmtDollars = (cents: number) =>
  '$' + (Math.abs(cents) / 100).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

export default function BookkeepingCockpitBar({
  totalAssets,
  totalLiabilities,
  totalEquity,
  isBalanced,
  uncategorized,
  uncommitted,
  unreconciled,
  trialBalanceStatus,
  connectedAccounts,
  periodLabel,
  periodStatus,
  onSync,
  syncing,
  onLinkAccount,
}: BookkeepingCockpitBarProps) {
  const imbalance = totalAssets - (totalLiabilities + totalEquity);

  return (
    <div className="space-y-2">
      {/* ROW 1 — Main bar (matches Travel bar: white, gold border, rounded-xl, shadow-md) */}
      <div className="bg-white border-2 border-brand-gold/60 rounded-xl shadow-md flex flex-col lg:flex-row">
        {/* LEFT: Identity */}
        <div className="flex items-center gap-2 px-4 py-3 lg:w-[160px] lg:flex-shrink-0 lg:border-r border-b lg:border-b-0 border-gray-200">
          <div>
            <div className="text-sm font-semibold text-text-primary">Bookkeeping</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {connectedAccounts > 0 ? (
                <><div className="w-2 h-2 bg-emerald-500 rounded-full" /><span className="text-xs text-emerald-600">{connectedAccounts} linked</span></>
              ) : (
                <><div className="w-2 h-2 bg-gray-400 rounded-full" /><span className="text-xs text-text-muted">No accounts</span></>
              )}
            </div>
          </div>
        </div>

        {/* CENTER: Accounting Equation */}
        <div className="flex-1 px-4 py-3 lg:border-r border-b lg:border-b-0 border-gray-200 min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-xs">
            <span>
              <span className="text-text-muted uppercase tracking-wider text-[10px] mr-1">Assets</span>
              <span className="font-mono font-semibold text-text-primary">{fmtDollars(totalAssets)}</span>
            </span>
            <span className="text-text-faint">|</span>
            <span>
              <span className="text-text-muted uppercase tracking-wider text-[10px] mr-1">Liabilities</span>
              <span className="font-mono font-semibold text-text-primary">{fmtDollars(totalLiabilities)}</span>
            </span>
            <span className="text-text-faint">|</span>
            <span>
              <span className="text-text-muted uppercase tracking-wider text-[10px] mr-1">Equity</span>
              <span className="font-mono font-semibold text-text-primary">{fmtDollars(totalEquity)}</span>
            </span>
          </div>
          <div className="mt-1">
            {isBalanced ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                A = L + E {'\u2713'} Balanced
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                {'\u2717'} Unbalanced by {fmtDollars(Math.abs(imbalance))}
              </span>
            )}
          </div>
        </div>

        {/* RIGHT: Period + Actions */}
        <div className="flex items-center gap-3 px-4 py-3 lg:border-r border-b lg:border-b-0 border-gray-200 lg:flex-shrink-0">
          <div className="text-xs text-text-secondary">
            <span className="font-medium">{periodLabel}</span>
            <span className="mx-1">{'\u00b7'}</span>
            <span className={periodStatus === 'open' ? 'text-emerald-600 font-medium' : 'text-text-muted'}>
              {periodStatus === 'open' ? 'Open' : 'Closed'}
            </span>
          </div>
          <button
            onClick={onLinkAccount}
            className="px-3 py-2 border border-brand-gold text-brand-gold hover:bg-brand-gold/5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            + Link Account
          </button>
        </div>

        {/* FAR RIGHT: Gold Sync button (matches Travel bar's gold CTA) */}
        <button
          onClick={onSync}
          disabled={syncing}
          className="flex items-center justify-center gap-2 px-6 py-3 bg-brand-gold hover:bg-brand-gold-bright text-white font-semibold text-sm transition-colors whitespace-nowrap rounded-b-xl lg:rounded-b-none lg:rounded-r-xl disabled:opacity-50"
        >
          {syncing ? (
            <>
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Syncing
            </>
          ) : 'Sync'}
        </button>
      </div>

      {/* ROW 2 — Pipeline health strip */}
      <div className="rounded-lg bg-brand-purple/5 border border-brand-purple/10 px-4 py-1.5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
          <span className={uncategorized > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600'}>
            {uncategorized.toLocaleString()} uncategorized
          </span>
          <span className="text-text-faint">{'\u00b7'}</span>
          <span className={uncommitted > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600'}>
            {uncommitted.toLocaleString()} uncommitted
          </span>
          <span className="text-text-faint">{'\u00b7'}</span>
          <span className={unreconciled > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600'}>
            {unreconciled.toLocaleString()} unreconciled
          </span>
          <span className="text-text-faint">{'\u00b7'}</span>
          <span className={
            trialBalanceStatus === 'balanced' ? 'text-emerald-600'
            : trialBalanceStatus === 'unbalanced' ? 'text-red-600 font-medium'
            : 'text-text-muted'
          }>
            TB {trialBalanceStatus === 'balanced' ? 'Balanced' : trialBalanceStatus === 'unbalanced' ? 'Unbalanced' : '\u2014'}
          </span>
        </div>
      </div>
    </div>
  );
}
