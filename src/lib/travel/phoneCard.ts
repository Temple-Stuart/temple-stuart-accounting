/**
 * FINISH-01 (2026-09-28) — A RESULT ROW IS A CARD ON A PHONE.
 *
 * Measured on main 3cd8872f at 390×844 (the FINISH-01 walk): every result table on
 * the travel tab sat in an `overflow-x-auto` box with `whitespace-nowrap` cells, so
 * the row's price and its action were past the box's right edge — the flight table
 * 815px wide in a 254px box, the hotel table 995px in 288px, the tour table 1745px,
 * the transfer table 720px. The tour and transfer lanes also pushed the PAGE sideways
 * (1675px and 705px wide at 390; 1899px at 1280): their `sr-only` header cells are
 * `position: absolute`, their containing block lay OUTSIDE the scroll box, and their
 * static position at the table's far right widened the document.
 *
 * THE RULE — one set of display classes for every result table on the travel tab:
 *   · below `sm` the table, its body, its rows and its cells are blocks, and each row
 *     is a CARD (a wrapping flex line): the title cell (with its photo when the row
 *     has one) fills the first line, each stated fact takes a line of its own
 *     (`fact`) or half of one (`half`), and the price and the action share the
 *     last line. A cell the row leaves EMPTY (the table draws a blank cell) is left
 *     out of the card (`emptyOnPhone`) — there is nothing in it to show. It is the SAME
 *     cells in the SAME order with the SAME helpers — nothing is dropped. The header
 *     row is not drawn below `sm`, so each fact cell carries its column's header
 *     word (`label`) — the same string the header cell renders, from one constant.
 *   · at `sm` and up every class restores the table exactly: `sm:table`,
 *     `sm:table-header-group`, `sm:table-row-group`, `sm:table-row`,
 *     `sm:table-cell`, `sm:whitespace-nowrap`, `sm:overflow-x-auto`. The desktop
 *     table is unchanged.
 *   · the results box is `relative` at every width, so an absolutely-positioned
 *     descendant (an sr-only header cell) is clipped by the box instead of widening
 *     the page.
 * Pure strings: no import but the one header voice, no logic.
 */
import { DATA } from '@/lib/ds';

export const PHONE_CARD = {
  /** The results box: the table scrolls sideways inside it at `sm` and up; the cards never need to. */
  box: 'relative sm:overflow-x-auto',
  /** The table: a stack of cards below `sm`, a table at `sm` and up. */
  table: 'block sm:table',
  /** The header row: drawn at `sm` and up only — below it each card carries the words (`label`). */
  head: 'hidden sm:table-header-group',
  /** The body: a block of cards below `sm`. */
  body: 'block sm:table-row-group',
  /** A result row: a card whose cells wrap onto lines in the row's own order. */
  row: 'flex flex-wrap items-start gap-x-2 sm:table-row',
  /** A row that spans the table — the expanded rates or fares, the action strip — is a full-width block. */
  wideRow: 'block sm:table-row',
  /** Every cell: a block in the card — no word may push it wider than the phone — a table cell at `sm` and up. */
  cell: 'block min-w-0 [overflow-wrap:anywhere] sm:table-cell sm:[overflow-wrap:normal]',
  /** The card's title cell fills the rest of the first line (beside the photo, when there is one). */
  title: 'flex-1',
  /** The photo keeps its size beside the title. */
  photo: 'shrink-0',
  /** A stated fact takes a line of its own in the card. */
  fact: 'basis-full',
  /** A short fact shares its line with one other (the flight's departure | arrival, stops | duration). */
  half: 'basis-[calc(50%-0.25rem)]',
  /** A cell with nothing in it (the table draws an empty cell) is left out of the card — nothing to show.
   *  Added beside `cell`: Tailwind emits `hidden` after `block` among the display utilities, so it wins
   *  below `sm`, and `sm:table-cell` restores the (empty) table cell at `sm` and up. */
  emptyOnPhone: 'hidden',
  /** Kept on one line only where the table is. */
  nowrap: 'sm:whitespace-nowrap',
  /** Right-aligned only where the table is — the card reads left to right. */
  end: 'sm:text-right',
  /** The column's own header word, inside the card below `sm` — the header row carries it at `sm` and up. */
  label: `mr-1.5 ${DATA.columnHeader} sm:hidden`,
} as const;
