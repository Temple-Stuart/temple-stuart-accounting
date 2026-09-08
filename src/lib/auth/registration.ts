import { ValidationError } from '@/lib/errors/ValidationError';
import { ANSWERS_HOME } from '@/lib/answers';

/**
 * SELL-03 — ONE front door, an honest sign-up.
 *
 * The rules a registration must meet live HERE and nowhere else: the client
 * (LoginBox, the developer page) reads PASSWORD_MIN_LENGTH for its own hint
 * and the server enforces the same number through parseRegistration — the
 * two can no longer disagree. Every refusal is a ValidationError with the
 * authored message, answered verbatim at 400 (409 for an account that
 * already exists). Every completion lands on ANSWERS_HOME.
 *
 * registerAccount is the whole sign-up over a small port (RegistrationDeps)
 * so it runs hermetically in node:test: parse → refuse a taken email → hash →
 * create → ONE welcome-email attempt whose failure is declared in the body
 * and never blocks the sign-in → the cookie email for the route to sign.
 * Pure of prisma, bcrypt and Resend.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const NAME_MAX_LENGTH = 100;
export const PASSWORD_TOO_SHORT = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
export const EMAIL_INVALID = 'Enter a valid email address';
export const NAME_REQUIRED = 'Name is required';
export const ACCOUNT_EXISTS = 'There is already an account for this email — sign in instead';
/** What the sign-up answers, because it is what happens: the cookie is set and the front door opens. */
export const SIGNED_IN_MESSAGE = "You're signed in";
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

export type WelcomeSendResult = { sent: true; id: string } | { sent: false; error: string };

export interface RegistrationDeps {
  findUserByEmail(email: string): Promise<{ id: string } | null>;
  hashPassword(password: string): Promise<string>;
  newId(): string;
  createUser(user: { id: string; email: string; password: string; name: string }): Promise<{ id: string; email: string; name: string }>;
  /** ONE attempt; a failure is a declared result, never a throw that blocks the sign-in (sendWelcomeEmail keeps that contract). */
  sendWelcome(input: { to: string; name: string }): Promise<WelcomeSendResult>;
}

export interface RegistrationBody {
  message: typeof SIGNED_IN_MESSAGE;
  landing: typeof SIGNUP_LANDING;
  user: { id: string; email: string; name: string };
  welcomeEmail: WelcomeSendResult;
}

export interface RegistrationOutcome {
  body: RegistrationBody;
  /** The email the route signs into the userEmail cookie. */
  cookieEmail: string;
}

export async function registerAccount(deps: RegistrationDeps, body: unknown): Promise<RegistrationOutcome> {
  const reg = parseRegistration(body);
  const existing = await deps.findUserByEmail(reg.email);
  if (existing) {
    throw new ValidationError(ACCOUNT_EXISTS, { status: 409, field: 'email' });
  }
  const password = await deps.hashPassword(reg.password);
  const user = await deps.createUser({ id: deps.newId(), email: reg.email, password, name: reg.name });

  // The welcome email: attempted ONCE, after the account exists; its failure
  // is a fact in the body, never a reason the sign-in fails.
  let welcomeEmail: WelcomeSendResult;
  try {
    welcomeEmail = await deps.sendWelcome({ to: user.email, name: user.name });
  } catch (err) {
    welcomeEmail = { sent: false, error: err instanceof Error ? err.name : 'UnknownError' };
  }

  return {
    body: { message: SIGNED_IN_MESSAGE, landing: SIGNUP_LANDING, user: { id: user.id, email: user.email, name: user.name }, welcomeEmail },
    cookieEmail: user.email,
  };
}
