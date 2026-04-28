'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import AppLayout from '@/components/ui/AppLayout';
import OpsSubNav from '@/components/ops/OpsSubNav';

interface Citation {
  citation_string: string;
  pinpoint: string | null;
  document_type: string | null;
  relevance_note: string | null;
  retrieved_url: string | null;
}

interface Proposal {
  id: string;
  proposal_type: string;
  parent_proposal_id: string | null;
  review_status: string;
  proposed_payload: {
    title?: string;
    description?: string;
    domain_label?: string;
    priority_tier?: string;
    inherent_likelihood?: string;
    inherent_impact?: string;
    penalty_description?: string;
    action_steps?: string[];
    framework_mappings?: string[];
  };
  ai_rationale: string | null;
  ai_priority_score: number | null;
  ai_confidence: number | null;
  citations: Citation[];
  children?: Proposal[];
}

interface DiscoveryRun {
  id: string;
  status: string;
  proposals: Proposal[];
}

const PRIORITY_TIER_STYLE: Record<string, string> = {
  required_now: 'bg-red-100 text-red-800',
  before_charging_users: 'bg-amber-100 text-amber-800',
  at_scale: 'bg-blue-100 text-blue-800',
  best_practice: 'bg-gray-100 text-gray-600',
};

function buildTree(proposals: Proposal[]): Proposal[] {
  const byId = new Map<string, Proposal>();
  for (const p of proposals) {
    byId.set(p.id, { ...p, children: [] });
  }
  const roots: Proposal[] = [];
  for (const p of byId.values()) {
    if (p.parent_proposal_id && byId.has(p.parent_proposal_id)) {
      byId.get(p.parent_proposal_id)!.children!.push(p);
    } else if (!p.parent_proposal_id) {
      roots.push(p);
    }
  }
  return roots;
}

function TaskNode({ proposal }: { proposal: Proposal }) {
  const pp = proposal.proposed_payload;
  const tierStyle = pp.priority_tier ? PRIORITY_TIER_STYLE[pp.priority_tier] || 'bg-gray-100 text-gray-600' : '';

  return (
    <div className="border border-border rounded p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-terminal-base font-semibold text-text-primary">{pp.title}</span>
        {pp.priority_tier && (
          <span className={`text-terminal-sm px-1.5 py-0.5 rounded font-mono ${tierStyle}`}>
            {pp.priority_tier.replace(/_/g, ' ')}
          </span>
        )}
        {pp.inherent_likelihood && (
          <span className="text-terminal-sm font-mono text-text-muted">
            Likelihood: {pp.inherent_likelihood}
          </span>
        )}
        {pp.inherent_impact && (
          <span className="text-terminal-sm font-mono text-text-muted">
            Impact: {pp.inherent_impact}
          </span>
        )}
      </div>
      {pp.description && (
        <p className="font-mono text-terminal-sm text-text-muted">{pp.description}</p>
      )}
      {pp.penalty_description && (
        <p className="font-mono text-terminal-sm text-red-700">Penalty: {pp.penalty_description}</p>
      )}
      {pp.action_steps && pp.action_steps.length > 0 && (
        <div>
          <p className="font-mono text-terminal-sm font-semibold text-text-secondary mb-1">Action Steps</p>
          <ul className="list-disc list-inside space-y-0.5">
            {pp.action_steps.map((step, i) => (
              <li key={i} className="font-mono text-terminal-sm text-text-muted">{step}</li>
            ))}
          </ul>
        </div>
      )}
      {proposal.citations && proposal.citations.length > 0 && (
        <div>
          <p className="font-mono text-terminal-sm font-semibold text-text-secondary mb-1">Citations</p>
          <div className="space-y-1.5">
            {proposal.citations.map((c, i) => (
              <div key={i} className="border border-border-light rounded p-2 space-y-0.5">
                <p className="font-mono text-terminal-sm text-text-primary">{c.citation_string}</p>
                {c.pinpoint && (
                  <p className="font-mono text-terminal-sm text-text-muted">Pinpoint: {c.pinpoint}</p>
                )}
                {c.document_type && (
                  <span className="inline-block text-terminal-sm font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                    {c.document_type.replace(/_/g, ' ')}
                  </span>
                )}
                {c.relevance_note && (
                  <p className="font-mono text-terminal-sm text-text-faint">{c.relevance_note}</p>
                )}
                {c.retrieved_url && (
                  <a
                    href={c.retrieved_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-terminal-sm text-brand-purple hover:underline break-all"
                  >
                    {c.retrieved_url}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function WorkstreamNode({ proposal }: { proposal: Proposal }) {
  const pp = proposal.proposed_payload;
  const tasks = (proposal.children || []).filter((c) => c.proposal_type === 'task');

  return (
    <div className="border border-border rounded p-3 space-y-2">
      <span className="font-mono text-terminal-base font-semibold text-text-primary">{pp.title}</span>
      {pp.description && (
        <p className="font-mono text-terminal-sm text-text-muted">{pp.description}</p>
      )}
      {tasks.length > 0 && (
        <div className="ml-4 space-y-2">
          {tasks.map((task) => (
            <TaskNode key={task.id} proposal={task} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectNode({ proposal }: { proposal: Proposal }) {
  const pp = proposal.proposed_payload;
  const workstreams = (proposal.children || []).filter((c) => c.proposal_type === 'workstream');
  const tasks = (proposal.children || []).filter((c) => c.proposal_type === 'task');

  return (
    <div className="border border-border rounded p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-terminal-base font-bold text-text-primary">{pp.title}</span>
        {pp.domain_label && (
          <span className="text-terminal-sm font-mono bg-brand-purple/10 text-brand-purple px-1.5 py-0.5 rounded">
            {pp.domain_label}
          </span>
        )}
      </div>
      {pp.description && (
        <p className="font-mono text-terminal-sm text-text-muted">{pp.description}</p>
      )}
      {proposal.ai_rationale && (
        <p className="font-mono text-terminal-sm text-text-faint italic">{proposal.ai_rationale}</p>
      )}
      {workstreams.length > 0 && (
        <div className="ml-4 space-y-2">
          {workstreams.map((ws) => (
            <WorkstreamNode key={ws.id} proposal={ws} />
          ))}
        </div>
      )}
      {tasks.length > 0 && (
        <div className="ml-4 space-y-2">
          {tasks.map((task) => (
            <TaskNode key={task.id} proposal={task} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DiscoveryRunDetailPage() {
  const params = useParams();
  const runId = params.id as string;

  const [run, setRun] = useState<DiscoveryRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, 'accepted' | 'rejected' | 'skipped'>>({});
  const [reviewComplete, setReviewComplete] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/discovery/runs/${runId}`);
        if (res.ok) {
          const data = await res.json();
          setRun(data.run || data);
        } else {
          setError('Failed to load discovery run');
        }
      } catch (err) {
        setError('Failed to load discovery run');
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [runId]);

  if (loading) {
    return (
      <AppLayout>
        <OpsSubNav />
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" />
            <span className="text-text-muted font-mono text-terminal-base">Loading discovery run...</span>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error || !run) {
    return (
      <AppLayout>
        <OpsSubNav />
        <div className="max-w-[1600px] mx-auto px-4 pt-4 pb-8">
          <div className="bg-white rounded border border-border shadow-sm p-5">
            <p className="font-mono text-terminal-base text-red-600">{error || 'Run not found'}</p>
            <Link href="/ops/discovery" className="font-mono text-terminal-sm text-brand-purple hover:underline mt-2 inline-block">
              &larr; Back to Discovery
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const allProposals = run.proposals || [];
  const tree = buildTree(allProposals);
  const missions = tree.filter((p) => p.proposal_type === 'mission');

  if (missions.length === 0) {
    return (
      <AppLayout>
        <OpsSubNav />
        <div className="max-w-[1600px] mx-auto px-4 pt-4 pb-8">
          <div className="bg-white rounded border border-border shadow-sm p-5">
            <p className="font-mono text-terminal-base text-text-muted">No mission proposals found in this run.</p>
            <Link href="/ops/discovery" className="font-mono text-terminal-sm text-brand-purple hover:underline mt-2 inline-block">
              &larr; Back to Discovery
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (reviewComplete) {
    const accepted = Object.values(decisions).filter((d) => d === 'accepted').length;
    const rejected = Object.values(decisions).filter((d) => d === 'rejected').length;
    const skipped = missions.length - accepted - rejected;

    return (
      <AppLayout>
        <OpsSubNav />
        <div className="max-w-[1600px] mx-auto px-4 pt-4 pb-8 space-y-4">
          <div className="bg-white rounded border border-border shadow-sm p-8 text-center space-y-4">
            <h1 className="text-xl font-bold text-text-primary font-mono">Review Complete</h1>
            <p className="font-mono text-terminal-base text-text-muted">
              {accepted} accepted, {rejected} rejected, {skipped} skipped.
            </p>
            <Link
              href="/ops/discovery"
              className="inline-block font-mono text-terminal-sm px-3 py-1 rounded border border-brand-purple text-brand-purple hover:bg-brand-purple hover:text-white transition-colors"
            >
              Back to Discovery
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  const mission = missions[currentIndex];
  const mp = mission.proposed_payload;
  const projects = (mission.children || []).filter((c) => c.proposal_type === 'project');

  const advanceToNext = () => {
    if (currentIndex < missions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setReviewComplete(true);
    }
  };

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/discovery/proposals/${mission.id}/accept`, { method: 'POST' });
      if (res.ok) {
        setDecisions({ ...decisions, [mission.id]: 'accepted' });
        advanceToNext();
      }
    } catch (err) {
      console.error('Failed to accept:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    const reason = window.prompt('Reason for rejection:');
    if (reason === null) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/discovery/proposals/${mission.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (res.ok) {
        setDecisions({ ...decisions, [mission.id]: 'rejected' });
        advanceToNext();
      }
    } catch (err) {
      console.error('Failed to reject:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleSkip = () => {
    setDecisions({ ...decisions, [mission.id]: 'skipped' });
    advanceToNext();
  };

  return (
    <AppLayout>
      <OpsSubNav />
      <div className="max-w-[1600px] mx-auto px-4 pt-4 pb-24 space-y-4">
        {/* Top bar */}
        <div className="bg-white rounded border border-border shadow-sm p-4 flex items-center justify-between">
          <Link href="/ops/discovery" className="font-mono text-terminal-sm text-brand-purple hover:underline">
            &larr; Back to Discovery
          </Link>
          <span className="font-mono text-terminal-sm text-text-muted">
            Reviewing {currentIndex + 1} of {missions.length} missions
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              className="font-mono text-terminal-sm px-3 py-1 rounded border border-border text-text-muted hover:text-text-primary transition-colors disabled:opacity-30"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (currentIndex < missions.length - 1) setCurrentIndex(currentIndex + 1);
              }}
              disabled={currentIndex === missions.length - 1}
              className="font-mono text-terminal-sm px-3 py-1 rounded border border-border text-text-muted hover:text-text-primary transition-colors disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>

        {/* Mission Card */}
        <div className="bg-white rounded border border-border shadow-sm p-5 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-text-primary font-mono">{mp.title}</h2>
            {mission.ai_priority_score != null && (
              <span className="text-terminal-sm font-mono bg-brand-purple/10 text-brand-purple px-2 py-0.5 rounded-full font-bold">
                Score: {mission.ai_priority_score}
              </span>
            )}
            {mission.ai_confidence != null && (
              <span className="text-terminal-sm font-mono text-text-muted">
                Confidence: {Math.round(mission.ai_confidence * 100)}%
              </span>
            )}
          </div>
          {mp.description && (
            <p className="font-mono text-terminal-base text-text-muted">{mp.description}</p>
          )}
          {mission.ai_rationale && (
            <p className="font-mono text-terminal-sm text-text-faint italic">{mission.ai_rationale}</p>
          )}
          {mp.framework_mappings && mp.framework_mappings.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {mp.framework_mappings.map((fm, i) => (
                <span key={i} className="text-terminal-sm font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                  {fm}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Child proposals (projects -> workstreams -> tasks) */}
        {projects.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-mono text-terminal-base font-semibold text-text-secondary">Projects</h3>
            {projects.map((proj) => (
              <ProjectNode key={proj.id} proposal={proj} />
            ))}
          </div>
        )}

        {/* Sticky bottom action bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border shadow-lg">
          <div className="max-w-[1600px] mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {decisions[mission.id] && (
                <span className="font-mono text-terminal-sm text-text-muted">
                  {decisions[mission.id] === 'accepted' && 'Accepted'}
                  {decisions[mission.id] === 'rejected' && 'Rejected'}
                  {decisions[mission.id] === 'skipped' && 'Skipped'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleSkip}
                disabled={actionLoading}
                className="font-mono text-terminal-sm px-3 py-1 rounded border border-border text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
              >
                Skip
              </button>
              <button
                onClick={handleReject}
                disabled={actionLoading}
                className="font-mono text-terminal-sm px-3 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={handleAccept}
                disabled={actionLoading}
                className="font-mono text-terminal-sm px-4 py-1.5 rounded border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors disabled:opacity-50"
              >
                Accept Mission
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
