/**
 * TaskList — the LIVE, authed container for a single project's task list.
 *
 * PR1 split: this file keeps the EXACT live behavior it had before (self-fetch
 * tasks + COA, own the create form + POST, refresh on row mutations) and now
 * renders the pure <TaskListView /> with the live data + real handlers as props.
 * The public name + prop shape ({ projectId, entity_id }) are unchanged, so the
 * existing call site (ProjectRow.tsx:517) is untouched and /operations/projects
 * behaves identically. NO new behavior, NO demo/fallback data here.
 *
 * PROJECTS-01 (2026-09-30): the read, the category list and the create moved
 * to useProjectTasks.ts — their one home, which the projects table calls too.
 * This container keeps its own "show archived" toggle.
 *
 * Self-fetches via GET /api/operations/projects/[projectId]/tasks on mount and
 * on any onUpdate/onDelete from a TaskRow. COA accounts fetched once per
 * entity_id for the create-form category dropdown.
 */

'use client';

import { useState } from 'react';
import TaskListView from './TaskListView';
import TaskRow from './TaskRow';
import { useProjectTasks } from './useProjectTasks';


interface Props {
  /** PROJECTS-PIPE: task tallies reported up after each successful fetch
   *  (the Books onTotals idiom — zero new fetches). planTasks = accepted
   *  into the plan (status open/in_progress/blocked/completed — accepting a
   *  pending_review task lands it in these). */
  onTotals?: (t: { pendingReview: number; planTasks: number }) => void;
  projectId: string;
  entity_id: string;
  // PHASE2-5: optional external refresh trigger. Bumping this re-fetches the task
  // list (the auto-pipe poll uses it to surface landed pending_review tasks live).
  // Absent → unchanged behavior (showroom + other callers omit it).
  refreshKey?: number;
}

export default function TaskList({ projectId, entity_id, refreshKey, onTotals }: Props & { }) {
  // Archived tasks hidden by default; toggle mirrors RoutineList's "show inactive".
  const [showArchived, setShowArchived] = useState(false);
  const t = useProjectTasks({ projectId, entity_id, showArchived, refreshKey, onTotals });

  return (
    <TaskListView
      tasks={t.tasks}
      loading={t.loading}
      error={t.error}
      coaAccounts={t.coaAccounts}
      showArchived={showArchived}
      showCreate={t.showCreate}
      createForm={t.createForm}
      createSaving={t.createSaving}
      createError={t.createError}
      onShowArchivedChange={setShowArchived}
      onStartCreate={t.startCreate}
      onCancelCreate={t.cancelCreate}
      onCreateFormChange={t.setCreateForm}
      onCreate={t.handleCreate}
      // PR7b row slot — the SAME live <TaskRow> container with the SAME props as
      // before (1-based index forwarded verbatim). TaskListView wraps each call
      // in a keyed Fragment, so per-row behavior is byte-for-byte identical.
      renderTaskRow={(task, index) => (
        <TaskRow
          task={task}
          projectId={projectId}
          index={index}
          coaAccounts={t.coaAccounts}
          onUpdate={t.fetchTasks}
          onDelete={t.fetchTasks}
        />
      )}
    />
  );
}
