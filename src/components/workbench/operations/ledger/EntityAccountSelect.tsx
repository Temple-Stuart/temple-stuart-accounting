'use client';

/**
 * EntityAccountSelect — ENTITY'S BOX ON A ROW WITH A CATEGORY (EDIT-04, Alex, 2026-11-29). No account number carries over by itself: two
 * books may give one number to two different accounts, so a row that names a CATEGORY moves to another book with the CATEGORY picked there.
 *
 * ONE select. First the row's own book — its sheet word, the value the box opens with (moving nowhere). Then, for each other book, a group
 * under its sheet word holding that book's chart as CATEGORY's box lists it (GET /api/chart-of-accounts?entity_id= — routines/CoaSelect.tsx's
 * own read; "CODE — Name", open accounts). Each option's value names the book and the code (ledger.ts entityPickValue), read back by ONE
 * function (ledger.ts entityPickOf). A group is never empty: a chart still being read says so; one read and holding no open account says so;
 * one that cannot be read says so — "…could not be read — reload to move this row there" — never a silent empty group (CoaSelect answers an
 * unread chart as none; that is not copied). ColumnBox draws this box when an open cell hands it the row's code; with none, the books.
 *
 * The value is the caller's text, handed back whole on every change; the box reads the charts and nothing else, writes nothing, stores nothing.
 */

import { useEffect, useState, type KeyboardEvent } from 'react';
import { ENTITY_CHART_EMPTY_WORDS, ENTITY_CHART_READING_WORDS, ENTITY_CHART_UNREAD_WORDS, EXPENSE_FIELD_WORDS, entityPickValue } from '@/lib/operations/ledger';
import type { Entity } from '../EntitySelector';

/** An account of a book's chart as CATEGORY's box lists it. */
interface ChartAccount {
  readonly code: string;
  readonly name: string;
}
/** Another book's chart: being read, read, or not readable — each said in its group. */
type Chart = { readonly kind: 'reading' } | { readonly kind: 'read'; readonly accounts: readonly ChartAccount[] } | { readonly kind: 'unread' };

export interface EntityAccountSelectProps {
  /** The books, each named by its sheet word (wordOf). */
  readonly books: readonly Entity[];
  /** The box's value — the row's own book when it opens; then the pick (ledger.ts entityPickValue). */
  readonly value: string;
  readonly onChange: (value: string) => void;
  /** A book's sheet word — ColumnBox's bookWordsOf, the one rule. */
  readonly wordOf: (e: Entity) => string;
  readonly className: string;
  readonly onKeyDown?: (e: KeyboardEvent<HTMLElement>) => void;
  readonly onBlur?: () => void;
  readonly autoFocus?: boolean;
}

/** One chart, read as CATEGORY's box reads it — an answer that is not one is the read's failure, never an empty chart. */
async function readChart(entityId: string): Promise<readonly ChartAccount[]> {
  const res = await fetch(`/api/chart-of-accounts?entity_id=${encodeURIComponent(entityId)}`);
  if (!res.ok) throw new Error(`the chart route answered ${res.status}`);
  const body = (await res.json()) as { accounts?: unknown };
  if (!Array.isArray(body.accounts)) throw new Error('the chart route answered no list of accounts');
  return body.accounts.map((a: { code?: unknown; name?: unknown }) => {
    if (typeof a.code !== 'string' || typeof a.name !== 'string') throw new Error('the chart route answered an account with no code or name');
    return { code: a.code, name: a.name };
  });
}

export default function EntityAccountSelect({ books, value, onChange, wordOf, className, onKeyDown, onBlur, autoFocus }: EntityAccountSelectProps) {
  // The row's own book: the value the box opened with — first, and moving nowhere.
  const [own] = useState(value);
  const ownBook = books.find((e) => e.id === own);
  if (ownBook === undefined) throw new Error(`EntityAccountSelect: the row's book ${own} is not one of the books handed in`);
  const others = books.filter((e) => e.id !== own);
  const otherIds = others.map((e) => e.id).join(' ');
  const [charts, setCharts] = useState<Readonly<Record<string, Chart>>>({});
  useEffect(() => {
    let cancelled = false;
    for (const id of otherIds === '' ? [] : otherIds.split(' ')) {
      setCharts((held) => ({ ...held, [id]: { kind: 'reading' } }));
      readChart(id).then(
        (accounts) => { if (!cancelled) setCharts((held) => ({ ...held, [id]: { kind: 'read', accounts } })); },
        () => { if (!cancelled) setCharts((held) => ({ ...held, [id]: { kind: 'unread' } })); },
      );
    }
    return () => { cancelled = true; };
  }, [otherIds]);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label={EXPENSE_FIELD_WORDS.book} className={className} data-ledger-expense-box="book" data-ledger-entity-accounts onKeyDown={onKeyDown} onBlur={onBlur} autoFocus={autoFocus}>
      <option value={entityPickValue(own, null)}>{wordOf(ownBook)}</option>
      {others.map((book) => {
        const word = wordOf(book);
        const chart = charts[book.id];
        return (
          <optgroup key={book.id} label={word} data-ledger-entity-book={book.id}>
            {chart === undefined || chart.kind === 'reading' ? <option value="" disabled>{ENTITY_CHART_READING_WORDS(word)}</option>
              : chart.kind === 'unread' ? <option value="" disabled data-ledger-chart-unread>{ENTITY_CHART_UNREAD_WORDS(word)}</option>
                : chart.accounts.length === 0 ? <option value="" disabled>{ENTITY_CHART_EMPTY_WORDS(word)}</option>
                  : chart.accounts.map((a) => <option key={a.code} value={entityPickValue(book.id, a.code)}>{`${a.code} — ${a.name}`}</option>)}
          </optgroup>
        );
      })}
    </select>
  );
}
