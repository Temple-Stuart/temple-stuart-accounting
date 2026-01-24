'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui';

// Grok response format with sentiment analysis
interface GrokRecommendation {
  name: string;
  address: string;
  website: string | null;
  photoUrl: string | null;
  googleRating: number;
  reviewCount: number;
  sentimentScore: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  summary: string;
  warnings: string[];
  trending: boolean;
  fitScore: number;
  valueRank: number;
  category: string;
}

interface ScheduledSelection {
  category: string;
  item: GrokRecommendation;
  days: number[];
  allDay: boolean;
  startTime: string;
  endTime: string;
  rateType: 'daily' | 'weekly' | 'monthly';
  customPrice: number;
  splitType: 'personal' | 'split';
}

interface TravelerProfile {
  tripType: 'remote_work' | 'romantic' | 'friends' | 'family' | 'solo' | 'relaxation';
  budget: 'under50' | '50to100' | '100to200' | '200to400' | 'over400';
  priorities: string[];
  dealbreakers: string[];
  groupSize: number;
}

const DEFAULT_PROFILE: TravelerProfile = {
  tripType: 'remote_work',
  budget: '100to200',
  priorities: ['best_value'],
  dealbreakers: [],
  groupSize: 1
};

interface Props {
  tripId: string;
  city: string | null;
  country: string | null;
  activity: string | null;
  activities?: string[];
  month: number;
  year: number;
  daysTravel: number;
  onBudgetChange?: (total: number, items: ScheduledSelection[], groupSize: number) => void;
  committedBudget?: { category: string; amount: number; description: string; photoUrl?: string | null }[];
}

const TRIP_TYPES = [
  { value: 'remote_work', label: '💼 Remote Work', desc: 'Coworking, wifi, productivity' },
  { value: 'romantic', label: '💑 Romantic Getaway', desc: 'Couples, intimate, special' },
  { value: 'friends', label: '👯 Friends Adventure', desc: 'Group fun, nightlife, memories' },
  { value: 'family', label: '👨‍👩‍👧 Family Vacation', desc: 'Kid-friendly, safe, spacious' },
  { value: 'solo', label: '🎒 Solo Explorer', desc: 'Meet people, flexible, adventure' },
  { value: 'relaxation', label: '🏖️ Pure Relaxation', desc: 'Unwind, no agenda, recharge' },
];

const BUDGET_OPTIONS = [
  { value: 'under50', label: 'Under $50/night', desc: 'Budget-friendly' },
  { value: '50to100', label: '$50-100/night', desc: 'Mid-range value' },
  { value: '100to200', label: '$100-200/night', desc: 'Comfortable' },
  { value: '200to400', label: '$200-400/night', desc: 'Premium' },
  { value: 'over400', label: '$400+/night', desc: 'Luxury' },
];

const PRIORITY_OPTIONS = [
  { value: 'best_value', label: '💰 Best Value' },
  { value: 'location', label: '📍 Location' },
  { value: 'wifi', label: '📶 Fast Wifi' },
  { value: 'quiet', label: '🤫 Quiet/Peaceful' },
  { value: 'social', label: '🎉 Social Scene' },
  { value: 'amenities', label: '🏊 Pool/Amenities' },
];

const CATEGORY_INFO: Record<string, { label: string; icon: string }> = {
  lodging: { label: 'Lodging', icon: '🏨' },
  coworking: { label: 'Coworking', icon: '🏢' },
  motoRental: { label: 'Moto/Car Rental', icon: '🏍️' },
  equipmentRental: { label: 'Equipment Rental', icon: '🏄' },
  airportTransfers: { label: 'Airport Transfers', icon: '🚕' },
  brunchCoffee: { label: 'Brunch & Coffee', icon: '☕' },
  dinner: { label: 'Dinner', icon: '🍽️' },
  activities: { label: 'Activities/Tours', icon: '🎯' },
  nightlife: { label: 'Nightlife', icon: '🎉' },
  toiletries: { label: 'Toiletries/Supplies', icon: '🛒' },
  wellness: { label: 'Wellness/Gym', icon: '💆' },
};

export default function TripPlannerAI({ tripId, city, country, activity, activities = [], month, year, daysTravel, onBudgetChange, committedBudget }: Props) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<GrokRecommendation[]>([]);
  const [byCategory, setByCategory] = useState<Record<string, GrokRecommendation[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  
  const [minRating, setMinRating] = useState(4.0);
  const [minReviews, setMinReviews] = useState(50);
  
  const [selections, setSelections] = useState<ScheduledSelection[]>([]);
  const [editingSelection, setEditingSelection] = useState<ScheduledSelection | null>(null);
  const [editForm, setEditForm] = useState({ days: [] as number[], allDay: true, startTime: '09:00', endTime: '17:00', rateType: 'daily' as 'daily' | 'weekly' | 'monthly', customPrice: 0, splitType: 'personal' as 'personal' | 'split' });

  const [profile, setProfile] = useState<TravelerProfile>(DEFAULT_PROFILE);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileStep, setProfileStep] = useState(1);

  const tripDays = Array.from({ length: daysTravel }, (_, i) => i + 1);
  const tripActivities = activities.length > 0 ? activities : (activity ? [activity] : []);

  const analyzeDestination = async () => {
    if (!city || !country) { setError('Please select a destination first'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/trips/' + tripId + '/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, country, activities: tripActivities, activity, month, year, daysTravel, minRating, minReviews, profile })
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      const data = await res.json();
      setRecommendations(data.recommendations || []);
      setByCategory(data.byCategory || {});
      setSelections([]);
      const firstCat = Object.keys(data.byCategory || {})[0];
      if (firstCat) setExpandedCategory(firstCat);
    } catch (err) { setError(err instanceof Error ? err.message : 'Request failed'); }
    finally { setLoading(false); }
  };

  const handleSelectItem = (item: GrokRecommendation) => {
    const newSel: ScheduledSelection = {
      category: item.category, item, days: [1],
      allDay: ['lodging', 'motoRental', 'equipmentRental'].includes(item.category),
      startTime: '09:00', endTime: '17:00', rateType: 'daily', customPrice: 0, splitType: 'personal'
    };
    setEditingSelection(newSel);
    setEditForm({ days: [1], allDay: newSel.allDay, startTime: '09:00', endTime: '17:00', rateType: 'daily', customPrice: 0, splitType: 'personal' });
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

  const removeSelection = (category: string, name: string) => {
    setSelections(prev => prev.filter(s => !(s.category === category && s.item.name === name)));
  };

  const isSelected = (item: GrokRecommendation) => selections.some(s => s.category === item.category && s.item.name === item.name);

  const calculateItemCost = (sel: ScheduledSelection): number => {
    const price = sel.customPrice || 0;
    const numDays = sel.days.length;
    switch (sel.rateType) {
      case 'monthly': return price;
      case 'weekly': return price * Math.ceil(numDays / 7);
      default: return price * numDays;
    }
  };

  const totalBudget = useMemo(() => selections.reduce((sum, sel) => sum + calculateItemCost(sel), 0), [selections]);

  useEffect(() => { if (onBudgetChange) onBudgetChange(totalBudget, selections, profile.groupSize); }, [totalBudget, selections, profile.groupSize]);

  const getProfileSummary = () => {
    const tripType = TRIP_TYPES.find(t => t.value === profile.tripType);
    const budget = BUDGET_OPTIONS.find(b => b.value === profile.budget);
    const acts = tripActivities.length > 0 ? ' • ' + tripActivities.slice(0, 3).join(', ') : '';
    return (tripType?.label || '') + ' • ' + (budget?.label || '') + (profile.groupSize > 1 ? ' • ' + profile.groupSize + ' people' : '') + acts;
  };

  const getSentimentColor = (s: string) => s === 'positive' ? 'bg-green-100 text-green-700' : s === 'negative' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700';
  const getScoreColor = (n: number) => n >= 8 ? 'text-green-600' : n >= 5 ? 'text-yellow-600' : 'text-red-600';

  const renderSentimentTable = (items: GrokRecommendation[]) => {
    if (!items?.length) return <p className="text-gray-400 text-sm py-4 px-4">No recommendations found</p>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="py-3 px-2 text-center w-10">+</th>
              <th className="py-3 px-2 text-center w-10">#</th>
              <th className="py-3 px-2 w-14">Photo</th>
              <th className="py-3 px-2 text-left">Vendor</th>
              <th className="py-3 px-2 text-center w-20">Sentiment</th>
              <th className="py-3 px-2 text-center w-14">Score</th>
              <th className="py-3 px-2 text-left max-w-[280px]">Summary</th>
              <th className="py-3 px-2 text-left max-w-[140px]">Warnings</th>
              <th className="py-3 px-2 text-center w-12">🔥</th>
              <th className="py-3 px-2 text-center w-14">Fit</th>
            </tr>
          </thead>
          <tbody>
            {items.map((rec, idx) => {
              const selected = isSelected(rec);
              return (
                <tr key={idx} className={selected ? 'bg-green-50' : idx % 2 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="py-2 px-2 text-center">
                    <button onClick={() => handleSelectItem(rec)} className={'w-7 h-7 rounded-full font-bold text-xs ' + (selected ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-blue-500 hover:text-white')}>
                      {selected ? '✓' : '+'}
                    </button>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={'inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ' + (rec.valueRank <= 3 ? 'bg-green-500 text-white' : rec.valueRank <= 6 ? 'bg-yellow-400 text-white' : 'bg-gray-300')}>{rec.valueRank}</span>
                  </td>
                  <td className="py-2 px-2">
                    {rec.photoUrl ? <img src={rec.photoUrl} alt="" className="w-12 h-12 object-cover rounded" /> : <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center text-gray-400 text-xs">📷</div>}
                  </td>
                  <td className="py-2 px-2">
                    <div className="font-medium text-gray-900">{rec.name}</div>
                    <div className="text-xs text-gray-500">⭐ {rec.googleRating} ({rec.reviewCount}) {rec.website && <a href={rec.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline ml-1">Visit →</a>}</div>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={'inline-block px-2 py-0.5 rounded-full text-xs font-medium ' + getSentimentColor(rec.sentiment)}>
                      {rec.sentiment === 'positive' ? '👍' : rec.sentiment === 'negative' ? '👎' : '😐'} {rec.sentiment}
                    </span>
                  </td>
                  <td className="py-2 px-2 text-center">
                    <span className={'text-lg font-bold ' + getScoreColor(rec.sentimentScore)}>{rec.sentimentScore}</span>
                    <span className="text-xs text-gray-400">/10</span>
                  </td>
                  <td className="py-2 px-2 text-xs text-gray-600 max-w-[280px]">
                    <div className="line-clamp-3">{rec.summary}</div>
                  </td>
                  <td className="py-2 px-2 text-xs max-w-[140px]">
                    {rec.warnings.length > 0 ? rec.warnings.slice(0, 2).map((w, i) => <div key={i} className="text-orange-600">⚠️ {w}</div>) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-2 px-2 text-center">{rec.trending ? <span title="Trending on X">🔥</span> : <span className="text-gray-300">—</span>}</td>
                  <td className="py-2 px-2 text-center">
                    <span className={'inline-block px-2 py-0.5 rounded text-xs font-bold ' + (rec.fitScore >= 8 ? 'bg-green-100 text-green-700' : rec.fitScore >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')}>{rec.fitScore}/10</span>
                  </td>
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
      {/* Profile Summary */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
        <div>
          <div className="text-sm font-medium text-purple-800">🤖 Grok AI Trip Planner</div>
          <div className="text-xs text-purple-600 mt-1">{getProfileSummary()}</div>
        </div>
        <button onClick={() => { setShowProfileModal(true); setProfileStep(1); }} className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700">✏️ Edit Profile</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="text-xs text-gray-500 block mb-1">⭐ Min Rating</label>
          <select value={minRating} onChange={e => setMinRating(+e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value={3.5}>3.5+</option><option value={4.0}>4.0+</option><option value={4.5}>4.5+</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">📊 Min Reviews</label>
          <select value={minReviews} onChange={e => setMinReviews(+e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value={10}>10+</option><option value={50}>50+</option><option value={100}>100+</option>
          </select>
        </div>
        <Button onClick={analyzeDestination} loading={loading} disabled={!city} className="flex-1">
          🔍 Analyze {city || 'Destination'} with Grok AI
        </Button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>}

      {loading && (
        <div className="text-center py-12">
          <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600 font-medium">Grok is analyzing {city}...</p>
          <p className="text-xs text-gray-400 mt-1">Searching X + web for real-time sentiment</p>
          <p className="text-xs text-gray-400">This may take 30-60 seconds</p>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg">🎯 Trip Profile</h3>
              <span className="text-sm text-gray-400">Step {profileStep}/3</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-6"><div className="bg-purple-600 h-2 rounded-full" style={{ width: (profileStep / 3) * 100 + '%' }} /></div>

            {profileStep === 1 && (
              <div className="space-y-4">
                <p className="text-gray-600">What kind of trip is this?</p>
                <div className="grid grid-cols-2 gap-3">
                  {TRIP_TYPES.map(opt => (
                    <button key={opt.value} onClick={() => setProfile(p => ({ ...p, tripType: opt.value as any }))} className={'p-4 rounded-xl border-2 text-left ' + (profile.tripType === opt.value ? 'border-purple-500 bg-purple-50' : 'border-gray-200')}>
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <div><label className="text-sm block mb-2">Group size</label>
                  <select value={profile.groupSize} onChange={e => setProfile(p => ({ ...p, groupSize: +e.target.value }))} className="border rounded-lg px-4 py-2 w-full">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
            )}

            {profileStep === 2 && (
              <div className="space-y-4">
                <p className="text-gray-600">Lodging budget per night?</p>
                <div className="space-y-2">
                  {BUDGET_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setProfile(p => ({ ...p, budget: opt.value as any }))} className={'w-full p-4 rounded-xl border-2 text-left ' + (profile.budget === opt.value ? 'border-purple-500 bg-purple-50' : 'border-gray-200')}>
                      <span className="font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {profileStep === 3 && (
              <div className="space-y-4">
                <p className="text-gray-600">What matters most? (up to 3)</p>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITY_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => {
                      if (profile.priorities.includes(opt.value)) setProfile(p => ({ ...p, priorities: p.priorities.filter(x => x !== opt.value) }));
                      else if (profile.priorities.length < 3) setProfile(p => ({ ...p, priorities: [...p.priorities, opt.value] }));
                    }} className={'p-3 rounded-xl border-2 ' + (profile.priorities.includes(opt.value) ? 'border-purple-500 bg-purple-50' : 'border-gray-200')}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 mt-6">
              {profileStep > 1 && <Button variant="secondary" onClick={() => setProfileStep(s => s - 1)} className="flex-1">← Back</Button>}
              {profileStep < 3 ? <Button onClick={() => setProfileStep(s => s + 1)} className="flex-1">Next →</Button> : <Button onClick={() => setShowProfileModal(false)} className="flex-1">✓ Save</Button>}
            </div>
          </div>
        </div>
      )}

      {/* Edit Selection Modal */}
      {editingSelection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="font-bold text-lg mb-1">{CATEGORY_INFO[editingSelection.category]?.icon} {editingSelection.item.name}</h3>
            <p className="text-sm text-gray-500 mb-4">Sentiment: {editingSelection.item.sentiment} ({editingSelection.item.sentimentScore}/10)</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">Rate Type</label>
                <div className="flex gap-2">
                  {(['daily', 'weekly', 'monthly'] as const).map(r => (
                    <button key={r} onClick={() => setEditForm(p => ({...p, rateType: r}))} className={'px-4 py-2 rounded text-sm font-medium ' + (editForm.rateType === r ? 'bg-purple-500 text-white' : 'bg-gray-100')}>{r}</button>
                  ))}
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <label className="text-sm font-medium">Days</label>
                  <div className="flex gap-2">
                    <button onClick={() => setEditForm(p => ({ ...p, days: [...tripDays] }))} className="text-xs px-2 py-1 bg-gray-100 rounded">All</button>
                    <button onClick={() => setEditForm(p => ({ ...p, days: [] }))} className="text-xs px-2 py-1 bg-gray-100 rounded">Clear</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tripDays.map(d => (
                    <button key={d} onClick={() => setEditForm(p => ({ ...p, days: p.days.includes(d) ? p.days.filter(x => x !== d) : [...p.days, d].sort((a,b) => a-b) }))}
                      className={'w-9 h-9 rounded text-sm font-medium ' + (editForm.days.includes(d) ? 'bg-purple-500 text-white' : 'bg-gray-100')}>{d}</button>
                  ))}
                </div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <div className="flex justify-between mb-2">
                  <span>Price ({editForm.rateType}):</span>
                  <input type="number" value={editForm.customPrice} onChange={e => setEditForm(f => ({ ...f, customPrice: +e.target.value }))} className="w-24 border rounded px-2 py-1 text-right" min={0} />
                </div>
                <div className="flex justify-between text-lg font-bold text-purple-700 border-t border-purple-200 pt-2 mt-2">
                  <span>Total:</span>
                  <span>${editForm.rateType === 'monthly' ? editForm.customPrice : editForm.rateType === 'weekly' ? editForm.customPrice * Math.ceil(editForm.days.length / 7) : editForm.customPrice * editForm.days.length}</span>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => setEditingSelection(null)} className="flex-1">Cancel</Button>
              <Button onClick={confirmSelection} className="flex-1" disabled={editForm.days.length === 0}>✓ Add</Button>
            </div>
          </div>
        </div>
      )}

      {/* Budget Summary */}
      {selections.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-xl p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-purple-800">🗺️ Trip Plan ({selections.length})</h3>
            <div className="text-2xl font-bold text-purple-700">${totalBudget.toLocaleString()}</div>
          </div>
          <div className="grid md:grid-cols-3 gap-3">
            {selections.map((sel, idx) => (
              <div key={idx} className="bg-white rounded-lg border p-3">
                <div className="flex justify-between">
                  <span>{CATEGORY_INFO[sel.category]?.icon} {CATEGORY_INFO[sel.category]?.label}</span>
                  <button onClick={() => removeSelection(sel.category, sel.item.name)} className="text-red-400 text-xs">✕</button>
                </div>
                <div className="font-medium text-sm truncate">{sel.item.name}</div>
                <div className="text-purple-600 font-medium">${calculateItemCost(sel).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {Object.keys(byCategory).length > 0 && !loading && (
        <div className="space-y-2">
          <h3 className="font-bold text-lg">📊 Grok Analysis ({recommendations.length} places)</h3>
          {Object.entries(byCategory).map(([cat, items]) => {
            const info = CATEGORY_INFO[cat] || { label: cat, icon: '📍' };
            const isOpen = expandedCategory === cat;
            return (
              <div key={cat} className="border rounded-lg">
                <button onClick={() => setExpandedCategory(isOpen ? null : cat)} className="w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100">
                  <span className="flex items-center gap-2"><span className="text-xl">{info.icon}</span><span className="font-medium">{info.label}</span></span>
                  <span className="flex items-center gap-2"><span className="text-xs bg-gray-200 px-2 py-1 rounded">{items.length}</span><span className={isOpen ? 'rotate-180' : ''}>▼</span></span>
                </button>
                {isOpen && renderSentimentTable(items)}
              </div>
            );
          })}
        </div>
      )}

      {!loading && Object.keys(byCategory).length === 0 && !error && (
        <div className="text-center py-12 text-gray-400">
          <div className="text-5xl mb-3">🤖</div>
          <p className="font-medium text-lg">Grok AI Trip Analyzer</p>
          <p className="text-sm">Select a destination, then let Grok search X + web for real-time sentiment</p>
        </div>
      )}
    </div>
  );
}
