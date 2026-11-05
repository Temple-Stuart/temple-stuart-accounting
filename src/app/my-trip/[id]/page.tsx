import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import TripPostView from '@/components/trip/TripPostView';
import { WAS_HERE, type WasHereRow } from '@/lib/wasHere';
import { cardOf, type TripPostCard } from '@/lib/tripPostCards';
import { postOf, type TripPost } from '@/lib/tripPosts';
import { costsOf, type TripCosts } from '@/lib/tripCosts';
import { stopHeading, stopNumber } from '@/lib/tripPostWords';

/**
 * /my-trip/<stop id> (TRIPPOST-01, Alex, 2026-11-05) — one stop's page, opened from that stop's
 * card on the front door (WasHereSection.tsx). TRIPCARDS-01 (2026-11-05): EVERY stop on the trip
 * log has one — written up (its post) or not yet (the stop's facts and a line saying so).
 * A public server page (middleware PUBLIC_PATHS '/my-trip'): zero fetch, zero authed reads, zero
 * paid calls, zero env reads, zero database reads — fixed words from pure leaves (src/lib/wasHere.ts,
 * src/lib/tripCosts.ts, src/lib/tripPostCards.ts, src/lib/tripPosts.ts).
 *
 * STATIC BY RULING. generateStaticParams lists every stop the trip log holds and dynamicParams =
 * false, so every other id 404s at the router — the repo's first static params (the modules page
 * renders live availability and stays dynamic; this page has nothing live). An id the leaves do
 * not hold → notFound(), never a guessed page.
 */

export const dynamicParams = false;

export function generateStaticParams(): Array<{ id: string }> {
  return WAS_HERE.map((row) => ({ id: row.id }));
}

/** The stop and its costs, and its card and post (both, or neither — the build holds them together). An id that is not a stop → null (404). */
function entryOf(id: string): { row: WasHereRow; costs: TripCosts; card: TripPostCard | null; post: TripPost | null } | null {
  const row = WAS_HERE.find((r) => r.id === id);
  if (row === undefined) return null;
  const costs = costsOf(id);
  // A stop with no costs row fails loud — never a 404 that hides it (the build law holds a row for every stop).
  if (costs === null) throw new Error(`my trip: stop "${id}" has no costs row (src/lib/tripCosts.ts)`);
  return { row, costs, card: cardOf(id), post: postOf(id) };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const entry = entryOf(id);
  if (entry === null) notFound();
  const title = entry.card === null ? `${stopHeading(entry.row)} — my trip — Temple Stuart` : `${entry.card.title} — Temple Stuart`;
  const description = entry.post === null ? `Stop ${stopNumber(WAS_HERE, id)} of my trip: where I stayed and what it cost.` : entry.post.dek;
  return { title, description, openGraph: { title, description, type: 'article' } };
}

export default async function TripPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = entryOf(id);
  if (entry === null) notFound();
  return (
    <div className="min-h-screen bg-bg-terminal text-text-primary">
      <LandingHeader />
      <main data-trip-post-page>
        <TripPostView row={entry.row} costs={entry.costs} card={entry.card} post={entry.post} stop={stopNumber(WAS_HERE, id)} />
      </main>
      <LandingFooter />
    </div>
  );
}
