/**
 * DayDeck — the day card's cards as a horizontal deck (DECK-01, Alex, 2026-10-16).
 *
 * "Can we make the cards horizontal swipable, like a tinder swipe card, with a
 * button on left and right of card for when on computer." One row of cards —
 * the full card, then one per stop (day/DayCard.tsx hands them in, each a plate
 * at dayCard.ts PLATE_WIDTH) — swiped left and right on a touch screen (CSS
 * scroll snap, the browser's own gesture — no dependency), with ‹ › at the
 * card's edges and the ← → keys while the deck has focus on a computer, the
 * next card peeking at the edge, and a position marker under it. Every card
 * is scaled to the deck's width (a transform — the plate itself stays
 * PLATE_WIDTH wide, so "download image" still renders it full size): down on a
 * narrow screen and, WIDTH-01 (Alex, 2026-10-16), up on a wide one, never past
 * dayCard.ts PLATE_SCALE_MAX. At the layout's lg gutter and up the deck bleeds
 * DECK_PEEK into the gutter on each side (DECK_BLEED_QUERY), so the card in
 * view is the section's own width — one left edge and one width with the
 * tables under it, the peeks in the gutter; below lg the peeks stay inside the
 * section, as before. What sits under a card takes the card's width
 * (underStyle). The deck is CONTROLLED: the caller says which card is in view
 * (index), and is told when a swipe, a button, a key or a dot moves it
 * (onIndexChange) — it keeps ?step= in step, with a replace, so a swipe never
 * fills the back button. Motion follows prefers-reduced-motion. It reads
 * nothing, writes nothing, stores nothing, and lives outside the day folder,
 * which keeps its three files (daycard01.test.ts T5).
 */

'use client';

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { DECK_NEXT_WORDS, DECK_PREVIOUS_WORDS, DECK_WORDS, PLATE_SCALE_MAX, PLATE_WIDTH, deckCardWords } from '../day/dayCard';

/** How much of the next card shows at each edge, so the swipe is obvious. */
export const DECK_PEEK = 28;
/** The space between two cards. */
export const DECK_GAP = 12;
/**
 * WIDTH-01: the viewport at which the deck bleeds into the page gutter — the layout's lg breakpoint, where its gutter is
 * px-8 (32 px; AppLayout.tsx), room for the peek. Below it the gutter is px-4 (16 px) and the peeks stay inside the section.
 */
export const DECK_BLEED_QUERY = '(min-width: 1024px)';

/** Does the deck bleed into the page gutter? The one media query, read on mount and on every change — never at render. */
export function useDeckBleed(): boolean {
  const [bleed, setBleed] = useState(false);
  useEffect(() => {
    const query = window.matchMedia(DECK_BLEED_QUERY);
    const read = () => setBleed(query.matches);
    read();
    query.addEventListener('change', read);
    return () => query.removeEventListener('change', read);
  }, []);
  return bleed;
}

/** The scale of the deck's cards: the deck's width (bled or not) less the peek on each side, over the plate's width, never past PLATE_SCALE_MAX. */
export const deckScaleOf = (deckWidth: number): number => Math.min(PLATE_SCALE_MAX, (deckWidth - 2 * DECK_PEEK) / PLATE_WIDTH);
/** The scale of a plate on its own in a frame of this width — the deck's card's width in the same regime: the frame's when the deck bleeds, else the frame's less the peeks. */
export const frameScaleOf = (frameWidth: number, bleed: boolean): number => Math.min(PLATE_SCALE_MAX, (bleed ? frameWidth : frameWidth - 2 * DECK_PEEK) / PLATE_WIDTH);
/** What sits under a card — buttons, fine print, the vendor box, the record row, the journal form — takes the card's width, centred as the card is. */
export const underStyle = (bleed: boolean): { readonly width: string; readonly maxWidth: number } =>
  ({ width: bleed ? '100%' : `calc(100% - ${2 * DECK_PEEK}px)`, maxWidth: PLATE_WIDTH * PLATE_SCALE_MAX });

export interface DeckCard {
  readonly key: string;
  /** The card's name on the position marker ("the day", "Brunch"). */
  readonly words: string;
}

const reducedMotion = (): boolean => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * A plate on its own, outside the deck (the journal card; the loading plate): centred, and scaled to the frame's width exactly
 * as the deck scales its cards (frameScaleOf — the same width in the same regime) — the plate itself stays PLATE_WIDTH wide,
 * so its image is full size.
 */
export function PlateFrame({ children }: { children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number | null>(null);
  const [height, setHeight] = useState<number>(0);
  const bleed = useDeckBleed();
  useEffect(() => {
    const el = frame.current;
    const plate = inner.current;
    if (el === null || plate === null) return;
    const measure = () => { setWidth(el.clientWidth); setHeight(plate.offsetHeight); };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    ro.observe(plate);
    measure();
    return () => ro.disconnect();
  }, []);
  const scale = width === null ? 1 : frameScaleOf(width, bleed);
  return (
    <div ref={frame} className="w-full flex justify-center" data-day-plate-frame data-day-plate-scale={scale.toFixed(3)}>
      <div style={{ width: Math.round(PLATE_WIDTH * scale), height: height === 0 ? undefined : Math.ceil(height * scale) }}>
        <div ref={inner} style={{ width: PLATE_WIDTH, transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
      </div>
    </div>
  );
}

export default function DayDeck({ cards, index, onIndexChange, children }: {
  cards: readonly DeckCard[];
  /** The card in view, 0-based — the caller's ?step=. */
  index: number;
  onIndexChange: (index: number) => void;
  /** One plate per card, in the cards' order. */
  children: readonly ReactNode[];
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const inner = useRef<(HTMLDivElement | null)[]>([]);
  const [deckWidth, setDeckWidth] = useState<number | null>(null);
  const [heights, setHeights] = useState<readonly number[]>([]);
  // The card the scroll position is on — what the caller is told; starts where the caller says.
  const shown = useRef(index);
  const settle = useRef<number | null>(null);
  const firstScroll = useRef(true);
  const bleed = useDeckBleed();

  const scale = deckWidth === null ? 1 : deckScaleOf(deckWidth);
  const slideWidth = Math.round(PLATE_WIDTH * scale);
  const stride = slideWidth + DECK_GAP;
  const sidePadding = deckWidth === null ? 0 : Math.max(0, Math.floor((deckWidth - slideWidth) / 2));

  // The deck's width, and each card's own (unscaled) height — measured, never guessed.
  useEffect(() => {
    const el = scroller.current;
    if (el === null) return;
    const ro = new ResizeObserver(() => setDeckWidth(el.clientWidth));
    ro.observe(el);
    setDeckWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);
  useEffect(() => {
    const els = inner.current.slice(0, cards.length);
    const measure = () => setHeights(els.map((e) => (e === null ? 0 : e.offsetHeight)));
    const ro = new ResizeObserver(measure);
    for (const e of els) if (e !== null) ro.observe(e);
    measure();
    return () => ro.disconnect();
  }, [cards.length]);

  const scrollTo = useCallback((i: number, smooth: boolean) => {
    const el = scroller.current;
    if (el === null) return;
    el.scrollTo({ left: i * stride, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
  }, [stride]);

  // The caller moved the card in view (a link, a reload, a tap on a row): scroll to it — instantly on the first paint and on a resize.
  useEffect(() => {
    if (deckWidth === null) return;
    const instant = firstScroll.current;
    firstScroll.current = false;
    if (shown.current !== index || instant) {
      shown.current = index;
      scrollTo(index, !instant);
    }
  }, [index, deckWidth, scrollTo]);
  useEffect(() => {
    if (deckWidth === null) return;
    scrollTo(shown.current, false);
  }, [stride, deckWidth, scrollTo]);

  // A swipe settles on a card: once the scroll rests, the card under the centre is the one in view.
  const onScroll = () => {
    if (settle.current !== null) window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => {
      const el = scroller.current;
      if (el === null) return;
      const i = Math.max(0, Math.min(cards.length - 1, Math.round(el.scrollLeft / stride)));
      if (i !== shown.current) {
        shown.current = i;
        onIndexChange(i);
      }
    }, 90);
  };
  const step = (direction: -1 | 1) => {
    const i = Math.max(0, Math.min(cards.length - 1, shown.current + direction));
    if (i === shown.current) return;
    shown.current = i;
    scrollTo(i, true);
    onIndexChange(i);
  };
  const jump = (i: number) => {
    if (i === shown.current) return;
    shown.current = i;
    scrollTo(i, true);
    onIndexChange(i);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
    if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
  };

  const height = heights[index] === undefined || heights[index] === 0 ? undefined : Math.ceil(heights[index] * scale);
  const arrow = 'absolute top-1/2 -translate-y-1/2 z-10 w-9 h-9 rounded-full border border-border bg-ts-white text-text-primary text-lg leading-none shadow disabled:opacity-30';

  return (
    <div className="relative" style={{ marginLeft: bleed ? -DECK_PEEK : 0, marginRight: bleed ? -DECK_PEEK : 0 }} data-day-deck data-day-deck-index={index} data-day-deck-of={cards.length} data-day-deck-scale={scale.toFixed(3)} data-day-deck-bleed={bleed ? 'true' : 'false'}>
      <div
        ref={scroller}
        className="flex items-start outline-none focus-visible:ring-2 focus-visible:ring-brand-purple rounded-xl"
        style={{ overflowX: 'auto', overflowY: 'hidden', scrollSnapType: 'x mandatory', gap: DECK_GAP, paddingLeft: sidePadding, paddingRight: sidePadding, scrollbarWidth: 'none', height, transition: reducedMotion() ? undefined : 'height 220ms ease' }}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label={DECK_WORDS}
        onScroll={onScroll}
        onKeyDown={onKeyDown}
        data-day-deck-scroller
      >
        {cards.map((card, i) => (
          <div
            key={card.key}
            className="shrink-0"
            style={{ width: slideWidth, height: heights[i] === undefined || heights[i] === 0 ? undefined : Math.ceil(heights[i] * scale), scrollSnapAlign: 'center', scrollSnapStop: 'always' }}
            role="group"
            aria-roledescription="slide"
            aria-label={deckCardWords(i + 1, cards.length, card.words)}
            aria-hidden={i !== index}
            data-day-deck-card={i}
          >
            <div ref={(el) => { inner.current[i] = el; }} style={{ width: PLATE_WIDTH, transform: scale === 1 ? undefined : `scale(${scale})`, transformOrigin: 'top left' }}>
              {children[i]}
            </div>
          </div>
        ))}
      </div>
      <button type="button" className={`${arrow} left-1`} aria-label={DECK_PREVIOUS_WORDS} disabled={index === 0} onClick={() => step(-1)} data-day-deck-previous>‹</button>
      <button type="button" className={`${arrow} right-1`} aria-label={DECK_NEXT_WORDS} disabled={index >= cards.length - 1} onClick={() => step(1)} data-day-deck-next>›</button>
      <div className="flex items-center justify-center gap-1.5 pt-2" data-day-deck-dots>
        {cards.map((card, i) => (
          <button
            type="button"
            key={card.key}
            className={`rounded-full border border-border ${i === index ? 'bg-brand-purple border-brand-purple' : 'bg-ts-white hover:bg-bg-row'}`}
            style={{ width: 9, height: 9 }}
            aria-label={deckCardWords(i + 1, cards.length, card.words)}
            aria-current={i === index ? 'true' : undefined}
            onClick={() => jump(i)}
            data-day-deck-dot={i}
          />
        ))}
      </div>
    </div>
  );
}
