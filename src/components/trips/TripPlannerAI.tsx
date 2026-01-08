'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui';

interface Recommendation {
  name: string;
  address: string;
  website: string;
  rating: number;
  reviewCount: number;
  priceLevel: string;
  popularityScore: number;
  whyHyped: string;
  communityFit: string;
  contentAngle: string;
  photos?: string[];
}

interface AIResponse {
  lodging: Recommendation[];
  coworking: Recommendation[];
  motoRental: Recommendation[];
  equipmentRental: Recommendation[];
  airportTransfers: Recommendation[];
  brunchCoffee: Recommendation[];
  dinner: Recommendation[];
  activities: Recommendation[];
  nightlife: Recommendation[];
  toiletries: Recommendation[];
  wellness: Recommendation[];
}

type CategoryKey = keyof AIResponse;

interface ScheduledSelection {
  category: CategoryKey;
  item: Recommendation;
  days: number[];
  allDay: boolean;
  startTime: string;
  endTime: string;
  rateType: 'daily' | 'weekly' | 'monthly';
  customPrice: number;
}

interface Props {
  tripId: string;
  city: string | null;
  country: string | null;
  activity: string | null;
  month: number;
  year: number;
  daysTravel: number;
  onBudgetChange?: (total: number, items: ScheduledSelection[]) => void;
}

const CATEGORIES: { key: CategoryKey; label: string; icon: string; defaultAllDay: boolean }[] = [
  { key: 'lodging', label: 'Lodging', icon: '🏨', defaultAllDay: true },
  { key: 'coworking', label: 'Coworking', icon: '🏢', defaultAllDay: false },
  { key: 'motoRental', label: 'Moto/Car Rental', icon: '🏍️', defaultAllDay: true },
  { key: 'equipmentRental', label: 'Equipment Rental', icon: '🏄', defaultAllDay: true },
  { key: 'airportTransfers', label: 'Airport Transfers', icon: '🚕', defaultAllDay: false },
  { key: 'brunchCoffee', label: 'Brunch & Coffee', icon: '☕', defaultAllDay: false },
  { key: 'dinner', label: 'Dinner', icon: '🍽️', defaultAllDay: false },
  { key: 'activities', label: 'Activities/Tours', icon: '🎯', defaultAllDay: false },
  { key: 'nightlife', label: 'Nightlife', icon: '🎉', defaultAllDay: false },
  { key: 'toiletries', label: 'Toiletries/Supplies', icon: '🛒', defaultAllDay: false },
  { key: 'wellness', label: 'Wellness/Gym', icon: '💆', defaultAllDay: false },
];

const TIME_SLOTS = ['06:00','07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00','22:00','23:00'];

export default function TripPlannerAI({ tripId, city, country, activity, month, year, daysTravel, onBudgetChange }: Props) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<CategoryKey | null>(null);
  
  const [budgetLevel, setBudgetLevel] = useState<'low' | 'mid' | 'high'>('mid');
  const [budgetTiers, setBudgetTiers] = useState({ low: 1250, mid: 2000, high: 2500 });
  const [lodgingPriceMax, setLodgingPriceMax] = useState(4);
  const [mealPriceMax, setMealPriceMax] = useState(4);
  const [partySize, setPartySize] = useState(1);
  const [beds, setBeds] = useState(1);
  const [lodgingBudget, setLodgingBudget] = useState(100);
  const [equipmentType, setEquipmentType] = useState('surf gear');
  
  const [selections, setSelections] = useState<ScheduledSelection[]>([]);
  
  const [editingSelection, setEditingSelection] = useState<ScheduledSelection | null>(null);
  const [editForm, setEditForm] = useState<{ days: number[]; allDay: boolean; startTime: string; endTime: string; rateType: 'daily' | 'weekly' | 'monthly'; customPrice: number }>({
    days: [], allDay: true, startTime: '09:00', endTime: '17:00', rateType: 'daily', customPrice: 0
  });
  
  // Range selection mode
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState<number | null>(null);

  const tripDays = Array.from({ length: daysTravel }, (_, i) => i + 1);

  const analyzeDestination = async () => {
    if (!city || !country) { setError('Please select a destination first'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trips/${tripId}/ai-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, country, activity, month, year, daysTravel, partySize, lodgingPriceMax, mealPriceMax, equipmentType })
      });
      if (!res.ok) { 
        const d = await res.json(); 
        if (d.raw) console.error('GPT Raw Response:', d.raw.substring(0, 500));
        throw new Error(d.error || 'Failed'); 
      }
      const data = await res.json();
      setRecommendations(data.recommendations);
      setSelections([]);
      setExpandedCategory('lodging');
    } catch (err) { setError(err instanceof Error ? err.message : 'Request failed'); }
    finally { setLoading(false); }
  };

  const getCatInfo = (key: CategoryKey) => CATEGORIES.find(c => c.key === key);

  const handleSelectItem = (category: CategoryKey, item: Recommendation) => {
    const catInfo = getCatInfo(category);
    const newSel: ScheduledSelection = {
      category, item,
      days: [1],
      allDay: catInfo?.defaultAllDay || false,
      startTime: '09:00',
      endTime: '17:00',
      rateType: 'daily',
      customPrice: 0
    };
    setEditingSelection(newSel);
    setEditForm({ days: [1], allDay: catInfo?.defaultAllDay || false, startTime: '09:00', endTime: '17:00', rateType: 'daily', customPrice: 0 });
    setRangeMode(false);
    setRangeStart(null);
  };

  const handleEditSelection = (sel: ScheduledSelection) => {
    setEditingSelection(sel);
    setEditForm({ days: sel.days, allDay: sel.allDay, startTime: sel.startTime, endTime: sel.endTime, rateType: sel.rateType || 'daily', customPrice: sel.customPrice || 0 });
    setRangeMode(false);
    setRangeStart(null);
  };

  const confirmSelection = () => {
    if (!editingSelection || editForm.days.length === 0) return;
    const updated: ScheduledSelection = { ...editingSelection, ...editForm };
    setSelections(prev => {
      const idx = prev.findIndex(s => s.category === updated.category && s.item.name === updated.item.name);
      if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
      return [...prev, updated];
    });
    setEditingSelection(null);
  };

  const removeSelection = (category: CategoryKey, name: string) => {
    setSelections(prev => prev.filter(s => !(s.category === category && s.item.name === name)));
  };

  const isSelected = (category: CategoryKey, item: Recommendation) => selections.some(s => s.category === category && s.item.name === item.name);

  const handleDayClick = (day: number) => {
    if (rangeMode) {
      if (rangeStart === null) {
        setRangeStart(day);
      } else {
        const start = Math.min(rangeStart, day);
        const end = Math.max(rangeStart, day);
        const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
        setEditForm(prev => ({ ...prev, days: range }));
        setRangeStart(null);
      }
    } else {
      setEditForm(prev => ({
        ...prev,
        days: prev.days.includes(day) ? prev.days.filter(d => d !== day) : [...prev.days, day].sort((a,b) => a-b)
      }));
    }
  };

  const selectAllDays = () => setEditForm(prev => ({ ...prev, days: [...tripDays] }));
  const clearDays = () => setEditForm(prev => ({ ...prev, days: [] }));

  const calculateItemCost = (sel: ScheduledSelection): number => {
    const price = sel.customPrice || 0;
    const numDays = sel.days.length;
    
    switch (sel.rateType) {
      case 'monthly':
        return price; // Monthly is flat rate
      case 'weekly':
        const weeks = Math.ceil(numDays / 7);
        return price * weeks;
      case 'daily':
      default:
        return price * numDays;
    }
  };

  const totalBudget = useMemo(() => {
    return selections.reduce((sum, sel) => sum + calculateItemCost(sel), 0);
  }, [selections]);

  useEffect(() => {
    if (onBudgetChange) onBudgetChange(totalBudget, selections);
  }, [totalBudget, selections]);

  const renderTable = (categoryKey: CategoryKey, items: Recommendation[]) => {
    if (!items?.length) return <p className="text-gray-400 text-sm py-4 px-4">No recommendations</p>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="py-2 px-3 text-center w-14">Add</th>
              <th className="py-2 px-3 text-center w-14">Score</th>
              <th className="py-2 px-3 text-left">Name</th>
              <th className="py-2 px-3 text-left">Address</th>
              <th className="py-2 px-3 text-left">Website</th>
              <th className="py-2 px-3 text-right">Price</th>
              <th className="py-2 px-3 text-left max-w-[200px]">Why Viral</th>
              <th className="py-2 px-3 text-left max-w-[200px]">Social Proof</th>
            </tr>
          </thead>
          <tbody>
            {items.map((rec, idx) => {
              const selected = isSelected(categoryKey, rec);
              return (
                <tr key={idx} className={selected ? 'bg-green-50' : idx % 2 ? 'bg-gray-50' : ''}>
                  <td className="py-2 px-3 text-center">
                    <button onClick={() => handleSelectItem(categoryKey, rec)}
                      className={`w-7 h-7 rounded-full font-bold text-sm ${selected ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>
                      {selected ? '✓' : '+'}
                    </button>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${rec.popularityScore >= 80 ? 'bg-green-100 text-green-700' : rec.popularityScore >= 60 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100'}`}>
                      {rec.popularityScore || '—'}
                    </span>
                  </td>
                  <td className="py-2 px-3 font-medium">{rec.name}</td>
                  <td className="py-2 px-3 text-xs text-gray-500 max-w-[150px] truncate">{rec.address}</td>
                  <td className="py-2 px-3">{rec.website && rec.website !== "N/A" ? <a href={rec.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">Visit →</a> : <span className="text-gray-400 text-xs">—</span>}</td>
                  <td className="py-2 px-3 text-right text-green-600 font-medium whitespace-nowrap">{rec.priceLevel}</td>
                  <td className="py-2 px-3 text-xs text-gray-500 max-w-[200px] truncate">{rec.whyHyped}</td>
                  <td className="py-2 px-3 text-xs text-gray-500 max-w-[200px] truncate">{rec.contentAngle}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 p-4 bg-gray-50 rounded-lg">
        
        <div>
          <label className="text-xs text-gray-500 block mb-1">🏨 Lodging Max</label>
          <select value={lodgingPriceMax} onChange={e => setLodgingPriceMax(+e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value={1}>$</option>
            <option value={2}>$</option>
            <option value={3}>$$</option>
            <option value={4}>$$</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">🍽️ Meals Max</label>
          <select value={mealPriceMax} onChange={e => setMealPriceMax(+e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value={1}>$</option>
            <option value={2}>$</option>
            <option value={3}>$$</option>
            <option value={4}>$$</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">👥 Party</label>
          <select value={partySize} onChange={e => setPartySize(+e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">🛏️ Beds</label>
          <select value={beds} onChange={e => setBeds(+e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            {[1,2,3,4,5].map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">🏨 Max/Night</label>
          <select value={lodgingBudget} onChange={e => setLodgingBudget(+e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value={50}>$50</option>
            <option value={75}>$75</option>
            <option value={100}>$100</option>
            <option value={150}>$150</option>
            <option value={200}>$200</option>
          </select>
        </div>
        <div className="flex items-end">
          <Button onClick={analyzeDestination} loading={loading} disabled={!city} className="w-full">
            🤖 Analyze {city || 'Destination'}
          </Button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>}

      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-[#b4b237] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Finding viral spots in {city}...</p>
        </div>
      )}

      {/* Edit Modal */}
      {editingSelection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-1">{getCatInfo(editingSelection.category)?.icon} {editingSelection.item.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{editingSelection.item.priceLevel}</p>
            
            <div className="space-y-4">
              {/* All Day Toggle */}
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={editForm.allDay} 
                  onChange={e => setEditForm(p => ({ ...p, allDay: e.target.checked }))}
                  className="w-5 h-5 rounded"
                />
                <div>
                  <span className="font-medium">All Day</span>
                  <p className="text-xs text-gray-500">No specific times (hotels, rentals, etc.)</p>
                </div>
              </label>

              {/* Rate Type */}
              <div>
                <label className="text-sm font-medium block mb-2">💰 Rate Type</label>
                <div className="flex gap-2">
                  {(['daily', 'weekly', 'monthly'] as const).map(rate => (
                    <button key={rate} onClick={() => setEditForm(p => ({...p, rateType: rate}))}
                      className={`px-4 py-2 rounded text-sm font-medium ${editForm.rateType === rate ? 'bg-green-500 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}>
                      {rate === 'daily' ? '📅 Daily' : rate === 'weekly' ? '📆 Weekly' : '🗓️ Monthly'}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {editForm.rateType === 'monthly' && 'Monthly rate'}
                  {editForm.rateType === 'weekly' && 'Weekly rate'}
                  {editForm.rateType === 'daily' && 'Daily rate'}
                </p>
              </div>

              {/* Date Selection */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Select Days</label>
                  <div className="flex gap-2">
                    <button onClick={() => setRangeMode(!rangeMode)} 
                      className={`text-xs px-2 py-1 rounded ${rangeMode ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}>
                      {rangeMode ? (rangeStart ? `Start: Day ${rangeStart}` : 'Pick start') : 'Range'}
                    </button>
                    <button onClick={selectAllDays} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">All</button>
                    <button onClick={clearDays} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Clear</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tripDays.map(d => (
                    <button key={d} onClick={() => handleDayClick(d)}
                      className={`w-10 h-10 rounded text-sm font-medium transition-colors ${
                        editForm.days.includes(d) ? 'bg-green-500 text-white' : 
                        rangeStart === d ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                      }`}>
                      {d}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">{editForm.days.length} day(s) selected</p>
              </div>

              {/* Time Selection (if not all day) */}
              {!editForm.allDay && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-2">Start Time</label>
                    <select value={editForm.startTime} onChange={e => setEditForm(p => ({...p, startTime: e.target.value}))}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">End Time</label>
                    <select value={editForm.endTime} onChange={e => setEditForm(p => ({...p, endTime: e.target.value}))}
                      className="w-full border rounded-lg px-3 py-2 text-sm">
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* Cost Estimate */}
              <div className="bg-green-50 rounded-lg p-3 text-sm border border-green-200">
                <div className="flex justify-between mb-2">
                  <span>Your price ({editForm.rateType}):</span>
                  <input 
                    type="number" 
                    value={editForm.customPrice} 
                    onChange={e => setEditForm(f => ({ ...f, customPrice: +e.target.value }))}
                    className="w-24 border rounded px-2 py-1 text-right font-medium"
                    min={0}
                    placeholder="0"
                  />
                </div>
                {editForm.rateType === 'daily' && (
                  <div className="flex justify-between text-gray-600">
                    <span>Days selected:</span>
                    <span>{editForm.days.length}</span>
                  </div>
                )}
                {editForm.rateType === 'weekly' && (
                  <div className="flex justify-between text-gray-600">
                    <span>Weeks:</span>
                    <span>{Math.ceil(editForm.days.length / 7)}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold text-green-700 border-t border-green-200 mt-2 pt-2">
                  <span>Total:</span>
                  <span>
                    ${editForm.rateType === 'monthly' 
                      ? editForm.customPrice 
                      : editForm.rateType === 'weekly' 
                        ? editForm.customPrice * Math.ceil(editForm.days.length / 7)
                        : editForm.customPrice * editForm.days.length}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => setEditingSelection(null)} className="flex-1">Cancel</Button>
              <Button onClick={confirmSelection} className="flex-1" disabled={editForm.days.length === 0}>
                ✓ Add to Plan
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Budget Summary */}
      {selections.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-green-800">🗺️ Your Trip Plan ({selections.length} items)</h3>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-700">${totalBudget.toLocaleString()}</div>
              <div className="text-xs text-gray-500">estimated total</div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {selections.map((sel, idx) => {
              const catInfo = getCatInfo(sel.category);
              const cost = calculateItemCost(sel);
              return (
                <div key={idx} className="bg-white rounded-lg p-3 shadow-sm border border-green-100">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-lg">{catInfo?.icon}</span>
                    <div className="flex gap-1">
                      <button onClick={() => handleEditSelection(sel)} className="text-blue-500 hover:text-blue-700 text-xs">✏️</button>
                      <button onClick={() => removeSelection(sel.category, sel.item.name)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">{catInfo?.label}</div>
                  <div className="font-medium text-sm">{sel.item.name}</div>
                  <div className="text-green-600 font-medium">${cost.toLocaleString()}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    Days: {sel.days.length > 5 ? `${sel.days[0]}-${sel.days[sel.days.length-1]}` : sel.days.join(', ')}
                    {!sel.allDay && ` • ${sel.startTime}-${sel.endTime}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Categories */}
      {recommendations && !loading && (
        <div className="space-y-2">
          {CATEGORIES.map(({ key, label, icon }) => {
            const items = recommendations[key];
            const isOpen = expandedCategory === key;
            const hasSel = selections.some(s => s.category === key);
            return (
              <div key={key} className={`border rounded-lg ${hasSel ? 'border-green-300' : 'border-gray-200'}`}>
                <button onClick={() => setExpandedCategory(isOpen ? null : key)}
                  className="w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100">
                  <span className="flex items-center gap-2">
                    <span className="text-xl">{icon}</span>
                    <span className="font-medium">{label}</span>
                    {hasSel && <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded">✓</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">{items?.length || 0}</span>
                    <span className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                  </span>
                </button>
                {isOpen && renderTable(key, items)}
              </div>
            );
          })}
        </div>
      )}

      {!loading && !recommendations && !error && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-5xl mb-3">🤖</div>
          <p className="font-medium text-lg">AI Trip Planner</p>
          <p className="text-sm">Select a destination and click Analyze to get recommendations</p>
        </div>
      )}
    </div>
  );
}
