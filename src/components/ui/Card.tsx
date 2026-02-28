'use client';

import { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  noPadding?: boolean;
  className?: string;
}

export default function Card({ children, title, subtitle, action, noPadding = false, className = '' }: CardProps) {
  return (
    <div className={`bg-white rounded border border-border shadow-sm overflow-hidden ${className}`}>
      {(title || action) && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <div>
            {title && <h3 className="text-terminal-lg font-semibold text-text-primary">{title}</h3>}
            {subtitle && <p className="text-terminal-sm text-text-muted mt-0.5">{subtitle}</p>}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={noPadding ? '' : 'p-3'}>{children}</div>
    </div>
  );
}
