/**
 * ListManager — structured list editor for natural-voice items.
 *
 * Used by project goal/problem/diagnosis fields. Each item is one
 * verb-prefixed line (e.g., "I WANT to get loans approved").
 *
 * Storage: items stored verbatim with verb prefix included (per
 * PR-Ops-3.7 architectural decision B). Add-item input pre-fills the
 * verb prefix to enforce institutional grammar discipline while
 * keeping storage WYSIWYG.
 *
 * Limits: 500 chars per item, 20 items per list (server-validated;
 * UI shows soft warning before hard cap).
 *
 * Used in:
 *   - ProjectRow edit mode (3 instances per project)
 *   - SectionD create form (3 instances per new project, Prompt 3)
 */

'use client';

import { useState } from 'react';

interface Props {
  /** Current items (each is a complete natural-voice line with verb prefix). */
  items: string[];
  /** Callback when items change — caller manages the source-of-truth state. */
  onChange: (next: string[]) => void;
  /**
   * Verb prefix to pre-fill when user clicks add. Examples:
   *   - "I WANT to "
   *   - "I DID NOT "
   *   - "I HAVE NOT "
   *   - "I NEED TO "
   * The prefix is included verbatim in the saved item.
   */
  verbPrefix: string;
  /** Optional alternate prefix (e.g., problem field has "I DID NOT" + "I HAVE NOT"). */
  altVerbPrefix?: string;
  /** Optional placeholder shown after the verb prefix in the input. */
  placeholder?: string;
  /** Disabled state (during save, regeneration, etc). */
  disabled?: boolean;
}

const MAX_ITEMS = 20;
const MAX_CHARS = 500;

export default function ListManager({
  items,
  onChange,
  verbPrefix,
  altVerbPrefix,
  placeholder,
  disabled = false,
}: Props) {
  const [draft, setDraft] = useState<string>('');
  const [draftPrefix, setDraftPrefix] = useState<string>(verbPrefix);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  const atLimit = items.length >= MAX_ITEMS;

  const startAdd = (prefix: string) => {
    if (atLimit) return;
    setDraftPrefix(prefix);
    setDraft(prefix);
  };

  const commitAdd = () => {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
      setDraft('');
      return;
    }
    if (trimmed.length > MAX_CHARS) return;
    onChange([...items, trimmed]);
    setDraft('');
    setDraftPrefix(verbPrefix);
  };

  const cancelAdd = () => {
    setDraft('');
    setDraftPrefix(verbPrefix);
  };

  const startEdit = (i: number) => {
    setEditingIndex(i);
    setEditingText(items[i]);
  };

  const commitEdit = () => {
    if (editingIndex === null) return;
    const trimmed = editingText.trim();
    if (trimmed.length === 0) {
      // Empty edit = remove the item.
      removeItem(editingIndex);
      setEditingIndex(null);
      setEditingText('');
      return;
    }
    if (trimmed.length > MAX_CHARS) return;
    const next = [...items];
    next[editingIndex] = trimmed;
    onChange(next);
    setEditingIndex(null);
    setEditingText('');
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditingText('');
  };

  const removeItem = (i: number) => {
    onChange(items.filter((_, idx) => idx !== i));
  };

  const inputClass =
    'w-full px-2 py-1 border border-border rounded text-xs text-text-primary focus:outline-none focus:border-brand-purple';

  return (
    <div className="space-y-1">
      {items.length === 0 && draft.length === 0 && (
        <div className="text-xs text-text-muted italic px-1">
          (no items yet — click below to add)
        </div>
      )}

      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2 group">
          <span className="text-text-faint text-xs mt-1 select-none">·</span>
          {editingIndex === i ? (
            <>
              <input
                type="text"
                value={editingText}
                onChange={(e) => setEditingText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit();
                  if (e.key === 'Escape') cancelEdit();
                }}
                className={inputClass + ' flex-1'}
                maxLength={MAX_CHARS}
                disabled={disabled}
                autoFocus
              />
              <button
                type="button"
                onClick={commitEdit}
                disabled={disabled}
                className="px-2 py-0.5 border border-brand-purple bg-brand-purple text-white rounded text-xs hover:opacity-90 disabled:opacity-50"
              >
                save
              </button>
              <button
                type="button"
                onClick={cancelEdit}
                disabled={disabled}
                className="px-2 py-0.5 border border-border rounded text-xs hover:bg-bg-row disabled:opacity-50"
              >
                cancel
              </button>
            </>
          ) : (
            <>
              <span
                className="flex-1 text-xs text-text-primary cursor-pointer hover:bg-bg-row rounded px-1"
                onClick={() => !disabled && startEdit(i)}
                title="Click to edit"
              >
                {item}
              </span>
              <button
                type="button"
                onClick={() => removeItem(i)}
                disabled={disabled}
                className="opacity-0 group-hover:opacity-100 px-1 text-text-faint hover:text-red-700 text-xs disabled:opacity-50"
                title="Remove item"
              >
                ✕
              </button>
            </>
          )}
        </div>
      ))}

      {draft.length > 0 ? (
        <div className="flex items-start gap-2">
          <span className="text-brand-purple text-xs mt-1 select-none">+</span>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAdd();
              if (e.key === 'Escape') cancelAdd();
            }}
            placeholder={placeholder}
            className={inputClass + ' flex-1'}
            maxLength={MAX_CHARS}
            disabled={disabled}
            autoFocus
          />
          <button
            type="button"
            onClick={commitAdd}
            disabled={disabled || draft.trim().length === 0}
            className="px-2 py-0.5 border border-brand-purple bg-brand-purple text-white rounded text-xs hover:opacity-90 disabled:opacity-50"
          >
            add
          </button>
          <button
            type="button"
            onClick={cancelAdd}
            disabled={disabled}
            className="px-2 py-0.5 border border-border rounded text-xs hover:bg-bg-row disabled:opacity-50"
          >
            cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={() => startAdd(verbPrefix)}
            disabled={disabled || atLimit}
            className="px-2 py-0.5 border border-brand-purple text-brand-purple rounded text-xs hover:bg-purple-50 disabled:opacity-50"
            title={atLimit ? `Maximum ${MAX_ITEMS} items reached` : `Add a "${verbPrefix.trim()}" item`}
          >
            + {verbPrefix.trim()}...
          </button>
          {altVerbPrefix && (
            <button
              type="button"
              onClick={() => startAdd(altVerbPrefix)}
              disabled={disabled || atLimit}
              className="px-2 py-0.5 border border-brand-purple text-brand-purple rounded text-xs hover:bg-purple-50 disabled:opacity-50"
              title={atLimit ? `Maximum ${MAX_ITEMS} items reached` : `Add a "${altVerbPrefix.trim()}" item`}
            >
              + {altVerbPrefix.trim()}...
            </button>
          )}
          {atLimit && (
            <span className="text-xs text-text-muted italic">
              (max {MAX_ITEMS} items reached)
            </span>
          )}
          {!atLimit && items.length >= MAX_ITEMS - 5 && (
            <span className="text-xs text-text-muted">
              ({MAX_ITEMS - items.length} slots left)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
