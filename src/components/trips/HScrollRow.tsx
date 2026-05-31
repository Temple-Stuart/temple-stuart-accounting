'use client';

// ─── Horizontal scroll row with arrow controls (Travel-PR-27) ─────────────────
// Accessibility: some users can't horizontal-scroll with their trackpad/input.
// This wraps any horizontal scroller and adds real <button> left/right arrows
// that scroll programmatically. ADDITIVE — the native trackpad/touch scroll and
// scroll-snap on the inner container are untouched. Arrows are always visible
// (not hover-gated) so keyboard + click users can always reach them.

import { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface HScrollRowProps {
  children: React.ReactNode;
  /** Classes applied to the inner scroll container (the element that scrolls). */
  className?: string;
  /** Inline styles for the inner scroll container (e.g. scrollSnapType). */
  style?: React.CSSProperties;
  /** Pixels to scroll per arrow click (≈ one card width). */
  scrollBy?: number;
}

export default function HScrollRow({ children, className, style, scrollBy = 240 }: HScrollRowProps) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: -1 | 1) => ref.current?.scrollBy({ left: dir * scrollBy, behavior: 'smooth' });

  const arrowClass =
    'absolute top-1/2 -translate-y-1/2 z-10 w-8 h-8 flex items-center justify-center rounded-full ' +
    'bg-white/90 border border-border shadow-sm hover:bg-white text-text-primary transition-colors';

  return (
    <div className="relative">
      <div ref={ref} className={className} style={style}>
        {children}
      </div>
      <button type="button" aria-label="Scroll left" onClick={() => scroll(-1)} className={`${arrowClass} left-0`}>
        <ChevronLeft className="w-4 h-4" aria-hidden="true" />
      </button>
      <button type="button" aria-label="Scroll right" onClick={() => scroll(1)} className={`${arrowClass} right-0`}>
        <ChevronRight className="w-4 h-4" aria-hidden="true" />
      </button>
    </div>
  );
}
