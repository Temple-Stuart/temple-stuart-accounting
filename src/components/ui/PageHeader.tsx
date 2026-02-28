'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  backHref?: string;
  actions?: ReactNode;
  badge?: ReactNode;
}

export default function PageHeader({ title, subtitle, backHref, actions, badge }: PageHeaderProps) {
  const router = useRouter();

  return (
    <div className="bg-white border-b border-border">
      <div className="px-4 lg:px-6 py-2">
        {backHref && (
          <button onClick={() => router.push(backHref)} className="flex items-center gap-1 text-terminal-sm text-text-muted hover:text-text-primary mb-1.5 group">
            <svg className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-text-primary font-mono">{title}</h1>
              {badge}
            </div>
            {subtitle && <p className="text-terminal-sm text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
