/**
 * SEC-02b — no provider secret in a log line.
 *
 * plaid 11 rides axios 0.21, whose errors carry the whole request on
 * `err.config`: `config.headers` holds PLAID-CLIENT-ID and PLAID-SECRET,
 * `config.data` holds the JSON body with the item's access_token. Passing the
 * raw error to console.error prints both (util.inspect walks two levels).
 *
 * This summarizer reads ONLY `err.response?.status` and the fields of Plaid's
 * documented error body on `err.response?.data` — error_type, error_code,
 * error_message, request_id — plus the Error's own `name` and `message` so a
 * non-Plaid error caught in the same block (Prisma, auth) still leaves a
 * trace. It never touches `config`, `request`, `headers`, or the request body.
 */

export interface PlaidErrorSummary {
  status?: number;
  error_type?: string;
  error_code?: string;
  error_message?: string;
  request_id?: string;
  name?: string;
  message?: string;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export function summarizePlaidError(err: unknown): PlaidErrorSummary {
  const summary: PlaidErrorSummary = {};
  if (err instanceof Error) {
    summary.name = err.name;
    summary.message = err.message;
  } else if (typeof err === 'string') {
    summary.message = err;
  }
  const response = (err as { response?: unknown } | null)?.response;
  if (response && typeof response === 'object') {
    const status = (response as { status?: unknown }).status;
    if (typeof status === 'number') summary.status = status;
    const data = (response as { data?: unknown }).data;
    if (data && typeof data === 'object') {
      const d = data as Record<string, unknown>;
      summary.error_type = str(d.error_type);
      summary.error_code = str(d.error_code);
      summary.error_message = str(d.error_message);
      summary.request_id = str(d.request_id);
    }
  }
  return summary;
}
