/**
 * HYG-01 — fail loud on the money paths. No silent 200.
 *
 * One discipline for every route that pulls from Plaid: a stage either
 * completes or is DECLARED failed in the response, and the HTTP status says
 * so. A partial run (one stage ok, one failed) is a 207 carrying both
 * outcomes; a run where every stage failed carries the first failure's
 * status; only a run with zero failures is a 200. No retries, no fallbacks —
 * the user decides what to do next, not the code.
 *
 * Pure: no Next.js imports, so the same functions run in node:test and in the
 * browser (readSyncResponse renders the returned message inline).
 */
import { summarizePlaidError, type PlaidErrorSummary } from './summarizeError';

export interface StageOk {
  stage: string;
  ok: true;
  counts: Record<string, number>;
}

export interface StageFailed {
  stage: string;
  ok: false;
  error: PlaidErrorSummary;
  message: string;
  /** REBUILD-01 PR-2: the page whose transaction rolled back, when the stage pages. */
  page?: number;
}

export type StageOutcome = StageOk | StageFailed;

export interface Envelope {
  status: number;
  body: Record<string, unknown>;
}

/** User-safe line for a failure: provider code first, a hint for 429s, never a body. */
export function describeFailure(error: PlaidErrorSummary): string {
  if (error.error_type || error.error_code) {
    const code = error.error_type && error.error_code && error.error_type !== error.error_code
      ? `${error.error_type} (${error.error_code})`
      : (error.error_type ?? error.error_code);
    const rateLimited = error.status === 429 || error.error_type === 'RATE_LIMIT_EXCEEDED';
    const hint = rateLimited
      ? ' — try again in a few minutes'
      : error.error_message ? ` — ${error.error_message}` : '';
    return `Plaid: ${code}${hint}`;
  }
  if (typeof error.status === 'number') {
    return `Plaid: HTTP ${error.status}${error.message ? ` — ${error.message}` : ''}`;
  }
  return `${error.name ?? 'Error'}: ${error.message ?? 'unknown error'}`;
}

/** 429 stays 429 (the user can act on it); any other upstream status is a 502; a local throw is a 500. */
export function statusForFailure(error: PlaidErrorSummary): number {
  if (error.status === 429) return 429;
  if (typeof error.status === 'number') return 502;
  return 500;
}

export function stageOk(stage: string, counts: Record<string, number>): StageOk {
  return { stage, ok: true, counts };
}

export function stageFailed(stage: string, err: unknown, page?: number): StageFailed {
  const error = summarizePlaidError(err);
  return { stage, ok: false, error, message: describeFailure(error), ...(page === undefined ? {} : { page }) };
}

function line(s: StageOutcome): string {
  if (s.ok) {
    const parts = Object.entries(s.counts).map(([k, v]) => `${v} ${k}`);
    return `${s.stage}: ok${parts.length ? ` (${parts.join(', ')})` : ''}`;
  }
  return `${s.stage}${s.page === undefined ? '' : ` (page ${s.page})`}: ${s.message}`;
}

/**
 * Fold stage outcomes into one response. `okBody` is merged in on 200 and 207
 * so existing success keys (synced, skipped, stats) keep flowing to callers.
 */
export function syncEnvelope(stages: StageOutcome[], okBody: Record<string, unknown> = {}): Envelope {
  if (stages.length === 0) throw new Error('syncEnvelope: no stages');
  const failed = stages.filter((s): s is StageFailed => !s.ok);
  const lines = stages.map(line).join(' · ');
  if (failed.length === 0) {
    return { status: 200, body: { ok: true, ...okBody, stages, message: `Synced — ${lines}` } };
  }
  if (failed.length === stages.length) {
    const first = failed[0];
    return {
      status: statusForFailure(first.error),
      body: { ok: false, stage: first.stage, error: first.error, message: `Sync failed — ${lines}`, stages },
    };
  }
  return { status: 207, body: { ok: false, partial: true, ...okBody, stages, message: `Partial sync — ${lines}` } };
}

/** A single-stage failure, with any progress counts the caller wants to declare. */
export function failureEnvelope(stage: string, err: unknown, progress: Record<string, unknown> = {}): Envelope {
  const failed = stageFailed(stage, err);
  return {
    status: statusForFailure(failed.error),
    body: { ok: false, stage, error: failed.error, message: failed.message, ...progress },
  };
}

// ─── HYG-03: the unit of failure is the ITEM, not the stage ───────────────────
//
// HYG-01's stage rule ("the first failure ends its stage for the whole run") let
// one dead bank, first in database order, stop every other bank from syncing.
// Here every item runs every stage regardless of the others; each (item, stage)
// declares its own outcome; the response lists each bank with its outcomes and
// counts. Inside one item a page failure still ends that item's stage (PR-2).

/** One bank's outcomes — every stage, declared. BANK-03: a retired item carries no stages and says why. */
export interface ItemOutcome {
  institution: string;
  stages: StageOutcome[];
  /** BANK-03: plaid_items.retired_reason — the item was replaced by a fresh link; skipped, not failed. */
  retired?: string;
}

export type ItemStatus = 'ok' | 'partial' | 'failed';

/** ok: every stage ok · failed: every stage failed · partial: some of each. */
export function itemStatus(item: ItemOutcome): ItemStatus {
  const failed = item.stages.filter((s) => !s.ok).length;
  if (failed === 0) return 'ok';
  if (failed === item.stages.length) return 'failed';
  return 'partial';
}

export type StageRunner<I> = readonly [stage: string, run: (item: I) => Promise<StageOutcome>];

/**
 * Run every stage for every item, in the order given, regardless of any other
 * item's outcome. A runner declares its own outcome; a runner that THROWS is
 * itself a declared failure of that stage (never a silent skip, never a halt).
 */
export async function syncEachItem<I>(items: I[], institution: (item: I) => string, runners: StageRunner<I>[]): Promise<ItemOutcome[]> {
  const out: ItemOutcome[] = [];
  for (const item of items) {
    const name = institution(item);
    const stages: StageOutcome[] = [];
    for (const [stage, run] of runners) {
      try {
        stages.push(await run(item));
      } catch (err) {
        stages.push(stageFailed(stage, err));
      }
    }
    out.push({ institution: name, stages });
  }
  return out;
}

/** Counts for one stage summed across every item where that stage succeeded. */
export function sumStageCounts(items: ItemOutcome[], stage: string): Record<string, number> {
  const sum: Record<string, number> = {};
  for (const item of items) {
    for (const s of item.stages) {
      if (!s.ok || s.stage !== stage) continue;
      for (const [k, v] of Object.entries(s.counts)) sum[k] = (sum[k] ?? 0) + v;
    }
  }
  return sum;
}

/**
 * One line per failed bank: "TastyTrade — needs to be reconnected (Plaid:
 * ITEM_LOGIN_REQUIRED)". An item failure already names the bank (BANK-01), so
 * that prefix is not repeated; any other failure names its stage (and page).
 */
export function failedLine(institution: string, failure: StageFailed): string {
  const named = failure.message.startsWith(`${institution} `);
  const reason = named ? failure.message.slice(institution.length + 1) : failure.message;
  const where = named ? '' : `${failure.stage}${failure.page === undefined ? '' : ` page ${failure.page}`}: `;
  return `${institution} — ${where}${reason}`;
}

/** "Wells Fargo, Robinhood synced: 14 landed, 2 corrected, 5 investment transactions" — null when nothing succeeded. */
export function successLine(items: ItemOutcome[]): string | null {
  const okItems = items.filter((i) => i.stages.length > 0 && itemStatus(i) === 'ok').map((i) => i.institution);
  const tx = sumStageCounts(items, 'transactions');
  const inv = sumStageCounts(items, 'investments');
  const anyOk = items.some((i) => i.stages.some((s) => s.ok));
  if (!anyOk) return null;
  const parts = [`${tx.landed ?? 0} landed`];
  if (tx.already_landed) parts.push(`${tx.already_landed} already landed`);
  if (tx.corrected) parts.push(`${tx.corrected} corrected`);
  if (inv.synced) parts.push(`${inv.synced} investment transactions`);
  if (inv.securities) parts.push(`${inv.securities} securities`);
  const who = okItems.length ? `${okItems.join(', ')} synced` : 'Partial progress';
  return `${who}: ${parts.join(', ')}`;
}

/** The banner's lines: one per failed bank (duplicates collapsed), one per retired bank, then one for what succeeded. */
export function syncLines(items: ItemOutcome[]): string[] {
  const failed: string[] = [];
  for (const item of items) {
    for (const s of item.stages) {
      if (s.ok) continue;
      const l = failedLine(item.institution, s);
      if (!failed.includes(l)) failed.push(l);
    }
  }
  const retired = items.filter((i) => i.retired !== undefined).map((i) => `${i.institution} — retired (${i.retired})`);
  const ok = successLine(items);
  return ok === null ? [...failed, ...retired] : [...failed, ...retired, ok];
}

/**
 * Fold per-item outcomes into one response. 200 when every stage of every
 * item succeeded; non-2xx (the first failure's status) only when EVERY stage
 * of EVERY item failed — nothing synced anywhere; 207 otherwise. `okBody`
 * (synced / skipped / landed totals) rides the 200 and the 207 so existing
 * readers keep their keys. `items` and `lines` ride every answer.
 */
export function syncItemsEnvelope(items: ItemOutcome[], okBody: Record<string, unknown> = {}): Envelope {
  if (items.length === 0) {
    return { status: 200, body: { ok: true, ...okBody, items, lines: [], message: 'Synced — no linked banks' } };
  }
  const lines = syncLines(items);
  // BANK-03: a retired item has no stages — it is neither ok nor failed; only live items decide the status.
  const live = items.filter((i) => i.stages.length > 0);
  if (live.length === 0) {
    return { status: 200, body: { ok: true, ...okBody, items, lines, message: `Synced — no live banks${lines.length ? ` · ${lines.join(' · ')}` : ''}` } };
  }
  const statuses = live.map(itemStatus);
  if (statuses.every((s) => s === 'ok')) {
    return { status: 200, body: { ok: true, ...okBody, items, lines, message: `Synced — ${lines.join(' · ')}` } };
  }
  if (statuses.every((s) => s === 'failed')) {
    const firstItem = live[0];
    const first = firstItem.stages.find((s): s is StageFailed => !s.ok)!;
    return {
      status: statusForFailure(first.error),
      body: { ok: false, stage: first.stage, institution: firstItem.institution, error: first.error, items, lines, message: `Sync failed — ${lines.join(' · ')}` },
    };
  }
  return { status: 207, body: { ok: false, partial: true, ...okBody, items, lines, message: `Partial sync — ${lines.join(' · ')}` } };
}

export type SyncTone = 'ok' | 'partial' | 'error';
export interface SyncOutcome {
  tone: SyncTone;
  /** The one-line form (the lines joined) — every existing reader prints this. */
  text: string;
  /** HYG-03: the banner's lines — one per failed bank above one for what succeeded; [text] when the body sent none. */
  lines: string[];
}

/** A one-line outcome built on the client (a Link exit, a local refusal). */
export function syncLine(tone: SyncTone, text: string): SyncOutcome {
  return { tone, text, lines: [text] };
}

function linesOf(b: Record<string, unknown> | null): string[] | null {
  const lines = b?.lines;
  return Array.isArray(lines) && lines.length > 0 && lines.every((l) => typeof l === 'string') ? (lines as string[]) : null;
}

/** Client side: turn a status + parsed body (or null when the body was not JSON) into the inline line(s). */
export function readSyncResponse(status: number, body: unknown): SyncOutcome {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  const message = typeof b?.message === 'string' ? b.message : null;
  const sent = linesOf(b);
  const withLines = (tone: SyncTone, text: string): SyncOutcome => ({ tone, text, lines: sent ?? [text] });
  if (status === 207) return withLines('partial', message ?? `Partial sync (HTTP 207)`);
  if (status >= 200 && status < 300 && b?.ok !== false) return withLines('ok', message ?? `Synced (HTTP ${status})`);
  const fallbackError = typeof b?.error === 'string' ? b.error : null;
  return withLines('error', message ?? fallbackError ?? `Sync failed: HTTP ${status}`);
}

/** Client side: read a fetch Response into the inline line. Never throws on a non-JSON body. */
export async function readSyncOutcome(res: Response): Promise<SyncOutcome> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return readSyncResponse(res.status, body);
}
