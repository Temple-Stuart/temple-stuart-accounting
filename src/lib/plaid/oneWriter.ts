/**
 * REBUILD-01 PR-3 — ONE PLAID WRITER. sync-complete is the ruled single asker
 * and writer for the Plaid feeds (promise 2: one asker per feed); it lands
 * every answer raw-first (PR-2, PR-2c). The three old routes that also asked
 * Plaid and wrote transactions with nothing landed (the per-item sync under
 * /api/plaid, the cursor sync and the full sync under /api/transactions) and
 * the sync-fix helper in lib are gone. A sync button posts HERE and reads the
 * HYG-01 / HYG-03 outcome line, nothing else.
 *
 * SYNC-01 (Alex, 2026-11-11 12:54: "lets get the sync fixed. so everything pulls") — THE ONE WRITER FOLLOWS THE RUN
 * TO ITS END. The route answers 202 with `more` when its request's budget is spent and the run is not done
 * (src/lib/plaid/syncRun.ts). This posts again with { resume: more } — the same run, continued, never a retry — until
 * a final answer, joins what each answer finished (failLoud.ts joinItemOutcomes) and reads the outcome from the whole.
 * A run whose first answer is final is ONE post, read exactly as before.
 *
 * Declared, never silent, never retried: a point that does not advance, a later answer that is not a sync answer and
 * a fetch that throws each end the run with an error line first and the lines of what had finished after it.
 */
import { joinItemOutcomes, readSyncResponse, syncItemsEnvelope, syncLine, syncLines, type ItemOutcome, type SyncOutcome } from './failLoud';
import type { SyncMore } from './syncRun';

/** The one writer's route. */
export const SYNC_COMPLETE_PATH = '/api/transactions/sync-complete';

interface Answer {
  status: number;
  /** The parsed JSON body, or null when the body was not JSON (a gateway page). */
  body: unknown;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** A sync answer is a JSON body with an `items` array. */
const itemsOf = (body: unknown): ItemOutcome[] | null => (isObject(body) && Array.isArray(body.items) ? (body.items as ItemOutcome[]) : null);

/** 202-with-`more`: the run is not done — the point to continue from and the line to show meanwhile. Anything else is a final answer. */
function moreOf(answer: Answer): { more: SyncMore; progress: string } | null {
  if (answer.status !== 202 || !isObject(answer.body)) return null;
  const { more, progress } = answer.body;
  if (!isObject(more) || typeof more.item !== 'string' || typeof more.stage !== 'string' || typeof more.offset !== 'number' || !isObject(more.counts)) return null;
  if (typeof progress !== 'string') return null;
  return { more: more as unknown as SyncMore, progress };
}

/** One post: no body on a fresh run; { resume } to continue one. Never throws on a non-JSON body — a fetch that throws is the caller's to declare. */
async function post(fetchImpl: typeof fetch, resume: SyncMore | null): Promise<Answer> {
  const res = resume === null
    ? await fetchImpl(SYNC_COMPLETE_PATH, { method: 'POST' })
    : await fetchImpl(SYNC_COMPLETE_PATH, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ resume }) });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body };
}

/**
 * POST the one writer and follow the run to its end; hand back its outcome (tone, text, the per-bank lines).
 * `onProgress` is handed the line of a run that is still going ("Still pulling — Robinhood: transactions 1,500 of
 * 4,812"). Never throws: a fetch that throws is a declared outcome.
 */
export async function syncThroughOneWriter(fetchImpl: typeof fetch = fetch, onProgress?: (outcome: SyncOutcome) => void): Promise<SyncOutcome> {
  /** What every answer so far listed as finished, in the order it arrived. */
  const finished: ItemOutcome[] = [];
  /** The run ended early: the reason first, then the lines of what had finished. */
  const stopped = (reason: string): SyncOutcome => {
    const lines = [reason, ...syncLines(joinItemOutcomes(finished))];
    return { tone: 'error', text: lines.join(' · '), lines };
  };
  let sent: SyncMore | null = null;
  let answers = 0;
  for (;;) {
    let answer: Answer;
    try {
      answer = await post(fetchImpl, sent);
    } catch (error) {
      return stopped(`Sync failed — network: ${error instanceof Error ? error.message : String(error)}`);
    }
    answers += 1;
    const next = moreOf(answer);
    if (next === null) {
      // A final answer. The first answer of a run is read exactly as it always was — one post.
      if (answers === 1) return readSyncResponse(answer.status, answer.body);
      const items = itemsOf(answer.body);
      // A later answer that is not a sync answer (a 401, a 500, a gateway page): its own line, then what had finished.
      if (items === null) return stopped(readSyncResponse(answer.status, answer.body).text);
      finished.push(...items);
      // The whole run, joined: the same lines one uninterrupted answer would have carried.
      const { status, body } = syncItemsEnvelope(joinItemOutcomes(finished));
      return readSyncResponse(status, body);
    }
    if (sent !== null && next.more.item === sent.item && next.more.stage === sent.stage && next.more.offset === sent.offset) {
      return stopped(`Sync stopped — "${next.progress}" did not advance. Press Sync to try again.`);
    }
    if (onProgress) onProgress(syncLine('ok', next.progress));
    const items = itemsOf(answer.body);
    if (items !== null) finished.push(...items);
    sent = next.more;
  }
}
