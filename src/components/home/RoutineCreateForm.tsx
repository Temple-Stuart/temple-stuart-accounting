'use client';

// HOME-OPS-PR-1: the REAL routine input form, extracted fetch-free for the public
// home page (mirrors how CreateTripForm/ScanFilterForm were extracted for Travel/
// Trading). Safe by construction:
//   - NO fetch on mount, NO fetch anywhere (unlike RoutineList, which self-fetches
//     GET /api/operations/routines on mount at RoutineList.tsx:51).
//   - The "create routine" submit calls onRequireAuth (the existing home login-modal
//     trigger) and returns BEFORE any network call — exactly like CreateTripForm's
//     onUnauthenticated gate (CreateTripForm.tsx:95-98), which runs before its POST.
//   - Renders the REAL fields (name/description/entity/cadence via the real
//     RRULEBuilder/dates/times) + the REAL routines output table structure, EMPTY.
//
// Logged-out, a visitor sees the genuine input→output and the only consequence of
// "create routine" is the login modal. No server/paid call can fire — there is no
// fetch code here to fire one.

import { useState } from 'react';
import RRULEBuilder from '@/components/workbench/operations/routines/RRULEBuilder';
import type { RoutineForm } from '@/components/workbench/operations/routines/types';
import {
  DEFAULT_ROUTINE_FORM,
  CADENCE_GROUP_LABELS,
  CADENCE_GROUP_ORDER,
} from '@/components/workbench/operations/routines/types';

interface Props {
  /** The existing home login-modal trigger (ModuleLauncher's onRequireAuth) — the
   *  same one Travel/Trading gate their submit to. */
  onRequireAuth: () => void;
}

export default function RoutineCreateForm({ onRequireAuth }: Props) {
  // Local form state only — same shape the real RoutineList uses. No fetch seeds it.
  const [form, setForm] = useState<RoutineForm>(DEFAULT_ROUTINE_FORM);

  // HOME-STYLE-PR-1: contrast pass (existing palette only). White field on the light-
  // gray panel (bg-bg-row) so edges show; darker muted-purple border (brand-purple/40,
  // alpha-derived from the existing token — no new color); readable typed/placeholder
  // text; purple focus ring (brand-purple/20 ≈ the approved rgba(83,74,183,0.15)).
  const inputClass =
    'w-full px-2 py-1 bg-white border border-brand-purple/40 rounded text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20';
  // Labels → dark brand-purple, weight 500 (scannable, not ghost-gray).
  const labelClass = 'text-brand-purple font-medium uppercase tracking-wide mb-1 text-xs font-mono';

  // The gate: logged-out, "create routine" opens the login modal and returns —
  // there is no fetch on this path (or anywhere in this file).
  const handleCreate = () => {
    onRequireAuth();
  };

  return (
    <div className="space-y-4">
      {/* ── REAL input form (fields mirror RoutineList.tsx:219-300 + RRULEBuilder) ── */}
      <div className="border border-border rounded p-3 bg-bg-row space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <div className={labelClass}>name</div>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass}
              maxLength={200}
              placeholder="e.g., Morning reflection"
            />
          </div>
          <div className="col-span-2">
            <div className={labelClass}>description (optional)</div>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              className={inputClass}
              placeholder="what does this routine accomplish?"
            />
          </div>
          <div>
            <div className={labelClass}>entity</div>
            {/* Logged-out has no entity list (no /api/entities fetch here). A neutral
                placeholder stands in; the real entity is chosen after login. */}
            <select className={inputClass} value="preview" disabled>
              <option value="preview">Your workspace · set after login</option>
            </select>
          </div>
        </div>

        {/* The REAL cadence builder — pure controlled, fetch-free (RRULEBuilder.tsx). */}
        <RRULEBuilder form={form} setForm={setForm} />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={labelClass}>start date (optional)</div>
            <input
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <div className={labelClass}>end date (optional)</div>
            <input
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className={labelClass}>start time (optional)</div>
            <input
              type="time"
              value={form.start_time}
              onChange={(e) => setForm({ ...form, start_time: e.target.value })}
              className={inputClass}
            />
          </div>
          <div>
            <div className={labelClass}>end time (optional)</div>
            <input
              type="time"
              value={form.end_time}
              onChange={(e) => setForm({ ...form, end_time: e.target.value })}
              className={inputClass}
            />
          </div>
        </div>

        <div className="pt-2 border-t border-border-light">
          <button
            type="button"
            onClick={handleCreate}
            className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded text-xs font-mono hover:opacity-90"
          >
            Create routine <span aria-hidden>→</span> log in
          </button>
        </div>
      </div>

      {/* ── REAL routines OUTPUT structure, EMPTY (mirrors RoutineList's cadence-
          grouped list; RoutineRow shows name · streak · next due). No data, no fetch. ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={labelClass}>your routines</span>
          <span className="text-text-muted text-[10px] font-mono">0 routines</span>
        </div>
        {/* The real list groups rows by cadence (Daily / Weekly / Monthly / …). */}
        <div className="flex flex-wrap gap-1 mb-2">
          {CADENCE_GROUP_ORDER.map((g) => (
            <span
              key={g}
              className="px-1.5 py-0.5 border border-gray-200 bg-gray-50 text-text-muted rounded text-[10px] font-mono"
            >
              {CADENCE_GROUP_LABELS[g]} (0)
            </span>
          ))}
        </div>
        <div className="border border-gray-200 rounded overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr] gap-2 bg-gray-50 border-b border-gray-200 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-text-muted">
            <span>Routine</span>
            <span>Streak</span>
            <span>Next due</span>
          </div>
          <div className="px-3 py-6 text-center text-xs font-mono text-text-muted italic">
            Your routines appear here once you log in and create one.
          </div>
        </div>
      </div>
    </div>
  );
}
