import { prisma } from '@/lib/prisma';

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
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    const cached = await prisma.places_cache.findMany({
      where: { city, country, category }
    });

    return cached.map(p => {
      // Reconstruct signed photo URLs from stored references
      const photoRefs: string[] = p.photos ? JSON.parse(p.photos) : [];
      const photos = apiKey && photoRefs.length > 0
        ? photoRefs.map(ref => `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${ref}&key=${apiKey}`)
        : [];

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
      // Extract photo_reference param from signed URL
      const match = photo.match(/photo_reference=([^&]+)/);
      if (match) refs.push(match[1]);
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

// Check if cache is fresh (less than 30 days old)
export async function isCacheFresh(
  city: string,
  country: string,
  category: string,
  maxAgeDays: number = 30
): Promise<boolean> {
  try {
    const oldest = await prisma.places_cache.findFirst({
      where: { city, country, category },
      orderBy: { cachedAt: 'asc' },
      select: { cachedAt: true, photos: true }
    });

    if (!oldest) return false;

    // If cached entries have no photos stored, treat as stale to force re-fetch
    // This ensures a one-time backfill of photos for pre-existing cache entries
    if (!oldest.photos || oldest.photos === '[]') return false;

    const ageMs = Date.now() - oldest.cachedAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    return ageDays < maxAgeDays;
  } catch {
    return false;
  }
}
