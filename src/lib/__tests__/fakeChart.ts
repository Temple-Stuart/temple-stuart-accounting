import type { ChartAccountRow, ChartDb, ChartPatch, NewChartAccount } from '../coa/accounts';
import type { PostingDb } from '../coa/reclassify';

/**
 * COA-01 — the test fake of the chart and the posting port, shared by the COA
 * tests. Hermetic, with the tables' own rules: UNIQUE on (userId, entity_id,
 * code); ledger lines are append-only (there is no update on the port, and the
 * fake's `ledger` array is frozen row by row so a test can prove nothing old
 * moved); balances change only through incrementBalance. Not a test file (no
 * .test suffix): npm test's glob skips it.
 */
export interface FakeJournalRow {
  id: string;
  userId: string;
  entity_id: string;
  date: Date;
  description: string;
  source_type: string;
  status: string;
  request_id: string;
  created_by: string | null;
  metadata: unknown;
}

export interface FakeLedgerRow {
  id: string;
  journal_entry_id: string;
  account_id: string;
  entry_type: 'D' | 'C';
  amount: bigint;
  created_by: string | null;
}

export class FakeChart implements ChartDb, PostingDb {
  accounts: ChartAccountRow[] = [];
  journal: FakeJournalRow[] = [];
  ledger: readonly Readonly<FakeLedgerRow>[] = [];
  updates: Array<{ id: string; patch: ChartPatch }> = [];
  increments: Array<{ accountId: string; delta: bigint }> = [];
  private seq = 0;

  private nextId(prefix: string) { this.seq += 1; return `${prefix}-${this.seq}`; }

  seed(rows: Array<Partial<ChartAccountRow> & { code: string; name: string; account_type: string }>): ChartAccountRow[] {
    return rows.map((r) => {
      const row: ChartAccountRow = {
        id: r.id ?? this.nextId('acct'),
        userId: r.userId ?? 'user-a',
        entity_id: r.entity_id ?? 'ent-b',
        entity_type: r.entity_type ?? 'sole_prop',
        code: r.code,
        name: r.name,
        account_type: r.account_type,
        balance_type: r.balance_type ?? (r.account_type === 'asset' || r.account_type === 'expense' ? 'D' : 'C'),
        sub_type: r.sub_type ?? null,
        module: r.module ?? null,
        settled_balance: r.settled_balance ?? BigInt(0),
        is_archived: r.is_archived ?? false,
      };
      this.accounts.push(row);
      return row;
    });
  }

  postLine(row: Omit<FakeLedgerRow, 'id'>): FakeLedgerRow {
    const line = Object.freeze({ ...row, id: this.nextId('line') });
    this.ledger = [...this.ledger, line];
    return line;
  }

  async findByCode(userId: string, entityId: string, code: string) {
    return this.accounts.find((a) => a.userId === userId && a.entity_id === entityId && a.code === code) ?? null;
  }

  async insert(a: NewChartAccount) {
    if (await this.findByCode(a.userId, a.entity_id, a.code)) {
      throw new Error(`fake chart: UNIQUE (userId, entity_id, code) violated for ${a.code}`);
    }
    const row: ChartAccountRow = { ...a, id: this.nextId('acct'), settled_balance: BigInt(0), is_archived: false };
    this.accounts.push(row);
    return row;
  }

  async update(id: string, patch: ChartPatch) {
    const row = this.accounts.find((a) => a.id === id);
    if (!row) throw new Error(`fake chart: no account ${id}`);
    this.updates.push({ id, patch: { ...patch } });
    Object.assign(row, patch);
    return row;
  }

  async insertJournalEntry(r: Omit<FakeJournalRow, 'id'>) {
    const je: FakeJournalRow = { ...r, id: this.nextId('je') };
    this.journal.push(je);
    return { id: je.id };
  }

  async insertLedgerLine(r: Omit<FakeLedgerRow, 'id'>) {
    return { id: this.postLine(r).id };
  }

  async incrementBalance(accountId: string, delta: bigint) {
    const row = this.accounts.find((a) => a.id === accountId);
    if (!row) throw new Error(`fake chart: no account ${accountId}`);
    this.increments.push({ accountId, delta });
    row.settled_balance = BigInt(row.settled_balance) + delta;
  }

  snapshotLedger(): string {
    return JSON.stringify(this.ledger.map((l) => ({ ...l, amount: l.amount.toString() })));
  }
}
