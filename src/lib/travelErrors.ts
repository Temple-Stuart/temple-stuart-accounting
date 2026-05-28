// Travel-data typed errors. The fail-loud / no-silent-fallback mandate requires
// every provider (Google, Viator, future LiteAPI/Mozio/Airalo/Cover Genius) to
// surface auth/billing/quota/network failures to the user — never as "0 results."
//
// USAGE: throw these from provider clients; catch them in route handlers; map
// to structured HTTP responses; render banners in the UI.

// ─── Google Places ───────────────────────────────────────────────────────────

/** Thrown when GOOGLE_PLACES_API_KEY is unset/empty. */
export class MissingGoogleKeyError extends Error {
  readonly source = 'google' as const;
  readonly kind = 'missing_key' as const;
  constructor() {
    super('GOOGLE_PLACES_API_KEY is not configured');
    this.name = 'MissingGoogleKeyError';
  }
}

/** Thrown when Google returns a non-OK / non-ZERO_RESULTS status
 *  (REQUEST_DENIED, OVER_QUERY_LIMIT, INVALID_REQUEST, UNKNOWN_ERROR), OR on a
 *  network failure wrapped as ('NETWORK_ERROR', message). Includes Google's own
 *  error_message text so the user sees the actual reason. */
export class GooglePlacesApiError extends Error {
  readonly source = 'google' as const;
  readonly kind = 'api_error' as const;
  constructor(public status: string, public errorMessage?: string) {
    super(`Google Places API: ${status}${errorMessage ? ` — ${errorMessage}` : ''}`);
    this.name = 'GooglePlacesApiError';
  }
}

// `GooglePlacesQuotaError` already lives in `googlePlacesQuota.ts` — it's
// thrown by `reserveCall()` when the monthly cap is crossed. Re-export so
// route handlers have one import site for all travel-data errors.
export { GooglePlacesQuotaError } from './googlePlacesQuota';

// ─── Viator ──────────────────────────────────────────────────────────────────

/** Thrown when VIATOR_API_KEY is unset/empty. */
export class MissingViatorKeyError extends Error {
  readonly source = 'viator' as const;
  readonly kind = 'missing_key' as const;
  constructor() {
    super('VIATOR_API_KEY is not configured');
    this.name = 'MissingViatorKeyError';
  }
}

/** Thrown when a Viator endpoint returns non-2xx (401/403 auth, 429
 *  rate-limit, 5xx server). Includes the endpoint + status + truncated body
 *  so the user sees the actual provider response. */
export class ViatorApiError extends Error {
  readonly source = 'viator' as const;
  readonly kind = 'api_error' as const;
  constructor(public endpoint: string, public status: number, public body?: string) {
    super(`Viator API: ${endpoint} returned ${status}${body ? ` — ${body.substring(0, 200)}` : ''}`);
    this.name = 'ViatorApiError';
  }
}

// ─── Type guards ─────────────────────────────────────────────────────────────

/** True for any typed travel-provider error this module owns. */
export function isTravelProviderError(err: unknown): err is
  | MissingGoogleKeyError
  | GooglePlacesApiError
  | MissingViatorKeyError
  | ViatorApiError {
  return (
    err instanceof MissingGoogleKeyError ||
    err instanceof GooglePlacesApiError ||
    err instanceof MissingViatorKeyError ||
    err instanceof ViatorApiError
  );
}
