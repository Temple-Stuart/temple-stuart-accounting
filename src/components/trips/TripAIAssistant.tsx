'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui';

interface Recommendation {
  name: string;
  address: string;
  website: string;
  price: string;
  whyViral: string;
  socialProof: string;
  viralScore: number;
}

interface AIResponse {
  coworking: Recommendation[];
  hotels: Recommendation[];
  equipmentRental: Recommendation[];
  motorcycleRental: Recommendation[];
  brunchCoffee: Recommendation[];
  dinner: Recommendation[];
  activities: Recommendation[];
}

type CategoryKey = keyof AIResponse;

interface ScheduledSelection {
  category: CategoryKey;
  item: Recommendation;
  // For daily items
  days?: number[];        // Which days (can be multiple for repeat visits)
  time?: string;          // Time slot
  quantity?: number;      // How many times total
}

interface Props {
  tripId: string;
  city: string | null;
  country: string | null;
  activity: string | null;
  month: number;
  year: number;
  daysTravel: number;
}

// Categories with billing type
const CATEGORIES: { key: CategoryKey; label: string; subtitle: string; icon: string; billing: 'monthly' | 'daily' }[] = [
  { key: 'coworking', label: 'Co-Working Spaces', subtitle: 'Viral-worthy workspaces', icon: '🏢', billing: 'monthly' },
  { key: 'hotels', label: 'Hotels & Resorts', subtitle: 'Near coworking, photogenic', icon: '🏨', billing: 'monthly' },
  { key: 'equipmentRental', label: 'Equipment Rental', subtitle: 'Activity-specific gear', icon: '🏄', billing: 'monthly' },
  { key: 'motorcycleRental', label: 'Motorcycle Rental', subtitle: 'Scooters & bikes', icon: '🏍️', billing: 'monthly' },
  { key: 'brunchCoffee', label: 'Brunch & Coffee', subtitle: 'Aesthetic cafes nearby', icon: '☕', billing: 'daily' },
  { key: 'dinner', label: 'Dinner Spots', subtitle: 'Top-rated, content-worthy', icon: '🍽️', billing: 'daily' },
  { key: 'activities', label: 'Activities', subtitle: 'Within 1hr, viral experiences', icon: '🎯', billing: 'daily' },
];

const TIME_SLOTS = [
  '07:00', '08:00', '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00', '17:00', '18:00',
  '19:00', '20:00', '21:00', '22:00'
];

export default function TripAIAssistant({ tripId, city, country, activity, month, year, daysTravel }: Props) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('coworking');
  
  // Budget controls
  const [budgetLevel, setBudgetLevel] = useState<'low' | 'mid' | 'high'>('mid');
  const [budgetTiers, setBudgetTiers] = useState({ low: 1250, mid: 2000, high: 2500 });
  
  // Party size
  const [partySize, setPartySize] = useState(1);
  
  // Scheduled selections
  const [selections, setSelections] = useState<ScheduledSelection[]>([]);
  
  // Modal for scheduling daily items
  const [schedulingItem, setSchedulingItem] = useState<{ category: CategoryKey; item: Recommendation } | null>(null);
  const [scheduleForm, setScheduleForm] = useState<{ days: number[]; time: string; quantity: number }>({
    days: [1],
    time: '12:00',
    quantity: 1
  });

  // Map state
  const [MapContainer, setMapContainer] = useState<any>(null);
  const [TileLayer, setTileLayer] = useState<any>(null);
  const [Marker, setMarker] = useState<any>(null);
  const [Popup, setPopup] = useState<any>(null);
  const [L, setL] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  // Load Leaflet dynamically
  useEffect(() => {
    setMounted(true);
    import('react-leaflet').then((mod) => {
      setMapContainer(() => mod.MapContainer);
      setTileLayer(() => mod.TileLayer);
      setMarker(() => mod.Marker);
      setPopup(() => mod.Popup);
    });
    import('leaflet').then((leaflet) => {
      setL(leaflet.default);
    });
  }, []);

  const tripDays = Array.from({ length: daysTravel }, (_, i) => i + 1);

  const analyzeDestination = async () => {
    if (!city || !country) {
      setError('Please select a destination first');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/trips/${tripId}/ai-assistant`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          city, 
          country, 
          activity, 
          month, 
          year, 
          budgetLevel,
          budgetTiers,
          partySize
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to get recommendations');
      }

      const data = await res.json();
      setRecommendations(data.recommendations);
      setSelections([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryInfo = (key: CategoryKey) => CATEGORIES.find(c => c.key === key);

  const handleSelectItem = (category: CategoryKey, item: Recommendation) => {
    const catInfo = getCategoryInfo(category);
    
    if (catInfo?.billing === 'daily') {
      // Open scheduling modal for daily items
      setSchedulingItem({ category, item });
      setScheduleForm({ days: [1], time: '12:00', quantity: 1 });
    } else {
      // Monthly items - direct add/toggle
      toggleMonthlySelection(category, item);
    }
  };

  const toggleMonthlySelection = (category: CategoryKey, item: Recommendation) => {
    setSelections(prev => {
      const existing = prev.find(s => s.category === category && s.item.name === item.name);
      if (existing) {
        return prev.filter(s => !(s.category === category && s.item.name === item.name));
      }
      const filtered = prev.filter(s => s.category !== category);
      return [...filtered, { category, item }];
    });
  };

  const confirmDailySchedule = () => {
    if (!schedulingItem) return;
    
    const { category, item } = schedulingItem;
    
    setSelections(prev => {
      // Check if same item already scheduled
      const existingIdx = prev.findIndex(s => s.category === category && s.item.name === item.name);
      
      const newSelection: ScheduledSelection = {
        category,
        item,
        days: scheduleForm.days,
        time: scheduleForm.time,
        quantity: scheduleForm.quantity
      };
      
      if (existingIdx >= 0) {
        // Update existing
        const updated = [...prev];
        updated[existingIdx] = newSelection;
        return updated;
      }
      
      return [...prev, newSelection];
    });
    
    setSchedulingItem(null);
  };

  const removeSelection = (category: CategoryKey, itemName: string) => {
    setSelections(prev => prev.filter(s => !(s.category === category && s.item.name === itemName)));
  };

  const isSelected = (category: CategoryKey, item: Recommendation) => {
    return selections.some(s => s.category === category && s.item.name === item.name);
  };

  const toggleDay = (day: number) => {
    setScheduleForm(prev => ({
      ...prev,
      days: prev.days.includes(day) 
        ? prev.days.filter(d => d !== day)
        : [...prev.days, day].sort((a, b) => a - b)
    }));
  };

  // Parse price string to number
  const parsePrice = (priceStr: string): number => {
    const match = priceStr.match(/\$?([\d,]+)/);
    if (match) {
      return parseFloat(match[1].replace(',', ''));
    }
    return 0;
  };

  // Calculate budget projection
  const calculateBudget = () => {
    let monthlyTotal = 0;
    let dailyTotal = 0;
    
    selections.forEach(sel => {
      const catInfo = getCategoryInfo(sel.category);
      const price = parsePrice(sel.item.price);
      
      if (catInfo?.billing === 'monthly') {
        monthlyTotal += price;
      } else {
        // Daily items × quantity
        dailyTotal += price * (sel.quantity || 1);
      }
    });
    
    return { monthlyTotal, dailyTotal, total: monthlyTotal + dailyTotal };
  };

  const budget = calculateBudget();

  const renderTable = (categoryKey: CategoryKey, items: Recommendation[]) => {
    if (!items || items.length === 0) {
      return <p className="text-gray-400 text-sm py-4">No recommendations found</p>;
    }

    const catInfo = getCategoryInfo(categoryKey);

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-center py-3 px-2 font-semibold w-16">Select</th>
              <th className="text-center py-3 px-2 font-semibold w-16">Score</th>
              <th className="text-left py-3 px-4 font-semibold">Name</th>
              <th className="text-left py-3 px-4 font-semibold">Address</th>
              <th className="text-left py-3 px-4 font-semibold">Website</th>
              <th className="text-right py-3 px-4 font-semibold">
                Price {catInfo?.billing === 'monthly' ? '(/mo)' : '(/visit)'}
              </th>
              <th className="text-left py-3 px-4 font-semibold">Why Viral</th>
              <th className="text-left py-3 px-4 font-semibold">Social Proof</th>
            </tr>
          </thead>
          <tbody>
            {items.map((rec, idx) => {
              const selected = isSelected(categoryKey, rec);
              return (
                <tr 
                  key={idx} 
                  className={`border-b border-gray-100 ${selected ? 'bg-green-50' : idx % 2 === 1 ? 'bg-gray-50' : ''}`}
                >
                  <td className="py-3 px-2 text-center">
                    <button
                      onClick={() => handleSelectItem(categoryKey, rec)}
                      className={`w-8 h-8 rounded-full font-bold transition-colors ${
                        selected 
                          ? 'bg-green-500 text-white' 
                          : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      }`}
                    >
                      {selected ? '✓' : '+'}
                    </button>
                  </td>
                  <td className="py-3 px-2 text-center">
                    <span className={`inline-flex items-center justify-center w-10 h-6 rounded text-xs font-bold ${
                      rec.viralScore >= 80 ? 'bg-green-100 text-green-700' :
                      rec.viralScore >= 60 ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {rec.viralScore || '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900">{rec.name}</td>
                  <td className="py-3 px-4 text-gray-600 text-xs max-w-[150px]">{rec.address}</td>
                  <td className="py-3 px-4">
                    {rec.website && rec.website !== 'N/A' ? (
                      <a href={rec.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                        Visit →
                      </a>
                    ) : <span className="text-gray-400 text-xs">—</span>}
                  </td>
                  <td className="py-3 px-4 text-right font-medium text-green-600 whitespace-nowrap">{rec.price}</td>
                  <td className="py-3 px-4 text-gray-600 text-xs max-w-[180px]">{rec.whyViral}</td>
                  <td className="py-3 px-4 text-gray-500 text-xs max-w-[180px]">{rec.socialProof}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Simple geocoding simulation - in production, use a real geocoding API
  const getLatLng = (address: string, idx: number): [number, number] | null => {
    // Default to spreading around the general area
    // In production, you'd use Google Geocoding API or similar
    const baseLatLng: Record<string, [number, number]> = {
      'Canggu': [-8.6478, 115.1385],
      'Bali': [-8.4095, 115.1889],
      'default': [0, 0]
    };
    
    const base = baseLatLng[city || ''] || baseLatLng['default'];
    // Spread markers slightly
    return [base[0] + (idx * 0.002), base[1] + (idx * 0.003)];
  };

  return (
    <div className="space-y-6">
      {/* Controls Row */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 pb-4 border-b border-gray-200">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Budget Level</label>
          <select
            value={budgetLevel}
            onChange={(e) => setBudgetLevel(e.target.value as 'low' | 'mid' | 'high')}
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="low">💰 Budget (${budgetTiers.low}/mo)</option>
            <option value="mid">💰💰 Mid (${budgetTiers.mid}/mo)</option>
            <option value="high">💰💰💰 Premium (${budgetTiers.high}/mo)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Hotel Budget Tiers ($/mo)</label>
          <div className="flex gap-1">
            <input type="number" value={budgetTiers.low} onChange={(e) => setBudgetTiers(prev => ({ ...prev, low: Number(e.target.value) }))}
              className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-2 text-xs" placeholder="$" />
            <input type="number" value={budgetTiers.mid} onChange={(e) => setBudgetTiers(prev => ({ ...prev, mid: Number(e.target.value) }))}
              className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-2 text-xs" placeholder="$$" />
            <input type="number" value={budgetTiers.high} onChange={(e) => setBudgetTiers(prev => ({ ...prev, high: Number(e.target.value) }))}
              className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-2 text-xs" placeholder="$$$" />
          </div>
        </div>

        <div>
          <label className="block text-xs text-gray-500 mb-1">Party Size</label>
          <select value={partySize} onChange={(e) => setPartySize(Number(e.target.value))}
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm">
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
            ))}
          </select>
        </div>

        <div className="flex items-end">
          <Button onClick={analyzeDestination} loading={loading} disabled={!city || !country} className="w-full">
            🤖 Analyze Destination
          </Button>
        </div>
      </div>

      {/* Context Info */}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500">
        <span><strong>📍</strong> {city || 'Select destination'}, {country || '—'}</span>
        <span><strong>🎯</strong> {activity || 'General'}</span>
        <span><strong>👥</strong> {partySize} {partySize === 1 ? 'traveler' : 'travelers'}</span>
        <span><strong>📅</strong> {daysTravel} days</span>
        <span><strong>💰</strong> ${budgetTiers[budgetLevel]}/mo max lodging</span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-3 border-[#b4b237] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Analyzing {city} for viral content opportunities...</p>
        </div>
      )}

      {/* Scheduling Modal */}
      {schedulingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl">
            <h3 className="text-lg font-bold mb-4">📅 Schedule: {schedulingItem.item.name}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Which days? (select multiple for repeat visits)</label>
                <div className="flex flex-wrap gap-2">
                  {tripDays.map(day => (
                    <button
                      key={day}
                      onClick={() => toggleDay(day)}
                      className={`w-10 h-10 rounded-lg font-medium text-sm transition-colors ${
                        scheduleForm.days.includes(day)
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {day}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">{scheduleForm.days.length} day(s) selected</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                <select
                  value={scheduleForm.time}
                  onChange={(e) => setScheduleForm(prev => ({ ...prev, time: e.target.value }))}
                  className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
                >
                  {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-sm text-gray-600">
                  <strong>Price:</strong> {schedulingItem.item.price} × {scheduleForm.days.length} visits = 
                  <span className="text-green-600 font-bold ml-1">
                    ${(parsePrice(schedulingItem.item.price) * scheduleForm.days.length).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={() => setSchedulingItem(null)} variant="secondary" className="flex-1">Cancel</Button>
              <Button onClick={confirmDailySchedule} className="flex-1" disabled={scheduleForm.days.length === 0}>
                ✓ Add to Itinerary
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Your Trip Plan - Selected Cards + Map */}
      {selections.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-green-800">🗺️ Your Trip Plan ({selections.length} selections)</h3>
            <div className="text-right">
              <div className="text-xs text-gray-500">Projected Budget</div>
              <div className="text-xl font-bold text-green-700">${budget.total.toLocaleString()}</div>
              <div className="text-xs text-gray-500">
                ${budget.monthlyTotal.toLocaleString()} monthly + ${budget.dailyTotal.toLocaleString()} activities
              </div>
            </div>
          </div>

          {/* Map */}
          {mounted && MapContainer && TileLayer && Marker && Popup && L && (
            <div className="mb-4 rounded-lg overflow-hidden border border-green-200" style={{ height: '250px' }}>
              <MapContainer
                center={[-8.6478, 115.1385]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; OpenStreetMap'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {selections.map((sel, idx) => {
                  const latLng = getLatLng(sel.item.address, idx);
                  if (!latLng) return null;
                  const catInfo = getCategoryInfo(sel.category);
                  return (
                    <Marker key={`${sel.category}-${sel.item.name}`} position={latLng}>
                      <Popup>
                        <div className="text-sm">
                          <div className="font-bold">{catInfo?.icon} {sel.item.name}</div>
                          <div className="text-xs text-gray-500">{sel.item.address}</div>
                          <div className="text-green-600 font-medium">{sel.item.price}</div>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}
              </MapContainer>
            </div>
          )}

          {/* Selection Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {selections.map((sel, idx) => {
              const catInfo = getCategoryInfo(sel.category);
              const isDaily = catInfo?.billing === 'daily';
              return (
                <div key={idx} className="bg-white rounded-lg p-3 shadow-sm border border-green-100">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-lg">{catInfo?.icon}</span>
                    <button onClick={() => removeSelection(sel.category, sel.item.name)} className="text-red-400 hover:text-red-600 text-xs">
                      ✕ Remove
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">{catInfo?.label}</div>
                  <div className="font-medium text-gray-900 text-sm mb-1">{sel.item.name}</div>
                  <div className="text-green-600 font-medium text-sm">
                    {sel.item.price}
                    {isDaily && sel.days && sel.days.length > 0 && (
                      <span className="text-gray-500 font-normal"> × {sel.days.length}</span>
                    )}
                  </div>
                  {isDaily && sel.days && (
                    <div className="text-xs text-gray-500 mt-1">
                      Days: {sel.days.join(', ')} @ {sel.time}
                    </div>
                  )}
                  {sel.item.website && sel.item.website !== 'N/A' && (
                    <a href={sel.item.website} target="_blank" rel="noopener noreferrer"
                      className="text-blue-500 text-xs hover:underline mt-1 block">
                      Visit website →
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Results - Accordion Style */}
      {recommendations && !loading && (
        <div className="space-y-3">
          {CATEGORIES.map(({ key, label, subtitle, icon, billing }) => {
            const items = recommendations[key];
            const isExpanded = expandedCategory === key;
            const hasSelection = selections.some(s => s.category === key);
            
            return (
              <div key={key} className={`border rounded-lg overflow-hidden ${hasSelection ? 'border-green-300 bg-green-50/30' : 'border-gray-200'}`}>
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : key)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="text-left flex items-center gap-2">
                    <span className="text-xl">{icon}</span>
                    <div>
                      <span className="font-medium text-gray-900">{label}</span>
                      <span className="text-xs text-gray-500 ml-2">{subtitle}</span>
                      <span className={`ml-2 text-xs px-2 py-0.5 rounded ${billing === 'monthly' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                        {billing}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasSelection && <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">Selected</span>}
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">{items?.length || 0} spots</span>
                    <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </div>
                </button>
                {isExpanded && renderTable(key, items)}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {!loading && !recommendations && !error && (
        <div className="text-center py-8 text-gray-400">
          <div className="text-4xl mb-2">🎬</div>
          <p className="font-medium">Viral Content Scout</p>
          <p className="text-sm mt-1">Find the most TikTok/Instagram/YouTube-worthy spots</p>
        </div>
      )}
    </div>
  );
}
