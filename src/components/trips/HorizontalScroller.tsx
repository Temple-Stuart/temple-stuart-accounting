'use client';

/**
 * HorizontalScroller — a reusable, presentational horizontal scroll row with
 * overlaid left/right arrow buttons (PR-T-Scroll). It wraps a LIST of card
 * children, lays them out in a single scrollable row (each a fixed width so they
 * read as cards, not squished), and drives smooth scrolling via the arrows.
 *
 * Pure layout: NO fetch, NO data, NO storage. It only arranges whatever children
 * it's given — the cards' content + their onBook callbacks are untouched.
 *
 * Arrow UX: each arrow renders ONLY when there's room to scroll that way (left
 * hides at the start, right hides at the end; both hide when the content already
 * fits). Real <button>s with aria-labels; the row is a labelled, focusable region
 * so it's keyboard-scrollable too.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode, Children } from 'react';

interface Props {
  children: ReactNode;
  /** Accessible label for the scroll region (e.g. "Hotel results"). */
  ariaLabel?: string;
  /** Fixed width per card cell (px). Defaults to 300. */
  itemWidth?: number;
}

export default function HorizontalScroller({ children, ariaLabel, itemWidth = 300 }: Props) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateArrows();
    el.addEventListener('scroll', updateArrows, { passive: true });
    // Re-evaluate when the row or its content resizes (e.g. results change).
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateArrows);
      ro.disconnect();
    };
  }, [updateArrows, children]);

  const scrollBy = (dir: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: 'smooth' });
  };

  const arrowBase =
    'absolute top-1/2 -translate-y-1/2 z-10 grid h-9 w-9 place-items-center rounded-full ' +
    'bg-brand-purple text-white shadow-md transition-colors hover:bg-brand-purple-hover ' +
    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple';

  return (
    <div className="relative">
      {canLeft && (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scrollBy(-1)}
          className={`${arrowBase} left-1`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      )}

      <div
        ref={trackRef}
        role="group"
        aria-label={ariaLabel}
        tabIndex={0}
        className="flex items-stretch gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {Children.map(children, (child) => (
          <div className="flex shrink-0" style={{ width: itemWidth }}>
            {child}
          </div>
        ))}
      </div>

      {canRight && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scrollBy(1)}
          className={`${arrowBase} right-1`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      )}
    </div>
  );
}
