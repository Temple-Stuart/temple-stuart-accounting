/**
 * BANK-01b — surface Plaid Link's exit. Fail loud.
 *
 * Plaid Link's onExit(error, metadata) is the only place Link says WHY it
 * closed — "Something went wrong — Internal error occurred" arrives here as
 * `{ error_type, error_code, error_message, display_message }` with the
 * session's `link_session_id` / `request_id` (react-plaid-link
 * src/types/index.ts:17-37; plaid.com/docs/link/web onExit). Both Link
 * flows discarded it (BooksPipeline `onExit: () => { setReconnecting(null) }`,
 * ModuleLauncher `onExit: () => {}`), so the reason reached neither the row
 * nor the logs.
 *
 * This module is pure: the note text, the exact report body the browser
 * POSTs to /api/plaid/link-exit, and the server-side summarizer that admits
 * ONLY the named fields (never a token — none is ever read from the body).
 */
import { ValidationError } from '@/lib/errors/ValidationError';

/** react-plaid-link's PlaidLinkError, structurally. */
export interface LinkExitError {
  error_type: string;
  error_code: string;
  error_message: string;
  display_message?: string | null;
}

/** react-plaid-link's PlaidLinkOnExitMetadata, structurally. */
export interface LinkExitMetadata {
  institution?: { name: string; institution_id: string } | null;
  /** "The point at which the user exited the Link flow" — requires_credentials, requires_oauth, … */
  status?: string | null;
  link_session_id?: string | null;
  request_id?: string | null;
}

/** The body the browser POSTs — these keys and no others. */
export interface LinkExitReport {
  itemId?: string;
  error_code: string;
  error_type: string;
  error_message: string;
  link_session_id: string | null;
  request_id: string | null;
  /** Where Link was when it exited (metadata.status) — the field that says "requires_oauth". */
  status: string | null;
}

export const RECONNECT_CANCELLED = 'Reconnect cancelled';
export const LINK_CANCELLED = 'Account link cancelled';

/** "Plaid Link: <error_code> — <display_message || error_message>" */
export function linkExitNote(error: LinkExitError): string {
  const text = error.display_message?.trim() || error.error_message;
  return `Plaid Link: ${error.error_code} — ${text}`;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v !== '' ? v : null;
}

export function linkExitReport(error: LinkExitError, metadata: LinkExitMetadata, itemId?: string): LinkExitReport {
  return {
    ...(itemId === undefined ? {} : { itemId }),
    error_code: error.error_code,
    error_type: error.error_type,
    error_message: error.error_message,
    link_session_id: str(metadata.link_session_id),
    request_id: str(metadata.request_id),
    status: str(metadata.status),
  };
}

export type LinkExitOutcome =
  | { kind: 'error'; note: string; report: LinkExitReport }
  | { kind: 'cancelled'; note: string }
  | { kind: 'connected' };

/**
 * error non-null → the note and the report to POST. error null with
 * status !== 'connected' → the user cancelled (note only). Otherwise Link
 * closed on a connected session — nothing to say.
 */
export function linkExitOutcome(error: LinkExitError | null, metadata: LinkExitMetadata, cancelNote: string, itemId?: string): LinkExitOutcome {
  if (error) return { kind: 'error', note: linkExitNote(error), report: linkExitReport(error, metadata, itemId) };
  if (metadata.status !== 'connected') return { kind: 'cancelled', note: cancelNote };
  return { kind: 'connected' };
}

/** Browser side: POST the report; the answer says whether the server logged it. Never throws. */
export async function postLinkExit(report: LinkExitReport): Promise<{ logged: boolean; status: number }> {
  try {
    const res = await fetch('/api/plaid/link-exit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(report),
    });
    return { logged: res.ok, status: res.status };
  } catch {
    return { logged: false, status: 0 };
  }
}

/** The row's line when the report did not land — the Plaid reason is still shown, and so is the miss. */
export function notLoggedSuffix(status: number): string {
  return ` — not logged (${status === 0 ? 'network' : `HTTP ${status}`})`;
}

export const LINK_EXIT_MAX = { message: 500, id: 128 } as const;

export interface LinkExitSummary {
  itemId: string | null;
  error_code: string;
  error_type: string;
  error_message: string;
  link_session_id: string | null;
  request_id: string | null;
  status: string | null;
}

function required(body: Record<string, unknown>, key: 'error_code' | 'error_type' | 'error_message', max: number): string {
  const v = body[key];
  if (typeof v !== 'string' || v.trim() === '') throw new ValidationError(`${key} is required`, { field: key });
  return v.slice(0, max);
}

function optional(body: Record<string, unknown>, key: string, max: number): string | null {
  const v = body[key];
  if (v === undefined || v === null) return null;
  if (typeof v !== 'string') throw new ValidationError(`${key} must be a string`, { field: key });
  return v === '' ? null : v.slice(0, max);
}

/**
 * Server side: admit the named fields only, length-capped; anything else in
 * the body is ignored (there is no key under which a token could pass).
 * Missing or mistyped fields are a 400 (ValidationError, verbatim).
 */
export function summarizeLinkExit(body: unknown): LinkExitSummary {
  if (!body || typeof body !== 'object') throw new ValidationError('a JSON body is required');
  const b = body as Record<string, unknown>;
  return {
    itemId: optional(b, 'itemId', LINK_EXIT_MAX.id),
    error_code: required(b, 'error_code', LINK_EXIT_MAX.id),
    error_type: required(b, 'error_type', LINK_EXIT_MAX.id),
    error_message: required(b, 'error_message', LINK_EXIT_MAX.message),
    link_session_id: optional(b, 'link_session_id', LINK_EXIT_MAX.id),
    request_id: optional(b, 'request_id', LINK_EXIT_MAX.id),
    status: optional(b, 'status', LINK_EXIT_MAX.id),
  };
}
