/**
 * renderGuard — LAYER 2 of the public-Showroom guardrail (PR10).
 *
 * Defense-in-depth companion to the Layer-1 build assertion. Where Layer 1 stops
 * a fetch from being COMMITTED into the subtree, this guards the showroom's own
 * synchronous render at RUNTIME: if any code path inside the guarded render tries
 * to start a network fetch, it throws a typed error (fail-loud) instead of
 * silently reaching the server.
 *
 * Scope is deliberately tight: the guard swaps `globalThis.fetch` ONLY for the
 * synchronous duration of the showroom render callback, and ALWAYS restores it in
 * a `finally`. JavaScript is single-threaded, so nothing on an authed/data page
 * can observe the swap — it is fully restored before this function returns (or
 * rethrows). This is NOT a persistent global monkeypatch.
 *
 * Normal showroom render calls no fetch (it renders pure views + locked handlers),
 * so the guard never trips in normal use — it only fires if a fetch is
 * reintroduced into the showroom render path.
 */

/** Thrown when something tries to fetch from inside the guarded showroom render. */
export class ShowroomFetchError extends Error {
  constructor(input?: unknown) {
    const target =
      typeof input === 'string'
        ? input
        : input && typeof input === 'object' && 'url' in input
          ? String((input as { url: unknown }).url)
          : 'unknown';
    super(
      `Showroom render attempted a network fetch (${target}). The public Projects ` +
        'pipe must never reach the server logged-out — keep it on pure views + ' +
        'demo seed + locked handlers (see PR5–PR10).'
    );
    this.name = 'ShowroomFetchError';
  }
}

/**
 * Run `render` with `globalThis.fetch` temporarily replaced by a stub that
 * throws ShowroomFetchError, then restore the real fetch. Returns whatever
 * `render` returns. No fallback, no silent catch.
 */
export function guardShowroomRender<T>(render: () => T): T {
  // Capture the real fetch (may be undefined in exotic runtimes — handle both).
  const real = (globalThis as { fetch?: typeof fetch }).fetch;
  const guard = ((input: unknown): never => {
    throw new ShowroomFetchError(input);
  }) as unknown as typeof fetch;

  (globalThis as { fetch?: typeof fetch }).fetch = guard;
  try {
    return render();
  } finally {
    // Always restore — authed/data pages are never affected by this swap.
    (globalThis as { fetch?: typeof fetch }).fetch = real;
  }
}
