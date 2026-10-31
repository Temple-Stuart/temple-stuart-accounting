/**
 * LEGACY-DEL-01 (2026-09-29) — the legacy trip planner is deleted: seeded regressions.
 *
 * The ruling: the 12 files only the legacy planner used and the 8 routes only it called
 * are deleted, and the laws hold them deleted. The trips-tab law's clause 6 says none of
 * the 20 exists and nothing under src imports one of the files or fetches one of the
 * routes; the travel, stay and budget-link laws each turned a check whose only subject
 * was a deleted file into an existence check. Each is proven here:
 *
 *   · RE-CREATE a deleted file (the harness's create form — find '' names a file that
 *     must not exist; the harness makes it, runs the laws, removes it, and refuses to
 *     overwrite a real one): a component, a leaf's caller, a route; each law that holds
 *     one deleted catches it by name.
 *   · RE-ADD an import of a deleted file, and a fetch of a deleted route in each form a
 *     call takes: a template path, an origin-prefixed path, a path built by '+'.
 *   · RE-PIN a deleted file, and drop a deleted pin's note — the travel law.
 *
 * Each must fail the build by name, the law's own prefix in the expect. The anchors of
 * the edit seeds occur exactly once in their file, which the harness enforces first.
 */
import type { Seed } from '../prove';

const APP_LAYOUT = 'src/components/ui/AppLayout.tsx';
const TRIPS_LIST = 'src/components/trips/AllTripsList.tsx';
const CREATE_FORM = 'src/components/trips/CreateTripForm.tsx';
const PINS = 'src/lib/travelBookingFlow.ts';
const A_COMPONENT = "export default function Deleted() { return null; }\n";
const A_ROUTE = "export async function GET() { return new Response(null); }\n";

const SEEDS: Seed[] = [
  // ── the trips-tab law, clause 6: the 20 do not exist ──
  {
    name: 'legacydel01-a the legacy bar comes back (a deleted file re-created)',
    file: 'src/components/trips/TripCreationBar.tsx',
    find: '',
    replace: A_COMPONENT,
    expect: 'trips-tab law: src/components/trips/TripCreationBar.tsx exists — the legacy planner was deleted (LEGACY-DEL-01); it is held deleted',
  },
  {
    name: 'legacydel01-b the paid AI scan route comes back (a deleted route re-created)',
    file: 'src/app/api/trips/[id]/ai-assistant/route.ts',
    find: '',
    replace: A_ROUTE,
    expect: 'trips-tab law: src/app/api/trips/[id]/ai-assistant/route.ts exists — the legacy planner was deleted (LEGACY-DEL-01); it is held deleted',
  },
  // ── the trips-tab law, clause 6: nothing imports or fetches one ──
  {
    name: 'legacydel01-c AppLayout imports the deleted bar again',
    file: APP_LAYOUT,
    find: "import ShellBar from '@/components/ui/ShellBar';",
    replace: "import TripCreationBar from '@/components/trips/TripCreationBar';\nimport ShellBar from '@/components/ui/ShellBar';",
    expect: 'trips-tab law: src/components/ui/AppLayout.tsx imports @/components/trips/TripCreationBar',
  },
  {
    name: 'legacydel01-d a live list fetches the deleted AI scan route (a template path)',
    file: TRIPS_LIST,
    find: "      const res = await fetch(`/api/trips/${trip.id}`, { method: 'DELETE' });",
    replace: "      void fetch(`/api/trips/${trip.id}/ai-assistant`, { method: 'POST' });\n      const res = await fetch(`/api/trips/${trip.id}`, { method: 'DELETE' });",
    expect: 'trips-tab law: src/components/trips/AllTripsList.tsx fetches /api/trips/[id]/ai-assistant',
  },
  {
    name: 'legacydel01-e a live list fetches the deleted cost split (a path built by +)',
    file: TRIPS_LIST,
    find: "      const res = await fetch(`/api/trips/${trip.id}`, { method: 'DELETE' });",
    replace: "      void fetch('/api/trips/' + trip.id + '/expenses');\n      const res = await fetch(`/api/trips/${trip.id}`, { method: 'DELETE' });",
    expect: 'trips-tab law: src/components/trips/AllTripsList.tsx fetches /api/trips/[id]/expenses',
  },
  {
    name: 'legacydel01-f the create form fetches the deleted listing preview (an origin-prefixed path)',
    file: CREATE_FORM,
    find: "      const res = await fetch('/api/trips', {",
    replace: "      void fetch(`${window.location.origin}/api/fetch-og?url=x`);\n      const res = await fetch('/api/trips', {",
    expect: 'trips-tab law: src/components/trips/CreateTripForm.tsx fetches /api/fetch-og',
  },
  // ── the travel law: the four deleted pins ──
  {
    name: 'legacydel01-g the planner\'s hotel gallery comes back (a deleted pinned file re-created)',
    file: 'src/components/trips/HotelGallery.tsx',
    find: '',
    replace: A_COMPONENT,
    expect: 'travel law: src/components/trips/HotelGallery.tsx exists — it was deleted with the legacy trip planner (LEGACY-DEL-01) and is held deleted',
  },
  {
    name: 'legacydel01-h the in-trip flight picker is pinned again',
    file: PINS,
    find: "  { file: 'src/lib/travelSourceRegistry.ts', sha256: '93646472a2376cecc49695c98626b04f9f8caa5e8fcdf80d015bbdae05dfae65' },\n",
    replace: "  { file: 'src/lib/travelSourceRegistry.ts', sha256: '93646472a2376cecc49695c98626b04f9f8caa5e8fcdf80d015bbdae05dfae65' },\n  { file: 'src/components/trips/FlightPicker.tsx', sha256: 'fab753b0ba0166c634fd82b95c69fa009965c170ca7f07f795105214c5429d73' },\n",
    expect: 'travel law: src/components/trips/FlightPicker.tsx is pinned again',
  },
  {
    name: 'legacydel01-i a deleted pin loses its note and its last hash',
    file: PINS,
    find: "  //   src/components/trips/HotelMap.tsx — the planner's hotel map. Was 59b57e947baaec731a14f226b9f95434445e56286cebfd5f0ac1e234aa0cac3a at main 047e2c5b.\n",
    replace: '',
    expect: 'travel law: src/lib/travelBookingFlow.ts carries no LEGACY-DEL-01 note naming src/components/trips/HotelMap.tsx with its last hash',
  },
  // ── the stay law: the discover button, held deleted ──
  {
    name: 'legacydel01-j the discover page\'s Add-to-trip button comes back',
    file: 'src/app/budgets/trips/[id]/discover/[category]/[rank]/AddToTripButton.tsx',
    find: '',
    replace: A_COMPONENT,
    expect: 'stay law: src/app/budgets/trips/[id]/discover/[category]/[rank]/AddToTripButton.tsx exists',
  },
  // ── the budget-link law: the uncommit, held deleted ──
  {
    name: 'legacydel01-k the planner\'s commit and uncommit route comes back (a second writer of a trip\'s budget lines)',
    file: 'src/app/api/trips/[id]/commit/route.ts',
    find: '',
    replace: "export async function DELETE() { return new Response(null); }\n",
    expect: 'budget-link law: src/app/api/trips/[id]/commit/route.ts exists',
  },
];

export default SEEDS;
