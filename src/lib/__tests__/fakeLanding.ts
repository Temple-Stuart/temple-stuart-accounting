import type { ArrivalRow, LandedArrival, LandingDb, ProviderResponseRow } from '../arrivals/land';

/**
 * REBUILD-01 PR-2 / PR-2c — the test fake of the arrivals store, shared by the
 * landing tests. Hermetic, with the table's own rules: UNIQUE on provider +
 * their_id + fingerprint (the same thing is the same provider, id and content);
 * read / status move once. Not a test file (no .test suffix): npm test's glob
 * skips it.
 */
export class FakeLanding implements LandingDb {
  responses: ProviderResponseRow[] = [];
  arrivals = new Map<string, { row: ArrivalRow; read: Date | null; status: string }>();
  private key(provider: string, theirId: string, fingerprint: Buffer) { return `${provider} ${theirId} ${Buffer.from(fingerprint).toString('hex')}`; }
  async insertResponse(row: ProviderResponseRow) { this.responses.push(row); }
  async insertArrivalsIgnoringDuplicates(rows: ArrivalRow[]) {
    const inserted: Array<{ their_id: string; fingerprint: Buffer }> = [];
    for (const r of rows) {
      const k = this.key(r.provider, r.their_id, r.fingerprint);
      if (this.arrivals.has(k)) continue;
      this.arrivals.set(k, { row: structuredClone(r), read: null, status: 'pending' });
      inserted.push({ their_id: r.their_id, fingerprint: r.fingerprint });
    }
    return inserted;
  }
  async findArrivals(provider: string, theirIds: string[]): Promise<LandedArrival[]> {
    return [...this.arrivals.values()]
      .filter((a) => a.row.provider === provider && theirIds.includes(a.row.their_id))
      .map((a) => ({ id: a.row.id, their_id: a.row.their_id, fingerprint: Buffer.from(a.row.fingerprint), payload: structuredClone(a.row.payload), status: a.status, arrived: a.row.arrived }));
  }
  async markRead(ids: string[], at: Date) {
    for (const a of this.arrivals.values()) {
      if (!ids.includes(a.row.id)) continue;
      if (a.read !== null || a.status !== 'pending') throw new Error('arrivals promise 1: read is set once, from NULL');
      a.read = at;
      a.status = 'done';
    }
  }
  rowsFor(theirId: string) { return [...this.arrivals.values()].filter((a) => a.row.their_id === theirId); }
  rowsOf(resource: string) { return [...this.arrivals.values()].filter((a) => a.row.resource === resource); }
  snapshot() {
    return { responses: [...this.responses], arrivals: new Map([...this.arrivals].map(([k, v]) => [k, { ...v, row: structuredClone(v.row) }])) };
  }
  restore(s: ReturnType<FakeLanding['snapshot']>) { this.responses = s.responses; this.arrivals = s.arrivals; }
}

/** A fake transaction client: a throw inside discards the page's landing writes (the database's rollback). */
export function snapshotClient(landing: FakeLanding, onRollback?: () => void) {
  return {
    async $transaction<T>(fn: (tx: unknown) => Promise<T>): Promise<T> {
      const snap = landing.snapshot();
      try {
        return await fn({});
      } catch (e) {
        landing.restore(snap);
        onRollback?.();
        throw e;
      }
    },
  };
}
