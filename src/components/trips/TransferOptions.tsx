'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge } from '@/components/ui';

const TRANSFER_TYPES = [
  { value: 'rideshare', label: 'Rideshare (Uber/Lyft)', icon: '🚗' },
  { value: 'taxi', label: 'Taxi', icon: '🚕' },
  { value: 'shuttle', label: 'Shuttle', icon: '🚐' },
  { value: 'private', label: 'Private Car', icon: '🚘' },
  { value: 'bus', label: 'Bus', icon: '🚌' },
  { value: 'train', label: 'Train', icon: '🚆' },
  { value: 'grab', label: 'Grab/Gojek', icon: '🛺' },
  { value: 'other', label: 'Other', icon: '🚙' },
];

interface TransferOption {
  id: string;
  url: string | null;
  transfer_type: string;
  direction: string;
  title: string | null;
  vendor: string | null;
  price: number | null;
  per_person: number | null;
  notes: string | null;
  votes_up: number;
  votes_down: number;
  is_selected: boolean;
}

interface Props {
  tripId: string;
  participantCount: number;
  onSelect?: (option: TransferOption) => void;
}

export default function TransferOptions({ tripId, participantCount, onSelect }: Props) {
  const [options, setOptions] = useState<TransferOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    url: '',
    transfer_type: 'rideshare',
    direction: 'arrival',
    title: '',
    vendor: '',
    price: '',
    notes: ''
  });

  useEffect(() => { loadOptions(); }, [tripId]);

  // Notify parent of pre-selected options on load
  useEffect(() => {
    const selected = options.filter(o => o.is_selected);
    selected.forEach(opt => { if (onSelect) onSelect(opt); });
  }, [options, onSelect]);

  const loadOptions = async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/transfers`);
      if (res.ok) {
        const data = await res.json();
        setOptions(data.options || []);
      }
    } catch (err) {
      console.error('Failed to load transfer options:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(form.price) || 0;
    const perPerson = participantCount > 0 ? price / participantCount : price;

    const res = await fetch(`/api/trips/${tripId}/transfers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        price: price || null,
        per_person: perPerson || null
      })
    });

    if (res.ok) {
      setShowForm(false);
      setForm({ url: '', transfer_type: 'rideshare', direction: 'arrival', title: '', vendor: '', price: '', notes: '' });
      loadOptions();
    }
  };

  const handleVote = async (optionId: string, direction: 'up' | 'down') => {
    await fetch(`/api/trips/${tripId}/transfers/${optionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: direction === 'up' ? 'vote_up' : 'vote_down' })
    });
    loadOptions();
  };

  const handleSelect = async (optionId: string) => {
    await fetch(`/api/trips/${tripId}/transfers/${optionId}`, {
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
    await fetch(`/api/trips/${tripId}/transfers/${optionId}`, { method: 'DELETE' });
    loadOptions();
  };

  const fmt = (n: number | null) => n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n) : '-';
  const getTypeConfig = (type: string) => TRANSFER_TYPES.find(t => t.value === type) || TRANSFER_TYPES[7];

  const arrivalOptions = options.filter(o => o.direction === 'arrival');
  const departureOptions = options.filter(o => o.direction === 'departure');

  if (loading) return <div className="animate-pulse bg-gray-100 rounded-lg h-32"></div>;

  const renderOptionCard = (option: TransferOption) => {
    const typeConfig = getTypeConfig(option.transfer_type);
    return (
      <Card 
        key={option.id} 
        className={`p-3 relative ${option.is_selected ? 'ring-2 ring-green-500 bg-green-50' : ''}`}
      >
        {option.is_selected && (
          <Badge variant="success" className="absolute top-2 right-2 text-xs">✓</Badge>
        )}
        
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">{typeConfig.icon}</span>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-gray-900 text-sm truncate">
              {option.title || typeConfig.label}
            </h4>
            {option.vendor && (
              <p className="text-xs text-gray-500 truncate">{option.vendor}</p>
            )}
          </div>
          {option.price && (
            <div className="text-right">
              <div className="font-bold text-sm">{fmt(option.price)}</div>
              {participantCount > 1 && (
                <div className="text-xs text-[#b4b237]">{fmt(option.per_person)}/ea</div>
              )}
            </div>
          )}
        </div>

        {option.notes && (
          <p className="text-xs text-gray-500 italic mb-2 truncate">"{option.notes}"</p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <button onClick={() => handleVote(option.id, 'up')} className="px-1.5 py-0.5 rounded hover:bg-green-100 text-xs">
              👍 {option.votes_up}
            </button>
            <button onClick={() => handleVote(option.id, 'down')} className="px-1.5 py-0.5 rounded hover:bg-red-100 text-xs">
              👎 {option.votes_down}
            </button>
          </div>
          
          <div className="flex items-center gap-1">
            {option.url && (
              <a href={option.url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                Link ↗
              </a>
            )}
            {!option.is_selected ? (
              <button onClick={() => handleSelect(option.id)} className="px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700">
                Select
              </button>
            ) : (
              <span className="text-xs text-green-600">Selected</span>
            )}
            <button onClick={() => handleDelete(option.id)} className="text-red-400 text-xs hover:text-red-600">✕</button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">🚕 Ground Transport</h3>
        {options.length < 10 && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Option'}
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="p-4 border-2 border-dashed border-[#b4b237]">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <select
                className="border rounded px-3 py-2 text-sm"
                value={form.direction}
                onChange={e => setForm({ ...form, direction: e.target.value })}
              >
                <option value="arrival">✈️→🏨 Arrival</option>
                <option value="departure">🏨→✈️ Departure</option>
              </select>
              <select
                className="border rounded px-3 py-2 text-sm"
                value={form.transfer_type}
                onChange={e => setForm({ ...form, transfer_type: e.target.value })}
              >
                {TRANSFER_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
              <input
                className="border rounded px-3 py-2 text-sm"
                type="number"
                placeholder="Total price"
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                className="border rounded px-3 py-2 text-sm"
                placeholder="Title (e.g. 'Airport Shuttle')"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
              <input
                className="border rounded px-3 py-2 text-sm"
                placeholder="Vendor/Company"
                value={form.vendor}
                onChange={e => setForm({ ...form, vendor: e.target.value })}
              />
            </div>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Booking link (optional)"
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" size="sm">Add Option</Button>
            </div>
          </form>
        </Card>
      )}

      {options.length === 0 && !showForm ? (
        <Card className="p-6 text-center text-gray-400">
          <div className="text-3xl mb-2">🚕</div>
          <p className="text-sm">No transport options yet</p>
          <p className="text-xs mt-1">Add rideshare, shuttle, or other ground transport</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">✈️→🏨 Arrival ({arrivalOptions.length})</h4>
            <div className="space-y-2">
              {arrivalOptions.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No arrival options</p>
              ) : (
                arrivalOptions.map(renderOptionCard)
              )}
            </div>
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-500 mb-2">🏨→✈️ Departure ({departureOptions.length})</h4>
            <div className="space-y-2">
              {departureOptions.length === 0 ? (
                <p className="text-xs text-gray-400 italic">No departure options</p>
              ) : (
                departureOptions.map(renderOptionCard)
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
