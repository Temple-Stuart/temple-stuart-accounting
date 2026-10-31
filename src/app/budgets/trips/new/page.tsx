import { redirect } from 'next/navigation';

// TRIPS-01 (2026-09-29): the legacy planner's create page. A trip is created on the
// Travel tab — the one Trips tab — from its "+ Create a trip" button, so this URL
// lands there. A redirect and nothing else: no UI, no data read.
export default function LegacyNewTripRedirect() {
  redirect('/travel');
}
