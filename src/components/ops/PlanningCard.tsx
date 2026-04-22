'use client';

interface PlanningCardProps {
  stepNumber: string;
  label: string;
  question: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

export default function PlanningCard({
  stepNumber,
  label,
  question,
  hint,
  placeholder,
  value,
  onChange,
  rows = 3,
}: PlanningCardProps) {
  return (
    <div className="bg-white rounded border border-border shadow-sm overflow-hidden">
      <div className="px-3 py-2 border-b border-border">
        <span className="text-terminal-sm uppercase tracking-widest text-text-muted font-mono">
          {stepNumber} &mdash; {label}
        </span>
      </div>
      <div className="px-3 py-3">
        <p className="text-sm font-medium text-text-primary font-mono">{question}</p>
        <p className="text-terminal-sm text-text-faint font-mono mt-1">{hint}</p>
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-2 w-full resize-none font-mono text-terminal-base text-text-primary bg-transparent border border-border rounded-md p-2 outline-none focus:border-brand-purple transition-colors placeholder:text-text-faint"
        />
      </div>
    </div>
  );
}
