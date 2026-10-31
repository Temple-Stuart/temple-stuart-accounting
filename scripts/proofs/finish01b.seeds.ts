/**
 * The travel law's FINISH-01b clause — seeded regressions (2026-09-28).
 *
 * The ruling (Alex, option a): at `sm` and up the tours table's Rating, Duration,
 * Cancellation and Price cells WRAP — normal white-space, at most 12rem — so the table
 * fits a desktop box (1745px in a 954px box at 1280 on main; 954 of 954 with the four
 * wrapping). Nothing else changes. These seeds put the regressions back one at a time:
 *
 *   · the ruling's seed — `sm:whitespace-nowrap` back on one of the four (Rating);
 *   · the Price cell (the one that holds the extra-charges line) back on PHONE_CARD.nowrap;
 *   · TOUR_WRAP itself declared as a nowrap;
 *   · a fifth cell wrapping — the Link cell losing its nowrap (nothing else changes).
 *
 * Each must fail the travel law by name. The anchors occur exactly once in their file,
 * which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const TOURS = 'src/components/trips/ActivityPickerView.tsx';

const SEEDS: Seed[] = [
  {
    name: 'finish01b-a the Rating cell is kept on one line at sm again (the ruling\'s seed)',
    file: TOURS,
    find: '${PHONE_CARD.fact} ${TOUR_WRAP} px-3 py-0.5 text-xs text-text-secondary sm:py-2`}><span className={PHONE_CARD.label}>{COLUMNS.rating}',
    replace: '${PHONE_CARD.fact} sm:whitespace-nowrap px-3 py-0.5 text-xs text-text-secondary sm:py-2`}><span className={PHONE_CARD.label}>{COLUMNS.rating}',
    expect: 'the tours rating cell does not wrap at sm',
  },
  {
    name: 'finish01b-b the Price cell (with the extra-charges line) goes back to PHONE_CARD.nowrap',
    file: TOURS,
    find: '<td className={`${PHONE_CARD.cell} ${TOUR_WRAP} ${PHONE_CARD.end} px-3 py-2`}>',
    replace: '<td className={`${PHONE_CARD.cell} ${PHONE_CARD.nowrap} ${PHONE_CARD.end} px-3 py-2`}>',
    expect: 'the tours price cell does not wrap at sm',
  },
  {
    name: 'finish01b-c TOUR_WRAP is declared as a nowrap',
    file: TOURS,
    find: "const TOUR_WRAP = 'sm:max-w-[12rem] sm:whitespace-normal';",
    replace: "const TOUR_WRAP = 'sm:whitespace-nowrap';",
    expect: 'no longer declares TOUR_WRAP as normal white-space at most 12rem',
  },
  {
    name: 'finish01b-d a fifth cell wraps — the Link cell loses its nowrap',
    file: TOURS,
    find: '<td className={`${PHONE_CARD.cell} ${PHONE_CARD.nowrap} ${PHONE_CARD.end} px-3 py-2`}>',
    replace: '<td className={`${PHONE_CARD.cell} ${TOUR_WRAP} ${PHONE_CARD.end} px-3 py-2`}>',
    expect: 'the Link cell lost PHONE_CARD.nowrap',
  },
];

export default SEEDS;
