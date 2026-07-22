'use client';

/**
 * FD-1c: the thin client wrapper the preview route needs — a SERVER component
 * cannot pass a function prop to a client component (Next.js can't serialize
 * it), so the serializable availability map crosses the boundary and the stub
 * onRequireAuth lives here, client-side. Same division /pricing uses
 * (server page computes, PricingClient owns callbacks). FD-2's arrival branch
 * replaces the stub with the real register-modal opener.
 */

import Landing from '@/components/landing/Landing';

export default function PreviewClient({ availability }: { availability: Record<string, boolean> }) {
  return (
    <Landing
      entitlementAvailability={availability}
      onRequireAuth={() => { window.location.href = '/pricing'; }}
    />
  );
}
