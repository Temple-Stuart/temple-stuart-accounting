/**
 * QuestionLibrary — the minimal manager for Alex's reusable scene-question
 * library (OPS-CE-3 enabler). List active questions, add one, archive one.
 *
 * The library is the framework CE-3's AI enrich ASSIGNS from — empty by default
 * with no UI, so this is the enabler that makes Stage-1 useful. Archive is
 * soft-delete (never hard-delete: scene-rows snapshot a question's wording).
 *
 * Entity-scoped via the operations entity selector. Existing palette only.
 * No edit UI beyond add/archive (one concept — polish later).
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useOperationsEntity } from '../EntitySelector';

interface Question {
  id: string;
  question_text: string;
  label: string | null;
  sort_order: number;
}

const inputClass =
  'w-full px-2 py-1 border border-border rounded text-xs font-mono text-text-primary focus:outline-none focus:border-brand-purple';

export default function QuestionLibrary() {
  const { selectedEntityId } = useOperationsEntity();
  const [questions, setQuestions] = useState<Question[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [newText, setNewText] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const qs = selectedEntityId ? `?entity_id=${encodeURIComponent(selectedEntityId)}` : '';
      const res = await fetch(`/api/operations/content/questions${qs}`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to load questions (${res.status})`);
      const body = await res.json();
      setQuestions(body.questions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load questions');
    }
  }, [selectedEntityId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = async () => {
    if (busy) return;
    const text = newText.trim();
    if (text.length === 0) {
      setError('question text is required');
      return;
    }
    if (!selectedEntityId) {
      setError('select an entity (top of the Operations tab) before adding a question');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/operations/content/questions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question_text: text,
          label: newLabel.trim() || undefined,
          entity_id: selectedEntityId,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? `add failed (${res.status})`);
      setNewText('');
      setNewLabel('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to add question');
    } finally {
      setBusy(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/content/questions/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message ?? body?.error ?? `archive failed (${res.status})`);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to archive question');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full border border-border-light rounded bg-white text-xs font-mono">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-text-primary hover:bg-bg-row"
      >
        <span className="font-semibold">
          ❓ Question library{questions ? ` (${questions.length})` : ''}
        </span>
        <span className="text-text-faint">{open ? 'hide' : 'manage'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-3 border-t border-border-light pt-3">
          <p className="text-text-muted">
            Your reusable on-camera questions. AI suggest assigns the best fit per scene; you can
            archive (never deleted — scenes keep the exact wording they asked).
          </p>

          {error && (
            <div className="px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">{error}</div>
          )}

          {/* Add */}
          <div className="grid grid-cols-1 gap-2 border border-border-light rounded p-2 bg-bg-row/30">
            <div className="grid grid-cols-3 gap-2">
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="label (optional, e.g. day_score)"
                maxLength={200}
                className={`${inputClass} col-span-1`}
              />
              <input
                type="text"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="question text (e.g. what's the discomfort you're choosing today?)"
                className={`${inputClass} col-span-2`}
              />
            </div>
            <div>
              <button
                type="button"
                onClick={handleAdd}
                disabled={busy}
                className="px-3 py-1 border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'saving…' : 'add question'}
              </button>
            </div>
          </div>

          {/* List */}
          {questions === null ? (
            <p className="text-text-faint">Loading…</p>
          ) : questions.length === 0 ? (
            <p className="text-text-muted">No questions yet — add your framework above.</p>
          ) : (
            <ul className="space-y-1">
              {questions.map((q) => (
                <li
                  key={q.id}
                  className="flex items-start justify-between gap-2 border border-border-light rounded px-2 py-1"
                >
                  <span className="text-text-primary">
                    {q.label && (
                      <span className="mr-2 px-1.5 py-0.5 rounded bg-purple-50 text-brand-purple text-[10px]">
                        {q.label}
                      </span>
                    )}
                    {q.question_text}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleArchive(q.id)}
                    disabled={busy}
                    className="shrink-0 px-2 py-0.5 border border-border rounded text-text-muted hover:bg-bg-row disabled:opacity-50"
                  >
                    archive
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
