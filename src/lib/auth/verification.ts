import { createHash, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import { ValidationError } from '@/lib/errors/ValidationError';
import { EMAIL_INVALID, parseRegistration, type Registration } from './registration';

/**
 * SELL-03b — NON-ENUMERATING, TRUTHFUL SIGN-UP.
 *
 * Sign-up answers IDENTICALLY for a new and a taken email — status, body,
 * headers, no cookie either way — and the difference lives only in the
 * mail: a NEW address gets a verification link (signed, single-use, 24h,
 * its random half stored hashed); a TAKEN address gets "someone tried to
 * sign up with your address". Both paths do the same work: one bcrypt hash
 * (a dummy on the taken path), one email send. Nothing in the response, its
 * timing or its headers says which path ran.
 *
 * The link: `<random>.<hmac>` — 32 random bytes (base64url) signed with the
 * app secret, so a tampered link is refused before any lookup; the database
 * holds only sha256(random). Verifying is atomic and single-use: used_at is
 * set once (a second use is 'used'), users.email_verified_at with it.
 *
 * Login for an account that never verified answers the SAME line as a wrong
 * password (loginDecision) — and every login failure offers the resend.
 * Everything here is pure or over a small port (VerifyDb / SignupDeps), so
 * the tests prove byte-identical responses, one email of the right kind per
 * path, single use, the equal messages, and the timing — hermetically.
 */

export const TOKEN_TTL_HOURS = 24;
export const CHECK_EMAIL_MESSAGE = 'Check your email to finish signing in.';
export const RESEND_MESSAGE = 'If an account is waiting to be verified, a new link is on its way.';
export const LOGIN_FAILED = 'Invalid email or password';

// ── the token ─────────────────────────────────────────────────────────────

export interface MintedToken {
  /** What the link carries: `<random>.<hmac>`. */
  token: string;
  /** What the database stores: sha256(random), hex. */
  hash: string;
  expiresAt: Date;
}

function sign(secret: string, random: string): string {
  return createHmac('sha256', secret).update(random).digest('base64url');
}

export function hashToken(random: string): string {
  return createHash('sha256').update(random).digest('hex');
}

export function mintToken(secret: string, now: Date = new Date(), random: string = randomBytes(32).toString('base64url')): MintedToken {
  return {
    token: `${random}.${sign(secret, random)}`,
    hash: hashToken(random),
    expiresAt: new Date(now.getTime() + TOKEN_TTL_HOURS * 3600 * 1000),
  };
}

/** The hash to look up, or null for a link whose signature is not ours (timing-safe). */
export function parseToken(raw: unknown, secret: string): string | null {
  if (typeof raw !== 'string') return null;
  const dot = raw.indexOf('.');
  if (dot <= 0 || dot === raw.length - 1) return null;
  const random = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  if (!/^[A-Za-z0-9_-]{20,}$/.test(random)) return null;
  const expected = sign(secret, random);
  const a = Buffer.from(sig, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return hashToken(random);
}

// ── the verify port ───────────────────────────────────────────────────────

export interface StoredToken {
  id: string;
  user_id: string;
  expires_at: Date;
  used_at: Date | null;
  user: { email: string; email_verified_at: Date | null };
}

export interface VerifyDb {
  findToken(hash: string): Promise<StoredToken | null>;
  /** Atomically: used_at = now where it is NULL, and the user's email_verified_at = now where NULL. False when the token was already used. */
  consume(tokenId: string, userId: string, now: Date): Promise<boolean>;
}

export type VerifyOutcome = { ok: true; email: string } | { ok: false; state: 'invalid' | 'expired' | 'used' };

export async function verifyToken(db: VerifyDb, secret: string, raw: unknown, now: Date = new Date()): Promise<VerifyOutcome> {
  const hash = parseToken(raw, secret);
  if (!hash) return { ok: false, state: 'invalid' };
  const row = await db.findToken(hash);
  if (!row) return { ok: false, state: 'invalid' };
  if (row.used_at) return { ok: false, state: 'used' };
  if (row.expires_at.getTime() <= now.getTime()) return { ok: false, state: 'expired' };
  const consumed = await db.consume(row.id, row.user_id, now);
  if (!consumed) return { ok: false, state: 'used' };
  return { ok: true, email: row.user.email };
}

// ── sign-up: identical outcomes ───────────────────────────────────────────

export type AuthMailKind = 'verify' | 'taken';

export interface AuthMail {
  kind: AuthMailKind;
  to: string;
  /** The recipient's name (verify only). */
  name?: string;
  /** The verification link (verify only). */
  verifyUrl?: string;
}

export type MailSendResult = { sent: true; id: string } | { sent: false; error: string };

export interface SignupDeps {
  findUserByEmail(email: string): Promise<{ id: string; email: string; name: string; email_verified_at: Date | null } | null>;
  /** The real bcrypt cost — run on BOTH paths (a dummy password on the taken one) so they take the same time. */
  hashPassword(password: string): Promise<string>;
  newId(): string;
  createUser(user: { id: string; email: string; password: string; name: string }): Promise<{ id: string; email: string; name: string }>;
  mintToken(): MintedToken;
  storeToken(row: { userId: string; hash: string; expiresAt: Date }): Promise<void>;
  /** The link for a minted token — `${baseUrl}/api/auth/verify?token=…`. */
  verifyUrl(token: string): string;
  /** ONE send per sign-up; the result is logged by the sender, never surfaced in the response. */
  sendMail(mail: AuthMail): Promise<MailSendResult>;
}

/** The ONE response every sign-up gets — new or taken, the same bytes, no cookie. */
export interface SignupResponse {
  status: 200;
  body: { message: typeof CHECK_EMAIL_MESSAGE };
  headers: Record<string, string>;
}

export const SIGNUP_RESPONSE: SignupResponse = Object.freeze({
  status: 200,
  body: Object.freeze({ message: CHECK_EMAIL_MESSAGE }),
  headers: Object.freeze({}),
}) as SignupResponse;

/** A dummy password of the same shape as a real one, hashed on the taken path so both paths pay bcrypt once. */
const DUMMY_PASSWORD = 'not-a-real-password-just-the-same-cost';

/**
 * Sign up. Input refusals (a bad email shape, a short password, no name) are
 * ValidationErrors — they are about the INPUT and say nothing about any
 * account. Past them, both paths return SIGNUP_RESPONSE.
 */
export async function signupOutcome(deps: SignupDeps, body: unknown): Promise<{ response: SignupResponse; mail: MailSendResult; path: 'new' | 'taken' }> {
  const reg: Registration = parseRegistration(body);
  const existing = await deps.findUserByEmail(reg.email);

  if (existing) {
    // The taken path: the same bcrypt cost, the same single send.
    await deps.hashPassword(DUMMY_PASSWORD);
    const mail = await deps.sendMail({ kind: 'taken', to: existing.email });
    return { response: SIGNUP_RESPONSE, mail, path: 'taken' };
  }

  const password = await deps.hashPassword(reg.password);
  const user = await deps.createUser({ id: deps.newId(), email: reg.email, password, name: reg.name });
  const minted = deps.mintToken();
  await deps.storeToken({ userId: user.id, hash: minted.hash, expiresAt: minted.expiresAt });
  const mail = await deps.sendMail({ kind: 'verify', to: user.email, name: user.name, verifyUrl: deps.verifyUrl(minted.token) });
  return { response: SIGNUP_RESPONSE, mail, path: 'new' };
}

// ── resend: identical outcomes ────────────────────────────────────────────

export interface ResendResponse {
  status: 200;
  body: { message: typeof RESEND_MESSAGE };
  headers: Record<string, string>;
}

export const RESEND_RESPONSE: ResendResponse = Object.freeze({
  status: 200,
  body: Object.freeze({ message: RESEND_MESSAGE }),
  headers: Object.freeze({}),
}) as ResendResponse;

export type ResendDeps = Pick<SignupDeps, 'findUserByEmail' | 'hashPassword' | 'mintToken' | 'storeToken' | 'verifyUrl' | 'sendMail'>;

/**
 * Resend the verification link. The only path that sends is an account that
 * exists and never verified; an unknown address and a verified account get
 * the same dummy work and the same response. The email shape is checked
 * (a ValidationError about the input, not about any account).
 */
export async function resendOutcome(deps: ResendDeps, body: unknown): Promise<{ response: ResendResponse; mail: MailSendResult | null; path: 'sent' | 'unknown' | 'verified' }> {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ValidationError(EMAIL_INVALID, { status: 400, field: 'email' });
  const user = await deps.findUserByEmail(email);
  if (!user || user.email_verified_at) {
    await deps.hashPassword(DUMMY_PASSWORD);
    return { response: RESEND_RESPONSE, mail: null, path: user ? 'verified' : 'unknown' };
  }
  await deps.hashPassword(DUMMY_PASSWORD);
  const minted = deps.mintToken();
  await deps.storeToken({ userId: user.id, hash: minted.hash, expiresAt: minted.expiresAt });
  const mail = await deps.sendMail({ kind: 'verify', to: user.email, name: user.name, verifyUrl: deps.verifyUrl(minted.token) });
  return { response: RESEND_RESPONSE, mail, path: 'sent' };
}

// ── login: one failure line ───────────────────────────────────────────────

export type LoginDecision = { ok: true } | { ok: false; status: 401; error: typeof LOGIN_FAILED };

export const LOGIN_REFUSED: LoginDecision = Object.freeze({ ok: false, status: 401, error: LOGIN_FAILED }) as LoginDecision;

/**
 * No account, a wrong password, an account that never verified: the SAME
 * object. The route runs bcrypt.compare whenever an account exists — verified
 * or not — so the timing does not tell either.
 */
export function loginDecision(input: { user: { email_verified_at: Date | null } | null; passwordOk: boolean }): LoginDecision {
  if (!input.user) return LOGIN_REFUSED;
  if (!input.passwordOk) return LOGIN_REFUSED;
  if (!input.user.email_verified_at) return LOGIN_REFUSED;
  return { ok: true };
}
