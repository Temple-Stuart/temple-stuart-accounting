'use client';

import { useRef, useState, useEffect, ReactNode } from 'react';

interface ResponsiveTableProps {
  children: ReactNode;
  minWidth?: string;
  maxHeight?: string;
  showLandscapeHint?: boolean;
}

export default function ResponsiveTable({ 
  children, 
  minWidth = '900px',
  maxHeight,
  showLandscapeHint = true 
}: ResponsiveTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isLandscape, setIsLandscape] = useState(true);

  useEffect(() => {
    const checkScroll = () => {
      if (!scrollRef.current) return;
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 5);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5);
    };

    const checkOrientation = () => {
      setIsLandscape(window.innerWidth > window.innerHeight);
    };

    checkScroll();
    checkOrientation();

    const el = scrollRef.current;
    el?.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    return () => {
      el?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
    };
  }, []);

  const scrollTo = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.6;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth'
    });
  };

  return (
    <div className="relative">
      {/* Landscape hint for mobile */}
      {showLandscapeHint && !isLandscape && (
        <div className="sm:hidden bg-[#b4b237]/10 border border-[#b4b237]/30 rounded-lg px-3 py-2 mb-3 flex items-center gap-2 text-sm">
          <span className="text-lg">📱↔️</span>
          <span className="text-[#8f8c2a]">Rotate for better view</span>
        </div>
      )}

      {/* Scroll shadow left */}
      <div className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none transition-opacity ${canScrollLeft ? 'opacity-100' : 'opacity-0'}`} />
      
      {/* Scroll shadow right */}
      <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none transition-opacity ${canScrollRight ? 'opacity-100' : 'opacity-0'}`} />

      {/* Scroll buttons - visible on touch devices when scrollable */}
      {canScrollLeft && (
        <button 
          onClick={() => scrollTo('left')}
          className="absolute left-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white/90 border border-gray-200 rounded-full shadow-md flex items-center justify-center text-gray-600 hover:bg-gray-50 sm:hidden"
        >
          ‹
        </button>
      )}
      {canScrollRight && (
        <button 
          onClick={() => scrollTo('right')}
          className="absolute right-1 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white/90 border border-gray-200 rounded-full shadow-md flex items-center justify-center text-gray-600 hover:bg-gray-50 sm:hidden"
        >
          ›
        </button>
      )}

      {/* Scrollable container */}
      <div 
        ref={scrollRef}
        className="overflow-x-auto overscroll-x-contain scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
        style={{ 
          WebkitOverflowScrolling: 'touch',
          maxHeight: maxHeight || 'none'
        }}
      >
        <div style={{ minWidth }}>
          {children}
        </div>
      </div>

      {/* Scroll indicator dots */}
      {(canScrollLeft || canScrollRight) && (
        <div className="flex justify-center gap-1 mt-2 sm:hidden">
          <div className={`w-1.5 h-1.5 rounded-full transition-colors ${!canScrollLeft ? 'bg-[#b4b237]' : 'bg-gray-300'}`} />
          <div className={`w-1.5 h-1.5 rounded-full transition-colors ${canScrollLeft && canScrollRight ? 'bg-[#b4b237]' : 'bg-gray-300'}`} />
          <div className={`w-1.5 h-1.5 rounded-full transition-colors ${!canScrollRight ? 'bg-[#b4b237]' : 'bg-gray-300'}`} />
        </div>
      )}
    </div>
  );
}
