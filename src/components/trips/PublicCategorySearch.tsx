'use client';

/**
 * PublicCategorySearch — ONE reusable homepage Travel-tab section for a single Google
 * category (one of the 9 GOOGLE_CATEGORY_KEYS), rendered 9× over the canonical key list.
 *
 * LOCKED vs UNLOCKED (per-category entitlement):
 *   - locked  → render a 🔒 card with a "Subscribe to unlock" button. The search form +
 *     fetch DO NOT MOUNT → zero Google spend for a category the user hasn't paid for.
 *   - unlocked (entitled, or admin) → mirror PublicActivitySearch: city+country form → POST
 *     /api/places/category-search → render discovery cards. The server route ALSO gates
 *     per-category (403 'Category not unlocked'); this client lock is UX, that gate is the
 *     real lock (defense in depth).
 *
 * No fallback data: a non-OK fetch throws the route's real error (fail-loud). The grid
 * renders exactly what the route returns. Label comes from TRAVEL_COA[catKey].label.
 */

import { useState, useEffect } from 'react';
import { Lock } from 'lucide-react';
import { isCategoryLocked } from '@/lib/categoryLock';
import { TRAVEL_COA } from '@/lib/travelCOA';
import TravelSectionShell, { TRAVEL_INPUT_CLASS, TRAVEL_BUTTON_CLASS } from './travelSection';

interface Props {
  /** One of the 9 GOOGLE_CATEGORY_KEYS. */
  catKey: string;
  /** Google category keys this user has unlocked (from /api/auth/me). */
  entitledCategories: string[];
  /** This user's id (admin bypass inside isCategoryLocked). Empty when logged out. */
  currentUserId: string;
  /** Opens the existing home register/login modal (unlocking requires sign-in). */
  onRequireAuth: () => void;
  /** PR-3: unified-bar fan-out. Only consumed when UNLOCKED — a locked section returns
   *  before mounting the search child, so fan-out can never fire a Google call for it. */
  sharedCity?: string;
  sharedCountry?: string;
  searchNonce?: number;
}

/** The minimal card the paid+cached route returns (category-search/route.ts CategoryCard). */
interface CategoryCard {
  placeId: string;
  name: string;
  address: string;
  rating: number | null;
  reviewCount: number | null;
  priceLevel: number | null;
  priceLevelDisplay: string | null;
  businessStatus: string | null;
  location: { lat: number; lng: number } | null;
}

export default function PublicCategorySearch({
  catKey,
  entitledCategories,
  currentUserId,
  onRequireAuth,
  sharedCity,
  sharedCountry,
  searchNonce,
}: Props) {
  // Section title is the EXPENSE-CATEGORY label (TRAVEL_COA covers all 9 Google keys).
  const label = TRAVEL_COA[catKey]?.label || catKey;
  const locked = isCategoryLocked(catKey, entitledCategories, currentUserId);

  // ── LOCKED: no form, no fetch (zero Google spend). 🔒 card + subscribe CTA. ──
  if (locked) {
    // Placeholder unlock handler — Stripe checkout is a later PR. For now: log + route to
    // sign-up so a logged-out visitor can create an account first.
    const onRequestUnlock = () => {
      console.log('unlock', catKey);
      onRequireAuth();
    };
    return (
      <TravelSectionShell
        title={label}
        explainer="Unlock this category to see real local picks with ratings and prices."
      >
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-brand-purple/15 bg-bg-row px-6 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
            <Lock className="h-6 w-6" strokeWidth={2} aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="text-base font-bold text-text-primary">{label}</p>
            <p className="text-sm text-text-muted">Subscribe to see top-rated {label.toLowerCase()} with prices.</p>
          </div>
          <button type="button" onClick={onRequestUnlock} className={TRAVEL_BUTTON_CLASS}>
            Subscribe to unlock
          </button>
        </div>
      </TravelSectionShell>
    );
  }

  // ── UNLOCKED: city+country form → POST category-search → discovery cards. ──
  return (
    <UnlockedCategorySearch
      catKey={catKey}
      label={label}
      sharedCity={sharedCity}
      sharedCountry={sharedCountry}
      searchNonce={searchNonce}
    />
  );
}

/** The mounted search UI — only rendered when unlocked, so its fetch can never fire for a
 *  locked category. Split out so the form/state hooks don't mount on a locked section. */
function UnlockedCategorySearch({
  catKey,
  label,
  sharedCity,
  sharedCountry,
  searchNonce,
}: {
  catKey: string;
  label: string;
  sharedCity?: string;
  sharedCountry?: string;
  searchNonce?: number;
}) {
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [results, setResults] = useState<CategoryCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searched, setSearched] = useState(false);

  // The paid POST to category-search. Reused by both the form submit and the PR-3
  // unified-bar fan-out (same fetch, same route, same per-category server gate).
  const runSearch = async (cityVal: string, countryVal: string) => {
    if (!cityVal.trim() || !countryVal.trim()) {
      setError('Enter a city and country.');
      return;
    }
    setLoading(true);
    setError('');
    setResults([]);
    setSearched(true);
    try {
      const res = await fetch('/api/places/category-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: catKey, city: cityVal.trim(), country: countryVal.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        // Defensive: an unlocked section shouldn't hit the per-category 403, but if the
        // server gate disagrees with the client lock, surface it plainly (no fake data).
        if (res.status === 403 && data?.error === 'Category not unlocked') {
          throw new Error('This category is locked — subscribe to unlock.');
        }
        throw new Error(data.error || 'Failed to search this category');
      }
      const data = await res.json();
      setResults((data.results || []) as CategoryCard[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Category search failed');
    } finally {
      setLoading(false);
    }
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(city, country);
  };

  // PR-3: fan-out — fire this (UNLOCKED) category for the unified bar's destination when its
  // nonce changes. This effect lives in the unlocked child, so a LOCKED category (which never
  // mounts this child) can NEVER be fired by fan-out → zero Google spend for locked.
  useEffect(() => {
    if (!searchNonce) return;
    if (!sharedCity?.trim() || !sharedCountry?.trim()) return;
    setCity(sharedCity);
    setCountry(sharedCountry);
    runSearch(sharedCity, sharedCountry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchNonce]);

  return (
    <TravelSectionShell
      title={label}
      explainer="Type a city and country to see real local picks with ratings and prices."
    >
      <form onSubmit={search} className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="City (e.g. Lisbon)"
          className={`${TRAVEL_INPUT_CLASS} lg:col-span-2`}
          aria-label="Destination city"
        />
        <input
          type="text"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          placeholder="Country (e.g. Portugal)"
          className={TRAVEL_INPUT_CLASS}
          aria-label="Destination country"
        />
        <div className="flex items-end">
          <button type="submit" disabled={loading} className={`${TRAVEL_BUTTON_CLASS} w-full`}>
            {loading ? 'Searching…' : 'Search'}
          </button>
        </div>
      </form>

      {searched && <CategoryResults results={results} loading={loading} error={error} />}
      {!searched && error && (
        <div className="rounded-lg border border-border bg-white p-4 text-sm text-brand-red">{error}</div>
      )}
    </TravelSectionShell>
  );
}

/** Minimal discovery cards — name / rating / price level / address. No photos/booking
 *  (CategoryCard carries none; details-on-tap is a later PR). Renders exactly the route
 *  payload — never a placeholder row. */
function CategoryResults({ results, loading, error }: { results: CategoryCard[]; loading: boolean; error: string }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-border bg-white p-4">
            <div className="h-4 w-3/4 animate-pulse rounded bg-bg-row" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-bg-row" />
          </div>
        ))}
      </div>
    );
  }
  if (error) {
    return <div className="rounded-lg border border-border bg-white p-6 text-sm text-brand-red">{error}</div>;
  }
  if (results.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-white p-8 text-center">
        <p className="text-sm font-medium text-text-primary">No results yet</p>
        <p className="mt-1 text-sm text-text-muted">Enter a city and country to see real local picks.</p>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {results.map((r) => (
        <article key={r.placeId} className="flex flex-col rounded-lg border border-border bg-white p-4 shadow-sm">
          <h3 className="line-clamp-2 font-medium text-text-primary" title={r.name}>{r.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-muted">
            {typeof r.rating === 'number' && r.rating > 0 && (
              <span className="inline-flex items-center gap-1">
                <span className="text-brand-amber" aria-hidden="true">★</span>
                {r.rating.toFixed(1)}
                {typeof r.reviewCount === 'number' && r.reviewCount > 0 && (
                  <span className="text-text-faint">({r.reviewCount.toLocaleString()})</span>
                )}
              </span>
            )}
            {r.priceLevelDisplay && <span className="text-text-secondary">{r.priceLevelDisplay}</span>}
          </div>
          {r.address && <p className="mt-2 line-clamp-2 text-sm text-text-muted">{r.address}</p>}
        </article>
      ))}
    </div>
  );
}
