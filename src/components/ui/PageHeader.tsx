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
    <div className="bg-white border-b border-gray-200">
      <div className="px-4 lg:px-8 py-6">
        {backHref && (
          <button onClick={() => router.push(backHref)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-3 group">
            <svg className="w-4 h-4 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{title}</h1>
              {badge}
            </div>
            {subtitle && <p className="text-gray-500 mt-1">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-3 flex-shrink-0">{actions}</div>}
        </div>
      </div>
    </div>
  );
}
