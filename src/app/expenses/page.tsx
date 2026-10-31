'use client';

/**
 * TOOL-LAW-01 — /expenses, EXPENSES' ONE PAGE (tool 09, MONEY OUT).
 *
 * EXPENSES-01 (Alex, 2026-10-25, ruling A) — EXPENSES IS A LIVE TAB. ROUTINE
 * EXPENSES (SectionF_RoutineExpenses — one row per routine line: when it is in
 * force, what kind, the account coarse to fine, who is paid, the schedule, the
 * money, the state, the identifier) moved here from /tasks, where WORK-01d had
 * put it as Tasks' third table. The component is unchanged — its two reads (the
 * routines GET beside the routines' month GET), its 21 columns, its "STATUS:
 * active only" chip, "+ routine", the row editor and controls, its CSV and the
 * month route are exactly what /tasks showed; only its mount moved. This page
 * is the same shell as /tasks: the opener (family, name, registry line), the
 * entity provider the section reads (useOperationsEntity) and the one mount.
 * No WorkChangesProvider: nothing in ROUTINE EXPENSES' tree reads or bumps the
 * task-change signal — a routine change re-reads this table alone (the
 * section's own header says so).
 *
 * Tasks is THE WORK and PROJECTS now (ruling B; src/app/tasks/page.tsx). The
 * registry row says what the page does and does not do (toolRegistry.ts, the
 * Expenses row — ruling C); PHASES_RENDERED_AT['/expenses'] is [] (nav.ts): no
 * strip, no phase, no receipts — the capability is plain controls on the rows,
 * as TASKS-01 ruled for /tasks, and the law (scripts/assert-tool-registry.ts,
 * the two-lists block) refuses a StageStrip anywhere in this page's import tree
 * and holds the container to exactly this one mount. Calendar, Time, Budget and
 * the day card read routines as before (ruling D); the rail shows Expenses in
 * its registry position, MONEY OUT after Payroll, by derivation (ruling E).
 */
import AppLayout from '@/components/ui/AppLayout';
import ToolOpener from '@/components/shell/ToolOpener';
import { navToolByName } from '@/lib/nav';
import { TOOL_GATE } from '@/lib/offer';
import { OperationsEntityProvider } from '@/components/workbench/operations/EntitySelector';
// EXPENSES-01 (Alex, 2026-10-25, ruling A): ROUTINE EXPENSES mounts here and nowhere else — the component in place, its
// reads, columns, chip, "+ routine", editor, controls, CSV and month route unchanged.
import SectionF_RoutineExpenses from '@/components/workbench/operations/SectionF_RoutineExpenses';

export default function ExpensesPage() {
  return (
    <AppLayout page>
      <ToolOpener tools={[navToolByName('Expenses', TOOL_GATE)]} />
      <OperationsEntityProvider>
        <div className="space-y-3" data-tool-page="Expenses">
          <SectionF_RoutineExpenses />
        </div>
      </OperationsEntityProvider>
    </AppLayout>
  );
}
