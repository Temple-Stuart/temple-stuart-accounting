'use client';

/**
 * StayCosts — STAYS · CALCULATED on the Travel tab, after the TRAVEL LEDGER (TRAVEL-02c, Alex, 2026-11-03, rulings E and F).
 *
 * One authed GET of /api/operations/stays/costs: every stay of the caller with its figures as the pure leaf computes
 * them on the server (src/lib/operations/stayCosts.ts — DAYS, CHARGES, TOTAL, PER DAY, the BASELINE in force on the
 * stay's first day, FOR THE STAY, UNDER / OVER, each with its formula) and every living baseline, voided ones marked.
 * Drawn in THE table idiom — the shared DataTable over the leaf's spec (STAY_COST_TABLE): Alex's column order, every
 * column sortable and filterable, the rows shown downloadable as a CSV. Each stay row opens to its lines (each linked
 * posting: date · description · account · amount · 'reversed — pays nothing' when so) and to its BY ACCOUNT sums, and
 * carries the 'link a charge' door: the one link picker (ledger/LinkPicker.tsx — the TRAVEL LEDGER's door's shape in
 * AllBookings.tsx), kind 'stay', no instant, near the stay's first day; manual only — nothing linked by date or place.
 *
 * Under the table: the LIVING BASELINES (label · effective from · monthly · per day · status), '+ baseline' (label,
 * effective from, the monthly figure, the currency from the runtime's list — nothing preselected anywhere) and 'void'
 * on a live one (a reason, required). The server's words are shown in place on a refusal; after a write the section
 * reads again. A 200 without a list it promises fails by name (travelLedger.ts listOf → missingListWords — the one
 * reader, never a second). Every word is the leaves'; React state only — nothing stored in the browser.
 */

import { Fragment, useEffect, useMemo, useState } from 'react';
import { CHOOSE_CURRENCY_WORDS } from '@/components/ManualTransactionForm';
import DataTable, { cellClass, chipClass, moneyClass } from '@/components/table/DataTable';
import LinkPicker from '@/components/workbench/operations/ledger/LinkPicker';
import { centsOfTypedDollars, runtimeCurrencyCodes } from '@/lib/books/functionalCurrency';
import {
  NO_STAYS_WORDS, STAY_COSTS_LOADING_WORDS, STAY_COSTS_ROUTE, STAY_COSTS_UNREADABLE_WORDS, STAY_COST_CSV_FILE_NAME, STAY_COST_TABLE,
  stayCostCellWords, type BaselineView, type StayCost, type StayCostColumn,
} from '@/lib/operations/stayCosts';
import { listOf } from '@/lib/reservations/travelLedger';
import { filterRows, noFilters, type TableFilters } from '@/lib/table/filters';
import { sortRows, type TableSort } from '@/lib/table/sort';
import {
  ADD_BASELINE_WORDS, BASELINES_HEADING, BASELINE_FIELD_LABELS, BASELINE_LIST_HEADS, BASELINE_VOID_REASON_LABEL_WORDS, BY_ACCOUNT_HEADING,
  CANCEL_BASELINE_WORDS, CLOSE_LINES_WORDS, CURRENCIES_UNLISTED_WORDS, LINES_HEADING, LINK_A_CHARGE_WORDS, MONTHLY_PLACEHOLDER_WORDS,
  NO_BASELINES_WORDS, NO_LINES_WORDS, OPEN_LINES_WORDS, SAVE_BASELINE_WORDS, SAVING_BASELINE_WORDS, VOIDING_BASELINE_WORDS, VOID_BASELINE_WORDS,
} from '@/lib/travel/livingBaseline';
import { noWordsRefusalWords } from '@/lib/travel/travelExpense';

type Loaded =
  | { state: 'loading' }
  | { state: 'error'; message: string }
  | { state: 'done'; stays: StayCost[]; baselines: BaselineView[] };

const NO_FILTERS = noFilters(STAY_COST_TABLE);
const BLANK_CLASS = 'text-text-faint';
const FORMULA_CLASS = 'block text-[10px] text-text-faint';
const input = 'w-full px-2 py-1 border border-border rounded text-xs bg-white';
const label = 'block text-[10px] uppercase tracking-wide text-text-faint mb-0.5';
const head = 'text-[10px] uppercase tracking-wide text-text-faint';

/** The server's words from an answer it gave, or its status said when it gave none. */
function refusalWordsOf(data: unknown, status: number): string {
  const words = typeof data === 'object' && data !== null && 'error' in data ? (data as { error: unknown }).error : null;
  return typeof words === 'string' ? words : noWordsRefusalWords(status);
}

/** A write's answer: null when the server accepted it, else its refusal words — shown in place. */
async function refused(res: Response): Promise<string | null> {
  if (res.ok) return null;
  const data: unknown = await res.json().catch(() => null);
  return refusalWordsOf(data, res.status);
}

export default function StayCosts() {
  const [loaded, setLoaded] = useState<Loaded>({ state: 'loading' });
  const [filters, setFilters] = useState<TableFilters>(NO_FILTERS);
  const [sort, setSort] = useState<TableSort<StayCostColumn> | null>(null);
  const [openFilter, setOpenFilter] = useState<StayCostColumn | null>(null);
  const [reads, setReads] = useState(0);
  const [opened, setOpened] = useState<string | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const readAgain = () => setReads((n) => n + 1);
  const closePicker = () => setPicking(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(STAY_COSTS_ROUTE);
        // A body that is not JSON is read as none: a refusal then says its status; a 200 then fails by name (listOf).
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok) throw new Error(refusalWordsOf(data, res.status));
        const stays = listOf<StayCost>(data, STAY_COSTS_ROUTE, 'stays');
        const baselines = listOf<BaselineView>(data, STAY_COSTS_ROUTE, 'baselines');
        if (alive) setLoaded({ state: 'done', stays, baselines });
      } catch (err) {
        if (alive) setLoaded({ state: 'error', message: err instanceof Error ? err.message : STAY_COSTS_UNREADABLE_WORDS });
      }
    })();
    return () => { alive = false; };
  }, [reads]);

  const rows: readonly StayCost[] = useMemo(() => (loaded.state === 'done' ? loaded.stays : []), [loaded]);
  const shown = sortRows(filterRows(rows, filters, STAY_COST_TABLE), sort, STAY_COST_TABLE);
  const ready = loaded.state === 'done';
  const cell = (s: StayCost, column: StayCostColumn, blank: boolean, className: string = cellClass) => (
    <td key={column} className={`${className} ${blank ? BLANK_CLASS : ''}`} data-stay-cost-cell={column}>{stayCostCellWords(s, column)}</td>
  );
  const withFormula = (s: StayCost, column: StayCostColumn, blank: boolean, formula: string | null, className: string) => (
    <td key={column} className={`${className} ${blank ? BLANK_CLASS : ''}`} data-stay-cost-cell={column}>
      {stayCostCellWords(s, column)}
      {formula !== null && <span className={FORMULA_CLASS} data-stay-cost-formula={column}>{formula}</span>}
    </td>
  );

  return (
    <div className="rounded-lg border border-border bg-white p-4 space-y-3" data-stay-costs>
      <DataTable
        name="stay-costs"
        columns={STAY_COST_TABLE}
        rows={rows}
        shown={shown}
        loaded={ready}
        tableClassName="min-w-[80rem]"
        filters={filters}
        onFilters={setFilters}
        noFilters={NO_FILTERS}
        sort={sort}
        onSort={setSort}
        openFilter={openFilter}
        onOpenFilter={setOpenFilter}
        csv={shown.length > 0 ? { name: STAY_COST_CSV_FILE_NAME } : null}
        controls={null}
        renderRow={(s) => (
          <Fragment key={s.id}>
            <tr className="border-t border-border" data-stay-cost-row={s.id}>
              {cell(s, 'stay', false, `${cellClass} whitespace-nowrap tabular-nums`)}
              {cell(s, 'place', false)}
              {cell(s, 'days', false, `${cellClass} tabular-nums`)}
              {cell(s, 'charges', s.paying === 0)}
              {cell(s, 'total', s.totalCents === null, `${moneyClass} ${s.totalCents === null ? '' : 'font-semibold text-text-primary'}`)}
              {withFormula(s, 'perDay', s.perDayCents === null, s.perDayFormula, moneyClass)}
              {withFormula(s, 'baseline', s.baseline === null, s.baseline === null ? null : s.baseline.perDayFormula, cellClass)}
              {withFormula(s, 'forTheStay', s.forTheStayMinor === null, s.forTheStayFormula, moneyClass)}
              {cell(s, 'underOver', s.underOver.cents === null, `${cellClass} ${s.underOver.cents === null ? '' : 'font-semibold text-text-primary'}`)}
              <td className={`${cellClass} font-mono text-[10px]`} data-stay-cost-cell="id">
                <div>{s.id}</div>
                <div className="mt-1 flex flex-wrap gap-1 font-sans text-xs">
                  <button type="button" className={chipClass} onClick={() => setOpened(opened === s.id ? null : s.id)} aria-expanded={opened === s.id} data-stay-cost-lines={s.id}>{opened === s.id ? CLOSE_LINES_WORDS : OPEN_LINES_WORDS}</button>
                  <button type="button" className={chipClass} onClick={() => setPicking(picking === s.id ? null : s.id)} aria-expanded={picking === s.id} data-stay-cost-link={s.id}>{LINK_A_CHARGE_WORDS}</button>
                </div>
              </td>
            </tr>
            {opened === s.id && (
              <tr className="border-t border-border" data-stay-cost-drill={s.id}>
                <td colSpan={STAY_COST_TABLE.length} className={cellClass}>
                  <div className="grid gap-3 md:grid-cols-2 text-xs">
                    <div className="space-y-1">
                      <p className={head}>{LINES_HEADING}</p>
                      {s.charges.length === 0 && <p className="text-text-muted" data-stay-cost-no-lines>{NO_LINES_WORDS}</p>}
                      {s.charges.length > 0 && (
                        <ul className="space-y-0.5">
                          {s.charges.map((c) => (
                            <li key={c.journalEntryId} className={`flex flex-wrap items-baseline gap-2 ${c.reversed ? 'line-through text-text-muted' : ''}`} data-stay-cost-line={c.journalEntryId}>
                              <span className="font-mono text-text-muted">{c.date}</span>
                              <span className="min-w-0 flex-1">{c.description}</span>
                              <span className="text-text-secondary">{c.accountWords}</span>
                              <span className="font-mono tabular-nums">{c.amountWords}</span>
                              {c.reversedWords !== null && <span className="text-amber-800 no-underline" data-stay-cost-line-reversed>{c.reversedWords}</span>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className={head}>{BY_ACCOUNT_HEADING}</p>
                      {s.byAccount.length > 0 && (
                        <ul className="space-y-0.5">
                          {s.byAccount.map((a) => (
                            <li key={a.key} className="flex items-baseline gap-2" data-stay-cost-account={a.key}>
                              <span className="min-w-0 flex-1">{a.words}</span>
                              <span className="font-mono tabular-nums">{a.amountWords}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {s.byAccountWords !== null && <p className="text-brand-red" data-stay-cost-by-account-disagrees>{s.byAccountWords}</p>}
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {picking === s.id && (
              <tr className="border-t border-border" data-stay-cost-picker={s.id}>
                <td colSpan={STAY_COST_TABLE.length} className={cellClass}>
                  <LinkPicker kind="stay" id={s.id} instant={null} near={s.starts_on} onChanged={readAgain} onClose={closePicker} />
                </td>
              </tr>
            )}
          </Fragment>
        )}
        foot={null}
      >
        {loaded.state === 'loading' && <p className="text-sm text-text-faint" data-stay-costs-loading>{STAY_COSTS_LOADING_WORDS}</p>}
        {loaded.state === 'error' && <p className="text-sm text-brand-red" role="alert" data-stay-costs-failed>{loaded.message}</p>}
        {ready && rows.length === 0 && <p className="text-sm text-text-faint" data-stay-costs-none>{NO_STAYS_WORDS}</p>}
      </DataTable>
      {loaded.state === 'done' && <Baselines baselines={loaded.baselines} onWritten={readAgain} />}
    </div>
  );
}

/** The LIVING BASELINES under the table: the list, '+ baseline', and 'void' on a live one. */
function Baselines({ baselines, onWritten }: { readonly baselines: readonly BaselineView[]; readonly onWritten: () => void }) {
  const [voiding, setVoiding] = useState<string | null>(null);
  return (
    <div className="space-y-2" data-living-baselines>
      <p className={head}>{BASELINES_HEADING}</p>
      {baselines.length === 0 && <p className="text-xs text-text-muted" data-living-baselines-none>{NO_BASELINES_WORDS}</p>}
      {baselines.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className={head}>
              {BASELINE_LIST_HEADS.map((h) => <th key={h} scope="col" className="px-2 py-1 text-left font-normal">{h}</th>)}
              <th scope="col" className="px-2 py-1" />
            </tr>
          </thead>
          <tbody>
            {baselines.map((b) => (
              <Fragment key={b.id}>
                <tr className={`border-t border-border ${b.voided ? 'line-through text-text-muted' : ''}`} data-living-baseline={b.id} data-living-baseline-voided={b.voided ? '' : undefined}>
                  <td className={cellClass}>{b.label}</td>
                  <td className={`${cellClass} tabular-nums`}>{b.effectiveFrom}</td>
                  <td className={moneyClass}>{b.monthlyWords}</td>
                  <td className={moneyClass}>
                    {b.perDayWords}
                    <span className={FORMULA_CLASS}>{b.perDayFormula}</span>
                  </td>
                  <td className={cellClass} data-living-baseline-status>{b.statusWords}</td>
                  <td className={cellClass}>
                    {!b.voided && <button type="button" className={chipClass} onClick={() => setVoiding(voiding === b.id ? null : b.id)} aria-expanded={voiding === b.id} data-living-baseline-void={b.id}>{VOID_BASELINE_WORDS}</button>}
                  </td>
                </tr>
                {voiding === b.id && (
                  <tr className="border-t border-border">
                    <td colSpan={BASELINE_LIST_HEADS.length + 1} className={cellClass}>
                      <VoidBaseline id={b.id} onVoided={() => { setVoiding(null); onWritten(); }} onClose={() => setVoiding(null)} />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      )}
      <BaselineForm onSaved={onWritten} />
    </div>
  );
}

/** '+ baseline': label, effective from, the monthly figure, the currency from the runtime's list — nothing preselected. */
function BaselineForm({ onSaved }: { readonly onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [labelText, setLabelText] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [monthly, setMonthly] = useState('');
  const [currency, setCurrency] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const currencies = useMemo(() => runtimeCurrencyCodes(), []);

  const reset = () => { setLabelText(''); setEffectiveFrom(''); setMonthly(''); setCurrency(''); setRefusal(null); };

  const save = async () => {
    setRefusal(null);
    // The typed figure in the currency's hundredths — the currency home's one rule, its words on a refusal.
    let minor: bigint;
    try { minor = centsOfTypedDollars(monthly); } catch (error) { setRefusal(error instanceof Error ? error.message : String(error)); return; }
    const body: Record<string, unknown> = { label: labelText, monthly_minor: Number(minor) };
    if (effectiveFrom !== '') body.effective_from = effectiveFrom;
    if (currency !== '') body.currency = currency;
    setBusy(true);
    try {
      const words = await refused(await fetch('/api/living-baselines', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
      if (words !== null) { setRefusal(words); return; }
      reset();
      setOpen(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return <button type="button" className={chipClass} onClick={() => setOpen(true)} data-living-baseline-add>{ADD_BASELINE_WORDS}</button>;
  }
  return (
    <div className="space-y-2 rounded border border-border bg-white p-3 text-xs" data-living-baseline-form>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div>
          <label className={label}>{BASELINE_FIELD_LABELS.label}</label>
          <input type="text" className={input} value={labelText} onChange={(e) => setLabelText(e.target.value)} maxLength={80} data-living-baseline-field="label" />
        </div>
        <div>
          <label className={label}>{BASELINE_FIELD_LABELS.effective_from}</label>
          <input type="date" className={input} value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} data-living-baseline-field="effective_from" />
        </div>
        <div>
          <label className={label}>{BASELINE_FIELD_LABELS.monthly_minor}</label>
          <input type="text" inputMode="decimal" className={input} value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder={MONTHLY_PLACEHOLDER_WORDS} data-living-baseline-field="monthly" />
        </div>
        <div>
          <label className={label}>{BASELINE_FIELD_LABELS.currency}</label>
          {currencies !== null && (
            <select className={input} value={currency} onChange={(e) => setCurrency(e.target.value)} data-living-baseline-field="currency" data-currency-source="runtime-list">
              <option value="" disabled>{CHOOSE_CURRENCY_WORDS}</option>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          {currencies === null && <p className="text-brand-red" role="alert" data-living-baseline-currencies-unlisted>{CURRENCIES_UNLISTED_WORDS}</p>}
        </div>
      </div>
      {refusal !== null && <p className="text-brand-red" role="alert" data-living-baseline-refusal>{refusal}</p>}
      <div className="flex gap-2">
        <button type="button" className={chipClass} disabled={busy} onClick={() => { void save(); }} data-living-baseline-save>{busy ? SAVING_BASELINE_WORDS : SAVE_BASELINE_WORDS}</button>
        <button type="button" className={chipClass} disabled={busy} onClick={() => { reset(); setOpen(false); }} data-living-baseline-cancel>{CANCEL_BASELINE_WORDS}</button>
      </div>
    </div>
  );
}

/** 'void' on a live baseline: a reason, required; the server's refusal in place; the section reads again after. */
function VoidBaseline({ id, onVoided, onClose }: { readonly id: string; readonly onVoided: () => void; readonly onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setRefusal(null);
    setBusy(true);
    try {
      const words = await refused(await fetch(`/api/living-baselines/${encodeURIComponent(id)}/void`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) }));
      if (words !== null) { setRefusal(words); return; }
      onVoided();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-end gap-2 text-xs" data-living-baseline-void-form={id}>
      <div className="min-w-[16rem] flex-1">
        <label className={label}>{BASELINE_VOID_REASON_LABEL_WORDS}</label>
        <input type="text" className={input} value={reason} onChange={(e) => setReason(e.target.value)} data-living-baseline-void-reason />
      </div>
      <button type="button" className={chipClass} disabled={busy} onClick={() => { void submit(); }} data-living-baseline-void-submit>{busy ? VOIDING_BASELINE_WORDS : VOID_BASELINE_WORDS}</button>
      <button type="button" className={chipClass} disabled={busy} onClick={onClose} data-living-baseline-void-cancel>{CANCEL_BASELINE_WORDS}</button>
      {refusal !== null && <p className="w-full text-brand-red" role="alert" data-living-baseline-void-refusal>{refusal}</p>}
    </div>
  );
}
