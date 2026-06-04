/**
 * ScriptGenerator — S4 of the pipeline (OPS-CE-5): generate the day's reel voiceover
 * from the answers + task record, human-gated, on the surface.
 *
 * Resolves the day's canonical piece (cross-entity, like DailyLog), counts its answers,
 * and:
 *   - "generate script" (disabled with a reason when the day has no answers) → POST
 *     /content/generate-script { piece_id } → the script renders inline as an EDITABLE
 *     textarea with the [scene N · activity] tags + word count + ~read time.
 *   - "save" → PATCH /content/grid/piece/[pieceId] { script } → persists to piece.script.
 *   - "regenerate" → a fresh run (new operations_ai_usage row); saving overwrites the
 *     draft (history lives in ai_usage).
 * A saved script renders on the surface when present. Nothing saves without Alex's action.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CONTENT_DAY_PLAN_CHANGED_EVENT, CONTENT_SCENES_CHANGED_EVENT } from './ScenifyModal';

interface PieceLite {
  id: string;
  piece_date: string;
  script: string | null;
  execution_notes: string | null;
}
interface CellLite {
  piece_id: string;
  script: string | null;
}

const dayOf = (iso: string) => iso.slice(0, 10);

// The DAY-AUDIT prompt — Alex runs this in Claude Code, pastes the output as notes.
const DAY_AUDIT_PROMPT = `DAY-AUDIT (READ-ONLY) — Tell me what actually shipped today, in plain language.
git fetch origin && git log origin/main --since="today 00:00" --oneline --merges
For each PR/commit merged today: ONE line, plain words a non-programmer understands —
what changed for the user (not the code mechanics). Note anything merged but not yet
usable (e.g. migration pending). No jargon, no file paths, no code. Output a short
bullet list I can paste as today's execution notes. Read-only — touch nothing.`;

// ~150 words/min spoken → mm:ss.
const readTime = (words: number): string => {
  const secs = Math.round((words / 150) * 60);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};

export default function ScriptGenerator({ date }: { date: string }) {
  const [pieces, setPieces] = useState<PieceLite[]>([]);
  const [cells, setCells] = useState<CellLite[]>([]);
  const [draft, setDraft] = useState<string | null>(null); // null = not loaded/edited yet
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // OPS-CE-5B: the receipts.
  const [execNotes, setExecNotes] = useState('');
  const [execSaving, setExecSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/operations/content/grid', { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to load (${res.status})`);
      const body = await res.json();
      setPieces(body.pieces ?? []);
      setCells(body.cells ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const refresh = () => void load();
    window.addEventListener(CONTENT_DAY_PLAN_CHANGED_EVENT, refresh);
    window.addEventListener(CONTENT_SCENES_CHANGED_EVENT, refresh);
    return () => {
      window.removeEventListener(CONTENT_DAY_PLAN_CHANGED_EVENT, refresh);
      window.removeEventListener(CONTENT_SCENES_CHANGED_EVENT, refresh);
    };
  }, [load]);

  // Canonical piece for the date (first across entities — matches DailyLog).
  const piece = useMemo(
    () => pieces.find((p) => dayOf(p.piece_date) === date) ?? null,
    [pieces, date]
  );
  const answersCount = useMemo(
    () => (piece ? cells.filter((c) => c.piece_id === piece.id && (c.script ?? '').trim().length > 0).length : 0),
    [cells, piece]
  );

  // Reset the editor draft + execution notes to the saved values on day/piece change.
  useEffect(() => {
    setDraft(piece?.script ?? null);
    setExecNotes(piece?.execution_notes ?? '');
    setNotice(null);
    setError(null);
  }, [piece?.id, piece?.script, piece?.execution_notes]);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(DAY_AUDIT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy — select the prompt and copy manually.');
    }
  };

  const saveNotes = async () => {
    if (execSaving || !piece) return;
    setExecSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/content/grid/piece/${piece.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ execution_notes: execNotes }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? `failed (${res.status})`);
      const saved = body.piece?.execution_notes ?? (execNotes.trim() || null);
      setPieces((prev) => prev.map((p) => (p.id === piece.id ? { ...p, execution_notes: saved } : p)));
      setNotice('Execution notes saved.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save notes');
    } finally {
      setExecSaving(false);
    }
  };

  const disabledReason = !piece
    ? 'Start the day’s log first (section 3 · Answer).'
    : answersCount === 0
      ? 'Answer the day’s scenes first — the script is built only from what you logged.'
      : null;

  const generate = async () => {
    if (generating || !piece || disabledReason) return;
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/operations/content/generate-script', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ piece_id: piece.id }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? `failed (${res.status})`);
      setDraft(body.script ?? '');
      setNotice(`Generated from ${body.scenes_used} answer${body.scenes_used === 1 ? '' : 's'} + ${body.tasks_used} task block${body.tasks_used === 1 ? '' : 's'}. Edit, then save.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to generate script');
    } finally {
      setGenerating(false);
    }
  };

  const save = async () => {
    if (saving || !piece || draft === null) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/operations/content/grid/piece/${piece.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: draft }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? `failed (${res.status})`);
      setPieces((prev) => prev.map((p) => (p.id === piece.id ? { ...p, script: body.piece?.script ?? draft } : p)));
      setNotice('Saved to the day.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to save script');
    } finally {
      setSaving(false);
    }
  };

  const words = (draft ?? '').trim() ? (draft as string).trim().split(/\s+/).length : 0;
  const hasScript = draft !== null;

  return (
    <section className="bg-white rounded border border-border shadow-sm p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-mono text-sm font-medium tracking-wide text-brand-purple">
          4 · SCRIPT
          <span className="ml-2 font-normal text-text-muted">the day&rsquo;s answers + task record → reel voiceover</span>
        </h2>
        <div className="flex items-center gap-2">
          {hasScript && (
            <span className="font-mono text-xs text-text-muted">
              {words} words · ~{readTime(words)} read
            </span>
          )}
          <button
            type="button"
            onClick={generate}
            disabled={generating || !!disabledReason}
            title={disabledReason ?? undefined}
            className="px-3 py-1 font-mono text-xs border border-brand-purple rounded text-brand-purple hover:bg-purple-100/50 disabled:opacity-50"
          >
            {generating ? 'writing…' : hasScript ? '↻ regenerate' : '✨ generate script'}
          </button>
        </div>
      </div>

      {disabledReason && <p className="font-mono text-xs text-text-muted">{disabledReason}</p>}
      {notice && (
        <div className="font-mono text-xs px-3 py-2 rounded border bg-purple-50 border-brand-purple/40 text-text-primary">{notice}</div>
      )}
      {error && (
        <div className="font-mono text-xs px-3 py-2 rounded border bg-red-50 border-red-200 text-red-800">{error}</div>
      )}

      {/* DAY-AUDIT helper — run in Claude Code, paste the output below. Always visible. */}
      <div className="rounded border border-border-light bg-bg-row p-3 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-xs text-brand-purple font-medium uppercase tracking-wide">
            Day-audit — run this in Claude Code, paste the output below
          </span>
          <button
            type="button"
            onClick={copyPrompt}
            className="px-2 py-0.5 font-mono text-xs border border-brand-purple rounded text-brand-purple hover:bg-purple-100/50"
          >
            {copied ? 'copied ✓' : 'copy prompt'}
          </button>
        </div>
        <pre className="font-mono text-[11px] leading-relaxed text-text-muted whitespace-pre-wrap break-words bg-white border border-border-light rounded p-2">
{DAY_AUDIT_PROMPT}
        </pre>
      </div>

      {/* EXECUTION NOTES — the authoritative receipts. */}
      <div className="space-y-1">
        <label className="font-mono text-xs text-brand-purple font-medium uppercase tracking-wide">
          Execution notes (optional)
        </label>
        <p className="font-mono text-xs text-text-muted">
          what actually got built/done today, in your words — the receipts. The script grounds its work claims in this.
        </p>
        <textarea
          value={execNotes}
          onChange={(e) => setExecNotes(e.target.value)}
          rows={4}
          disabled={!piece}
          placeholder={piece ? 'paste the day-audit bullets, or jot the receipts…' : 'start the day’s log first (section 3)'}
          className="w-full resize-y bg-white border border-brand-purple/40 rounded px-3 py-2 font-mono text-xs leading-relaxed text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple disabled:opacity-50"
        />
        <button
          type="button"
          onClick={saveNotes}
          disabled={execSaving || !piece}
          className="px-3 py-1 font-mono text-xs border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
        >
          {execSaving ? 'saving…' : 'save notes'}
        </button>
      </div>

      {hasScript && (
        <div className="space-y-2">
          <textarea
            value={draft ?? ''}
            onChange={(e) => setDraft(e.target.value)}
            rows={16}
            placeholder="the reel voiceover, scene-tagged…"
            className="w-full resize-y bg-white border border-brand-purple/40 rounded px-3 py-2 font-mono text-xs leading-relaxed text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="px-3 py-1 font-mono text-xs border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
            >
              {saving ? 'saving…' : 'save to the day'}
            </button>
            <span className="font-mono text-xs text-text-muted">edits are yours — saving overwrites the day&rsquo;s script (every run is logged)</span>
          </div>
        </div>
      )}
    </section>
  );
}
