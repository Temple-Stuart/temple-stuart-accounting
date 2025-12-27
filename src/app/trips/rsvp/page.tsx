'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface Trip {
  id: string;
  name: string;
  destination: string | null;
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

interface ParticipantInfo {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  rsvpStatus: string;
  unavailableDays: number[] | null;
  paymentMethod: string | null;
  hasPassword: boolean;
}

const MONTHS = ['', 'January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'];

function RSVPContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [trip, setTrip] = useState<Trip | null>(null);
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'zelle' | 'venmo' | ''>('');
  const [paymentHandle, setPaymentHandle] = useState('');
  const [unavailableDays, setUnavailableDays] = useState<number[]>([]);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (token) {
      loadInvite();
    }
  }, [token]);

  const loadInvite = async () => {
    try {
      const res = await fetch(`/api/trips/rsvp?token=${token}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid invite link');
      }
      const data = await res.json();
      setTrip(data.trip);
      setParticipant(data.participant);
      
      // Pre-fill form
      setFirstName(data.participant.firstName || '');
      setLastName(data.participant.lastName || '');
      setEmail(data.participant.email || '');
      setPaymentMethod(data.participant.paymentMethod || '');
      setUnavailableDays(data.participant.unavailableDays || []);
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
    
    if (password && password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }

    if (password && password.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

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
          phone,
          paymentMethod,
          paymentHandle,
          unavailableDays,
          password: password || undefined,
          rsvpStatus: 'confirmed'
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to submit RSVP');
      }

      setSubmitted(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSaving(false);
    }
  };

  const handleDecline = async () => {
    if (!confirm('Are you sure you want to decline this trip?')) return;
    
    setSaving(true);
    try {
      const res = await fetch('/api/trips/rsvp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          rsvpStatus: 'declined'
        })
      });

      if (!res.ok) throw new Error('Failed to decline');
      setSubmitted(true);
      setParticipant(prev => prev ? { ...prev, rsvpStatus: 'declined' } : null);
    } catch (err) {
      alert('Failed to decline invitation');
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-red-400">Missing invite token</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-zinc-400">Loading invitation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-2">Invalid Invitation</div>
          <p className="text-zinc-500">{error}</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">
            {participant?.rsvpStatus === 'declined' ? '👋' : '🎉'}
          </div>
          <h1 className="text-2xl font-bold mb-2">
            {participant?.rsvpStatus === 'declined' ? 'Maybe Next Time!' : 'You\'re In!'}
          </h1>
          <p className="text-zinc-400">
            {participant?.rsvpStatus === 'declined'
              ? `We'll miss you on ${trip?.name}. Let the organizer know if anything changes!`
              : `Your RSVP for ${trip?.name} has been confirmed. ${trip?.owner.name} will be in touch with more details.`}
          </p>
          {participant?.rsvpStatus === 'confirmed' && password && (
            <p className="text-zinc-500 mt-4 text-sm">
              You can log back in anytime to view trip details and expenses.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!trip || !participant) return null;

  // Generate calendar days for the trip month
  const daysInMonth = new Date(trip.year, trip.month, 0).getDate();
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-2xl mx-auto">
        {/* Invite Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏔️</div>
          <h1 className="text-3xl font-bold mb-2">You're Invited!</h1>
          <p className="text-zinc-400">{trip.owner.name} invited you to:</p>
        </div>

        {/* Trip Card */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800 mb-8">
          <h2 className="text-2xl font-bold mb-4">{trip.name}</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-zinc-400">When:</span>
              <div className="font-medium">{MONTHS[trip.month]} {trip.year}</div>
            </div>
            <div>
              <span className="text-zinc-400">Where:</span>
              <div className="font-medium">{trip.destination || 'TBD'}</div>
            </div>
            <div>
              <span className="text-zinc-400">Days of Travel:</span>
              <div className="font-medium">{trip.daysTravel} days</div>
            </div>
            <div>
              <span className="text-zinc-400">Days of Riding:</span>
              <div className="font-medium">{trip.daysRiding} days</div>
            </div>
          </div>
          {trip.rsvpDeadline && (
            <div className="mt-4 pt-4 border-t border-zinc-800 text-sm">
              <span className="text-zinc-400">Please respond by:</span>
              <span className="ml-2 text-yellow-400">
                {new Date(trip.rsvpDeadline).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* RSVP Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal Info */}
          <section className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <h3 className="text-lg font-semibold mb-4">Your Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">First Name *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Last Name *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Email *</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                />
              </div>
            </div>
          </section>

          {/* Payment Preference */}
          <section className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <h3 className="text-lg font-semibold mb-4">Payment Preference</h3>
            <p className="text-sm text-zinc-400 mb-4">
              How would you prefer to send/receive payments for shared expenses?
            </p>
            <div className="flex gap-4 mb-4">
              <button
                type="button"
                onClick={() => setPaymentMethod('zelle')}
                className={`flex-1 py-3 rounded border ${
                  paymentMethod === 'zelle'
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                Zelle
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod('venmo')}
                className={`flex-1 py-3 rounded border ${
                  paymentMethod === 'venmo'
                    ? 'bg-blue-600 border-blue-500 text-white'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                Venmo
              </button>
            </div>
            {paymentMethod && (
              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  {paymentMethod === 'zelle' ? 'Zelle Email/Phone' : 'Venmo Username'}
                </label>
                <input
                  type="text"
                  value={paymentHandle}
                  onChange={(e) => setPaymentHandle(e.target.value)}
                  placeholder={paymentMethod === 'zelle' ? 'email@example.com' : '@username'}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                />
              </div>
            )}
          </section>

          {/* Availability Calendar */}
          <section className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <h3 className="text-lg font-semibold mb-2">Your Availability</h3>
            <p className="text-sm text-zinc-400 mb-4">
              Click on any days you are <span className="text-red-400">NOT available</span> in {MONTHS[trip.month]}:
            </p>
            <div className="grid grid-cols-7 gap-2">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} className="text-center text-xs text-zinc-500 py-1">{d}</div>
              ))}
              {/* Empty cells for first day offset */}
              {Array.from({ length: new Date(trip.year, trip.month - 1, 1).getDay() }, (_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {calendarDays.map(day => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  className={`py-2 rounded text-sm ${
                    unavailableDays.includes(day)
                      ? 'bg-red-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {day}
                </button>
              ))}
            </div>
            {unavailableDays.length > 0 && (
              <p className="text-sm text-red-400 mt-3">
                Unavailable: {unavailableDays.sort((a, b) => a - b).join(', ')}
              </p>
            )}
          </section>

          {/* Password */}
          {!participant.hasPassword && (
            <section className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
              <h3 className="text-lg font-semibold mb-2">Create Password</h3>
              <p className="text-sm text-zinc-400 mb-4">
                Set a password to access the trip dashboard and view shared expenses.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-zinc-400 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>
            </section>
          )}

          {/* Actions */}
          <div className="flex justify-between">
            <button
              type="button"
              onClick={handleDecline}
              disabled={saving}
              className="px-6 py-3 bg-zinc-800 text-zinc-400 rounded hover:bg-zinc-700 hover:text-white"
            >
              Can't Make It
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-8 py-3 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50"
            >
              {saving ? 'Submitting...' : 'Count Me In!'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function RSVPPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    }>
      <RSVPContent />
    </Suspense>
  );
}
