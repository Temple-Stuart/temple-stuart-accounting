/**
 * ProjectsPipelineShowroom — the public-safe Operations Projects pipe for the
 * home page. "Locked but visible": it renders the REAL slot-based ProjectRowView
 * fully expanded, fed entirely by the PR6 static demo seed, so a logged-out
 * visitor sees the genuine product — the 5-step scoping fields, a live-looking
 * task list (mixed statuses), the evolution timeline, and the dependency edges.
 *
 * SAFE BY CONSTRUCTION — NOTHING fetches at any depth:
 *   - The three sections are injected as slots built from the PURE LEAF VIEWS
 *     (TaskListView → TaskRowView via renderTaskRow, EvolutionTimelineView,
 *     DependencyListView). No live container (TaskList/EvolutionTimeline/
 *     DependencyList/TaskRow/ProjectRow) is imported or reachable, so no
 *     self-fetch on mount exists anywhere in this subtree.
 *   - EVERY action callback every view requires — including the two PAID
 *     Anthropic AI triggers (onGenerateDesign / onGenerateTasks) — is bound to a
 *     single inert `lock` handler that does ONLY onRequireAuth() (open the
 *     existing sign-up modal). No fetch, no demo-seed mutation, no navigation
 *     beyond the modal. A visitor cannot reach the server or a paid call.
 *
 * This component does NOT wire itself into the home page — that is a later PR.
 * It takes onRequireAuth as a prop (page.tsx supplies the real modal trigger,
 * the same one OperationsShowroom/Travel/Trading use).
 */

'use client';

import { useRef } from 'react';
import ProjectRowView from '../ProjectRowView';
import TaskListView from '../TaskListView';
import TaskRowView from '../TaskRowView';
import EvolutionTimelineView from '../EvolutionTimelineView';
import DependencyListView from '../DependencyListView';
import { DEFAULT_PROJECT_FORM, DEFAULT_TASK_FORM, DEFAULT_DEPENDENCY_FORM } from '../types';
import {
  demoProject,
  demoEntities,
  demoAllProjects,
  demoProjectId,
  demoTasks,
  demoCoaAccounts,
  demoOutgoingDependencies,
  demoIncomingDependencies,
  demoEvolution,
} from './demoData';
import { showroomNarrativeCopy, type CopyBlock } from './narrativeCopy';
import { guardShowroomRender } from '@/lib/showroom/renderGuard';

interface Props {
  /** Opens the existing home register/login modal (page.tsx:74 — the same
   *  UI-only trigger OperationsShowroom/Travel/Trading use). Never fetches. */
  onRequireAuth: () => void;
}

/**
 * The single locked handler set. A zero-argument function is assignable to every
 * callback prop signature across all five views (a handler may ignore its args),
 * so ONE inert `lock` provably covers all of them: each does only
 * onRequireAuth() — never a fetch, never a mutation of the demo seed.
 */
function makeLockedHandlers(onRequireAuth: () => void) {
  const lock = () => onRequireAuth();
  return lock;
}

/**
 * A plain-language note rendered above a pipe section (the human "what is this"
 * for the real UI below it). Pure presentational — text only, no data, no
 * callbacks. Voice/wording live in showroomNarrativeCopy (PR8), never inline.
 */
function SectionNote({ copy }: { copy: CopyBlock }) {
  return (
    <div className="mb-2">
      <div className="text-xs font-mono font-semibold text-text-primary">{copy.heading}</div>
      <div className="text-xs font-mono text-text-muted">{copy.body}</div>
    </div>
  );
}

export default function ProjectsPipelineShowroom({ onRequireAuth }: Props) {
  const lock = makeLockedHandlers(onRequireAuth);

  // Required by ProjectRowView; the container normally owns the scroll-into-view
  // effect, but the showroom needs no jump — a null-current ref satisfies the
  // contract and triggers nothing.
  const rowRef = useRef<HTMLDivElement>(null);

  // ── taskSection: real TaskListView, rows = pure TaskRowView (NOT TaskRow) ──
  const taskSection = (
    <>
      <SectionNote copy={showroomNarrativeCopy.sections.tasks} />
    <TaskListView
      tasks={demoTasks}
      loading={false}
      error={null}
      coaAccounts={demoCoaAccounts}
      showArchived={false}
      showCreate={false}
      createForm={DEFAULT_TASK_FORM}
      createSaving={false}
      createError={null}
      onShowArchivedChange={lock}
      onStartCreate={lock}
      onCancelCreate={lock}
      onCreateFormChange={lock}
      onCreate={lock}
      renderTaskRow={(task, index) => (
        <TaskRowView
          task={task}
          index={index}
          coaAccounts={demoCoaAccounts}
          expanded={false}
          editing={false}
          notesOpen={false}
          scheduleMenuOpen={false}
          form={DEFAULT_TASK_FORM}
          scheduleDate=""
          saving={false}
          completing={false}
          deleting={false}
          archiving={false}
          scheduling={false}
          error={null}
          scheduleSuccess={null}
          showHistory={false}
          history={null}
          historyLoading={false}
          historyError={null}
          onToggleExpanded={lock}
          onToggleNotes={lock}
          onEnterEdit={lock}
          onCancelEdit={lock}
          onFormChange={lock}
          onToggleScheduleMenu={lock}
          onCloseScheduleMenu={lock}
          onScheduleDateChange={lock}
          onSave={lock}
          onQuickComplete={lock}
          onToggleHistory={lock}
          onUncomplete={lock}
          onSchedule={lock}
          onDelete={lock}
          onArchive={lock}
          onUnarchive={lock}
        />
      )}
    />
    </>
  );

  // ── evolutionSection: read-only timeline, no callbacks ────────────────────
  const evolutionSection = (
    <>
      <SectionNote copy={showroomNarrativeCopy.sections.evolution} />
      <EvolutionTimelineView loading={false} error={null} data={demoEvolution} />
    </>
  );

  // ── dependencySection: real DependencyListView fed seed edges ─────────────
  const dependencySection = (
    <>
      <SectionNote copy={showroomNarrativeCopy.sections.dependencies} />
    <DependencyListView
      projectId={demoProjectId}
      allProjects={demoAllProjects}
      outgoing={demoOutgoingDependencies}
      incoming={demoIncomingDependencies}
      loading={false}
      error={null}
      showAdvisory={false}
      deletingId={null}
      showCreate={false}
      createForm={DEFAULT_DEPENDENCY_FORM}
      createSaving={false}
      createError={null}
      onJumpTo={lock}
      onToggleAdvisory={lock}
      onStartCreate={lock}
      onCancelCreate={lock}
      onCreateFormChange={lock}
      onCreate={lock}
      onDelete={lock}
    />
    </>
  );

  // LAYER 2 runtime guard (PR10): any fetch initiated during the showroom's
  // synchronous render throws ShowroomFetchError instead of reaching the server.
  // Normal render calls no fetch, so this never trips in normal use.
  return guardShowroomRender(() => (
    <div>
      {/* Intro — what this is, above the pipe. */}
      <div className="mb-4">
        <h2 className="text-base font-semibold text-text-primary mb-1">
          {showroomNarrativeCopy.intro.heading}
        </h2>
        <p className="text-sm text-text-muted">{showroomNarrativeCopy.intro.body}</p>
      </div>

      <ProjectRowView
      project={demoProject}
      entities={demoEntities}
      rowRef={rowRef}
      taskSection={taskSection}
      evolutionSection={evolutionSection}
      dependencySection={dependencySection}
      // Force-expand via static controlled props (these are props, not internal
      // state) so every section is visible; the row never edits (editing=false
      // → the ListManager/InspectionDrawer/AITaskPreview edit-branch children
      // never mount), so nothing in the subtree can fetch.
      expanded={true}
      editing={false}
      form={DEFAULT_PROJECT_FORM}
      saving={false}
      deleting={false}
      archiving={false}
      error={null}
      generatingDesign={false}
      generatedDesignPreview={null}
      generationError={null}
      generationCost={null}
      generationInspection={null}
      generatingTasks={false}
      tasksGenError={null}
      tasksPreview={null}
      flash={false}
      showDesignReasoning={true}
      showEvolution={true}
      researchInput={demoProject.deep_research_input ?? ''}
      auditInput={demoProject.claude_code_audit_input ?? ''}
      savingInputs={false}
      inputsSaved={false}
      onToggleExpanded={lock}
      onEnterEdit={lock}
      onCancelEdit={lock}
      onFormChange={lock}
      onSave={lock}
      onResearchInputChange={lock}
      onAuditInputChange={lock}
      onSaveInputs={lock}
      onToggleDesignReasoning={lock}
      onToggleEvolution={lock}
      // PAID Anthropic AI triggers — LOCKED, not fetched. Both route only to the
      // sign-up modal; no generate-design/generate-tasks call is reachable here.
      onGenerateDesign={lock}
      onGenerateTasks={lock}
      onUseGeneratedDesign={lock}
      onDiscardGeneratedDesign={lock}
      onTasksAccepted={lock}
      onTasksDiscarded={lock}
      onDelete={lock}
      onArchive={lock}
      onUnarchive={lock}
      />

      {/* Closing nudge — friendly sign-up invite, below the pipe. The CTA does
          ONLY onRequireAuth() (the shared lock handler): no fetch, no nav. */}
      <div className="mt-4">
        <p className="text-sm text-text-muted mb-2">{showroomNarrativeCopy.closingNudge.body}</p>
        <button
          type="button"
          onClick={lock}
          className="px-3 py-1.5 border border-brand-purple text-brand-purple rounded text-xs font-mono font-semibold hover:bg-purple-50 transition-colors"
        >
          {showroomNarrativeCopy.closingNudge.ctaLabel} <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  ));
}
