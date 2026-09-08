import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminConfigError, adminUserId, isAdminUser } from '../admin';

// SELL-05b — the admin id lives in the env (ADMIN_USER_ID); a gate asked while it is unset throws, never guesses.

test('the admin gate throws when ADMIN_USER_ID is unset or blank — it never decides on a guess', () => {
  assert.throws(() => adminUserId(undefined), AdminConfigError);
  assert.throws(() => adminUserId(''), /ADMIN_USER_ID is not set/);
  assert.throws(() => adminUserId('   '), AdminConfigError);
  assert.throws(() => isAdminUser('u_1', undefined), AdminConfigError);
  assert.throws(() => isAdminUser(null, ''), AdminConfigError, 'even a null user asks the gate, and the gate cannot decide');
});

test('with the env set, only that id is the admin', () => {
  assert.equal(adminUserId(' u_admin '), 'u_admin');
  assert.equal(isAdminUser('u_admin', ' u_admin '), true);
  assert.equal(isAdminUser('u_1', 'u_admin'), false);
  assert.equal(isAdminUser(null, 'u_admin'), false);
  assert.equal(isAdminUser(undefined, 'u_admin'), false);
});
