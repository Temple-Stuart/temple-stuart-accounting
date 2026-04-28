'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import AppLayout from '@/components/ui/AppLayout';
import OpsSubNav from '@/components/ops/OpsSubNav';

interface Citation { id: string; citation_string: string; status: string; }
interface TaskCitation { id: string; citation_id: string; relevance_note: string | null; citation: Citation; }
interface Task {
  id: string; title: string; description: string; status: string; priority_tier: string;
  inherent_likelihood: string; inherent_impact: string; due_date: string | null;
  display_order: number; citations: TaskCitation[]; is_active: boolean;
  penalty_description: string | null; monitoring_frequency: string; attestation_frequency: string;
  action_steps: string[]; framework_mappings: string[];
}
interface Workstream {
  id: string; title: string; description: string | null; status: string;
  display_order: number; is_active: boolean; tasks: Task[];
}
interface Project {
  id: string; title: string; description: string | null; domain_label: string;
  status: string; display_order: number; is_active: boolean; workstreams: Workstream[];
}
interface Mission {
  id: string; title: string; description: string | null; status: string;
  target_completion: string | null; actual_completion: string | null;
  framework_mappings: string[]; is_active: boolean; created_at: string;
  projects: Project[];
}

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600', active: 'bg-emerald-100 text-emerald-800',
  paused: 'bg-amber-100 text-amber-800', blocked: 'bg-red-100 text-red-800',
  completed: 'bg-blue-100 text-blue-800', cancelled: 'bg-gray-100 text-gray-500',
  archived: 'bg-gray-50 text-gray-400', not_started: 'bg-gray-100 text-gray-600',
  in_progress: 'bg-emerald-100 text-emerald-800', not_applicable: 'bg-gray-50 text-gray-400',
  proposed: 'bg-gray-100 text-gray-600', scoped: 'bg-blue-100 text-blue-800',
  scheduled: 'bg-indigo-100 text-indigo-800', awaiting_evidence: 'bg-amber-100 text-amber-800',
  awaiting_attestation: 'bg-orange-100 text-orange-800', superseded: 'bg-gray-100 text-gray-500',
};
const PRIORITY_STYLE: Record<string, string> = {
  required_now: 'bg-red-100 text-red-800', before_charging_users: 'bg-amber-100 text-amber-800',
  at_scale: 'bg-blue-100 text-blue-800', best_practice: 'bg-gray-100 text-gray-600',
};
const MISSION_STATUSES = ['draft','active','paused','blocked','completed','cancelled','archived'];
const PRIORITY_TIERS = ['required_now','before_charging_users','at_scale','best_practice'];
const RISK_LEVELS = ['very_low','low','moderate','high','very_high'];

function Badge({ value, styles }: { value: string; styles: Record<string, string> }) {
  return (
    <span className={`text-terminal-sm px-1.5 py-0.5 rounded ${styles[value] || 'bg-gray-100 text-gray-600'}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}

export default function MissionDetailPage() {
  const params = useParams();
  const missionId = params.id as string;
  const [mission, setMission] = useState<Mission | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', description: '', status: '', target_completion: '' });
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedWorkstreams, setExpandedWorkstreams] = useState<Set<string>>(new Set());
  const [addingProject, setAddingProject] = useState(false);
  const [addingWorkstream, setAddingWorkstream] = useState<string | null>(null);
  const [addingTask, setAddingTask] = useState<string | null>(null);
  const [newProject, setNewProject] = useState({ title: '', domain_label: '', description: '' });
  const [newWorkstream, setNewWorkstream] = useState({ title: '', description: '' });
  const [newTask, setNewTask] = useState({ title: '', description: '', priority_tier: 'required_now', inherent_likelihood: 'moderate', inherent_impact: 'moderate' });

  const fetchMission = useCallback(async () => {
    try {
      const res = await fetch(`/api/missions/${missionId}`);
      if (res.ok) { const data = await res.json(); setMission(data); }
    } catch (err) { console.error('Failed to load mission:', err); }
    finally { setLoading(false); }
  }, [missionId]);

  useEffect(() => { fetchMission(); }, [fetchMission]);

  const handleSave = async () => {
    const body: Record<string, unknown> = {};
    if (editForm.title && editForm.title !== mission?.title) body.title = editForm.title;
    if (editForm.description !== (mission?.description || '')) body.description = editForm.description;
    if (editForm.status && editForm.status !== mission?.status) body.status = editForm.status;
    if (editForm.target_completion) body.target_completion = editForm.target_completion;
    if (Object.keys(body).length === 0) { setEditing(false); return; }
    await fetch(`/api/missions/${missionId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    setEditing(false);
    fetchMission();
  };

  const startEdit = () => {
    if (!mission) return;
    setEditForm({ title: mission.title, description: mission.description || '', status: mission.status, target_completion: mission.target_completion?.slice(0, 10) || '' });
    setEditing(true);
  };

  const handleAddProject = async () => {
    if (!newProject.title || !newProject.domain_label) return;
    await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mission_id: missionId, ...newProject }) });
    setAddingProject(false);
    setNewProject({ title: '', domain_label: '', description: '' });
    fetchMission();
  };

  const handleAddWorkstream = async (projectId: string) => {
    if (!newWorkstream.title) return;
    await fetch('/api/workstreams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ project_id: projectId, ...newWorkstream }) });
    setAddingWorkstream(null);
    setNewWorkstream({ title: '', description: '' });
    fetchMission();
  };

  const handleAddTask = async (workstreamId: string) => {
    if (!newTask.title || !newTask.description) return;
    await fetch('/api/compliance-tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workstream_id: workstreamId, ...newTask }) });
    setAddingTask(null);
    setNewTask({ title: '', description: '', priority_tier: 'required_now', inherent_likelihood: 'moderate', inherent_impact: 'moderate' });
    fetchMission();
  };

  const toggle = (set: Set<string>, id: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id); else next.add(id);
    setter(next);
  };

  if (loading) {
    return (<AppLayout><OpsSubNav /><div className="flex items-center justify-center min-h-[40vh]"><div className="flex items-center gap-3"><div className="w-5 h-5 border-2 border-brand-purple border-t-transparent rounded-full animate-spin" /><span className="text-text-muted font-mono text-terminal-base">Loading mission...</span></div></div></AppLayout>);
  }
  if (!mission) {
    return (<AppLayout><OpsSubNav /><div className="max-w-[1600px] mx-auto px-4 pt-8 text-center"><p className="text-text-muted font-mono">Mission not found.</p></div></AppLayout>);
  }

  return (
    <AppLayout>
      <OpsSubNav />
      <div className="max-w-[1600px] mx-auto px-4 pt-4 pb-8 space-y-4">
        {/* Mission Header */}
        <div className="bg-white rounded border border-border shadow-sm p-5">
          {editing ? (
            <div className="space-y-3">
              <input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="font-mono text-xl font-bold w-full bg-transparent border border-border rounded px-2 py-1 focus:border-brand-purple outline-none" />
              <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={3} className="font-mono text-sm w-full bg-transparent border border-border rounded px-2 py-1 focus:border-brand-purple outline-none" />
              <div className="flex gap-3">
                <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value })} className="font-mono text-sm border border-border rounded px-2 py-1 focus:border-brand-purple outline-none">
                  {MISSION_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                </select>
                <input type="date" value={editForm.target_completion} onChange={(e) => setEditForm({ ...editForm, target_completion: e.target.value })} className="font-mono text-sm border border-border rounded px-2 py-1 focus:border-brand-purple outline-none" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleSave} className="font-mono text-terminal-sm px-3 py-1 rounded bg-brand-purple text-white hover:bg-brand-purple/90 transition-colors">Save</button>
                <button onClick={() => setEditing(false)} className="font-mono text-terminal-sm px-3 py-1 rounded border border-border text-text-muted hover:text-text-primary transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h1 className="text-xl font-bold text-text-primary font-mono">{mission.title}</h1>
                  <Badge value={mission.status} styles={STATUS_STYLE} />
                </div>
                <button onClick={startEdit} className="font-mono text-terminal-sm px-3 py-1 rounded border border-border text-text-muted hover:text-text-primary hover:border-brand-purple transition-colors">Edit</button>
              </div>
              {mission.description && <p className="text-terminal-sm text-text-muted font-mono mt-2">{mission.description}</p>}
              <div className="flex gap-4 mt-2 text-terminal-sm text-text-faint font-mono">
                {mission.target_completion && <span>Target: {new Date(mission.target_completion).toLocaleDateString()}</span>}
                {mission.framework_mappings.length > 0 && <span>Frameworks: {mission.framework_mappings.join(', ')}</span>}
                <span>{mission.projects.length} projects</span>
              </div>
            </div>
          )}
        </div>

        {/* Projects Tree */}
        {mission.projects.filter((p) => p.is_active).map((project) => (
          <div key={project.id} className="bg-white rounded border border-border shadow-sm">
            <button onClick={() => toggle(expandedProjects, project.id, setExpandedProjects)} className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-text-faint font-mono text-terminal-sm">{expandedProjects.has(project.id) ? '▼' : '▶'}</span>
                <span className="font-mono font-medium text-text-primary">{project.title}</span>
                <span className="text-terminal-sm font-mono bg-brand-purple/10 text-brand-purple px-1.5 py-0.5 rounded">{project.domain_label}</span>
                <Badge value={project.status} styles={STATUS_STYLE} />
              </div>
              <span className="text-terminal-sm text-text-faint font-mono">{project.workstreams.length} workstreams</span>
            </button>

            {expandedProjects.has(project.id) && (
              <div className="border-t border-border px-5 pb-4">
                {project.workstreams.filter((w) => w.is_active).map((ws) => (
                  <div key={ws.id} className="mt-3 border border-border-light rounded">
                    <button onClick={() => toggle(expandedWorkstreams, ws.id, setExpandedWorkstreams)} className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <span className="text-text-faint font-mono text-terminal-sm">{expandedWorkstreams.has(ws.id) ? '▼' : '▶'}</span>
                        <span className="font-mono text-sm text-text-primary">{ws.title}</span>
                        <Badge value={ws.status} styles={STATUS_STYLE} />
                      </div>
                      <span className="text-terminal-sm text-text-faint font-mono">{ws.tasks.length} tasks</span>
                    </button>

                    {expandedWorkstreams.has(ws.id) && (
                      <div className="border-t border-border-light">
                        {ws.tasks.filter((t) => t.is_active).map((task) => (
                          <div key={task.id} className="border-b border-border-light last:border-b-0">
                            <button onClick={() => toggle(expandedTasks, task.id, setExpandedTasks)} className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-50 transition-colors text-left">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="font-mono text-sm text-text-primary truncate">{task.title}</span>
                                <Badge value={task.status} styles={STATUS_STYLE} />
                                <Badge value={task.priority_tier} styles={PRIORITY_STYLE} />
                              </div>
                              <div className="flex items-center gap-3 text-terminal-sm text-text-faint font-mono flex-shrink-0">
                                {task.due_date && <span>{new Date(task.due_date).toLocaleDateString()}</span>}
                                {task.citations.length > 0 && <span>{task.citations.length} citations</span>}
                              </div>
                            </button>

                            {expandedTasks.has(task.id) && (
                              <div className="px-4 py-3 bg-gray-50 border-t border-border-light">
                                <div className="grid grid-cols-2 gap-4 text-terminal-sm font-mono">
                                  <div>
                                    <div className="font-medium text-text-secondary mb-1">Description</div>
                                    <div className="text-text-muted">{task.description}</div>
                                  </div>
                                  <div>
                                    <div className="font-medium text-text-secondary mb-1">Risk</div>
                                    <div className="text-text-muted">Likelihood: {task.inherent_likelihood.replace(/_/g, ' ')} / Impact: {task.inherent_impact.replace(/_/g, ' ')}</div>
                                  </div>
                                  {task.penalty_description && (
                                    <div><div className="font-medium text-text-secondary mb-1">Penalty</div><div className="text-text-muted">{task.penalty_description}</div></div>
                                  )}
                                  {task.monitoring_frequency !== 'not_applicable' && (
                                    <div><div className="font-medium text-text-secondary mb-1">Monitoring</div><div className="text-text-muted">{task.monitoring_frequency.replace(/_/g, ' ')}</div></div>
                                  )}
                                  {task.attestation_frequency !== 'not_applicable' && (
                                    <div><div className="font-medium text-text-secondary mb-1">Attestation</div><div className="text-text-muted">{task.attestation_frequency.replace(/_/g, ' ')}</div></div>
                                  )}
                                  {task.action_steps.length > 0 && (
                                    <div className="col-span-2"><div className="font-medium text-text-secondary mb-1">Action Steps</div><ul className="list-disc list-inside text-text-muted">{task.action_steps.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
                                  )}
                                  {task.citations.length > 0 && (
                                    <div className="col-span-2">
                                      <div className="font-medium text-text-secondary mb-1">Citations</div>
                                      <div className="space-y-1">{task.citations.map((tc) => (
                                        <div key={tc.id} className="flex items-center gap-2">
                                          <Badge value={tc.citation.status} styles={STATUS_STYLE} />
                                          <span className="text-text-muted">{tc.citation.citation_string}</span>
                                          {tc.relevance_note && <span className="text-text-faint">— {tc.relevance_note}</span>}
                                        </div>
                                      ))}</div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}

                        {/* Add Task */}
                        <div className="px-4 py-2">
                          {addingTask === ws.id ? (
                            <div className="space-y-2 p-3 border border-border rounded bg-white">
                              <input value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Task title" className="font-mono text-sm w-full bg-transparent border border-border rounded px-2 py-1 focus:border-brand-purple outline-none placeholder:text-text-faint" />
                              <textarea value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} placeholder="Description" rows={2} className="font-mono text-sm w-full bg-transparent border border-border rounded px-2 py-1 focus:border-brand-purple outline-none placeholder:text-text-faint" />
                              <div className="flex gap-2">
                                <select value={newTask.priority_tier} onChange={(e) => setNewTask({ ...newTask, priority_tier: e.target.value })} className="font-mono text-sm border border-border rounded px-2 py-1 focus:border-brand-purple outline-none">
                                  {PRIORITY_TIERS.map((p) => <option key={p} value={p}>{p.replace(/_/g, ' ')}</option>)}
                                </select>
                                <select value={newTask.inherent_likelihood} onChange={(e) => setNewTask({ ...newTask, inherent_likelihood: e.target.value })} className="font-mono text-sm border border-border rounded px-2 py-1 focus:border-brand-purple outline-none">
                                  {RISK_LEVELS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                                </select>
                                <select value={newTask.inherent_impact} onChange={(e) => setNewTask({ ...newTask, inherent_impact: e.target.value })} className="font-mono text-sm border border-border rounded px-2 py-1 focus:border-brand-purple outline-none">
                                  {RISK_LEVELS.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                                </select>
                              </div>
                              <div className="flex gap-2">
                                <button onClick={() => handleAddTask(ws.id)} className="font-mono text-terminal-sm px-3 py-1 rounded bg-brand-purple text-white hover:bg-brand-purple/90 transition-colors">Add</button>
                                <button onClick={() => setAddingTask(null)} className="font-mono text-terminal-sm px-3 py-1 rounded border border-border text-text-muted transition-colors">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => setAddingTask(ws.id)} className="font-mono text-terminal-sm text-brand-purple hover:text-brand-purple/80 transition-colors">+ Add Task</button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add Workstream */}
                <div className="mt-3">
                  {addingWorkstream === project.id ? (
                    <div className="space-y-2 p-3 border border-border rounded">
                      <input value={newWorkstream.title} onChange={(e) => setNewWorkstream({ ...newWorkstream, title: e.target.value })} placeholder="Workstream title" className="font-mono text-sm w-full bg-transparent border border-border rounded px-2 py-1 focus:border-brand-purple outline-none placeholder:text-text-faint" />
                      <textarea value={newWorkstream.description} onChange={(e) => setNewWorkstream({ ...newWorkstream, description: e.target.value })} placeholder="Description" rows={2} className="font-mono text-sm w-full bg-transparent border border-border rounded px-2 py-1 focus:border-brand-purple outline-none placeholder:text-text-faint" />
                      <div className="flex gap-2">
                        <button onClick={() => handleAddWorkstream(project.id)} className="font-mono text-terminal-sm px-3 py-1 rounded bg-brand-purple text-white hover:bg-brand-purple/90 transition-colors">Add</button>
                        <button onClick={() => setAddingWorkstream(null)} className="font-mono text-terminal-sm px-3 py-1 rounded border border-border text-text-muted transition-colors">Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setAddingWorkstream(project.id)} className="font-mono text-terminal-sm text-brand-purple hover:text-brand-purple/80 transition-colors">+ Add Workstream</button>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Add Project */}
        <div className="bg-white rounded border border-border shadow-sm p-5">
          {addingProject ? (
            <div className="space-y-3">
              <div className="font-mono font-medium text-text-primary">New Project</div>
              <input value={newProject.title} onChange={(e) => setNewProject({ ...newProject, title: e.target.value })} placeholder="Project title" className="font-mono text-sm w-full bg-transparent border border-border rounded px-2 py-1 focus:border-brand-purple outline-none placeholder:text-text-faint" />
              <input value={newProject.domain_label} onChange={(e) => setNewProject({ ...newProject, domain_label: e.target.value })} placeholder="Domain label (e.g. Bookkeeping)" className="font-mono text-sm w-full bg-transparent border border-border rounded px-2 py-1 focus:border-brand-purple outline-none placeholder:text-text-faint" />
              <textarea value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} placeholder="Description" rows={2} className="font-mono text-sm w-full bg-transparent border border-border rounded px-2 py-1 focus:border-brand-purple outline-none placeholder:text-text-faint" />
              <div className="flex gap-2">
                <button onClick={handleAddProject} className="font-mono text-terminal-sm px-3 py-1 rounded bg-brand-purple text-white hover:bg-brand-purple/90 transition-colors">Add Project</button>
                <button onClick={() => setAddingProject(false)} className="font-mono text-terminal-sm px-3 py-1 rounded border border-border text-text-muted transition-colors">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingProject(true)} className="font-mono text-terminal-sm text-brand-purple hover:text-brand-purple/80 transition-colors">+ Add Project</button>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
