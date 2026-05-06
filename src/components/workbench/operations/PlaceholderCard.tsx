import type { ReactNode } from 'react';

export interface PlaceholderCardProps {
  letter: string;
  title: string;
  unbuiltLabel: string;
  children?: ReactNode;
}

export default function PlaceholderCard({
  letter,
  title,
  unbuiltLabel,
  children,
}: PlaceholderCardProps) {
  return (
    <section className="bg-white rounded border border-border shadow-sm p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-mono text-sm font-bold tracking-wide text-text-primary">
          {letter} · {title}
        </h2>
        <span className="text-xs font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
          {unbuiltLabel}
        </span>
      </div>
      {children ? (
        <div className="text-xs font-mono text-text-muted">{children}</div>
      ) : (
        <div className="text-xs font-mono text-text-muted">section pending implementation</div>
      )}
    </section>
  );
}
