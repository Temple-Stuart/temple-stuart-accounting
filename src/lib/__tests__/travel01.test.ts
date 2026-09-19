import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DATE_ONLY_TRIP_TYPES, TIMED_BY_THEMSELVES, clockOfTime, isDateOnlyTripType, overlayTripItems, parseTripVendorSourceId, providerOfTripItem, type TripItemRow, type TripOverlayEvent } from '../calendar/tripItem';
import { DRILL_KINDS, KIND_FACTS, buildChain, buildDrill, kindOf, kindOfSource } from '../calendar/chain';
import { LINKABLE_KINDS, isLinkableKind, requiresInstant } from '../calendar/linkKeys';
import { MARKER_MINUTES, blockExtent } from '../calendar/extent';
import { BOOKING_FLOW_BASE, BOOKING_FLOW_FILES, bookingFlowSha256 } from '../travelBookingFlow';
import { PHASES_RENDERED_AT, THE_SORT, navToolByName } from '../nav';
import { TOOL_GATE } from '../offer';
import { code, comments, rejoin, splitSource } from '../sourceText';

/**
 * TRAVEL-01 — TRAVEL READS TOP-DOWN, AND EVERY PLANNED ITEM TAKES ITS TIME ON THE DAY.
 * The overlay is a pure leaf, probed on the demo's three items; what the tab,
 * the grid and the panel DO with it is asserted from their source, comments
 * stripped (TEST-TRUTH-01), and shown in the walk.
 */

const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';
const LEAF = 'src/lib/calendar/tripItem.ts';
const FEED = 'src/app/api/calendar/route.ts';
const HUB = 'src/components/hub/HubCalendar.tsx';
const GRID = 'src/components/shared/CalendarGrid.tsx';
const PANEL = 'src/components/hub/EventDetailPanel.tsx';
const SECTION = 'src/components/trips/TripItinerarySection.tsx';
const TIMELINE = 'src/components/trips/TripTimelineView.tsx';
const LINK_MIGRATION = 'prisma/migrations/20260919100100_travel_01_trip_item_link_kind/migration.sql';
const BLOCK_MIGRATION = 'prisma/migrations/20260919100000_travel_01_block_times_recorded/migration.sql';
const ROOT = resolve(__dirname, '../../..');

const clockAt = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
/** The walk's trip: a flight, a hotel night and "Ubud rice walk · 14:00–16:00 · Viator · Tegallalang · $45". */
const ITEMS: TripItemRow[] = [
  { id: 'ti-fl', tripId: 'bali', vendorOptionId: 'fl-1', vendorOptionType: 'flight', category: 'flights', vendor: 'SIN → DPS', vendor_name: 'Singapore Airlines', location: null, block_start_time: null, block_end_time: null },
  { id: 'ti-lo', tripId: 'bali', vendorOptionId: 'ho-1', vendorOptionType: 'lodging', category: 'accommodation', vendor: 'Alila Ubud', vendor_name: 'Alila', location: 'Ubud', block_start_time: clockAt('15:00'), block_end_time: clockAt('11:00') },
  { id: 'ti-act', tripId: 'bali', vendorOptionId: 'act-1', vendorOptionType: 'activity', category: 'activities', vendor: 'Ubud rice walk', vendor_name: 'Viator', location: 'Tegallalang', block_start_time: clockAt('14:00'), block_end_time: clockAt('16:00') },
  { id: 'ti-open', tripId: 'bali', vendorOptionId: 'act-2', vendorOptionType: 'activity', category: 'activities', vendor: 'Sunrise trek', vendor_name: 'Viator', location: 'Batur', block_start_time: clockAt('04:00'), block_end_time: null },
];
type Row = TripOverlayEvent & { id: string };
const ROWS: Row[] = [
  { id: 'e-fl', source: 'trip', source_id: 'trip:bali:vendor:fl-1', start_time: '08:00:00', end_time: '13:00:00', location: null },
  { id: 'e-lo', source: 'trip', source_id: 'trip:bali:vendor:ho-1', start_time: null, end_time: null, location: null },
  { id: 'e-act', source: 'trip', source_id: 'trip:bali:vendor:act-1', start_time: null, end_time: null, location: null },
  { id: 'e-open', source: 'trip', source_id: 'trip:bali:vendor:act-2', start_time: null, end_time: null, location: null },
  { id: 'e-trip', source: 'trip', source_id: 'trip:bali', start_time: null, end_time: null, location: null },
  { id: 'e-man', source: 'manual', source_id: null, start_time: '10:00:00', end_time: null, location: 'Home' },
];
const overlaid = () => {
  const out = overlayTripItems(ROWS, ITEMS);
  return (id: string) => out.find((e) => e.id === id)!;
};

// ───────────────────────────────────────────────────────────────────────────
test('the travel tab renders its sections in order under the tool header, and draws no strip', () => {
  const launcher = code(LAUNCHER);
  const sections = [...launcher.matchAll(/data-travel-section="([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(sections, ['header', 'trips', 'itinerary', 'search', 'booked', 'ledger', 'unattached']);
  const at = (name: string) => launcher.indexOf(`data-travel-section="${name}"`);
  const region = launcher.slice(at('header'), launcher.indexOf('</section>', at('unattached')));
  assert.doesNotMatch(region, /<StageStrip|<ProofStrip/, 'no strip, no receipts rail');
  assert.doesNotMatch(launcher, /PIPE_PHASES\.travel|travelPhase|PIPE_TRIP/, 'no travel phase state anywhere in the launcher');
  assert.match(launcher.slice(at('header'), at('trips')), /<ToolOpener tools=\{\[navToolByName\('Travel', TOOL_GATE\)\]\}/, 'the header is the registry line');
  assert.match(launcher.slice(at('trips'), at('itinerary')), /<AllTripsList/);
  assert.match(launcher.slice(at('itinerary'), at('search')), /<TripItinerarySection trip=\{currentTrip\}/);
  assert.match(launcher.slice(at('booked'), at('ledger')), /<TripBookings/);
  assert.match(launcher.slice(at('ledger'), at('unattached')), /<TripBudgetActual/);
  assert.match(region.slice(region.indexOf('data-travel-section="unattached"')), /<UnattachedBookings/);
  // The tool's door is unchanged: Travel's row still opens /travel.
  assert.equal(navToolByName('Travel', TOOL_GATE).href, '/travel');
  // Nothing is drawn as a phase, and each of the five says so.
  assert.deepEqual(PHASES_RENDERED_AT['/travel'], []);
  const travel = THE_SORT.filter((a) => a.pipe === 'travel');
  assert.equal(travel.length, 5);
  for (const a of travel) {
    assert.equal(a.rendersSurface, false);
    assert.equal(a.owner, 'Travel');
    assert.match(a.surfaceNote ?? '', /TRAVEL-01 \(2026-09-19\): drawn nowhere/);
  }
});

test('the itinerary names each item with its vendor, place, category, planned amount and — where it has one — its time', () => {
  const section = code(SECTION);
  assert.match(section, /fetch\(`\/api\/trips\/\$\{trip\.id\}\/itinerary`\)/, 'it reads the same route the trip page reads');
  assert.match(section, /<TripTimeline\s+tripId=\{trip\.id\}\s+itinerary=\{rows\}/, 'the same timeline the trip page mounts');
  assert.match(section, /data-itinerary-empty/, 'no trip and nothing planned are both said plainly');
  const timeline = code(TIMELINE);
  assert.match(timeline, /const meta = \[vendorName, row\.category, row\.location\]\.filter\(/, 'vendor · category · place ride the meta line');
  assert.match(timeline, /data-itinerary-meta/);
  assert.match(timeline, /data-itinerary-planned>\{money\(block\.daySpendShare\)\}/, 'the planned amount is on the row');
  assert.match(timeline, /data-itinerary-item=\{row\.id\}/);
});

test("an activity with 14:00–16:00 lands on the day at that extent, with vendor and place on its block", () => {
  const row = overlaid()('e-act');
  assert.equal(row.start_time, '14:00');
  assert.equal(row.end_time, '16:00');
  assert.equal(row.trip_item_id, 'ti-act');
  assert.equal(row.vendor_name, 'Viator');
  assert.equal(row.location, 'Tegallalang');
  assert.equal(row.item_category, 'activities');
  assert.equal(row.item_type, 'activity');
  assert.equal(row.provider, 'Viator');
  // GRID-01 draws the window exactly: two hours, unflagged — through the NON-TRIP
  // path. The walk found the trip branch taking every timed trip row for a flight
  // (an unverified-duration marker at 14:00); a date-only item is routed past it.
  assert.deepEqual(blockExtent(14 * 60, 16 * 60), { startMin: 840, endMin: 960, flag: null });
  const gridSrc = code(GRID);
  assert.match(gridSrc, /import \{ isDateOnlyTripType \} from '@\/lib\/calendar\/tripItem';/);
  assert.match(gridSrc, /if \(event\.source === 'trip' && !isDateOnlyTripType\(event\.itemType\)\) \{/, 'only a flight (or a stay) takes the duration path');
  assert.match(code(HUB), /itemType: e\.item_type \?\? null,/);
  // The merged grid puts vendor · category on the block's detail line and the
  // place on its location line; the grid renders both under the label.
  const hub = code(HUB);
  assert.match(hub, /details: \[\[e\.vendor_name, e\.item_category\]\.filter\(Boolean\)\.join\(' · '\)\]\.filter\(\(d\) => d\.length > 0\)/);
  assert.match(hub, /startTime: toClock\(e\.start_time\),/, 'the overlaid clock reaches the grid through the same mapper');
  const grid = code(GRID);
  assert.match(grid, /\{block\.event\.location\}/);
  assert.match(grid, /\{block\.event\.details\[0\]\}/);
  // The feed applies the overlay, scoped to the caller's trips.
  const feed = code(FEED);
  assert.match(feed, /events = overlayTripItems\(events, items\)/);
  assert.match(feed, /trip: \{ userId: user\.id \}/);
  assert.match(feed, /vendorOptionId: \{ in: \[\.\.\.new Set\(vendorKeys\.map\(\(k\) => k\.optionId\)\)\] \}/);
});

test('an item with a start and no end is a flagged marker, never given a length', () => {
  const row = overlaid()('e-open');
  assert.equal(row.start_time, '04:00');
  assert.equal(row.end_time, null, 'the overlay copies no end it does not have');
  assert.deepEqual(blockExtent(4 * 60, null), { startMin: 240, endMin: 240 + MARKER_MINUTES, flag: 'no-end' });
  // And an item with no window at all stays all-day: nothing is defaulted.
  const bare = overlayTripItems<Row>(
    [{ id: 'x', source: 'trip', source_id: 'trip:bali:vendor:act-3', start_time: null, end_time: null }],
    [{ ...ITEMS[2], id: 'ti-bare', vendorOptionId: 'act-3', block_start_time: null, block_end_time: null }],
  )[0];
  assert.equal(bare.start_time, null);
  assert.equal(bare.end_time, null);
  assert.equal(bare.trip_item_id, 'ti-bare', 'it still knows its item');
  assert.doesNotMatch(code(LEAF), /'\d{1,2}:\d{2}'|"\d{1,2}:\d{2}"/, 'no literal clock in the leaf');
});

test("a flight's geometry is unchanged, and a stay stays all-day", () => {
  const by = overlaid();
  const fl = by('e-fl');
  assert.equal(fl.start_time, '08:00:00');
  assert.equal(fl.end_time, '13:00:00');
  assert.equal(fl.provider, 'LiteAPI flights');
  assert.equal(fl.trip_item_id, 'ti-fl');
  const lo = by('e-lo');
  assert.equal(lo.start_time, null, 'a stay is never given the lodging window as a clock');
  assert.equal(lo.end_time, null);
  assert.equal(lo.location, 'Ubud');
  assert.equal(lo.provider, 'LiteAPI');
  assert.deepEqual([...DATE_ONLY_TRIP_TYPES], ['activity', 'transfer', 'vehicle']);
  assert.deepEqual([...TIMED_BY_THEMSELVES], ['flight', 'lodging']);
  assert.equal(isDateOnlyTripType('flight'), false);
  assert.equal(isDateOnlyTripType('activity'), true);
  // Rows that are not a trip vendor row are returned as they were; the input is untouched.
  const before = JSON.stringify(ROWS);
  assert.equal('trip_item_id' in by('e-trip'), false, 'the whole-trip row is a calendar_event still');
  assert.equal('trip_item_id' in by('e-man'), false);
  assert.equal(JSON.stringify(ROWS), before);
  // A row whose item is gone is returned as it was, never invented.
  const orphan = overlayTripItems<Row>([{ id: 'o', source: 'trip', source_id: 'trip:bali:vendor:gone', start_time: null, end_time: null }], ITEMS)[0];
  assert.equal('trip_item_id' in orphan, false);
  // The grid's trip path is what GRID-01 left: a flight segment is exactly its duration.
  const grid = code(GRID);
  assert.match(grid, /endMin: segEnd, flag: null/);
  assert.match(grid, /const ext = unverifiedDurationExtent\(tripStartMin\);/);
  // vendor-commit still writes a clock on the calendar row for a flight alone.
  const commit = code('src/app/api/trips/[id]/vendor-commit/route.ts');
  assert.match(commit, /const calStartTime = isFlight \? \(startTime \|\| null\) : null;/);
  assert.match(commit, /const calEndTime = isFlight \? \(endTime \|\| null\) : null;/);
});

test('the source id and the clock are read strictly', () => {
  assert.deepEqual(parseTripVendorSourceId('trip:bali:vendor:act-1'), { tripId: 'bali', optionId: 'act-1' });
  assert.deepEqual(parseTripVendorSourceId('trip:bali:vendor:place-ChIJ:x'), { tripId: 'bali', optionId: 'place-ChIJ:x' }, 'an option id may carry a colon');
  assert.equal(parseTripVendorSourceId('trip:bali'), null, 'the whole-trip row');
  assert.equal(parseTripVendorSourceId(null), null);
  assert.equal(clockOfTime(clockAt('09:05')), '09:05');
  assert.equal(clockOfTime('1970-01-01T21:30:00.000Z'), '21:30');
  assert.equal(clockOfTime('14:00:00'), '14:00');
  assert.equal(clockOfTime(null), null);
  assert.equal(clockOfTime(''), null);
  assert.equal(providerOfTripItem('activity', 'place-ChIJabc'), 'Google Places', 'a place picked on the map is not a booking');
  assert.equal(providerOfTripItem('transfer', 'tr-1'), null, 'a scanner transfer has no connected provider');
  assert.equal(providerOfTripItem('vehicle', 'v-1'), null);
});

test("a trip block opens the drill panel as 'trip_item' — vendor, source, planned, NOT LINKED", () => {
  assert.equal(kindOf({ source: 'trip', tripItemId: 'ti-act' }), 'trip_item');
  assert.equal(kindOf({ source: 'trip', tripItemId: null }), kindOfSource('trip'), 'the whole-trip row keeps its kind');
  assert.equal(kindOfSource('trip'), 'calendar_event');
  assert.ok(DRILL_KINDS.includes('trip_item'));
  const facts = KIND_FACTS.find((f) => f.kind === 'trip_item')!;
  assert.equal(facts.linkable, true);
  assert.equal(facts.actualColumn, null, 'the reservation lens is a bank transaction against a reservation, not this kind\'s actual');
  assert.equal(facts.actualSource, null);
  assert.equal(facts.postedLink, null);
  assert.equal(facts.owner, 'Travel');
  assert.match(facts.plannedColumn ?? '', /trip_itinerary\.cost/);
  assert.match(facts.coaColumn ?? '', /trip_itinerary\.coa_code/);
  assert.match(facts.note, /vendor-commit/);
  assert.match(facts.note, /transaction|reservation/i);

  const row = buildDrill({
    id: 'e-act', source: 'trip', title: 'Ubud rice walk', startDate: '2026-09-22', endDate: '2026-09-22',
    startTime: '14:00', endTime: '16:00', location: 'Tegallalang', coaCode: 'P-6300', budgetAmount: 45,
    vendor: 'Viator', provider: 'Viator', tripItemId: 'ti-act',
  });
  assert.equal(row.kind, 'trip_item');
  assert.equal(row.owner, 'Travel');
  assert.equal(row.vendor, 'Viator');
  assert.equal(row.provider, 'Viator');
  assert.equal(row.tripItemId, 'ti-act');
  assert.equal(row.planned, 45);
  assert.equal(row.actual, null);
  assert.equal(row.chain?.state, 'NOT_LINKED');
  assert.equal(buildChain({ kind: 'trip_item', planned: 45, actual: null })!.state, 'NOT_LINKED');
  // Hand-added: the same kind, no provider.
  const hand = buildDrill({ id: 'e-h', source: 'trip', title: 'Warung', startDate: '2026-09-22', tripItemId: 'ti-h', provider: null, vendor: null });
  assert.equal(hand.kind, 'trip_item');
  assert.equal(hand.provider, null);

  // The panel: the link target is the trip_itinerary id, with no instant; the two new rows.
  const panel = code(PANEL);
  assert.match(panel, /if \(row\.kind === 'trip_item'\) return row\.tripItemId \? \{ kind: 'trip_item', id: row\.tripItemId, instant: null \} : null;/);
  assert.match(panel, /\{row\.kind === 'trip_item' && <Row label="Vendor" value=\{row\.vendor \?\? NONE\} testId="vendor" \/>\}/);
  assert.match(panel, /value=\{row\.provider \? `booked through \$\{row\.provider\}` : 'added by hand — no booking provider'\} testId="source"/);
  // The merged grid hands the three fields to the panel.
  assert.match(code(HUB), /vendor: e\.vendor \?\? null, provider: e\.provider \?\? null, tripItemId: e\.tripItemId \?\? null,/);
});

test("LINK-01 applies to a trip item: the kind is linkable, keyed on its id with no instant, and its migration names it", () => {
  assert.deepEqual([...LINKABLE_KINDS], ['calendar_event', 'project_task', 'routine', 'routine_line', 'trip_item']);
  assert.equal(isLinkableKind('trip_item'), true);
  assert.equal(requiresInstant('trip_item'), false);
  const m = code(LINK_MIGRATION);
  assert.match(m, /DROP CONSTRAINT IF EXISTS "planned_item_links_kind"/);
  assert.match(m, /CHECK \("target_kind" IN \('calendar_event', 'project_task', 'routine', 'routine_line', 'trip_item'\)\)/);
  assert.doesNotMatch(m, /planned_item_links_instant_iff_routine/, "LINES-01's instant CHECK stands untouched — it already forbids an instant for every kind but the two routine kinds");
  assert.doesNotMatch(m, /(^|\n)\s*(UPDATE|INSERT INTO|DELETE FROM)\s/, 'no link is created or moved');
  assert.match(comments(LINK_MIGRATION), /AUTHORED|never applied|Nothing is migrated/i);
});

test('the block-time columns are recorded, never defaulted, and the migration touches no row', () => {
  const m = code(BLOCK_MIGRATION);
  const adds = m.match(/ADD COLUMN IF NOT EXISTS "([a-z_]+)"/g)!.map((s) => s.replace(/.*"([a-z_]+)"$/, '$1'));
  assert.deepEqual(adds, ['recurrence', 'block_start_time', 'block_end_time', 'coa_code', 'vendor_name', 'entity_id', 'entity_id']);
  assert.equal((m.match(/ADD COLUMN/g) ?? []).length, adds.length, 'every ADD COLUMN is IF NOT EXISTS');
  assert.match(m, /"block_start_time" TIME\(6\),/, 'no DEFAULT on a block time');
  assert.match(m, /"block_end_time"\s+TIME\(6\),/);
  assert.doesNotMatch(m, /(^|\n)\s*(UPDATE|INSERT INTO|DELETE FROM)\s|DROP COLUMN|DROP TABLE/);
  assert.match(m, /CREATE INDEX IF NOT EXISTS "trip_itinerary_recurrence_idx"/);
  // The manual SQL it records is still there, and the schema declares the pair.
  assert.ok(existsSync(resolve(ROOT, 'prisma/migrations-manual/itinerary_time_blocks.sql')));
  const schema = code('prisma/schema.prisma');
  assert.match(schema, /block_start_time\s+DateTime\?\s+@db\.Time/);
  assert.match(schema, /block_end_time\s+DateTime\?\s+@db\.Time/);
  // Alex's query rides the migration's header.
  assert.match(comments(BLOCK_MIGRATION), /SELECT column_name FROM information_schema\.columns/);
});

test('the booking surfaces still mount under Search, and the booking flow is byte-identical to main', () => {
  const launcher = code(LAUNCHER);
  const at = (name: string) => launcher.indexOf(`data-travel-section="${name}"`);
  const search = launcher.slice(at('search'), at('booked'));
  assert.match(search, /<ToggleStrip/);
  assert.match(search, /\.\.\.travelStripModes\(\{\s*onRequireAuth,\s*authed,\s*currentTrip,\s*onCommitted: \(\) => setTripsRefresh\(\(n\) => n \+ 1\),\s*\}\)/);
  assert.match(search, /\{HOMEPAGE_CATEGORIES\.map\(\(catKey\) => \(\s*<PublicCategorySearch/);
  // The pins: a whole-file equality through the reader's two halves, rejoined.
  assert.ok(BOOKING_FLOW_FILES.length >= 49, `${BOOKING_FLOW_FILES.length} files pinned`);
  assert.match(BOOKING_FLOW_BASE, /b9eac34a/);
  const names = BOOKING_FLOW_FILES.map((p) => p.file);
  assert.equal(new Set(names).size, names.length, 'no file pinned twice');
  for (const pin of BOOKING_FLOW_FILES) {
    assert.ok(existsSync(resolve(ROOT, pin.file)), `${pin.file} exists`);
    assert.equal(bookingFlowSha256(rejoin(code(pin.file), comments(pin.file))), pin.sha256, `${pin.file} is byte-identical to ${BOOKING_FLOW_BASE}`);
  }
  for (const must of ['src/app/api/travel/liteapi/prebook/route.ts', 'src/app/api/travel/liteapi/book/route.ts', 'src/app/api/travel/liteapi/flights/prebook/route.ts', 'src/app/api/travel/liteapi/flights/book/route.ts', 'src/components/trips/CheckoutPanel.tsx', 'src/components/trips/LiteApiFlightCheckoutPanel.tsx', 'src/lib/liteapiClient.ts', 'src/lib/viatorClient.ts', 'src/components/trips/travelStripModes.tsx']) {
    assert.ok(names.includes(must), `${must} is in the census`);
  }
  assert.ok(!names.includes('src/app/api/trips/[id]/vendor-commit/route.ts'), 'vendor-commit is the itinerary writer, not the booking flow');
});

test('the pin is exact because rejoin is: a file with an astral character rejoins byte for byte', () => {
  // TEST-TRUTH-01's rejoin walked code points against code units and dropped a
  // byte after every emoji; HotelPicker.tsx carries one and hashed wrong.
  const raw = "const a = '🏨 hotel'; // pick 🛏\nconst b = /x/; /* 🧳 */\n";
  const { code: c, comments: n } = splitSource(raw);
  assert.equal(c.length, raw.length);
  assert.equal(n.length, raw.length);
  assert.equal(rejoin(c, n), raw);
  const f = 'src/components/trips/HotelPicker.tsx';
  assert.equal(rejoin(code(f), comments(f)).length, code(f).length);
});

test('FORBIDDEN held: no booking call from the itinerary, no automatic match, no fallback', () => {
  const section = code(SECTION);
  assert.deepEqual([...section.matchAll(/fetch\(`([^`]+)`/g)].map((m) => m[1]), ['/api/trips/${trip.id}/itinerary', '/api/trips/${trip.id}/vendor-commit']);
  assert.match(section, /method: 'DELETE'/);
  assert.doesNotMatch(section, /method: 'POST'|\/api\/travel\//, 'it books nothing and pays nothing');
  assert.match(section, /confirm\('Remove this from your itinerary and budget\?'\)/, "the trip page's own uncommit confirm");
  const feed = code(FEED);
  assert.doesNotMatch(feed, /planned_item_links|transaction_reservation_links|journal_entries/, 'no trip row is matched to a posting or a reservation');
  const leaf = code(LEAF);
  assert.doesNotMatch(leaf, /\bcost\b|budget_amount|\bamount\b/, 'the overlay copies no money');
  assert.doesNotMatch(leaf, /fallback|catch \(/i);
  assert.match(leaf, /const timed = isDateOnlyTripType\(item\.vendorOptionType\) && e\.start_time == null;/, "a row's own clock wins; only a clockless date-only row is timed");
});
