'use client';

/**
 * RowActionStrip — BOOK AT THE LINE (TRAVEL-ROW-01, 2026-09-23).
 *
 * THE PROBLEM IT REPLACES. On flights and hotels you picked the line you wanted
 * and then scrolled past the whole table to a bar at the bottom of the page to
 * press Book: HotelResultsView.tsx's selection bar sat at :293-315, AFTER the
 * outer table closed at :285; FlightPickerView.tsx's sat at :556-588, after that
 * leg's table closed at :549; the tour's Save sat at PublicActivitySearch.tsx:406,
 * after the options table closed at :387. Trip.com and Expedia put the action at
 * the line, and so does this: selecting a fare, a rate or an option expands a
 * full-width strip DIRECTLY BENEATH that row, and the old bars are gone. One
 * place to act, not two.
 *
 * It is a `<tr>` spanning the table, so it is part of the table's own flow —
 * the row above it never moves, and the strip cannot drift away from the line it
 * belongs to. Selecting another row moves the strip (React re-renders it under
 * the new selection); deselecting collapses it.
 *
 * THE VIEW STILL NEVER BOOKS. `checkout` is an ELEMENT the container passes in
 * through this slot — CheckoutPanel and LiteApiFlightCheckoutPanel are mounted by
 * PublicHotelSearch and PublicFlightSearch exactly as before, with exactly the
 * same props; only WHERE they are mounted changed. Their own files are untouched
 * and their pins do not move.
 *
 * THE CLOCK OF IT. When the checkout opens, the strip scrolls the WHOLE PANEL
 * into view (block: 'start', smooth) and focuses its heading WITHOUT scrolling
 * again, so the founder is looking at the form rather than hunting for it. Close
 * — the button, or Escape anywhere in the wrapper — collapses it and returns
 * focus to the row, which is the element directly above this one. That is why the
 * row carries tabIndex={-1}: it is not in the tab order, but it can be focused
 * programmatically.
 *
 * PHONE WIDTH (390px). The strip spans a table that is WIDER THAN THE PHONE and
 * scrolls sideways inside its own `overflow-x-auto` box, so a `justify-between`
 * that pushes the buttons to the far right puts Book off the visible edge —
 * measured in the walk at 390×844: the hotel strip is 970px wide in a 390px
 * viewport and Book sat past it. So below `sm` the summary and the actions each
 * take a FULL LINE (`basis-full sm:basis-auto`) and the actions start at the
 * strip's left edge, where the table's horizontal scroll already is. Book is then
 * reachable without scrolling anything. At 1280 nothing changes: `sm:basis-auto`
 * restores the one-line, justified layout.
 *
 * A WIDE TABLE AT ANY WIDTH. The tour's options table is 1725px wide — wider than
 * a 1280 desktop — so a right-justified action group lands at x=1884, off the
 * screen, and the founder has to scroll the table sideways to press Book. So the
 * group is `sticky right-0`: its scrolling ancestor is the table's own
 * `overflow-x-auto` box, and sticky pins it to that box's VISIBLE right edge
 * whenever its static position is past it. Book is at the line, always.
 */

import { useEffect, useRef, type ReactNode } from 'react';

export interface RowActionStripProps {
  /** The table's column count — the strip spans all of them, so it is full width. */
  colSpan: number;
  /** What is selected, from the stated attributes already on the row. */
  summary: ReactNode;
  /** The difference against the lowest, from the leaf that computes it — never recomputed here. */
  difference?: ReactNode;
  /** Collapse the strip (deselect the row). */
  onClear: () => void;
  /** Save to the trip. Absent on a surface that does not save. */
  onSave?: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  /** Book — the primary action. Absent when this row cannot be booked from here. */
  onBook?: () => void;
  bookLabel?: string;
  bookDisabled?: boolean;
  /** An outbound booking link, for a surface that books on the vendor's own site (a tour). */
  bookHref?: string;
  /** The checkout ELEMENT the container passes in. Null until Book opens it. */
  checkout?: ReactNode;
  /** Collapse the checkout and return focus to the row. */
  onCloseCheckout?: () => void;
  /** What else this surface needs at the line (a tour's end-time pick). */
  children?: ReactNode;
  /** Which row this strip belongs to — the walk and the law read it. */
  rowId: string;
}

export default function RowActionStrip({
  colSpan, summary, difference, onClear, onSave, saveLabel = 'Save to trip', saveDisabled = false,
  onBook, bookLabel = 'Book', bookDisabled = false, bookHref, checkout, onCloseCheckout, children, rowId,
}: RowActionStripProps) {
  const stripRef = useRef<HTMLTableRowElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const headingRef = useRef<HTMLDivElement | null>(null);
  const open = checkout !== null && checkout !== undefined;

  // On open: bring the checkout to the top of the viewport and put the caret in
  // it. Both are guarded — jsdom and a server render have neither.
  //
  // THE SCROLL TARGET IS THE WRAPPER, NOT THE HEADING, and the focus that follows
  // is `preventScroll` — measured in the walk: scrolling the heading to block
  // 'start' and then calling a plain focus() left the panel's own top edge 5px
  // ABOVE the viewport, because focus() scrolls again on its own and lands on the
  // heading rather than on the box that holds it. Scrolling the box the founder is
  // meant to read, and then focusing without moving the page, puts the whole
  // checkout's top inside the viewport.
  useEffect(() => {
    if (!open) return;
    const wrap = wrapRef.current;
    const heading = headingRef.current;
    if (!wrap || !heading) return;
    wrap.scrollIntoView({ block: 'start', behavior: 'smooth' });
    heading.focus({ preventScroll: true });
  }, [open]);

  /** Close, and put focus back on the row this strip belongs to — the element directly above it. */
  const closeAndReturn = () => {
    const row = stripRef.current?.previousElementSibling;
    onCloseCheckout?.();
    if (row instanceof HTMLElement) row.focus();
  };

  return (
    <tr ref={stripRef} data-row-strip={rowId} className="bg-brand-purple-wash/20">
      <td colSpan={colSpan} className="border-l-2 border-brand-purple px-2 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2" data-row-strip-actions={rowId}>
          <div className="min-w-0 basis-full text-sm sm:basis-auto" data-row-strip-summary>
            {summary}
            {difference}
          </div>
          <div className="sticky right-0 flex basis-full flex-wrap items-center gap-2 sm:basis-auto">
            <button type="button" onClick={onClear} data-row-strip-clear
              className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-white">
              Clear
            </button>
            {onSave && (
              <button type="button" onClick={onSave} disabled={saveDisabled} data-row-strip-save
                className="rounded border border-brand-purple bg-white px-3 py-1.5 text-xs font-semibold text-brand-purple transition-colors hover:bg-bg-row disabled:opacity-50">
                {saveLabel}
              </button>
            )}
            {onBook && (
              <button type="button" onClick={onBook} disabled={bookDisabled} data-row-strip-book
                className="rounded bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-purple-hover disabled:opacity-50">
                {bookLabel}
              </button>
            )}
            {!onBook && bookHref && (
              <a href={bookHref} target="_blank" rel="noopener noreferrer" data-row-strip-book
                className="rounded bg-brand-purple px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-purple-hover">
                {bookLabel}
              </a>
            )}
          </div>
          {children && <div className="basis-full" data-row-strip-extra>{children}</div>}
        </div>
        {open && (
          // THE WRAPPER: Escape anywhere inside it closes the checkout and returns
          // focus to the row, the same as the Close button.
          <div
            ref={wrapRef}
            className="mt-2 basis-full"
            data-row-strip-checkout={rowId}
            onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); closeAndReturn(); } }}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <div ref={headingRef} tabIndex={-1} data-row-strip-checkout-heading
                className="font-mono text-[11px] font-semibold uppercase tracking-wider text-text-faint outline-none">
                Checkout
              </div>
              <button type="button" onClick={closeAndReturn} data-row-strip-checkout-close
                className="rounded border border-border px-2 py-1 text-xs text-text-secondary hover:bg-white">
                Close
              </button>
            </div>
            {checkout}
          </div>
        )}
      </td>
    </tr>
  );
}
