'use client';

import { useState, useEffect } from 'react';
import { Card, Button, Badge } from '@/components/ui';

// Categories by activity type
const ACTIVITY_CATEGORIES: Record<string, { value: string; label: string; icon: string }[]> = {
  snowboard: [
    { value: 'lift_pass', label: 'Lift Pass', icon: '🎿' },
    { value: 'equipment', label: 'Board/Gear Rental', icon: '🏂' },
    { value: 'lessons', label: 'Lessons', icon: '👨‍🏫' },
    { value: 'food', label: 'Food & Dining', icon: '🍽️' },
    { value: 'apres', label: 'Après/Nightlife', icon: '🍺' },
  ],
  surf: [
    { value: 'board_rental', label: 'Board Rental', icon: '🏄' },
    { value: 'lessons', label: 'Surf Lessons', icon: '👨‍🏫' },
    { value: 'coworking', label: 'Coworking Space', icon: '💻' },
    { value: 'food', label: 'Food & Dining', icon: '🍽️' },
    { value: 'yoga', label: 'Yoga/Fitness', icon: '🧘' },
    { value: 'massage', label: 'Massage/Spa', icon: '💆' },
  ],
  kite: [
    { value: 'kite_rental', label: 'Kite Rental', icon: '🪁' },
    { value: 'lessons', label: 'Kite Lessons', icon: '👨‍🏫' },
    { value: 'coworking', label: 'Coworking Space', icon: '💻' },
    { value: 'food', label: 'Food & Dining', icon: '🍽️' },
  ],
  bizdev: [
    { value: 'coworking', label: 'Coworking Space', icon: '💻' },
    { value: 'conference', label: 'Conference/Event', icon: '🎤' },
    { value: 'networking', label: 'Networking Events', icon: '🤝' },
    { value: 'food', label: 'Food & Dining', icon: '🍽️' },
    { value: 'coffee', label: 'Coffee Shops', icon: '☕' },
  ],
  default: [
    { value: 'activities', label: 'Activities/Tours', icon: '🎟️' },
    { value: 'equipment', label: 'Equipment Rental', icon: '🎿' },
    { value: 'lessons', label: 'Lessons/Classes', icon: '👨‍🏫' },
    { value: 'coworking', label: 'Coworking Space', icon: '💻' },
    { value: 'food', label: 'Food & Dining', icon: '🍽️' },
    { value: 'nightlife', label: 'Nightlife/Events', icon: '🎉' },
    { value: 'fitness', label: 'Gym/Fitness', icon: '💪' },
    { value: 'wellness', label: 'Spa/Wellness', icon: '💆' },
    { value: 'transport', label: 'Local Transport', icon: '🛺' },
    { value: 'tips', label: 'Tips & Misc', icon: '💵' },
  ],
};

interface ActivityExpense {
  id: string;
  category: string;
  title: string | null;
  vendor: string | null;
  url: string | null;
  price: number | null;
  is_per_person: boolean;
  per_person: number | null;
  notes: string | null;
  votes_up: number;
  votes_down: number;
  is_selected: boolean;
}

interface Props {
  tripId: string;
  activity: string | null;
  participantCount: number;
  onCategoryTotals?: (totals: Record<string, number>) => void;
}

export default function ActivityExpenses({ tripId, activity, participantCount, onCategoryTotals }: Props) {
  const [expenses, setExpenses] = useState<ActivityExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    category: 'activities',
    title: '',
    vendor: '',
    url: '',
    price: '',
    is_per_person: true,
    notes: ''
  });

  const categories = ACTIVITY_CATEGORIES[activity || 'default'] || ACTIVITY_CATEGORIES.default;
  const allCategories = [...new Map([...categories, ...ACTIVITY_CATEGORIES.default].map(c => [c.value, c])).values()];

  useEffect(() => { loadExpenses(); }, [tripId]);

  useEffect(() => {
    const categoryTotals: Record<string, number> = {};
    expenses.filter(e => e.is_selected).forEach(e => {
      const perPerson = e.is_per_person ? Number(e.price || 0) : Number(e.per_person || 0);
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + perPerson;
    });
    if (onCategoryTotals) onCategoryTotals(categoryTotals);
  }, [expenses, participantCount, onCategoryTotals]);
  const loadExpenses = async () => {
    try {
      const res = await fetch(`/api/trips/${tripId}/activities`);
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.options || []);
      }
    } catch (err) {
      console.error('Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(form.price) || 0;
    const perPerson = form.is_per_person ? price : (participantCount > 0 ? price / participantCount : price);

    const res = await fetch(`/api/trips/${tripId}/activities`, {
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
      setForm({ category: 'activities', title: '', vendor: '', url: '', price: '', is_per_person: true, notes: '' });
      loadExpenses();
    }
  };

  const handleAction = async (id: string, action: string) => {
    await fetch(`/api/trips/${tripId}/activities/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    loadExpenses();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove?')) return;
    await fetch(`/api/trips/${tripId}/activities/${id}`, { method: 'DELETE' });
    loadExpenses();
  };

  const fmt = (n: number | null) => n ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n) : '-';
  const getCatConfig = (cat: string) => allCategories.find(c => c.value === cat) || { value: cat, label: cat, icon: '📋' };

  // Group expenses by category
  const grouped = expenses.reduce((acc, exp) => {
    if (!acc[exp.category]) acc[exp.category] = [];
    acc[exp.category].push(exp);
    return acc;
  }, {} as Record<string, ActivityExpense[]>);

  if (loading) return <div className="animate-pulse bg-gray-100 rounded-lg h-32"></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">📋 Trip Expenses</h3>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Expense'}
        </Button>
      </div>

      {/* Suggested categories for this activity */}
      <div className="flex flex-wrap gap-2">
        {categories.map(cat => {
          const hasExpense = expenses.some(e => e.category === cat.value);
          return (
            <button
              key={cat.value}
              onClick={() => {
                setForm({ ...form, category: cat.value });
                setShowForm(true);
              }}
              className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                hasExpense 
                  ? 'bg-green-100 border-green-300 text-green-700' 
                  : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {cat.icon} {cat.label} {hasExpense && '✓'}
            </button>
          );
        })}
      </div>

      {showForm && (
        <Card className="p-4 border-2 border-dashed border-[#b4b237]">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <select
                className="border rounded px-3 py-2 text-sm"
                value={form.category}
                onChange={e => setForm({ ...form, category: e.target.value })}
              >
                {allCategories.map(c => (
                  <option key={c.value} value={c.value}>{c.icon} {c.label}</option>
                ))}
              </select>
              <input
                className="border rounded px-3 py-2 text-sm"
                placeholder="Title (e.g. 'Dojo Bali Coworking')"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <input
                className="border rounded px-3 py-2 text-sm"
                placeholder="Vendor/Business"
                value={form.vendor}
                onChange={e => setForm({ ...form, vendor: e.target.value })}
              />
              <input
                className="border rounded px-3 py-2 text-sm"
                type="number"
                placeholder="Price"
                value={form.price}
                onChange={e => setForm({ ...form, price: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_per_person}
                  onChange={e => setForm({ ...form, is_per_person: e.target.checked })}
                  className="rounded"
                />
                Per person
              </label>
            </div>
            <input
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Booking/website link (optional)"
              value={form.url}
              onChange={e => setForm({ ...form, url: e.target.value })}
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" size="sm">Add Expense</Button>
            </div>
          </form>
        </Card>
      )}

      {expenses.length === 0 && !showForm ? (
        <Card className="p-6 text-center text-gray-400">
          <div className="text-3xl mb-2">📋</div>
          <p className="text-sm">No expenses added yet</p>
          <p className="text-xs mt-1">Click a category above or + Add Expense</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, items]) => {
            const catConfig = getCatConfig(category);
            const selectedTotal = items.filter(i => i.is_selected).reduce((sum, i) => 
              sum + (i.is_per_person ? Number(i.price || 0) : Number(i.per_person || 0)), 0);
            return (
              <div key={category}>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-medium text-gray-600">
                    {catConfig.icon} {catConfig.label}
                  </h4>
                  {selectedTotal > 0 && (
                    <span className="text-xs text-green-600 font-medium">
                      {fmt(selectedTotal)}/person selected
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {items.map(exp => (
                    <Card 
                      key={exp.id}
                      className={`p-3 ${exp.is_selected ? 'ring-2 ring-green-500 bg-green-50' : ''}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h5 className="font-medium text-sm text-gray-900 truncate">
                            {exp.title || catConfig.label}
                          </h5>
                          {exp.vendor && (
                            <p className="text-xs text-gray-500 truncate">{exp.vendor}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-sm">{fmt(Number(exp.price))}</div>
                          <div className="text-xs text-gray-400">
                            {exp.is_per_person ? '/person' : 'total'}
                          </div>
                        </div>
                      </div>
                      
                      {exp.notes && (
                        <p className="text-xs text-gray-500 italic mt-1 truncate">"{exp.notes}"</p>
                      )}

                      <div className="flex items-center justify-between mt-2 pt-2 border-t">
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleAction(exp.id, 'vote_up')} className="px-1 py-0.5 rounded hover:bg-green-100 text-xs">
                            👍{exp.votes_up}
                          </button>
                          <button onClick={() => handleAction(exp.id, 'vote_down')} className="px-1 py-0.5 rounded hover:bg-red-100 text-xs">
                            👎{exp.votes_down}
                          </button>
                        </div>
                        <div className="flex items-center gap-1">
                          {exp.url && (
                            <a href={exp.url} target="_blank" rel="noopener noreferrer" className="px-2 py-0.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">
                              Link
                            </a>
                          )}
                          <button
                            onClick={() => handleAction(exp.id, exp.is_selected ? 'deselect' : 'select')}
                            className={`px-2 py-0.5 text-xs rounded ${
                              exp.is_selected 
                                ? 'bg-green-600 text-white' 
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {exp.is_selected ? '✓' : 'Add'}
                          </button>
                          <button onClick={() => handleDelete(exp.id)} className="text-red-400 text-xs hover:text-red-600">✕</button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {expenses.some(e => e.is_selected) && (
        <Card className="p-4 bg-[#b4b237]/10 border-[#b4b237]/30">
          <div className="flex justify-between items-center">
            <span className="font-medium text-[#8f8c2a]">Selected expenses total:</span>
            <div className="text-right">
              <div className="font-bold text-[#8f8c2a]">
                {fmt(expenses.filter(e => e.is_selected).reduce((sum, e) => 
                  sum + (e.is_per_person ? Number(e.price || 0) : Number(e.per_person || 0)), 0))}/person
              </div>
              <div className="text-xs text-[#8f8c2a]/70">
                × {participantCount} = {fmt(expenses.filter(e => e.is_selected).reduce((sum, e) => 
                  sum + (e.is_per_person ? Number(e.price || 0) * participantCount : Number(e.price || 0)), 0))} total
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
