import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import TripPostView from '@/components/trip/TripPostView';
import { WAS_HERE, type WasHereRow } from '@/lib/wasHere';
import { cardOf, type TripPostCard } from '@/lib/tripPostCards';
import { TRIP_POSTS, postOf, type TripPost } from '@/lib/tripPosts';
import { stopNumber } from '@/lib/tripPostWords';

/**
 * /my-trip/<stop id> (TRIPPOST-01, Alex, 2026-11-05) — one stop's post: Alex's own write-up of
 * a stop on the trip log, opened from that stop's card on the front door (WasHereSection.tsx).
 * A public server page (middleware PUBLIC_PATHS '/my-trip'): zero fetch, zero authed reads,
 * zero paid calls, zero env reads, zero database reads — fixed words from two pure leaves
 * (src/lib/tripPostCards.ts, src/lib/tripPosts.ts) and the trip log (src/lib/wasHere.ts).
 *
 * STATIC BY RULING. generateStaticParams lists the posts the leaves hold and dynamicParams =
 * false, so every other id 404s at the router — the repo's first static params (the modules
 * page renders live availability and stays dynamic; this page has nothing live). An id the
 * leaves do not hold → notFound(), never a guessed page.
 */

export const dynamicParams = false;

export function generateStaticParams(): Array<{ id: string }> {
  return TRIP_POSTS.map((post) => ({ id: post.stopId }));
}

/** The stop, its card and its post — or null when any of the three is missing (the page 404s). */
function entryOf(id: string): { row: WasHereRow; card: TripPostCard; post: TripPost } | null {
  const row = WAS_HERE.find((r) => r.id === id);
  const card = cardOf(id);
  const post = postOf(id);
  if (row === undefined || card === null || post === null) return null;
  return { row, card, post };
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const entry = entryOf(id);
  if (entry === null) notFound();
  const title = `${entry.card.title} — Temple Stuart`;
  return { title, description: entry.post.dek, openGraph: { title, description: entry.post.dek, type: 'article' } };
}

export default async function TripPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entry = entryOf(id);
  if (entry === null) notFound();
  return (
    <div className="min-h-screen bg-bg-terminal text-text-primary">
      <LandingHeader />
      <main data-trip-post-page>
        <TripPostView row={entry.row} card={entry.card} post={entry.post} stop={stopNumber(WAS_HERE, id)} />
      </main>
      <LandingFooter />
    </div>
  );
}
