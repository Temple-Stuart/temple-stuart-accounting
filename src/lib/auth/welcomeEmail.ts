import { sendTransactionalEmail, type TransactionalEmailInput } from '@/lib/email';
import { FREE_TOOLS, OFFERS } from '@/lib/offer';
import { ANSWERS_HOME } from '@/lib/answers';
import type { WelcomeSendResult } from './registration';

/**
 * SELL-03 — the welcome email, a real one through Resend (src/lib/email.ts).
 *
 * The words come from the same sources the deck sells from: the front door
 * (ANSWERS_HOME), the free set and the offers (src/lib/offer.ts) — never
 * typed here, so the email cannot outrun the registry. Plain HTML + text.
 *
 * sendWelcomeEmail attempts the send ONCE. A failure (missing RESEND_API_KEY
 * / EMAIL_FROM, a provider refusal, no message id) is DECLARED — logged with
 * the error class and Resend's own message, returned as { sent: false } to
 * the caller's body — and never thrown: the sign-in is not the email's to
 * block (the LiteAPI booking precedent, api/travel/liteapi/book/route.ts).
 */

export interface WelcomeEmailInput {
  name: string;
  /** The site's absolute origin for the links (NEXT_PUBLIC_APP_URL). */
  baseUrl: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function welcomeEmail({ name, baseUrl }: WelcomeEmailInput): RenderedEmail {
  const origin = baseUrl.replace(/\/+$/, '');
  const answers = `${origin}${ANSWERS_HOME}`;
  const pricing = `${origin}/pricing`;
  const free = FREE_TOOLS.map((t) => t.name);
  const sold = OFFERS.map((o) => o.label);
  const subject = "Welcome to Temple Stuart — you're signed in";
  const lines = [
    `Hi ${name},`,
    `Your account is open and you are signed in. Your front door is ${answers} — the four answers (tax, runway, trading, business) on your own numbers.`,
    `Free with your account: ${free.join(', ')}.`,
    `For sale: ${sold.join(' and ')} — what each includes, and the price when one is set, is at ${pricing}.`,
    'Temple Stuart is not a CPA firm, tax preparer, or licensed financial advisor. Figures the platform produces are estimates to verify with a qualified professional before filing.',
    'You are receiving this because an account was created with this address.',
  ];
  const text = lines.join('\n\n');
  const html = [
    '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f1b2e;max-width:560px">',
    `<p>Hi ${esc(name)},</p>`,
    `<p>Your account is open and you are signed in. Your front door is <a href="${esc(answers)}">${esc(answers)}</a> — the four answers (tax, runway, trading, business) on your own numbers.</p>`,
    `<p>Free with your account: ${esc(free.join(', '))}.</p>`,
    `<p>For sale: ${esc(sold.join(' and '))} — what each includes, and the price when one is set, is at <a href="${esc(pricing)}">${esc(pricing)}</a>.</p>`,
    '<p style="color:#6b6480;font-size:12px">Temple Stuart is not a CPA firm, tax preparer, or licensed financial advisor. Figures the platform produces are estimates to verify with a qualified professional before filing.</p>',
    '<p style="color:#6b6480;font-size:12px">You are receiving this because an account was created with this address.</p>',
    '</div>',
  ].join('');
  return { subject, html, text };
}

export type Sender = (input: TransactionalEmailInput) => Promise<{ id: string }>;

export async function sendWelcomeEmail(
  input: { to: string; name: string; baseUrl: string },
  send: Sender = sendTransactionalEmail,
  log: (message: string, detail: Record<string, unknown>) => void = console.error,
): Promise<WelcomeSendResult> {
  const rendered = welcomeEmail({ name: input.name, baseUrl: input.baseUrl });
  try {
    const { id } = await send({ to: input.to, subject: rendered.subject, html: rendered.html, text: rendered.text });
    return { sent: true, id };
  } catch (err) {
    const errorClass = err instanceof Error ? err.name : 'UnknownError';
    const message = err instanceof Error ? err.message : String(err);
    // Declared, not swallowed: the class and Resend's own words reach the log; the caller's body says sent: false.
    log('[signup] welcome email NOT sent (the account and the sign-in stand):', { errorClass, message });
    return { sent: false, error: errorClass };
  }
}
