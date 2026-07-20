import { Resend } from 'resend';

// ─── Transactional email via Resend (PR-Email-2) ─────────────────────────────
// Fail-loud mandate, same contract as the travel provider clients
// (travelErrors.ts): missing config THROWS EmailConfigError — there is NO
// default from-address and NO silent skip. A failed provider send THROWS
// EmailSendError carrying Resend's own message — no retry, no queue, no
// alternate transport. Callers decide what a failure means for their flow.
// Env is read at CALL time (not module load) so importing this module can
// never throw and a config fix needs no code change.

/** Thrown when RESEND_API_KEY or EMAIL_FROM is unset/empty. Carries which one
 *  so the log/banner can name the exact env var the operator needs to set. */
export class EmailConfigError extends Error {
  readonly source = 'resend' as const;
  readonly kind = 'missing_config' as const;
  constructor(public missing: 'RESEND_API_KEY' | 'EMAIL_FROM') {
    super(`${missing} is not configured`);
    this.name = 'EmailConfigError';
  }
}

/** Thrown when Resend rejects the send (auth, validation, rate-limit, 5xx) or
 *  returns no message id. Includes Resend's error name + message (truncated)
 *  so the operator sees the actual provider reason. */
export class EmailSendError extends Error {
  readonly source = 'resend' as const;
  readonly kind = 'send_error' as const;
  constructor(public providerMessage: string) {
    super(`Resend send failed — ${providerMessage.substring(0, 200)}`);
    this.name = 'EmailSendError';
  }
}

export interface TransactionalEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

/** Send one transactional email. Returns Resend's message id on success;
 *  throws EmailConfigError / EmailSendError otherwise — never a silent skip. */
export async function sendTransactionalEmail(
  input: TransactionalEmailInput
): Promise<{ id: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new EmailConfigError('RESEND_API_KEY');
  const from = process.env.EMAIL_FROM;
  if (!from) throw new EmailConfigError('EMAIL_FROM');

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  });

  if (error) {
    throw new EmailSendError(`${error.name}: ${error.message}`);
  }
  if (!data?.id) {
    // A 2xx without an id is not a verified send — fail loud, never assume.
    throw new EmailSendError('provider returned no message id');
  }
  return { id: data.id };
}
