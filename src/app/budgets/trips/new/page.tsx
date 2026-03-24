'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppLayout } from '@/components/ui';

export default function NewTripPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [created, setCreated] = useState<{ id: string; inviteUrl: string } | null>(null);

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [daysTravel, setDaysTravel] = useState(7);
  const [tripType, setTripType] = useState<'personal' | 'business'>('personal');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSaving(true);

    try {
      const res = await fetch('/api/trips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          activity: 'all',
          month: new Date(startDate + 'T12:00:00').getMonth() + 1,
          year: new Date(startDate + 'T12:00:00').getFullYear(),
          startDate,
          daysTravel,
          daysRiding: daysTravel,
          tripType,
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create trip');
      }

      const { trip } = await res.json();
      const inviteUrl = `${window.location.origin}/trips/rsvp?token=${trip.inviteToken}`;
      setCreated({ id: trip.id, inviteUrl });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip');
    } finally {
      setSaving(false);
    }
  };

  const copyInviteLink = () => {
    if (created?.inviteUrl) {
      navigator.clipboard.writeText(created.inviteUrl);
    }
  };

  // Success screen
  if (created) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-bg-terminal">
          <div className="p-4 lg:p-6 max-w-xl mx-auto">
            <div className="bg-white border border-border">
              <div className="bg-brand-purple text-white p-4 text-center">
                <div className="text-terminal-lg font-semibold">Trip Created</div>
              </div>
              <div className="p-6 text-center">
                <div className="text-4xl mb-4">✓</div>
                <p className="text-text-secondary mb-6 text-sm">
                  Share the invite link with your travelers. They'll add their names and blackout dates.
                </p>

                <div className="bg-bg-row p-3 mb-6">
                  <label className="block text-[10px] text-text-muted uppercase tracking-wider mb-1">Invite Link</label>
                  <div className="flex gap-2">
                    <input type="text" value={created.inviteUrl} readOnly
                      className="flex-1 px-3 py-2 border border-border text-xs font-mono bg-white" />
                    <button onClick={copyInviteLink}
                      className="px-4 py-2 bg-brand-purple text-white text-xs font-medium hover:bg-brand-purple-hover">
                      Copy
                    </button>
                  </div>
                </div>

                <div className="flex gap-3 justify-center">
                  <button onClick={() => router.push(`/budgets/trips/${created.id}`)}
                    className="px-6 py-2 bg-brand-purple text-white text-xs font-medium hover:bg-brand-purple-hover">
                    View Trip →
                  </button>
                  <button onClick={() => router.push('/budgets/trips')}
                    className="px-6 py-2 border border-border text-text-secondary text-xs font-medium hover:bg-bg-row">
                    All Trips
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-bg-terminal">
        <div className="p-4 lg:p-6 max-w-xl mx-auto">

          {/* Header */}
          <div className="mb-4 bg-brand-purple text-white p-4 flex items-center justify-between">
            <div>
              <h1 className="text-terminal-lg font-semibold">New Trip</h1>
              <p className="text-text-faint text-xs">Plan your next adventure</p>
            </div>
            <button onClick={() => router.push('/budgets/trips')} className="text-xs text-text-faint hover:text-white">
              ← Back
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-brand-red px-4 py-3 mb-4 text-sm">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white border border-border">
              <div className="bg-brand-purple-hover text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider">
                Trip Details
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Trip Name *</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Bali Surf Trip 2025"
                    className="w-full px-3 py-2 border border-border text-sm focus:outline-none focus:border-brand-purple"
                    required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Start Date</label>
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className="w-full px-3 py-2 border border-border text-sm focus:outline-none focus:border-brand-purple" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Duration (days)</label>
                    <input type="number" min={1} max={90} value={daysTravel}
                      onChange={(e) => setDaysTravel(parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 border border-border text-sm focus:outline-none focus:border-brand-purple" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">Trip Type</label>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setTripType('personal')}
                      className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${tripType === 'personal' ? 'bg-brand-purple text-white' : 'bg-bg-row text-text-secondary hover:bg-border border border-border'}`}>
                      Personal
                    </button>
                    <button type="button" onClick={() => setTripType('business')}
                      className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${tripType === 'business' ? 'bg-brand-purple text-white' : 'bg-bg-row text-text-secondary hover:bg-border border border-border'}`}>
                      Business
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-brand-purple-wash border border-blue-200 p-4 text-xs text-blue-800">
              <strong>How it works:</strong> After creating, you'll get a shareable invite link.
              Send it to your crew — they'll add their names and mark blackout dates.
              You'll pick destinations and activities on the trip page.
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button type="button" onClick={() => router.back()}
                className="flex-1 px-4 py-3 border border-border text-text-secondary text-xs font-medium hover:bg-bg-row">
                Cancel
              </button>
              <button type="submit" disabled={saving || !name}
                className="flex-1 px-4 py-3 bg-brand-purple text-white text-xs font-medium hover:bg-brand-purple-hover disabled:opacity-50">
                {saving ? 'Creating...' : 'Create Trip'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
