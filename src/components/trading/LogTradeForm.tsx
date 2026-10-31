'use client';

/**
 * TRADE-LOG-01 STEP 1 — "LOG A TRADE." Trade Log's own door, on phase 04 LAB.
 *
 * WHY IT EXISTS. Before this, a trading_positions row was created in exactly
 * one place — src/lib/position-tracker-service.ts:176 — from an
 * investment_transactions leg, and those legs are written only by the Plaid
 * arrivals pass. A customer had to connect a brokerage in Banking, sync it and
 * commit legs in Books before Trade Log had anything to show. This form is the
 * other door: a trade, by hand, and the tool works.
 *
 * WHAT IT ASKS FOR is exactly what a trading_positions row needs and nothing
 * more — the STEP 0.1 column set. Per trade: symbol, strategy, open date, and
 * a close date when it is closed. Per leg: side, type, strike, expiry,
 * quantity, open price, open fee — and, when closing, close price and close
 * fee. Nothing here is invented and nothing is defaulted: the fee fields are
 * asked for because a fee enters the cost basis
 * (src/lib/tradeLog/optionPnl.ts), and a "0" the user typed is a fact while a
 * "0" this form assumed would be a fabricated one.
 *
 * WHAT IT NEVER COMPUTES. Realized P&L is NOT calculated here. The server
 * builds every row through src/lib/tradeLog/manualTrade.ts, which calls the
 * same functions position-tracker-service.ts calls on a synced close, so a
 * hand-entered close and a synced close of the same legs produce the same
 * number. This form's job is to collect and to show the refusal.
 *
 * THE STRATEGY LIST is AVAILABLE_STRATEGIES — the builders' own const, the
 * same list TradeLabPanel's filter uses after MODEL-02. Never free text: a
 * strategy the scanner cannot build is a strategy nothing can ever grade
 * against.
 */

import { useCallback, useEffect, useState } from 'react';
import { AVAILABLE_STRATEGIES } from '@/lib/convergence/filter-types';
import { MANUAL_BADGE, SELF_REPORTED_BIAS_NOTE } from '@/lib/tradeLog/ownership';
import { OPTION_MULTIPLIER } from '@/lib/tradeLog/manualTrade';
import { MONEY_ACTION, SECTION_HEADER, STATE } from '@/lib/ds';

/** One leg as the form holds it — strings, because an empty input is not a 0. */
interface LegDraft {
  side: 'buy' | 'sell';
  optionType: 'CALL' | 'PUT';
  strike: string;
  expiry: string;
  quantity: string;
  openPrice: string;
  openFees: string;
  closePrice: string;
  closeFees: string;
}

function emptyLeg(): LegDraft {
  return { side: 'sell', optionType: 'PUT', strike: '', expiry: '', quantity: '', openPrice: '', openFees: '', closePrice: '', closeFees: '' };
}

/**
 * A typed number, or undefined when the box is empty. NEVER 0 for an empty
 * box: the server refuses a missing number by name, and that refusal is the
 * point — `Number('')` is 0 and would post a fabricated price.
 */
function typedNumber(v: string): number | undefined {
  const s = v.trim();
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

const INPUT = 'w-full bg-white border border-border rounded px-1.5 py-1 text-[11px] font-mono text-text-primary outline-none focus:border-brand-purple';
const LABEL = 'block text-[9px] uppercase tracking-wider text-text-muted mb-0.5';

export interface LogTradeFormProps {
  /** Called after a trade lands, so the page reloads its trades. */
  onLogged?: (tradeNum: string) => void;
  /**
   * STEP 4 — A CORRECTION. The trade number the owner asked to correct; the
   * form loads it from the server (never from the list's summary shape) and
   * submits a PATCH instead of a POST. Null means "log a new one".
   */
  editTradeNum?: string | null;
  /** Called when the correction is finished or abandoned. */
  onEditDone?: () => void;
}

export default function LogTradeForm({ onLogged, editTradeNum, onEditDone }: LogTradeFormProps) {
  const [open, setOpen] = useState(false);
  const [symbol, setSymbol] = useState('');
  const [strategy, setStrategy] = useState(AVAILABLE_STRATEGIES[0]);
  const [openDate, setOpenDate] = useState('');
  const [isClosed, setIsClosed] = useState(false);
  const [closeDate, setCloseDate] = useState('');
  const [legs, setLegs] = useState<LegDraft[]>([emptyLeg()]);
  const [submitting, setSubmitting] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [landed, setLanded] = useState<{ trade_num: string; legs: number; status: string; realized_pl: number | null } | null>(null);

  /** A stored number back into the box it came from. Null stays empty. */
  const box = (v: number | null | undefined) => (v == null ? '' : String(v));

  /**
   * Load a stored hand-entered trade into the boxes. The server answers in the
   * form's own shape (GET /api/trade-log/manual), so nothing is re-derived here
   * and a correction starts from what is stored.
   */
  const loadForEdit = useCallback(async (tradeNum: string) => {
    setRefusal(null);
    setLanded(null);
    const res = await fetch(`/api/trade-log/manual?trade_num=${encodeURIComponent(tradeNum)}`);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setRefusal(data?.error ?? `That trade could not be read (HTTP ${res.status}).`);
      setOpen(true);
      return;
    }
    setSymbol(data.symbol ?? '');
    setStrategy(AVAILABLE_STRATEGIES.includes(data.strategy) ? data.strategy : AVAILABLE_STRATEGIES[0]);
    setOpenDate(data.openDate ?? '');
    setIsClosed(!!data.closeDate);
    setCloseDate(data.closeDate ?? '');
    setLegs((data.legs ?? []).map((l: Record<string, unknown>) => ({
      side: l.side === 'buy' ? 'buy' : 'sell',
      optionType: l.optionType === 'CALL' ? 'CALL' : 'PUT',
      strike: box(l.strike as number | null),
      expiry: (l.expiry as string | null) ?? '',
      quantity: box(l.quantity as number | null),
      openPrice: box(l.openPrice as number | null),
      openFees: box(l.openFees as number | null),
      closePrice: box(l.closePrice as number | null),
      closeFees: box(l.closeFees as number | null),
    })));
    setOpen(true);
  }, []);

  useEffect(() => {
    if (!editTradeNum) return;
    loadForEdit(editTradeNum).catch((err) => setRefusal(err instanceof Error ? err.message : 'That trade could not be read.'));
  }, [editTradeNum, loadForEdit]);

  const setLeg = (i: number, patch: Partial<LegDraft>) =>
    setLegs((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const reset = () => {
    setSymbol(''); setStrategy(AVAILABLE_STRATEGIES[0]); setOpenDate('');
    setIsClosed(false); setCloseDate(''); setLegs([emptyLeg()]); setRefusal(null);
  };

  const submit = async () => {
    setSubmitting(true);
    setRefusal(null);
    setLanded(null);
    try {
      const res = await fetch('/api/trade-log/manual', {
        // A correction re-states the trade; the route replaces its legs in one
        // transaction so the trade is never half-corrected.
        method: editTradeNum ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editTradeNum ? { trade_num: editTradeNum } : {}),
          symbol,
          strategy,
          openDate,
          closeDate: isClosed ? closeDate : null,
          legs: legs.map((l) => ({
            side: l.side,
            optionType: l.optionType,
            strike: typedNumber(l.strike),
            expiry: l.expiry,
            quantity: typedNumber(l.quantity),
            openPrice: typedNumber(l.openPrice),
            openFees: typedNumber(l.openFees),
            // Only sent when closing — an unsent close price is not a zero one.
            ...(isClosed ? { closePrice: typedNumber(l.closePrice), closeFees: typedNumber(l.closeFees) } : {}),
          })),
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        // The server's own words, verbatim — it names the field it refused.
        setRefusal(data?.error ?? `The trade was not logged (HTTP ${res.status}).`);
        return;
      }
      setLanded(data);
      reset();
      onEditDone?.();
      onLogged?.(data?.trade_num ?? '');
    } catch (err) {
      setRefusal(err instanceof Error ? `The trade was not logged: ${err.message}` : 'The trade was not logged.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="log-a-trade" className="overflow-hidden border-x border-b border-border" data-log-trade-form>
      <div className={SECTION_HEADER}>
        <span>{editTradeNum ? `Correct ${editTradeNum}` : 'Log a trade'}</span>
        <button
          type="button"
          onClick={() => { if (open && editTradeNum) { reset(); onEditDone?.(); } setOpen((o) => !o); }}
          data-log-trade-toggle
          className="rounded bg-brand-purple px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-brand-purple-hover"
        >
          {open ? 'Close' : 'Log a trade'}
        </button>
      </div>

      {landed && (
        <div className="bg-white px-4 py-2 text-xs text-status-success" role="status" data-log-trade-landed>
          Trade {landed.trade_num} saved — {landed.legs} leg{landed.legs === 1 ? '' : 's'}, {landed.status}
          {landed.realized_pl != null && `, realized P&L ${landed.realized_pl >= 0 ? '+' : '-'}$${Math.abs(landed.realized_pl).toFixed(2)}`}
          . Marked <span className="font-mono">{MANUAL_BADGE}</span>.
        </div>
      )}

      {open && (
        <div className="bg-white px-4 py-3 space-y-3">
          <p className="text-[11px] leading-relaxed text-text-muted" data-log-trade-bias>{SELF_REPORTED_BIAS_NOTE}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className={LABEL} htmlFor="ltf-symbol">Symbol</label>
              <input id="ltf-symbol" className={INPUT} value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="SPY" />
            </div>
            <div>
              <label className={LABEL} htmlFor="ltf-strategy">Strategy</label>
              {/* The builders' own const — never a free-text box. */}
              <select id="ltf-strategy" className={INPUT} value={strategy} onChange={(e) => setStrategy(e.target.value)}>
                {AVAILABLE_STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="ltf-open-date">Open date</label>
              <input id="ltf-open-date" type="date" className={INPUT} value={openDate} onChange={(e) => setOpenDate(e.target.value)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="ltf-close-date">Close date</label>
              <div className="flex items-center gap-1">
                <input
                  id="ltf-closed"
                  type="checkbox"
                  checked={isClosed}
                  onChange={(e) => setIsClosed(e.target.checked)}
                  aria-label="This trade is closed"
                  data-log-trade-closed
                />
                <input id="ltf-close-date" type="date" className={INPUT} value={closeDate} disabled={!isClosed}
                  onChange={(e) => setCloseDate(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead className="bg-bg-row">
                <tr>
                  {['Leg', 'Side', 'Type', 'Strike', 'Expiry', 'Qty', 'Open price', 'Open fee', ...(isClosed ? ['Close price', 'Close fee'] : []), ''].map((h, i) => (
                    <th key={`${h}-${i}`} className="px-1.5 py-1.5 text-left font-mono text-[9px] uppercase tracking-wider text-text-faint">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {legs.map((leg, i) => (
                  <tr key={i} data-log-trade-leg>
                    <td className="px-1.5 py-1 font-mono text-text-muted">{i + 1}</td>
                    <td className="px-1.5 py-1">
                      <select className={INPUT} aria-label={`Leg ${i + 1} side`} value={leg.side}
                        onChange={(e) => setLeg(i, { side: e.target.value as LegDraft['side'] })}>
                        <option value="sell">sell</option>
                        <option value="buy">buy</option>
                      </select>
                    </td>
                    <td className="px-1.5 py-1">
                      <select className={INPUT} aria-label={`Leg ${i + 1} type`} value={leg.optionType}
                        onChange={(e) => setLeg(i, { optionType: e.target.value as LegDraft['optionType'] })}>
                        <option value="PUT">PUT</option>
                        <option value="CALL">CALL</option>
                      </select>
                    </td>
                    <td className="px-1.5 py-1"><input className={INPUT} aria-label={`Leg ${i + 1} strike`} inputMode="decimal" value={leg.strike} onChange={(e) => setLeg(i, { strike: e.target.value })} /></td>
                    <td className="px-1.5 py-1"><input className={INPUT} aria-label={`Leg ${i + 1} expiry`} type="date" value={leg.expiry} onChange={(e) => setLeg(i, { expiry: e.target.value })} /></td>
                    <td className="px-1.5 py-1"><input className={INPUT} aria-label={`Leg ${i + 1} quantity`} inputMode="numeric" value={leg.quantity} onChange={(e) => setLeg(i, { quantity: e.target.value })} /></td>
                    <td className="px-1.5 py-1"><input className={INPUT} aria-label={`Leg ${i + 1} open price`} inputMode="decimal" value={leg.openPrice} onChange={(e) => setLeg(i, { openPrice: e.target.value })} /></td>
                    <td className="px-1.5 py-1"><input className={INPUT} aria-label={`Leg ${i + 1} open fee`} inputMode="decimal" value={leg.openFees} onChange={(e) => setLeg(i, { openFees: e.target.value })} /></td>
                    {isClosed && (
                      <>
                        <td className="px-1.5 py-1"><input className={INPUT} aria-label={`Leg ${i + 1} close price`} inputMode="decimal" value={leg.closePrice} onChange={(e) => setLeg(i, { closePrice: e.target.value })} /></td>
                        <td className="px-1.5 py-1"><input className={INPUT} aria-label={`Leg ${i + 1} close fee`} inputMode="decimal" value={leg.closeFees} onChange={(e) => setLeg(i, { closeFees: e.target.value })} /></td>
                      </>
                    )}
                    <td className="px-1.5 py-1">
                      {legs.length > 1 && (
                        <button type="button" aria-label={`Remove leg ${i + 1}`}
                          onClick={() => setLegs((prev) => prev.filter((_, j) => j !== i))}
                          className="px-1.5 py-0.5 text-[10px] bg-bg-row text-text-muted hover:bg-border">×</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setLegs((prev) => [...prev, emptyLeg()])}
              data-log-trade-add-leg
              className="rounded bg-bg-row px-2 py-1 text-[10px] text-text-muted hover:bg-border">+ Leg</button>
            <span className="font-mono text-[10px] text-text-faint">
              Price is per contract; every contract is × {OPTION_MULTIPLIER}. Enter a fee of 0 if there was none.
            </span>
            <button type="button" onClick={submit} disabled={submitting} className={`${MONEY_ACTION} ml-auto`} data-log-trade-submit>
              {submitting ? (editTradeNum ? 'Correcting…' : 'Logging…') : editTradeNum ? 'Save correction' : 'Log trade'}
            </button>
          </div>

          {refusal && (
            <div className={STATE.errorCard} role="alert" data-log-trade-refusal>{refusal}</div>
          )}
        </div>
      )}
    </div>
  );
}
