/**
 * ProjectsTable — the projects as ONE table (PROJECTS-01, 2026-09-30).
 *
 * WORK-01 (Alex, 2026-10-24) — ruling E: PROJECTS keeps project rows only. The
 * columns are Project · Tasks (the count by status); the task rows left for THE
 * WORK (SectionE_Work), their one home. The projects come in the
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
            <th className="px-2 py-1.5 font-normal">Tasks</th>
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
