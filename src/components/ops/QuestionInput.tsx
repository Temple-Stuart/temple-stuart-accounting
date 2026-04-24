'use client';

import type { OpsQuestion } from '@/lib/ops/bookkeepingQuestions';

interface QuestionInputProps {
  question: OpsQuestion;
  value: string;
  onChange: (value: string) => void;
}

export default function QuestionInput({ question, value, onChange }: QuestionInputProps) {
  switch (question.type) {
    case 'text':
      return <TextInput value={value} onChange={onChange} />;
    case 'boolean':
      return <BooleanInput value={value} onChange={onChange} />;
    case 'select':
      return <SelectInput options={question.options || []} value={value} onChange={onChange} />;
    case 'multiselect':
      return <MultiselectInput options={question.options || []} value={value} onChange={onChange} />;
    case 'checklist':
      return <ChecklistInput options={question.options || []} value={value} onChange={onChange} />;
    case 'date':
      return <DateInput value={value} onChange={onChange} />;
    default:
      return <TextInput value={value} onChange={onChange} />;
  }
}

function TextInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <textarea
      rows={3}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Enter your answer..."
      className="w-full resize-y font-mono text-sm bg-transparent border border-border rounded-md px-3 py-2 outline-none focus:border-brand-purple transition-colors placeholder:text-text-faint"
    />
  );
}

function BooleanInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(value === 'true' ? '' : 'true')}
        className={`px-4 py-1.5 rounded text-terminal-base font-mono transition-colors ${
          value === 'true'
            ? 'bg-brand-purple text-white'
            : 'border border-border text-text-secondary hover:border-brand-purple'
        }`}
      >
        Yes
      </button>
      <button
        onClick={() => onChange(value === 'false' ? '' : 'false')}
        className={`px-4 py-1.5 rounded text-terminal-base font-mono transition-colors ${
          value === 'false'
            ? 'bg-brand-purple text-white'
            : 'border border-border text-text-secondary hover:border-brand-purple'
        }`}
      >
        No
      </button>
    </div>
  );
}

function SelectInput({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          onClick={() => onChange(value === opt ? '' : opt)}
          className={`px-3 py-1.5 rounded text-terminal-sm font-mono transition-colors text-left ${
            value === opt
              ? 'bg-brand-purple text-white'
              : 'border border-border text-text-secondary hover:border-brand-purple'
          }`}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

function MultiselectInput({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const selected: string[] = value ? JSON.parse(value) : [];

  const toggle = (opt: string) => {
    const next = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt];
    onChange(next.length > 0 ? JSON.stringify(next) : '');
  };

  const isLargeList = options.length > 10;

  return (
    <div className={isLargeList ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-1.5' : 'flex flex-wrap gap-2'}>
      {options.map((opt) => {
        const isSelected = selected.includes(opt);
        return (
          <button
            key={opt}
            onClick={() => toggle(opt)}
            className={`px-2.5 py-1 rounded text-terminal-sm font-mono transition-colors text-left ${
              isSelected
                ? 'bg-brand-purple text-white'
                : 'border border-border text-text-secondary hover:border-brand-purple'
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function ChecklistInput({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  const checked: string[] = value ? JSON.parse(value) : [];

  const toggle = (opt: string) => {
    const next = checked.includes(opt)
      ? checked.filter((s) => s !== opt)
      : [...checked, opt];
    onChange(next.length > 0 ? JSON.stringify(next) : '');
  };

  return (
    <div className="space-y-1.5">
      {options.map((opt) => {
        const isChecked = checked.includes(opt);
        return (
          <label key={opt} className="flex items-start gap-2 cursor-pointer group">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggle(opt)}
              className="mt-0.5 w-4 h-4 rounded border-border accent-brand-purple flex-shrink-0"
            />
            <span className={`text-terminal-sm font-mono ${isChecked ? 'text-text-primary' : 'text-text-secondary'}`}>
              {opt}
            </span>
          </label>
        );
      })}
    </div>
  );
}

function DateInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="font-mono text-sm bg-transparent border border-border rounded-md px-3 py-2 outline-none focus:border-brand-purple transition-colors"
    />
  );
}
