/**
 * HOTEL-02 (2026-09-22) — THE STAY'S TIMES ARE THE PROPERTY'S, NOT OURS.
 *
 * Probed on the documented GET /data/hotel shape (fixtureHotelContent.ts — no
 * captured live content payload exists in the repository) and read from the
 * source through the two readers (TEST-TRUTH-01).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { code, comments } from '../sourceText';
import { hhmmOf, propertyClockOf, propertyClockStatement } from '../hotels/stayTimes';
import { hotelCardsOf } from '../hotels/rates';
import { BOOKING_FLOW_BASE, BOOKING_FLOW_FILES } from '../travelBookingFlow';
import { CONTENT_EXPECTED as E, GUESTHOUSE_CONTENT, KATA_ROCKS_CONTENT, UNREADABLE_CONTENT } from './fixtureHotelContent';
import { PHUKET_RATES } from './fixtureHotelRatesPhuket';

const COMMIT = 'src/app/api/trips/[id]/vendor-commit/route.ts';
const PATCH = 'src/app/api/trips/[id]/itinerary/[itineraryId]/route.ts';
const BUTTON = 'src/app/budgets/trips/[id]/discover/[category]/[rank]/AddToTripButton.tsx';
const DETAIL = 'src/app/budgets/trips/[id]/discover/[category]/[rank]/page.tsx';
const PLANNER = 'src/components/trips/TripPlannerAI.tsx';
const CHECKOUT = 'src/components/trips/CheckoutPanel.tsx';
const CONTAINER = 'src/components/trips/PublicHotelSearch.tsx';
const VIEW = 'src/components/trips/HotelResultsView.tsx';
const TIMELINE = 'src/components/trips/TripTimelineView.tsx';
const CLIENT = 'src/lib/liteapiClient.ts';
const LEAF = 'src/lib/hotels/stayTimes.ts';
const RATES = 'src/lib/hotels/rates.ts';

/**
 * The contiguous comment block directly above a pin line — TRAVEL-ROW-01 (2026-09-23).
 *
 * The window used to be the two lines immediately above the pin, which held exactly one
 * ruling's note and its `Was <hash>` line. A later ruling's dated note STACKS BELOW an
 * earlier one (travelBookingFlow.ts documents the convention, and assert-tool-registry.ts
 * reads the same block through its own `noteBlockOver`), so the two-line window now reads
 * the newest note and misses the one this test is about. This reads the whole block, the
 * pin's own lines and never a neighbour's: comments() blanks the code lines, so the block
 * ends at the first line that is code in the `pins` channel.
 */
function noteBlockOver(pins: string, notes: string, pinLine: number): string {
  const codeLines = pins.split('\n');
  const noteLines = notes.split('\n');
  const block: string[] = [];
  for (let i = pinLine - 2; i >= 0 && codeLines[i].trim() === ''; i--) block.unshift(noteLines[i]);
  return block.join('\n');
}

test('the property\'s clock is read from its content: stated → HH:MM, silent → null, unreadable → refused by name', () => {
  const kr = propertyClockOf(KATA_ROCKS_CONTENT.checkinCheckoutTimes);
  assert.ok('clock' in kr); assert.equal(kr.clock.checkin, E.kataRocks.checkin); assert.equal(kr.clock.checkout, E.kataRocks.checkout);
  assert.equal(propertyClockStatement(kr.clock), E.kataRocks.statement);
  const gh = propertyClockOf(GUESTHOUSE_CONTENT.checkinCheckoutTimes);
  assert.ok('clock' in gh); assert.equal(gh.clock.checkin, null); assert.equal(gh.clock.checkout, null);
  assert.equal(propertyClockStatement(gh.clock), E.guesthouse.statement);
  const odd = propertyClockOf(UNREADABLE_CONTENT.checkinCheckoutTimes);
  assert.ok('unreadable' in odd); assert.equal(odd.unreadable, E.unreadable);
  // checkin_end bounds nothing; an empty string is silence, not a clock.
  const onlyEnd = propertyClockOf({ checkin_end: '12:00 AM', checkin_start: '', checkout: ' ' });
  assert.ok('clock' in onlyEnd); assert.equal(onlyEnd.clock.checkin, null); assert.equal(onlyEnd.clock.checkout, null);
  assert.equal(hhmmOf('02:00 PM'), '14:00'); assert.equal(hhmmOf('12:00 PM'), '12:00'); assert.equal(hhmmOf('from 16h'), null);
  // The leaf is pure and the one home of the clock reader; the rates leaf holds no clock.
  assert.doesNotMatch(code(LEAF), /\bfetch\(|process\.env/);
  assert.doesNotMatch(code(RATES), /checkinCheckoutTimes|checkinTime|checkoutTime|hhmmOf/);
  for (const c of hotelCardsOf(PHUKET_RATES)) assert.ok(!('checkinTime' in c), `${c.hotelId}: the rates answer carries no clock`);
});

test('the commit makes ONE content call for the hotel being booked, reserved once, after validation, before the transaction, and fails loudly with a fixed reason', () => {
  const commit = code(COMMIT);
  assert.equal((commit.match(/getHotelContent\(/g) ?? []).length, 1);
  assert.equal((commit.match(/reserveTravelSearch\('hotelcontent'\)/g) ?? []).length, 1);
  assert.match(commit, /if \(optionType === 'lodging' && liteapiHotelId\) \{/);
  assert.match(commit, /if \(sentClock\(startTime\) \|\| sentClock\(endTime\)\) \{/, 'a caller may not send its own clock beside the hotel id');
  const at = (s: string) => { const i = commit.indexOf(s); assert.ok(i >= 0, `missing: ${s}`); return i; };
  const order = [at("if (!validTypes.includes(optionType))"), at('if (!isSyntheticLodging) {\n        const row = await prisma.trip_lodging_options.findFirst'), at("reserveTravelSearch('hotelcontent')"), at('getHotelContent(liteapiHotelId)'), at('const result = await prisma.$transaction(')];
  assert.deepEqual([...order].sort((a, b) => a - b), order, 'validate → row check → reserve → call → transaction');
  for (const branch of ['err instanceof TravelSearchQuotaError', 'err instanceof LiteApiError', 'err instanceof MissingLiteApiKeyError', "'unreadable' in read", 'if (!content) {']) assert.ok(commit.includes(branch), branch);
  assert.match(commit, /\{ status: 503 \}/); assert.ok((commit.match(/\{ status: 502 \}/g) ?? []).length >= 3);
  assert.doesNotMatch(commit.slice(order[3], order[4]), /err\.message/, 'the vendor\'s body never reaches the browser (HYG-02)');
  // The stay's clock, resolved once, written to both columns; the answer says what was stored.
  assert.match(commit, /const stayStart = propertyClock \? parseTimeOrNull\(propertyClock\.checkin, 'block_start_time'\) : blockStartParse;/);
  assert.match(commit, /const ledgerStart: string \| null = propertyClock \? propertyClock\.checkin : \(startTime \|\| null\);/);
  assert.match(commit, /const blockStart = stayStart\.value;\n\s+const blockEnd = stayEnd\.value;/);
  assert.match(commit, /homeTime: ledgerStart,\n\s+destDate: end, destTime: ledgerEnd,/);
  assert.match(commit, /stayTimes: propertyClock \? \{ \.\.\.propertyClock, source: 'property', statement: propertyClockStatement\(propertyClock\) \} : null,/);
  assert.doesNotMatch(commit, /'15:00'|'11:00'|'22:00'|'07:00'|'16:00'/);
});

test('no content call from a search or a list: the callers are a closed set; the search sends the hotel, not a clock', () => {
  for (const f of ['src/app/api/travel/hotels/search/route.ts', VIEW, CONTAINER, 'src/app/api/trips/[id]/ai-assistant/route.ts']) {
    assert.doesNotMatch(code(f), /getHotelContent\(|hotels\/content/, `${f} reads no content`);
  }
  for (const f of ['src/app/api/travel/hotels/content/route.ts', DETAIL, COMMIT]) assert.match(code(f), /getHotelContent\(/, `${f} is a named reader`);
  assert.match(code(CHECKOUT), /api\/travel\/hotels\/content/, 'the checkout panel reads the route (the booking surface, pinned)');
  const container = code(CONTAINER);
  assert.match(container, /liteapiHotelId: card\.hotelId,/);
  assert.doesNotMatch(container, /hhmmOf|startTime|endTime|checkinTime|checkoutTime/);
  assert.match(container, /saved\.stayTimes\?\.statement \?\? 'the commit reported no clock for this stay'/);
  assert.match(container, /data-save-note=\{saveNote\.kind\}/);
});

test('the three invented times are gone: no prefill on the button, no dead default in the planner, no clock literal anywhere on the commit path', () => {
  const button = code(BUTTON);
  assert.doesNotMatch(button, /type="time"|windowStart|windowEnd|startTime|endTime|'22:00'|'07:00'/);
  assert.match(button, /\.\.\.\(liteapiHotelId \? \{ liteapiHotelId \} : \{\}\),/);
  assert.match(button, /data-stay-times/);
  const planner = code(PLANNER);
  assert.doesNotMatch(planner, /CATEGORY_DEFAULT_TIMES|'15:00'|'11:00'/);
  assert.match(planner, /catInfo\.optionType === 'lodging' && rec\.liteapiHotelId \? \{ liteapiHotelId: rec\.liteapiHotelId \} : \{\}/);
});

test('a timeline edit moves both representations in the one update, or is refused with the reason; a flight keeps its own clock', () => {
  const patch = code(PATCH);
  assert.match(patch, /data\.block_start_time = t\.block;[^\n]*\n\s+data\.homeTime = t\.str;/);
  assert.match(patch, /data\.block_end_time = t\.block;\n\s+data\.destTime = t\.str;/);
  assert.equal(patch.split('data.block_start_time =').length, patch.split('data.homeTime =').length);
  assert.equal(patch.split('data.block_end_time =').length, patch.split('data.destTime =').length);
  assert.match(patch, /are one clock — they were sent with different values/);
  assert.match(patch, /existing\.vendorOptionType === 'flight' && \(body\.blockStartTime !== undefined \|\| body\.blockEndTime !== undefined\)/);
  assert.equal((patch.match(/prisma\.trip_itinerary\.update\(/g) ?? []).length, 1, 'one update');
  assert.match(code(TIMELINE), /blockStartTime: start \|\| null,\n\s+blockEndTime: end \|\| null,/);
  assert.match(code(TIMELINE), /patch\(\{ blockStartTime: null, blockEndTime: null \}\)/);
});

test('the rating scale is one: the checkout renders /5 as the client types, the detail page guesses nothing, the results view names /10', () => {
  assert.match(code(CHECKOUT), /\{content\.rating\}<\/span>\/5/);
  assert.doesNotMatch(code(CHECKOUT), /\{content\.rating\}<\/span>\/10/);
  assert.doesNotMatch(code(DETAIL), /content\.rating <= 5|content\.rating \* |enrichedScore/);
  assert.match(code(VIEW), /\$\{card\.guestRating\}\/10/);
  const notes = comments(CLIENT);
  assert.match(notes, /0-5 in observed responses/); assert.match(notes, /Not verified by a captured payload/); assert.match(notes, /documented out of 10/);
  assert.match(code(CLIENT), /checkinCheckoutTimes\?: CheckinCheckoutTimes;/);
});

test('the pin holds, dated: five files re-dated by HOTEL-02 with the hash they had on main 81045434; the commit is not pinned', () => {
  const notes = comments('src/lib/travelBookingFlow.ts');
  const pins = code('src/lib/travelBookingFlow.ts');
  const redated = [CONTAINER, VIEW, CHECKOUT, PLANNER, CLIENT];
  assert.equal((notes.match(/HOTEL-02 \(2026-09-22\): re-dated/g) ?? []).length, redated.length);
  for (const f of redated) {
    const pinAt = pins.indexOf(`{ file: '${f}', sha256: '`);
    assert.ok(pinAt >= 0, `${f} is pinned`);
    const pinLine = pins.slice(0, pinAt).split('\n').length;
    const above = noteBlockOver(pins, notes, pinLine);
    assert.match(above, /HOTEL-02 \(2026-09-22\): re-dated — [^\n]+\. The stay's clock is the property's, read once at commit; no prebook\/book\/pay\/cancel call changed\.\n[^\n]*Was [0-9a-f]{64} at main 81045434\./, `${f}'s note`);
  }
  assert.match(BOOKING_FLOW_BASE, /re-dated by HOTEL-02 \(2026-09-22\), the stay's clock is the property's/);
  assert.ok(!BOOKING_FLOW_FILES.some((p) => p.file === COMMIT), 'vendor-commit is the itinerary writer, not the booking flow');
  assert.equal(BOOKING_FLOW_FILES.length, 51, 'the census did not shrink (ACTIVITY-01 STEP 4 pinned the options route: 49 → 50; TRAVEL-ROW-01 pinned RowActionStrip.tsx: 50 → 51)');
});
