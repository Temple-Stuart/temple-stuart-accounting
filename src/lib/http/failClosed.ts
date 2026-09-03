/**
 * HYG-02 — no raw database or runtime error text to the client.
 *
 * A route's catch-all used to answer `{ error: error.message }`, so a Prisma
 * fault printed its internal text inside the UI ("Invalid prisma.users.findFirst()
 * invocation … Can't reach database server at …"). This is the one builder for
 * that branch: it LOGS a summary of the thrown error server-side (name, code,
 * status, message — never config, headers, or a request body, the SEC-02b
 * discipline) and RETURNS the HYG-01 envelope with a FIXED, user-safe message.
 * The thrown message never reaches the body.
 *
 * The one exception is user guidance: a ValidationError (src/lib/errors) is
 * text written FOR the user — it passes through VERBATIM at its own status
 * (400 / 404 …) and is not logged as an error. Everything else is a fault.
 *
 * Pure (no Next.js import) so it runs in node:test; failClosedResponse.ts is
 * the one-line NextResponse wrapper routes call.
 */
import type { Envelope } from '../plaid/failLoud';
import { ValidationError } from '../errors/ValidationError';

export interface FailureSummary {
  name?: string;
  code?: string;
  status?: number;
  message?: string;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

/** Only the Error's own name / message, a string `code` (Prisma P-codes, node errno), and a numeric `status`. */
export function summarizeError(err: unknown): FailureSummary {
  const summary: FailureSummary = {};
  if (err instanceof Error) {
    summary.name = err.name;
    summary.message = err.message;
  } else if (typeof err === 'string') {
    summary.message = err;
  }
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    const code = str(o.code);
    if (code !== undefined) summary.code = code;
    if (typeof o.status === 'number') summary.status = o.status;
    else if (typeof o.statusCode === 'number') summary.status = o.statusCode;
  }
  return summary;
}

export interface FailClosedBody {
  ok: false;
  stage: string;
  /** The fixed, user-safe line — the same text in both keys so every existing reader (`error` or `message`) prints it. */
  error: string;
  message: string;
  /** Set only for a ValidationError that names its input field. */
  field?: string;
}

/** The text a client may print for a thrown error: a ValidationError's own words, else the fixed line. */
export function userFacingMessage(err: unknown, fixed: string): string {
  return err instanceof ValidationError ? err.message : fixed;
}

/**
 * Log the summary; return the envelope. `stage` names the route's step for the
 * log and the body (a fixed label, never user input); `userMessage` is the fixed
 * line the client shows. Status defaults to 500 — a local or database fault.
 * `extra` carries fixed keys a caller's UI reads (a category, a code) — never
 * anything derived from the thrown error.
 */
export function failClosed(stage: string, userMessage: string, err: unknown, status = 500, extra: Record<string, unknown> = {}): Envelope & { body: FailClosedBody } {
  if (err instanceof ValidationError) {
    // User guidance, verbatim, at its own status; a refusal is not a fault, so no error log.
    return {
      status: err.status,
      body: { ...extra, ok: false, stage, error: err.message, message: err.message, ...(err.field ? { field: err.field } : {}) },
    };
  }
  console.error(`[${stage}] ${userMessage}`, summarizeError(err));
  return { status, body: { ...extra, ok: false, stage, error: userMessage, message: userMessage } };
}
