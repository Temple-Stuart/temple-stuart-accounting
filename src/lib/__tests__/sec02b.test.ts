/**
 * SEC-02b (2026-09-27) — three things SEC-02 found, as Alex ruled them.
 *
 *   1. The stay is the vendor's: a book answer that states its dates and name is
 *      stored as stated and the link's are never read; one that does not is NULL
 *      with a named log by bookingId — and every reader of a NULL day holds.
 *   2. No route response carries a password hash: the RSVP POST (and the trip
 *      reads that pulled participants whole) answer through one explicit select.
 *   3. Every bearer route refuses a wrong secret and accepts the right one, through
 *      constantTimeEqual.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest } from 'next/server';
import { code, functionBody } from '../sourceText';
import { parseBookResult } from '../liteapiClient';
import { bookedStay, dayOfColumn, statedStayDay, unstatedStayLine } from '../reservations/stayDates';
import { DAY_NOT_STATED, bookingConfirmation } from '../emailTemplates/bookingConfirmation';
import { stayCalendarDecision } from '../calendar/bookingEvent';
import { passwordLeaks, passwordSchema } from '../security/passwordLaw';
import { PARTICIPANT_RESPONSE_SELECT } from '../trips/participantSelect';
import { constantTimeEqual } from '../webhooks/liteapiWebhook';
import { GET as refreshGET } from '../../app/api/cron/reservations-refresh/route';
import { POST as categorizePOST } from '../../app/api/cron/auto-categorize/route';
import { POST as auditIngestPOST } from '../../app/api/operations/projects/[id]/audit-ingest/route';
import { POST as execIngestPOST } from '../../app/api/operations/projects/[id]/exec-ingest/route';

const BOOK = 'src/app/api/travel/liteapi/book/route.ts';
const CONFIRM = 'src/app/booking/confirm/page.tsx';

function routes(dir = 'src/app/api'): string[] {
  const out: string[] = [];
  for (const name of readdirSync(resolve(process.cwd(), dir))) {
    const rel = `${dir}/${name}`;
    if (statSync(resolve(process.cwd(), rel)).isDirectory()) out.push(...routes(rel));
    else if (name === 'route.ts') out.push(rel);
  }
  return out;
}

// ── 1 · THE STAY IS THE VENDOR'S ─────────────────────────────────────────────

test('SEC-02b · a book answer WITH dates and a name → the vendor\'s dates and name are stored; the link\'s are never read', () => {
  // The booking object as the vendor answers it (parseBookResult reads checkin, checkout, hotel.name).
  const answer = parseBookResult({ bookingId: 'bk-stated', status: 'CONFIRMED', checkin: '2026-10-02', checkout: '2026-10-05', hotel: { name: 'Hotel As Stated' }, price: 412.5, currency: 'EUR' });
  const stay = bookedStay(answer);
  assert.equal(stay.hotelName, 'Hotel As Stated');
  assert.equal(stay.checkinDate?.toISOString(), '2026-10-02T12:00:00.000Z', 'noon UTC — the route\'s @db.Date convention');
  assert.equal(stay.checkoutDate?.toISOString(), '2026-10-05T12:00:00.000Z');
  assert.deepEqual(stay.unstated, []);
  assert.equal(dayOfColumn(stay.checkinDate), '2026-10-02');
  assert.equal(dayOfColumn(stay.checkoutDate), '2026-10-05');
  // The link cannot reach the leaf: it takes the answer and nothing else.
  assert.equal(bookedStay.length, 1);
  // And the route reads no date or name from its body — the old body's fields are
  // not declared, not destructured, not read; the row takes stay.* only.
  const b = code(BOOK);
  const iface = /interface BookRequestBody \{([\s\S]*?)\}/.exec(b)![1];
  assert.doesNotMatch(iface, /\b(checkinDate|checkoutDate|hotelName)\b/);
  assert.doesNotMatch(/const \{([^}]*)\} = body;/.exec(b)![1], /\b(checkinDate|checkoutDate|hotelName)\b/);
  assert.doesNotMatch(b, /\bbody\s*\.\s*(checkinDate|checkoutDate|hotelName)\b/);
  assert.doesNotMatch(b, /checkinDate and checkoutDate are required/, 'the link\'s dates are not required — they are not read');
  assert.ok(b.includes('const stay = bookedStay(parsed);'));
  assert.ok(b.includes('const resolvedHotelName = stay.hotelName;'), 'no `?? hotelName` fallback');
  assert.match(b, /checkinDate: stay\.checkinDate,\s*checkoutDate: stay\.checkoutDate,/);
  assert.match(b, /displayName: resolvedHotelName,/);
  assert.equal((b.match(/checkinDate: dayOfColumn\(result\.checkinDate\),\s*checkoutDate: dayOfColumn\(result\.checkoutDate\),/g) ?? []).length, 3, 'the calendar, the email and the answer read the row\'s day back');
});

test('SEC-02b · a book answer WITHOUT dates → NULL, and the named log says which by bookingId', () => {
  const answer = parseBookResult({ bookingId: 'bk-unstated', status: 'CONFIRMED', price: 100, currency: 'USD' });
  const stay = bookedStay(answer);
  assert.equal(stay.hotelName, null);
  assert.equal(stay.checkinDate, null);
  assert.equal(stay.checkoutDate, null);
  assert.deepEqual(stay.unstated, ['hotel name', 'check-in date', 'check-out date']);
  const line = unstatedStayLine(answer.bookingId, stay.unstated);
  assert.match(line, /booking bk-unstated/);
  assert.match(line, /hotel name, check-in date, check-out date/);
  assert.match(line, /recorded NULL, never the link's/);
  // The route logs it by that line, with what the answer did state.
  assert.match(code(BOOK), /if \(stay\.unstated\.length > 0\) \{\s*console\.error\(unstatedStayLine\(parsed\.bookingId, stay\.unstated\), \{\s*stated: \{ hotelName: parsed\.hotelName \?\? null, checkin: parsed\.checkin \?\? null, checkout: parsed\.checkout \?\? null \},/);
  // A day stated as no calendar day is not a statement of a date.
  const odd = bookedStay(parseBookResult({ bookingId: 'bk-odd', checkin: '2026-13-40', checkout: '2026-02-30', hotel: { name: '   ' } }));
  assert.deepEqual([odd.hotelName, odd.checkinDate, odd.checkoutDate], [null, null, null]);
  assert.equal(statedStayDay('2026-10-02T15:00:00'), '2026-10-02', 'a stated day with a time keeps its day');
  assert.equal(statedStayDay(undefined), null);
  assert.equal(statedStayDay('next tuesday'), null);
});

test('SEC-02b · every reader of a NULL day holds — the email says it, the calendar writes no row, the lock never locks it', () => {
  const email = bookingConfirmation({ guestName: 'Ada Guest', hotelName: null, checkinDate: null, checkoutDate: null, confirmationCode: null, bookingId: 'bk-unstated', totalAmountCents: null, currency: 'USD' });
  assert.equal(email.subject, 'Booking confirmed — reference bk-unstated');
  assert.ok(email.text.includes(`Check-in: ${DAY_NOT_STATED}`));
  assert.ok(email.text.includes(`Check-out: ${DAY_NOT_STATED}`));
  assert.equal(email.html.split(DAY_NOT_STATED).length, 3);
  assert.doesNotMatch(email.text, /\bnull\b|undefined/);
  const decision = stayCalendarDecision({ reservationId: 'r1', userId: 'u1', hotelName: null, checkinDate: dayOfColumn(null), checkoutDate: dayOfColumn(null) });
  assert.equal(decision.write, false);
  assert.match((decision as { reason: string }).reason, /a date is never invented/);
  assert.ok(code('src/lib/reservations/applyVendorState.ts').includes('const afterCheckout = row.checkoutDate !== null && row.checkoutDate.getTime() + COMMISSION_LOCK_GRACE_MS < vendor.readAt.getTime();'), 'a NULL check-out is never after checkout — never locked');
});

test('SEC-02b · the confirm page sends no stay, has no \'your stay\', and SAYS a NULL', () => {
  const c = code(CONFIRM);
  const post = /fetch\('\/api\/travel\/liteapi\/book', \{[\s\S]*?body: JSON\.stringify\(\{([\s\S]*?)\}\),\s*\}\);/.exec(c);
  assert.ok(post, 'the book request body is readable');
  assert.doesNotMatch(post![1], /\b(checkinDate|checkoutDate|hotelName|checkin|checkout)\b/);
  assert.ok(post![1].includes('...(currency ? { currency } : {}),'), 'SEC-03 unchanged: the search currency only when the link stated one');
  assert.doesNotMatch(c, /your stay/i);
  assert.ok(c.includes('const ready = !!prebookId && !!transactionId;'));
  assert.ok(c.includes("'dates not stated by the hotel — see your booking ID'"));
  assert.ok(c.includes('value={confirmation.hotelName ?? LANE_WORD.hotel}'));
});

// ── 2 · NO PASSWORD HASH LEAVES THE SERVER ───────────────────────────────────

const SCHEMA = passwordSchema(code('prisma/schema.prisma'));

test('SEC-02b · the RSVP POST answers with no passwordHash — the old shape is flagged, the new one is clean', () => {
  const rsvp = code('src/app/api/trips/rsvp/route.ts');
  assert.deepEqual(passwordLeaks(rsvp, SCHEMA), []);
  assert.equal((rsvp.match(/select: PARTICIPANT_RESPONSE_SELECT,/g) ?? []).length, 2, 'the create and the update');
  assert.ok(rsvp.includes('participant: { ...participant, hasPassword: passwordHash !== null }'));
  assert.ok(rsvp.includes('participant: { ...updated, hasPassword: !!password || participant.passwordHash !== null }'));
  // The shape it had on main 0c6fedca — the whole row back.
  const old = "const participant = await prisma.trip_participants.create({ data: { tripId: trip.id, email, passwordHash } });\nreturn NextResponse.json({ success: true, participant });";
  assert.equal(passwordLeaks(old, SCHEMA).length, 1);
  assert.equal(passwordLeaks("const t = await prisma.trips.findFirst({ where: { id }, include: { participants: true } });\nreturn NextResponse.json(t);", SCHEMA).length, 1, 'participants pulled whole');
  assert.equal(passwordLeaks("return NextResponse.json({ h: row.passwordHash });", SCHEMA).length, 1, 'a response naming the column');
});

test('SEC-02b · PARTICIPANT_RESPONSE_SELECT is every trip_participants scalar but passwordHash; no route response leaks one', () => {
  const schemaText = code('prisma/schema.prisma');
  const models = new Set(Array.from(schemaText.matchAll(/^model\s+(\w+)/gm), (m) => m[1]));
  const block = /^model trip_participants \{([\s\S]*?)^\}/m.exec(schemaText)![1];
  const scalars = Array.from(block.matchAll(/^\s*(\w+)\s+(\w+)(\[\])?\??/gm)).filter((m) => !models.has(m[2])).map((m) => m[1]);
  assert.ok(scalars.includes('passwordHash'));
  assert.deepEqual(Object.keys(PARTICIPANT_RESPONSE_SELECT).sort(), scalars.filter((f) => f !== 'passwordHash').sort());
  assert.equal('passwordHash' in PARTICIPANT_RESPONSE_SELECT, false);
  const leaks = routes().flatMap((f) => passwordLeaks(code(f), SCHEMA).map((l) => `${f}${l}`));
  assert.deepEqual(leaks, []);
  // The two other reads that pulled participants whole now select.
  assert.match(code('src/app/api/trips/[id]/route.ts'), /participants: \{\s*select: PARTICIPANT_RESPONSE_SELECT,/);
  assert.ok(code('src/app/api/trips/route.ts').includes('participants: { select: PARTICIPANT_RESPONSE_SELECT }'));
});

// ── 3 · CONSTANT-TIME BEARERS ────────────────────────────────────────────────

async function withEnv<T>(name: string, value: string, run: () => Promise<T>): Promise<T> {
  const saved = process.env[name];
  process.env[name] = value;
  try {
    return await run();
  } finally {
    if (saved === undefined) delete process.env[name]; else process.env[name] = saved;
  }
}

const BEARER_ROUTES = [
  { file: 'src/app/api/cron/reservations-refresh/route.ts', env: 'CRON_SECRET', v: 'cronSecret' },
  { file: 'src/app/api/cron/auto-categorize/route.ts', env: 'CRON_SECRET', v: 'cronSecret' },
  { file: 'src/app/api/operations/projects/[id]/audit-ingest/route.ts', env: 'AUDIT_INGEST_SECRET', v: 'secret' },
  { file: 'src/app/api/operations/projects/[id]/exec-ingest/route.ts', env: 'EXEC_INGEST_SECRET', v: 'secret' },
] as const;

test('SEC-02b · each bearer route compares through constantTimeEqual — never !== against the template', () => {
  for (const r of BEARER_ROUTES) {
    const src = code(r.file);
    assert.ok(src.includes(`const ${r.v} = process.env.${r.env};`), r.file);
    assert.match(src, /import \{ constantTimeEqual \} from '@\/lib\/webhooks\/liteapiWebhook';/, r.file);
    assert.ok(src.includes(`if (authHeader === null || !constantTimeEqual(authHeader, \`Bearer \${${r.v}}\`)) {`), r.file);
    assert.doesNotMatch(src, /(?:!==|===)\s*`Bearer /, r.file);
  }
  assert.match(functionBody(code('src/lib/webhooks/liteapiWebhook.ts'), 'constantTimeEqual')!, /if \(a\.length !== b\.length\) return false;\s*return timingSafeEqual\(a, b\);/);
  assert.equal(constantTimeEqual('Bearer s3cret', 'Bearer s3cret'), true);
  assert.equal(constantTimeEqual('Bearer s3creT', 'Bearer s3cret'), false, 'same length, one byte');
  assert.equal(constantTimeEqual('Bearer s3cre', 'Bearer s3cret'), false, 'a prefix');
  assert.equal(constantTimeEqual('bearer s3cret', 'Bearer s3cret'), false, 'no case folding');
});

const WRONG = ['Bearer wrong-secret-xx', 'Bearer sec02b-test-secreT', 'Bearer sec02b-test-secre', 'sec02b-test-secret', 'bearer sec02b-test-secret'];
const SECRET = 'sec02b-test-secret';

test('SEC-02b · the two crons refuse a wrong bearer 401 and let the right one through to the handler', async () => {
  const refreshUrl = 'https://www.templestuart.com/api/cron/reservations-refresh';
  const categorizeUrl = 'https://www.templestuart.com/api/cron/auto-categorize';
  await withEnv('CRON_SECRET', SECRET, async () => {
    assert.equal((await refreshGET(new NextRequest(refreshUrl))).status, 401, 'no bearer');
    assert.equal((await categorizePOST(new NextRequest(categorizeUrl, { method: 'POST' }))).status, 401, 'no bearer');
    for (const wrong of WRONG) {
      const a = await refreshGET(new NextRequest(refreshUrl, { headers: { authorization: wrong } }));
      assert.equal(a.status, 401, `reservations-refresh: ${wrong}`);
      assert.deepEqual(await a.json(), { error: 'Unauthorized' });
      const b = await categorizePOST(new NextRequest(categorizeUrl, { method: 'POST', headers: { authorization: wrong } }));
      assert.equal(b.status, 401, `auto-categorize: ${wrong}`);
    }
    // The right bearer passes the gate into the handler, which (no database here) fails closed by its own name.
    const ok = await refreshGET(new NextRequest(refreshUrl, { headers: { authorization: `Bearer ${SECRET}` } }));
    assert.notEqual(ok.status, 401);
    assert.match(JSON.stringify(await ok.json()), /Reservations refresh failed/);
    const ok2 = await categorizePOST(new NextRequest(categorizeUrl, { method: 'POST', headers: { authorization: `Bearer ${SECRET}` } }));
    assert.notEqual(ok2.status, 401);
    assert.match(JSON.stringify(await ok2.json()), /Auto-categorization failed/);
  });
});

test('SEC-02b · the two ingest callbacks refuse a wrong bearer 401 and let the right one through to body validation', async () => {
  const cases = [
    { env: 'AUDIT_INGEST_SECRET', handler: auditIngestPOST, url: 'https://www.templestuart.com/api/operations/projects/p1/audit-ingest' },
    { env: 'EXEC_INGEST_SECRET', handler: execIngestPOST, url: 'https://www.templestuart.com/api/operations/projects/p1/exec-ingest' },
  ];
  for (const c of cases) {
    await withEnv(c.env, SECRET, async () => {
      const ctx = () => ({ params: Promise.resolve({ id: 'p1' }) });
      const post = (authorization?: string) => new NextRequest(c.url, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) } });
      assert.equal((await c.handler(post(), ctx())).status, 401, `${c.env}: no bearer`);
      for (const wrong of WRONG) {
        const r = await c.handler(post(wrong), ctx());
        assert.equal(r.status, 401, `${c.env}: ${wrong}`);
        assert.deepEqual(await r.json(), { error: 'Unauthorized' });
      }
      // The right bearer is past the boundary: the empty body is refused by name, before any DB work.
      const ok = await c.handler(post(`Bearer ${SECRET}`), ctx());
      assert.equal(ok.status, 400, c.env);
      assert.deepEqual(await ok.json(), { error: 'Validation', message: 'correlationId is required' });
    });
  }
});
