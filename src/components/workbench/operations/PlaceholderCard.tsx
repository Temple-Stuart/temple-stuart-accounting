import type { ReactNode } from 'react';
import { themed, type Surface } from '@/lib/ds';

export interface PlaceholderCardProps {
  letter: string;
  title: string;
  unbuiltLabel: string;
  children?: ReactNode;
}

export default function PlaceholderCard({ surface = 'light',
  letter,
  title,
  unbuiltLabel,
  children,
}: PlaceholderCardProps & { surface?: Surface }) {
  const dk = surface === 'dark';
  return (
    <section className={themed('bg-white rounded border border-border shadow-sm p-5', dk)}>
      <div className="flex items-center justify-between mb-3">
        <h2 className={themed('font-mono text-sm font-bold tracking-wide text-text-primary', dk)}>
          {letter} · {title}
        </h2>
        <span className="text-xs font-mono text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
          {unbuiltLabel}
        </span>
      </div>
      {children ? (
        <div className={themed('text-xs font-mono text-text-muted', dk)}>{children}</div>
      ) : (
        <div className={themed('text-xs font-mono text-text-muted', dk)}>section pending implementation</div>
      )}
    </section>
  );
}
