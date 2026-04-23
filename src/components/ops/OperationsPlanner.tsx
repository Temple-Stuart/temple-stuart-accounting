'use client';

import { useState, useEffect, useCallback } from 'react';
import CreateMissionCard from '@/components/mission/CreateMissionCard';
import DailyDashboard from './DailyDashboard';

export default function OperationsPlanner() {
  const [mission, setMission] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMission = useCallback(async () => {
    try {
      const res = await fetch('/api/mission/active');
      if (res.ok) {
        const data = await res.json();
        setMission(data.mission);
      }
    } catch (err) {
      console.error('Failed to fetch mission:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMission();
  }, [fetchMission]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
          <span className="text-text-muted font-mono text-terminal-base">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="max-w-6xl mx-auto px-4 pt-3 pb-1">
        <CreateMissionCard
          mission={mission}
          onCreated={(m) => setMission(m)}
        />
      </div>
      <DailyDashboard />
    </div>
  );
}
