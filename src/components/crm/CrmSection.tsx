'use client';

/**
 * CRM-01a (Alex, 2026-11-06, rulings B and D) — THE CRM: THE PEOPLE YOU SELL TO, IN THREE FLAT TABLES.
 *
 * One read (GET /api/crm — src/lib/crm/crm.ts builds the rows) and three shared DataTables (IDIOM-01), in this order:
 *   CONTACTS  — one row per contact, newest first: every proposal and every signup, and the contacts you work by hand;
 *   PROPOSALS — every answer from the form, as it came in;
 *   SIGNUPS   — the fields collected at signup, every account but your own.
 * The platform owner sees every proposal and every signup; anyone else sees the honest lines for those two tables
 * and their own Contacts line (the answer says ownerOnly; the CRM-01a fix, ruling B). Every word is src/lib/crm/crmWords.ts's and every cell the spec's (contactsTable,
 * proposalsTable, signupsTable) — none typed here, no formatter here. A table scrolls sideways in its own box; the page
 * never does. Reads only: no stage control, no "add" (CRM-01b). A failed read says so with the route's words. Nothing
 * is stored in the browser; React state only — the read, and each table's filters, sort and open filter.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import DataTable from '@/components/table/DataTable';
import { dataAttr } from '@/components/table/dataAttr';
import { WorkCell, readJson } from '@/components/workbench/operations/workShared';
import { filterRows, noFilters, type TableFilters } from '@/lib/table/filters';
import { sortRows, type TableSort } from '@/lib/table/sort';
import type { TableColumn } from '@/lib/table/columns';
import { rowCountWords } from '@/lib/operations/work';
import {
  CRM_CONTACTS_CSV, CRM_CONTACTS_TABLE_NAME, CRM_PROPOSALS_CSV, CRM_PROPOSALS_TABLE_NAME, CRM_SIGNUPS_CSV, CRM_SIGNUPS_TABLE_NAME,
  contactsTable, proposalsTable, signupsTable, type ContactRow, type ProposalRow, type SignupRow,
} from '@/lib/crm/crm';
import {
  CONTACTS_TABLE_WORDS, CRM_LOADING_WORDS, NO_CONTACTS_OWN_WORDS, NO_CONTACTS_WORDS, NO_PROPOSALS_WORDS, NO_SIGNUPS_WORDS,
  PROPOSALS_OWNER_ONLY_WORDS, PROPOSALS_TABLE_WORDS, SIGNUPS_OWNER_ONLY_WORDS, SIGNUPS_TABLE_WORDS, crmFailedWords,
} from '@/lib/crm/crmWords';

/** One loaded answer from GET /api/crm. */
export interface CrmLoaded {
  readonly kind: 'loaded';
  readonly ownerOnly: boolean;
  readonly contacts: readonly ContactRow[];
  readonly proposals: readonly ProposalRow[];
  readonly signups: readonly SignupRow[];
  readonly said: readonly string[];
}

type CrmRead = { readonly kind: 'loading' } | { readonly kind: 'failed'; readonly words: string } | CrmLoaded;

/** One table: its name, the shared DataTable over the spec, its own filters and sort, the line when it has no row. */
function CrmTable<Row, Key extends string>({ name, title, columns, rows, keyOf, csvName, tableClassName, empty }: {
  name: string;
  title: string;
  columns: readonly TableColumn<Row, Key>[];
  rows: readonly Row[];
  keyOf: (row: Row) => string;
  csvName: string;
  tableClassName: string;
  empty: ReactNode;
}) {
  const off = useMemo(() => noFilters(columns), [columns]);
  const [filters, setFilters] = useState<TableFilters>(off);
  const [sort, setSort] = useState<TableSort<Key> | null>(null);
  const [openFilter, setOpenFilter] = useState<Key | null>(null);
  const shown = sortRows(filterRows(rows, filters, columns), sort, columns);
  const renderRow = (row: Row) => (
    <tr key={keyOf(row)} className="border-t border-border" {...dataAttr(name, 'row', keyOf(row))}>
      {columns.map((column) => <WorkCell key={column.key} name={name} column={column} row={row} />)}
    </tr>
  );
  return (
    <section className="min-w-0 space-y-2" {...dataAttr(name, 'section')}>
      <h2 className="text-sm font-semibold text-text-primary" {...dataAttr(name, 'title')}>{title}</h2>
      <DataTable
        name={name}
        columns={columns}
        rows={rows}
        shown={shown}
        loaded
        tableClassName={tableClassName}
        filters={filters}
        onFilters={setFilters}
        noFilters={off}
        sort={sort}
        onSort={setSort}
        openFilter={openFilter}
        onOpenFilter={setOpenFilter}
        csv={shown.length > 0 ? { name: csvName } : null}
        controls={null}
        renderRow={renderRow}
        foot={null}
      >
        {rows.length === 0 && <div className="text-xs text-text-muted" {...dataAttr(name, 'none')}>{empty}</div>}
      </DataTable>
      {rows.length > 0 && <p className="text-xs text-text-muted" {...dataAttr(name, 'count')}>{rowCountWords(shown.length, rows.length)}</p>}
    </section>
  );
}

export default function CrmSection() {
  const [read, setRead] = useState<CrmRead>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    readJson('/api/crm', 'The CRM')
      .then((body) => {
        if (!live) return;
        setRead({
          kind: 'loaded',
          ownerOnly: body.ownerOnly === true,
          contacts: (body.contacts ?? []) as ContactRow[],
          proposals: (body.proposals ?? []) as ProposalRow[],
          signups: (body.signups ?? []) as SignupRow[],
          said: (body.said ?? []) as string[],
        });
      })
      .catch((e: unknown) => { if (live) setRead({ kind: 'failed', words: e instanceof Error ? e.message : String(e) }); });
    return () => { live = false; };
  }, []);

  if (read.kind === 'loading') return <div className="text-xs text-text-muted" data-crm-loading>{CRM_LOADING_WORDS}</div>;
  if (read.kind === 'failed') return <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" data-crm-failed>{crmFailedWords(read.words)}</div>;
  return <CrmTables read={read} />;
}

/**
 * The three tables over ONE loaded answer — its own component (the CRM-01a fix, ruling B) so a test renders the member's
 * view and the owner's without a fetch. The Contacts line follows ownerOnly: the platform owner's (NO_CONTACTS_WORDS),
 * or anyone else's (NO_CONTACTS_OWN_WORDS) — the owner's sentence is false for anyone else.
 */
export function CrmTables({ read }: { read: CrmLoaded }) {
  const contactColumns = useMemo(() => contactsTable(), []);
  const proposalColumns = useMemo(() => proposalsTable(), []);
  const signupColumns = useMemo(() => signupsTable(), []);
  return (
    <div className="min-w-0 space-y-6" data-crm={read.ownerOnly ? 'own' : 'owner'}>
      <CrmTable
        name={CRM_CONTACTS_TABLE_NAME}
        title={CONTACTS_TABLE_WORDS}
        columns={contactColumns}
        rows={read.contacts}
        keyOf={(r) => r.key}
        csvName={CRM_CONTACTS_CSV}
        tableClassName="min-w-[90rem]"
        empty={read.ownerOnly ? NO_CONTACTS_OWN_WORDS : NO_CONTACTS_WORDS}
      />
      <CrmTable
        name={CRM_PROPOSALS_TABLE_NAME}
        title={PROPOSALS_TABLE_WORDS}
        columns={proposalColumns}
        rows={read.proposals}
        keyOf={(r) => r.id}
        csvName={CRM_PROPOSALS_CSV}
        tableClassName="min-w-[140rem]"
        empty={read.ownerOnly ? PROPOSALS_OWNER_ONLY_WORDS : NO_PROPOSALS_WORDS}
      />
      <CrmTable
        name={CRM_SIGNUPS_TABLE_NAME}
        title={SIGNUPS_TABLE_WORDS}
        columns={signupColumns}
        rows={read.signups}
        keyOf={(r) => r.id}
        csvName={CRM_SIGNUPS_CSV}
        tableClassName="min-w-[60rem]"
        empty={read.ownerOnly ? SIGNUPS_OWNER_ONLY_WORDS : NO_SIGNUPS_WORDS}
      />
      {read.said.length > 0 && (
        <ul className="text-xs text-amber-800 space-y-0.5" data-crm-said>
          {read.said.map((words, i) => <li key={i}>{words}</li>)}
        </ul>
      )}
    </div>
  );
}
