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
import type { RoutineForm, CadenceMode, CadenceGroup } from '@/components/workbench/operations/routines/types';
import {
  DEFAULT_ROUTINE_FORM,
  CADENCE_GROUP_LABELS,
  CADENCE_GROUP_ORDER,
  CADENCE_MODE_LABELS,
} from '@/components/workbench/operations/routines/types';

interface Props {
  /** The existing home login-modal trigger (ModuleLauncher's onRequireAuth) — the
   *  same one Travel/Trading gate their submit to. Left wired for PR-2's
   *  "sign up to save" conversion; not used as the create action anymore. */
  onRequireAuth: () => void;
}

// A guest-built routine = the form shape + a client-only id (for list keys + delete). In-memory only.
type GuestRoutine = RoutineForm & { id: string };

// Map a form cadence mode to its display group (for the cadence-count chips). quarterly/yearly are
// not reachable from the form's modes, so those chips simply stay at 0.
const groupForMode = (m: CadenceMode): CadenceGroup =>
  m === 'daily' ? 'daily' : m === 'weekly' ? 'weekly' : m === 'custom' ? 'custom' : 'monthly';

export default function RoutineCreateForm({ onRequireAuth }: Props) {
  // Local form state only — same shape the real RoutineList uses. No fetch seeds it.
  const [form, setForm] = useState<RoutineForm>(DEFAULT_ROUTINE_FORM);
  // GUEST BUILD-IN-MEMORY: routines a logged-out visitor creates live ONLY here, in React state —
  // no DB, no fetch, no localStorage. They vanish on refresh (intended). Signing up (PR-2, via
  // onRequireAuth) will be the only way to persist them.
  const [routines, setRoutines] = useState<GuestRoutine[]>([]);

  // HOME-STYLE-PR-1: contrast pass (existing palette only). White field on the light-
  // gray panel (bg-bg-row) so edges show; darker muted-purple border (brand-purple/40,
  // alpha-derived from the existing token — no new color); readable typed/placeholder
  // text; purple focus ring (brand-purple/20 ≈ the approved rgba(83,74,183,0.15)).
  const inputClass =
    'w-full px-2 py-1 bg-white border border-brand-purple/40 rounded text-xs font-mono text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-purple focus:ring-2 focus:ring-brand-purple/20';
  // Labels → dark brand-purple, weight 500 (scannable, not ghost-gray).
  const labelClass = 'text-brand-purple font-medium uppercase tracking-wide mb-1 text-xs font-mono';

  // GUEST BUILD: validate locally and APPEND to in-memory state — NO fetch, NO POST, NO DB.
  // An empty name is rejected (mirrors the real form's required name); the form resets for the
  // next entry. (onRequireAuth stays wired for PR-2's "sign up to save" conversion.)
  const handleAdd = () => {
    const name = form.name.trim();
    if (!name) return;
    setRoutines((prev) => [...prev, { ...form, name, id: crypto.randomUUID() }]);
    setForm(DEFAULT_ROUTINE_FORM);
  };
  const handleDelete = (id: string) => setRoutines((prev) => prev.filter((r) => r.id !== id));

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
            onClick={handleAdd}
            disabled={!form.name.trim()}
            className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded text-xs font-mono hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Add routine <span aria-hidden>+</span>
          </button>
        </div>
      </div>

      {/* ── routines OUTPUT — the guest's IN-MEMORY routines (no fetch, no DB). Cadence-count
          chips + one row per built routine (name · cadence · time), each with delete. ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className={labelClass}>your routines</span>
          <span className="text-text-muted text-[10px] font-mono">
            {routines.length} routine{routines.length === 1 ? '' : 's'} · in your browser (not saved)
          </span>
        </div>
        {/* Cadence-count chips (Daily / Weekly / Monthly / …), counted from the built routines. */}
        <div className="flex flex-wrap gap-1 mb-2">
          {CADENCE_GROUP_ORDER.map((g) => {
            const count = routines.filter((r) => groupForMode(r.cadence_mode) === g).length;
            return (
              <span
                key={g}
                className="px-1.5 py-0.5 border border-gray-200 bg-gray-50 text-text-muted rounded text-[10px] font-mono"
              >
                {CADENCE_GROUP_LABELS[g]} ({count})
              </span>
            );
          })}
        </div>
        <div className="border border-gray-200 rounded overflow-hidden">
          <div className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 bg-gray-50 border-b border-gray-200 px-3 py-1.5 text-[10px] font-mono uppercase tracking-wider text-text-muted">
            <span>Routine</span>
            <span>Cadence</span>
            <span>Time</span>
            <span className="sr-only">Remove</span>
          </div>
          {routines.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs font-mono text-text-muted italic">
              No routines yet — fill in the form above and click “Add routine”. Built routines live in your browser only.
            </div>
          ) : (
            routines.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-[2fr_1fr_1fr_auto] gap-2 items-center border-b border-gray-100 px-3 py-1.5 text-xs font-mono text-text-primary"
              >
                <span className="truncate">{r.name}</span>
                <span className="text-text-muted">{CADENCE_MODE_LABELS[r.cadence_mode]}</span>
                <span className="text-text-muted">
                  {r.start_time ? (r.end_time ? `${r.start_time}–${r.end_time}` : r.start_time) : 'all-day'}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(r.id)}
                  aria-label={`Remove ${r.name}`}
                  className="text-text-muted hover:text-rose-600 px-1"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PR-2: "sign up to save" conversion — shown once the guest has built ≥1 routine (so the
          message is truthful: there's something here, and it will NOT persist). The button reuses
          the existing onRequireAuth register-modal trigger — no new handler, no fetch, no route.
          Copy is HONEST: signing up lets them START saving routines; it does NOT claim the
          in-memory ones auto-transfer — no such import path exists (verified: nothing reads guest
          routines after signup). */}
      {routines.length >= 1 && (
        <div className="flex flex-col items-start gap-2 rounded-lg border border-brand-purple/40 bg-brand-purple/5 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-text-secondary">
            These routines live in this browser only and are not saved. Make a free account to start
            saving routines and watch them land on your calendar.
          </p>
          <button
            type="button"
            onClick={onRequireAuth}
            className="shrink-0 rounded bg-brand-purple px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
          >
            Make a free account
          </button>
        </div>
      )}
    </div>
  );
}
