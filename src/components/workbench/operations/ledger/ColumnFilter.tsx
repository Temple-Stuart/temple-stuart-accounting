/**
 * ColumnFilter — one column's filter popover on the task ledger (LEDGER-04, Alex, 2026-10-20).
 *
 * "Filtering should work like a sheet: every column filterable, several at
 * once, and sortable — not three dropdowns." The section mounts this leaf under
 * the header whose ▾ was pressed, one at a time, and hands it the column, its
 * filter and (for a VALUE column) the values present among the rows loaded,
 * with their counts (ledger.ts columnValues). It renders by the column's kind:
 *
 *   · VALUE — a checklist, every value ticked at first, a blank cell listed as
 *     "(blank)", each with its count, "all" and "none" links; when the list is
 *     longer than NARROW_FROM a type-to-narrow box above it narrows the LIST,
 *     never the rows.
 *   · MONEY — a min and a max in dollars (either empty = no bound; both
 *     inclusive; a sign allowed), typed here and read by the rule's own parser
 *     (boundCentsOf — a refusal is said under the box and sets nothing), and a
 *     "(blank)" tick that keeps or drops the blank cells.
 *   · TEXT — a contains-text box.
 *
 * Every change is handed straight back (onChange) as the rule's own shape
 * (ValueFilter · MoneyFilter · TextFilter); the rows, the TOTAL row, the
 * coverage, the summary and the CSV follow in the section. The popover is
 * fixed under its ▾ (the anchor the section hands it) — so the table's scroll
 * box never clips it — and follows the ▾ on every scroll and resize; it closes
 * on "close", Escape, or a click outside. Every word is ledger.ts's. Nothing
 * is stored in the browser.
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ALL_WORDS, BLANK_CHOICE_WORDS, CLOSE_FILTER_WORDS, CONTAINS_WORDS, MAX_WORDS, MIN_WORDS, NARROW_FROM, NARROW_WORDS, NONE_WORDS,
  boundCentsOf, boundDollarsOf, choiceWords, filterLabelWords, headWordOf,
  type ColumnValue, type LedgerColumn, type MoneyFilter, type TextFilter, type ValueFilter,
} from '@/lib/operations/ledger';

const link = 'underline text-brand-purple hover:text-text-primary';
const box = 'px-1.5 py-0.5 border border-border rounded text-xs';
const chip = 'px-2 py-0.5 border border-border rounded hover:bg-bg-row text-xs';

/** Where the popover sits: just under its ▾'s left corner, in viewport coordinates (it is position: fixed) — pulled left so its widest (POPOVER_WIDTH) stays on screen. */
export interface PopoverAt { readonly left: number; readonly top: number }
export const POPOVER_WIDTH = 352;
export const below = (anchor: HTMLElement): PopoverAt => { const r = anchor.getBoundingClientRect(); return { left: Math.max(8, Math.min(r.left, window.innerWidth - POPOVER_WIDTH - 8)), top: r.bottom + 2 }; };

export type ColumnFilterProps = { readonly column: LedgerColumn; readonly anchor: HTMLElement; readonly onClose: () => void } & (
  | { readonly kind: 'value'; readonly values: readonly ColumnValue[]; readonly filter: ValueFilter; readonly onChange: (filter: ValueFilter) => void }
  | { readonly kind: 'money'; readonly filter: MoneyFilter; readonly onChange: (filter: MoneyFilter) => void }
  | { readonly kind: 'text'; readonly filter: TextFilter; readonly onChange: (filter: TextFilter) => void }
);

function ValueBody({ values, filter, onChange }: { values: readonly ColumnValue[]; filter: ValueFilter; onChange: (filter: ValueFilter) => void }) {
  const [narrow, setNarrow] = useState('');
  const needle = narrow.trim().toLowerCase();
  const listed = needle === '' ? values : values.filter((v) => choiceWords(v.key).toLowerCase().includes(needle));
  const tick = (key: string, on: boolean) => onChange({ dropped: on ? filter.dropped.filter((k) => k !== key) : [...filter.dropped, key] });
  return (
    <>
      <div className="flex items-center gap-2">
        <button type="button" className={link} onClick={() => onChange({ dropped: [] })} data-ledger-choice-all>{ALL_WORDS}</button>
        <button type="button" className={link} onClick={() => onChange({ dropped: values.map((v) => v.key) })} data-ledger-choice-none>{NONE_WORDS}</button>
      </div>
      {values.length > NARROW_FROM && <input type="text" value={narrow} onChange={(e) => setNarrow(e.target.value)} placeholder={NARROW_WORDS} aria-label={NARROW_WORDS} className={`${box} w-full`} data-ledger-narrow />}
      <ul className="max-h-64 overflow-y-auto space-y-0.5" data-ledger-choices>
        {listed.map((v) => (
          <li key={v.key}>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={!filter.dropped.includes(v.key)} onChange={(e) => tick(v.key, e.target.checked)} data-ledger-choice={v.key} />
              <span className={v.key === BLANK_CHOICE_WORDS || choiceWords(v.key) === BLANK_CHOICE_WORDS ? 'text-text-faint' : ''} data-ledger-choice-words>{choiceWords(v.key)}</span>
              <span className="text-text-faint tabular-nums" data-ledger-choice-count>{v.count}</span>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}

function MoneyBody({ filter, onChange }: { filter: MoneyFilter; onChange: (filter: MoneyFilter) => void }) {
  const [min, setMin] = useState(() => boundDollarsOf(filter.minCents));
  const [max, setMax] = useState(() => boundDollarsOf(filter.maxCents));
  const [words, setWords] = useState<string | null>(null);
  const bound = (which: 'minCents' | 'maxCents', typed: string) => {
    (which === 'minCents' ? setMin : setMax)(typed);
    const read = boundCentsOf(typed);
    if (!read.ok) { setWords(read.words); return; }
    setWords(null);
    onChange({ ...filter, [which]: read.cents });
  };
  return (
    <>
      <label className="flex items-center gap-1.5">
        <span className="text-text-faint w-12">{MIN_WORDS}</span>
        <input type="text" inputMode="decimal" value={min} onChange={(e) => bound('minCents', e.target.value)} className={`${box} w-24 font-mono`} data-ledger-min />
      </label>
      <label className="flex items-center gap-1.5">
        <span className="text-text-faint w-12">{MAX_WORDS}</span>
        <input type="text" inputMode="decimal" value={max} onChange={(e) => bound('maxCents', e.target.value)} className={`${box} w-24 font-mono`} data-ledger-max />
      </label>
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={filter.blank} onChange={(e) => onChange({ ...filter, blank: e.target.checked })} data-ledger-blank />
        <span className="text-text-faint">{BLANK_CHOICE_WORDS}</span>
      </label>
      {words !== null && <p className="text-brand-red" data-ledger-popover-words>{words}</p>}
    </>
  );
}

function TextBody({ filter, onChange }: { filter: TextFilter; onChange: (filter: TextFilter) => void }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-text-faint">{CONTAINS_WORDS}</span>
      <input type="text" value={filter.contains} onChange={(e) => onChange({ contains: e.target.value })} className={`${box} w-48`} data-ledger-contains />
    </label>
  );
}

export default function ColumnFilter(props: ColumnFilterProps) {
  const { column, anchor, onClose } = props;
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<PopoverAt>(() => below(anchor));
  // Closed by a click outside or Escape; on a scroll (the page's or the table's box, captured) or a resize it follows its ▾. Listeners only; nothing stored.
  useEffect(() => {
    const onDown = (e: MouseEvent) => { if (ref.current !== null && e.target instanceof Node && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    const follow = () => setAt(below(anchor));
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', follow, true);
    window.addEventListener('resize', follow);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); window.removeEventListener('scroll', follow, true); window.removeEventListener('resize', follow); };
  }, [anchor, onClose]);
  return (
    <div ref={ref} role="dialog" aria-label={filterLabelWords(headWordOf(column))} style={{ position: 'fixed', left: at.left, top: at.top }} className="z-30 min-w-[14rem] max-w-[22rem] bg-white border border-border rounded shadow-md p-2 space-y-1.5 text-xs text-text-primary normal-case tracking-normal font-normal text-left" data-ledger-popover={column}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-text-secondary" data-ledger-popover-head>{headWordOf(column)}</span>
        <button type="button" className={chip} onClick={onClose} data-ledger-popover-close>{CLOSE_FILTER_WORDS}</button>
      </div>
      {props.kind === 'value' && <ValueBody values={props.values} filter={props.filter} onChange={props.onChange} />}
      {props.kind === 'money' && <MoneyBody filter={props.filter} onChange={props.onChange} />}
      {props.kind === 'text' && <TextBody filter={props.filter} onChange={props.onChange} />}
    </div>
  );
}
