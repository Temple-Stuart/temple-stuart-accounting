'use client';

import { useMemo, useState } from 'react';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_CODES } from '@/lib/constants/productCategories';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
}

export default function ProductsPicker({ value, onChange }: Props) {
  const [pending, setPending] = useState('');

  const valueSet = useMemo(() => new Set(value), [value]);
  const customItems = useMemo(
    () => value.filter((v) => !PRODUCT_CATEGORY_CODES.has(v)),
    [value],
  );

  const togglePredefined = (code: string) => {
    if (valueSet.has(code)) {
      onChange(value.filter((v) => v !== code));
    } else {
      onChange([...value, code]);
    }
  };

  const addCustom = () => {
    const trimmed = pending.trim();
    if (!trimmed || valueSet.has(trimmed)) {
      setPending('');
      return;
    }
    onChange([...value, trimmed]);
    setPending('');
  };

  const removeCustom = (item: string) => {
    onChange(value.filter((v) => v !== item));
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
        {PRODUCT_CATEGORIES.map((cat) => (
          <label
            key={cat.code}
            className="flex items-center gap-2 font-mono text-terminal-sm text-text-primary cursor-pointer"
          >
            <input
              type="checkbox"
              checked={valueSet.has(cat.code)}
              onChange={() => togglePredefined(cat.code)}
              className="rounded border-border"
            />
            {cat.label}
          </label>
        ))}
      </div>

      <div>
        <p className="font-mono text-terminal-sm text-text-secondary mb-1">
          Add anything not on the list:
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={pending}
            onChange={(e) => setPending(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addCustom();
              }
            }}
            placeholder="Custom product or service"
            className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-1.5 flex-1 focus:border-brand-purple outline-none transition-colors placeholder:text-text-faint"
          />
          <button
            type="button"
            onClick={addCustom}
            disabled={!pending.trim()}
            className="font-mono text-terminal-sm px-3 py-1.5 rounded border border-border hover:border-brand-purple hover:text-brand-purple disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add
          </button>
        </div>
        {customItems.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {customItems.map((item) => (
              <span
                key={item}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-brand-purple/40 bg-brand-purple/10 font-mono text-terminal-sm text-text-primary"
              >
                {item}
                <button
                  type="button"
                  onClick={() => removeCustom(item)}
                  className="text-text-muted hover:text-red-600 leading-none"
                  aria-label={`Remove ${item}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
