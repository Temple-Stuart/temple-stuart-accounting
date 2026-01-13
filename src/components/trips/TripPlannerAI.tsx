'use client';

import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui';

interface Recommendation {
  name: string;
  address: string;
  website: string;
  rating: number;
  reviewCount: number;
  estimatedPrice: string;
  valueRank: number;
  fitScore: number;
  whyThisTraveler: string;
  warning: string | null;
  photoWorthy: string;
  photoUrl?: string;
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

// NEW: Trip-type focused profile
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
  month: number;
  year: number;
  daysTravel: number;
  onBudgetChange?: (total: number, items: ScheduledSelection[]) => void;
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
  { value: 'best_value', label: '💰 Best Value', desc: 'Quality ÷ price' },
  { value: 'location', label: '📍 Location', desc: 'Central, walkable' },
  { value: 'instagrammable', label: '📸 Unique/Photogenic', desc: 'Instagram-worthy' },
  { value: 'quiet', label: '🤫 Quiet/Peaceful', desc: 'Relaxing atmosphere' },
  { value: 'social', label: '🎉 Social Scene', desc: 'Meet people' },
  { value: 'amenities', label: '🏊 Pool/Amenities', desc: 'Extras matter' },
  { value: 'kitchen', label: '🍳 Kitchen', desc: 'Self-catering' },
  { value: 'wifi', label: '📶 Fast Wifi', desc: 'Work-ready' },
  { value: 'family_friendly', label: '👶 Family-Friendly', desc: 'Kid-safe' },
  { value: 'eco', label: '🌱 Eco-Friendly', desc: 'Sustainable' },
];

const DEALBREAKER_OPTIONS = [
  { value: 'party_scene', label: '🚫 Party/Loud', desc: 'No rowdy atmosphere' },
  { value: 'remote', label: '🚫 Remote/Isolated', desc: 'Need accessibility' },
  { value: 'shared_rooms', label: '🚫 Shared Rooms', desc: 'Private only' },
  { value: 'no_ac', label: '🚫 No AC', desc: 'Need climate control' },
  { value: 'no_transit', label: '🚫 No Transit', desc: 'Need transport access' },
];

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
  
  const [minRating, setMinRating] = useState(4.0);
  const [minReviews, setMinReviews] = useState(50);
  
  const [selections, setSelections] = useState<ScheduledSelection[]>([]);
  
  const [editingSelection, setEditingSelection] = useState<ScheduledSelection | null>(null);
  const [editForm, setEditForm] = useState<{ days: number[]; allDay: boolean; startTime: string; endTime: string; rateType: 'daily' | 'weekly' | 'monthly'; customPrice: number }>({
    days: [], allDay: true, startTime: '09:00', endTime: '17:00', rateType: 'daily', customPrice: 0
  });
  
  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStart, setRangeStart] = useState<number | null>(null);

  // Profile state
  const [profile, setProfile] = useState<TravelerProfile>(DEFAULT_PROFILE);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileStep, setProfileStep] = useState(1);

  const tripDays = Array.from({ length: daysTravel }, (_, i) => i + 1);

  const analyzeDestination = async () => {
    if (!city || !country) { setError('Please select a destination first'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/trips/' + tripId + '/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          city, country, activity, month, year, daysTravel, 
          minRating, minReviews,
          profile
        })
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
      case 'monthly': return price;
      case 'weekly': return price * Math.ceil(numDays / 7);
      case 'daily': default: return price * numDays;
    }
  };

  const totalBudget = useMemo(() => {
    return selections.reduce((sum, sel) => sum + calculateItemCost(sel), 0);
  }, [selections]);

  useEffect(() => {
    if (onBudgetChange) onBudgetChange(totalBudget, selections);
  }, [totalBudget, selections]);

  const toggleArrayItem = (arr: string[], item: string) => 
    arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item];

  const getProfileSummary = () => {
    const tripType = TRIP_TYPES.find(t => t.value === profile.tripType);
    const budget = BUDGET_OPTIONS.find(b => b.value === profile.budget);
    return tripType?.label + ' • ' + budget?.label + (profile.groupSize > 1 ? ' • ' + profile.groupSize + ' people' : '');
  };

  const renderTable = (categoryKey: CategoryKey, items: Recommendation[]) => {
    if (!items?.length) return <p className="text-gray-400 text-sm py-4 px-4">No recommendations found</p>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-800 text-white">
              <th className="py-2 px-3 text-center w-14">Add</th>
              <th className="py-2 px-3 text-center w-14">Rank</th>
              <th className="py-2 px-3 text-center w-14">Fit</th>
              <th className="py-2 px-3 text-left">Name</th>
              <th className="py-2 px-3 text-left">Address</th>
              <th className="py-2 px-3 text-left">Website</th>
              <th className="py-2 px-3 text-right">Est. Price</th>
              <th className="py-2 px-3 text-left max-w-[300px]">Why For You</th>
              <th className="py-2 px-3 text-left max-w-[150px]">⚠️</th>
            </tr>
          </thead>
          <tbody>
            {items.map((rec, idx) => {
              const selected = isSelected(categoryKey, rec);
              return (
                <tr key={idx} className={selected ? 'bg-green-50' : idx % 2 ? 'bg-gray-50' : ''}>
                  <td className="py-2 px-3 text-center">
                    <button onClick={() => handleSelectItem(categoryKey, rec)}
                      className={'w-7 h-7 rounded-full font-bold text-sm ' + (selected ? 'bg-green-500 text-white' : 'bg-gray-200 hover:bg-gray-300')}>
                      {selected ? '✓' : '+'}
                    </button>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={'text-xs font-bold px-2 py-1 rounded ' + (rec.valueRank <= 3 ? 'bg-green-100 text-green-700' : rec.valueRank <= 6 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100')}>
                      #{rec.valueRank}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-center">
                    <span className={'text-xs font-bold px-2 py-1 rounded ' + (rec.fitScore >= 8 ? 'bg-green-100 text-green-700' : rec.fitScore >= 5 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')}>
                      {rec.fitScore}/10
                    </span>
                  </td>
                  <td className="py-2 px-3 font-medium">
                    {rec.name}
                    <div className="text-xs text-gray-400">⭐ {rec.rating} ({rec.reviewCount})</div>
                  </td>
                  <td className="py-2 px-3 text-xs text-gray-500 max-w-[200px] whitespace-normal">{rec.address}</td>
                  <td className="py-2 px-3">{rec.website && rec.website !== "N/A" ? <a href={rec.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">Visit →</a> : <span className="text-gray-400 text-xs">—</span>}</td>
                  <td className="py-2 px-3 text-right text-green-600 font-medium whitespace-nowrap">{rec.estimatedPrice}</td>
                  <td className="py-2 px-3 text-xs text-gray-600 max-w-[300px] whitespace-normal">{rec.whyThisTraveler}</td>
                  <td className="py-2 px-3 text-xs text-orange-600 max-w-[150px] whitespace-normal">{rec.warning || '—'}</td>
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
      {/* Profile Summary + Setup Button */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
        <div>
          <div className="text-sm font-medium text-blue-800">🎯 Your Trip Profile</div>
          <div className="text-xs text-blue-600 mt-1">{getProfileSummary()}</div>
        </div>
        <button 
          onClick={() => { setShowProfileModal(true); setProfileStep(1); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          ✏️ Edit Profile
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4 p-4 bg-gray-50 rounded-lg">
        <div>
          <label className="text-xs text-gray-500 block mb-1">⭐ Min Rating</label>
          <select value={minRating} onChange={e => setMinRating(+e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value={3.5}>3.5+</option>
            <option value={4.0}>4.0+</option>
            <option value={4.5}>4.5+</option>
          </select>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">📊 Min Reviews</label>
          <select value={minReviews} onChange={e => setMinReviews(+e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value={10}>10+</option>
            <option value={50}>50+</option>
            <option value={100}>100+</option>
            <option value={500}>500+</option>
          </select>
        </div>
        <Button onClick={analyzeDestination} loading={loading} disabled={!city} className="flex-1">
          🔍 Find Best Value in {city || 'Destination'}
        </Button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">{error}</div>}

      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Finding best value spots in {city}...</p>
          <p className="text-xs text-gray-400 mt-1">Analyzing {profile.tripType} options within your budget</p>
        </div>
      )}

      {/* Profile Modal */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg">🎯 Tell Us About Your Trip</h3>
              <span className="text-sm text-gray-400">Step {profileStep}/4</span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
              <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: (profileStep / 4) * 100 + '%' }} />
            </div>

            {/* Step 1: Trip Type */}
            {profileStep === 1 && (
              <div className="space-y-4">
                <p className="text-gray-600">What kind of trip is this?</p>
                <div className="grid grid-cols-2 gap-3">
                  {TRIP_TYPES.map(opt => (
                    <button key={opt.value} onClick={() => setProfile(p => ({ ...p, tripType: opt.value as any }))}
                      className={'p-4 rounded-xl border-2 text-left transition-all ' + (profile.tripType === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300')}>
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <div className="mt-4">
                  <label className="text-sm text-gray-600 block mb-2">How many people?</label>
                  <select value={profile.groupSize} onChange={e => setProfile(p => ({ ...p, groupSize: +e.target.value }))}
                    className="border rounded-lg px-4 py-2 w-full">
                    {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>)}
                  </select>
                </div>
              </div>
            )}

            {/* Step 2: Budget */}
            {profileStep === 2 && (
              <div className="space-y-4">
                <p className="text-gray-600">What's your lodging budget per night?</p>
                <div className="space-y-2">
                  {BUDGET_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setProfile(p => ({ ...p, budget: opt.value as any }))}
                      className={'w-full p-4 rounded-xl border-2 text-left transition-all ' + (profile.budget === opt.value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300')}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">{opt.label}</span>
                        <span className="text-xs text-gray-500">{opt.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 3: Priorities */}
            {profileStep === 3 && (
              <div className="space-y-4">
                <p className="text-gray-600">What matters most? (Select up to 3)</p>
                <div className="grid grid-cols-2 gap-2">
                  {PRIORITY_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => {
                      if (profile.priorities.includes(opt.value)) {
                        setProfile(p => ({ ...p, priorities: p.priorities.filter(x => x !== opt.value) }));
                      } else if (profile.priorities.length < 3) {
                        setProfile(p => ({ ...p, priorities: [...p.priorities, opt.value] }));
                      }
                    }}
                      className={'p-3 rounded-xl border-2 text-left transition-all ' + (profile.priorities.includes(opt.value) ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300')}>
                      <div className="font-medium text-sm">{opt.label}</div>
                      <div className="text-xs text-gray-500">{opt.desc}</div>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">{profile.priorities.length}/3 selected</p>
              </div>
            )}

            {/* Step 4: Dealbreakers */}
            {profileStep === 4 && (
              <div className="space-y-4">
                <p className="text-gray-600">Any dealbreakers? (Optional)</p>
                <div className="space-y-2">
                  {DEALBREAKER_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setProfile(p => ({ ...p, dealbreakers: toggleArrayItem(p.dealbreakers, opt.value) }))}
                      className={'w-full p-3 rounded-xl border-2 text-left transition-all ' + (profile.dealbreakers.includes(opt.value) ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300')}>
                      <div className="flex justify-between items-center">
                        <span className="font-medium text-sm">{opt.label}</span>
                        <span className="text-xs text-gray-500">{opt.desc}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 mt-6">
              {profileStep > 1 && (
                <Button variant="secondary" onClick={() => setProfileStep(s => s - 1)} className="flex-1">
                  ← Back
                </Button>
              )}
              {profileStep < 4 ? (
                <Button onClick={() => setProfileStep(s => s + 1)} className="flex-1">
                  Next →
                </Button>
              ) : (
                <Button onClick={() => setShowProfileModal(false)} className="flex-1">
                  ✓ Save & Search
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Selection Modal */}
      {editingSelection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-1">{getCatInfo(editingSelection.category)?.icon} {editingSelection.item.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{editingSelection.item.estimatedPrice}</p>
            
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                <input type="checkbox" checked={editForm.allDay} onChange={e => setEditForm(p => ({ ...p, allDay: e.target.checked }))} className="w-5 h-5 rounded" />
                <div>
                  <span className="font-medium">All Day</span>
                  <p className="text-xs text-gray-500">No specific times</p>
                </div>
              </label>

              <div>
                <label className="text-sm font-medium block mb-2">💰 Rate Type</label>
                <div className="flex gap-2">
                  {(['daily', 'weekly', 'monthly'] as const).map(rate => (
                    <button key={rate} onClick={() => setEditForm(p => ({...p, rateType: rate}))}
                      className={'px-4 py-2 rounded text-sm font-medium ' + (editForm.rateType === rate ? 'bg-green-500 text-white' : 'bg-gray-100 hover:bg-gray-200')}>
                      {rate === 'daily' ? '📅 Daily' : rate === 'weekly' ? '📆 Weekly' : '🗓️ Monthly'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">Select Days</label>
                  <div className="flex gap-2">
                    <button onClick={() => setRangeMode(!rangeMode)} className={'text-xs px-2 py-1 rounded ' + (rangeMode ? 'bg-blue-500 text-white' : 'bg-gray-100')}>
                      {rangeMode ? (rangeStart ? 'Start: Day ' + rangeStart : 'Pick start') : 'Range'}
                    </button>
                    <button onClick={selectAllDays} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">All</button>
                    <button onClick={clearDays} className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200">Clear</button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tripDays.map(d => (
                    <button key={d} onClick={() => handleDayClick(d)}
                      className={'w-10 h-10 rounded text-sm font-medium transition-colors ' + (editForm.days.includes(d) ? 'bg-green-500 text-white' : rangeStart === d ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200')}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {!editForm.allDay && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-2">Start Time</label>
                    <select value={editForm.startTime} onChange={e => setEditForm(p => ({...p, startTime: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-2">End Time</label>
                    <select value={editForm.endTime} onChange={e => setEditForm(p => ({...p, endTime: e.target.value}))} className="w-full border rounded-lg px-3 py-2 text-sm">
                      {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div className="bg-green-50 rounded-lg p-3 text-sm border border-green-200">
                <div className="flex justify-between mb-2">
                  <span>Your price ({editForm.rateType}):</span>
                  <input type="number" value={editForm.customPrice} onChange={e => setEditForm(f => ({ ...f, customPrice: +e.target.value }))}
                    className="w-24 border rounded px-2 py-1 text-right font-medium" min={0} placeholder="0" />
                </div>
                <div className="flex justify-between text-lg font-bold text-green-700 border-t border-green-200 mt-2 pt-2">
                  <span>Total:</span>
                  <span>${editForm.rateType === 'monthly' ? editForm.customPrice : editForm.rateType === 'weekly' ? editForm.customPrice * Math.ceil(editForm.days.length / 7) : editForm.customPrice * editForm.days.length}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button variant="secondary" onClick={() => setEditingSelection(null)} className="flex-1">Cancel</Button>
              <Button onClick={confirmSelection} className="flex-1" disabled={editForm.days.length === 0}>✓ Add to Plan</Button>
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
                    Days: {sel.days.length > 5 ? sel.days[0] + '-' + sel.days[sel.days.length-1] : sel.days.join(', ')}
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
              <div key={key} className={'border rounded-lg ' + (hasSel ? 'border-green-300' : 'border-gray-200')}>
                <button onClick={() => setExpandedCategory(isOpen ? null : key)}
                  className="w-full flex justify-between items-center px-4 py-3 bg-gray-50 hover:bg-gray-100">
                  <span className="flex items-center gap-2">
                    <span className="text-xl">{icon}</span>
                    <span className="font-medium">{label}</span>
                    {hasSel && <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded">✓</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">{items?.length || 0}</span>
                    <span className={'transition-transform ' + (isOpen ? 'rotate-180' : '')}>▼</span>
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
          <div className="text-5xl mb-3">🔍</div>
          <p className="font-medium text-lg">AI Value Finder</p>
          <p className="text-sm">Set your trip profile, select a destination, then click Search</p>
        </div>
      )}
    </div>
  );
}
