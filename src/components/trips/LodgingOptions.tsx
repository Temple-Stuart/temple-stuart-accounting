'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge } from '@/components/ui';

interface LodgingOption {
  id: string;
  url: string;
  title: string | null;
  image_url: string | null;
  location: string | null;
  price_per_night: number | null;
  total_price: number | null;
  taxes_estimate: number | null;
  per_person: number | null;
  notes: string | null;
  votes_up: number;
  votes_down: number;
  is_selected: boolean;
}

interface Props {
  tripId: string;
  participantCount: number;
  nights: number;
  onSelect?: (option: LodgingOption) => void;
}

export default function LodgingOptions({ tripId, participantCount, nights, onSelect }: Props) {
  const [options, setOptions] = useState<LodgingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    url: '',
    title: '',
    location: '',
    price_per_night: '',
    taxes_estimate: '',
    notes: ''
  });

  useEffect(() => { loadOptions(); }, [tripId]);

  // Notify parent of pre-selected option on load
  useEffect(() => {
    const selected = options.find(o => o.is_selected);
    if (selected && onSelect) onSelect(selected);
  }, [options, onSelect]);

  const loadOptions = async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/lodging`);
      if (res.ok) {
        const data = await res.json();
        setOptions(data.options || []);
      }
    } catch (err) {
      console.error('Failed to load lodging options:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pricePerNight = parseFloat(form.price_per_night) || 0;
    const taxesEstimate = parseFloat(form.taxes_estimate) || 0;
    const totalPrice = (pricePerNight * nights) + taxesEstimate;
    const perPerson = participantCount > 0 ? totalPrice / participantCount : totalPrice;

    const res = await fetch(`/api/trips/${tripId}/lodging`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        price_per_night: pricePerNight || null,
        taxes_estimate: taxesEstimate || null,
        total_price: totalPrice || null,
        per_person: perPerson || null
      })
    });

    if (res.ok) {
      setShowForm(false);
      setForm({ url: '', title: '', location: '', price_per_night: '', taxes_estimate: '', notes: '' });
      loadOptions();
    }
  };

  const handleVote = async (optionId: string, direction: 'up' | 'down') => {
    await fetch(`/api/trips/${tripId}/lodging/${optionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: direction === 'up' ? 'vote_up' : 'vote_down' })
    });
    loadOptions();
  };

  const handleSelect = async (optionId: string) => {
    await fetch(`/api/trips/${tripId}/lodging/${optionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'select' })
    });
    loadOptions();
    const selected = options.find(o => o.id === optionId);
    if (selected && onSelect) onSelect(selected);
  };

  const handleDelete = async (optionId: string) => {
    if (!confirm('Remove this option?')) return;
    await fetch(`/api/trips/${tripId}/lodging/${optionId}`, { method: 'DELETE' });
    loadOptions();
  };

  const handleUpdate = async (optionId: string, updates: Partial<LodgingOption>) => {
    await fetch(`/api/trips/${tripId}/lodging/${optionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    setEditingId(null);
    loadOptions();
  };

  const fmt = (n: number | null) => n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n) : '-';

  const extractDomain = (url: string) => {
    try {
      return new URL(url).hostname.replace('www.', '');
    } catch {
      return 'Link';
    }
  };

  if (loading) return <div className="animate-pulse bg-gray-100 rounded-lg h-32"></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">🏠 Lodging Options</h3>
        {options.length < 5 && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Option'}
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="p-4 border-2 border-dashed border-[#b4b237]">
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Paste Airbnb, VRBO, or hotel URL..."
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className="border rounded px-3 py-2 text-sm"
                placeholder="Title (e.g. 'Modern Condo Downtown')"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
              <input
                className="border rounded px-3 py-2 text-sm"
                placeholder="Location"
                value={form.location}
                onChange={e => setForm({ ...form, location: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                className="border rounded px-3 py-2 text-sm"
                type="number"
                placeholder={`$/night (${nights} nights)`}
                value={form.price_per_night}
                onChange={e => setForm({ ...form, price_per_night: e.target.value })}
              />
              <input
                className="border rounded px-3 py-2 text-sm"
                type="number"
                placeholder="Taxes & fees estimate"
                value={form.taxes_estimate}
                onChange={e => setForm({ ...form, taxes_estimate: e.target.value })}
              />
            </div>
            <textarea
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Notes (optional)"
              rows={2}
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" size="sm">Add Option</Button>
            </div>
          </form>
        </Card>
      )}

      {options.length === 0 && !showForm ? (
        <Card className="p-8 text-center text-gray-400">
          <div className="text-4xl mb-2">🏠</div>
          <p>No lodging options yet</p>
          <p className="text-sm mt-1">Add Airbnb, VRBO, or hotel links for your group to review</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {options.map(option => (
            <Card 
              key={option.id} 
              className={`p-4 relative ${option.is_selected ? 'ring-2 ring-green-500 bg-green-50' : ''}`}
            >
              {option.is_selected && (
                <Badge variant="success" className="absolute top-2 right-2">✓ Selected</Badge>
              )}
              
              {option.image_url && (
                <img 
                  src={option.image_url} 
                  alt={option.title || 'Lodging'} 
                  className="w-full h-32 object-cover rounded-lg mb-3"
                />
              )}
              
              <h4 className="font-medium text-gray-900 mb-1">
                {option.title || 'Untitled Listing'}
              </h4>
              
              {option.location && (
                <p className="text-sm text-gray-500 mb-2">📍 {option.location}</p>
              )}
              
              <div className="text-sm space-y-1 mb-3">
                {option.price_per_night && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">{fmt(option.price_per_night)}/night × {nights}</span>
                    <span className="font-medium">{fmt(option.price_per_night * nights)}</span>
                  </div>
                )}
                {option.taxes_estimate && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Taxes & fees</span>
                    <span>{fmt(option.taxes_estimate)}</span>
                  </div>
                )}
                {option.total_price && (
                  <div className="flex justify-between border-t pt-1 font-medium">
                    <span>Total</span>
                    <span>{fmt(option.total_price)}</span>
                  </div>
                )}
                {option.per_person && participantCount > 1 && (
                  <div className="flex justify-between text-[#b4b237]">
                    <span>Per person ({participantCount})</span>
                    <span className="font-bold">{fmt(option.per_person)}</span>
                  </div>
                )}
              </div>

              {option.notes && (
                <p className="text-xs text-gray-500 italic mb-3">"{option.notes}"</p>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleVote(option.id, 'up')}
                    className="flex items-center gap-1 px-2 py-1 rounded hover:bg-green-100 text-sm"
                  >
                    👍 {option.votes_up}
                  </button>
                  <button
                    onClick={() => handleVote(option.id, 'down')}
                    className="flex items-center gap-1 px-2 py-1 rounded hover:bg-red-100 text-sm"
                  >
                    👎 {option.votes_down}
                  </button>
                </div>
                
                <div className="flex items-center gap-1">
                  <a
                  
                    href={option.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Open on {extractDomain(option.url)}
                  </a>
                </div>
              </div>

              <div className="flex gap-2 mt-3 pt-3 border-t">
                {!option.is_selected ? (
                  <Button size="sm" className="flex-1" onClick={() => handleSelect(option.id)}>
                    Lock In This Option
                  </Button>
                ) : (
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => handleSelect(option.id)}>
                    Change Selection
                  </Button>
                )}
                <button
                  onClick={() => handleDelete(option.id)}
                  className="text-red-500 text-xs hover:underline"
                >
                  Remove
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
