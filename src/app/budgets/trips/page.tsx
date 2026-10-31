import { redirect } from 'next/navigation';

// TRIPS-01 (2026-09-29): the legacy trip planner's index. There is ONE Trips tab —
// the Travel tab — and nothing in the app leads here any more (TRIPS-01 re-pointed
// every link at /travel). This redirect keeps a link already in the wild working:
// a bookmark, an email, a rail row printed before the move.
//
// A redirect and nothing else: no UI, no data read. The components the legacy
// pages mounted are unreachable now; deleting them is the next ruling.
export default function LegacyTripsRedirect() {
  redirect('/travel');
}
