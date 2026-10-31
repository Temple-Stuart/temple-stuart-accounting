/**
 * WorkChanges — the /tasks page's one task-change signal (WORK-01b, Alex, 2026-10-24, ruling 3).
 *
 * THE WORK (SectionE_Work) and PROJECTS (SectionD_ProjectBacklog) share the page
 * and both read the tasks — THE WORK as rows, PROJECTS as each project's count by
 * status. A task written in one must not leave a stale number in the other, so the
 * page holds one version: a task change anywhere calls `bump()`, and every reader
 * of the tasks re-reads when `version` moves (THE WORK's read effect; PROJECTS'
 * useProjectTasks refreshKey). Routine changes do not bump it — PROJECTS counts
 * no routines.
 *
 * React state only — no store, no localStorage, no DOM event. Reading it outside
 * the provider throws: the signal is the page's, never a silent no-op.
 */

'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export interface WorkChanges {
  /** Moves on every task change on the page; readers re-read when it does. */
  readonly version: number;
  /** A task was created, saved, moved, archived or deleted — every reader re-reads. */
  readonly bump: () => void;
}

const WorkChangesContext = createContext<WorkChanges | null>(null);

export const NO_WORK_CHANGES_PROVIDER_WORDS = 'useWorkChanges: no WorkChangesProvider above — THE WORK and PROJECTS share one on /tasks (WORK-01b)';

export function WorkChangesProvider({ children }: { children: ReactNode }) {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((n) => n + 1), []);
  const value = useMemo<WorkChanges>(() => ({ version, bump }), [version, bump]);
  return <WorkChangesContext.Provider value={value}>{children}</WorkChangesContext.Provider>;
}

export function useWorkChanges(): WorkChanges {
  const value = useContext(WorkChangesContext);
  if (value === null) throw new Error(NO_WORK_CHANGES_PROVIDER_WORDS);
  return value;
}
