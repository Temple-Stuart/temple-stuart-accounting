/**
 * ColumnBox — THE ONE BOX OF A COLUMN of the time sheet (EDIT-01, Alex, 2026-11-28: "built like an excel table. Filterable, Editable, so I can
 * clean my data !!!").
 *
 * Lifted from the "+ expense" blank row (ExpenseForm.tsx ExpenseRow — its boxes, as SHEET-01 drew them): the blank row draws it under every
 * column he types, and a cell of the sheet draws it when it opens (LedgerSection.tsx) — one renderer, one set of words, one data attribute per
 * column. Each box is labelled by its column's own word (ledger.ts EXPENSE_FIELD_WORDS, ROW_TRIP_FIELD_WORDS; WENT — the sheet's alone, the
 * blank row draws none — by its head word) and carries data-ledger-expense-box with its field's name, as the blank row's boxes always did.
 * CATEGORY is the book's chart (routines/CoaSelect.tsx) inside a group that carries the box's word — CoaSelect takes no label of its own, nor
 * an open cell's keys or its leaving, so the group carries those too. ENTITY is the books, each by its sheet word — EDIT-04 (2026-11-29): on a
 * row whose CATEGORY holds a code, each other book's accounts under it (EntityAccountSelect.tsx), the CATEGORY picked there. VENDOR is ONE typed box over
 * the book's vendors (a datalist, its id the caller's). WENT is a choice: went · skipped · none.
 *
 * The value is the caller's text, handed back whole on every change; the box reads nothing, writes nothing and stores nothing. An open cell
 * hands it its keys (Enter, Tab, Esc), its leaving and its focus; the blank row hands none — it draws exactly what it drew.
 */

'use client';

import { useEffect, useRef, type KeyboardEvent } from 'react';
import { BOOK_WORDS, CELL_WENT_NONE_WORDS, EXPENSE_FIELD_WORDS, LOCATION_CLASSES, LOCATION_WORDS, NO_LOCATION_WORDS, ROW_TRIP_FIELD_WORDS, WENT_WORD, headWordOf } from '@/lib/operations/ledger';
import { SKIPPED_WORD } from '@/lib/operations/stopRecord';
import type { PasteVendor } from '@/lib/operations/pasteRows';
import type { Entity } from '../EntitySelector';
import CoaSelect from '../routines/CoaSelect';
import EntityAccountSelect from './EntityAccountSelect';

/** A box in a cell: it takes the cell's width. */
const box = 'w-full min-w-[3.5rem] px-1 py-0.5 border border-border rounded text-xs bg-white';
const clockBox = `${box} font-mono tabular-nums`;

/** The columns that have a box — every column he types, and the blank row's DATE, ENTITY and the trip's three. */
export type BoxColumn = 'date' | 'start' | 'end' | 'city' | 'region' | 'country' | 'location' | 'accountName' | 'book' | 'subAccountName' | 'description' | 'vendor' | 'instagramTag' | 'went' | 'stars' | 'loggedMinutes' | 'budget' | 'actual' | 'notes';

export interface ColumnBoxProps {
  readonly column: BoxColumn;
  /** The box's text, as typed. */
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** CATEGORY: the book whose chart it lists ('' — none yet: no account to pick). */
  readonly entityId?: string;
  /** ENTITY: the books, each named by its sheet word. */
  readonly books?: readonly Entity[];
  /** ENTITY (EDIT-04, 2026-11-29): the row's CATEGORY code — an open cell hands it; with one, each other book's accounts are listed under it. The blank row hands none. */
  readonly code?: string;
  /** VENDOR: the book's vendors, listed under the box, and the list's id. */
  readonly vendors?: readonly PasteVendor[];
  readonly listId?: string;
  /** An open cell's keys and its leaving, and its focus when it opens — the sheet's cell hands them; the blank row hands none. */
  readonly onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  readonly onBlur?: () => void;
  readonly autoFocus?: boolean;
}

/** A book by its sheet word — "word — name" when two books share a type; its own name when its type has no word (SHEET-01's rule, from the blank row). */
const bookWordsOf = (books: readonly Entity[]) => (e: Entity): string => {
  const word = (BOOK_WORDS as Readonly<Record<string, string | undefined>>)[e.entity_type];
  if (word === undefined) return e.name;
  return books.filter((other) => other.entity_type === e.entity_type).length > 1 ? `${word} — ${e.name}` : word;
};

export default function ColumnBox({ column, value, onChange, entityId, books, code, vendors, listId, onKeyDown, onBlur, autoFocus }: ColumnBoxProps) {
  // CATEGORY's select is CoaSelect's own: an open cell focuses it through its group.
  const group = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (column === 'accountName' && autoFocus === true) group.current?.querySelector('select')?.focus();
  }, [column, autoFocus]);
  const keys = { onKeyDown, onBlur, autoFocus };
  switch (column) {
    case 'date': return <input type="date" value={value} onChange={(e) => onChange(e.target.value)} aria-label={EXPENSE_FIELD_WORDS.day} className={box} data-ledger-expense-box="day" {...keys} />;
    case 'start': return <input type="text" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} placeholder="HH:MM" maxLength={5} aria-label={EXPENSE_FIELD_WORDS.time} className={clockBox} data-ledger-expense-box="time" {...keys} />;
    case 'end': return <input type="text" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} placeholder="HH:MM" maxLength={5} aria-label={EXPENSE_FIELD_WORDS.end} className={clockBox} data-ledger-expense-box="end" {...keys} />;
    case 'city': return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} maxLength={80} aria-label={ROW_TRIP_FIELD_WORDS.city} className={box} data-ledger-expense-box="city" {...keys} />;
    case 'region': return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} maxLength={80} aria-label={ROW_TRIP_FIELD_WORDS.region} className={box} data-ledger-expense-box="region" {...keys} />;
    case 'country': return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} maxLength={80} aria-label={ROW_TRIP_FIELD_WORDS.country} className={box} data-ledger-expense-box="country" {...keys} />;
    case 'location': return <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={EXPENSE_FIELD_WORDS.location} className={box} data-ledger-expense-box="location" {...keys}><option value="">{NO_LOCATION_WORDS}</option>{LOCATION_CLASSES.map((c) => <option key={c} value={c}>{LOCATION_WORDS[c]}</option>)}</select>;
    case 'accountName': {
      if (entityId === undefined) throw new Error('ColumnBox: CATEGORY lists a book’s chart — no book was handed in');
      return <div ref={group} role="group" aria-label={EXPENSE_FIELD_WORDS.coa} data-ledger-expense-box="coa" onKeyDown={onKeyDown} onBlur={onBlur}><CoaSelect entityId={entityId} value={value} onChange={onChange} className={box} /></div>;
    }
    case 'book': {
      if (books === undefined || books.length === 0) throw new Error('ColumnBox: ENTITY lists the books — none were handed in');
      const bookWords = bookWordsOf(books);
      // EDIT-04 (2026-11-29): a row whose CATEGORY holds a code picks the CATEGORY in the new book; with no code, the books.
      if (code !== undefined && code !== '') return <EntityAccountSelect books={books} value={value} onChange={onChange} wordOf={bookWords} className={box} {...keys} />;
      return <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={EXPENSE_FIELD_WORDS.book} className={box} data-ledger-expense-box="book" {...keys}>{books.map((e) => <option key={e.id} value={e.id}>{bookWords(e)}</option>)}</select>;
    }
    case 'subAccountName': return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} maxLength={200} aria-label={EXPENSE_FIELD_WORDS.name} className={box} data-ledger-expense-box="name" {...keys} />;
    case 'description': return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} maxLength={280} aria-label={EXPENSE_FIELD_WORDS.note} className={box} data-ledger-expense-box="note" {...keys} />;
    case 'vendor': {
      if (vendors === undefined || listId === undefined) throw new Error('ColumnBox: VENDOR lists the book’s vendors — none were handed in');
      return (
        <>
          <input type="text" list={listId} value={value} onChange={(e) => onChange(e.target.value)} aria-label={EXPENSE_FIELD_WORDS.vendor} className={box} data-ledger-expense-box="vendor" {...keys} />
          <datalist id={listId} data-ledger-expense-vendors>{vendors.map((v) => <option key={v.id} value={v.vendor_name} />)}</datalist>
        </>
      );
    }
    case 'instagramTag': return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} maxLength={31} aria-label={EXPENSE_FIELD_WORDS.tag} className={box} data-ledger-expense-box="tag" {...keys} />;
    case 'went': return <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={headWordOf('went')} className={box} data-ledger-expense-box="went" {...keys}><option value={WENT_WORD}>{WENT_WORD}</option><option value={SKIPPED_WORD}>{SKIPPED_WORD}</option><option value="">{CELL_WENT_NONE_WORDS}</option></select>;
    case 'stars': return <input type="text" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} maxLength={1} aria-label={EXPENSE_FIELD_WORDS.stars} className={box} data-ledger-expense-box="stars" {...keys} />;
    case 'loggedMinutes': return <input type="text" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} aria-label={EXPENSE_FIELD_WORDS.logged} className={clockBox} data-ledger-expense-box="logged" {...keys} />;
    case 'budget': return <input type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} aria-label={EXPENSE_FIELD_WORDS.amount} className={clockBox} data-ledger-expense-box="amount" {...keys} />;
    case 'actual': return <input type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} aria-label={EXPENSE_FIELD_WORDS.actual} className={clockBox} data-ledger-expense-box="actual" {...keys} />;
    case 'notes': return <input type="text" value={value} onChange={(e) => onChange(e.target.value)} aria-label={EXPENSE_FIELD_WORDS.notes} className={box} data-ledger-expense-box="notes" {...keys} />;
    default: { const none: never = column; throw new Error(`ColumnBox: no box for the column ${String(none)}`); }
  }
}
