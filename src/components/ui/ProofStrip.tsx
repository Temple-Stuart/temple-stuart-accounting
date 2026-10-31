/**
 * ProofStrip (PIPE-FRAME-1) — the receipts rail of the Pipe Frame, on the
 * Runway TRADING-card anatomy verbatim (RunwayBudgetPanel.tsx:396-417):
 * tracked receipt = solid hairline card, mono tabular value, faint sub-line;
 * absent data = the honest dashed "not tracked yet" treatment — a value is
 * NEVER faked and no fallback substitutes for one. The caller supplies an
 * honest per-receipt empty label when "not tracked yet" would itself be a
 * lie (e.g. session-scoped data that simply hasn't happened yet).
 */

export interface ProofReceipt {
  label: string;
  /** Absent → the dashed empty treatment renders with emptyLabel. */
  value?: string;
  /** Faint sub-line under the value (timestamp / provenance). */
  sub?: string;
  /** The honest empty wording; defaults to the Runway card's "not tracked yet". */
  emptyLabel?: string;
}

export default function ProofStrip({ receipts }: { receipts: ProofReceipt[] }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
      {receipts.map((r) => {
        const tracked = r.value != null;
        return (
          <div
            key={r.label}
            className={
              tracked
                ? 'flex-1 min-w-[180px] rounded-lg border border-border bg-bg-row/40 px-3 py-2'
                : 'flex-1 min-w-[180px] rounded-lg border border-dashed border-border bg-bg-row/20 px-3 py-2'
            }
          >
            <div className="text-xs font-semibold text-text-secondary uppercase tracking-wide">{r.label}</div>
            {tracked ? (
              <div className="mt-1 font-mono text-sm text-text-primary tabular-nums">{r.value}</div>
            ) : (
              <div className="mt-1 font-mono text-sm text-text-faint italic tabular-nums">
                {r.emptyLabel ?? 'not tracked yet'}
              </div>
            )}
            {r.sub && <div className="text-[10px] text-text-faint mt-0.5">{r.sub}</div>}
          </div>
        );
      })}
    </div>
  );
}
