'use client';

import { ReactNode } from 'react';

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'gold' | 'purple';
  size?: 'sm' | 'md';
  className?: string;
}

export default function Badge({ children, variant = 'default', size = 'md', className = '' }: BadgeProps) {
  const variants = {
    default: 'bg-bg-row text-text-secondary',
    success: 'bg-green-50 text-brand-green',
    warning: 'bg-amber-50 text-brand-amber',
    danger: 'bg-red-50 text-brand-red',
    info: 'bg-blue-50 text-blue-700',
    gold: 'bg-brand-gold-wash text-brand-gold font-mono',
    purple: 'bg-brand-purple-wash text-brand-purple font-mono',
  };
  const sizes = { sm: 'px-1.5 py-0.5 text-terminal-xs', md: 'px-2 py-0.5 text-terminal-sm' };

  return <span className={`inline-flex items-center font-semibold rounded ${variants[variant]} ${sizes[size]} ${className}`}>{children}</span>;
}
