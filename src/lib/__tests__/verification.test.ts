import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationError } from '../errors/ValidationError';
import {
  LOGIN_FAILED,
  LOGIN_REFUSED,
  RESEND_MESSAGE,
  RESEND_RESPONSE,
  TOKEN_TTL_HOURS,
  hashToken,
  loginDecision,
  mintToken,
  parseToken,
  resendOutcome,
  verifyToken,
  type AuthMail,
  type ResendDeps,
  type StoredToken,
  type VerifyDb,
} from '../auth/verification';

// SELL-03b — the verification link, the login refusal, the resend. Hermetic:
// a fake token store with the table's own rule (used_at set once).

const SECRET = 'test-secret';
const NOW = new Date('2026-09-08T12:00:00Z');

class FakeVerifyDb implements VerifyDb {
  rows = new Map<string, StoredToken>();
  users = new Map<string, { email: string; email_verified_at: Date | null }>();
  consumeCalls: Array<[string, string]> = [];
  add(hash: string, row: Omit<StoredToken, 'user'>, user: { email: string; email_verified_at: Date | null }) {
    this.users.set(row.user_id, user);
    this.rows.set(hash, { ...row, user });
  }
  async findToken(hash: string) { const r = this.rows.get(hash); return r ? { ...r, user: { ...this.users.get(r.user_id)! } } : null; }
  async consume(tokenId: string, userId: string, now: Date) {
    this.consumeCalls.push([tokenId, userId]);
    const row = [...this.rows.values()].find((r) => r.id === tokenId);
    if (!row || row.used_at) return false;      // the database's rule: used_at is set once
    row.used_at = now;
    const u = this.users.get(userId)!;
    if (!u.email_verified_at) u.email_verified_at = now;
    return true;
  }
}

test('the link: 32 random bytes signed with the secret; the database holds only the hash; a tampered or foreign link is refused before any lookup', () => {
  const m = mintToken(SECRET, NOW);
  const [random, sig] = m.token.split('.');
  assert.ok(random.length >= 40 && /^[A-Za-z0-9_-]+$/.test(random), 'base64url random half');
  assert.ok(sig.length > 20);
  assert.equal(m.hash, hashToken(random));
  assert.equal(m.hash.length, 64, 'sha256 hex');
  assert.notEqual(m.hash, random);
  assert.equal(m.expiresAt.getTime(), NOW.getTime() + TOKEN_TTL_HOURS * 3600 * 1000);
  assert.equal(TOKEN_TTL_HOURS, 24);

  assert.equal(parseToken(m.token, SECRET), m.hash, 'our link parses to its hash');
  assert.equal(parseToken(m.token, 'another-secret'), null, 'a different secret does not sign it');
  assert.equal(parseToken(`${random}.${sig.slice(0, -1)}x`, SECRET), null, 'a tampered signature');
  assert.equal(parseToken(`${random}x.${sig}`, SECRET), null, 'a tampered random half');
  assert.equal(parseToken(random, SECRET), null, 'no signature at all');
  assert.equal(parseToken('', SECRET), null);
  assert.equal(parseToken(undefined, SECRET), null);
  assert.notEqual(mintToken(SECRET, NOW).token, mintToken(SECRET, NOW).token, 'every mint is fresh');
});

test('a valid token verifies once and never twice; expired and foreign links are declared by state; verifying sets the user\'s email_verified_at', async () => {
  const db = new FakeVerifyDb();
  const m = mintToken(SECRET, NOW);
  db.add(m.hash, { id: 'tok-1', user_id: 'user-1', expires_at: m.expiresAt, used_at: null }, { email: 'a@b.co', email_verified_at: null });

  const first = await verifyToken(db, SECRET, m.token, new Date(NOW.getTime() + 1000));
  assert.deepEqual(first, { ok: true, email: 'a@b.co' });
  assert.deepEqual(db.consumeCalls, [['tok-1', 'user-1']]);
  assert.ok(db.users.get('user-1')!.email_verified_at instanceof Date, 'verified');
  assert.ok(db.rows.get(m.hash)!.used_at instanceof Date, 'used once');

  const second = await verifyToken(db, SECRET, m.token, new Date(NOW.getTime() + 2000));
  assert.deepEqual(second, { ok: false, state: 'used' }, 'never twice');
  assert.equal(db.consumeCalls.length, 1, 'the second use never reached consume — used_at was already set');

  // a token that expires
  const old = mintToken(SECRET, NOW);
  db.add(old.hash, { id: 'tok-2', user_id: 'user-2', expires_at: old.expiresAt, used_at: null }, { email: 'c@d.co', email_verified_at: null });
  assert.deepEqual(await verifyToken(db, SECRET, old.token, new Date(old.expiresAt.getTime())), { ok: false, state: 'expired' });
  assert.deepEqual(await verifyToken(db, SECRET, old.token, new Date(old.expiresAt.getTime() - 1)), { ok: true, email: 'c@d.co' }, 'one millisecond before expiry it works');

  // a foreign link, a well-formed link we never issued
  assert.deepEqual(await verifyToken(db, SECRET, 'garbage', NOW), { ok: false, state: 'invalid' });
  const never = mintToken(SECRET, NOW);
  assert.deepEqual(await verifyToken(db, SECRET, never.token, NOW), { ok: false, state: 'invalid' }, 'signed by us but not stored');

  // a race: two consumers, one row — the database's used_at rule decides
  const r = mintToken(SECRET, NOW);
  db.add(r.hash, { id: 'tok-3', user_id: 'user-3', expires_at: r.expiresAt, used_at: null }, { email: 'e@f.co', email_verified_at: null });
  const [x, y] = await Promise.all([verifyToken(db, SECRET, r.token, NOW), verifyToken(db, SECRET, r.token, NOW)]);
  assert.deepEqual([x.ok, y.ok].sort(), [false, true], 'exactly one wins');
});

test('login for an unverified account fails with the SAME object as a wrong password and as no account', () => {
  const unverified = loginDecision({ user: { email_verified_at: null }, passwordOk: true });
  const wrongPassword = loginDecision({ user: { email_verified_at: new Date() }, passwordOk: false });
  const noAccount = loginDecision({ user: null, passwordOk: false });
  assert.deepEqual(unverified, wrongPassword);
  assert.deepEqual(unverified, noAccount);
  assert.equal(unverified, LOGIN_REFUSED, 'the one frozen refusal');
  assert.equal(JSON.stringify(unverified), JSON.stringify({ ok: false, status: 401, error: LOGIN_FAILED }));
  assert.equal(LOGIN_FAILED, 'Invalid email or password');
  assert.deepEqual(loginDecision({ user: { email_verified_at: new Date() }, passwordOk: true }), { ok: true });
  assert.ok(Object.isFrozen(LOGIN_REFUSED));
});

test('resend answers the same bytes for an unknown address, a verified account and an unverified one; only the unverified one gets a fresh link', async () => {
  const make = (user: { id: string; email: string; name: string; email_verified_at: Date | null } | null) => {
    const calls = { hash: 0, stored: [] as unknown[], mail: [] as AuthMail[] };
    const deps: ResendDeps = {
      findUserByEmail: async () => user,
      hashPassword: async () => { calls.hash += 1; return 'h'; },
      mintToken: () => mintToken(SECRET, NOW),
      storeToken: async (row) => { calls.stored.push(row); },
      verifyUrl: (token) => `https://templestuart.com/api/auth/verify?token=${encodeURIComponent(token)}`,
      sendMail: async (mail) => { calls.mail.push(mail); return { sent: true, id: 'm' }; },
    };
    return { deps, calls };
  };
  const unknown = make(null);
  const verified = make({ id: 'u1', email: 'a@b.co', name: 'A', email_verified_at: NOW });
  const waiting = make({ id: 'u2', email: 'w@b.co', name: 'W', email_verified_at: null });
  const [a, b, c] = await Promise.all([resendOutcome(unknown.deps, { email: 'x@y.co' }), resendOutcome(verified.deps, { email: 'a@b.co' }), resendOutcome(waiting.deps, { email: 'W@B.co' })]);
  assert.equal(JSON.stringify(a.response), JSON.stringify(b.response));
  assert.equal(JSON.stringify(b.response), JSON.stringify(c.response));
  assert.equal(a.response, RESEND_RESPONSE);
  assert.deepEqual(a.response.body, { message: RESEND_MESSAGE });
  assert.deepEqual([a.path, b.path, c.path], ['unknown', 'verified', 'sent']);
  assert.deepEqual([unknown.calls.hash, verified.calls.hash, waiting.calls.hash], [1, 1, 1], 'the same work on every path');
  assert.equal(unknown.calls.mail.length + verified.calls.mail.length, 0, 'nothing sent where nothing waits');
  assert.equal(waiting.calls.mail.length, 1);
  assert.equal(waiting.calls.mail[0].kind, 'verify');
  assert.equal(waiting.calls.mail[0].to, 'w@b.co');
  assert.equal(waiting.calls.stored.length, 1);
  await assert.rejects(() => resendOutcome(unknown.deps, { email: 'nope' }), (e: unknown) => e instanceof ValidationError && e.status === 400);
});
