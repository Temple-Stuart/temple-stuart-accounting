/**
 * What THE WORK and ROUTINE EXPENSES share on the screen (WORK-01d, Alex, 2026-10-25):
 * the one GET helper, each book's chart (for the ACCOUNT column's names and the
 * task forms' category lists) and the cell as the spec prints it. Pure helpers and
 * one hook — no table, no words of its own.
 */

'use client';

import { useEffect, useState } from 'react';
import { cellClass as cell, moneyClass } from '@/components/table/DataTable';
import { dataAttr } from '@/components/table/dataAttr';
import type { TableColumn } from '@/lib/table/columns';
import { BLANK } from '@/lib/table/words';
import type { Entity } from './EntitySelector';
import type { CoaAccountSummary } from './projects/types';
import type { WorkCharts } from '@/lib/operations/work';

export type ChartsRead =
  | { readonly kind: 'loading' }
  | { readonly kind: 'failed'; readonly words: string }
  | { readonly kind: 'loaded'; readonly charts: WorkCharts };

/** One GET, its body, or the route's own words thrown. */
export async function readJson(url: string, what: string): Promise<Record<string, unknown>> {
  const res = await fetch(url);
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(body?.message ?? body?.error ?? `${what}: HTTP ${res.status}`));
  return body;
}

/** Each book's chart — once per entity list; a failed read is said, never an empty chart. */
export function useBookCharts(entities: readonly Entity[]): ChartsRead {
  const [chartsRead, setChartsRead] = useState<ChartsRead>({ kind: 'loading' });
  useEffect(() => {
    let live = true;
    setChartsRead({ kind: 'loading' });
    (async () => {
      try {
        const pairs = await Promise.all(entities.map(async (e) => {
          const body = await readJson(`/api/chart-of-accounts?entity_id=${encodeURIComponent(e.id)}`, `chart of ${e.name}`);
          type CoaResponseRow = { code: string; name: string; accountType: string; entity_id: string };
          const list: CoaAccountSummary[] = ((body.accounts ?? []) as CoaResponseRow[]).map((a) => ({ code: a.code, name: a.name, account_type: a.accountType, entity_id: a.entity_id }));
          return [e.id, list] as const;
        }));
        if (live) setChartsRead({ kind: 'loaded', charts: Object.fromEntries(pairs) });
      } catch (e) {
        if (live) setChartsRead({ kind: 'failed', words: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => { live = false; };
  }, [entities]);
  return chartsRead;
}

/** One cell as the spec prints it — money right-aligned, a blank faint, a text column wrapping; `title` (PROJECTS-02) is the cell's tooltip, when the caller has one. */
export function WorkCell<Row, Key extends string>({ name, column, row, title }: { name: string; column: TableColumn<Row, Key>; row: Row; title?: string }) {
  const words = column.words(row);
  // ROUTINES-03 (Alex, 2026-10-25): the ID column is monospace.
  const className = column.kind === 'money' ? moneyClass : column.key === 'id' ? `${cell} font-mono whitespace-nowrap` : column.kind === 'text' ? `${cell} max-w-[24rem] break-words` : `${cell} whitespace-nowrap`;
  return <td className={`${className} ${words === BLANK ? 'text-text-faint' : ''}`} title={title} {...dataAttr(name, 'cell', column.key)}>{words}</td>;
}
