'use client';

export interface BookkeepingCockpitBarProps {
  connectedAccounts: number;
  uncategorized: number;
  uncommitted: number;
  journalEntryCount: number;
  trialBalanceStatus: 'balanced' | 'unbalanced' | 'unknown';
  periodStatus: 'open' | 'closed';
  onSync: () => void;
  syncing: boolean;
}

export default function BookkeepingCockpitBar({
  connectedAccounts,
  uncategorized,
  uncommitted,
  journalEntryCount,
  trialBalanceStatus,
  periodStatus,
  onSync,
  syncing,
}: BookkeepingCockpitBarProps) {
  const tbLabel = trialBalanceStatus === 'balanced' ? 'Balanced' : trialBalanceStatus === 'unbalanced' ? 'Unbalanced' : '—';
  const tbColor = trialBalanceStatus === 'balanced' ? 'text-emerald-300' : trialBalanceStatus === 'unbalanced' ? 'text-red-300' : 'text-white';
  const periodLabel = periodStatus === 'open' ? 'Open' : 'Closed';
  const periodColor = periodStatus === 'open' ? 'text-emerald-300' : 'text-white';

  return (
    <div className="-mx-4 lg:-mx-6 -mt-4 lg:-mt-6 px-3 lg:px-6 py-3 pb-5 bg-brand-purple/95 backdrop-blur-sm sticky top-0 z-40">
      <div className="max-w-[1800px] mx-auto">

        {/* ROW 1 — Identity + Sync */}
        <div className="bg-white border-2 border-brand-gold/60 rounded-xl shadow-md flex flex-col lg:flex-row">
          {/* Zone 1: Identity */}
          <div className="px-4 py-3 lg:w-[160px] lg:flex-shrink-0 lg:border-r border-b lg:border-b-0 border-gray-200">
            <div className="text-sm font-bold text-text-primary">Bookkeeping</div>
            <div className="flex items-center gap-1.5 mt-1">
              {connectedAccounts > 0 ? (
                <><div className="w-2 h-2 bg-emerald-500 rounded-full" /><span className="text-xs text-emerald-600">{connectedAccounts} linked</span></>
              ) : (
                <><div className="w-2 h-2 bg-gray-400 rounded-full" /><span className="text-xs text-text-muted">No accounts</span></>
              )}
            </div>
          </div>

          {/* Zone 2: Pipeline status summary */}
          <div className="px-4 py-2.5 lg:flex-1 lg:border-r border-b lg:border-b-0 border-gray-200 min-w-0">
            <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary">
              {uncategorized > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  {uncategorized} uncategorized
                </span>
              )}
              {uncommitted > 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  {uncommitted} uncommitted
                </span>
              )}
              {uncategorized === 0 && uncommitted === 0 && (
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  All transactions processed
                </span>
              )}
            </div>
          </div>

          {/* Zone 3: Sync button */}
          <button
            onClick={onSync}
            disabled={syncing}
            className="flex items-center justify-center px-5 min-w-[80px] bg-brand-gold hover:bg-brand-gold-bright text-white font-bold text-base transition-colors whitespace-nowrap lg:rounded-r-xl shrink-0 disabled:opacity-50 py-3 lg:py-0"
          >
            {syncing ? (
              <span className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Syncing
              </span>
            ) : (
              'Sync'
            )}
          </button>
        </div>

        {/* ROW 2 — 6 Metrics Bar */}
        <div className="bg-brand-purple/90 rounded-lg mt-2 px-3 py-2">
          <div className="flex items-center">
            <div className="flex-1 grid grid-cols-6 text-center min-w-0">
              <div className="px-2 border-r border-white/10 min-w-0">
                <div className="text-[9px] text-white/60 uppercase">Accts</div>
                <div className="text-sm font-bold font-mono text-white truncate">{connectedAccounts}</div>
              </div>
              <div className="px-2 border-r border-white/10 min-w-0">
                <div className="text-[9px] text-white/60 uppercase">Uncat</div>
                <div className={`text-sm font-bold font-mono truncate ${uncategorized > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{uncategorized}</div>
              </div>
              <div className="px-2 border-r border-white/10 min-w-0">
                <div className="text-[9px] text-white/60 uppercase">Uncommit</div>
                <div className={`text-sm font-bold font-mono truncate ${uncommitted > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>{uncommitted}</div>
              </div>
              <div className="px-2 border-r border-white/10 min-w-0">
                <div className="text-[9px] text-white/60 uppercase">JE</div>
                <div className="text-sm font-bold font-mono text-white truncate">{journalEntryCount}</div>
              </div>
              <div className="px-2 border-r border-white/10 min-w-0">
                <div className="text-[9px] text-white/60 uppercase">TB</div>
                <div className={`text-sm font-bold font-mono truncate ${tbColor}`}>{tbLabel}</div>
              </div>
              <div className="px-2 min-w-0">
                <div className="text-[9px] text-white/60 uppercase">Period</div>
                <div className={`text-sm font-bold font-mono truncate ${periodColor}`}>{periodLabel}</div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
