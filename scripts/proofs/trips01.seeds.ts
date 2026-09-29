/**
 * The trips-tab law (TRIPS-01, 2026-09-29) — seeded regressions.
 *
 * The ruling: the Travel tab is the one Trips tab; nothing leads to the legacy planner
 * under /budgets/trips. Its three seeds come first — the sub-link back, a
 * /budgets/trips href in AllBookings, a redirect page given a prisma read — then one
 * per clause the law states: every link that was re-pointed, going back; each redirect
 * page growing UI, a client directive, an import, or dropping the trip; the ?trip
 * selection reaching outside the loaded list; the closed list growing; the re-pin
 * losing its date.
 *
 * Each must fail the build by name. The anchors occur exactly once in their file,
 * which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const REGISTRY = 'src/lib/toolRegistry.ts';
const ALL_BOOKINGS = 'src/components/trips/AllBookings.tsx';
const INDEX = 'src/app/budgets/trips/page.tsx';
const NEW = 'src/app/budgets/trips/new/page.tsx';
const TRIP = 'src/app/budgets/trips/[id]/page.tsx';
const LEAF = 'src/lib/trips/tripFromUrl.ts';
const LIST = 'src/components/trips/AllTripsList.tsx';
const LAUNCHER = 'src/components/home/ModuleLauncher.tsx';

const SEEDS: Seed[] = [
  // ── the ruling's three ──
  {
    name: 'trips01-a Travel gets its legacy sub-link back (the ruling\'s seed)',
    file: REGISTRY,
    find: "    links: [],\n    citation: 'src/app/api/travel/liteapi/flights/search/route.ts:23",
    replace: "    links: [{ label: 'Trips · the legacy pages', href: '/budgets/trips' }],\n    citation: 'src/app/api/travel/liteapi/flights/search/route.ts:23",
    expect: 'Travel carries no sub-link, ever',
  },
  {
    name: 'trips01-b a /budgets/trips href in AllBookings (the ruling\'s seed)',
    file: ALL_BOOKINGS,
    find: '<Link href={b.tripHref}',
    replace: '<Link href={`/budgets/trips/${b.id}`}',
    expect: 'src/components/trips/AllBookings.tsx names /budgets/trips',
  },
  {
    name: 'trips01-c a redirect page given a prisma read (the ruling\'s seed)',
    file: TRIP,
    find: '  const { id } = await params;\n',
    replace: "  const { id } = await params;\n  const { prisma } = await import('@/lib/prisma');\n  await prisma.trips.findUnique({ where: { id } });\n",
    expect: 'reads data — the redirect reads nothing',
  },
  // ── every re-pointed link, going back ──
  {
    name: 'trips01-d a booking\'s Trip button goes back to the legacy planner',
    file: 'src/lib/reservations/bookingRow.ts',
    find: '`/travel?trip=${r.tripId}`',
    replace: '`/budgets/trips/${r.tripId}`',
    expect: 'src/lib/reservations/bookingRow.ts names /budgets/trips',
  },
  {
    name: 'trips01-e a trip created without a callback navigates to the legacy planner',
    file: 'src/components/trips/CreateTripForm.tsx',
    find: 'router.push(`/travel?trip=${newId}`);',
    replace: 'router.push(`/budgets/trips/${newId}`);',
    expect: 'src/components/trips/CreateTripForm.tsx names /budgets/trips',
  },
  {
    name: 'trips01-f a planner card goes back to the discover page',
    file: 'src/components/trips/TripPlannerAI.tsx',
    find: 'router.push(`/travel?trip=${tripId}`);',
    replace: 'router.push(`/budgets/trips/${tripId}/discover`);',
    expect: 'src/components/trips/TripPlannerAI.tsx names /budgets/trips',
  },
  // ── each legacy page is a redirect ──
  {
    name: 'trips01-g the index redirect renders UI',
    file: INDEX,
    find: "  redirect('/travel');\n}",
    replace: "  redirect('/travel');\n  return <main>Your trips moved to the Travel tab.</main>;\n}",
    expect: 'renders UI — a redirect carries none',
  },
  {
    name: 'trips01-h the index redirect imports prisma',
    file: INDEX,
    find: "import { redirect } from 'next/navigation';\n",
    replace: "import { redirect } from 'next/navigation';\nimport { prisma } from '@/lib/prisma';\n",
    expect: 'imports something other than redirect from next/navigation',
  },
  {
    name: 'trips01-i the create-page redirect becomes a client component',
    file: NEW,
    find: "import { redirect } from 'next/navigation';\n",
    replace: "'use client';\nimport { redirect } from 'next/navigation';\n",
    expect: 'is a client component — a redirect renders nothing',
  },
  {
    name: 'trips01-j a trip\'s redirect drops the trip',
    file: TRIP,
    find: 'redirect(`/travel?trip=${encodeURIComponent(id)}`);',
    replace: "redirect('/travel');",
    expect: 'it does not redirect to /travel?trip=<its id>',
  },
  // ── the ?trip selection picks only from the user's loaded list ──
  {
    name: 'trips01-k the leaf builds a trip that is not in the list',
    file: LEAF,
    find: "return trip === undefined ? { kind: 'notYours' } : { kind: 'selected', trip };",
    replace: "return { kind: 'selected', trip: trip ?? ({ id: requested } as unknown as T) };",
    expect: 'selects a trip that is not in the list',
  },
  {
    name: 'trips01-l the leaf reads ?trip on every path',
    file: LEAF,
    find: "if (pathname !== '/travel' || params === null) return null;",
    replace: 'if (params === null) return null;',
    expect: 'the leaf reads ?trip off /travel',
  },
  {
    name: 'trips01-m the list answers before it has loaded',
    file: LIST,
    find: 'urlTripStep(requestedTripId, !loading && error === null, trips, answered)',
    replace: 'urlTripStep(requestedTripId, true, trips, answered)',
    expect: 'the selection does not wait for its list to load',
  },
  {
    name: 'trips01-n the list fetches the requested trip itself',
    file: LIST,
    find: "    fetch('/api/trips')\n",
    replace: "    fetch(requestedTripId ? `/api/trips/${requestedTripId}` : '/api/trips')\n",
    expect: 'no new fetch',
  },
  {
    name: 'trips01-o the launcher sets the current trip from the URL itself',
    file: LAUNCHER,
    find: '  const tripsSection = useRef<HTMLElement>(null);\n',
    replace: '  const tripsSection = useRef<HTMLElement>(null);\n  useEffect(() => { if (requestedTripId) setCurrentTrip({ id: requestedTripId } as TripRow); }, [requestedTripId]);\n',
    expect: 'it sets the current trip from the URL itself',
  },
  // ── the closed list, and the re-pin ──
  {
    name: 'trips01-p the pathname-test list grows',
    file: 'scripts/assert-tool-registry.ts',
    find: "  { file: 'src/components/trips/TripCreationBar.tsx', line:",
    replace: "  { file: 'src/components/trips/AllBookings.tsx', line: 'seeded', why: 'seeded' },\n  { file: 'src/components/trips/TripCreationBar.tsx', line:",
    expect: 'the pathname-test list grew to 3',
  },
  {
    name: 'trips01-q the planner\'s re-pin loses the hash it had on main',
    file: 'src/lib/travelBookingFlow.ts',
    find: '  // Was 2199015c8e7688ec81e77d44c50c1c23bd123ae0b97c02443767c90f13b7ac3b at main 536c862b.\n',
    replace: '',
    expect: 'pin does not sit under a dated TRIPS-01 note with the hash it had on main 536c862b',
  },
];

export default SEEDS;
