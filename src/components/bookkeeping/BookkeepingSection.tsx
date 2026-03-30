'use client';

import { ReactNode } from 'react';

interface BookkeepingSectionProps {
  title: string;
  pipelineKey: string;
  subtitle?: string;
  status?: 'complete' | 'action-needed' | 'error' | 'pending';
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
  children,
}: BookkeepingSectionProps) {
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm">
      <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[9px] uppercase text-white/60 font-mono tracking-wider">{pipelineKey}</span>
          <span>{title}</span>
        </div>
        {(subtitle || status) && (
          <div className="flex items-center gap-2">
            {subtitle && <span className="text-xs text-white/70">{subtitle}</span>}
            {status && <div className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />}
          </div>
        )}
      </div>
      <div className="bg-white">
        {children}
      </div>
    </div>
  );
}
