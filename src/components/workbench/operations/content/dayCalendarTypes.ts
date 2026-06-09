/**
 * dayCalendarTypes — type-only re-export shim (PR B).
 *
 * Lets the PURE DayCalendarView type its `timeline` / `entities` props WITHOUT
 * importing the `useDayFeed` hook module (or the entity context) by name — the
 * view must stay provably free of the data hooks, and these `export type … from`
 * lines are fully erased at compile time (no runtime import, no coupling).
 */
export type { TimelineRow } from './useDayFeed';
export type { Entity } from '../EntitySelector';
