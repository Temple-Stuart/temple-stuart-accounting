/**
 * REBUILD-01 PR-2 — landing: every provider answer lands once, word for word,
 * fingerprinted, BEFORE any parser runs.
 *
 *   landResponse() — one provider_responses row per HTTP answer: the exact
 *                    wire bytes, sha256 of those bytes, http_status, asked,
 *                    arrived.
 *   landObjects()  — one arrivals row per object in the answer: payload = the
 *                    object, fingerprint = sha256 of its RFC 8785 canonical
 *                    bytes (the `canonicalize` package — JCS, never hand-rolled),
 *                    their_id = the provider's own id (their_id_kind
 *                    'provider'), redactions [] (the PR-2 audit found no secret
 *                    in a /transactions/get body), response_id set, status
 *                    pending. INSERT … ON CONFLICT (provider, their_id) DO
 *                    NOTHING — a duplicate is promise 2 working, not an error —
 *                    and the caller learns which were new and which already
 *                    existed. The rows handed back are READ FROM THE TABLE, so
 *                    a parser that takes them never reads the HTTP object.
 *   markRead()     — read = now, status = done, once (promise 1 is the
 *                    database's trigger; this is its only legal move).
 *
 * Pure over a small LandingDb port so node:test drives it with a fake;
 * prismaLanding.ts is the Prisma-backed port used inside sync-complete's
 * per-page transaction.
 */
import { createHash, randomUUID } from 'node:crypto';
import canonicalize from 'canonicalize';
import { PROVIDER_CODES } from '@/lib/providers';

export type JsonObject = Record<string, unknown>;

export interface ProviderResponseRow {
  id: string;
  provider: string;
  resource: string;
  user_id: string | null;
  guest_ref: string | null;
  http_status: number;
  body: Buffer;
  body_sha256: Buffer;
  asked: Date;
  arrived: Date;
}

export interface ArrivalRow {
  id: string;
  provider: string;
  connection: string | null;
  resource: string;
  their_id: string;
  their_id_kind: 'provider' | 'composed';
  payload: JsonObject;
  fingerprint: Buffer;
  redactions: string[];
  asked: Date;
  arrived: Date;
  response_id: string;
  user_id: string | null;
  guest_ref: string | null;
}

export interface LandedArrival {
  id: string;
  their_id: string;
  /** The payload as the TABLE holds it — the parser's only input. */
  payload: unknown;
  status: string;
}

/** The port. Every method runs inside the caller's database transaction. */
export interface LandingDb {
  insertResponse(row: ProviderResponseRow): Promise<void>;
  /** INSERT … ON CONFLICT (provider, their_id) DO NOTHING; resolves to the their_ids that were actually inserted. */
  insertArrivalsIgnoringDuplicates(rows: ArrivalRow[]): Promise<string[]>;
  /** The rows the table holds for these (provider, their_id)s — new and pre-existing alike. */
  findArrivals(provider: string, theirIds: string[]): Promise<LandedArrival[]>;
  /** read = at, status = done for these ids. */
  markRead(ids: string[], at: Date): Promise<void>;
}

export function sha256(bytes: Buffer): Buffer {
  return createHash('sha256').update(bytes).digest();
}

/** RFC 8785 (JSON Canonicalization Scheme) bytes of a value — key order independent, UTF-8. */
export function canonicalBytes(value: unknown): Buffer {
  const text = canonicalize(value);
  if (typeof text !== 'string') throw new Error('canonicalBytes: the value has no JCS form (undefined, a function, or a symbol)');
  return Buffer.from(text, 'utf8');
}

export function fingerprintOf(value: unknown): Buffer {
  return sha256(canonicalBytes(value));
}

export class UnknownProviderError extends Error {
  constructor(code: string) {
    super(`landing: "${code}" is not a provider the deck names (src/lib/providers.ts)`);
    this.name = 'UnknownProviderError';
  }
}

function assertProvider(code: string): void {
  if (!PROVIDER_CODES.includes(code)) throw new UnknownProviderError(code);
}

export interface WireAnswer {
  provider: string;
  resource: string;
  userId: string | null;
  guestRef: string | null;
  httpStatus: number;
  body: Buffer;
  asked: Date;
  arrived: Date;
}

export interface LandedResponse {
  id: string;
  bodySha256: Buffer;
}

export async function landResponse(db: LandingDb, answer: WireAnswer): Promise<LandedResponse> {
  assertProvider(answer.provider);
  if (answer.userId === null && answer.guestRef === null) throw new Error('landResponse: an answer belongs to a user or a guest');
  const row: ProviderResponseRow = {
    id: `resp_${randomUUID()}`,
    provider: answer.provider,
    resource: answer.resource,
    user_id: answer.userId,
    guest_ref: answer.guestRef,
    http_status: answer.httpStatus,
    body: answer.body,
    body_sha256: sha256(answer.body),
    asked: answer.asked,
    arrived: answer.arrived,
  };
  await db.insertResponse(row);
  return { id: row.id, bodySha256: row.body_sha256 };
}

export interface ObjectToLand {
  theirId: string;
  payload: JsonObject;
}

export interface LandObjectsInput {
  provider: string;
  resource: string;
  connection: string | null;
  userId: string | null;
  guestRef: string | null;
  responseId: string;
  asked: Date;
  arrived: Date;
  objects: ObjectToLand[];
}

export interface LandedObjects {
  /** their_id → arrival id, for the objects this call inserted. */
  newIds: Map<string, string>;
  /** their_id → arrival id, for the objects the table already held (promise 2). */
  existingIds: Map<string, string>;
  /** Objects repeated within this one answer — landed once, counted here. */
  repeatedInAnswer: number;
  /** The rows as the table holds them, in the answer's order (one per distinct their_id). */
  rows: LandedArrival[];
}

export async function landObjects(db: LandingDb, input: LandObjectsInput): Promise<LandedObjects> {
  assertProvider(input.provider);
  if (input.userId === null && input.guestRef === null) throw new Error('landObjects: an arrival belongs to a user or a guest');
  const seen = new Set<string>();
  let repeatedInAnswer = 0;
  const rows: ArrivalRow[] = [];
  for (const o of input.objects) {
    if (seen.has(o.theirId)) { repeatedInAnswer += 1; continue; }
    seen.add(o.theirId);
    rows.push({
      id: `arr_${randomUUID()}`,
      provider: input.provider,
      connection: input.connection,
      resource: input.resource,
      their_id: o.theirId,
      their_id_kind: 'provider',
      payload: o.payload,
      fingerprint: fingerprintOf(o.payload),
      redactions: [],
      asked: input.asked,
      arrived: input.arrived,
      response_id: input.responseId,
      user_id: input.userId,
      guest_ref: input.guestRef,
    });
  }
  const inserted = new Set(rows.length ? await db.insertArrivalsIgnoringDuplicates(rows) : []);
  const found = rows.length ? await db.findArrivals(input.provider, rows.map((r) => r.their_id)) : [];
  const byTheirId = new Map(found.map((f) => [f.their_id, f]));
  const newIds = new Map<string, string>();
  const existingIds = new Map<string, string>();
  const ordered: LandedArrival[] = [];
  for (const r of rows) {
    const f = byTheirId.get(r.their_id);
    if (!f) throw new Error(`landObjects: ${input.provider} ${r.their_id} was neither inserted nor found — the table is not answering`);
    (inserted.has(r.their_id) ? newIds : existingIds).set(r.their_id, f.id);
    ordered.push(f);
  }
  return { newIds, existingIds, repeatedInAnswer, rows: ordered };
}

export async function markRead(db: LandingDb, ids: string[], at: Date = new Date()): Promise<void> {
  if (ids.length) await db.markRead(ids, at);
}
