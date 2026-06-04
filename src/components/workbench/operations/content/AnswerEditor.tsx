/**
 * AnswerEditor — the question-forward, compact editor for a cell (OPS-CE-4).
 *
 * A cell = Alex's ANSWER to the scene's assigned question. This replaces the old
 * "write the script" framing: the question is shown prominently, the b-roll is a
 * small filming cue, and the textarea captures the day's answer. The script
 * (voiceover) is GENERATED later from all answers (CE-5) — nothing generates here.
 *
 * Storage is unchanged: the answer is saved through the SAME cell upsert that
 * wrote the "script" before (operations_content_takes.script). The parent passes
 * onSave(answer) which performs that upsert; save semantics mirror ScriptDrawer
 * (trim, empty→null, no-change→cancel without firing the write).
 *
 * Used by BOTH the grid cell panel (PieceGrid) and the Daily Log rows, so the
 * answering experience is identical wherever Alex answers.
 */

'use client';

import { useState } from 'react';

export default function AnswerEditor({
  questionText,
  narrativePurpose,
  bRoll,
  activityLabel,
  dateLabel,
  initialAnswer,
  onSave,
  onCancel,
  autoFocus = true,
}: {
  questionText: string | null;
  narrativePurpose: string | null;
  bRoll: string | null;
  activityLabel: string;
  dateLabel: string;
  initialAnswer: string | null;
  onSave: (answer: string | null) => Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}) {
  const [draft, setDraft] = useState(initialAnswer ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The question is the heart of the cell. Fall back to the scene's narrative
  // purpose, then to a clear "set one in Scenify" hint — never a blank prompt.
  const hasQuestion = !!(questionText && questionText.trim());
  const hasPurpose = !hasQuestion && !!(narrativePurpose && narrativePurpose.trim());

  const handleSave = async () => {
    if (saving) return;
    const trimmed = draft.trim();
    const next: string | null = trimmed === '' ? null : trimmed;
    if (next === (initialAnswer ?? null)) {
      onCancel?.();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="font-mono text-xs space-y-3">
      <div className="text-text-muted">
        <span className="text-text-primary font-semibold">{activityLabel}</span>
        <span className="mx-1.5 text-text-faint">·</span>
        {dateLabel}
      </div>

      {/* The question — prominent. */}
      {hasQuestion ? (
        <div className="border-l-2 border-brand-purple bg-purple-50/40 rounded px-3 py-2">
          <div className="text-text-faint uppercase tracking-wide text-[10px] mb-0.5">question</div>
          <div className="text-sm font-semibold text-text-primary leading-snug">{questionText}</div>
        </div>
      ) : hasPurpose ? (
        <div className="border-l-2 border-border bg-bg-row rounded px-3 py-2">
          <div className="text-text-faint uppercase tracking-wide text-[10px] mb-0.5">scene purpose</div>
          <div className="text-sm font-medium text-text-primary leading-snug">{narrativePurpose}</div>
        </div>
      ) : (
        <div className="border-l-2 border-border bg-bg-row rounded px-3 py-2 text-text-muted">
          No question assigned — set one in Scenify (✨ AI suggest assigns the best fit).
        </div>
      )}

      {/* B-roll cue — a small filming reminder, not the focus. */}
      {bRoll && bRoll.trim() && (
        <div className="text-text-muted">
          <span aria-hidden="true">🎥</span> <span className="text-text-faint">b-roll:</span> {bRoll}
        </div>
      )}

      {/* The answer. */}
      <div>
        <div className="text-text-faint uppercase tracking-wide text-[10px] mb-1">your answer for today</div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={saving}
          autoFocus={autoFocus}
          rows={5}
          placeholder="answer the question in your own words…"
          className="w-full resize-y border border-border rounded px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-brand-purple disabled:opacity-50"
        />
      </div>

      {error && (
        <div className="text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">{error}</div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={() => !saving && onCancel()}
            disabled={saving}
            className="px-3 py-1.5 border border-border rounded hover:bg-bg-row disabled:opacity-50"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-3 py-1.5 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save answer'}
        </button>
      </div>
    </div>
  );
}
