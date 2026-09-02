/**
 * SEC-02 — provider tokens at rest.
 *
 * The two stored provider secrets (plaid_items.accessToken and
 * tastytrade_connections.sessionToken) are written ONLY through encryptToken()
 * and read ONLY through decryptToken(). No other module touches the raw column
 * value. Readers accept ciphertext only: a plaintext value throws — there is no
 * dual-read path, by rule (a dual read is fallback logic).
 *
 * Stored form:  enc:v1:<keyId>:<iv>:<tag>:<ct>   (base64 parts; base64 never
 * contains ':' so the split is unambiguous). AES-256-GCM, 12-byte random IV,
 * 16-byte auth tag, the header `enc:v1:<keyId>` bound as AAD so a swapped key id
 * fails authentication.
 *
 * Key: TOKEN_ENCRYPTION_KEY (base64 of exactly 32 bytes) and
 * TOKEN_ENCRYPTION_KEY_ID (short id, [A-Za-z0-9_-]). Both are read at FIRST USE,
 * not at import, so `next build` and any page-data collection that imports a
 * route never needs the key; a missing or short key throws TokenCipherKeyError
 * on the first encrypt/decrypt call.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

/** The key material is missing, malformed, or the wrong length. */
export class TokenCipherKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenCipherKeyError';
  }
}

/** A reader was handed a value that is not in the stored ciphertext form. */
export class TokenNotEncryptedError extends Error {
  constructor(message = 'token not encrypted') {
    super(message);
    this.name = 'TokenNotEncryptedError';
  }
}

/** Malformed ciphertext, key-id mismatch, or failed authentication (tamper / wrong key). */
export class TokenCipherError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TokenCipherError';
  }
}

function loadKey(): { key: Buffer; keyId: string } {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  const keyId = process.env.TOKEN_ENCRYPTION_KEY_ID;
  if (!raw) throw new TokenCipherKeyError('TOKEN_ENCRYPTION_KEY is not set');
  if (!keyId) throw new TokenCipherKeyError('TOKEN_ENCRYPTION_KEY_ID is not set');
  if (!KEY_ID_PATTERN.test(keyId)) {
    throw new TokenCipherKeyError('TOKEN_ENCRYPTION_KEY_ID must match [A-Za-z0-9_-]+ (it is embedded in the stored form)');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new TokenCipherKeyError(`TOKEN_ENCRYPTION_KEY must be base64 of exactly ${KEY_BYTES} bytes (decoded ${key.length})`);
  }
  return { key, keyId };
}

/** True when the value is in the stored ciphertext form. Never throws. */
export function isCiphertext(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

/** Encrypt a plaintext provider token for storage. Refuses empty input and double encryption. */
export function encryptToken(plain: string): string {
  if (typeof plain !== 'string' || plain.length === 0) {
    throw new TokenCipherError('refusing to encrypt an empty token');
  }
  if (isCiphertext(plain)) {
    throw new TokenCipherError('refusing to encrypt a value that is already ciphertext');
  }
  const { key, keyId } = loadKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  cipher.setAAD(Buffer.from(`${PREFIX}${keyId}`, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${keyId}:${iv.toString('base64')}:${tag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/** Decrypt a stored provider token. Throws on plaintext, malformed input, key-id mismatch, or tamper. */
export function decryptToken(stored: string): string {
  if (!isCiphertext(stored)) {
    throw new TokenNotEncryptedError();
  }
  const parts = stored.slice(PREFIX.length).split(':');
  if (parts.length !== 4) {
    throw new TokenCipherError('malformed ciphertext: expected enc:v1:<keyId>:<iv>:<tag>:<ct>');
  }
  const [keyId, ivB64, tagB64, ctB64] = parts;
  const { key, keyId: activeKeyId } = loadKey();
  if (keyId !== activeKeyId) {
    throw new TokenCipherError(`ciphertext key id "${keyId}" does not match TOKEN_ENCRYPTION_KEY_ID "${activeKeyId}"`);
  }
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const ciphertext = Buffer.from(ctB64, 'base64');
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new TokenCipherError('malformed ciphertext: bad iv or tag length');
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_BYTES });
  decipher.setAAD(Buffer.from(`${PREFIX}${keyId}`, 'utf8'));
  decipher.setAuthTag(tag);
  try {
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    throw new TokenCipherError('ciphertext authentication failed (tampered, or encrypted under a different key)');
  }
}
