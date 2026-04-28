'use client';

import { useState } from 'react';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
}

export default function ListBuilder({ value, onChange, placeholder = 'Type and press Add', ariaLabel }: Props) {
  const [pending, setPending] = useState('');

  const add = () => {
    const trimmed = pending.trim();
    if (!trimmed) return;
    onChange([...value, trimmed]);
    setPending('');
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ul className="space-y-1">
          {value.map((item, idx) => (
            <li
              key={`${idx}-${item}`}
              className="flex items-start gap-2 px-2 py-1 rounded border border-border bg-white font-mono text-terminal-sm text-text-primary"
            >
              <span className="flex-1 break-words whitespace-pre-wrap">{item}</span>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="text-text-muted hover:text-red-600 leading-none px-1"
                aria-label={`Remove "${item}"`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 flex-1 focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint"
        />
        <button
          type="button"
          onClick={add}
          disabled={!pending.trim()}
          className="font-mono text-terminal-sm px-3 py-1.5 rounded border border-border hover:border-brand-purple hover:text-brand-purple disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
      </div>
    </div>
  );
}
