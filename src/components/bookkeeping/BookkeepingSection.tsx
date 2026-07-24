'use client';

import { ReactNode, useState } from 'react';
import { themed, type Surface } from '@/lib/ds';

interface BookkeepingSectionProps {
  title: string;
  pipelineKey: string;
  subtitle?: string;
  status?: 'complete' | 'action-needed' | 'error' | 'pending';
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  children: ReactNode;
}

const STATUS_DOT: Record<string, string> = {
  complete: 'bg-emerald-400',
  'action-needed': 'bg-amber-400',
  error: 'bg-red-400',
  pending: 'bg-gray-400',
};

export default function BookkeepingSection({
  title,
  pipelineKey,
  subtitle,
  status,
  collapsible = false,
  defaultCollapsed = false,
  children,
  surface = 'light',
}: BookkeepingSectionProps & { surface?: Surface }) {
  const dk = surface === 'dark';
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div className={themed('rounded-lg overflow-hidden border border-gray-200/50 shadow-sm', dk)}>
      <div
        className={`bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold flex items-center justify-between${collapsible ? ' cursor-pointer select-none' : ''}`}
        onClick={collapsible ? () => setCollapsed(c => !c) : undefined}
      >
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase text-white/60 font-mono tracking-wider">{pipelineKey}</span>
          <span>{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {subtitle && <span className="text-xs text-white/70">{subtitle}</span>}
          {status && <div className={themed(`w-2 h-2 rounded-full ${STATUS_DOT[status]}`, dk)} />}
          {collapsible && (
            <span className="text-white/60 text-xs ml-1">{collapsed ? '\u25B6' : '\u25BC'}</span>
          )}
        </div>
      </div>
      {!collapsed && (
        <div className={themed('bg-white', dk)}>
          {children}
        </div>
      )}
    </div>
  );
}
