import test from 'node:test';
import assert from 'node:assert/strict';
import { RETIRED_SESSION_SECRET, SESSION_SECRET, SecretConfigError, secretGuard } from '../secretGuard';

// LAUNCH-01 SECRET-01 — one secret for the session. Pure over an env record.

test('JWT_SECRET alone passes and names itself as the session secret', () => {
  assert.deepEqual(secretGuard({ JWT_SECRET: 'abc' }), { secret: 'JWT_SECRET' });
  assert.equal(SESSION_SECRET, 'JWT_SECRET');
  assert.equal(RETIRED_SESSION_SECRET, 'NEXTAUTH_SECRET');
});

test('NEXTAUTH_SECRET present → SecretConfigError "set JWT_SECRET instead", even when JWT_SECRET is also set, even when empty', () => {
  for (const env of [
    { NEXTAUTH_SECRET: 'x', JWT_SECRET: 'abc' },
    { NEXTAUTH_SECRET: 'x' },
    { NEXTAUTH_SECRET: '', JWT_SECRET: 'abc' },
  ]) {
    assert.throws(() => secretGuard(env), (e: unknown) => {
      assert.ok(e instanceof SecretConfigError);
      assert.equal(e.name, 'SecretConfigError');
      assert.match(e.message, /^NEXTAUTH_SECRET is retired — set JWT_SECRET instead/);
      return true;
    });
  }
});

test('JWT_SECRET missing or empty (and no retired name) → SecretConfigError naming JWT_SECRET', () => {
  for (const env of [{}, { JWT_SECRET: '' }, { JWT_SECRET: undefined }]) {
    assert.throws(() => secretGuard(env), (e: unknown) => {
      assert.ok(e instanceof SecretConfigError);
      assert.match(e.message, /^JWT_SECRET is not set/);
      return true;
    });
  }
});

test('unrelated variables are ignored', () => {
  assert.deepEqual(secretGuard({ JWT_SECRET: 'abc', NEXTAUTH_URL: 'http://localhost:3000', OTHER: '1' }), { secret: 'JWT_SECRET' });
});
