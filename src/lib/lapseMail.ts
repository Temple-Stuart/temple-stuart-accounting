import { sendTransactionalEmail, type TransactionalEmailInput } from '@/lib/email';
import type { RenderedEmail } from '@/lib/auth/welcomeEmail';
import type { MailSendResult } from '@/lib/auth/verification';
import { formatEndedOn, reasonClause, type LapseReason } from '@/lib/lapse';

/**
 * LAUNCH-01 LAPSE-01 — the "your subscription ended" mail, a real one through
 * Resend (src/lib/email.ts), sent by the Stripe webhook AFTER the delivery's
 * transaction commits (a mail must never precede the write it announces, and a
 * rolled-back write must never be announced).
 *
 * sendLapseMail attempts the send ONCE. A failure (missing RESEND_API_KEY /
 * EMAIL_FROM, a provider refusal, no message id) is DECLARED — logged with the
 * error class and Resend's own message, returned as { sent: false } — and never
 * thrown: the entitlement write already stands, and Stripe's 200 stands with it.
 */

export interface LapseMail {
  to: string;
  name: string;
  /** The offer's label from src/lib/offer.ts (Books, Everything) — never typed here. */
  offerLabel: string;
  endedAt: Date;
  reason: LapseReason;
}

export type Sender = (input: TransactionalEmailInput) => Promise<{ id: string }>;

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const WRAP_OPEN = '<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.5;color:#1f1b2e;max-width:560px">';

function origin(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

export function lapseEmail(mail: LapseMail, baseUrl: string): RenderedEmail {
  const o = origin(baseUrl);
  // The card's line (src/lib/lapse.ts lapsedLine) with the offer named — same date, same reason clause (no-drift).
  const line = `Your ${mail.offerLabel} subscription ended on ${formatEndedOn(mail.endedAt)} — ${reasonClause(mail.reason)}.`;
  const keeps = `The tools ${mail.offerLabel} unlocks are locked again. Nothing you recorded is deleted — your data stays in your account.`;
  const door = `To pick up where you left off, sign in and subscribe again from the locked tab: ${o}`;
  const card = mail.reason === 'payment_failed'
    ? 'If the card on file has changed, the new subscription uses the card you enter at checkout.'
    : null;
  const subject = `Your ${mail.offerLabel} subscription ended`;
  const text = [
    `Hi ${mail.name},`,
    '',
    line,
    '',
    keeps,
    '',
    door,
    ...(card ? ['', card] : []),
    '',
    '— Temple Stuart',
  ].join('\n');
  const html = [
    WRAP_OPEN,
    `<p>Hi ${esc(mail.name)},</p>`,
    `<p><strong>${esc(line)}</strong></p>`,
    `<p>${esc(keeps)}</p>`,
    `<p>To pick up where you left off, sign in and subscribe again from the locked tab: <a href="${esc(o)}">${esc(o)}</a></p>`,
    ...(card ? [`<p>${esc(card)}</p>`] : []),
    '<p>— Temple Stuart</p>',
    '</div>',
  ].join('');
  return { subject, html, text };
}

export async function sendLapseMail(
  mail: LapseMail,
  baseUrl: string,
  send: Sender = sendTransactionalEmail,
  log: (message: string, detail: Record<string, unknown>) => void = console.error,
): Promise<MailSendResult> {
  const rendered = lapseEmail(mail, baseUrl);
  try {
    const { id } = await send({
      to: mail.to,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      ...(process.env.OWNER_EMAIL ? { replyTo: process.env.OWNER_EMAIL } : {}),
    });
    return { sent: true, id };
  } catch (err) {
    const errorClass = err instanceof Error ? err.name : 'UnknownError';
    const message = err instanceof Error ? err.message : String(err);
    // Declared, not swallowed: the class and Resend's own words reach the log; the row's write stands.
    log(`[stripe] lapse mail (${mail.reason}) NOT sent — the entitlement write stands:`, { errorClass, message, offer: mail.offerLabel });
    return { sent: false, error: errorClass };
  }
}
