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
