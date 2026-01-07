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

interface Props {
  tripId: string;
  city: string | null;
  country: string | null;
  activity: string | null;
  month: number;
  year: number;
}

const CATEGORIES = [
  { key: 'coworking', label: '🏢 Co-Working Spaces', subtitle: 'Viral-worthy workspaces' },
  { key: 'hotels', label: '🏨 Hotels & Resorts', subtitle: 'Near coworking, photogenic' },
  { key: 'equipmentRental', label: '🏄 Equipment Rental', subtitle: 'Activity-specific gear' },
  { key: 'motorcycleRental', label: '🏍️ Motorcycle Rental', subtitle: 'Scooters & bikes' },
  { key: 'brunchCoffee', label: '☕ Brunch & Coffee', subtitle: 'Aesthetic cafes nearby' },
  { key: 'dinner', label: '🍽️ Dinner Spots', subtitle: 'Top-rated, content-worthy' },
  { key: 'activities', label: '🎯 Activities', subtitle: 'Within 1hr, viral experiences' },
] as const;

export default function TripAIAssistant({ tripId, city, country, activity, month, year }: Props) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [budgetLevel, setBudgetLevel] = useState<'low' | 'mid' | 'high'>('mid');
  const [expandedCategory, setExpandedCategory] = useState<string | null>('coworking');

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
        body: JSON.stringify({ city, country, activity, month, year, budgetLevel })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to get recommendations');
      }

      const data = await res.json();
      setRecommendations(data.recommendations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const renderTable = (items: Recommendation[]) => {
    if (!items || items.length === 0) {
      return <p className="text-gray-400 text-sm py-4">No recommendations found</p>;
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-white">
              <th className="text-left py-3 px-4 font-semibold">Name</th>
              <th className="text-left py-3 px-4 font-semibold">Address</th>
              <th className="text-left py-3 px-4 font-semibold">Website</th>
              <th className="text-right py-3 px-4 font-semibold">Price</th>
              <th className="text-left py-3 px-4 font-semibold">Why Viral</th>
              <th className="text-left py-3 px-4 font-semibold">Social Proof</th>
            </tr>
          </thead>
          <tbody>
            {items.map((rec, idx) => (
              <tr key={idx} className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50' : ''}`}>
                <td className="py-3 px-4 font-medium text-gray-900">{rec.name}</td>
                <td className="py-3 px-4 text-gray-600 text-xs max-w-[150px]">{rec.address}</td>
                <td className="py-3 px-4">
                  {rec.website && rec.website !== 'N/A' ? (
                    <a 
                      href={rec.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline text-xs truncate block max-w-[120px]"
                    >
                      Visit →
                    </a>
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="py-3 px-4 text-right font-medium text-green-600 whitespace-nowrap">{rec.price}</td>
                <td className="py-3 px-4 text-gray-600 text-xs max-w-[200px]">{rec.whyViral}</td>
                <td className="py-3 px-4 text-gray-500 text-xs max-w-[180px]">{rec.socialProof}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4 pb-4 border-b border-gray-200">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Budget Level</label>
          <select
            value={budgetLevel}
            onChange={(e) => setBudgetLevel(e.target.value as 'low' | 'mid' | 'high')}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="low">💰 Budget</option>
            <option value="mid">💰💰 Mid-Range</option>
            <option value="high">💰💰💰 Premium</option>
          </select>
        </div>
        <div className="text-xs text-gray-500">
          <div><strong>Destination:</strong> {city || 'Not selected'}, {country || '—'}</div>
          <div><strong>Activity:</strong> {activity || 'General'}</div>
        </div>
        <Button onClick={analyzeDestination} loading={loading} disabled={!city || !country}>
          🤖 Analyze Destination
        </Button>
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
        </div>
      )}

      {/* Results - Accordion Style */}
      {recommendations && !loading && (
        <div className="space-y-3">
          {CATEGORIES.map(({ key, label, subtitle }) => {
            const items = recommendations[key as keyof AIResponse];
            const isExpanded = expandedCategory === key;
            
            return (
              <div key={key} className="border border-gray-200 rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedCategory(isExpanded ? null : key)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="text-left">
                    <span className="font-medium text-gray-900">{label}</span>
                    <span className="text-xs text-gray-500 ml-2">{subtitle}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-gray-200 px-2 py-1 rounded">{items?.length || 0} spots</span>
                    <span className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="p-0">
                    {renderTable(items)}
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
          <p className="text-sm mt-1">Find the most Instagram/TikTok-worthy spots for your trip</p>
        </div>
      )}
    </div>
  );
}
