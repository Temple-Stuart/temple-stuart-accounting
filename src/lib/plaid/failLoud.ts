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
  /**
   * SYNC-01: 'YYYY-MM-DD' — the newest date the app now holds for this link's accounts in this stage's table
   * (transactions; investment_transactions), read once when a paged stage completes. Absent when it holds none.
   */
  through?: string;
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

export function stageOk(stage: string, counts: Record<string, number>, through?: string): StageOk {
  return through === undefined ? { stage, ok: true, counts } : { stage, ok: true, counts, through };
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
  /** SYNC-01: the link's ONE name in a run — the bank's name, or the name and the day it was linked when two live links carry the same name. */
  institution: string;
  stages: StageOutcome[];
  /** BANK-03: plaid_items.retired_reason — the item was replaced by a fresh link; skipped, not failed. */
  retired?: string;
  /** SYNC-01: the link's ONE key in a run — the plaid_items row id (the id /api/accounts and Reconnect already hand the browser). A run cut into requests is joined by it. */
  key?: string;
  /** SYNC-01: a live link that holds no accounts in this app — no stages, nothing was asked of Plaid, and it says so. */
  idle?: string;
  /** SYNC-01: one note per account Plaid lists under this link that the app holds no row for — its objects are counted, never stored. */
  notes?: string[];
}

export type ItemStatus = 'ok' | 'partial' | 'failed';

/** ok: every stage ok · failed: every stage failed · partial: some of each. */
export function itemStatus(item: ItemOutcome): ItemStatus {
  const failed = item.stages.filter((s) => !s.ok).length;
  if (failed === 0) return 'ok';
  if (failed === item.stages.length) return 'failed';
  return 'partial';
}

// SYNC-01: ONE WALKER. The walk over items and stages lived here as syncEachItem until the run was cut into requests;
// it is src/lib/plaid/syncRun.ts walkItems now — every item still runs every stage regardless of the others, a runner
// that throws is still a declared failure of that stage, and the walk can stop before an ask and resume there.

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

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

/**
 * SYNC-01 — THE ONE DAY FORMATTER: 'YYYY-MM-DD' → 'Nov 9, 2026'. Pure text over a month table: no Date object and no
 * time zone, so a calendar day prints as the same day for every viewer (a Date formatted in the viewer's zone shows
 * the day before in the Americas). Null for anything that is not a real calendar day — the caller says what it prints
 * then; nothing is guessed.
 */
export function calendarDay(ymd: unknown): string | null {
  if (typeof ymd !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return null;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const daysIn = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
  if (day > daysIn) return null;
  return `${MONTHS[month - 1]} ${day}, ${year}`;
}

/** SYNC-01: a count as a person reads it — 4812 → '4,812'. Pure text; no locale. */
export function thousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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

// ─── SYNC-01: ONE LINE PER BANK, WITH WHAT IT PULLED ──────────────────────────
//
// Until SYNC-01 the banner closed on one line for the whole run — "Wells Fargo, Robinhood synced: 14 landed, 2
// corrected, 5 investment transactions, 12 holdings" (successLine) — which named the banks that had no failure and
// summed counts across them: it could not say which bank brought what, or whether a bank's history was whole. Now
// every link with an ok stage has its own line, written from what THAT link's stages state:
//
//   Wells Fargo — transactions 3,412 of 3,412 pulled, 41 new, latest Nov 9, 2026
//   Robinhood — transactions 4,812 of 4,812 pulled, 0 new, latest Aug 30, 2026 · investments 712 of 712 pulled, 3 new, latest Nov 7, 2026 · 14 holdings

/** What the line says of objects counted and not written: the link holds no row for their account. */
export const NOT_STORED_WORDS = 'not stored (account not held here)';

/**
 * One ok stage's part of its bank's line. A paged stage says what it pulled of Plaid's total and how many were new to
 * the app; a piece in brackets below is printed only when its count is above zero (`latest`: when the stage states
 * the newest date held):
 *   transactions <pulled> of <plaid_total> pulled, <added> new[, <corrected> corrected][, <unheld> not stored (account not held here)][, latest <Mon D, YYYY>]
 *   investments  <pulled> of <plaid_total> pulled, <added> new[, <unheld> not stored (account not held here)][, latest <Mon D, YYYY>]
 *   holdings     <holdings> holdings — only when any were written
 * Null when the stage states nothing a part can be written from: a figure it does not state is never printed as 0.
 */
function stagePart(s: StageOk): string | null {
  const c = s.counts;
  if (s.stage === 'holdings') return c.holdings > 0 ? `${thousands(c.holdings)} holdings` : null;
  if (s.stage !== 'transactions' && s.stage !== 'investments') return null;
  if (typeof c.pulled !== 'number' || typeof c.plaid_total !== 'number' || typeof c.added !== 'number') return null;
  const pieces = [`${s.stage} ${thousands(c.pulled)} of ${thousands(c.plaid_total)} pulled`, `${thousands(c.added)} new`];
  if (s.stage === 'transactions' && c.corrected > 0) pieces.push(`${thousands(c.corrected)} corrected`);
  if (c.unheld > 0) pieces.push(`${thousands(c.unheld)} ${NOT_STORED_WORDS}`);
  const latest = s.through === undefined ? null : calendarDay(s.through);
  if (latest !== null) pieces.push(`latest ${latest}`);
  return pieces.join(', ');
}

/** One bank's line: `<label> — ` then a part for each ok stage, in the order the stages ran, joined by ` · `. Null when no ok stage states a part. */
export function bankLine(item: ItemOutcome): string | null {
  const parts = item.stages.filter((s): s is StageOk => s.ok).map(stagePart).filter((part): part is string => part !== null);
  return parts.length > 0 ? `${item.institution} — ${parts.join(' · ')}` : null;
}

/** An account Plaid lists under a link that the app holds no row for — said, with what follows from it. */
export function noteLine(institution: string, note: string): string {
  return `${institution} — Plaid lists an account this app does not hold under this link: ${note}. Its transactions are not stored.`;
}

/**
 * The banner's lines, in this order: one per failed (link, stage) — duplicates collapsed — then one per account
 * Plaid lists that the app does not hold, one per idle link, one per retired link, and last one per bank for what
 * it pulled.
 */
export function syncLines(items: ItemOutcome[]): string[] {
  const failed: string[] = [];
  for (const item of items) {
    for (const s of item.stages) {
      if (s.ok) continue;
      const l = failedLine(item.institution, s);
      if (!failed.includes(l)) failed.push(l);
    }
  }
  const notes = items.flatMap((i) => (i.notes === undefined ? [] : i.notes.map((note) => noteLine(i.institution, note))));
  const idle = items.filter((i) => i.idle !== undefined).map((i) => `${i.institution} — ${i.idle}`);
  const retired = items.filter((i) => i.retired !== undefined).map((i) => `${i.institution} — retired (${i.retired})`);
  const banks = items.map(bankLine).filter((l): l is string => l !== null);
  return [...failed, ...notes, ...idle, ...retired, ...banks];
}

/**
 * SYNC-01 — JOINING A RUN'S ANSWERS. A run cut into requests answers in parts: each answer lists the outcomes that
 * finished in that request. Joined by `key` (the plaid_items row id): a link's stages in the order they arrived, its
 * notes united, idle and retired kept. An outcome with no key is its own entry. The parts are not changed.
 */
export function joinItemOutcomes(parts: ItemOutcome[]): ItemOutcome[] {
  const joined: ItemOutcome[] = [];
  const at = new Map<string, number>();
  for (const part of parts) {
    const index = part.key === undefined ? undefined : at.get(part.key);
    if (index === undefined) {
      if (part.key !== undefined) at.set(part.key, joined.length);
      joined.push(part.notes === undefined ? { ...part, stages: [...part.stages] } : { ...part, stages: [...part.stages], notes: [...part.notes] });
      continue;
    }
    const link = joined[index];
    link.stages.push(...part.stages);
    if (part.notes !== undefined) {
      const notes = link.notes === undefined ? [] : link.notes;
      for (const note of part.notes) if (!notes.includes(note)) notes.push(note);
      link.notes = notes;
    }
    if (link.idle === undefined && part.idle !== undefined) link.idle = part.idle;
    if (link.retired === undefined && part.retired !== undefined) link.retired = part.retired;
  }
  return joined;
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
  /** HYG-03 · SYNC-01: the banner's lines — one per failed bank, then the notes, the idle and the retired links, then one per bank for what it pulled; [text] when the body sent none. */
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
