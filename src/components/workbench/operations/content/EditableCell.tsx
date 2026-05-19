/**
 * EditableCell — click-to-edit cell for the ContentTable spreadsheet.
 *
 * Default state renders value (with optional renderValue formatter) inside
 * a click-target. Clicking enters edit mode: a plain <input> replaces the
 * text, pre-filled and auto-focused. Blur OR Enter fires the caller's
 * onSave; Escape cancels. While saving the input is disabled. On error
 * the input gets a red border and an error message appears below it; the
 * cell stays in edit mode so the user can correct and retry.
 *
 * The caller's onSave is async and MUST throw on failure — this component
 * catches the throw and surfaces the message. The parent (SectionG_Content)
 * owns the optimistic state update + rollback against scenes/takes.
 *
 * `required={true}` enables client-side empty-input rejection (used for
 * scene_title). Otherwise empty text coerces to null.
 *
 * `renderValue` is the display-mode formatter (e.g., formatHours for the
 * Hours column) — the underlying raw value is what's edited.
 */

'use client';

import { useState } from 'react';

export default function EditableCell({
  value,
  type,
  onSave,
  maxLength,
  min,
  max,
  step,
  placeholder,
  required,
  renderValue,
  cellClassName = 'py-1 px-2',
  inputClassName,
}: {
  value: string | number | null;
  type: 'text' | 'number';
  onSave: (newValue: string | number | null) => Promise<void>;
  maxLength?: number;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  required?: boolean;
  renderValue?: (v: string | number | null) => string;
  cellClassName?: string;
  inputClassName?: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftValue, setDraftValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enterEdit = () => {
    setDraftValue(value == null ? '' : String(value));
    setError(null);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setDraftValue(value == null ? '' : String(value));
    setError(null);
    setIsEditing(false);
  };

  const attemptSave = async () => {
    if (saving) return;

    let coerced: string | number | null;
    if (type === 'number') {
      const t = draftValue.trim();
      if (t === '') {
        if (required) {
          setError('this field is required');
          return;
        }
        coerced = null;
      } else {
        const n = parseFloat(t);
        if (!Number.isFinite(n)) {
          setError('must be a number');
          return;
        }
        coerced = n;
      }
    } else {
      const t = draftValue.trim();
      if (t === '') {
        if (required) {
          setError('this field is required');
          return;
        }
        coerced = null;
      } else {
        coerced = t;
      }
    }

    // No-op short-circuit — compare normalized string forms so a Prisma
    // string-decimal vs. number-decimal doesn't trigger a spurious save.
    const before = value == null ? '' : String(value).trim();
    const after = coerced == null ? '' : String(coerced).trim();
    if (before === after) {
      setError(null);
      setIsEditing(false);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(coerced);
      setIsEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

  if (!isEditing) {
    const display = renderValue
      ? renderValue(value)
      : value == null || value === ''
        ? '—'
        : String(value);
    return (
      <td className={cellClassName}>
        <button
          type="button"
          onClick={enterEdit}
          className="block w-full text-left cursor-pointer hover:text-brand-purple"
          title="click to edit"
        >
          {display}
        </button>
      </td>
    );
  }

  const baseInput =
    inputClassName ??
    'w-full px-1 py-0 border rounded text-xs font-mono text-text-primary focus:outline-none disabled:opacity-50';
  const borderClass = error
    ? 'border-red-500 focus:border-red-500'
    : 'border-border focus:border-brand-purple';

  return (
    <td className={cellClassName}>
      <input
        type={type}
        value={draftValue}
        onChange={(e) => setDraftValue(e.target.value)}
        onBlur={attemptSave}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            attemptSave();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
          }
        }}
        maxLength={maxLength}
        min={min}
        max={max}
        step={step}
        disabled={saving}
        placeholder={placeholder}
        autoFocus
        className={`${baseInput} ${borderClass}`}
      />
      {error && (
        <div className="text-xs text-red-700 mt-0.5 whitespace-normal">{error}</div>
      )}
    </td>
  );
}
