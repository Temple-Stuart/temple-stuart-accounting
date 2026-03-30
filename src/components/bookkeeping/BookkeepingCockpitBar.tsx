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
}: BookkeepingCockpitBarProps) {
  const imbalance = totalAssets - (totalLiabilities + totalEquity);

  return (
    <div className="space-y-2">
      {/* ROW 1 — Main bar (trips aesthetic) */}
      <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm bg-white">
        <div className="px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
          {/* LEFT: Identity */}
          <div className="lg:w-[160px] lg:flex-shrink-0 lg:border-r lg:border-gray-200 lg:pr-4">
            <div className="text-sm font-bold text-text-primary">Bookkeeping</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              {connectedAccounts > 0 ? (
                <><div className="w-2 h-2 bg-emerald-500 rounded-full" /><span className="text-xs text-emerald-600">{connectedAccounts} linked</span></>
              ) : (
                <><div className="w-2 h-2 bg-gray-400 rounded-full" /><span className="text-xs text-text-muted">No accounts</span></>
              )}
            </div>
          </div>

          {/* CENTER: Accounting Equation */}
          <div className="flex-1 min-w-0">
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

          {/* RIGHT: Period + Sync */}
          <div className="flex items-center gap-3 lg:flex-shrink-0">
            <div className="text-xs text-text-secondary">
              <span className="font-medium">{periodLabel}</span>
              <span className="mx-1">{'\u00b7'}</span>
              <span className={periodStatus === 'open' ? 'text-emerald-600 font-medium' : 'text-text-muted'}>
                {periodStatus === 'open' ? 'Open' : 'Closed'}
              </span>
            </div>
            <button
              onClick={onSync}
              disabled={syncing}
              className="px-4 py-2 bg-brand-gold hover:bg-brand-gold-bright text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
            >
              {syncing ? (
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Syncing
                </span>
              ) : 'Sync'}
            </button>
          </div>
        </div>
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
