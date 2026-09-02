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

export function stageFailed(stage: string, err: unknown): StageFailed {
  const error = summarizePlaidError(err);
  return { stage, ok: false, error, message: describeFailure(error) };
}

function line(s: StageOutcome): string {
  if (s.ok) {
    const parts = Object.entries(s.counts).map(([k, v]) => `${v} ${k}`);
    return `${s.stage}: ok${parts.length ? ` (${parts.join(', ')})` : ''}`;
  }
  return `${s.stage}: ${s.message}`;
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

export type SyncTone = 'ok' | 'partial' | 'error';
export interface SyncOutcome {
  tone: SyncTone;
  text: string;
}

/** Client side: turn a status + parsed body (or null when the body was not JSON) into one inline line. */
export function readSyncResponse(status: number, body: unknown): SyncOutcome {
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  const message = typeof b?.message === 'string' ? b.message : null;
  if (status === 207) return { tone: 'partial', text: message ?? `Partial sync (HTTP 207)` };
  if (status >= 200 && status < 300 && b?.ok !== false) return { tone: 'ok', text: message ?? `Synced (HTTP ${status})` };
  const fallbackError = typeof b?.error === 'string' ? b.error : null;
  return { tone: 'error', text: message ?? fallbackError ?? `Sync failed: HTTP ${status}` };
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
