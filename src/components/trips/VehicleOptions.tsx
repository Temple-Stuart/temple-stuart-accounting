'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge } from '@/components/ui';

const VEHICLE_TYPES = [
  { value: 'suv', label: 'SUV', icon: '🚙' },
  { value: 'car', label: 'Car', icon: '🚗' },
  { value: 'van', label: 'Van', icon: '🚐' },
  { value: 'moped', label: 'Moped/Scooter', icon: '🛵' },
  { value: 'motorcycle', label: 'Motorcycle', icon: '🏍️' },
  { value: 'atv', label: 'ATV/Quad', icon: '🏎️' },
  { value: 'boat', label: 'Boat', icon: '🚤' },
  { value: 'other', label: 'Other', icon: '🚘' },
];

interface VehicleOption {
  id: string;
  url: string | null;
  vehicle_type: string;
  title: string | null;
  vendor: string | null;
  price_per_day: number | null;
  total_price: number | null;
  per_person: number | null;
  notes: string | null;
  votes_up: number;
  votes_down: number;
  is_selected: boolean;
}

interface Props {
  tripId: string;
  participantCount: number;
  days: number;
  onSelect?: (option: VehicleOption) => void;
}

export default function VehicleOptions({ tripId, participantCount, days, onSelect }: Props) {
  const [options, setOptions] = useState<VehicleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    url: '',
    vehicle_type: 'suv',
    title: '',
    vendor: '',
    price_per_day: '',
    notes: ''
  });

  useEffect(() => { loadOptions(); }, [tripId]);

  const loadOptions = async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/vehicles`);
      if (res.ok) {
        const data = await res.json();
        setOptions(data.options || []);
      }
    } catch (err) {
      console.error('Failed to load vehicle options:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const pricePerDay = parseFloat(form.price_per_day) || 0;
    const totalPrice = pricePerDay * days;
    const perPerson = participantCount > 0 ? totalPrice / participantCount : totalPrice;

    const res = await fetch(`/api/trips/${tripId}/vehicles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        price_per_day: pricePerDay || null,
        total_price: totalPrice || null,
        per_person: perPerson || null
      })
    });

    if (res.ok) {
      setShowForm(false);
      setForm({ url: '', vehicle_type: 'suv', title: '', vendor: '', price_per_day: '', notes: '' });
      loadOptions();
    }
  };

  const handleVote = async (optionId: string, direction: 'up' | 'down') => {
    await fetch(`/api/trips/${tripId}/vehicles/${optionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: direction === 'up' ? 'vote_up' : 'vote_down' })
    });
    loadOptions();
  };

  const handleSelect = async (optionId: string) => {
    await fetch(`/api/trips/${tripId}/vehicles/${optionId}`, {
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
    await fetch(`/api/trips/${tripId}/vehicles/${optionId}`, { method: 'DELETE' });
    loadOptions();
  };

  const fmt = (n: number | null) => n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n) : '-';
  const getTypeConfig = (type: string) => VEHICLE_TYPES.find(t => t.value === type) || VEHICLE_TYPES[7];

  if (loading) return <div className="animate-pulse bg-gray-100 rounded-lg h-32"></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">🚗 Transportation Options</h3>
        {options.length < 5 && (
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ Add Option'}
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="p-4 border-2 border-dashed border-[#b4b237]">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <select
                className="border rounded px-3 py-2 text-sm"
                value={form.vehicle_type}
                onChange={e => setForm({ ...form, vehicle_type: e.target.value })}
              >
                {VEHICLE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                ))}
              </select>
              <input
                className="border rounded px-3 py-2 text-sm"
                placeholder="Title (e.g. 'Honda PCX 160')"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                className="border rounded px-3 py-2 text-sm"
                placeholder="Vendor/Shop name"
                value={form.vendor}
                onChange={e => setForm({ ...form, vendor: e.target.value })}
              />
              <input
                className="border rounded px-3 py-2 text-sm"
                type="number"
                placeholder={`$/day (${days} days)`}
                value={form.price_per_day}
                onChange={e => setForm({ ...form, price_per_day: e.target.value })}
              />
            </div>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Link to rental site (optional)"
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
            />
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
          <div className="text-4xl mb-2">🚗</div>
          <p>No transportation options yet</p>
          <p className="text-sm mt-1">Add rental cars, mopeds, motorcycles, or other vehicles</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {options.map(option => {
            const typeConfig = getTypeConfig(option.vehicle_type);
            return (
              <Card 
                key={option.id} 
                className={`p-4 relative ${option.is_selected ? 'ring-2 ring-green-500 bg-green-50' : ''}`}
              >
                {option.is_selected && (
                  <Badge variant="success" className="absolute top-2 right-2">✓ Selected</Badge>
                )}
                
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">{typeConfig.icon}</span>
                  <div>
                    <h4 className="font-medium text-gray-900">
                      {option.title || typeConfig.label}
                    </h4>
                    {option.vendor && (
                      <p className="text-xs text-gray-500">{option.vendor}</p>
                    )}
                  </div>
                </div>
                
                <div className="text-sm space-y-1 mb-3">
                  {option.price_per_day && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">{fmt(option.price_per_day)}/day × {days}</span>
                      <span className="font-medium">{fmt(option.price_per_day * days)}</span>
                    </div>
                  )}
                  {option.total_price && participantCount > 1 && (
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
                  
                  {option.url && (
                    <a
                    
                      href={option.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700"
                    >
                      View Rental ↗
                    </a>
                  )}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
