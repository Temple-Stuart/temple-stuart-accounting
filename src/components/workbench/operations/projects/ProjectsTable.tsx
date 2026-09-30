/**
 * ProjectsTable — the projects as ONE table (PROJECTS-01, 2026-09-30).
 *
 * Project · Task · Status · Minutes · Cost · Account · Deadline · Done, and a
 * last column for each row's controls. Every project and every task is on
 * screen at once — nothing collapses, nothing expands. The projects come in the
 * order the projects GET returns them; each is its own group of rows
 * (ProjectTableRows).
 */

'use client';

import type { AccountCellBook } from '@/lib/coa/accountCell';
import ProjectTableRows from './ProjectTableRows';
import type { Project } from './types';


interface Props {
  projects: Project[];
  entities: (AccountCellBook & { name: string })[];
  showArchived: boolean;
  /** The project a dependency link jumped to (SectionD's lifted target). */
  targetProjectId: string | null;
  onJumpTo: (projectId: string) => void;
  onClearTarget: () => void;
  onProjectsChanged: () => void;
}

export default function ProjectsTable({
  projects, entities, showArchived, targetProjectId, onJumpTo, onClearTarget, onProjectsChanged,
}: Props) {
  return (
    <div className="overflow-x-auto border border-border rounded bg-white">
      <table className="w-full min-w-[64rem] border-collapse text-xs" data-projects-table>
        <thead>
          <tr className="text-left text-text-faint uppercase tracking-wide">
            <th className="px-2 py-1.5 font-normal">Project</th>
            <th className="px-2 py-1.5 font-normal">Task</th>
            <th className="px-2 py-1.5 font-normal">Status</th>
            <th className="px-2 py-1.5 font-normal">Minutes</th>
            <th className="px-2 py-1.5 font-normal">Cost</th>
            <th className="px-2 py-1.5 font-normal">Account</th>
            <th className="px-2 py-1.5 font-normal">Deadline</th>
            <th className="px-2 py-1.5 font-normal">Done</th>
            <th className="px-2 py-1.5 font-normal"><span className="sr-only">controls</span></th>
          </tr>
        </thead>
        {projects.map((p) => (
          <ProjectTableRows
            key={p.id}
            project={p}
            entities={entities}
            allProjects={projects}
            showArchived={showArchived}
            onProjectsChanged={onProjectsChanged}
            isJumpTarget={targetProjectId === p.id}
            onClearTarget={onClearTarget}
            onJumpTo={onJumpTo}
          />
        ))}
      </table>
    </div>
  );
}
