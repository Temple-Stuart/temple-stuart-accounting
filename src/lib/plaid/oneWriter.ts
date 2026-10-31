/**
 * REBUILD-01 PR-3 — ONE PLAID WRITER. sync-complete is the ruled single asker
 * and writer for the Plaid feeds (promise 2: one asker per feed); it lands
 * every answer raw-first (PR-2, PR-2c). The three old routes that also asked
 * Plaid and wrote transactions with nothing landed (the per-item sync under
 * /api/plaid, the cursor sync and the full sync under /api/transactions) and
 * the sync-fix helper in lib are gone. A sync button posts HERE and reads the
 * HYG-01 / HYG-03 outcome line, nothing else.
 */
import { readSyncOutcome, type SyncOutcome } from './failLoud';

/** The one writer's route. */
export const SYNC_COMPLETE_PATH = '/api/transactions/sync-complete';

/** POST the one writer; hand back its outcome line (tone, text, the per-bank lines). Never throws on a non-JSON body. */
export async function syncThroughOneWriter(fetchImpl: typeof fetch = fetch): Promise<SyncOutcome> {
  const res = await fetchImpl(SYNC_COMPLETE_PATH, { method: 'POST' });
  return readSyncOutcome(res);
}
