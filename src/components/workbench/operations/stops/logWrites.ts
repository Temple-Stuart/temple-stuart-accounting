/**
 * logWrites — THE LOG's two writes from the morning card (BACKLOG-02, Alex, 2026-10-20).
 *
 *   · rank:  PATCH /api/operations/projects/reorder        { ids }   — the full ordered list of the open projects
 *   · task:  POST  /api/operations/projects/[id]/tasks     { title } — title only; the route sets the rest as it already does
 *
 * Writes THROUGH Tasks' routes from a Time-owned component — the same shape as the reflection prompt's read; no Tasks
 * component is mounted on the card (TOOL-LAW-01). Each answer is read the journal writer's way (journalWrites.ts
 * answerOf): ok, or words — signed out by name, no JSON said, a refusal in the route's own words. Nothing is filled in.
 * This file is the only screen file on the card that names these routes with a method.
 */
import { answerOf, type JournalWriteAnswer } from './journalWrites';

export const RANK_FAILED_WORDS = 'failed to save the ranks';
export const TASK_FAILED_WORDS = 'failed to add the task';

export function reorderProjects(ids: readonly string[]): Promise<JournalWriteAnswer> {
  return answerOf(() => fetch('/api/operations/projects/reorder', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
    redirect: 'manual',
  }), RANK_FAILED_WORDS);
}

export function addTask(projectId: string, title: string): Promise<JournalWriteAnswer> {
  return answerOf(() => fetch(`/api/operations/projects/${encodeURIComponent(projectId)}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
    redirect: 'manual',
  }), TASK_FAILED_WORDS);
}
