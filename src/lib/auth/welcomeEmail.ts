import { sendTransactionalEmail, type TransactionalEmailInput } from '@/lib/email';
import { FREE_TOOLS, OFFERS } from '@/lib/offer';
import { ANSWERS_HOME } from '@/lib/answers';
import { TOKEN_TTL_HOURS, type AuthMail, type MailSendResult } from './verification';

/**
 * SELL-03 / 03b — the sign-up mail, a real one through Resend (src/lib/email.ts).
 *
 * Two kinds, one sender:
 *   verify — the welcome email that carries the verification link (the
 *            link first, then what the deck says: the front door, the free
 *            set and the offers from their sources, never typed);
 *   taken  — "someone tried to sign up with your address": sign in with the
 *            password you have. There is no self-service password reset in
 *            the product today, so the mail does not promise one — it says
 *            to reply and Alex will help.
 *
 * sendAuthMail attempts the send ONCE. A failure (missing RESEND_API_KEY /
 * EMAIL_FROM, a provider refusal, no message id) is DECLARED — logged with
 * the error class and Resend's own message, returned as { sent: false } —
 * and never thrown: the sign-up's response is the same bytes either way.
 */

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DISCLAIMER = 'Temple Stuart is not a CPA firm, tax preparer, or licensed financial advisor. Figures the platform produces are estimates to verify with a qualified professional before filing.';
const WRAP_OPEN = '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f1b2e;max-width:560px">';
const SMALL = 'style="color:#6b6480;font-size:12px"';

function origin(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export function verificationEmail({ name, verifyUrl, baseUrl }: { name: string; verifyUrl: string; baseUrl: string }): RenderedEmail {
  const o = origin(baseUrl);
  const answers = `${o}${ANSWERS_HOME}`;
  const pricing = `${o}/pricing`;
  const free = FREE_TOOLS.map((t) => t.name);
  const sold = OFFERS.map((o2) => o2.label);
  const subject = 'Finish signing in to Temple Stuart';
  const text = [
    `Hi ${name},`,
    `Finish signing in with this link — it works once and for ${TOKEN_TTL_HOURS} hours:`,
    verifyUrl,
    `It opens your front door, ${answers} — the four answers (tax, runway, trading, business) on your own numbers.`,
    `Free with your account: ${free.join(', ')}.`,
    `For sale: ${sold.join(' and ')} — what each includes, and the price when one is set, is at ${pricing}.`,
    DISCLAIMER,
    'If you did not create this account, ignore this message — nothing is signed in until the link is used.',
  ].join('\n\n');
  const html = [
    WRAP_OPEN,
    `<p>Hi ${esc(name)},</p>`,
    `<p>Finish signing in with this link — it works once and for ${TOKEN_TTL_HOURS} hours:</p>`,
    `<p><a href="${esc(verifyUrl)}" style="display:inline-block;padding:10px 16px;background:#3b2a6b;color:#fff;text-decoration:none;font-weight:600">Finish signing in</a></p>`,
    `<p ${SMALL}>Or paste it: ${esc(verifyUrl)}</p>`,
    `<p>It opens your front door, <a href="${esc(answers)}">${esc(answers)}</a> — the four answers (tax, runway, trading, business) on your own numbers.</p>`,
    `<p>Free with your account: ${esc(free.join(', '))}.</p>`,
    `<p>For sale: ${esc(sold.join(' and '))} — what each includes, and the price when one is set, is at <a href="${esc(pricing)}">${esc(pricing)}</a>.</p>`,
    `<p ${SMALL}>${esc(DISCLAIMER)}</p>`,
    `<p ${SMALL}>If you did not create this account, ignore this message — nothing is signed in until the link is used.</p>`,
    '</div>',
  ].join('');
  return { subject, html, text };
}

export function takenEmail({ baseUrl }: { baseUrl: string }): RenderedEmail {
  const o = origin(baseUrl);
  const login = `${o}/login`;
  const subject = 'Someone tried to sign up with your Temple Stuart address';
  const text = [
    'Someone just tried to create a Temple Stuart account with this email address — and there already is one.',
    `If that was you, sign in with the password you have: ${login}`,
    'Forgot the password? There is no self-service reset yet — reply to this message and Alex will help.',
    'If it was not you, nothing has changed: no one was signed in, and no account was created.',
    DISCLAIMER,
  ].join('\n\n');
  const html = [
    WRAP_OPEN,
    '<p>Someone just tried to create a Temple Stuart account with this email address — and there already is one.</p>',
    `<p>If that was you, sign in with the password you have: <a href="${esc(login)}">${esc(login)}</a></p>`,
    '<p>Forgot the password? There is no self-service reset yet — reply to this message and Alex will help.</p>',
    '<p>If it was not you, nothing has changed: no one was signed in, and no account was created.</p>',
    `<p ${SMALL}>${esc(DISCLAIMER)}</p>`,
    '</div>',
  ].join('');
  return { subject, html, text };
}

export type Sender = (input: TransactionalEmailInput) => Promise<{ id: string }>;

export function renderAuthMail(mail: AuthMail, baseUrl: string): RenderedEmail {
  if (mail.kind === 'verify') {
    if (!mail.verifyUrl || !mail.name) throw new Error('a verify mail needs the name and the link');
    return verificationEmail({ name: mail.name, verifyUrl: mail.verifyUrl, baseUrl });
  }
  return takenEmail({ baseUrl });
}

export async function sendAuthMail(
  mail: AuthMail,
  baseUrl: string,
  send: Sender = sendTransactionalEmail,
  log: (message: string, detail: Record<string, unknown>) => void = console.error,
): Promise<MailSendResult> {
  const rendered = renderAuthMail(mail, baseUrl);
  try {
    const { id } = await send({ to: mail.to, subject: rendered.subject, html: rendered.html, text: rendered.text, ...(mail.kind === 'taken' && process.env.OWNER_EMAIL ? { replyTo: process.env.OWNER_EMAIL } : {}) });
    return { sent: true, id };
  } catch (err) {
    const errorClass = err instanceof Error ? err.name : 'UnknownError';
    const message = err instanceof Error ? err.message : String(err);
    // Declared, not swallowed: the class and Resend's own words reach the log; the response is the same bytes either way.
    log(`[signup] ${mail.kind} mail NOT sent (the response is unchanged):`, { errorClass, message });
    return { sent: false, error: errorClass };
  }
}
