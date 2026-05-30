import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { TRAVEL_COA } from '@/lib/travelCOA';
import { getSource, type Source } from '@/lib/travelSourceRegistry';
import { AppLayout } from '@/components/ui';
import { ReserveHotelButton } from './ReserveHotelButton';

// Per-source action label + URL builder. Honest about what each source can
// actually do — no fake Book buttons on Google places (Google can't take a
// restaurant reservation).
function externalAction(source: Source, rec: Recommendation): { label: string; url: string } | null {
  if (source === 'viator' && (rec.viatorBookingUrl || rec.viatorProductCode)) {
    return {
      label: 'Book on Viator',
      url: rec.viatorBookingUrl || `https://www.viator.com/tours/${rec.viatorProductCode}?pid=P00294427&mcid=42383&medium=api`,
    };
  }
  if (source === 'google' && rec.name) {
    const q = encodeURIComponent(`${rec.name} ${rec.address || ''}`.trim());
    return { label: 'Open in Google Maps', url: `https://www.google.com/maps/search/?api=1&query=${q}` };
  }
  return null;
}

interface Recommendation {
  name: string;
  address: string;
  website: string | null;
  photoUrl: string | null;
  priceLevel: number | null;
  priceLevelDisplay: string | null;
  googleRating: number;
  reviewCount: number;
  summary?: string;
  compositeScore?: number;
  valueRank: number;
  category: string;
  // bookable signal fields:
  price?: number | null;
  durationMinutes?: number | null;
  // Viator
  viatorProductCode?: string;
  viatorBookingUrl?: string | null;
  bookingUrl?: string | null;
  // LiteAPI
  liteapiHotelId?: string;
  liteapiOfferId?: string | null;
  // LiteAPI richness (PR-13) — all optional; PR-14's card UI consumes these.
  city?: string;
  addressLine?: string;
  latitude?: number;
  longitude?: number;
  reviewScore?: number;
  chain?: string;
  images?: string[];
  facilities?: string[];
  currency?: string;
  priceTotal?: number;
  nights?: number;
  pricePerNight?: number; // PR-15: priceTotal / nights
}

export default async function DiscoverDetailPage({
  params,
}: {
  params: Promise<{ id: string; category: string; rank: string }>;
}) {
  const { id: tripId, category, rank: rankStr } = await params;

  // ─── Auth + ownership (security mandate) ─────────────────────────────────
  const userEmail = await getVerifiedEmail();
  if (!userEmail) redirect('/api/auth/signin');
  const user = await prisma.users.findFirst({
    where: { email: { equals: userEmail, mode: 'insensitive' } },
    select: { id: true },
  });
  if (!user) redirect('/api/auth/signin');

  const trip = await prisma.trips.findFirst({
    where: { id: tripId, userId: user.id },
    select: {
      id: true, destination: true, startDate: true, endDate: true, daysTravel: true,
    },
  });
  if (!trip) notFound();

  // ─── Find the recommendation by (tripId, category, valueRank) ────────────
  const wantedRank = parseInt(rankStr, 10);
  if (!Number.isFinite(wantedRank)) notFound();

  const rows = await prisma.trip_scanner_results.findMany({
    where: { tripId, category },
    orderBy: { updatedAt: 'desc' },
  });
  let rec: Recommendation | null = null;
  let destinationLabel: string | null = null;
  for (const row of rows) {
    const recs = (row.recommendations || []) as unknown as Recommendation[];
    const match = recs.find(r => r.valueRank === wantedRank);
    if (match) {
      rec = match;
      destinationLabel = row.destination;
      break;
    }
  }
  if (!rec) notFound();

  const { source } = getSource(category);
  const categoryLabel = TRAVEL_COA[category]?.label || category;
  const external = externalAction(source, rec);
  const sourceBadge = source === 'liteapi' ? 'via LiteAPI'
    : source === 'viator' ? 'via Viator'
    : source === 'google' ? 'Google · discovery (no booking)'
    : `via ${source}`;

  // For LiteAPI hotels: PR-15 reads the per-night price directly (no recompute).
  // `stayTotal` is the whole-stay total (rec.price) — it is NOT pricePerNight ×
  // nights (that was the double-count bug). stayTotal also stays the charge
  // fallback handed to ReserveHotelButton, unchanged.
  const nights = trip.daysTravel || 1;
  const perNight = rec.pricePerNight ?? null;
  const stayTotal = rec.price ?? null;

  // Dates for the Reserve flow (LiteAPI needs ISO YYYY-MM-DD).
  const checkin = trip.startDate ? trip.startDate.toISOString().slice(0, 10) : null;
  const checkout = trip.endDate ? trip.endDate.toISOString().slice(0, 10) : null;

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 lg:p-6">
        {/* Back link */}
        <Link href={`/budgets/trips/${tripId}`}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-brand-purple mb-4">
          ← Back to trip
        </Link>

        {/* Photo */}
        <div className="rounded-lg overflow-hidden border border-border bg-gray-100 mb-4">
          {rec.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={rec.photoUrl} alt={rec.name} className="w-full h-72 sm:h-96 object-cover" />
          ) : (
            <div className="w-full h-72 sm:h-96 bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center text-text-muted text-sm">
              No photo
            </div>
          )}
        </div>

        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
          <div className="min-w-0">
            <div className="text-xs text-text-muted">{categoryLabel}{destinationLabel ? ` · ${destinationLabel}` : ''}</div>
            <h1 className="text-2xl font-bold text-text-primary mt-1">{rec.name}</h1>
          </div>
          <span className={`text-xs font-medium ${source === 'google' ? 'text-text-faint' : 'text-brand-purple'}`}>
            {sourceBadge}
          </span>
        </div>

        {/* Quick facts */}
        <div className="flex items-center gap-3 flex-wrap text-sm text-text-muted mb-4">
          {rec.googleRating > 0 && (
            <span>★ {rec.googleRating}{rec.reviewCount ? ` (${rec.reviewCount} reviews)` : ''}</span>
          )}
          {rec.priceLevelDisplay && <span>{rec.priceLevelDisplay}</span>}
          {rec.durationMinutes != null && (
            <span>{rec.durationMinutes >= 60 ? `${Math.floor(rec.durationMinutes / 60)}h${rec.durationMinutes % 60 ? ` ${rec.durationMinutes % 60}m` : ''}` : `${rec.durationMinutes}m`}</span>
          )}
        </div>

        {/* Address */}
        {rec.address && (
          <div className="text-sm text-text-secondary mb-4">{rec.address}</div>
        )}

        {/* Description */}
        {rec.summary && (
          <p className="text-sm text-text-secondary mb-6 leading-relaxed">{rec.summary}</p>
        )}

        {/* Pricing block — only when we have real numbers */}
        {source === 'liteapi' && perNight != null && (
          <div className="bg-bg-row border border-border rounded p-4 mb-4 text-sm">
            <div className="flex justify-between">
              <span>${perNight} <span className="text-text-muted">/ night</span></span>
              <span className="text-text-muted">× {nights} {nights === 1 ? 'night' : 'nights'}</span>
            </div>
            {stayTotal != null && (
              <div className="flex justify-between font-semibold border-t border-border mt-2 pt-2">
                <span>Total</span>
                <span>${stayTotal}</span>
              </div>
            )}
          </div>
        )}

        {/* Honest, source-aware action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {source === 'liteapi' && rec.liteapiOfferId && checkin && checkout ? (
            <ReserveHotelButton
              tripId={tripId}
              offerId={rec.liteapiOfferId}
              hotelName={rec.name}
              checkinDate={checkin}
              checkoutDate={checkout}
              nightly={stayTotal}
              currency="USD"
            />
          ) : source === 'liteapi' && (!checkin || !checkout) ? (
            <span className="text-xs text-orange-600 px-3 py-2 border border-orange-200 bg-orange-50 rounded">
              Set trip Start/End dates to enable Reserve.
            </span>
          ) : source === 'liteapi' ? (
            <span className="text-xs text-text-muted px-3 py-2 border border-border rounded">
              No bookable offer for this hotel — try another.
            </span>
          ) : null}

          {source === 'mozio' && (
            <span className="text-xs text-text-muted px-3 py-2 border border-border rounded">
              Mozio not connected yet — coming soon.
            </span>
          )}

          {external && (
            <a
              href={external.url}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-brand-purple text-white text-sm font-medium rounded hover:bg-brand-purple-hover"
            >
              {external.label} ↗
            </a>
          )}

          {/* "Add to trip" — links back to the planner where the existing
              commit-to-budget flow lives. The carousel cards on the planner
              page reopen for a quick commit. */}
          <Link
            href={`/budgets/trips/${tripId}`}
            className="px-4 py-2 border border-border text-sm font-medium rounded hover:bg-bg-row"
          >
            Add to trip
          </Link>
        </div>

        {source === 'google' && (
          <p className="text-xs text-text-faint mt-3 leading-relaxed">
            Google Places is discovery-only — restaurants and similar venues don&apos;t take in-app
            reservations. Use the Google Maps link to call or book directly.
          </p>
        )}
      </div>
    </AppLayout>
  );
}
