'use client';

import { useMemo, useState } from 'react';

interface Option {
  code: string;
  label: string;
}

interface Props {
  options: readonly Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
}

export default function ChipMultiSelect({
  options,
  value,
  onChange,
  placeholder = 'Add…',
  ariaLabel,
}: Props) {
  const [pending, setPending] = useState('');

  const selectedSet = useMemo(() => new Set(value), [value]);
  const labelByCode = useMemo(
    () => new Map(options.map((o) => [o.code, o.label])),
    [options],
  );
  const available = useMemo(
    () => options.filter((o) => !selectedSet.has(o.code)),
    [options, selectedSet],
  );

  const add = (code: string) => {
    if (!code || selectedSet.has(code)) return;
    onChange([...value, code]);
    setPending('');
  };

  const remove = (code: string) => {
    onChange(value.filter((c) => c !== code));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.length === 0 ? (
          <span className="font-mono text-terminal-sm text-text-faint">None selected</span>
        ) : (
          value.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-brand-purple/40 bg-brand-purple/10 font-mono text-terminal-sm text-text-primary"
            >
              {labelByCode.get(code) ?? code}
              <button
                type="button"
                onClick={() => remove(code)}
                className="text-text-muted hover:text-red-600 leading-none"
                aria-label={`Remove ${labelByCode.get(code) ?? code}`}
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <select
        aria-label={ariaLabel}
        value={pending}
        onChange={(e) => add(e.target.value)}
        className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 w-full focus:border-brand-purple outline-none transition-colors"
      >
        <option value="">{placeholder}</option>
        {available.map((o) => (
          <option key={o.code} value={o.code}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
