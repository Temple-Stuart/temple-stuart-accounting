'use client';

import { useState, useEffect } from 'react';

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const response = await fetch('/api/rfp');
      const data = await response.json();
      setLeads(data);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-8">Loading...</div>;

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50/30 via-white to-amber-50/20 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 bg-gradient-to-r from-purple-600 to-amber-500 bg-clip-text text-transparent">
          Lead Tracker
        </h1>
        
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-purple-600 to-amber-500 text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Business</th>
                  <th className="px-4 py-3 text-left">Contact</th>
                  <th className="px-4 py-3 text-left">Email</th>
                  <th className="px-4 py-3 text-left">Timeline</th>
                  <th className="px-4 py-3 text-left">One-Time</th>
                  <th className="px-4 py-3 text-left">Monthly</th>
                  <th className="px-4 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead: any, index: number) => (
                  <tr key={lead.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="px-4 py-3">{new Date(lead.createdAt).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-semibold">{lead.businessName}</td>
                    <td className="px-4 py-3">{lead.contactName}</td>
                    <td className="px-4 py-3">
                      <a href={`mailto:${lead.email}`} className="text-purple-600 hover:underline">
                        {lead.email}
                      </a>
                    </td>
                    <td className="px-4 py-3">{lead.timeline}</td>
                    <td className="px-4 py-3">${lead.oneTimeTotal.toLocaleString()}</td>
                    <td className="px-4 py-3">${lead.monthlyTotal.toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-sm">
                        {lead.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
