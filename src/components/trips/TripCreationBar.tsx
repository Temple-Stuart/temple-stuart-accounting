'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plane } from 'lucide-react';

export default function TripCreationBar() {
  const router = useRouter();
  const [barName, setBarName] = useState('');
  const [barDestination, setBarDestination] = useState('');
  const [barStartDate, setBarStartDate] = useState('');
  const [barEndDate, setBarEndDate] = useState('');
  const [barTravelers, setBarTravelers] = useState(2);

  const handleCreateFromBar = () => {
    const params = new URLSearchParams();
    if (barName) params.set('tripName', barName);
    if (barDestination) params.set('destination', barDestination);
    if (barStartDate) params.set('startDate', barStartDate);
    if (barEndDate) params.set('endDate', barEndDate);
    if (barTravelers > 1) params.set('travelers', String(barTravelers));
    router.push(`/budgets/trips/new${params.toString() ? '?' + params.toString() : ''}`);
  };

  return (
    <div className="bg-white border-2 border-brand-gold/60 rounded-xl p-4 shadow-md">
      <div className="flex flex-col lg:flex-row items-stretch lg:items-end gap-3">
        <div className="flex-1 min-w-0">
          <label className="block text-xs font-medium text-gray-500 mb-1">Trip Name</label>
          <input type="text" value={barName} onChange={e => setBarName(e.target.value)}
            placeholder="e.g., Bali Surf Trip 2026"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-purple" />
        </div>
        <div className="lg:w-44">
          <label className="block text-xs font-medium text-gray-500 mb-1">Destination</label>
          <input type="text" value={barDestination} onChange={e => setBarDestination(e.target.value)}
            placeholder="City or country"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-purple" />
        </div>
        <div className="lg:w-36">
          <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
          <input type="date" value={barStartDate} onChange={e => setBarStartDate(e.target.value)}
            min={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-purple" />
        </div>
        <div className="lg:w-36">
          <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
          <input type="date" value={barEndDate} onChange={e => setBarEndDate(e.target.value)}
            min={barStartDate || new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-purple" />
        </div>
        <div className="lg:w-24">
          <label className="block text-xs font-medium text-gray-500 mb-1">Travelers</label>
          <select value={barTravelers} onChange={e => setBarTravelers(+e.target.value)}
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-brand-purple bg-white">
            {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>)}
          </select>
        </div>
        <button onClick={handleCreateFromBar}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-brand-gold hover:bg-brand-gold-bright text-white font-semibold rounded-lg text-sm transition-colors whitespace-nowrap shadow-sm">
          <Plane className="w-4 h-4" />
          Create Trip
        </button>
      </div>
    </div>
  );
}
