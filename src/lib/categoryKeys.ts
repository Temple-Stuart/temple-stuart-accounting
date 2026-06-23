// Single source of the 9 Google category keys eligible for per-category entitlement.
// Deliberately PRISMA-FREE so it is importable from BOTH the server (entitlements.ts)
// AND the client ('use client' TripPlannerAI.tsx) — entitlements.ts imports prisma, so the
// client cannot import that module without dragging PrismaClient into the browser bundle.
// MUST stay in sync with getGooglePlaceCatKeys() in src/components/trips/TripPlannerAI.tsx:1020-1037.
export const GOOGLE_CATEGORY_KEYS = [
  'brunch_coffee',
  'dinner',
  'nightlife',
  'coworking',
  'gyms',
  'sports',
  'groceries',
  'shopping',
  'festivals',
] as const;

// The paid Google categories surfaced on the homepage Travel tab. Subset of
// GOOGLE_CATEGORY_KEYS (the full system key set). Nightlife/shopping/festivals intentionally
// excluded. This is "what we sell on the homepage" — a separate concept from "every key the
// system knows" — so it is NOT a parallel list. Every key here MUST exist in
// GOOGLE_CATEGORY_KEYS so the per-category entitlement gate still covers them.
export const HOMEPAGE_PAID_CATEGORIES = [
  'brunch_coffee',
  'dinner',
  'gyms',
  'coworking',
  'sports',
  'groceries',
] as const;
