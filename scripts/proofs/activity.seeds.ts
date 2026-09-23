/**
 * The activity law's seeded regressions (ACTIVITY-01).
 *
 * Each one changes ONE exact string in ONE file and must make THE ACTIVITY LAW
 * raise the violation named in `expect`. They live here, beside the law they
 * prove, and are re-run when that law's source changes — not on every PR that
 * touches a neighbouring file (scripts/prove.ts's header states the rule).
 *
 * These sixteen are STEP 4b's, moved here verbatim from the bash loop that first
 * ran them: the seal, the commit that takes no figure from the caller, and the
 * variable duration bounded by the operator's own range.
 */
import type { Seed } from '../prove';

const COMMIT = 'src/app/api/trips/[id]/vendor-commit/route.ts';
const SEAL = 'src/lib/activities/quoteSeal.ts';
const QUOTE = 'src/lib/activities/quote.ts';
const OPTIONS = 'src/app/api/travel/activities/options/route.ts';
const CONTAINER = 'src/components/trips/PublicActivitySearch.tsx';
const SEARCH = 'src/app/api/travel/activities/search/route.ts';

export const SEEDS: Seed[] = [
  {
    name: '4b-a the commit accepts the posted-figures shape again',
    file: COMMIT,
    find: '    if (viatorSaveInput !== undefined) {',
    replace: '    if (false) {',
    expect: 'does not refuse the posted-figures shape by name',
  },
  {
    name: '4b-b the commit skips the seal and trusts the quote',
    file: COMMIT,
    find: '      if (!sealHolds(viatorQuoteInput, viatorSealInput)) {',
    replace: '      if (false) {',
    expect: "sealHolds( is called from [] — one place",
  },
  {
    name: "4b-c the commit takes the caller's amount again",
    file: COMMIT,
    find: '    const requestAmount = viatorSave ? viatorSave.total.amount : requestAmountInput;',
    replace: '    const requestAmount = requestAmountInput;',
    expect: 'writes a figure, a note or a clock the caller sent',
  },
  {
    name: "4b-d the commit takes the caller's note again",
    file: COMMIT,
    find: '    const notes = viatorNote ?? notesInput;',
    replace: '    const notes = notesInput ?? viatorNote;',
    expect: 'writes a figure, a note or a clock the caller sent',
  },
  {
    name: '4b-e the commit stops checking whose quote it is',
    file: COMMIT,
    find: '      if (read.userId !== user.id) {',
    replace: '      if (false) {',
    expect: 'order is not seal → read → whose → how old → derive',
  },
  {
    name: '4b-f the commit stops checking how old the quote is',
    file: COMMIT,
    find: '      if (age > QUOTE_MAX_AGE_MINUTES) return',
    replace: '      if (false) return',
    expect: 'order is not seal → read → whose → how old → derive',
  },
  {
    name: '4b-g an amount rides along with the quote',
    file: COMMIT,
    find: '      if (requestAmountInput !== undefined || notesInput !== undefined || sentClock(startTimeInput) || sentClock(endTimeInput)) {',
    replace: '      if (sentClock(startTimeInput)) {',
    expect: 'lets an amount, a note or a clock ride along with a quote',
  },
  {
    name: "4b-h the quote key loses its domain (the session cookie's key)",
    file: SEAL,
    find: "  return crypto.createHmac('sha256', secret).update(QUOTE_SEAL_DOMAIN).digest();",
    replace: '  return Buffer.from(secret);',
    expect: 'key is not HMAC-SHA256(the secret, the domain)',
  },
  {
    name: '4b-i the seal is compared with === instead of in constant time',
    file: SEAL,
    find: '  return crypto.timingSafeEqual(expected, given);',
    replace: "  return expected.toString('hex') === given.toString('hex');",
    expect: 'does not compare seals in constant time over equal-length buffers',
  },
  {
    name: '4b-j the seal no longer fails closed without JWT_SECRET',
    file: SEAL,
    find: "  if (!secret) throw new Error('JWT_SECRET environment variable is required to seal a Viator quote');",
    replace: '  if (!secret) return Buffer.alloc(32);',
    expect: 'does not fail closed when JWT_SECRET is absent',
  },
  {
    name: '4b-k the raw pricing records are handed to the browser',
    file: OPTIONS,
    find: '      options: quoted,',
    replace: '      options: quoted, pricingDetails: options,',
    expect: 'hands the raw pricing records to the browser',
  },
  {
    name: '4b-l a seal is minted outside the options route',
    file: SEARCH,
    find: 'export async function GET(request: NextRequest) {',
    replace: 'const MINT = (q: unknown) => sealOf(q);\nexport async function GET(request: NextRequest) {',
    expect: 'sealOf( is called from',
  },
  {
    name: '4b-m the container posts an amount again',
    file: CONTAINER,
    find: '          viatorQuote: chosen.quote,',
    replace: '          amount: 1,\n          viatorQuote: chosen.quote,',
    expect: 'states a figure, a note or a clock to the commit',
  },
  {
    name: "4b-n the sealed band drops the operator's per-booking limit",
    file: QUOTE,
    find: '    maxPerBooking: booking?.maxTravelersPerBooking ?? null,',
    replace: '    maxPerBooking: null,',
    expect: "sealed ADULT band's limits read",
  },
  {
    name: '4b-o a variable end is no longer bounded by the stated range',
    file: QUOTE,
    find: '    if (end < lo || end > hi) return',
    replace: '    if (false) return',
    expect: "an end outside the operator's stated range was accepted",
  },
  {
    name: '4b-p a start time the operator states as SOLD_OUT can be saved',
    file: QUOTE,
    find: '  if (quote.unavailable !== null) return',
    replace: '  if (false) return',
    expect: 'a start time the operator states as SOLD_OUT was saved',
  },
];

export default SEEDS;
