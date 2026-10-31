/**
 * TaskRow — the LIVE, authed container for a single task row.
 *
 * PR4 split: this file keeps the EXACT live behavior it had before — all 8
 * fetches (PATCH save / PATCH quick-complete / GET history / POST uncomplete /
 * POST schedule / DELETE / PATCH archive / PATCH unarchive) plus every UI toggle
 * — and now renders the pure <TaskRowView /> with the live data + the 8 real
 * handlers wired to its callbacks. The public name + prop shape
 * ({ task, projectId, index, coaAccounts, onUpdate, onDelete }) are unchanged,
 * so the existing call site (TaskListView.tsx:212) is untouched and
 * /operations/projects behaves identically. NO new behavior, NO demo data.
 *
 * PROJECTS-01 (2026-09-30): the handlers and the state they drive moved to
 * useTaskActions.ts — their one home, which the projects table calls too. This
 * container keeps the view's own toggles (expanded, notes) and the two opens
 * it hands the hook (editing, history).
 *
 * Three modes (mirrors ProjectRow's pattern at task scale):
 *   1. Compact: index + title + status pill + deadline + "complete" quick action
 *   2. Expanded: + description + unblocks_label + estimates + completed_at
 *   3. Edit: inline form for all writable fields
 */

'use client';

import { useState } from 'react';
import TaskRowView from './TaskRowView';
import type { Task, CoaAccountSummary } from './types';
import { useTaskActions } from './useTaskActions';


interface Props {
  task: Task;
  projectId: string;
  index: number; // 1-based display index
  coaAccounts: CoaAccountSummary[];
  onUpdate: () => void;
  onDelete: () => void;
}

export default function TaskRow({ task, projectId, index, coaAccounts, onUpdate, onDelete }: Props & { }) {
  const [expanded, setExpanded] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const a = useTaskActions({ task, projectId, onUpdate, onDelete, editing, setEditing, showHistory, setShowHistory });

  return (
    <TaskRowView
      task={task}
      index={index}
      coaAccounts={coaAccounts}
      expanded={expanded}
      editing={a.editing}
      notesOpen={notesOpen}
      scheduleMenuOpen={a.scheduleMenuOpen}
      form={a.form}
      scheduleDate={a.scheduleDate}
      saving={a.saving}
      completing={a.completing}
      deleting={a.deleting}
      archiving={a.archiving}
      scheduling={a.scheduling}
      error={a.error}
      scheduleSuccess={a.scheduleSuccess}
      showHistory={a.showHistory}
      history={a.history}
      historyLoading={a.historyLoading}
      historyError={a.historyError}
      onToggleExpanded={() => setExpanded((x) => !x)}
      onToggleNotes={() => setNotesOpen((x) => !x)}
      onEnterEdit={a.enterEdit}
      onCancelEdit={a.cancelEdit}
      onFormChange={a.setForm}
      onToggleScheduleMenu={a.toggleScheduleMenu}
      onCloseScheduleMenu={a.closeScheduleMenu}
      onScheduleDateChange={a.setScheduleDate}
      onSave={a.handleSave}
      onQuickComplete={a.handleQuickComplete}
      onToggleHistory={a.handleToggleHistory}
      onUncomplete={a.handleUncomplete}
      onSchedule={a.handleSchedule}
      onDelete={a.handleDelete}
      onArchive={a.handleArchive}
      onUnarchive={a.handleUnarchive}
      reviewing={a.reviewing}
      reviewNotice={a.reviewNotice}
      onAcceptPending={a.handleAcceptPending}
      onRejectPending={a.handleRejectPending}
    />
  );
}
