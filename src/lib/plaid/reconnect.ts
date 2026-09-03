/**
 * BANK-01 — reconnect a bank (Plaid Link update mode), and name the bank in
 * the failure.
 *
 * A Plaid Item that falls into ITEM_LOGIN_REQUIRED (or any ITEM_ERROR) is
 * restored with a link token created FOR THE EXISTING ITEM — `access_token`
 * on /link/token/create (node_modules/plaid/dist/api.d.ts:14596: "Used when
 * launching Link in update mode") — after which Link's onSuccess public_token
 * is NOT exchanged: the Item keeps its id and its access token. /item/get
 * (ItemGetResponse.item.error, api.d.ts:13046) says whether it is healthy.
 *
 * Security-first: the access token is decrypted server-side only (SEC-02) and
 * used to mint the link token; the browser sees the link token and nothing
 * else. Every lookup is user-scoped; a foreign or unknown item is a defensive
 * 404. Messages name the INSTITUTION — never the Plaid item id, never a token.
 *
 * Pure over two small ports (the item rows; the Plaid answer) so node:test
 * drives it with fakes; the routes bind Prisma and the Plaid client.
 */
import { CountryCode, type LinkTokenCreateRequest } from 'plaid';
import { ValidationError } from '@/lib/errors/ValidationError';
import type { RateLimitError } from '@/lib/rateLimit';
import { summarizePlaidError, type PlaidErrorSummary } from './summarizeError';
import type { Envelope, StageFailed } from './failLoud';

export interface OwnedItem {
  id: string;
  userId: string;
  itemId: string;
  /** SEC-02 ciphertext — decrypt only at the point of use. */
  accessToken: string;
  institutionName: string | null;
  last_error_code: string | null;
  last_error_at: Date | null;
}

/** The port: the plaid_items rows, always addressed by (id, userId). */
export interface ItemDb {
  plaid_items: {
    findFirst(args: { where: { id: string; userId: string } }): Promise<OwnedItem | null>;
    updateMany(args: { where: { id: string; userId: string }; data: { last_error_code: string | null; last_error_at: Date | null } }): Promise<unknown>;
  };
}

/** Plaid's error_type for anything wrong with the Item itself (ITEM_LOGIN_REQUIRED, ITEM_LOCKED, …). */
export const ITEM_ERROR = 'ITEM_ERROR';

export function isItemError(summary: PlaidErrorSummary): boolean {
  return summary.error_type === ITEM_ERROR;
}

/** The name the user knows — never an id. An item stored without a name (exchange-token's 'Unknown') reads as "A linked bank". */
export function bankName(institution: string | null | undefined): string {
  const name = institution?.trim();
  return name && name !== 'Unknown' ? name : 'A linked bank';
}

/** The stage failure for an Item error: the institution named, the code declared, nothing internal. */
export function itemFailure(stage: string, institution: string | null | undefined, err: unknown, page?: number): StageFailed {
  const error = summarizePlaidError(err);
  const code = error.error_code ?? error.error_type ?? ITEM_ERROR;
  return { stage, ok: false, error, message: `${bankName(institution)} needs to be reconnected (Plaid: ${code})`, ...(page === undefined ? {} : { page }) };
}

export async function recordItemError(db: ItemDb, input: { itemRowId: string; userId: string; code: string; at: Date }): Promise<void> {
  await db.plaid_items.updateMany({ where: { id: input.itemRowId, userId: input.userId }, data: { last_error_code: input.code, last_error_at: input.at } });
}

export async function clearItemError(db: ItemDb, input: { itemRowId: string; userId: string }): Promise<void> {
  await db.plaid_items.updateMany({ where: { id: input.itemRowId, userId: input.userId }, data: { last_error_code: null, last_error_at: null } });
}

/** The user's own item, or a defensive 404 (never confirms a foreign item exists). */
export async function ownedItemOr404(db: ItemDb, userId: string, itemRowId: unknown): Promise<OwnedItem> {
  if (typeof itemRowId !== 'string' || itemRowId.trim() === '') throw new ValidationError('itemId is required', { field: 'itemId' });
  const item = await db.plaid_items.findFirst({ where: { id: itemRowId, userId } });
  if (!item) throw new ValidationError('Bank connection not found', { status: 404, field: 'itemId' });
  return item;
}

/** Link update mode: the existing item's access token, no products (Plaid: products are not set in update mode unless adding one). */
export function updateModeLinkRequest(input: { userId: string; clientName: string; accessToken: string }): LinkTokenCreateRequest {
  return {
    user: { client_user_id: input.userId },
    client_name: input.clientName,
    country_codes: [CountryCode.Us],
    language: 'en',
    access_token: input.accessToken,
  };
}

/** What /item/get says about the Item — the SDK's `PlaidError | null` on `item.error`. */
export interface ItemGetItem {
  error: { error_type: string; error_code: string; error_message: string; request_id?: string } | null;
}

export type ItemHealth = { healthy: true } | { healthy: false; error: PlaidErrorSummary };

/** After Link's update-mode onSuccess: healthy → clear last_error_*; still erroring → record it. Nothing else moves. */
export async function reconcileItemHealth(db: ItemDb, item: OwnedItem, got: ItemGetItem, now: Date = new Date()): Promise<ItemHealth> {
  if (got.error === null) {
    await clearItemError(db, { itemRowId: item.id, userId: item.userId });
    return { healthy: true };
  }
  const error: PlaidErrorSummary = { error_type: got.error.error_type, error_code: got.error.error_code, error_message: got.error.error_message, request_id: got.error.request_id };
  await recordItemError(db, { itemRowId: item.id, userId: item.userId, code: got.error.error_code, at: now });
  return { healthy: false, error };
}

/** The HYG-01 envelope for reconnect-complete. */
export function reconnectEnvelope(institution: string | null | undefined, health: ItemHealth): Envelope {
  const bank = bankName(institution);
  if (health.healthy) return { status: 200, body: { ok: true, stage: 'reconnect', message: `${bank} reconnected` } };
  return {
    status: 409,
    body: { ok: false, stage: 'reconnect', error: health.error, message: `${bank} still needs to be reconnected (Plaid: ${health.error.error_code ?? ITEM_ERROR})` },
  };
}

/** A rate-limited Plaid route answers 429 with the envelope and Retry-After. */
export function rateLimitedEnvelope(stage: string, err: RateLimitError): Envelope & { retryAfterSeconds: number } {
  const message = `Too many ${stage} requests — try again in ${err.retryAfterSeconds}s`;
  return { status: 429, retryAfterSeconds: err.retryAfterSeconds, body: { ok: false, stage, error: message, message } };
}
