import test from 'node:test';
import assert from 'node:assert/strict';
import { LAPSE_REASONS, LapseRowError, formatEndedOn, isLapseReason, lapseWrite, lapsedFor, lapsedFromRow, lapsedLine, reasonClause, subscriptionIdOfInvoice } from '../lapse';
import { lapseEmail, sendLapseMail } from '../lapseMail';

// LAUNCH-01 LAPSE-01 — a lapsed subscription is told: the row's ended_at/ended_reason, one wording
// shared by the card, the 403 and the mail; the mail through Resend, declared on failure.

const ENDED = new Date('2026-09-09T05:30:00Z');

test('the two lapse reasons; a stored row becomes the wire shape; NULL ended_at → null; an unknown reason throws', () => {
  assert.deepEqual([...LAPSE_REASONS], ['canceled', 'payment_failed']);
  assert.equal(isLapseReason('canceled'), true);
  assert.equal(isLapseReason('cancelled'), false);
  assert.equal(isLapseReason(null), false);
  assert.deepEqual(lapsedFromRow({ categoryKey: 'tab:books', ended_at: ENDED, ended_reason: 'payment_failed' }), { key: 'tab:books', endedAt: '2026-09-09T05:30:00.000Z', reason: 'payment_failed' });
  assert.equal(lapsedFromRow({ categoryKey: 'tab:books', ended_at: null, ended_reason: null }), null);
  assert.throws(() => lapsedFromRow({ categoryKey: 'tab:books', ended_at: ENDED, ended_reason: 'expired' }), (e: unknown) => e instanceof LapseRowError && /'expired' is not a lapse reason/.test((e as Error).message));
});

test('the write: status inactive + when + why (a re-grant clears both — grantEntitlement)', () => {
  assert.deepEqual(lapseWrite('canceled', ENDED), { status: 'inactive', ended_at: ENDED, ended_reason: 'canceled' });
});

test('THE line: "Your subscription ended on <UTC calendar day> — <why>." for both reasons; a bad date throws', () => {
  assert.equal(formatEndedOn(ENDED), 'September 9, 2026');
  assert.equal(formatEndedOn('2026-12-31T23:59:59Z'), 'December 31, 2026');
  assert.equal(reasonClause('canceled'), 'it was canceled');
  assert.equal(reasonClause('payment_failed'), 'a payment failed');
  assert.equal(lapsedLine({ endedAt: ENDED, reason: 'canceled' }), 'Your subscription ended on September 9, 2026 — it was canceled.');
  assert.equal(lapsedLine({ endedAt: '2026-09-09T05:30:00.000Z', reason: 'payment_failed' }), 'Your subscription ended on September 9, 2026 — a payment failed.');
  assert.throws(() => formatEndedOn('not-a-date'), /is not a date/);
});

test('lapsedFor: the most recent lapse among the keys that grant a tab; none → null', () => {
  const lapsed = [
    { key: 'tab:books', endedAt: '2026-08-01T00:00:00.000Z', reason: 'canceled' as const },
    { key: 'bundle:all', endedAt: '2026-09-01T00:00:00.000Z', reason: 'payment_failed' as const },
    { key: 'cat:dinner', endedAt: '2026-09-05T00:00:00.000Z', reason: 'canceled' as const },
  ];
  assert.deepEqual(lapsedFor(['tab:trade', 'tab:books', 'bundle:all'], lapsed), lapsed[1]);
  assert.deepEqual(lapsedFor(['tab:books'], lapsed), lapsed[0]);
  assert.equal(lapsedFor(['tab:travel'], lapsed), null);
  assert.equal(lapsedFor(['tab:books'], []), null);
});

test('subscriptionIdOfInvoice: the current parent.subscription_details shape (id or expanded), the legacy top-level field, none → null', () => {
  assert.equal(subscriptionIdOfInvoice({ parent: { subscription_details: { subscription: 'sub_1' } } }), 'sub_1');
  assert.equal(subscriptionIdOfInvoice({ parent: { subscription_details: { subscription: { id: 'sub_2', object: 'subscription' } } } }), 'sub_2');
  assert.equal(subscriptionIdOfInvoice({ parent: null, subscription: 'sub_3' }), 'sub_3');
  assert.equal(subscriptionIdOfInvoice({ parent: { type: 'quote_details', subscription_details: null } }), null);
  assert.equal(subscriptionIdOfInvoice({ id: 'in_1' }), null);
  assert.equal(subscriptionIdOfInvoice(null), null);
  assert.equal(subscriptionIdOfInvoice('sub_x'), null);
});

const MAIL = { to: 'lapsed@example.com', name: 'Sam <Books>', offerLabel: 'Books', endedAt: ENDED, reason: 'payment_failed' as const };

test('lapseEmail: the subject names the offer; the text carries the line, what stays, the door (origin, no trailing slash) and the card note only on payment_failed; the html escapes the name', () => {
  const r = lapseEmail(MAIL, 'https://www.templestuart.com/');
  assert.equal(r.subject, 'Your Books subscription ended');
  assert.match(r.text, /^Hi Sam <Books>,\n/);
  assert.ok(r.text.includes('Your Books subscription ended on September 9, 2026 — a payment failed.'));
  assert.ok(r.text.includes('Nothing you recorded is deleted'));
  assert.ok(r.text.includes('subscribe again from the locked tab: https://www.templestuart.com\n'));
  assert.ok(r.text.includes('the card you enter at checkout'));
  assert.ok(r.html.includes('Hi Sam &lt;Books&gt;,'));
  assert.ok(r.html.includes('<a href="https://www.templestuart.com">https://www.templestuart.com</a>'));
  const c = lapseEmail({ ...MAIL, reason: 'canceled' }, 'http://localhost:3000');
  assert.ok(c.text.includes('Your Books subscription ended on September 9, 2026 — it was canceled.'));
  assert.ok(!c.text.includes('card you enter'));
  assert.ok(!c.html.includes('card you enter'));
});

test('sendLapseMail: one send with the rendered mail → { sent: true, id }; a throwing sender → { sent: false, error: <class> } and the log names the class and the provider message', async () => {
  const sent: Array<{ to: string; subject: string }> = [];
  const ok = await sendLapseMail(MAIL, 'http://localhost:3000', async (input) => { sent.push({ to: input.to, subject: input.subject }); return { id: 'msg_1' }; });
  assert.deepEqual(ok, { sent: true, id: 'msg_1' });
  assert.deepEqual(sent, [{ to: 'lapsed@example.com', subject: 'Your Books subscription ended' }]);

  const logged: Array<{ message: string; detail: Record<string, unknown> }> = [];
  class EmailConfigError extends Error { name = 'EmailConfigError'; }
  const failed = await sendLapseMail(MAIL, 'http://localhost:3000', async () => { throw new EmailConfigError('RESEND_API_KEY is not configured'); }, (message, detail) => logged.push({ message, detail }));
  assert.deepEqual(failed, { sent: false, error: 'EmailConfigError' });
  assert.equal(logged.length, 1);
  assert.match(logged[0].message, /lapse mail \(payment_failed\) NOT sent — the entitlement write stands/);
  assert.deepEqual(logged[0].detail, { errorClass: 'EmailConfigError', message: 'RESEND_API_KEY is not configured', offer: 'Books' });
});
