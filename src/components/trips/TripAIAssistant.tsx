'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

interface LodgingRecommendation {
  name: string;
  neighborhood: string;
  whyGoodForNomads: string;
  priceRange: string;
  wifiNotes: string;
  distanceToCoworking: string;
  distanceToActivity: string;
  socialProof: string[];
}

interface Props {
  tripId: string;
  city: string | null;
  country: string | null;
  activity: string | null;
  month: number;
  year: number;
}

export default function TripAIAssistant({ tripId, city, country, activity, month, year }: Props) {
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<LodgingRecommendation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [budgetLevel, setBudgetLevel] = useState<'low' | 'mid' | 'high'>('mid');
  const [minPrice, setMinPrice] = useState(80);
  const [maxPrice, setMaxPrice] = useState(200);

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
          minPrice,
          maxPrice,
          currency: 'USD'
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to get recommendations');
      }

      const data = await res.json();
      setRecommendations(data.recommendations || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Budget Level</label>
          <select
            value={budgetLevel}
            onChange={(e) => setBudgetLevel(e.target.value as 'low' | 'mid' | 'high')}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm"
          >
            <option value="low">Low ($30-80/night)</option>
            <option value="mid">Mid ($80-200/night)</option>
            <option value="high">High ($200+/night)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Price Range</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={minPrice}
              onChange={(e) => setMinPrice(Number(e.target.value))}
              className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm"
              placeholder="Min"
            />
            <span className="text-gray-400">–</span>
            <input
              type="number"
              value={maxPrice}
              onChange={(e) => setMaxPrice(Number(e.target.value))}
              className="w-20 bg-white border border-gray-200 rounded-lg px-2 py-2 text-sm"
              placeholder="Max"
            />
            <span className="text-xs text-gray-500">USD/night</span>
          </div>
        </div>
        <Button onClick={analyzeDestination} loading={loading} disabled={!city || !country}>
          🤖 Analyze with AI
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results Table */}
      {recommendations.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="text-left py-3 px-4 font-semibold">Lodging</th>
                <th className="text-left py-3 px-4 font-semibold">Area</th>
                <th className="text-left py-3 px-4 font-semibold">Why Good for Nomads</th>
                <th className="text-right py-3 px-4 font-semibold">Price</th>
                <th className="text-left py-3 px-4 font-semibold">Wi-Fi/Work</th>
                <th className="text-left py-3 px-4 font-semibold">Distances</th>
                <th className="text-left py-3 px-4 font-semibold">Social Proof</th>
              </tr>
            </thead>
            <tbody>
              {recommendations.map((rec, idx) => (
                <tr key={idx} className={`border-b border-gray-100 ${idx % 2 === 1 ? 'bg-gray-50' : ''}`}>
                  <td className="py-3 px-4 font-medium text-gray-900">{rec.name}</td>
                  <td className="py-3 px-4 text-gray-600">{rec.neighborhood}</td>
                  <td className="py-3 px-4 text-gray-600 max-w-xs">{rec.whyGoodForNomads}</td>
                  <td className="py-3 px-4 text-right font-medium text-green-600">{rec.priceRange}</td>
                  <td className="py-3 px-4 text-gray-600">{rec.wifiNotes}</td>
                  <td className="py-3 px-4 text-xs text-gray-500">
                    <div>🏢 {rec.distanceToCoworking}</div>
                    <div>🎯 {rec.distanceToActivity}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-gray-500">
                    <ul className="list-disc list-inside">
                      {rec.socialProof.map((proof, i) => (
                        <li key={i}>{proof}</li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!loading && recommendations.length === 0 && !error && (
        <div className="text-center py-8 text-gray-400">
          <div className="text-3xl mb-2">🤖</div>
          <p>Click "Analyze with AI" to get lodging recommendations for your destination</p>
        </div>
      )}
    </div>
  );
}
