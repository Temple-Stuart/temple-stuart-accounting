/**
 * The row law's seeded regressions (TRAVEL-ROW-01, 2026-09-23).
 *
 * The law says one thing five ways: the action lives at the line. These five
 * seeds are its five clauses, one each — every one of them is the shape the
 * founder actually hit on main 97d6db04, put back:
 *
 *   · the strip drifts OUT of the table body, so it is a bar after the table
 *     again rather than a row under the line (clause 1);
 *   · a selection bar comes back outside the table — two places to act, which
 *     is the ambiguity the ruling deleted (clause 2);
 *   · the checkout goes back to the tail of the container's page instead of
 *     the view's slot, so Book opens a form off-screen (clause 3);
 *   · Escape stops closing the checkout, so focus is trapped away from the row
 *     it came from (clause 4);
 *   · a checkout panel's own bytes move — this ruling changed WHERE the panel
 *     mounts and nothing about what it does, so any change to those two files
 *     is a different ruling (clause 5).
 *
 * Each must fail THE ROW LAW by name. The anchors occur exactly once in their
 * file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const HOTEL_VIEW = 'src/components/trips/HotelResultsView.tsx';
const ACTIVITY_VIEW = 'src/components/trips/ActivityPickerView.tsx';
const FLIGHT_CONTAINER = 'src/components/trips/PublicFlightSearch.tsx';
const STRIP = 'src/components/trips/RowActionStrip.tsx';
const CHECKOUT = 'src/components/trips/CheckoutPanel.tsx';

export const SEEDS: Seed[] = [
  {
    name: 'row-a the strip drifts OUT of the table body — a bar after the table, not a row under the line (clause 1)',
    file: HOTEL_VIEW,
    find: '                                  {isSelected && (\n                                    <RowActionStrip\n',
    replace: '                                  </tbody>\n                                  {isSelected && (\n                                    <RowActionStrip\n',
    expect: 'mounts <RowActionStrip/> outside a <tbody>',
  },
  {
    name: 'row-b the deleted selection bar comes back outside the table — two places to act (clause 2)',
    file: ACTIVITY_VIEW,
    find: '        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-faint" data-activity-paging>',
    replace: '        <div className="flex flex-wrap items-center justify-between gap-2 rounded border border-border bg-bg-row p-3" data-activity-selection>\n          {savePanel}\n        </div>\n        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-faint" data-activity-paging>',
    expect: 'still carries `data-activity-selection`',
  },
  {
    name: 'row-c the checkout goes back to the tail of the page instead of the view\'s slot (clause 3)',
    file: FLIGHT_CONTAINER,
    find: '    </TravelSectionShell>\n  );\n}\n',
    replace: '      {booking && (\n        <LiteApiFlightCheckoutPanel\n          offerId={booking.offer.id}\n          price={booking.offer.price}\n          currency={booking.offer.currency}\n          onBooked={() => { onCommitted?.(); }}\n        />\n      )}\n    </TravelSectionShell>\n  );\n}\n',
    expect: 'mounts <LiteApiFlightCheckoutPanel/> 2 times',
  },
  {
    name: 'row-d Escape stops closing the checkout, so focus never returns to the row (clause 4)',
    file: STRIP,
    find: "if (e.key === 'Escape')",
    replace: "if (e.key === 'Enter')",
    expect: 'does not close on Escape',
  },
  {
    name: 'row-e a checkout panel\'s own bytes move — display is not booking (clause 5)',
    file: CHECKOUT,
    find: 'Test mode — use card 4242 4242 4242 4242, any future date, any CVV. No real charge.',
    replace: 'Test mode — use card 4242 4242 4242 4242, any future date, any CVV. Nothing is charged.',
    expect: 'TRAVEL-ROW-01 moved WHERE the checkout mounts, never what it does',
  },
];

export default SEEDS;
