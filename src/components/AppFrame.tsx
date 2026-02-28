'use client';

interface AppFrameProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export default function AppFrame({ children, title, className = '' }: AppFrameProps) {
  return (
    <div className={`bg-brand-purple rounded p-2 shadow-sm ${className}`}>
      <div className="bg-brand-purple-deep rounded overflow-hidden">
        {/* Traffic light header */}
        <div className="flex items-center justify-between px-4 py-3 bg-brand-purple">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
          </div>
          {title && (
            <span className="text-xs text-text-muted font-medium">{title}</span>
          )}
          <div className="w-12"></div>
        </div>
        {/* Content area */}
        <div className="bg-bg-row p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
