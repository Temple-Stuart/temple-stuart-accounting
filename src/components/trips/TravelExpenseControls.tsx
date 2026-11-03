'use client';

/**
 * TravelExpenseControls — the TRAVEL LEDGER's two writers (TRAVEL-02b, Alex, 2026-11-03, ruling E).
 *
 * The ledger itself (AllBookings.tsx) reads and writes nothing (the bookings law, BOOKINGS-01 clause 4); the two
 * writes a customer makes beside it live here, the way the task ledger's "+ expense" lives in its own ExpenseForm:
 *
 *   · TravelExpenseForm — "+ travel expense" under the ledger: KIND (three choices, nothing preselected), PAID ON (a
 *     date input, empty), AMOUNT (typed as the currency's figure — functionalCurrency.ts centsOfTypedDollars' rule,
 *     exact: digits and at most two decimals, the minor units by string arithmetic, never rounded), CURRENCY (the
 *     runtime's list, nothing preselected, or a typed code where the runtime has no list — FX-01b's shape,
 *     ManualTransactionForm.tsx), VENDOR, NOTE, TRIP (the caller's trips or 'unattached' — a choice the customer
 *     makes; nothing preselected, and the form refuses to send until one is made) and ACCOUNT (the chart accounts the
 *     route accepts, optional). It POSTs /api/travel-expenses; the server's refusal words are shown in place; after a
 *     save the ledger reads again (onSaved).
 *   · VoidTravelExpense — "void" on a row: a reason, required; POST /api/travel-expenses/[id]/void; the refusal shown
 *     in place; after a void the ledger reads again. No edit, no delete — a typed expense is frozen once kept.
 *
 * Every word is travelExpense.ts' or the ledger leaf's (the form's field labels, the choices' words), or the manual
 * form's currency words. React state only — nothing stored in the browser.
 */

import { useMemo, useState } from 'react';
import { CHOOSE_CURRENCY_WORDS, TYPED_CURRENCY_PLACEHOLDER } from '@/components/ManualTransactionForm';
import { chipClass } from '@/components/table/DataTable';
import { centsOfTypedDollars, runtimeCurrencyCodes } from '@/lib/books/functionalCurrency';
import { KIND_WORDS, NO_ACCOUNT_WORDS, UNATTACHED_WORDS } from '@/lib/reservations/travelLedger';
import {
  ADD_TRAVEL_EXPENSE_WORDS, AMOUNT_PLACEHOLDER_WORDS, CANCEL_EXPENSE_WORDS, CHOOSE_KIND_WORDS, CHOOSE_TRIP_WORDS, EXPENSE_FIELD_LABELS,
  SAVE_EXPENSE_WORDS, SAVING_EXPENSE_WORDS, TRAVEL_EXPENSE_KINDS, TRIP_NOT_CHOSEN_WORDS, VOIDING_WORDS, VOID_REASON_LABEL_WORDS, VOID_WORDS,
  chartChoiceWords, noWordsRefusalWords, type ChartChoice, type TripChoice,
} from '@/lib/travel/travelExpense';

/** The select's value for 'unattached' — a cuid never holds a colon, so no trip id can be it. */
const UNATTACHED_VALUE = ':unattached';

const input = 'w-full px-2 py-1 border border-border rounded text-xs bg-white';
const label = 'block text-[10px] uppercase tracking-wide text-text-faint mb-0.5';

/** The server's refusal words, or its status said when it gave none. */
async function refusalOf(res: Response): Promise<string> {
  const data: unknown = await res.json().catch(() => null);
  const words = typeof data === 'object' && data !== null && 'error' in data ? (data as { error: unknown }).error : null;
  return typeof words === 'string' ? words : noWordsRefusalWords(res.status);
}

export default function TravelExpenseForm({ trips, accounts, onSaved }: { readonly trips: readonly TripChoice[]; readonly accounts: readonly ChartChoice[]; readonly onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('');
  const [paidOn, setPaidOn] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('');
  const [vendor, setVendor] = useState('');
  const [note, setNote] = useState('');
  const [trip, setTrip] = useState('');
  const [account, setAccount] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const currencies = useMemo(() => runtimeCurrencyCodes(), []);

  const reset = () => {
    setKind(''); setPaidOn(''); setAmount(''); setCurrency(''); setVendor(''); setNote(''); setTrip(''); setAccount(''); setRefusal(null);
  };

  const save = async () => {
    setRefusal(null);
    // The trip is a choice — a trip, or unattached; nothing is chosen for the customer.
    if (trip === '') { setRefusal(TRIP_NOT_CHOSEN_WORDS); return; }
    // The typed figure, in the currency's minor units — the currency home's one rule, its words on a refusal.
    let minor: bigint;
    try { minor = centsOfTypedDollars(amount); } catch (error) { setRefusal(error instanceof Error ? error.message : String(error)); return; }
    const body: Record<string, unknown> = { amount_minor: Number(minor), vendor };
    if (kind !== '') body.kind = kind;
    if (paidOn !== '') body.paid_on = paidOn;
    if (currency !== '') body.currency = currency;
    if (note.trim() !== '') body.note = note;
    if (trip !== UNATTACHED_VALUE) body.trip_id = trip;
    if (account !== '') body.coa_code = account;
    setBusy(true);
    try {
      const res = await fetch('/api/travel-expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) { setRefusal(await refusalOf(res)); return; }
      reset();
      setOpen(false);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return <button type="button" className={chipClass} onClick={() => setOpen(true)} data-travel-expense-add>{ADD_TRAVEL_EXPENSE_WORDS}</button>;
  }
  return (
    <div className="space-y-2 rounded border border-border bg-white p-3 text-xs" data-travel-expense-form>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div>
          <label className={label}>{EXPENSE_FIELD_LABELS.kind}</label>
          <select className={input} value={kind} onChange={(e) => setKind(e.target.value)} data-travel-expense-field="kind">
            <option value="" disabled>{CHOOSE_KIND_WORDS}</option>
            {TRAVEL_EXPENSE_KINDS.map((k) => <option key={k} value={k}>{KIND_WORDS[k]}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{EXPENSE_FIELD_LABELS.paid_on}</label>
          <input type="date" className={input} value={paidOn} onChange={(e) => setPaidOn(e.target.value)} data-travel-expense-field="paid_on" />
        </div>
        <div>
          <label className={label}>{EXPENSE_FIELD_LABELS.amount_minor}</label>
          <input type="text" inputMode="decimal" className={input} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={AMOUNT_PLACEHOLDER_WORDS} data-travel-expense-field="amount" />
        </div>
        <div>
          <label className={label}>{EXPENSE_FIELD_LABELS.currency}</label>
          {currencies !== null ? (
            <select className={input} value={currency} onChange={(e) => setCurrency(e.target.value)} data-travel-expense-field="currency" data-currency-source="runtime-list">
              <option value="" disabled>{CHOOSE_CURRENCY_WORDS}</option>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          ) : (
            <input type="text" className={input} value={currency} onChange={(e) => setCurrency(e.target.value)} maxLength={3} placeholder={TYPED_CURRENCY_PLACEHOLDER} data-travel-expense-field="currency" data-currency-source="typed" />
          )}
        </div>
        <div>
          <label className={label}>{EXPENSE_FIELD_LABELS.vendor}</label>
          <input type="text" className={input} value={vendor} onChange={(e) => setVendor(e.target.value)} data-travel-expense-field="vendor" />
        </div>
        <div>
          <label className={label}>{EXPENSE_FIELD_LABELS.note}</label>
          <input type="text" className={input} value={note} onChange={(e) => setNote(e.target.value)} data-travel-expense-field="note" />
        </div>
        <div>
          <label className={label}>{EXPENSE_FIELD_LABELS.trip_id}</label>
          <select className={input} value={trip} onChange={(e) => setTrip(e.target.value)} data-travel-expense-field="trip">
            <option value="" disabled>{CHOOSE_TRIP_WORDS}</option>
            <option value={UNATTACHED_VALUE}>{UNATTACHED_WORDS}</option>
            {trips.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className={label}>{EXPENSE_FIELD_LABELS.coa_code}</label>
          <select className={input} value={account} onChange={(e) => setAccount(e.target.value)} data-travel-expense-field="account">
            <option value="">{NO_ACCOUNT_WORDS}</option>
            {accounts.map((a) => <option key={`${a.account}:${a.name}:${a.book}`} value={a.account}>{chartChoiceWords(a)}</option>)}
          </select>
        </div>
      </div>
      {refusal !== null && <p className="text-brand-red" role="alert" data-travel-expense-refusal>{refusal}</p>}
      <div className="flex gap-2">
        <button type="button" className={chipClass} disabled={busy} onClick={() => { void save(); }} data-travel-expense-save>{busy ? SAVING_EXPENSE_WORDS : SAVE_EXPENSE_WORDS}</button>
        <button type="button" className={chipClass} disabled={busy} onClick={() => { reset(); setOpen(false); }} data-travel-expense-cancel>{CANCEL_EXPENSE_WORDS}</button>
      </div>
    </div>
  );
}

/** "void" on a typed row: a reason, required; the server's refusal in place; the ledger reads again after. */
export function VoidTravelExpense({ id, onVoided, onClose }: { readonly id: string; readonly onVoided: () => void; readonly onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [refusal, setRefusal] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setRefusal(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/travel-expenses/${encodeURIComponent(id)}/void`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
      if (!res.ok) { setRefusal(await refusalOf(res)); return; }
      onVoided();
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-end gap-2 text-xs" data-travel-expense-void-form={id}>
      <div className="min-w-[16rem] flex-1">
        <label className={label}>{VOID_REASON_LABEL_WORDS}</label>
        <input type="text" className={input} value={reason} onChange={(e) => setReason(e.target.value)} data-travel-expense-void-reason />
      </div>
      <button type="button" className={chipClass} disabled={busy} onClick={() => { void submit(); }} data-travel-expense-void-submit>{busy ? VOIDING_WORDS : VOID_WORDS}</button>
      <button type="button" className={chipClass} disabled={busy} onClick={onClose} data-travel-expense-void-cancel>{CANCEL_EXPENSE_WORDS}</button>
      {refusal !== null && <p className="w-full text-brand-red" role="alert" data-travel-expense-void-refusal>{refusal}</p>}
    </div>
  );
}
