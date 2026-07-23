'use client';

/**
 * TripFormModal — a centered, phone-first modal shell (PR-Trip-Modal).
 *
 * Holds the create-trip form off the "Your trips" table: the table stays the
 * primary view (data on the surface), and creating a trip is one tap → this
 * modal (an action, on demand). The form inside is unchanged; this only gives
 * it a container.
 *
 * Pattern mirrors hub/EventDetailPanel + trips/CheckoutPanel: a dimmed backdrop
 * with a centered card. Phone-first — full width (with margin) on phone via
 * `w-full` + the overlay's `p-4`, a centered `max-w-lg` card on desktop. The
 * body scrolls (`max-h-[90vh]` + `overflow-y-auto`) since the form is tall.
 * Closes three ways: the × button, a click on the backdrop (outside the card),
 * and Escape. One brand-purple header band (the app's single-band rule).
 */

import { useEffect, useRef } from 'react';

interface Props {
  /** Header title (e.g., "Create a trip"). */
  title: string;
  /** Optional one-line subhead under the title (the form's explainer). */
  subtitle?: string;
  /** Close the modal (× / backdrop / Esc all call this). */
  onClose: () => void;
  /** The form (or any content) to render in the scrollable body. */
  children: React.ReactNode;
}

export default function TripFormModal({ title, subtitle, onClose, children }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Click-outside to close (delayed bind so the opening click doesn't close it).
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 50);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [onClose]);

  // Escape to close.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Lock the page behind the modal so phone scrolling stays inside the form.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        ref={panelRef}
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-panel-border bg-panel text-white shadow-2xl"
      >
        {/* Header — single brand-purple band. */}
        <div className="flex items-start justify-between border-b border-panel-border bg-panel-surface px-4 py-3 text-white">
          <div className="min-w-0 flex-1 pr-3">
            <h3 className="text-sm font-semibold">{title}</h3>
            {subtitle && <p className="mt-1 text-xs text-white/70">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 -mt-1 shrink-0 p-1 text-white/70 transition-colors hover:text-white"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable body — the create form is tall (name/dest/dates/travelers/type). */}
        <div className="overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}
