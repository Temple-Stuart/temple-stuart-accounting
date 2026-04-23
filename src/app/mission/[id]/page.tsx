'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import AppLayout from '@/components/ui/AppLayout';
import MissionPipeline from '@/components/mission/MissionPipeline';

export default function MissionPipelinePage() {
  const params = useParams();
  const id = params.id as string;
  const [mission, setMission] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMission = useCallback(async () => {
    try {
      const res = await fetch(`/api/mission/${id}`);
      if (res.ok) {
        const data = await res.json();
        setMission(data.mission);
      }
    } catch (err) {
      console.error('Failed to load mission:', err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMission();
  }, [fetchMission]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
            <span className="text-text-muted font-mono text-terminal-base">Loading mission...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!mission) {
    return (
      <AppLayout>
        <div className="max-w-2xl mx-auto px-4 py-8 text-center">
          <p className="text-text-muted font-mono">Mission not found.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <MissionPipeline mission={mission} onUpdate={fetchMission} />
    </AppLayout>
  );
}
