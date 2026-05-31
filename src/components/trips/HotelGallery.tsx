'use client';

// ─── Hotel photo gallery (Travel-PR-22) ──────────────────────────────────────
// Hero image + clickable thumbnail strip. Real photos only — renders exactly the
// URLs LiteAPI returned on the recommendation (rec.images). When the gallery is
// empty/single, this falls to the existing single-hero behavior (the same render
// the detail page did before PR-22) — not a synthesized fallback.

import { useState } from 'react';
import HScrollRow from '@/components/trips/HScrollRow';

interface HotelGalleryProps {
  images: string[];
  /** The existing single hero (rec.photoUrl) — used when `images` is empty. */
  fallback: string | null;
  alt: string;
}

export default function HotelGallery({ images, fallback, alt }: HotelGalleryProps) {
  const gallery = images.filter(Boolean);
  const initial = gallery[0] ?? fallback ?? null;
  const [hero, setHero] = useState<string | null>(initial);

  // No gallery and no hero → render the existing "No photo" placeholder (the
  // pre-PR-22 behavior). Never fabricate an image.
  if (!hero) {
    return (
      <div className="w-full h-72 sm:h-96 rounded-lg bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center text-text-muted text-sm border border-border">
        No photo
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg overflow-hidden border border-border bg-gray-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={hero} alt={alt} className="w-full h-72 sm:h-96 object-cover" />
      </div>
      {gallery.length > 1 && (
        <HScrollRow className="mt-2 flex gap-2 overflow-x-auto pb-1" style={{ scrollSnapType: 'x mandatory' }} scrollBy={180}>
          {gallery.map((url, i) => (
            <button
              key={`${url}-${i}`}
              type="button"
              onClick={() => setHero(url)}
              aria-label={`View photo ${i + 1} of ${gallery.length}`}
              aria-pressed={hero === url}
              className={`flex-shrink-0 rounded overflow-hidden border-2 transition-colors ${hero === url ? 'border-brand-purple' : 'border-transparent hover:border-border'}`}
              style={{ scrollSnapAlign: 'start' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`${alt} — photo ${i + 1}`} className="w-20 h-16 object-cover" />
            </button>
          ))}
        </HScrollRow>
      )}
    </div>
  );
}
