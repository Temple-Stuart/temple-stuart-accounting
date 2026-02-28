'use client';

import { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
}

export default function Button({ children, variant = 'primary', size = 'md', loading = false, icon, className = '', disabled, ...props }: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-brand-purple text-white hover:bg-brand-purple-hover focus:ring-brand-purple shadow-sm',
    secondary: 'bg-white text-text-primary border border-border hover:bg-bg-row focus:ring-brand-purple',
    ghost: 'text-text-muted hover:text-text-primary hover:bg-bg-row focus:ring-brand-purple',
    danger: 'bg-brand-red text-white hover:bg-red-700 focus:ring-brand-red',
  };
  const sizes = { sm: 'h-6 px-2 text-terminal-sm gap-1', md: 'h-7 px-3 text-terminal-base gap-1.5', lg: 'h-8 px-4 text-terminal-lg gap-2' };

  return (
    <button className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} disabled={disabled || loading} {...props}>
      {loading ? <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> : icon ? <span className="flex-shrink-0">{icon}</span> : null}
      {children}
    </button>
  );
}
