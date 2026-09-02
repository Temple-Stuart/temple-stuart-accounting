/**
 * SEC-02b — no provider secret in a log line.
 *
 * @tastytrade/api rides axios too; its errors carry `config.headers`
 * (Authorization: Bearer <OAuth JWT or session token>) and, for
 * sessionService.login, `config.data` with the login and password. This
 * summarizer reads ONLY `err.response?.status` and tastytrade's error body
 * `err.response?.data.error` — `code` and `message` — plus the Error's own
 * `name` and `message`. Never `config`, `request`, `headers`, or the body.
 */

export interface TastytradeErrorSummary {
  status?: number;
  code?: string;
  error_message?: string;
  name?: string;
  message?: string;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

export function summarizeTastytradeError(err: unknown): TastytradeErrorSummary {
  const summary: TastytradeErrorSummary = {};
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
    const error = data && typeof data === 'object' ? (data as { error?: unknown }).error : undefined;
    if (error && typeof error === 'object') {
      summary.code = str((error as Record<string, unknown>).code);
      summary.error_message = str((error as Record<string, unknown>).message);
    }
  }
  return summary;
}
