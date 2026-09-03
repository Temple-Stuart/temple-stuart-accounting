/**
 * BANK-01c — Plaid OAuth: the redirect URI on every link token, and the
 * return page's round trip.
 *
 * Plaid's OAuth guide (plaid.com/docs/link/oauth): the link token carries
 * `redirect_uri` (HTTPS, an exact entry in the Dashboard's Allowed redirect
 * URIs, no query parameters — and update mode needs it too); the bank sends
 * the user back to that URI with `?oauth_state_id=…`; the app re-opens Link
 * with the SAME link_token and `receivedRedirectUri` = the full received URL;
 * in the same browser session the link_token is kept "in a cookie or local
 * storage" across the redirect.
 *
 * This module is pure: the env read (fail loud — no link token without the
 * redirect URI), both link-token request builders, and the round trip over a
 * key-value port (localStorage in the browser, a Map in tests).
 */
import { CountryCode, Products, type LinkTokenCreateRequest } from 'plaid';
import { readSyncResponse, syncLine, type SyncOutcome } from './failLoud';

// ─── the redirect URI ─────────────────────────────────────────────────────────

export class PlaidRedirectUriMissingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PlaidRedirectUriMissingError';
  }
}

/**
 * The registered OAuth return URL, from PLAID_REDIRECT_URI. Unset, non-HTTPS,
 * or carrying a query string → a named throw: there is no no-OAuth path.
 */
export function plaidRedirectUri(env: Record<string, string | undefined> = { PLAID_REDIRECT_URI: process.env.PLAID_REDIRECT_URI }): string {
  const value = env.PLAID_REDIRECT_URI?.trim();
  if (!value) {
    throw new PlaidRedirectUriMissingError(
      'PLAID_REDIRECT_URI is not set — every Plaid link token needs the OAuth return URL registered in the Plaid Dashboard (Allowed redirect URIs); no link token is created without it',
    );
  }
  if (!/^https:\/\//i.test(value)) {
    throw new PlaidRedirectUriMissingError(`PLAID_REDIRECT_URI must be an https URI (Plaid: "Redirect URIs must use HTTPS"); got "${value.slice(0, 48)}"`);
  }
  if (value.includes('?') || value.includes('#')) {
    throw new PlaidRedirectUriMissingError('PLAID_REDIRECT_URI must carry no query string or fragment (Plaid: "Do not use query parameters when specifying the redirect_uri"; hash routing is not supported)');
  }
  return value;
}

export const CLIENT_NAME = 'Temple Stuart, LLC';

/** plaid 11.0.0's LinkTokenCreateRequest does not type `transactions.days_requested`; the API accepts it (the route sent it untyped before). */
export type NewItemLinkRequest = LinkTokenCreateRequest & { transactions: { days_requested: number } };

/** The NEW-item link token: Transactions + Investments (tastytrade supports both), two years of history, the OAuth return URL. */
export function newItemLinkRequest(input: { userId: string; clientName: string; redirectUri: string }): NewItemLinkRequest {
  return {
    user: { client_user_id: input.userId },
    client_name: input.clientName,
    products: [Products.Transactions, Products.Investments],
    country_codes: [CountryCode.Us],
    language: 'en',
    transactions: { days_requested: 730 },
    redirect_uri: input.redirectUri,
  };
}

// ─── the round trip ───────────────────────────────────────────────────────────

/** localStorage / sessionStorage, structurally. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LinkFlow =
  | { kind: 'new' }
  | { kind: 'reconnect'; itemId: string; institution: string };

/** What the browser keeps before opening Link, keyed by the link token. */
export interface KeptLink {
  linkToken: string;
  flow: LinkFlow;
  /** Plaid's `expiration` for the link token (link-token route), ISO. */
  expiresAt: string;
  keptAt: string;
}

const keyOf = (linkToken: string) => `plaid-link:${linkToken}`;
export const LATEST_KEY = 'plaid-link:latest';
export const OUTCOME_KEY = 'plaid-link:outcome';

/** Before opening Link, in both flows: keep the token and the flow for the return page. */
export function keepLinkFlow(store: KeyValueStore, input: { linkToken: string; flow: LinkFlow; expiresAt: string; now?: Date }): KeptLink {
  const kept: KeptLink = { linkToken: input.linkToken, flow: input.flow, expiresAt: input.expiresAt, keptAt: (input.now ?? new Date()).toISOString() };
  store.setItem(keyOf(input.linkToken), JSON.stringify(kept));
  store.setItem(LATEST_KEY, input.linkToken);
  return kept;
}

/** After Link finished (success or exit) in either the original page or the return page. */
export function forgetLinkFlow(store: KeyValueStore, linkToken: string): void {
  store.removeItem(keyOf(linkToken));
  if (store.getItem(LATEST_KEY) === linkToken) store.removeItem(LATEST_KEY);
}

function isFlow(v: unknown): v is LinkFlow {
  if (!v || typeof v !== 'object') return false;
  const f = v as Record<string, unknown>;
  if (f.kind === 'new') return true;
  return f.kind === 'reconnect' && typeof f.itemId === 'string' && typeof f.institution === 'string';
}

function parseKept(raw: string | null): KeptLink | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    if (typeof v.linkToken !== 'string' || typeof v.expiresAt !== 'string' || typeof v.keptAt !== 'string' || !isFlow(v.flow)) return null;
    return { linkToken: v.linkToken, flow: v.flow, expiresAt: v.expiresAt, keptAt: v.keptAt };
  } catch {
    return null;
  }
}

export type OauthReturnPlan =
  | { kind: 'reopen'; oauthStateId: string; linkToken: string; flow: LinkFlow; receivedRedirectUri: string }
  | { kind: 'error'; message: string };

/**
 * The return page's first step: read `oauth_state_id` from the URL, retrieve
 * the kept token + flow. Missing, unknown, corrupt, or expired state is a
 * DECLARED error for the page — never a silent redirect.
 */
export function planOauthReturn(href: string, store: KeyValueStore, now: Date = new Date()): OauthReturnPlan {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return { kind: 'error', message: `The return URL could not be read (${href.slice(0, 64)}).` };
  }
  const oauthStateId = url.searchParams.get('oauth_state_id');
  if (!oauthStateId) {
    return { kind: 'error', message: 'This is the Plaid OAuth return page, but the URL carries no oauth_state_id — there is no Link session to resume. Open Books and start the link or reconnect again.' };
  }
  const latest = store.getItem(LATEST_KEY);
  if (!latest) {
    return { kind: 'error', message: `No Plaid Link session was kept in this browser for this return (state ${oauthStateId}). The link must be started and finished in the same browser — open Books and start again.` };
  }
  const kept = parseKept(store.getItem(keyOf(latest)));
  if (!kept) {
    return { kind: 'error', message: `The kept Plaid Link session for this return (state ${oauthStateId}) is missing or unreadable. Open Books and start again.` };
  }
  if (new Date(kept.expiresAt).getTime() <= now.getTime()) {
    return { kind: 'error', message: `The kept Plaid Link session expired at ${kept.expiresAt} (Plaid link tokens are short-lived). Open Books and start again.` };
  }
  return { kind: 'reopen', oauthStateId, linkToken: kept.linkToken, flow: kept.flow, receivedRedirectUri: href };
}

/** What Plaid.create receives on the return page: the SAME token, the full received URL. */
export function linkReopenConfig(plan: Extract<OauthReturnPlan, { kind: 'reopen' }>): { token: string; receivedRedirectUri: string } {
  return { token: plan.linkToken, receivedRedirectUri: plan.receivedRedirectUri };
}

export type PostJson = (path: string, body: Record<string, unknown>) => Promise<{ status: number; json(): Promise<unknown> }>;

export interface LinkSuccessMetadata {
  institution?: { name?: string | null; institution_id?: string | null } | null;
}

/**
 * Link's onSuccess on the return page: 'new' → exchange-token, exactly as the
 * cockpit does; 'reconnect' → reconnect-complete, and NEVER exchange-token
 * (update mode keeps the item and its token). Returns which endpoint ran and
 * the outcome line for Books.
 */
export async function completeOauthReturn(flow: LinkFlow, publicToken: string, metadata: LinkSuccessMetadata | null | undefined, post: PostJson): Promise<{ endpoint: string; outcome: SyncOutcome }> {
  if (flow.kind === 'reconnect') {
    const res = await post('/api/plaid/reconnect-complete', { itemId: flow.itemId });
    const body = await res.json().catch(() => null);
    return { endpoint: '/api/plaid/reconnect-complete', outcome: readSyncResponse(res.status, body) };
  }
  const institutionName = metadata?.institution?.name ?? null;
  const res = await post('/api/plaid/exchange-token', {
    publicToken,
    institutionId: metadata?.institution?.institution_id ?? null,
    institutionName,
    entityId: 'personal',
  });
  const body = await res.json().catch(() => null);
  const read = readSyncResponse(res.status, body);
  // exchange-token's success body carries no `message`; name the bank instead of "Synced (HTTP 200)".
  const b = body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  const text = read.tone === 'ok' && typeof b?.message !== 'string' ? `${institutionName ?? 'Account'} linked` : read.text;
  // HYG-03: `lines` moves with the text — the banner renders lines, not text.
  return { endpoint: '/api/plaid/exchange-token', outcome: text === read.text ? read : syncLine(read.tone, text) };
}

// ─── the outcome line, carried back to Books ──────────────────────────────────

export interface ReturnOutcome {
  flow: LinkFlow;
  outcome: SyncOutcome;
  at: string;
}

export function keepReturnOutcome(store: KeyValueStore, input: { flow: LinkFlow; outcome: SyncOutcome; now?: Date }): void {
  store.setItem(OUTCOME_KEY, JSON.stringify({ flow: input.flow, outcome: input.outcome, at: (input.now ?? new Date()).toISOString() } satisfies ReturnOutcome));
}

/** Books reads (and consumes) the outcome of the flow kind it renders: the cockpit banner for 'new', the row for 'reconnect'. */
export function takeReturnOutcome(store: KeyValueStore, kind: LinkFlow['kind']): ReturnOutcome | null {
  const raw = store.getItem(OUTCOME_KEY);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown>;
    const outcome = v.outcome as Record<string, unknown> | undefined;
    if (!isFlow(v.flow) || !outcome || typeof outcome.text !== 'string' || typeof outcome.tone !== 'string' || typeof v.at !== 'string') {
      store.removeItem(OUTCOME_KEY);
      return null;
    }
    if (v.flow.kind !== kind) return null;
    store.removeItem(OUTCOME_KEY);
    return { flow: v.flow, outcome: syncLine(outcome.tone as SyncOutcome['tone'], outcome.text), at: v.at };
  } catch {
    store.removeItem(OUTCOME_KEY);
    return null;
  }
}
