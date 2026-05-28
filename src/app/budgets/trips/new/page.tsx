'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppLayout } from '@/components/ui';
import { searchDestinations } from '@/lib/destinations';

function parseDate(val: string | null): string {
  if (!val) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  const match = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`;
  return '';
}

export default function NewTripPage() {
  return (
    <AppLayout>
      <Suspense fallback={
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <NewTripForm />
      </Suspense>
    </AppLayout>
  );
}

function NewTripForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Prevent double submission when the search-bar redirects with save=1.
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Auto-create when the create-bar redirects here with save=1.
  useEffect(() => {
    if (searchParams.get('save') === '1' && !hasSubmitted && !saving) {
      handleCreate();
    }
  }, [searchParams]);

  const name = searchParams.get('tripName') || '';
  const startDate = parseDate(searchParams.get('startDate'));
  const endDate = parseDate(searchParams.get('endDate'));
  const tripType = searchParams.get('tripType') || 'personal';
  const destinations = searchParams.get('destinations')?.split(',').map(d => d.trim()).filter(Boolean) || [];
  const duration = startDate && endDate
    ? Math.round((new Date(endDate + 'T12:00:00').getTime() - new Date(startDate + 'T12:00:00').getTime()) / 86400000) + 1
    : 0;

  const handleCreate = async () => {
    if (!name.trim() || !startDate || !endDate || duration <= 0) return;
    setSaving(true);
    setError('');
    setHasSubmitted(true);

    try {
      const tripRes = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          destination: destinations.length > 0 ? destinations[0] : undefined,
          startDate,
          endDate,
          activity: 'all',
          month: new Date(startDate + 'T12:00:00').getMonth() + 1,
          year: new Date(startDate + 'T12:00:00').getFullYear(),
          daysTravel: duration,
          daysRiding: duration,
          tripType,
        }),
      });

      if (!tripRes.ok) {
        const d = await tripRes.json();
        throw new Error(d.error || 'Failed to create trip');
      }

      const { trip } = await tripRes.json();
      const tripId = trip.id;

      // Save destinations using name-based API with coordinates from destinations.ts
      for (const destName of destinations) {
        const matches = searchDestinations(destName, 1);
        const match = matches.find(d => d.type === 'city' && d.name.toLowerCase() === destName.toLowerCase())
          || matches.find(d => d.type === 'city');

        await fetch(`/api/trips/${tripId}/destinations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: destName,
            country: match?.country || null,
            lat: match?.lat || null,
            lng: match?.lng || null,
          }),
        });
      }

      router.push(`/budgets/trips/${tripId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip');
      setHasSubmitted(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-terminal">
      <div className="p-4 lg:p-6 max-w-[1800px] mx-auto">
        {error && (
          <div className="bg-red-50 border border-red-200 text-brand-red px-4 py-3 mb-4 text-sm">{error}</div>
        )}

        {saving && (
          <div className="bg-brand-purple/5 border border-brand-purple/20 rounded-lg px-4 py-3 mb-4 flex items-center gap-3 text-sm text-brand-purple">
            <div className="w-4 h-4 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
            Creating your trip...
          </div>
        )}
      </div>
    </div>
  );
}
