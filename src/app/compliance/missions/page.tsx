'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import AppLayout from '@/components/ui/AppLayout';
import OpsSubNav from '@/components/ops/OpsSubNav';

interface Mission {
  id: string;
  title: string;
  description: string | null;
  status: string;
  target_completion: string | null;
  actual_completion: string | null;
  framework_mappings: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  _count?: { projects: number };
}

const MISSION_STATUS_OPTIONS = ['', 'draft', 'active', 'paused', 'blocked', 'completed', 'cancelled', 'archived'];

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  active: 'bg-emerald-100 text-emerald-800',
  paused: 'bg-amber-100 text-amber-800',
  blocked: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800',
  cancelled: 'bg-gray-100 text-gray-500',
  archived: 'bg-gray-50 text-gray-400',
};

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '—';
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
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  return `${diffMonth}mo ago`;
}

export default function MissionsPage() {
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [isActiveFilter, setIsActiveFilter] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // Create form state
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newTargetCompletion, setNewTargetCompletion] = useState('');
  const [newFrameworkMappings, setNewFrameworkMappings] = useState('');

  const fetchMissions = async () => {
    try {
      const res = await fetch('/api/missions');
      if (res.ok) {
        const data = await res.json();
        setMissions(data.missions || []);
      }
    } catch (err) {
      console.error('Failed to load missions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMissions();
  }, []);

  const filtered = useMemo(() => {
    return missions.filter((m) => {
      if (statusFilter && m.status !== statusFilter) return false;
      if (isActiveFilter && !m.is_active) return false;
      return true;
    });
  }, [missions, statusFilter, isActiveFilter]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setCreating(true);
    try {
      const body: Record<string, unknown> = { title: newTitle.trim() };
      if (newDescription.trim()) body.description = newDescription.trim();
      if (newTargetCompletion) body.target_completion = newTargetCompletion;
      if (newFrameworkMappings.trim()) {
        body.framework_mappings = newFrameworkMappings.split(',').map((s) => s.trim()).filter(Boolean);
      }
      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setNewTitle('');
        setNewDescription('');
        setNewTargetCompletion('');
        setNewFrameworkMappings('');
        setShowCreateForm(false);
        await fetchMissions();
      }
    } catch (err) {
      console.error('Failed to create mission:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (id: string) => {
    setArchivingId(id);
    try {
      const res = await fetch(`/api/missions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false }),
      });
      if (res.ok) {
        await fetchMissions();
      }
    } catch (err) {
      console.error('Failed to archive mission:', err);
    } finally {
      setArchivingId(null);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <OpsSubNav />
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
            <span className="text-text-muted font-mono text-terminal-base">Loading missions...</span>
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
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-text-primary font-mono">PR-D Missions</h1>
              <p className="text-terminal-sm text-text-muted font-mono mt-1">
                Organize compliance work into missions, projects, workstreams, and tasks.
              </p>
              <p className="text-terminal-sm text-text-faint font-mono mt-2">
                Showing {filtered.length} of {missions.length} missions
              </p>
            </div>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="font-mono text-terminal-sm px-3 py-1 rounded border border-brand-purple text-brand-purple hover:bg-brand-purple hover:text-white transition-colors"
            >
              {showCreateForm ? 'Cancel' : 'New Mission'}
            </button>
          </div>
        </div>

        {/* Create Form */}
        {showCreateForm && (
          <div className="bg-white rounded border border-border shadow-sm p-5">
            <h2 className="text-terminal-base font-semibold text-text-primary font-mono mb-3">Create Mission</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-terminal-sm font-mono text-text-secondary mb-1">Title *</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                  placeholder="e.g., SOC 2 Type II Readiness"
                  className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 w-full focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint"
                />
              </div>
              <div>
                <label className="block text-terminal-sm font-mono text-text-secondary mb-1">Description</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  placeholder="Describe the mission scope and objectives..."
                  className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 w-full focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint resize-y"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-terminal-sm font-mono text-text-secondary mb-1">Target Completion</label>
                  <input
                    type="date"
                    value={newTargetCompletion}
                    onChange={(e) => setNewTargetCompletion(e.target.value)}
                    className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 w-full focus:border-brand-purple outline-none transition-colors"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-terminal-sm font-mono text-text-secondary mb-1">Framework Mappings</label>
                  <input
                    type="text"
                    value={newFrameworkMappings}
                    onChange={(e) => setNewFrameworkMappings(e.target.value)}
                    placeholder="SOC2, ISO27001, GDPR"
                    className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 w-full focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={creating || !newTitle.trim()}
                  className="font-mono text-terminal-sm px-4 py-1.5 rounded border border-brand-purple text-brand-purple hover:bg-brand-purple hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create Mission'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded border border-border shadow-sm p-4 flex flex-wrap gap-3 items-center">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 focus:border-brand-purple outline-none"
          >
            <option value="">All statuses</option>
            {MISSION_STATUS_OPTIONS.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 font-mono text-terminal-sm text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={isActiveFilter}
              onChange={(e) => setIsActiveFilter(e.target.checked)}
              className="rounded border-border"
            />
            Active only
          </label>
        </div>

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded border border-border shadow-sm p-12 text-center">
            <p className="text-text-muted font-mono text-terminal-base">
              No missions yet. Create your first mission to start organizing compliance work.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded border border-border shadow-sm overflow-x-auto">
            <table className="w-full text-terminal-base font-mono">
              <thead className="bg-gray-50 border-b border-border">
                <tr>
                  <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Title</th>
                  <th className="px-3 py-2 text-center text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Status</th>
                  <th className="px-3 py-2 text-center text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Projects</th>
                  <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Target Completion</th>
                  <th className="px-3 py-2 text-left text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Created</th>
                  <th className="px-3 py-2 text-center text-terminal-sm font-semibold text-text-secondary uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-b border-border-light hover:bg-bg-row/50 transition-colors">
                    <td className="px-3 py-2 text-text-primary font-medium max-w-xs">
                      <div className="truncate">{m.title}</div>
                      {m.description && (
                        <div className="text-terminal-sm text-text-faint truncate max-w-xs">{m.description}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-terminal-sm px-1.5 py-0.5 rounded ${STATUS_STYLE[m.status] || 'bg-gray-100 text-gray-600'}`}>
                        {m.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center text-text-muted text-terminal-sm">
                      {m._count?.projects ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-text-muted text-terminal-sm">
                      {m.target_completion ? new Date(m.target_completion).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-text-muted text-terminal-sm">
                      <span title={new Date(m.created_at).toLocaleString()}>
                        {relativeTime(m.created_at)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Link
                          href={`/ops/missions/${m.id}`}
                          className="font-mono text-terminal-sm px-3 py-1 rounded border border-brand-purple text-brand-purple hover:bg-brand-purple hover:text-white transition-colors"
                        >
                          Open
                        </Link>
                        {m.is_active && (
                          <button
                            onClick={() => handleArchive(m.id)}
                            disabled={archivingId === m.id}
                            className="font-mono text-terminal-sm px-3 py-1 rounded border border-border text-text-muted hover:text-red-600 hover:border-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {archivingId === m.id ? 'Archiving...' : 'Archive'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
