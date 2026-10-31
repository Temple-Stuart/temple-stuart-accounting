/**
 * SELL-02 — the one checkout call every door makes: POST
 * /api/stripe/checkout-entitlement { key } and hand back Stripe's URL. A non-2xx
 * or a body without a url throws the route's own message — declared by the
 * caller, never retried, never swallowed. Client-side only (fetch); injectable
 * for tests.
 */
export async function startEntitlementCheckout(key: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const res = await fetchImpl('/api/stripe/checkout-entitlement', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key }),
  });
  const data = (await res.json().catch(() => ({}))) as { url?: unknown; error?: unknown };
  if (!res.ok || typeof data.url !== 'string') {
    throw new Error(typeof data.error === 'string' ? data.error : `Could not start checkout (HTTP ${res.status})`);
  }
  return data.url;
}
