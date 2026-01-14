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
    
    return cached.map(p => ({
      placeId: p.placeId,
      name: p.name,
      address: p.address,
      rating: p.rating,
      reviewCount: p.reviewCount,
      priceLevel: p.priceLevel,
      priceLevelDisplay: p.priceLevel != null ? '$'.repeat(p.priceLevel) : null,
      website: p.website,
      types: p.types ? JSON.parse(p.types) : [],
      city: p.city,
      country: p.country,
      category: p.category,
      latitude: p.latitude,
      longitude: p.longitude,
    }));
  } catch (err) {
    console.error('[Cache] Error reading places cache:', err);
    return [];
  }
}

// Save places to cache
export async function cachePlaces(
  places: any[], 
  city: string, 
  country: string, 
  category: string
): Promise<void> {
  try {
    for (const p of places) {
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
      select: { cachedAt: true }
    });
    
    if (!oldest) return false;
    
    const ageMs = Date.now() - oldest.cachedAt.getTime();
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    
    return ageDays < maxAgeDays;
  } catch {
    return false;
  }
}
