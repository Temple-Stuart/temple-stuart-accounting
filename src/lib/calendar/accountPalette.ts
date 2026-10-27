/**
 * CAL-03 (Alex, 2026-10-27) — THE LEGEND BY ACCOUNT: a routine tile is coloured by
 * the account it is coded to (CAL-02's `account` on the tile), not by its source.
 *
 * A. The colour is a DETERMINISTIC hash of (book, code) into EIGHT literal quartets
 *    — background · border · text · swatch, each a literal class name from the token
 *    palette (tailwind.config.ts). The same account is the same colour on every day
 *    and every device; nothing is stored, nothing is chosen by hand.
 * B. Two accounts in the fetched range that hash to the same quartet are a
 *    COLLISION: both keep the quartet and each legend chip says "shares a colour
 *    with <the other>" — declared, never hidden, never re-hashed.
 * C. 'several' → the neutral "several accounts" quartet; 'none', 'missing' and a tile
 *    whose window answer carried no account read → the grey quartet, each with its
 *    own chip words. The two neutrals are literal quartets outside the hashed eight.
 * D. The legend is what the FETCHED RANGE holds: every account present, one chip
 *    each, ordered by book letter then code, then the neutral chips when present;
 *    the grid appends the non-routine sources' chips exactly as before.
 * E. One rule, one module — pure; CalendarGrid reads it for routine tiles and the
 *    legend. sources.ts, the drill panel, the day card and the tables are untouched.
 *
 * THE EIGHT, measured (WCAG 2 contrast of the text on the background, over the token
 * values in globals.css; the floor is 4.5:1):
 *   0 purple  bg-brand-purple #3b2d6b · text-white         11.84
 *   1 red     bg-brand-red    #c53030 · text-white          5.47
 *   2 green   bg-brand-green  #16a34a · text-text-primary   5.18   (white would be 3.30)
 *   3 gold    bg-brand-gold   #B8860B · text-text-primary   5.24   (white would be 3.25)
 *   4 amber   bg-brand-amber  #d97706 · text-text-primary   5.35   (white would be 3.19)
 *   5 aqua    bg-ts-aqua      #14e0c8 · text-text-primary  10.17
 *   6 cyan    bg-ts-cyan      #22d3ee · text-text-primary   9.44
 *   7 indigo  bg-ts-indigo    #818cf8 · text-text-primary   5.72
 * The neutrals: several — text-brand-purple-deep #2d1b4e on bg-brand-purple-wash
 * #eae7f2, 12.49; grey — text-text-secondary #4a4a5a on bg-bg-row #F3EFE6, 7.57.
 * The token palette holds five hue families with an alpha channel (purple, gold,
 * green, red, amber) and three without (aqua, cyan, indigo); the eight are one of
 * each, so no two are shades of one hue.
 */
import { ROUTINES_SOURCE } from '@/lib/hub/mapOperationsRoutines';
import { ACCOUNT_NOT_READ_WORDS, NO_ACCOUNT_WORDS, SEVERAL_ACCOUNTS_WORDS, accountWords, type TileAccount, type TileAccountState } from '@/lib/hub/tileAccount';

/** One colour a tile wears: its background, its border, its text and the legend's swatch — four literal classes. */
export interface Quartet {
  readonly bg: string;
  readonly border: string;
  readonly text: string;
  readonly swatch: string;
}

/** THE HASHED EIGHT — literal, in index order; the hash picks one by (book, code). */
export const ACCOUNT_QUARTETS: readonly Quartet[] = [
  { bg: 'bg-brand-purple', border: 'border-brand-purple-deep', text: 'text-white',        swatch: 'bg-brand-purple' },
  { bg: 'bg-brand-red',    border: 'border-brand-red',         text: 'text-white',        swatch: 'bg-brand-red' },
  { bg: 'bg-brand-green',  border: 'border-brand-green',       text: 'text-text-primary', swatch: 'bg-brand-green' },
  { bg: 'bg-brand-gold',   border: 'border-brand-accent-dark', text: 'text-text-primary', swatch: 'bg-brand-gold' },
  { bg: 'bg-brand-amber',  border: 'border-brand-amber',       text: 'text-text-primary', swatch: 'bg-brand-amber' },
  { bg: 'bg-ts-aqua',      border: 'border-ts-aqua-deep',      text: 'text-text-primary', swatch: 'bg-ts-aqua' },
  { bg: 'bg-ts-cyan',      border: 'border-ts-cyan',           text: 'text-text-primary', swatch: 'bg-ts-cyan' },
  { bg: 'bg-ts-indigo',    border: 'border-ts-indigo',         text: 'text-text-primary', swatch: 'bg-ts-indigo' },
] as const;
export const QUARTET_COUNT = 8;

/** 'several' — a lined routine coded to more than one account: the neutral purple wash. */
export const SEVERAL_QUARTET: Quartet = { bg: 'bg-brand-purple-wash', border: 'border-brand-purple-hover', text: 'text-brand-purple-deep', swatch: 'bg-brand-purple-hover' };
/** 'none', 'missing', and a tile not read with its account: the grey. */
export const GREY_QUARTET: Quartet = { bg: 'bg-bg-row', border: 'border-border', text: 'text-text-secondary', swatch: 'bg-text-faint' };

// ── A · THE HASH ─────────────────────────────────────────────────────────────

/** FNV-1a (32-bit) over "<book>-<code>" — the account's string, as the chip prints it; no clock, no store, no randomness. */
export function accountHash(book: string, code: string): number {
  const s = `${book}-${code}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
/**
 * The quartet's index for an account: the hash's two halves folded, then modulo
 * eight. Modulo eight of the raw hash reads only the low three bits of every
 * character (a multiply by an odd constant never carries upward into them), which
 * put P-6150, P-6200 and B-6080 on one quartet; folded, every quartet is equally
 * likely over the four-digit codes of a book (measured: 3332–3420 of 27 000 each).
 */
export const quartetIndexOf = (account: Pick<TileAccount, 'book' | 'code'>): number => {
  const h = accountHash(account.book, account.code);
  return ((h ^ (h >>> 16)) >>> 0) % QUARTET_COUNT;
};
/** The quartet an account wears, by the hash — the same (book, code) is the same quartet on every call. */
export const quartetOf = (account: Pick<TileAccount, 'book' | 'code'>): Quartet => ACCOUNT_QUARTETS[quartetIndexOf(account)];

// ── C · THE TILE ─────────────────────────────────────────────────────────────

/** What the palette reads of a grid event — the day card's CalendarEvent satisfies it. */
export interface PaletteEvent {
  readonly source: string;
  readonly account?: TileAccount | null;
  readonly accountState?: TileAccountState;
}

/** A routine tile is told apart by its source — the one the mapper writes (mapOperationsRoutines.ts ROUTINES_SOURCE; chain.ts kindOfSource reads the same name as kind 'routine'). */
export const isRoutineTile = (e: Pick<PaletteEvent, 'source'>): boolean => e.source === ROUTINES_SOURCE;

/**
 * The quartet a tile wears: null for a tile that is not a routine's (its source's
 * badge draws it, as before); an account's hashed quartet; 'several' → the neutral;
 * 'none', 'missing' and an answer not read with its account → the grey. A tile
 * whose state says 'account' but carries none is the mapper's error, thrown.
 */
export function tileQuartetOf(e: PaletteEvent): Quartet | null {
  if (!isRoutineTile(e)) return null;
  switch (e.accountState) {
    case undefined: return GREY_QUARTET;
    case 'several': return SEVERAL_QUARTET;
    case 'none': return GREY_QUARTET;
    case 'missing': return GREY_QUARTET;
    case 'account':
      if (!e.account) throw new Error('accountPalette: a tile in state account carries no account — the mapper hands both');
      return quartetOf(e.account);
  }
}

// ── D · THE LEGEND ───────────────────────────────────────────────────────────

export type LegendChipKind = 'account' | 'several' | 'none' | 'missing' | 'not-read';
export interface LegendChip {
  /** 'account:P-6150 Food & drink' · 'several' · 'none' · 'missing:P-9999' · 'not-read' */
  readonly key: string;
  readonly kind: LegendChipKind;
  /** The chip's words — the account's (tileAccount.ts accountWords), or the neutral's. */
  readonly words: string;
  readonly quartet: Quartet;
  /** B: the other accounts in the range on the same quartet, in legend order — empty when the colour is this account's alone. */
  readonly sharesWith: readonly string[];
}
export const sharesColourWords = (words: string): string => `shares a colour with ${words}`;

const byBookThenCode = (a: TileAccount, b: TileAccount): number => a.book.localeCompare(b.book) || a.code.localeCompare(b.code) || (a.name ?? '').localeCompare(b.name ?? '');

/**
 * The legend for the fetched range: one chip per account among the routine tiles,
 * by book letter then code, each with its hashed quartet and its collisions (B);
 * then the neutrals present — several, none, one per missing account (by book then
 * code), not read. Tiles of other sources are not read here — the grid lists their
 * sources' chips as before. Pure over the events it is handed.
 */
export function legendOf(events: readonly PaletteEvent[]): LegendChip[] {
  const accounts = new Map<string, TileAccount>();
  const missing = new Map<string, TileAccount>();
  let several = false, none = false, notRead = false;
  for (const e of events) {
    if (!isRoutineTile(e)) continue;
    switch (e.accountState) {
      case undefined: notRead = true; break;
      case 'several': several = true; break;
      case 'none': none = true; break;
      case 'missing':
        if (!e.account) throw new Error('accountPalette: a tile in state missing carries no account — the mapper hands its code and book');
        missing.set(`${e.account.book}-${e.account.code}`, e.account);
        break;
      case 'account':
        if (!e.account) throw new Error('accountPalette: a tile in state account carries no account — the mapper hands both');
        accounts.set(accountWords(e.account, 'account'), e.account);
        break;
    }
  }
  const sorted = [...accounts.values()].sort(byBookThenCode);
  const chips: LegendChip[] = sorted.map((a) => {
    const words = accountWords(a, 'account');
    const index = quartetIndexOf(a);
    const sharesWith = sorted.filter((o) => o !== a && quartetIndexOf(o) === index).map((o) => accountWords(o, 'account'));
    return { key: `account:${words}`, kind: 'account', words, quartet: ACCOUNT_QUARTETS[index], sharesWith };
  });
  if (several) chips.push({ key: 'several', kind: 'several', words: SEVERAL_ACCOUNTS_WORDS, quartet: SEVERAL_QUARTET, sharesWith: [] });
  if (none) chips.push({ key: 'none', kind: 'none', words: NO_ACCOUNT_WORDS, quartet: GREY_QUARTET, sharesWith: [] });
  for (const a of [...missing.values()].sort(byBookThenCode)) chips.push({ key: `missing:${a.book}-${a.code}`, kind: 'missing', words: accountWords(a, 'missing'), quartet: GREY_QUARTET, sharesWith: [] });
  if (notRead) chips.push({ key: 'not-read', kind: 'not-read', words: ACCOUNT_NOT_READ_WORDS, quartet: GREY_QUARTET, sharesWith: [] });
  return chips;
}
