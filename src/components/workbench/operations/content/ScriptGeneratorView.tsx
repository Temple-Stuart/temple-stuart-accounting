/**
 * ScriptGeneratorView — the PURE, props-only render of the day's reel-voiceover
 * script generator (S4 of the content pipeline).
 *
 * Extracted from ScriptGenerator (PR C). It owns NO data and NO network: no
 * fetch, no API call, no data-loading effect, no context, no server import, and
 * it NEVER names the paid generate route. It is FULLY CONTROLLED — every value
 * (the day's piece state, the editable draft/notes, the pending/feedback flags)
 * arrives as a prop, and every action — INCLUDING the PAID Anthropic generate
 * trigger — arrives as a callback the container owns (`onGenerate`). The view
 * just calls `onGenerate()`; the container is the only place the paid POST can
 * fire. The rendered markup is byte-for-byte equivalent to the pre-extraction
 * ScriptGenerator output.
 *
 * The DAY-AUDIT prompt text is passed in (one source of truth in the container)
 * so the copy-to-clipboard handler and this display stay in sync.
 */

'use client';

// ~150 words/min spoken → mm:ss.
const readTime = (words: number): string => {
  const secs = Math.round((words / 150) * 60);
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
};

export interface ScriptGeneratorViewProps {
  /** The DAY-AUDIT prompt text (container const) — displayed + copied. */
  dayAuditPrompt: string;
  /** Whether the day has a canonical piece (gates the notes editor). */
  hasPiece: boolean;
  /** Non-null = generate is disabled, with this human reason. */
  disabledReason: string | null;
  /** The editable script. null = no script generated/loaded yet. */
  draft: string | null;
  /** The editable execution notes (the receipts). */
  execNotes: string;
  // ── Pending / feedback flags (set around the container's fetches) ───────────
  generating: boolean;
  saving: boolean;
  execSaving: boolean;
  error: string | null;
  notice: string | null;
  copied: boolean;
  // ── Action callbacks (the container owns behavior; PAID call is onGenerate) ──
  /** PAID Anthropic generate — container fires the paid POST; the view only calls this. */
  onGenerate: () => void;
  onSave: () => void;
  onSaveNotes: () => void;
  onCopyPrompt: () => void;
  onDraftChange: (value: string) => void;
  onExecNotesChange: (value: string) => void;
}

export default function ScriptGeneratorView({
  dayAuditPrompt,
  hasPiece,
  disabledReason,
  draft,
  execNotes,
  generating,
  saving,
  execSaving,
  error,
  notice,
  copied,
  onGenerate,
  onSave,
  onSaveNotes,
  onCopyPrompt,
  onDraftChange,
  onExecNotesChange,
}: ScriptGeneratorViewProps) {
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
            onClick={onGenerate}
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
            onClick={onCopyPrompt}
            className="px-2 py-0.5 font-mono text-xs border border-brand-purple rounded text-brand-purple hover:bg-purple-100/50"
          >
            {copied ? 'copied ✓' : 'copy prompt'}
          </button>
        </div>
        <pre className="font-mono text-[11px] leading-relaxed text-text-muted whitespace-pre-wrap break-words bg-white border border-border-light rounded p-2">
{dayAuditPrompt}
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
          onChange={(e) => onExecNotesChange(e.target.value)}
          rows={4}
          disabled={!hasPiece}
          placeholder={hasPiece ? 'paste the day-audit bullets, or jot the receipts…' : 'start the day’s log first (section 3)'}
          className="w-full resize-y bg-white border border-brand-purple/40 rounded px-3 py-2 font-mono text-xs leading-relaxed text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple disabled:opacity-50"
        />
        <button
          type="button"
          onClick={onSaveNotes}
          disabled={execSaving || !hasPiece}
          className="px-3 py-1 font-mono text-xs border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
        >
          {execSaving ? 'saving…' : 'save notes'}
        </button>
      </div>

      {hasScript && (
        <div className="space-y-2">
          <textarea
            value={draft ?? ''}
            onChange={(e) => onDraftChange(e.target.value)}
            rows={16}
            placeholder="the reel voiceover, scene-tagged…"
            className="w-full resize-y bg-white border border-brand-purple/40 rounded px-3 py-2 font-mono text-xs leading-relaxed text-text-primary focus:outline-none focus:ring-2 focus:ring-brand-purple/20 focus:border-brand-purple"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSave}
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
