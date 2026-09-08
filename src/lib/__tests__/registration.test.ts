import test from 'node:test';
import assert from 'node:assert/strict';
import { ValidationError } from '../errors/ValidationError';
import {
  ACCOUNT_EXISTS,
  EMAIL_INVALID,
  NAME_REQUIRED,
  PASSWORD_MIN_LENGTH,
  PASSWORD_TOO_SHORT,
  SIGNED_IN_MESSAGE,
  SIGNUP_LANDING,
  parseRegistration,
  registerAccount,
  type RegistrationDeps,
  type WelcomeSendResult,
} from '../auth/registration';
import { sendWelcomeEmail, welcomeEmail } from '../auth/welcomeEmail';
import { EmailConfigError, EmailSendError } from '../email';
import { ANSWERS_HOME } from '../answers';
import { FREE_TOOLS, OFFERS } from '../offer';

// SELL-03 — one front door, an honest sign-up. Hermetic: the registration
// runs over fake deps (no prisma, no bcrypt, no Resend); the welcome send
// over a fake sender and a fake log.

function fakeDeps(overrides: Partial<RegistrationDeps> & { existing?: boolean; welcome?: WelcomeSendResult | Error } = {}) {
  const calls = { find: [] as string[], hash: [] as string[], create: [] as Array<{ id: string; email: string; password: string; name: string }>, welcome: [] as Array<{ to: string; name: string }> };
  const deps: RegistrationDeps = {
    findUserByEmail: async (email) => { calls.find.push(email); return overrides.existing ? { id: 'user-existing' } : null; },
    hashPassword: async (pw) => { calls.hash.push(pw); return `hashed(${pw})`; },
    newId: () => 'user-new',
    createUser: async (u) => { calls.create.push(u); return { id: u.id, email: u.email, name: u.name }; },
    sendWelcome: async (input) => {
      calls.welcome.push(input);
      const w = overrides.welcome ?? { sent: true, id: 'msg-1' };
      if (w instanceof Error) throw w;
      return w;
    },
    ...Object.fromEntries(Object.entries(overrides).filter(([k]) => !['existing', 'welcome'].includes(k))),
  };
  return { deps, calls };
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

test('password shorter than the rule → 400 with the authored message; the rule is the ONE number the client hints', () => {
  assert.equal(PASSWORD_MIN_LENGTH, 8);
  assert.equal(PASSWORD_TOO_SHORT, 'Password must be at least 8 characters');
  refuses(() => parseRegistration({ email: 'a@b.co', password: 'short12', name: 'A' }), 400, PASSWORD_TOO_SHORT, 'password');
  refuses(() => parseRegistration({ email: 'a@b.co', password: '', name: 'A' }), 400, PASSWORD_TOO_SHORT, 'password');
  refuses(() => parseRegistration({ email: 'a@b.co', name: 'A' }), 400, PASSWORD_TOO_SHORT, 'password');
  // the boundary: exactly the rule passes
  assert.equal(parseRegistration({ email: 'a@b.co', password: 'x'.repeat(PASSWORD_MIN_LENGTH), name: 'A' }).password.length, PASSWORD_MIN_LENGTH);
});

test('the email shape and the name are enforced on the server with the authored messages; the fields are normalized', () => {
  refuses(() => parseRegistration({ email: 'not-an-email', password: 'longenough', name: 'A' }), 400, EMAIL_INVALID, 'email');
  refuses(() => parseRegistration({ email: 'a@b', password: 'longenough', name: 'A' }), 400, EMAIL_INVALID, 'email');
  refuses(() => parseRegistration({ email: 'a b@c.d', password: 'longenough', name: 'A' }), 400, EMAIL_INVALID, 'email');
  refuses(() => parseRegistration({ email: '', password: 'longenough', name: 'A' }), 400, EMAIL_INVALID, 'email');
  refuses(() => parseRegistration({ email: 'a@b.co', password: 'longenough', name: '   ' }), 400, NAME_REQUIRED, 'name');
  refuses(() => parseRegistration(null), 400, EMAIL_INVALID, 'email');
  const reg = parseRegistration({ email: '  Alex@Example.COM ', password: 'longenough', name: '  Alex   Stuart ' });
  assert.deepEqual(reg, { email: 'alex@example.com', password: 'longenough', name: 'Alex Stuart' });
});

test('sign-up → /answers: the body says what happens ("You\'re signed in"), names the one front door, and the cookie email is the created user\'s', async () => {
  const { deps, calls } = fakeDeps();
  const out = await registerAccount(deps, { email: 'New@Example.com', password: 'longenough', name: 'New Person' });
  assert.equal(out.body.message, SIGNED_IN_MESSAGE);
  assert.equal(SIGNED_IN_MESSAGE, "You're signed in");
  assert.equal(out.body.landing, '/answers');
  assert.equal(SIGNUP_LANDING, ANSWERS_HOME);
  assert.equal(out.cookieEmail, 'new@example.com');
  assert.deepEqual(out.body.user, { id: 'user-new', email: 'new@example.com', name: 'New Person' });
  assert.deepEqual(calls.find, ['new@example.com']);
  assert.deepEqual(calls.hash, ['longenough']);
  assert.deepEqual(calls.create, [{ id: 'user-new', email: 'new@example.com', password: 'hashed(longenough)', name: 'New Person' }]);
});

test('the welcome email is attempted exactly once, after the account exists, and a send failure does not fail the sign-up', async () => {
  const ok = fakeDeps();
  const out = await registerAccount(ok.deps, { email: 'a@b.co', password: 'longenough', name: 'A' });
  assert.deepEqual(ok.calls.welcome, [{ to: 'a@b.co', name: 'A' }]);
  assert.deepEqual(out.body.welcomeEmail, { sent: true, id: 'msg-1' });

  // a declared failure from the sender
  const failing = fakeDeps({ welcome: { sent: false, error: 'EmailConfigError' } });
  const out2 = await registerAccount(failing.deps, { email: 'a@b.co', password: 'longenough', name: 'A' });
  assert.equal(out2.body.message, SIGNED_IN_MESSAGE, 'still signed in');
  assert.equal(out2.cookieEmail, 'a@b.co', 'the cookie still gets set');
  assert.deepEqual(out2.body.welcomeEmail, { sent: false, error: 'EmailConfigError' });
  assert.equal(failing.calls.welcome.length, 1, 'attempted once, never retried');
  assert.equal(failing.calls.create.length, 1);

  // a sender that THROWS despite its contract — still declared, still signed in
  const throwing = fakeDeps({ welcome: new EmailSendError('Resend: 500') });
  const out3 = await registerAccount(throwing.deps, { email: 'a@b.co', password: 'longenough', name: 'A' });
  assert.deepEqual(out3.body.welcomeEmail, { sent: false, error: 'EmailSendError' });
  assert.equal(out3.body.landing, '/answers');
  assert.equal(throwing.calls.welcome.length, 1);
});

test('a taken email is refused honestly (409, the authored message) — nothing created, no email attempted; a bad body never reaches the database', async () => {
  const taken = fakeDeps({ existing: true });
  await assert.rejects(() => registerAccount(taken.deps, { email: 'a@b.co', password: 'longenough', name: 'A' }), (err: unknown) => err instanceof ValidationError && err.status === 409 && err.message === ACCOUNT_EXISTS && err.field === 'email');
  assert.equal(taken.calls.create.length, 0);
  assert.equal(taken.calls.welcome.length, 0);
  const bad = fakeDeps();
  await assert.rejects(() => registerAccount(bad.deps, { email: 'a@b.co', password: 'short', name: 'A' }), (err: unknown) => err instanceof ValidationError && err.status === 400);
  assert.equal(bad.calls.find.length, 0, 'the lookup never ran');
});

test('sendWelcomeEmail: one send through the given sender; a config or provider failure is logged with its class and declared, never thrown', async () => {
  const sent: unknown[] = [];
  const logged: Array<[string, Record<string, unknown>]> = [];
  const log = (m: string, d: Record<string, unknown>) => { logged.push([m, d]); };

  const okResult = await sendWelcomeEmail({ to: 'a@b.co', name: 'A', baseUrl: 'https://templestuart.com/' }, async (input) => { sent.push(input); return { id: 'msg-9' }; }, log);
  assert.deepEqual(okResult, { sent: true, id: 'msg-9' });
  assert.equal(sent.length, 1);
  const input = sent[0] as { to: string; subject: string; html: string; text: string };
  assert.equal(input.to, 'a@b.co');
  assert.equal(input.subject, "Welcome to Temple Stuart — you're signed in");
  assert.match(input.text, /https:\/\/templestuart\.com\/answers/);
  assert.match(input.html, /href="https:\/\/templestuart\.com\/answers"/);
  assert.equal(logged.length, 0);

  const missing = await sendWelcomeEmail({ to: 'a@b.co', name: 'A', baseUrl: 'https://templestuart.com' }, async () => { throw new EmailConfigError('RESEND_API_KEY'); }, log);
  assert.deepEqual(missing, { sent: false, error: 'EmailConfigError' });
  assert.equal(logged.length, 1);
  assert.match(logged[0][0], /welcome email NOT sent/);
  assert.deepEqual(logged[0][1], { errorClass: 'EmailConfigError', message: 'RESEND_API_KEY is not configured' });

  const refused = await sendWelcomeEmail({ to: 'a@b.co', name: 'A', baseUrl: 'https://templestuart.com' }, async () => { throw new EmailSendError('validation_error: bad from'); }, log);
  assert.deepEqual(refused, { sent: false, error: 'EmailSendError' });
  assert.equal(logged.length, 2);
});

test('the welcome email says what the deck says: the front door, the free set and the offers come from their sources, never typed; the name is escaped', () => {
  const r = welcomeEmail({ name: 'Ada <Lovelace>', baseUrl: 'https://templestuart.com' });
  for (const t of FREE_TOOLS) { assert.ok(r.text.includes(t.name), `free tool ${t.name} named`); assert.ok(r.html.includes(t.name)); }
  for (const o of OFFERS) { assert.ok(r.text.includes(o.label), `offer ${o.label} named`); }
  assert.ok(r.text.includes('https://templestuart.com/answers'));
  assert.ok(r.text.includes('https://templestuart.com/pricing'));
  assert.ok(r.html.includes('Ada &lt;Lovelace&gt;'));
  assert.ok(!r.html.includes('<Lovelace>'));
  assert.ok(r.text.includes('not a CPA firm'));
  assert.ok(!/confirm/i.test(r.text), 'no promise of a confirmation step — there is none');
});
