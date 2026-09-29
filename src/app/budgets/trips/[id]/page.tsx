import { redirect } from 'next/navigation';

// TRIPS-01 (2026-09-29): one trip in the legacy planner → the same trip on the Travel
// tab, the one Trips tab. The redirect reads NO database: the id rides along, encoded
// (it can never add a parameter of its own; a trip id is a cuid, so a real one arrives
// exactly), and the Travel tab answers it from the user's own loaded trips
// (src/lib/trips/tripFromUrl.ts) — a trip that is not yours selects nothing and says
// so. A redirect and nothing else: no UI, no data read.
export default async function LegacyTripRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/travel?trip=${encodeURIComponent(id)}`);
}
