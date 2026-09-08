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

/**
 * SELL-05b: a corrupt cached value is DECLARED, never an empty list. The
 * reader used to wrap everything in a catch that logged and returned [] — a
 * silent fallback that turned a bad row (or a database fault) into "no
 * results", which then went to Google for a fresh scan. Now a row whose
 * `types` / `photos` column is not the JSON array the writer stores throws
 * PlacesCacheCorruptError naming the row and the field, and a database fault
 * propagates as itself. The mapper is pure so the rule runs in node:test.
 */
export class PlacesCacheCorruptError extends Error {
  constructor(public placeId: string, public field: 'types' | 'photos', public raw: string) {
    super(`places_cache row ${placeId} holds a corrupt ${field} value — expected a JSON array of strings`);
    this.name = 'PlacesCacheCorruptError';
  }
}

/** The stored JSON array, or the named throw. */
function jsonStringArray(placeId: string, field: 'types' | 'photos', raw: string | null): string[] {
  if (raw === null || raw === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PlacesCacheCorruptError(placeId, field, raw);
  }
  if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string')) throw new PlacesCacheCorruptError(placeId, field, raw);
  return parsed;
}

export interface PlacesCacheRow {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  website: string | null;
  types: string | null;
  photos: string | null;
  city: string;
  country: string;
  category: string;
  latitude: number | null;
  longitude: number | null;
}

/** One stored row → the place the routes read. Pure. */
export function cachedRowToPlace(p: PlacesCacheRow, photoUrl: (ref: string) => string = photoProxyUrl): CachedPlace {
  // Photo references are stable per place and stored once (forever). Return
  // them as server-proxied URLs — no API key on the client, and the photo
  // bytes are only fetched lazily when the user expands a result.
  const photos = jsonStringArray(p.placeId, 'photos', p.photos).map(photoUrl);
  const types = jsonStringArray(p.placeId, 'types', p.types);
  return {
    placeId: p.placeId,
    name: p.name,
    address: p.address,
    rating: p.rating,
    reviewCount: p.reviewCount,
    priceLevel: p.priceLevel,
    priceLevelDisplay: p.priceLevel != null ? '$'.repeat(p.priceLevel) : null,
    website: p.website,
    types,
    photos,
    city: p.city,
    country: p.country,
    category: p.category,
    latitude: p.latitude,
    longitude: p.longitude,
  };
}

// Check cache first, return cached places for this city/country/category.
// No catch: a corrupt row throws PlacesCacheCorruptError, a database fault throws itself.
export async function getCachedPlaces(
  city: string,
  country: string,
  category: string
): Promise<CachedPlace[]> {
  const cached = await prisma.places_cache.findMany({
    where: { city, country, category }
  });
  return cached.map((p) => cachedRowToPlace(p));
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
