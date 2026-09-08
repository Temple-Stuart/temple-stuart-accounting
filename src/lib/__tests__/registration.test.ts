import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationError } from '../errors/ValidationError';
import { EMAIL_INVALID, NAME_REQUIRED, PASSWORD_MIN_LENGTH, PASSWORD_TOO_SHORT, SIGNUP_LANDING, parseRegistration } from '../auth/registration';
import { CHECK_EMAIL_MESSAGE, SIGNUP_RESPONSE, hashToken, mintToken, signupOutcome, type AuthMail, type MailSendResult, type SignupDeps } from '../auth/verification';
import { renderAuthMail, sendAuthMail, takenEmail, verificationEmail } from '../auth/welcomeEmail';
import { EmailConfigError, EmailSendError } from '../email';
import { ANSWERS_HOME } from '../answers';
import { FREE_TOOLS, OFFERS } from '../offer';

// SELL-03 / 03b — one front door, an honest, NON-ENUMERATING sign-up.
// Hermetic: the sign-up runs over fake deps (no prisma, no bcrypt, no Resend).

const SECRET = 'test-secret';

function fakeDeps(opts: { existing?: boolean; hashDelayMs?: number; mail?: MailSendResult | Error } = {}) {
  const calls = { find: [] as string[], hash: [] as string[], create: [] as Array<{ id: string; email: string; password: string; name: string }>, stored: [] as Array<{ userId: string; hash: string; expiresAt: Date }>, mail: [] as AuthMail[] };
  let minted: ReturnType<typeof mintToken> | null = null;
  const deps: SignupDeps = {
    findUserByEmail: async (email) => { calls.find.push(email); return opts.existing ? { id: 'user-existing', email, name: 'Existing', email_verified_at: new Date('2026-01-01') } : null; },
    hashPassword: async (pw) => { calls.hash.push(pw); if (opts.hashDelayMs) await new Promise((r) => setTimeout(r, opts.hashDelayMs)); return `hashed(${pw})`; },
    newId: () => 'user-new',
    createUser: async (u) => { calls.create.push(u); return { id: u.id, email: u.email, name: u.name }; },
    mintToken: () => { minted = mintToken(SECRET, new Date('2026-09-08T00:00:00Z'), 'random-part-for-the-test-0000000000'); return minted; },
    storeToken: async (row) => { calls.stored.push(row); },
    verifyUrl: (token) => `https://templestuart.com/api/auth/verify?token=${encodeURIComponent(token)}`,
    sendMail: async (mail) => { calls.mail.push(mail); const m = opts.mail ?? { sent: true, id: 'msg-1' }; if (m instanceof Error) throw m; return m; },
  };
  return { deps, calls, minted: () => minted };
}

function refuses(fn: () => unknown, status: number, message: string, field: string) {
  assert.throws(fn, (err: unknown) => {
    assert.ok(err instanceof ValidationError, `expected a ValidationError, got ${String(err)}`);
    assert.equal(err.status, status);
    assert.equal(err.message, message);
    assert.equal(err.field, field);
    return true;
  });
}

// ── the input rules (about the input, never about an account) ───────────────

test('password shorter than the rule → 400 with the authored message; the rule is the ONE number the client hints', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 8);
  assert.equal(PASSWORD_TOO_SHORT, 'Password must be at least 8 characters');
  refuses(() => parseRegistration({ email: 'a@b.co', password: 'short12', name: 'A' }), 400, PASSWORD_TOO_SHORT, 'password');
  refuses(() => parseRegistration({ email: 'a@b.co', password: '', name: 'A' }), 400, PASSWORD_TOO_SHORT, 'password');
  refuses(() => parseRegistration({ email: 'a@b.co', name: 'A' }), 400, PASSWORD_TOO_SHORT, 'password');
  assert.equal(parseRegistration({ email: 'a@b.co', password: 'x'.repeat(PASSWORD_MIN_LENGTH), name: 'A' }).password.length, PASSWORD_MIN_LENGTH);
});

test('the email shape and the name are enforced on the server with the authored messages; the fields are normalized', () => {
  refuses(() => parseRegistration({ email: 'not-an-email', password: 'longenough', name: 'A' }), 400, EMAIL_INVALID, 'email');
  refuses(() => parseRegistration({ email: 'a@b', password: 'longenough', name: 'A' }), 400, EMAIL_INVALID, 'email');
  refuses(() => parseRegistration({ email: 'a@b.co', password: 'longenough', name: '   ' }), 400, NAME_REQUIRED, 'name');
  refuses(() => parseRegistration(null), 400, EMAIL_INVALID, 'email');
  assert.deepEqual(parseRegistration({ email: '  Alex@Example.COM ', password: 'longenough', name: '  Alex   Stuart ' }), { email: 'alex@example.com', password: 'longenough', name: 'Alex Stuart' });
  assert.equal(SIGNUP_LANDING, ANSWERS_HOME);
});

// ── sign-up: identical for a new and a taken email ───────────────────────────

test('new vs taken email produce byte-identical responses — status, body, headers, no cookie — and each sends exactly one email of the right kind', async () => {
  const fresh = fakeDeps();
  const taken = fakeDeps({ existing: true });
  const body = { email: 'Someone@Example.com', password: 'longenough', name: 'Some One' };
  const a = await signupOutcome(fresh.deps, body);
  const b = await signupOutcome(taken.deps, body);

  assert.equal(JSON.stringify(a.response), JSON.stringify(b.response), 'the same bytes');
  assert.equal(a.response.status, 200);
  assert.deepEqual(a.response.body, { message: CHECK_EMAIL_MESSAGE });
  assert.equal(CHECK_EMAIL_MESSAGE, 'Check your email to finish signing in.');
  assert.deepEqual(Object.keys(a.response.headers), [], 'no header — and no cookie — either way');
  assert.equal(a.response, SIGNUP_RESPONSE, 'the ONE frozen response object');
  assert.equal(b.response, SIGNUP_RESPONSE);
  assert.ok(Object.isFrozen(SIGNUP_RESPONSE) && Object.isFrozen(SIGNUP_RESPONSE.body));
  assert.equal(a.path, 'new');
  assert.equal(b.path, 'taken');

  // the new path: one verify mail carrying the link, one token stored hashed, one user
  assert.equal(fresh.calls.mail.length, 1);
  assert.equal(fresh.calls.mail[0].kind, 'verify');
  assert.equal(fresh.calls.mail[0].to, 'someone@example.com');
  assert.equal(fresh.calls.mail[0].name, 'Some One');
  const minted = fresh.minted()!;
  assert.equal(fresh.calls.mail[0].verifyUrl, `https://templestuart.com/api/auth/verify?token=${encodeURIComponent(minted.token)}`);
  assert.deepEqual(fresh.calls.stored, [{ userId: 'user-new', hash: hashToken('random-part-for-the-test-0000000000'), expiresAt: new Date('2026-09-09T00:00:00Z') }]);
  assert.equal(fresh.calls.stored[0].hash, minted.hash);
  assert.ok(!fresh.calls.stored[0].hash.includes('random-part'), 'the database never holds the link');
  assert.equal(fresh.calls.create.length, 1);
  assert.deepEqual(fresh.calls.hash, ['longenough']);

  // the taken path: one "taken" mail, nothing created or stored, the same bcrypt cost paid on a dummy
  assert.equal(taken.calls.mail.length, 1);
  assert.equal(taken.calls.mail[0].kind, 'taken');
  assert.equal(taken.calls.mail[0].to, 'someone@example.com');
  assert.equal(taken.calls.mail[0].verifyUrl, undefined);
  assert.equal(taken.calls.create.length, 0);
  assert.equal(taken.calls.stored.length, 0);
  assert.equal(taken.calls.hash.length, 1, 'the dummy hash');
  assert.notEqual(taken.calls.hash[0], 'longenough', 'never the real password on the taken path');
});

test('a mail failure changes nothing in the response on either path — it is declared to the sender\'s log, not to the caller', async () => {
  const body = { email: 'a@b.co', password: 'longenough', name: 'A' };
  const freshFail = fakeDeps({ mail: { sent: false, error: 'EmailConfigError' } });
  const takenFail = fakeDeps({ existing: true, mail: { sent: false, error: 'EmailConfigError' } });
  const a = await signupOutcome(freshFail.deps, body);
  const b = await signupOutcome(takenFail.deps, body);
  assert.equal(JSON.stringify(a.response), JSON.stringify(b.response));
  assert.equal(JSON.stringify(a.response), JSON.stringify(SIGNUP_RESPONSE));
  assert.deepEqual(a.mail, { sent: false, error: 'EmailConfigError' });
  assert.equal(freshFail.calls.create.length, 1, 'the account exists; the link can be resent');
});

test('timing: the new and the taken path take the same wall time within tolerance (both pay one hash, one send)', async () => {
  const HASH_MS = 40;
  const TOLERANCE_MS = 40;
  const body = { email: 'a@b.co', password: 'longenough', name: 'A' };
  const time = async (existing: boolean) => {
    const { deps } = fakeDeps({ existing, hashDelayMs: HASH_MS });
    const t0 = process.hrtime.bigint();
    await signupOutcome(deps, body);
    return Number(process.hrtime.bigint() - t0) / 1e6;
  };
  const median = (xs: number[]) => xs.slice().sort((x, y) => x - y)[Math.floor(xs.length / 2)];
  const fresh = median([await time(false), await time(false), await time(false)]);
  const taken = median([await time(true), await time(true), await time(true)]);
  assert.ok(fresh >= HASH_MS && taken >= HASH_MS, `both paid the hash (${fresh.toFixed(1)}ms / ${taken.toFixed(1)}ms)`);
  assert.ok(Math.abs(fresh - taken) <= TOLERANCE_MS, `new ${fresh.toFixed(1)}ms vs taken ${taken.toFixed(1)}ms — within ${TOLERANCE_MS}ms`);
});

// ── the mails ───────────────────────────────────────────────────────────────

test('the verification email carries the link first, then what the deck says — the front door, the free set and the offers from their sources; the taken email promises no reset that does not exist', () => {
  const v = verificationEmail({ name: 'Ada <Lovelace>', verifyUrl: 'https://templestuart.com/api/auth/verify?token=abc.def', baseUrl: 'https://templestuart.com/' });
  assert.equal(v.subject, 'Finish signing in to Temple Stuart');
  assert.ok(v.text.indexOf('https://templestuart.com/api/auth/verify?token=abc.def') < v.text.indexOf('https://templestuart.com/answers'), 'the link comes first');
  assert.ok(v.text.includes('works once and for 24 hours'));
  for (const t of FREE_TOOLS) assert.ok(v.text.includes(t.name), `free tool ${t.name} named`);
  for (const o of OFFERS) assert.ok(v.text.includes(o.label), `offer ${o.label} named`);
  assert.ok(v.html.includes('Ada &lt;Lovelace&gt;') && !v.html.includes('<Lovelace>'));
  assert.ok(v.text.includes('not a CPA firm'));
  assert.ok(v.text.includes('nothing is signed in until the link is used'));

  const t = takenEmail({ baseUrl: 'https://templestuart.com' });
  assert.equal(t.subject, 'Someone tried to sign up with your Temple Stuart address');
  assert.ok(t.text.includes('https://templestuart.com/login'));
  assert.ok(t.text.includes('no self-service reset yet'), 'says so — the product has none');
  assert.ok(!/reset your password at|\/reset/.test(t.text), 'no reset link is promised');
  assert.ok(t.text.includes('no one was signed in'));
  assert.equal(renderAuthMail({ kind: 'taken', to: 'a@b.co' }, 'https://templestuart.com').subject, t.subject);
  assert.throws(() => renderAuthMail({ kind: 'verify', to: 'a@b.co' }, 'https://templestuart.com'), /needs the name and the link/);
});

test('sendAuthMail: one send through the given sender; a config or provider failure is logged with its class and declared, never thrown', async () => {
  const sent: unknown[] = [];
  const logged: Array<[string, Record<string, unknown>]> = [];
  const log = (m: string, d: Record<string, unknown>) => { logged.push([m, d]); };
  const mail: AuthMail = { kind: 'verify', to: 'a@b.co', name: 'A', verifyUrl: 'https://templestuart.com/api/auth/verify?token=x.y' };

  const ok = await sendAuthMail(mail, 'https://templestuart.com', async (input) => { sent.push(input); return { id: 'msg-9' }; }, log);
  assert.deepEqual(ok, { sent: true, id: 'msg-9' });
  assert.equal(sent.length, 1);
  assert.equal((sent[0] as { to: string }).to, 'a@b.co');
  assert.equal(logged.length, 0);

  const missing = await sendAuthMail(mail, 'https://templestuart.com', async () => { throw new EmailConfigError('RESEND_API_KEY'); }, log);
  assert.deepEqual(missing, { sent: false, error: 'EmailConfigError' });
  assert.deepEqual(logged[0], ['[signup] verify mail NOT sent (the response is unchanged):', { errorClass: 'EmailConfigError', message: 'RESEND_API_KEY is not configured' }]);

  const refused = await sendAuthMail({ kind: 'taken', to: 'a@b.co' }, 'https://templestuart.com', async () => { throw new EmailSendError('validation_error: bad from'); }, log);
  assert.deepEqual(refused, { sent: false, error: 'EmailSendError' });
  assert.equal(logged.length, 2);
  assert.match(logged[1][0], /taken mail NOT sent/);
});
