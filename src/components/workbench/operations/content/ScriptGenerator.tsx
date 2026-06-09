/**
 * ScriptGenerator — the LIVE, authed container for S4 (OPS-CE-5): generate the
 * day's reel voiceover from the answers + task record, human-gated.
 *
 * PR C split: this file keeps the EXACT live behavior it had before — it owns
 * ALL four fetches (GET content grid load / PATCH execution notes / POST the
 * PAID generate-script / PATCH save script), the mount + event-listener loads,
 * the day-piece resolution, the editor draft/notes state, and the clipboard
 * helper — and now renders the pure <ScriptGeneratorView/> with the live values
 * + the real handlers wired to its callbacks. The public name + prop shape
 * ({ date }) are unchanged, so the existing call site (ContentPipeline.tsx:565)
 * is untouched and /operations/content generates scripts EXACTLY as before — the
 * PAID, tier-gated POST /content/generate-script still fires here for authed
 * users. The paid call is container-only: it is NEVER reachable from the pure
 * view. NO new behavior, NO demo data, NO fallback.
 */

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CONTENT_DAY_PLAN_CHANGED_EVENT, CONTENT_SCENES_CHANGED_EVENT } from './ScenifyModal';
import ScriptGeneratorView from './ScriptGeneratorView';

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

  // PAID Anthropic — POST /content/generate-script (tier-gated server-side).
  // Container-only: never reachable from the pure <ScriptGeneratorView/>.
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

  return (
    <ScriptGeneratorView
      dayAuditPrompt={DAY_AUDIT_PROMPT}
      hasPiece={piece !== null}
      disabledReason={disabledReason}
      draft={draft}
      execNotes={execNotes}
      generating={generating}
      saving={saving}
      execSaving={execSaving}
      error={error}
      notice={notice}
      copied={copied}
      onGenerate={generate}
      onSave={save}
      onSaveNotes={saveNotes}
      onCopyPrompt={copyPrompt}
      onDraftChange={setDraft}
      onExecNotesChange={setExecNotes}
    />
  );
}
