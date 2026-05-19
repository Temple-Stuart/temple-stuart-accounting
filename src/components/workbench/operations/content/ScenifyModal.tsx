/**
 * ScenifyModal — inline form for converting a routine into a content scene.
 *
 * Operations-surface convention: this is an inline expanding form (not an
 * overlay dialog) — matching RoutineList's create form. It renders nothing
 * when `open` is false.
 *
 * POSTs to /api/operations/content/scenes. scene_number and scene_title are
 * required; the four content fields are optional. UNIQUE conflicts (409) and
 * validation errors (400) surface inline above the action buttons — no toast.
 */

'use client';

import { useState } from 'react';
import type { Scene } from './ContentTable';

const inputClass =
  'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';
const labelClass = 'text-text-faint uppercase tracking-wide mb-1 text-xs font-mono';

export default function ScenifyModal({
  routine,
  open,
  onClose,
  onSuccess,
}: {
  routine: { id: string; name: string };
  open: boolean;
  onClose: () => void;
  onSuccess: (newScene: Scene) => void;
}) {
  const [sceneNumber, setSceneNumber] = useState<number | ''>('');
  const [sceneTitle, setSceneTitle] = useState('');
  const [focusCategory, setFocusCategory] = useState('');
  const [filmingLocationBase, setFilmingLocationBase] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [script, setScript] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async () => {
    setError(null);

    if (
      typeof sceneNumber !== 'number' ||
      !Number.isInteger(sceneNumber) ||
      sceneNumber <= 0
    ) {
      setError('Scene number must be a positive integer');
      return;
    }
    const title = sceneTitle.trim();
    if (title.length === 0) {
      setError('Scene title is required');
      return;
    }

    const body: Record<string, unknown> = {
      routine_id: routine.id,
      scene_number: sceneNumber,
      scene_title: title,
    };
    if (focusCategory.trim()) body.focus_category = focusCategory.trim();
    if (filmingLocationBase.trim()) body.filming_location_base = filmingLocationBase.trim();
    if (estimatedHours.trim()) body.estimated_hours = parseFloat(estimatedHours);
    if (script.trim()) body.script = script.trim();

    setSubmitting(true);
    try {
      const res = await fetch('/api/operations/content/scenes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      let parsed: { error?: string; message?: string; scene?: Scene } = {};
      try {
        parsed = await res.json();
      } catch {
        // non-JSON response — fall through to a status-based message
      }

      if (!res.ok) {
        if (res.status === 401) {
          setError('Unauthorized — please log in again');
        } else {
          setError(parsed.message ?? parsed.error ?? `Request failed (${res.status})`);
        }
        setSubmitting(false);
        return;
      }

      if (!parsed.scene) {
        setError('Scene created but the response was malformed');
        setSubmitting(false);
        return;
      }

      onSuccess(parsed.scene);
      setSubmitting(false);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to create scene');
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full border border-brand-purple rounded p-3 bg-purple-50/30 text-xs font-mono space-y-3">
      <div className="font-bold text-text-primary">🎬 Scenify "{routine.name}"</div>

      {error && (
        <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className={labelClass}>scene number *</div>
          <input
            type="number"
            min={1}
            value={sceneNumber}
            onChange={(e) => {
              setError(null);
              setSceneNumber(e.target.value === '' ? '' : Number(e.target.value));
            }}
            className={inputClass}
          />
        </div>
        <div>
          <div className={labelClass}>estimated hours (optional)</div>
          <input
            type="number"
            step={0.01}
            min={0}
            max={999.99}
            value={estimatedHours}
            onChange={(e) => {
              setError(null);
              setEstimatedHours(e.target.value);
            }}
            className={inputClass}
          />
        </div>
        <div className="col-span-2">
          <div className={labelClass}>scene title *</div>
          <input
            type="text"
            maxLength={500}
            value={sceneTitle}
            onChange={(e) => {
              setError(null);
              setSceneTitle(e.target.value);
            }}
            className={inputClass}
          />
        </div>
        <div>
          <div className={labelClass}>focus category (optional)</div>
          <input
            type="text"
            maxLength={200}
            value={focusCategory}
            onChange={(e) => {
              setError(null);
              setFocusCategory(e.target.value);
            }}
            className={inputClass}
          />
        </div>
        <div>
          <div className={labelClass}>filming location base (optional)</div>
          <input
            type="text"
            maxLength={200}
            value={filmingLocationBase}
            onChange={(e) => {
              setError(null);
              setFilmingLocationBase(e.target.value);
            }}
            className={inputClass}
          />
        </div>
        <div className="col-span-2">
          <div className={labelClass}>script (optional)</div>
          <textarea
            value={script}
            onChange={(e) => {
              setError(null);
              setScript(e.target.value);
            }}
            rows={3}
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border-light">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={submitting}
          className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'creating…' : 'create scene'}
        </button>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="px-3 py-1 border border-border rounded hover:bg-bg-row disabled:opacity-50"
        >
          cancel
        </button>
      </div>
    </div>
  );
}
