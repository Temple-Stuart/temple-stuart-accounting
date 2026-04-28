'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/ui/AppLayout';
import OpsSubNav from '@/components/ops/OpsSubNav';

interface DiscoveryRun {
  id: string;
  status: string;
  proposal_count: number;
  total_cost_usd: number | null;
  created_at: string;
}

const IN_PROGRESS_STATUSES = [
  'initiated',
  'profile_validation',
  'source_selection',
  'web_search_running',
  'synthesis_running',
  'citation_verification',
];

const STATUS_STYLE: Record<string, string> = {
  initiated: 'bg-blue-100 text-blue-800',
  profile_validation: 'bg-blue-100 text-blue-800',
  source_selection: 'bg-blue-100 text-blue-800',
  web_search_running: 'bg-blue-100 text-blue-800',
  synthesis_running: 'bg-blue-100 text-blue-800',
  citation_verification: 'bg-blue-100 text-blue-800',
  completed: 'bg-emerald-100 text-emerald-800',
  failed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-500',
};

function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

export default function DiscoveryPage() {
  const [runs, setRuns] = useState<DiscoveryRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [starting, setStarting] = useState(false);
  const [runningStatus, setRunningStatus] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [profileRes, runsRes] = await Promise.all([
        fetch('/api/discovery/profile'),
        fetch('/api/discovery/runs'),
      ]);

      if (profileRes.ok) {
        const profileData = await profileRes.json();
        setHasProfile(!!profileData.profile);
      } else {
        setHasProfile(false);
      }

      if (runsRes.ok) {
        const runsData = await runsRes.json();
        setRuns(runsData.runs || []);
      }
    } catch (err) {
      console.error('Failed to load discovery data:', err);
    } finally {
      setLoading(false);
    }
  }

  const hasRunInProgress = runs.some((r) => IN_PROGRESS_STATUSES.includes(r.status));

  const handleRunDiscovery = async () => {
    setStarting(true);
    setRunningStatus('Running discovery... this may take a minute.');

    try {
      const res = await fetch('/api/discovery/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        await loadData();
      } else {
        const data = await res.json().catch(() => ({}));
        setRunningStatus(`Error: ${data.error || 'Failed to start discovery run'}`);
      }
    } catch (err) {
      console.error('Failed to start discovery:', err);
      setRunningStatus('Error: Failed to start discovery run');
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <OpsSubNav />
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
            <span className="text-text-muted font-mono text-terminal-base">Loading discovery...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <OpsSubNav />
      <div className="max-w-[1600px] mx-auto px-4 pt-4 pb-8 space-y-4">
        {/* Header */}
        <div className="bg-white rounded border border-border shadow-sm p-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-text-primary font-mono">Compliance Discovery</h1>
              <p className="text-terminal-sm text-text-muted font-mono mt-1">
                AI-powered compliance scoping based on your business profile.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {hasProfile === false ? (
                <span className="font-mono text-terminal-sm text-text-muted">
                  Set up your{' '}
                  <Link href="/ops/profile" className="text-brand-purple underline hover:text-brand-purple/80">
                    profile
                  </Link>{' '}
                  first
                </span>
              ) : (
                <button
                  onClick={handleRunDiscovery}
                  disabled={starting || hasRunInProgress}
                  className="font-mono text-terminal-sm px-4 py-2 rounded border border-brand-purple bg-brand-purple text-white hover:bg-brand-purple/90 transition-colors disabled:opacity-50"
                >
                  {hasRunInProgress ? 'Discovery in progress...' : 'Run Discovery'}
                </button>
              )}
            </div>
          </div>

          {starting && (
            <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border">
              <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
              <span className="text-text-muted font-mono text-terminal-sm">{runningStatus}</span>
            </div>
          )}
          {!starting && runningStatus.startsWith('Error:') && (
            <div className="mt-4 pt-4 border-t border-border">
              <span className="text-red-600 font-mono text-terminal-sm">{runningStatus}</span>
            </div>
          )}
        </div>

        {/* Runs Table */}
        <div className="bg-white rounded border border-border shadow-sm overflow-x-auto">
          {runs.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-text-muted font-mono text-terminal-base">
                No discovery runs yet. Click Run Discovery to scope your compliance posture.
              </p>
            </div>
          ) : (
            <table className="w-full text-terminal-base font-mono">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">
                    Started At
                  </th>
                  <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-3 py-2 text-center text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">
                    Proposals
                  </th>
                  <th className="px-3 py-2 text-right text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="px-3 py-2 text-center text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-b border-border-light hover:bg-bg-row/50 transition-colors">
                    <td className="px-3 py-2 text-text-primary" title={new Date(run.created_at).toLocaleString()}>
                      {relativeTime(run.created_at)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-terminal-sm px-1.5 py-0.5 rounded ${STATUS_STYLE[run.status] || 'bg-gray-100 text-gray-600'}`}
                      >
                        {run.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-text-muted">{run.proposal_count}</td>
                    <td className="px-3 py-2 text-right text-text-muted">
                      {run.total_cost_usd != null ? `$${run.total_cost_usd.toFixed(4)}` : '—'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <Link
                        href={`/ops/discovery/${run.id}`}
                        className="font-mono text-terminal-sm px-3 py-1 rounded border border-brand-purple text-brand-purple hover:bg-brand-purple hover:text-white transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
