import { prisma } from '@/lib/prisma';
import { photoProxyUrl } from '@/lib/placesSearch';

export interface CachedPlace {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  priceLevelDisplay: string | null;
  website: string | null;
  types: string[];
  photos?: string[];
  city: string;
  country: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
}

// Check cache first, return cached places for this city/country/category
export async function getCachedPlaces(
  city: string,
  country: string,
  category: string
): Promise<CachedPlace[]> {
  try {
    const cached = await prisma.places_cache.findMany({
      where: { city, country, category }
    });

    return cached.map(p => {
      // Photo references are stable per place and stored once (forever). Return
      // them as server-proxied URLs — no API key on the client, and the photo
      // bytes are only fetched lazily when the user expands a result.
      const photoRefs: string[] = p.photos ? JSON.parse(p.photos) : [];
      const photos = photoRefs.map(ref => photoProxyUrl(ref));

      return {
        placeId: p.placeId,
        name: p.name,
        address: p.address,
        rating: p.rating,
        reviewCount: p.reviewCount,
        priceLevel: p.priceLevel,
        priceLevelDisplay: p.priceLevel != null ? '$'.repeat(p.priceLevel) : null,
        website: p.website,
        types: p.types ? JSON.parse(p.types) : [],
        photos,
        city: p.city,
        country: p.country,
        category: p.category,
        latitude: p.latitude,
        longitude: p.longitude,
      };
    });
  } catch (err) {
    console.error('[Cache] Error reading places cache:', err);
    return [];
  }
}

// Save places to cache
// Extract photo references from photo URLs or raw photo objects.
// Photos from Google come as signed URLs like:
// https://maps.googleapis.com/maps/api/place/photo?...&photo_reference=REF&key=KEY
// We store just the references so we can reconstruct URLs with a fresh key.
function extractPhotoRefs(photos: any[] | undefined): string {
  if (!photos || photos.length === 0) return '[]';
  const refs: string[] = [];
  for (const photo of photos) {
    if (typeof photo === 'string') {
      // Accept our proxy URL (?ref=), a legacy signed Google URL
      // (photo_reference=), or a bare reference string.
      const m = photo.match(/[?&]ref=([^&]+)/) || photo.match(/photo_reference=([^&]+)/);
      if (m) refs.push(decodeURIComponent(m[1]));
      else if (!photo.includes('/') && !photo.includes('?')) refs.push(photo);
    } else if (photo?.photo_reference) {
      refs.push(photo.photo_reference);
    }
  }
  return JSON.stringify(refs);
}

export async function cachePlaces(
  places: any[],
  city: string,
  country: string,
  category: string
): Promise<void> {
  try {
    for (const p of places) {
      const photoRefs = extractPhotoRefs(p.photos);
      await prisma.places_cache.upsert({
        where: { placeId: p.placeId },
        update: {
          name: p.name,
          address: p.address,
          rating: p.rating,
          reviewCount: p.reviewCount,
          priceLevel: p.priceLevel,
          website: p.website || '',
          types: JSON.stringify(p.types || []),
          photos: photoRefs,
          city,
          country,
          category,
          latitude: p.latitude,
          longitude: p.longitude,
          updatedAt: new Date(),
        },
        create: {
          placeId: p.placeId,
          name: p.name,
          address: p.address,
          rating: p.rating,
          reviewCount: p.reviewCount,
          priceLevel: p.priceLevel,
          website: p.website || '',
          types: JSON.stringify(p.types || []),
          photos: photoRefs,
          city,
          country,
          category,
          latitude: p.latitude,
          longitude: p.longitude,
        },
      });
    }
    console.log(`[Cache] Saved ${places.length} places to cache for ${city}/${category}`);
  } catch (err) {
    console.error('[Cache] Error saving to cache:', err);
  }
}

/** Default cache TTL in days. Within this window the same city/country/category
 *  is served entirely from places_cache — zero Google calls. Configurable via
 *  PLACES_CACHE_TTL_DAYS (default 7). */
export function cacheTtlDays(): number {
  const raw = parseInt(process.env.PLACES_CACHE_TTL_DAYS || '', 10);
  return Number.isFinite(raw) && raw > 0 ? raw : 7;
}

// Cache is fresh if the oldest entry for this key is younger than the TTL.
// NOTE: we deliberately do NOT force a re-fetch when photos are empty — many
// places legitimately have no photo, and forcing re-fetch on them re-bills
// Google every scan. Photos are stored once and reused forever.
export async function isCacheFresh(
  city: string,
  country: string,
  category: string,
  maxAgeDays: number = cacheTtlDays()
): Promise<boolean> {
  try {
    const oldest = await prisma.places_cache.findFirst({
      where: { city, country, category },
      orderBy: { cachedAt: 'asc' },
      select: { cachedAt: true }
    });

    if (!oldest) return false;

    const ageDays = (Date.now() - oldest.cachedAt.getTime()) / (1000 * 60 * 60 * 24);
    return ageDays < maxAgeDays;
  } catch {
    return false;
  }
}
