import { redirect } from 'next/navigation';

// TRIPS-01 (2026-09-29): the legacy planner's discover detail (one place or hotel of a
// trip) → that trip on the Travel tab, the one Trips tab, where places, stays and
// tours are searched and booked. The redirect reads NO database — it no longer loads
// the scanner row, the hotel content or its reviews: the trip id rides along, encoded
// (it can never add a parameter of its own), and the Travel tab answers it from the
// user's own loaded trips (src/lib/trips/tripFromUrl.ts). A redirect and nothing else:
// no UI, no data read.
export default async function LegacyDiscoverRedirect({ params }: {
  params: Promise<{ id: string; category: string; rank: string }>;
}) {
  const { id } = await params;
  redirect(`/travel?trip=${encodeURIComponent(id)}`);
}
