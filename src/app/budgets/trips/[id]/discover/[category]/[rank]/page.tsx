import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { TRAVEL_COA } from '@/lib/travelCOA';
import { getSource, type Source } from '@/lib/travelSourceRegistry';
import { AppLayout } from '@/components/ui';
import { AddToTripButton } from './AddToTripButton';
import { PlaceCommitForm } from './PlaceCommitForm';
import HotelGallery from '@/components/trips/HotelGallery';
import HotelMap from '@/components/trips/HotelMap';
import { getHotelReviews, type HotelReview } from '@/lib/liteapiClient';
import { getHotelContent } from '@/lib/liteapiClient';
import {
  Waves, Wifi, Coffee, Dumbbell, Flower2, Car, Wind, Utensils, Wine, Dog, Baby,
  Accessibility, Cigarette, Briefcase, ConciergeBell, WashingMachine, Tv, Bath, Star, MapPin,
  type LucideIcon,
} from 'lucide-react';

// PR-22: facility-name → lucide icon for the full amenities grid. Includes the
// six PR-14 card icons plus common LiteAPI facilities; unmapped facilities get a
// generic check. Matching is case-insensitive contains-style.
const FACILITY_ICON_MAP: { match: string; Icon: LucideIcon }[] = [
  { match: 'pool', Icon: Waves }, { match: 'wifi', Icon: Wifi }, { match: 'breakfast', Icon: Coffee },
  { match: 'gym', Icon: Dumbbell }, { match: 'fitness', Icon: Dumbbell }, { match: 'spa', Icon: Flower2 },
  { match: 'parking', Icon: Car }, { match: 'air condition', Icon: Wind }, { match: 'restaurant', Icon: Utensils },
  { match: 'bar', Icon: Wine }, { match: 'pet', Icon: Dog }, { match: 'family', Icon: Baby },
  { match: 'wheelchair', Icon: Accessibility }, { match: 'accessible', Icon: Accessibility },
  { match: 'smoking', Icon: Cigarette }, { match: 'business', Icon: Briefcase },
  { match: 'concierge', Icon: ConciergeBell }, { match: 'laundry', Icon: WashingMachine },
  { match: 'tv', Icon: Tv }, { match: 'bath', Icon: Bath },
];
function iconForFacility(name: string): LucideIcon {
  const lower = name.toLowerCase();
  return FACILITY_ICON_MAP.find(m => lower.includes(m.match))?.Icon ?? Star;
}

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
  // PR-33: the exact search-window dates these rates were quoted for (ISO).
  // The commit path writes THIS window (the 29-night stay), not the whole-trip
  // span. checkout − checkin === nights by construction.
  checkinDate?: string;
  checkoutDate?: string;
  pricePerNight?: number; // PR-15: priceTotal / nights
  facilitiesAll?: string[]; // PR-22: full facility list (detail page)
  descriptionFull?: string; // PR-22: untruncated description (detail page)
}

export default async function DiscoverDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; category: string; rank: string }>;
  searchParams: Promise<{ destination?: string }>;
}) {
  const { id: tripId, category, rank: rankStr } = await params;
  const { destination } = await searchParams;

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
      id: true, destination: true, startDate: true, endDate: true, daysTravel: true, tripType: true,
    },
  });
  if (!trip) notFound();

  // ─── Find the recommendation by (tripId, destination, category, valueRank) ──
  // Resolve against the schema's unique key (tripId, destination, category) —
  // schema.prisma @@unique([tripId, destination, category]). valueRank is unique
  // only WITHIN a destination's row, so omitting destination let rank collide
  // across destinations of the same category and commit the WRONG place. The
  // destination is threaded from the carousel link (TripPlannerAI). If it's
  // absent we FAIL LOUD (notFound) rather than fall back to the old colliding
  // cross-destination query — ambiguous resolution must never guess.
  if (!destination) notFound();

  const wantedRank = parseInt(rankStr, 10);
  if (!Number.isFinite(wantedRank)) notFound();

  const rows = await prisma.trip_scanner_results.findMany({
    where: { tripId, destination, category },
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

  // Pre-select the commit COA to the SAME code the server would derive today, so
  // leaving the selector untouched reproduces current behaviour (it stays user-
  // overridable). Mirrors vendor-commit's prefix rules: synthetic activity
  // (Google) uses the placePrefix rule (B on business/mixed when the category is
  // business-capable, else P); lodging (LiteAPI) uses the plain trip-type prefix
  // (B only on a business trip). Codes come from the canonical TRAVEL_COA.
  const coaCat = TRAVEL_COA[category];
  const businessCapable = coaCat?.coaBusiness != null;
  let suggestedCoaCode: string | null = null;
  if (source === 'google' && coaCat) {
    const useBusiness = businessCapable && (trip.tripType === 'business' || trip.tripType === 'mixed');
    suggestedCoaCode = (useBusiness ? coaCat.coaBusiness : coaCat.coaPersonal) ?? coaCat.coaPersonal ?? coaCat.coaBusiness ?? null;
  } else if (source === 'liteapi') {
    const acc = TRAVEL_COA['accommodation'];
    suggestedCoaCode = (trip.tripType === 'business' ? acc.coaBusiness : acc.coaPersonal) ?? acc.coaPersonal ?? null;
  }

  // PR-28c: enrich the ONE viewed hotel from the rich /data/hotel content
  // endpoint (full gallery, full amenities, coords, guest-review aggregate,
  // full description) — the thin /hotels/rates rec lacks these. PAID call
  // (B-5100), one per detail-view, NEVER on scan. Rides inside this server
  // component's existing auth gate (getVerifiedEmail + trip-ownership above).
  // Graceful degradation: if the content call fails, we render `rec` exactly as
  // it came from rates (already-real data) — not a fabricated fallback.
  if (source === 'liteapi' && rec.liteapiHotelId) {
    try {
      const content = await getHotelContent(rec.liteapiHotelId);
      if (content) {
        const gallery = content.hotelImages?.map(im => im.urlHd || im.url).filter(Boolean) ?? [];
        // Content `rating` is a 0-5 guest score in observed responses; the rec's
        // reviewScore is 0-10. Normalise to 0-10 (mirrors the rates mapper's
        // ">5 means already-10" convention) so the aggregate badge reads right.
        const enrichedScore = content.rating != null
          ? (content.rating <= 5 ? Math.round(content.rating * 2 * 10) / 10 : content.rating)
          : undefined;
        rec = {
          ...rec,
          images: gallery.length ? gallery : rec.images,
          facilitiesAll: content.hotelFacilities?.length ? content.hotelFacilities : rec.facilitiesAll,
          latitude: content.location?.latitude ?? rec.latitude,
          longitude: content.location?.longitude ?? rec.longitude,
          reviewScore: enrichedScore ?? rec.reviewScore,
          reviewCount: content.reviewCount ?? rec.reviewCount,
          descriptionFull: content.hotelDescription
            ? content.hotelDescription.replace(/<[^>]*>/g, '')
            : rec.descriptionFull,
          city: rec.city ?? content.city,
          addressLine: rec.addressLine ?? content.address,
        };
      }
    } catch (err) {
      console.error('[PR-28c] getHotelContent failed — rendering rates-only rec:', err instanceof Error ? err.message : err);
    }
  }

  // For LiteAPI hotels: PR-15 reads the per-night price directly (no recompute).
  // `stayTotal` is the whole-stay total (rec.price) — it is NOT pricePerNight ×
  // nights (that was the double-count bug).
  // PR-21: nights MUST be the real search-window nights the card uses
  // (`rec.nights`, the PR-13/15 field) — NOT `trip.daysTravel` (the whole-trip
  // 185-night span). Reading daysTravel made the label say "× 185 nights" while
  // the total was a 30-night number, so the math didn't reconcile.
  const nights = rec.nights ?? null;
  const perNight = rec.pricePerNight ?? null;
  const stayTotal = rec.price ?? null;

  // PR-33: the "Add to trip" dates MUST be the exact search window the
  // rates were quoted for — `rec.checkinDate`/`rec.checkoutDate`, threaded from
  // the LiteAPI mapper (liteapiClient.ts). NEVER trip.startDate/endDate (the
  // whole-trip span) — that wrote a 184-night itinerary against a 29-night stay.
  // NO fallback to trip dates: if the rec lacks these (an older cached scan),
  // commit is disabled with an honest message rather than committing a
  // wrong window. checkout − checkin === nights by construction (asserted at
  // commit in AddToTripButton).
  const checkin = rec.checkinDate ?? null;
  const checkout = rec.checkoutDate ?? null;

  // PR-23: individual written guest reviews — a PAID LiteAPI call
  // (GET /v3.0/data/reviews, B-5100 COGS). Safe to fetch directly here: this is
  // a server component already gated by getVerifiedEmail() + trip-ownership
  // above, so the paid call is never public. getHotelReviews throws on API
  // error (fail-loud) — caught here so a reviews hiccup never 500s the whole
  // page, and the error state stays DISTINCT from a legitimately-empty list.
  let reviews: HotelReview[] = [];
  let reviewsError = false;
  if (source === 'liteapi' && rec.liteapiHotelId) {
    try {
      reviews = await getHotelReviews(rec.liteapiHotelId, { limit: 8 });
    } catch (err) {
      reviewsError = true;
      console.error('[PR-23] getHotelReviews failed:', err instanceof Error ? err.message : err);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto p-4 lg:p-6">
        {/* Back link */}
        <Link href={`/budgets/trips/${tripId}`}
          className="inline-flex items-center gap-1 text-sm text-text-muted hover:text-brand-purple mb-4">
          ← Back to trip
        </Link>

        {/* Gallery (PR-22) — hero + clickable thumbnails from rec.images[];
            single-hero fallback to rec.photoUrl when the gallery is empty. */}
        <div className="mb-4">
          <HotelGallery images={rec.images ?? []} fallback={rec.photoUrl} alt={rec.name} />
        </div>

        {/* Header — name + optional chain badge */}
        <div className="flex items-start justify-between flex-wrap gap-2 mb-3">
          <div className="min-w-0">
            <div className="text-xs text-text-muted">{categoryLabel}{destinationLabel ? ` · ${destinationLabel}` : ''}</div>
            <div className="flex items-center gap-2 flex-wrap mt-1">
              <h1 className="text-2xl font-bold text-text-primary">{rec.name}</h1>
              {rec.chain && (
                <span className="text-[10px] font-medium text-brand-purple bg-brand-purple-wash rounded px-2 py-0.5">{rec.chain}</span>
              )}
            </div>
          </div>
          <span className={`text-xs font-medium ${source === 'google' ? 'text-text-faint' : 'text-brand-purple'}`}>
            {sourceBadge}
          </span>
        </div>

        {/* Quick facts */}
        <div className="flex items-center gap-3 flex-wrap text-sm text-text-muted mb-4">
          {rec.googleRating > 0 && (
            <span><span className="text-brand-gold">★</span> <span className="text-text-primary font-medium">{rec.googleRating}</span></span>
          )}
          {rec.priceLevelDisplay && <span>{rec.priceLevelDisplay}</span>}
          {rec.durationMinutes != null && (
            <span>{rec.durationMinutes >= 60 ? `${Math.floor(rec.durationMinutes / 60)}h${rec.durationMinutes % 60 ? ` ${rec.durationMinutes % 60}m` : ''}` : `${rec.durationMinutes}m`}</span>
          )}
        </div>

        {/* Address + interactive map (PR-22 — reuses the itinerary's Leaflet/CARTO setup) */}
        {(rec.addressLine || rec.address || rec.city) && (
          <div className="text-sm text-text-secondary mb-2 flex items-start gap-1.5">
            <MapPin className="w-4 h-4 text-brand-purple flex-shrink-0 mt-0.5" aria-hidden="true" />
            <span>{rec.addressLine || rec.address}{rec.city ? `, ${rec.city}` : ''}</span>
          </div>
        )}
        {rec.latitude != null && rec.longitude != null && (
          <div className="mb-6">
            <HotelMap latitude={rec.latitude} longitude={rec.longitude} label={rec.name} />
          </div>
        )}

        {/* Amenities grid (PR-22) — full facilitiesAll; falls to the filtered 6
            facilities[] when the full list is absent (render case, not fabricated). */}
        {(() => {
          const amenities = (rec.facilitiesAll && rec.facilitiesAll.length ? rec.facilitiesAll : rec.facilities) ?? [];
          return amenities.length > 0 ? (
            <div className="mb-6">
              <h2 className="text-sm font-semibold text-text-primary mb-2">Amenities</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {amenities.map((f, i) => {
                  const Icon = iconForFacility(f);
                  return (
                    <div key={`${f}-${i}`} className="flex items-center gap-2 text-sm text-text-secondary">
                      <Icon className="w-4 h-4 text-brand-purple flex-shrink-0" aria-hidden="true" />
                      <span className="truncate">{f}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null;
        })()}

        {/* Guest reviews (PR-26: un-nested). The aggregate badge and the
            individual written reviews are INDEPENDENT:
              - aggregate badge gates on reviewScore/reviewCount (PR-22, unchanged)
              - individual list gates on `source==='liteapi' && rec.liteapiHotelId`
                — the SAME condition the fetch at :168-176 uses, so whenever we
                pay for /v3.0/data/reviews we render the result (or honest
                empty/error), never fetch-and-discard.
            One shared "Guest reviews" header when either has something to show. */}
        {((rec.reviewScore != null || rec.reviewCount > 0) || (source === 'liteapi' && rec.liteapiHotelId)) && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-text-primary mb-2">Guest reviews</h2>

            {/* AGGREGATE badge — condition unchanged from PR-22 */}
            {(rec.reviewScore != null || rec.reviewCount > 0) && (
              <div className="flex items-center gap-3">
                {rec.reviewScore != null && (
                  <span className="text-white bg-brand-purple rounded px-2.5 py-1.5 text-lg font-bold leading-none"
                    aria-label={`Guest review score ${rec.reviewScore} out of 10`}>
                    {rec.reviewScore}
                  </span>
                )}
                <div className="text-sm">
                  {rec.reviewScore != null && (
                    <div className="font-semibold text-text-primary">
                      {rec.reviewScore >= 9 ? 'Wonderful' : rec.reviewScore >= 8 ? 'Very good' : rec.reviewScore >= 7 ? 'Good' : rec.reviewScore >= 5 ? 'Pleasant' : 'Rated'}
                    </div>
                  )}
                  {rec.reviewCount > 0 && <div className="text-text-muted">{rec.reviewCount.toLocaleString()} reviews</div>}
                </div>
              </div>
            )}

            {/* INDIVIDUAL written reviews (PR-23) from /v3.0/data/reviews. Three
                DISTINCT states — error (loud, logged), empty (quiet), list. Only
                real returned fields render; nothing is fabricated. */}
            {source === 'liteapi' && rec.liteapiHotelId && (
              <div className="mt-4">
                {reviewsError ? (
                  <p className="text-xs text-text-muted">Guest reviews couldn&apos;t be loaded right now.</p>
                ) : reviews.length === 0 ? (
                  <p className="text-xs text-text-muted">No written guest reviews yet.</p>
                ) : (
                  <div className="space-y-3">
                    {reviews.map((r, i) => (
                      <div key={i} className="border-t border-border pt-3">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {typeof r.averageScore === 'number' && (
                            <span className="text-white bg-brand-purple rounded px-1.5 py-0.5 text-xs font-bold leading-none">{r.averageScore}</span>
                          )}
                          {r.name && <span className="text-sm font-medium text-text-primary">{r.name}</span>}
                          {r.country && <span className="text-[11px] text-text-faint uppercase">{r.country}</span>}
                          {r.type && <span className="text-[11px] text-text-muted">· {r.type}</span>}
                          {r.date && <span className="text-[11px] text-text-faint ml-auto">{r.date.slice(0, 10)}</span>}
                        </div>
                        {r.headline && <div className="text-sm text-text-secondary font-medium">{r.headline}</div>}
                        {r.pros && <p className="text-xs text-text-secondary mt-1"><span className="text-brand-green font-medium">+ </span>{r.pros}</p>}
                        {r.cons && <p className="text-xs text-text-secondary mt-0.5"><span className="text-brand-red font-medium">− </span>{r.cons}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* About this property (PR-22: full description when available, else the
            300-char summary the card uses) */}
        {(rec.descriptionFull || rec.summary) && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-text-primary mb-2">About this property</h2>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">{rec.descriptionFull || rec.summary}</p>
          </div>
        )}

        {/* Pricing block — only when we have real numbers (per-night AND the
            real nights, so the label and total reconcile — PR-21). */}
        {source === 'liteapi' && perNight != null && nights != null && (
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
          {source === 'liteapi' && (!checkin || !checkout) && (
            <span className="text-xs text-orange-600 px-3 py-2 border border-orange-200 bg-orange-50 rounded">
              {/* PR-33: missing search-window dates on the rec (an older cached
                  scan) — re-scan this hotel to refresh its dates. NO trip-date
                  fallback (that committed the wrong 184-night window). */}
              Re-scan this hotel to refresh its dates.
            </span>
          )}

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

          {/* PR-32: "Add to trip" commits this HOTEL into Committed Budget via
              the synthetic lodging path (/vendor-commit). amount = rec.price (the
              reconciled PR-21 whole-stay total, NOT recomputed); location =
              destinationLabel (the scan destination → trip_itinerary.location →
              the Committed Budget Country column). Hotels only. */}
          {source === 'liteapi' && (
            <AddToTripButton
              tripId={tripId}
              hotelName={rec.name}
              amount={stayTotal}
              location={destinationLabel}
              checkinDate={checkin}
              checkoutDate={checkout}
              liteapiHotelId={rec.liteapiHotelId ?? null}
              perNight={perNight}
              nights={nights}
              suggestedCoaCode={suggestedCoaCode}
            />
          )}

          {/* PR-35: Google places are UNPRICED — a manual-price one-time commit
              form (amount + dates + times) instead of the hotel button. Commits
              via the synthetic 'activity' path on the category's COA (PR-35a),
              with the personal-only/Business rule enforced server-side. */}
          {source === 'google' && (
            <PlaceCommitForm
              tripId={tripId}
              category={category}
              placeName={rec.name}
              location={destinationLabel}
              suggestedCoaCode={suggestedCoaCode}
            />
          )}
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
