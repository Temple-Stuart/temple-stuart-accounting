'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

interface Participant {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export default function NewTripPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Trip details
  const [name, setName] = useState('');
  const [destination, setDestination] = useState('');
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [daysTravel, setDaysTravel] = useState(7);
  const [daysRiding, setDaysRiding] = useState(5);
  const [rsvpDeadline, setRsvpDeadline] = useState('');

  // Participants
  const [numTravelers, setNumTravelers] = useState(1);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const handleNumTravelersChange = (num: number) => {
    setNumTravelers(num);
    const newParticipants: Participant[] = [];
    for (let i = 0; i < num - 1; i++) {
      newParticipants.push({
        firstName: participants[i]?.firstName || '',
        lastName: participants[i]?.lastName || '',
        email: participants[i]?.email || '',
        phone: participants[i]?.phone || ''
      });
    }
    setParticipants(newParticipants);
  };

  const updateParticipant = (index: number, field: keyof Participant, value: string) => {
    const updated = [...participants];
    updated[index] = { ...updated[index], [field]: value };
    setParticipants(updated);
  };

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
          destination: destination || null,
          month,
          year,
          daysTravel,
          daysRiding,
          rsvpDeadline: rsvpDeadline || null,
          participants: participants.filter(p => p.firstName && p.email)
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create trip');
      }

      const { trip } = await res.json();
      router.push(`/budgets/trips/${trip.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trip');
    } finally {
      setSaving(false);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear + 1, currentYear + 2];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Plan a New Trip</h1>
        <p className="text-zinc-400 mb-8">Create a trip, invite travelers, and track shared expenses.</p>

        {error && (
          <div className="bg-red-500/20 border border-red-500 text-red-300 px-4 py-3 rounded mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Trip Details */}
          <section className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <h2 className="text-xl font-semibold mb-4">Trip Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-400 mb-1">Trip Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Japan Powder Trip 2026"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-400 mb-1">Destination</label>
                <input
                  type="text"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="e.g., Niseko, Japan (or TBD)"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Month *</label>
                <select
                  value={month}
                  onChange={(e) => setMonth(parseInt(e.target.value))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                >
                  {MONTHS.map(m => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Year *</label>
                <select
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value))}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                >
                  {years.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Days of Travel *</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={daysTravel}
                  onChange={(e) => setDaysTravel(parseInt(e.target.value) || 1)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Days of Riding *</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={daysRiding}
                  onChange={(e) => setDaysRiding(parseInt(e.target.value) || 1)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm text-zinc-400 mb-1">RSVP Deadline</label>
                <input
                  type="date"
                  value={rsvpDeadline}
                  onChange={(e) => setRsvpDeadline(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
                />
              </div>
            </div>
          </section>

          {/* Travelers */}
          <section className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
            <h2 className="text-xl font-semibold mb-4">Travelers</h2>
            
            <div className="mb-4">
              <label className="block text-sm text-zinc-400 mb-1">Number of Travelers (including you)</label>
              <input
                type="number"
                min={1}
                max={20}
                value={numTravelers}
                onChange={(e) => handleNumTravelersChange(parseInt(e.target.value) || 1)}
                className="w-32 bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-white"
              />
            </div>

            {numTravelers > 1 && (
              <div className="space-y-4 mt-6">
                <p className="text-sm text-zinc-400">Enter details for the other {numTravelers - 1} traveler(s):</p>
                
                {participants.map((p, idx) => (
                  <div key={idx} className="bg-zinc-800 rounded p-4 border border-zinc-700">
                    <div className="text-sm text-zinc-500 mb-2">Traveler {idx + 2}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="First Name *"
                        value={p.firstName}
                        onChange={(e) => updateParticipant(idx, 'firstName', e.target.value)}
                        className="bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-white"
                      />
                      <input
                        type="text"
                        placeholder="Last Name"
                        value={p.lastName}
                        onChange={(e) => updateParticipant(idx, 'lastName', e.target.value)}
                        className="bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-white"
                      />
                      <input
                        type="email"
                        placeholder="Email *"
                        value={p.email}
                        onChange={(e) => updateParticipant(idx, 'email', e.target.value)}
                        className="bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-white"
                      />
                      <input
                        type="tel"
                        placeholder="Phone"
                        value={p.phone}
                        onChange={(e) => updateParticipant(idx, 'phone', e.target.value)}
                        className="bg-zinc-900 border border-zinc-600 rounded px-3 py-2 text-white"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Submit */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Creating...' : 'Create Trip'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
