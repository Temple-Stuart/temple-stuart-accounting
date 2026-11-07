'use client';

/**
 * CRM-01a (Alex, 2026-11-06, rulings B and D; CRM-01b, 2026-11-07, ruling B) — THE CRM: THE PEOPLE YOU SELL TO, IN THREE
 * FLAT TABLES, AND THE ROW'S TWO CONTROLS.
 *
 * One read (GET /api/crm — src/lib/crm/crm.ts builds the rows) and three shared DataTables (IDIOM-01), in this order:
 *   CONTACTS  — one row per contact, newest first: every proposal and every signup, and the contacts you work by hand;
 *   PROPOSALS — every answer from the form, as it came in;
 *   SIGNUPS   — the fields collected at signup, every account but your own.
 * The platform owner sees every proposal and every signup; anyone else sees the honest lines for those two tables
 * and their own Contacts line (the answer says ownerOnly; the CRM-01a fix, ruling B). Every word is src/lib/crm/crmWords.ts's
 * and every cell the spec's (contactsTable, proposalsTable, signupsTable) — none typed here, no formatter here. A table
 * scrolls sideways in its own box; the page never does.
 *
 * THE WRITES (CRM-01b): on a Contacts row the Stage cell is a <select> and the Next step cell an <input> — both wear the
 * house's one field class, CONTROL.input (ds.ts has no select class; ruling B, corrected). A change → PATCH /api/crm/contacts
 * → the table re-reads (the bill-pay idiom: after a write the table re-reads; React state only). "Add a contact" in the
 * Contacts controls opens, above the table, one row of three inputs and Add / Cancel → POST → re-read → the row closes. A
 * write that fails prints the route's words in a line under the table (data-crm-write-failed), never swallowed; the row
 * keeps the server's value (the re-read), never the typed one. Nothing is stored in the browser.
 *
 * CRM-02 (Alex, 2026-11-07, CLOSED 7): the order, top to bottom — YOUR INTAKE FORM (IntakeFormSetup.tsx, fed by the GET's
 * `form`; its save is a write, so it re-reads too) · Contacts · FORM SUBMISSIONS (a fourth CrmTable over the GET's
 * `submissions`, its columns src/lib/crm/forms.ts submissionsTable(form) — one per question the form holds today) ·
 * Proposals · Signups. A submission is a Contacts row too (from "Your form").
 */
import { useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';
import DataTable, { cellClass, chipClass } from '@/components/table/DataTable';
import { dataAttr } from '@/components/table/dataAttr';
import { WorkCell, readJson } from '@/components/workbench/operations/workShared';
import { CONTROL } from '@/lib/ds';
import { filterRows, noFilters, type TableFilters } from '@/lib/table/filters';
import { sortRows, type TableSort } from '@/lib/table/sort';
import type { TableColumn } from '@/lib/table/columns';
import { rowCountWords } from '@/lib/operations/work';
import {
  CRM_CONTACTS_CSV, CRM_CONTACTS_TABLE_NAME, CRM_NEXT_STEP_MAX, CRM_PROPOSALS_CSV, CRM_PROPOSALS_TABLE_NAME, CRM_SIGNUPS_CSV, CRM_SIGNUPS_TABLE_NAME,
  CRM_STAGES, contactsTable, proposalsTable, signupsTable, type ContactRow, type CrmStage, type ProposalRow, type SignupRow,
} from '@/lib/crm/crm';
import {
  ADD_CONTACT_LABELS, ADD_CONTACT_WORDS, ADD_WORDS, CANCEL_WORDS, CONTACTS_TABLE_WORDS, CRM_LOADING_WORDS, NO_CONTACTS_OWN_WORDS, NO_CONTACTS_WORDS,
  NO_PROPOSALS_WORDS, NO_SIGNUPS_WORDS, PROPOSALS_OWNER_ONLY_WORDS, PROPOSALS_TABLE_WORDS, SIGNUPS_OWNER_ONLY_WORDS, SIGNUPS_TABLE_WORDS, STAGE_WORDS,
  crmFailedWords, crmWriteFailedWords, nextStepAriaWords, stageAriaWords,
} from '@/lib/crm/crmWords';
import { SUBMISSIONS_CSV, SUBMISSIONS_TABLE_NAME, submissionsTable, type IntakeForm, type SubmissionRow } from '@/lib/crm/forms';
import { FORM_SUBMISSIONS_TABLE_WORDS, NO_FORM_YET_WORDS, NO_SUBMISSIONS_WORDS } from '@/lib/crm/formWords';
import IntakeFormSetup from './IntakeFormSetup';

/** One loaded answer from GET /api/crm. CRM-02: the reader's own form (null before it is made) and its submissions. */
export interface CrmLoaded {
  readonly kind: 'loaded';
  readonly ownerOnly: boolean;
  readonly contacts: readonly ContactRow[];
  readonly form: IntakeForm | null;
  readonly submissions: readonly SubmissionRow[];
  readonly proposals: readonly ProposalRow[];
  readonly signups: readonly SignupRow[];
  readonly said: readonly string[];
}

type CrmRead = { readonly kind: 'loading' } | { readonly kind: 'failed'; readonly words: string } | CrmLoaded;

const CRM_CONTACTS_ROUTE = '/api/crm/contacts';

/** One write — PATCH or POST /api/crm/contacts, its body; the route's own words thrown on a miss (readJson's shape). */
async function sendJson(method: 'PATCH' | 'POST', body: unknown): Promise<void> {
  const res = await fetch(CRM_CONTACTS_ROUTE, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const answer = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(String(answer.message ?? answer.error ?? `HTTP ${res.status}`));
}

/** One table: its name, the shared DataTable over the spec, its own filters and sort, the line when it has no row. */
function CrmTable<Row, Key extends string>({ name, title, columns, rows, keyOf, csvName, tableClassName, empty, controls = null, above = null, under = null, cell }: {
  name: string;
  title: string;
  columns: readonly TableColumn<Row, Key>[];
  rows: readonly Row[];
  keyOf: (row: Row) => string;
  csvName: string;
  tableClassName: string;
  empty: ReactNode;
  /** The caller's controls in the DataTable's controls row (CRM-01b: the Contacts table's "Add a contact"). */
  controls?: ReactNode;
  /** Between the controls row and the table (CRM-01b: the add row). */
  above?: ReactNode;
  /** Under the table (CRM-01b: the failed-write line). */
  under?: ReactNode;
  /** A cell drawn by the caller instead of the spec's WorkCell (CRM-01b: the Stage select, the Next step input); undefined → the spec's. */
  cell?: (column: TableColumn<Row, Key>, row: Row) => ReactNode | undefined;
}) {
  const off = useMemo(() => noFilters(columns), [columns]);
  const [filters, setFilters] = useState<TableFilters>(off);
  const [sort, setSort] = useState<TableSort<Key> | null>(null);
  const [openFilter, setOpenFilter] = useState<Key | null>(null);
  const shown = sortRows(filterRows(rows, filters, columns), sort, columns);
  const renderRow = (row: Row) => (
    <tr key={keyOf(row)} className="border-t border-border" {...dataAttr(name, 'row', keyOf(row))}>
      {columns.map((column) => {
        const own = cell?.(column, row);
        return own !== undefined ? own : <WorkCell key={column.key} name={name} column={column} row={row} />;
      })}
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
        controls={controls}
        renderRow={renderRow}
        foot={null}
      >
        {above}
        {rows.length === 0 && <div className="text-xs text-text-muted" {...dataAttr(name, 'none')}>{empty}</div>}
      </DataTable>
      {rows.length > 0 && <p className="text-xs text-text-muted" {...dataAttr(name, 'count')}>{rowCountWords(shown.length, rows.length)}</p>}
      {under}
    </section>
  );
}

/**
 * The Next step cell's input (CRM-01b, ruling B): holds the row's next step; saved on blur or Enter when changed — an
 * empty box saves null; Escape restores the server's value. Keyed by the server's value in the parent, so a re-read resets it.
 */
function NextStepInput({ row, disabled, onSave }: { row: ContactRow; disabled: boolean; onSave: (value: string | null) => void }) {
  const [draft, setDraft] = useState(row.next_step ?? '');
  const commit = () => {
    const trimmed = draft.trim();
    const value = trimmed === '' ? null : trimmed;
    if (value !== row.next_step) onSave(value);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); setDraft(row.next_step ?? ''); }
  };
  return (
    <input
      type="text"
      className={`${CONTROL.input} w-full min-w-[16rem]`}
      value={draft}
      maxLength={CRM_NEXT_STEP_MAX}
      disabled={disabled}
      aria-label={nextStepAriaWords(row.name)}
      data-crm-next-step={row.key}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}

/** The add row (CRM-01b, ruling B): Name, Business, Email — the CONTROL family, the labels crmWords' — and Add / Cancel. */
export function AddContactRow({ disabled, onAdd, onCancel }: {
  disabled: boolean;
  onAdd: (draft: { readonly name: string; readonly business: string; readonly email: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [email, setEmail] = useState('');
  return (
    <form className="flex flex-wrap items-end gap-2 rounded border border-border bg-white p-3" data-crm-add-row onSubmit={(e) => { e.preventDefault(); onAdd({ name, business, email }); }}>
      <label className="flex flex-col gap-1">
        <span className={CONTROL.label}>{ADD_CONTACT_LABELS.name}</span>
        <input type="text" className={CONTROL.input} value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} required maxLength={255} data-crm-add-name />
      </label>
      <label className="flex flex-col gap-1">
        <span className={CONTROL.label}>{ADD_CONTACT_LABELS.business}</span>
        <input type="text" className={CONTROL.input} value={business} onChange={(e) => setBusiness(e.target.value)} disabled={disabled} maxLength={5000} data-crm-add-business />
      </label>
      <label className="flex flex-col gap-1">
        <span className={CONTROL.label}>{ADD_CONTACT_LABELS.email}</span>
        <input type="email" className={CONTROL.input} value={email} onChange={(e) => setEmail(e.target.value)} disabled={disabled} required maxLength={255} data-crm-add-email />
      </label>
      <button type="submit" className={CONTROL.primaryButton} disabled={disabled} data-crm-add-submit>{ADD_WORDS}</button>
      <button type="button" className={CONTROL.ghostButton} onClick={onCancel} disabled={disabled} data-crm-add-cancel>{CANCEL_WORDS}</button>
    </form>
  );
}

export default function CrmSection() {
  const [read, setRead] = useState<CrmRead>({ kind: 'loading' });
  // CRM-01b: a write re-reads (the bill-pay idiom, BillPaySection.tsx `[span, writes]`); React state only.
  const [writes, setWrites] = useState(0);

  useEffect(() => {
    let live = true;
    readJson('/api/crm', 'The CRM')
      .then((body) => {
        if (!live) return;
        setRead({
          kind: 'loaded',
          ownerOnly: body.ownerOnly === true,
          contacts: (body.contacts ?? []) as ContactRow[],
          form: (body.form ?? null) as IntakeForm | null,
          submissions: (body.submissions ?? []) as SubmissionRow[],
          proposals: (body.proposals ?? []) as ProposalRow[],
          signups: (body.signups ?? []) as SignupRow[],
          said: (body.said ?? []) as string[],
        });
      })
      .catch((e: unknown) => { if (live) setRead({ kind: 'failed', words: e instanceof Error ? e.message : String(e) }); });
    return () => { live = false; };
  }, [writes]);

  if (read.kind === 'loading') return <div className="text-xs text-text-muted" data-crm-loading>{CRM_LOADING_WORDS}</div>;
  if (read.kind === 'failed') return <div className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" data-crm-failed>{crmFailedWords(read.words)}</div>;
  return <CrmTables read={read} onWritten={() => setWrites((n) => n + 1)} />;
}

/**
 * The three tables over ONE loaded answer — its own component (the CRM-01a fix, ruling B) so a test renders the member's
 * view and the owner's without a fetch. The Contacts line follows ownerOnly: the platform owner's (NO_CONTACTS_WORDS),
 * or anyone else's (NO_CONTACTS_OWN_WORDS) — the owner's sentence is false for anyone else. CRM-01b: the Contacts row's
 * two controls and the add row write through sendJson; `onWritten` is the parent's re-read, called after every write,
 * failed or not — so the row always shows the server's value.
 */
export function CrmTables({ read, onWritten }: { read: CrmLoaded; onWritten: () => void }) {
  const contactColumns = useMemo(() => contactsTable(), []);
  // CRM-02: one column per question the form holds today — the spec follows the form. A table's filters and sort are
  // per column (CrmTable keeps them in state from its first columns; filterRows refuses a column it holds no filter for),
  // so when a save changes the form's questions the table is keyed by their ids and MOUNTS ANEW with the new columns —
  // never a stale filter map over a changed spec (the browser proof: a question added, then "no filter held for column").
  const submissionColumns = useMemo(() => submissionsTable(read.form), [read.form]);
  const submissionsKey = read.form === null ? 'no-form' : read.form.questions.map((q) => q.id).join(',');
  const proposalColumns = useMemo(() => proposalsTable(), []);
  const signupColumns = useMemo(() => signupsTable(), []);
  /** The key of the row (or 'add') being saved — every control is disabled meanwhile. */
  const [saving, setSaving] = useState<string | null>(null);
  /** The stage picked on the row being saved, shown until the re-read lands (never after a failure). */
  const [picked, setPicked] = useState<{ readonly key: string; readonly stage: CrmStage } | null>(null);
  const [writeFailed, setWriteFailed] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const write = async (what: string, run: () => Promise<void>): Promise<boolean> => {
    setSaving(what);
    try {
      await run();
      setWriteFailed(null);
      return true;
    } catch (e: unknown) {
      setWriteFailed(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setSaving(null);
      setPicked(null);
      onWritten();
    }
  };
  const patch = (key: string, body: { stage?: CrmStage; next_step?: string | null }) => write(key, () => sendJson('PATCH', { key, ...body }));
  const add = async (draft: { readonly name: string; readonly business: string; readonly email: string }) => {
    const business = draft.business.trim();
    const ok = await write('add', () => sendJson('POST', { name: draft.name, email: draft.email, ...(business === '' ? {} : { business }) }));
    if (ok) setAdding(false);
  };

  const contactCell = (column: TableColumn<ContactRow, string>, row: ContactRow): ReactNode | undefined => {
    if (column.key === 'stage') {
      const value = picked !== null && picked.key === row.key ? picked.stage : row.stage;
      return (
        <td key={column.key} className={`${cellClass} whitespace-nowrap`} {...dataAttr(CRM_CONTACTS_TABLE_NAME, 'cell', 'stage')}>
          <select
            className={CONTROL.input}
            value={value}
            disabled={saving !== null}
            aria-label={stageAriaWords(row.name)}
            data-crm-stage={row.key}
            onChange={(e) => {
              const stage = e.target.value as CrmStage;
              setPicked({ key: row.key, stage });
              void patch(row.key, { stage });
            }}
          >
            {CRM_STAGES.map((s) => <option key={s} value={s}>{STAGE_WORDS[s]}</option>)}
          </select>
        </td>
      );
    }
    if (column.key === 'next_step') {
      return (
        <td key={column.key} className={cellClass} {...dataAttr(CRM_CONTACTS_TABLE_NAME, 'cell', 'next_step')}>
          <NextStepInput key={`${row.key}:${String(row.next_step)}`} row={row} disabled={saving !== null} onSave={(value) => void patch(row.key, { next_step: value })} />
        </td>
      );
    }
    return undefined;
  };

  return (
    <div className="min-w-0 space-y-6" data-crm={read.ownerOnly ? 'own' : 'owner'}>
      <IntakeFormSetup form={read.form} onSaved={onWritten} />
      <CrmTable
        name={CRM_CONTACTS_TABLE_NAME}
        title={CONTACTS_TABLE_WORDS}
        columns={contactColumns}
        rows={read.contacts}
        keyOf={(r) => r.key}
        csvName={CRM_CONTACTS_CSV}
        tableClassName="min-w-[100rem]"
        empty={read.ownerOnly ? NO_CONTACTS_OWN_WORDS : NO_CONTACTS_WORDS}
        controls={<button type="button" className={chipClass} disabled={adding || saving !== null} onClick={() => setAdding(true)} data-crm-add>{ADD_CONTACT_WORDS}</button>}
        above={adding ? <AddContactRow disabled={saving !== null} onAdd={(draft) => void add(draft)} onCancel={() => setAdding(false)} /> : null}
        under={writeFailed !== null ? <p className="text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800" data-crm-write-failed>{crmWriteFailedWords(writeFailed)}</p> : null}
        cell={contactCell}
      />
      <CrmTable
        name={SUBMISSIONS_TABLE_NAME}
        title={FORM_SUBMISSIONS_TABLE_WORDS}
        columns={submissionColumns}
        rows={read.submissions}
        key={submissionsKey}
        keyOf={(r) => r.key}
        csvName={SUBMISSIONS_CSV}
        tableClassName="min-w-[80rem]"
        empty={read.form === null ? NO_FORM_YET_WORDS : NO_SUBMISSIONS_WORDS}
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
