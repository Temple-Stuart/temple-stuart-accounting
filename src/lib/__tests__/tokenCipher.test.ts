import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import {
  decryptToken,
  encryptToken,
  isCiphertext,
  TokenCipherError,
  TokenCipherKeyError,
  TokenNotEncryptedError,
} from '../secrets/tokenCipher';

// SEC-02 — provider tokens at rest. Hermetic: the key is generated in-process.
// Proves the round trip, the stored form, that tamper and plaintext both throw
// (no dual-read path), and that the key is required at first use.

const KEY = randomBytes(32).toString('base64');
const STORED_FORM = /^enc:v1:[A-Za-z0-9_-]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/;

function withKey(key: string | undefined, keyId: string | undefined, fn: () => void) {
  const prev = { key: process.env.TOKEN_ENCRYPTION_KEY, id: process.env.TOKEN_ENCRYPTION_KEY_ID };
  if (key === undefined) delete process.env.TOKEN_ENCRYPTION_KEY; else process.env.TOKEN_ENCRYPTION_KEY = key;
  if (keyId === undefined) delete process.env.TOKEN_ENCRYPTION_KEY_ID; else process.env.TOKEN_ENCRYPTION_KEY_ID = keyId;
  try {
    fn();
  } finally {
    if (prev.key === undefined) delete process.env.TOKEN_ENCRYPTION_KEY; else process.env.TOKEN_ENCRYPTION_KEY = prev.key;
    if (prev.id === undefined) delete process.env.TOKEN_ENCRYPTION_KEY_ID; else process.env.TOKEN_ENCRYPTION_KEY_ID = prev.id;
  }
}

test('round trip: encrypt then decrypt returns the plaintext', () => {
  withKey(KEY, 'k1', () => {
    const plain = 'access-production-0f3c9a2e-1b4d-4c8e-9a7f-2d6e5b4c3a1f';
    const stored = encryptToken(plain);
    assert.match(stored, STORED_FORM);
    assert.equal(isCiphertext(stored), true);
    assert.equal(decryptToken(stored), plain);
  });
});

test('stored form parts: 12-byte iv, 16-byte tag, key id embedded', () => {
  withKey(KEY, 'k1', () => {
    const [prefix, version, keyId, iv, tag] = encryptToken('t').split(':');
    assert.equal(`${prefix}:${version}`, 'enc:v1');
    assert.equal(keyId, 'k1');
    assert.equal(Buffer.from(iv, 'base64').length, 12);
    assert.equal(Buffer.from(tag, 'base64').length, 16);
  });
});

test('fresh iv per call: the same plaintext never encrypts to the same ciphertext', () => {
  withKey(KEY, 'k1', () => {
    assert.notEqual(encryptToken('same'), encryptToken('same'));
  });
});

test('tamper: a flipped ciphertext byte throws TokenCipherError', () => {
  withKey(KEY, 'k1', () => {
    const stored = encryptToken('a-real-token-value');
    const parts = stored.split(':');
    const ct = Buffer.from(parts[5], 'base64');
    ct[0] ^= 0x01;
    parts[5] = ct.toString('base64');
    assert.throws(() => decryptToken(parts.join(':')), TokenCipherError);
  });
});

test('tamper: a flipped auth-tag byte throws TokenCipherError', () => {
  withKey(KEY, 'k1', () => {
    const stored = encryptToken('a-real-token-value');
    const parts = stored.split(':');
    const tag = Buffer.from(parts[4], 'base64');
    tag[3] ^= 0x80;
    parts[4] = tag.toString('base64');
    assert.throws(() => decryptToken(parts.join(':')), TokenCipherError);
  });
});

test('tamper: a swapped key id throws TokenCipherError', () => {
  withKey(KEY, 'k1', () => {
    const stored = encryptToken('a-real-token-value').replace('enc:v1:k1:', 'enc:v1:k2:');
    assert.throws(() => decryptToken(stored), TokenCipherError);
  });
});

test('wrong key: ciphertext from another key fails authentication', () => {
  let stored = '';
  withKey(KEY, 'k1', () => { stored = encryptToken('a-real-token-value'); });
  withKey(randomBytes(32).toString('base64'), 'k1', () => {
    assert.throws(() => decryptToken(stored), TokenCipherError);
  });
});

test('plaintext handed to a reader throws TokenNotEncryptedError — no dual-read path', () => {
  withKey(KEY, 'k1', () => {
    assert.equal(isCiphertext('access-production-plaintext'), false);
    assert.throws(() => decryptToken('access-production-plaintext'), TokenNotEncryptedError);
    assert.throws(() => decryptToken(''), TokenNotEncryptedError);
  });
});

test('malformed ciphertext throws TokenCipherError', () => {
  withKey(KEY, 'k1', () => {
    assert.throws(() => decryptToken('enc:v1:k1:only-two-parts'), TokenCipherError);
    assert.throws(() => decryptToken('enc:v1:k1:AAAA:BBBB:CCCC'), TokenCipherError);
  });
});

test('empty plaintext and double encryption are refused', () => {
  withKey(KEY, 'k1', () => {
    assert.throws(() => encryptToken(''), TokenCipherError);
    assert.throws(() => encryptToken(encryptToken('x')), TokenCipherError);
  });
});

test('missing key throws TokenCipherKeyError at first use', () => {
  withKey(undefined, 'k1', () => {
    assert.throws(() => encryptToken('x'), TokenCipherKeyError);
    assert.throws(() => decryptToken('enc:v1:k1:AAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAA==:AA=='), TokenCipherKeyError);
  });
});

test('short key and missing or bad key id throw TokenCipherKeyError', () => {
  withKey(randomBytes(16).toString('base64'), 'k1', () => {
    assert.throws(() => encryptToken('x'), TokenCipherKeyError);
  });
  withKey(KEY, undefined, () => {
    assert.throws(() => encryptToken('x'), TokenCipherKeyError);
  });
  withKey(KEY, 'has:colon', () => {
    assert.throws(() => encryptToken('x'), TokenCipherKeyError);
  });
});
