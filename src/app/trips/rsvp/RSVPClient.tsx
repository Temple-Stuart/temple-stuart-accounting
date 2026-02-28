'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface Trip {
  id: string;
  name: string;
  destination: string | null;
  activity: string | null;
  month: number;
  year: number;
  daysTravel: number;
  daysRiding: number;
  rsvpDeadline: string | null;
  owner: {
    name: string;
    email: string;
  };
}

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

const ACTIVITIES: Record<string, string> = {
  surf: '🏄 Surf',
  kitesurf: '🪁 Kite Surf',
  sail: '⛵ Sail',
  snowboard: '🏂 Snowboard'
};

function RSVPContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isNewParticipant, setIsNewParticipant] = useState(true);
  const [submitted, setSubmitted] = useState(false);
  const [declined, setDeclined] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [unavailableDays, setUnavailableDays] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (token) loadInvite();
  }, [token]);

  const loadInvite = async () => {
    try {
      const res = await fetch('/api/trips/rsvp?token=' + token);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid invite link');
      }
      const data = await res.json();
      setTrip(data.trip);
      setIsNewParticipant(data.isNewParticipant);
      
      if (!data.isNewParticipant && data.participant) {
        // Returning user with participant-level token
        if (data.participant.rsvpStatus === 'confirmed') {
          // Already confirmed - redirect to trip view with their token
          const participantToken = data.participant.inviteToken || token;
          localStorage.setItem('trip_token_' + data.trip.id, participantToken);
          router.push('/trips/' + data.trip.id + '?token=' + participantToken);
          return;
        }
        // If declined or pending, pre-fill form for re-submission
        setFirstName(data.participant.firstName || '');
        setLastName(data.participant.lastName || '');
        setEmail(data.participant.email || '');
        setUnavailableDays(data.participant.unavailableDays || []);
      } else {
        // Trip-level token - check if we have saved participant token
        const savedToken = localStorage.getItem('trip_token_' + data.trip.id);
        if (savedToken && savedToken !== token) {
          // Verify saved token is still valid
          const verifyRes = await fetch('/api/trips/' + data.trip.id + '/participant?token=' + savedToken);
          if (verifyRes.ok) {
            router.push('/trips/' + data.trip.id + '?token=' + savedToken);
            return;
          } else {
            // Invalid saved token, remove it
            localStorage.removeItem('trip_token_' + data.trip.id);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load invite');
    } finally {
      setLoading(false);
    }
  };

  const toggleDay = (day: number) => {
    setUnavailableDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const res = await fetch('/api/trips/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          firstName,
          lastName,
          email,
          unavailableDays,
          rsvpStatus: 'confirmed'
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit');
      }

      const data = await res.json();
      
      // Redirect to trip view with participant's unique token
      if (trip?.id && data.participant?.inviteToken) {
        localStorage.setItem('trip_token_' + trip.id, data.participant.inviteToken);
        router.push('/trips/' + trip.id + '?token=' + data.participant.inviteToken);
        return;
      }
      
      setSubmitted(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  const handleDecline = async () => {
    if (!confirm('Are you sure you can\'t make it?')) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/trips/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          firstName: firstName || 'Declined',
          email: email || 'declined-' + Date.now() + '@temp.com',
          rsvpStatus: 'declined'
        })
      });

      if (!res.ok) throw new Error('Failed to decline');
      setDeclined(true);
      setSubmitted(true);
    } catch (err) {
      alert('Failed to decline');
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-bg-row flex items-center justify-center p-4">
        <div className="bg-white rounded border border-border p-8 text-center max-w-md">
          <div className="text-4xl mb-4">🔗</div>
          <h1 className="text-sm font-semibold text-text-primary mb-2">Missing Invite Link</h1>
          <p className="text-text-muted">Please use the invite link shared with you.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-row flex items-center justify-center">
        <div className="text-text-muted">Loading invitation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-row flex items-center justify-center p-4">
        <div className="bg-white rounded border border-border p-8 text-center max-w-md">
          <div className="text-4xl mb-4">😕</div>
          <h1 className="text-sm font-semibold text-text-primary mb-2">Invalid Invitation</h1>
          <p className="text-text-muted">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-bg-row flex items-center justify-center p-4">
        <div className="bg-white rounded border border-border p-8 text-center max-w-md">
          <div className="text-5xl mb-4">{declined ? '👋' : '🎉'}</div>
          <h1 className="text-sm font-semibold text-text-primary mb-2">
            {declined ? 'Maybe Next Time!' : 'You\'re In!'}
          </h1>
          <p className="text-text-muted">
            {declined
              ? 'We\'ll miss you on ' + trip?.name + '. Let ' + trip?.owner.name + ' know if anything changes!'
              : 'Your spot on ' + trip?.name + ' is confirmed. ' + trip?.owner.name + ' will be in touch with more details.'}
          </p>
        </div>
      </div>
    );
  }

  if (!trip) return null;

  const daysInMonth = new Date(trip.year, trip.month, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const firstDayOffset = new Date(trip.year, trip.month - 1, 1).getDay();

  return (
    <div className="min-h-screen bg-bg-row">
      <header className="bg-white border-b">
        <div className="max-w-xl mx-auto px-4 h-14 flex items-center">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-accent rounded flex items-center justify-center">
              <span className="text-white font-bold">TS</span>
            </div>
            <span className="font-semibold text-text-primary">Trip Invitation</span>
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-8">
        {/* Trip Card */}
        <div className="bg-white rounded border border-border p-6 mb-6 text-center">
          <p className="text-sm text-text-muted mb-1">{trip.owner.name} invited you to</p>
          <h1 className="text-sm font-semibold text-text-primary mb-4">{trip.name}</h1>
          
          <div className="flex justify-center gap-6 text-sm text-text-secondary mb-4">
            <div>
              <span className="block text-text-faint">Where</span>
              <span className="font-medium text-text-primary">{trip.destination || 'TBD'}</span>
            </div>
            <div>
              <span className="block text-text-faint">When</span>
              <span className="font-medium text-text-primary">{MONTHS[trip.month]} {trip.year}</span>
            </div>
            <div>
              <span className="block text-text-faint">Duration</span>
              <span className="font-medium text-text-primary">{trip.daysTravel} days</span>
            </div>
          </div>

          {trip.activity && (
            <div className="inline-flex items-center px-3 py-1 bg-bg-row rounded-full text-sm">
              {ACTIVITIES[trip.activity] || trip.activity}
            </div>
          )}
        </div>

        {/* RSVP Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name & Email */}
          <div className="bg-white rounded border border-border p-6">
            <h2 className="font-semibold text-text-primary mb-4">Your Info</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-text-muted mb-1">First Name *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:border-brand-accent"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-text-muted mb-1">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:border-brand-accent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm text-text-muted mb-1">Email *</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-border rounded focus:outline-none focus:border-brand-accent"
                required
              />
            </div>
          </div>

          {/* Blackout Dates */}
          <div className="bg-white rounded border border-border p-6">
            <h2 className="font-semibold text-text-primary mb-2">Your Availability</h2>
            <p className="text-sm text-text-muted mb-4">
              Tap any dates you are <span className="text-brand-red font-medium">NOT available</span> in {MONTHS[trip.month]}
            </p>
            
            <div className="grid grid-cols-7 gap-1.5">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-xs text-text-faint py-1">{d}</div>
              ))}
              {Array.from({ length: firstDayOffset }, (_, i) => (
                <div key={'empty-' + i} />
              ))}
              {calendarDays.map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={'aspect-square rounded text-sm font-medium transition-all ' + (
                    unavailableDays.includes(day)
                      ? 'bg-red-500 text-white'
                      : 'bg-bg-row text-text-secondary hover:bg-border'
                  )}
                >
                  {day}
                </button>
              ))}
            </div>
            
            {unavailableDays.length > 0 && (
              <p className="text-sm text-brand-red mt-3">
                ✗ Unavailable: {unavailableDays.sort((a, b) => a - b).join(', ')}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleDecline}
              disabled={saving}
              className="flex-1 py-3 border border-border text-text-secondary rounded font-medium hover:bg-bg-row transition-all"
            >
              Can't Make It
            </button>
            <button
              type="submit"
              disabled={saving || !firstName || !email}
              className="flex-1 py-3 bg-brand-accent text-white rounded font-medium hover:shadow-sm transition-all disabled:opacity-50"
            >
              {saving ? 'Submitting...' : 'Count Me In!'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function RSVPPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-bg-row flex items-center justify-center">
        <div className="text-text-muted">Loading...</div>
      </div>
    }>
      <RSVPContent />
    </Suspense>
  );
}
