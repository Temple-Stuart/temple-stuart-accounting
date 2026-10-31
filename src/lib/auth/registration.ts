import { ValidationError } from '@/lib/errors/ValidationError';
import { ANSWERS_HOME } from '@/lib/answers';

/**
 * SELL-03 — ONE front door, an honest sign-up.
 *
 * The rules a registration must meet live HERE and nowhere else: the client
 * (LoginBox, the developer page) reads PASSWORD_MIN_LENGTH for its own hint
 * and the server enforces the same number through parseRegistration — the
 * two can no longer disagree. Every refusal is a ValidationError with the
 * authored message, answered verbatim at 400. These rules are about the
 * INPUT, so a refusal says nothing about any account (SELL-03b: the sign-up
 * itself is non-enumerating — src/lib/auth/verification.ts).
 *
 * Every completion — the verification link, a login, OAuth — lands on
 * SIGNUP_LANDING, the one front door.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MAX_LENGTH = 100;
export const PASSWORD_TOO_SHORT = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
export const EMAIL_INVALID = 'Enter a valid email address';
export const NAME_REQUIRED = 'Name is required';
/** Where every completion lands — the one front door (NAV-01c). */
export const SIGNUP_LANDING = ANSWERS_HOME;

/** The browser's type="email" shape: one @, something on both sides, a dot in the domain, no whitespace. */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface Registration {
  email: string;
  password: string;
  name: string;
}

/** The three fields, normalized: email lower-cased and trimmed, name trimmed and single-spaced, password verbatim. */
export function parseRegistration(body: unknown): Registration {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const email = typeof b.email === 'string' ? b.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !EMAIL_SHAPE.test(email)) {
    throw new ValidationError(EMAIL_INVALID, { status: 400, field: 'email' });
  }
  const password = typeof b.password === 'string' ? b.password : '';
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new ValidationError(PASSWORD_TOO_SHORT, { status: 400, field: 'password' });
  }
  const name = typeof b.name === 'string' ? b.name.trim().replace(/\s+/g, ' ') : '';
  if (!name) throw new ValidationError(NAME_REQUIRED, { status: 400, field: 'name' });
  if (name.length > NAME_MAX_LENGTH) {
    throw new ValidationError(`Name is longer than ${NAME_MAX_LENGTH} characters`, { status: 400, field: 'name' });
  }
  return { email, password, name };
}
