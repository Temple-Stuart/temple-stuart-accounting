'use client';

import { useState } from 'react';
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

interface Selection {
  category: CategoryKey;
  item: Recommendation;
}

interface Props {
  tripId: string;
  city: string | null;
  country: string | null;
  activity: string | null;
  month: number;
  year: number;
}

const CATEGORIES: { key: CategoryKey; label: string; subtitle: string; icon: string }[] = [
  { key: 'coworking', label: 'Co-Working Spaces', subtitle: 'Viral-worthy workspaces', icon: '🏢' },
  { key: 'hotels', label: 'Hotels & Resorts', subtitle: 'Near coworking, photogenic', icon: '🏨' },
  { key: 'equipmentRental', label: 'Equipment Rental', subtitle: 'Activity-specific gear', icon: '🏄' },
  { key: 'motorcycleRental', label: 'Motorcycle Rental', subtitle: 'Scooters & bikes', icon: '🏍️' },
  { key: 'brunchCoffee', label: 'Brunch & Coffee', subtitle: 'Aesthetic cafes nearby', icon: '☕' },
  { key: 'dinner', label: 'Dinner Spots', subtitle: 'Top-rated, content-worthy', icon: '🍽️' },
  { key: 'activities', label: 'Activities', subtitle: 'Within 1hr, viral experiences', icon: '🎯' },
];

export default function TripAIAssistant({ tripId, city, country, activity, month, year }: Props) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('coworking');
  
  // Budget controls
  const [budgetLevel, setBudgetLevel] = useState<'low' | 'mid' | 'high'>('mid');
  const [budgetTiers, setBudgetTiers] = useState({ low: 1250, mid: 2000, high: 2500 });
  
  // Party size
  const [partySize, setPartySize] = useState(1);
  
  // Selections for building trip plan
  const [selections, setSelections] = useState<Selection[]>([]);

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
      setSelections([]); // Clear previous selections
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleSelection = (category: CategoryKey, item: Recommendation) => {
    setSelections(prev => {
      const existing = prev.find(s => s.category === category && s.item.name === item.name);
      if (existing) {
        return prev.filter(s => !(s.category === category && s.item.name === item.name));
      }
      // Replace existing selection in same category or add new
      const filtered = prev.filter(s => s.category !== category);
      return [...filtered, { category, item }];
    });
  };

  const isSelected = (category: CategoryKey, item: Recommendation) => {
    return selections.some(s => s.category === category && s.item.name === item.name);
  };

  const renderTable = (categoryKey: CategoryKey, items: Recommendation[]) => {
    if (!items || items.length === 0) {
      return <p className="text-gray-400 text-sm py-4">No recommendations found</p>;
    }

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
              <th className="text-right py-3 px-4 font-semibold">Price</th>
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
                      onClick={() => toggleSelection(categoryKey, rec)}
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
                      {rec.viralScore}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-medium text-gray-900">{rec.name}</td>
                  <td className="py-3 px-4 text-gray-600 text-xs max-w-[150px]">{rec.address}</td>
                  <td className="py-3 px-4">
                    {rec.website && rec.website !== 'N/A' ? (
                      <a 
                        href={rec.website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline text-xs"
                      >
                        Visit →
                      </a>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
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

  const getCategoryInfo = (key: CategoryKey) => CATEGORIES.find(c => c.key === key);

  return (
    <div className="space-y-6">
      {/* Controls Row */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 pb-4 border-b border-gray-200">
        {/* Budget Level */}
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

        {/* Custom Budget Tiers */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Hotel Budget Tiers ($/mo)</label>
          <div className="flex gap-1">
            <input
              type="number"
              value={budgetTiers.low}
              onChange={(e) => setBudgetTiers(prev => ({ ...prev, low: Number(e.target.value) }))}
              className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-2 text-xs"
              placeholder="$"
            />
            <input
              type="number"
              value={budgetTiers.mid}
              onChange={(e) => setBudgetTiers(prev => ({ ...prev, mid: Number(e.target.value) }))}
              className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-2 text-xs"
              placeholder="$$"
            />
            <input
              type="number"
              value={budgetTiers.high}
              onChange={(e) => setBudgetTiers(prev => ({ ...prev, high: Number(e.target.value) }))}
              className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-2 text-xs"
              placeholder="$$$"
            />
          </div>
        </div>

        {/* Party Size */}
        <div>
          <label className="block text-xs text-gray-500 mb-1">Party Size</label>
          <select
            value={partySize}
            onChange={(e) => setPartySize(Number(e.target.value))}
            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            {[1,2,3,4,5,6,7,8,9,10].map(n => (
              <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
            ))}
          </select>
        </div>

        {/* Analyze Button */}
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
        <span><strong>💰</strong> ${budgetTiers[budgetLevel]}/mo max lodging</span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-3 border-[#b4b237] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500">Analyzing {city} for viral content opportunities...</p>
          <p className="text-xs text-gray-400 mt-1">Ranking by TikTok, Instagram, YouTube & Google Reviews</p>
        </div>
      )}

      {/* Your Trip Plan - Selected Cards */}
      {selections.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
          <h3 className="font-bold text-green-800 mb-3">🗺️ Your Trip Plan ({selections.length} selections)</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {selections.map((sel, idx) => {
              const catInfo = getCategoryInfo(sel.category);
              return (
                <div key={idx} className="bg-white rounded-lg p-3 shadow-sm border border-green-100">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-lg">{catInfo?.icon}</span>
                    <button
                      onClick={() => toggleSelection(sel.category, sel.item)}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      ✕ Remove
                    </button>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">{catInfo?.label}</div>
                  <div className="font-medium text-gray-900 text-sm mb-1">{sel.item.name}</div>
                  <div className="text-green-600 font-medium text-sm">{sel.item.price}</div>
                  {sel.item.website && sel.item.website !== 'N/A' && (
                    <a 
                      href={sel.item.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-500 text-xs hover:underline mt-1 block"
                    >
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
          {CATEGORIES.map(({ key, label, subtitle, icon }) => {
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
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasSelection && <span className="text-xs bg-green-500 text-white px-2 py-1 rounded">Selected</span>}
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">{items?.length || 0} spots</span>
                    <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="p-0">
                    {renderTable(key, items)}
                  </div>
                )}
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
          <p className="text-xs mt-2">Ranked by social media attention + reviews</p>
        </div>
      )}
    </div>
  );
}
