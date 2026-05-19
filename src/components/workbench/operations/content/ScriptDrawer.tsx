/**
 * ScriptDrawer — long-form editor for scene.script.
 *
 * Right-side slide-in panel triggered by clicking the truncated script
 * preview cell in SceneHeaderRow. Full script pre-populated in a
 * textarea filling the panel's vertical space.
 *
 * Close behavior (locked): NO click-outside, NO Escape, NO close-X.
 * Only Save (on success) or Cancel button closes the drawer.
 *
 * No backdrop — the spreadsheet behind the drawer stays fully readable.
 * The drawer is `fixed right-0 top-0`, so the table is also still
 * interactable behind it; this is intentional.
 *
 * Save semantics: empty trimmed → null; no-change → close without
 * firing PATCH; otherwise the parent's handleSceneUpdate (shipped in
 * 4.9.3e) drives optimistic update + rollback. The parent closes the
 * drawer on success; a thrown error keeps the drawer open with the
 * message inline above the buttons.
 *
 * Whitespace note: this drawer trims leading/trailing whitespace before
 * sending so the optimistic state matches what the server stores (the
 * scenes PATCH endpoint applies the same trim).
 */

'use client';

import { useEffect, useState } from 'react';

export default function ScriptDrawer({
  scene,
  open,
  onSave,
  onCancel,
}: {
  scene: {
    id: string;
    scene_number: number;
    scene_title: string;
    script: string | null;
  };
  open: boolean;
  onSave: (script: string | null) => Promise<void>;
  onCancel: () => void;
}) {
  const [draftScript, setDraftScript] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraftScript(scene.script ?? '');
      setError(null);
      setSaving(false);
    }
  }, [open, scene.id]);

  if (!open) return null;

  const handleSave = async () => {
    if (saving) return;
    const trimmed = draftScript.trim();
    const next: string | null = trimmed === '' ? null : trimmed;
    if (next === (scene.script ?? null)) {
      onCancel();
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

  const handleCancel = () => {
    if (saving) return;
    onCancel();
  };

  return (
    <div className="fixed right-0 top-0 h-full w-[35%] min-w-[400px] max-w-[600px] bg-white border-l border-border shadow-lg flex flex-col z-50">
      <div className="px-4 py-3 border-b border-border-light font-mono text-xs font-semibold text-text-primary">
        Scene {scene.scene_number} · {scene.scene_title}
      </div>

      <div className="flex-1 px-4 py-3 overflow-hidden">
        <textarea
          value={draftScript}
          onChange={(e) => setDraftScript(e.target.value)}
          disabled={saving}
          autoFocus
          placeholder="Write the script for this scene..."
          className="w-full h-full resize-none border border-border rounded px-3 py-2 font-mono text-xs text-text-primary focus:outline-none focus:border-brand-purple disabled:opacity-50"
        />
      </div>

      <div className="px-4 py-3 border-t border-border-light flex flex-col gap-2">
        {error && (
          <div className="text-xs font-mono text-red-700 bg-red-50 border border-red-200 px-2 py-1 rounded">
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-mono border border-border rounded hover:bg-bg-row disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-mono border border-brand-purple bg-brand-purple text-white rounded hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
