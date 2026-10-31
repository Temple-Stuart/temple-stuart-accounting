/**
 * LEGACY-DEL-02 (2026-09-30) — the rest of the dead travel code is deleted: seeded regressions.
 *
 * The ruling: the 14 files nothing mounted and the 8 trip option routes only they called are
 * deleted, and the laws hold them deleted exactly as LEGACY-DEL-01 did. The trips-tab law's
 * clause 6 says none of the 22 exists and nothing under src imports one of the files or
 * fetches one of the routes; the travel law holds HotelPicker's pin gone with its last hash.
 * Each is proven here:
 *
 *   · RE-CREATE a deleted file (the harness's create form — find '' names a file that must
 *     not exist; the harness makes it and its missing folders, runs the laws, removes both,
 *     and refuses to overwrite a real one): the pinned picker, a component, the showroom in
 *     its deleted folder, a list route and an [optionId] route.
 *   · RE-ADD an import of a deleted file, and a fetch of a deleted route — a template path to
 *     a list route, and a path built by '+' to an [optionId] route.
 *   · RE-PIN the deleted picker, and drop its note — the travel law.
 *
 * Each must fail the build by name, the law's own prefix in the expect. The anchors of the
 * edit seeds occur exactly once in their file, which the harness enforces first.
 */
import type { Seed } from '../prove';

const PINS = 'src/lib/travelBookingFlow.ts';
const TRIPS_LIST = 'src/components/trips/AllTripsList.tsx';
const A_COMPONENT = "export default function Deleted() { return null; }\n";
const A_ROUTE = "export async function GET() { return new Response(null); }\n";
const DELETE_CALL = "      const res = await fetch(`/api/trips/${trip.id}`, { method: 'DELETE' });";

const SEEDS: Seed[] = [
  // ── the travel law: the pinned picker ──
  {
    name: 'legacydel02-a the showroom\'s pinned hotel picker comes back (a deleted pinned file re-created)',
    file: 'src/components/trips/HotelPicker.tsx',
    find: '',
    replace: A_COMPONENT,
    expect: 'travel law: src/components/trips/HotelPicker.tsx exists — it was deleted with the dead travel code (LEGACY-DEL-02) and is held deleted',
  },
  {
    name: 'legacydel02-b the picker is pinned again',
    file: PINS,
    find: "  { file: 'src/lib/travelSourceRegistry.ts', sha256: '93646472a2376cecc49695c98626b04f9f8caa5e8fcdf80d015bbdae05dfae65' },\n",
    replace: "  { file: 'src/lib/travelSourceRegistry.ts', sha256: '93646472a2376cecc49695c98626b04f9f8caa5e8fcdf80d015bbdae05dfae65' },\n  { file: 'src/components/trips/HotelPicker.tsx', sha256: 'e869b851fb14b80d4a73e01f8113a902004498822d0f2af128f1215394972c41' },\n",
    expect: 'travel law: src/components/trips/HotelPicker.tsx is pinned again — its pin left the census with the file (LEGACY-DEL-02)',
  },
  {
    name: 'legacydel02-c the deleted pin loses its note and its last hash',
    file: PINS,
    find: "  //   src/components/trips/HotelPicker.tsx — the showroom's hotel picker (re-pinned by the hotel ruling of 2026-09-22). Was e869b851fb14b80d4a73e01f8113a902004498822d0f2af128f1215394972c41 at main 1cd7993b.\n",
    replace: '',
    expect: 'travel law: src/lib/travelBookingFlow.ts carries no LEGACY-DEL-02 note naming src/components/trips/HotelPicker.tsx with its last hash',
  },
  // ── the trips-tab law, clause 6: the 22 do not exist ──
  {
    name: 'legacydel02-d the lodging option form comes back (a deleted component re-created)',
    file: 'src/components/trips/LodgingOptions.tsx',
    find: '',
    replace: A_COMPONENT,
    expect: 'trips-tab law: src/components/trips/LodgingOptions.tsx exists — the dead travel code was deleted (LEGACY-DEL-02); it is held deleted',
  },
  {
    name: 'legacydel02-e the showroom comes back in its deleted folder',
    file: 'src/components/trips/showroom/TravelPipelineShowroom.tsx',
    find: '',
    replace: A_COMPONENT,
    expect: 'trips-tab law: src/components/trips/showroom/TravelPipelineShowroom.tsx exists — the dead travel code was deleted (LEGACY-DEL-02); it is held deleted',
  },
  {
    name: 'legacydel02-f a lodging option\'s writer comes back (a deleted [optionId] route re-created)',
    file: 'src/app/api/trips/[id]/lodging/[optionId]/route.ts',
    find: '',
    replace: "export async function DELETE() { return new Response(null); }\n",
    expect: 'trips-tab law: src/app/api/trips/[id]/lodging/[optionId]/route.ts exists — the dead travel code was deleted (LEGACY-DEL-02); it is held deleted',
  },
  {
    name: 'legacydel02-g the activity option list comes back (a deleted list route re-created)',
    file: 'src/app/api/trips/[id]/activities/route.ts',
    find: '',
    replace: A_ROUTE,
    expect: 'trips-tab law: src/app/api/trips/[id]/activities/route.ts exists — the dead travel code was deleted (LEGACY-DEL-02); it is held deleted',
  },
  // ── the trips-tab law, clause 6: nothing imports or fetches one ──
  {
    name: 'legacydel02-h the hub imports the deleted expenses card again',
    file: 'src/components/hub/HubCalendar.tsx',
    find: "import { CALENDAR_SOURCES, isRenderedCalendarSource } from '@/lib/calendar/sources';",
    replace: "import TripExpensesCard from '@/components/hub/TripExpensesCard';\nimport { CALENDAR_SOURCES, isRenderedCalendarSource } from '@/lib/calendar/sources';",
    expect: 'trips-tab law: src/components/hub/HubCalendar.tsx imports @/components/hub/TripExpensesCard',
  },
  {
    name: 'legacydel02-i a live list fetches the deleted vehicle options (a template path to a list route)',
    file: TRIPS_LIST,
    find: DELETE_CALL,
    replace: "      void fetch(`/api/trips/${trip.id}/vehicles`);\n" + DELETE_CALL,
    expect: 'trips-tab law: src/components/trips/AllTripsList.tsx fetches /api/trips/[id]/vehicles — the dead travel code\'s route was deleted (LEGACY-DEL-02)',
  },
  {
    name: 'legacydel02-j a live list writes a deleted transfer option (a path built by + to an [optionId] route)',
    file: TRIPS_LIST,
    find: DELETE_CALL,
    replace: "      void fetch('/api/trips/' + trip.id + '/transfers/' + trip.id, { method: 'DELETE' });\n" + DELETE_CALL,
    expect: 'trips-tab law: src/components/trips/AllTripsList.tsx fetches /api/trips/[id]/transfers/[optionId]',
  },
];

export default SEEDS;
