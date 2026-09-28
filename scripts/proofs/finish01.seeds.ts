/**
 * The travel law's FINISH-01 clauses — seeded regressions (2026-09-28).
 *
 * The ruling: below `sm` a result row on the travel tab is a card — nothing
 * overflows at 390px — and every search shows its filters BEFORE the Search
 * button. These seeds put back, one at a time, each shape clause 5 of the travel
 * law closes:
 *
 *   · the card — a cell, a row, a head, a table left in table display; a bare
 *     whitespace-nowrap or overflow-x-auto at the base breakpoint; a new result
 *     table the census does not cover; the strip no longer a wide row; the class
 *     module itself losing `relative` or its `sm:` restore;
 *   · the words — a header cell typing its word, a card label typing its word, a
 *     label that is no header word;
 *   · the filters — the transfers bar after Search (the ruling's seed), a view
 *     drawing a filter bar itself, an effect that searches on a filter, the filters
 *     sent in the transfers request, the hotel bar after a submit, a flight filter
 *     after the leg's SEARCH.
 *
 * Each must fail the travel law by name. The anchors occur exactly once in their
 * file, which the harness enforces before it runs anything.
 */
import type { Seed } from '../prove';

const T = 'src/components/trips';

const SEEDS: Seed[] = [
  // ── the card ──
  {
    name: 'finish01-a a hotel photo cell loses the card cell (keeps its table display on a phone)',
    file: `${T}/HotelResultsView.tsx`,
    find: '<td className={`${PHONE_CARD.cell} ${PHONE_CARD.photo} px-2 py-2`}>\n                        <div className="h-14 w-20 overflow-hidden rounded"><HotelCardImage',
    replace: '<td className="px-2 py-2">\n                        <div className="h-14 w-20 overflow-hidden rounded"><HotelCardImage',
    expect: 'a <td> that is not a card cell',
  },
  {
    name: 'finish01-b a tour rating cell is whitespace-nowrap at the base breakpoint again (the ruling\'s seed)',
    file: `${T}/ActivityPickerView.tsx`,
    find: '${PHONE_CARD.nowrap} px-3 py-0.5 text-xs text-text-secondary sm:py-2`}><span className={PHONE_CARD.label}>{COLUMNS.rating}',
    replace: 'whitespace-nowrap px-3 py-0.5 text-xs text-text-secondary sm:py-2`}><span className={PHONE_CARD.label}>{COLUMNS.rating}',
    expect: 'whitespace-nowrap at the base breakpoint',
  },
  {
    name: 'finish01-c the transfers box scrolls sideways on a phone again',
    file: `${T}/ActivityResultsView.tsx`,
    find: '<div className={`${PHONE_CARD.box} rounded-lg border border-border bg-white`} aria-label="Activity results">',
    replace: '<div className="overflow-x-auto rounded-lg border border-border bg-white" aria-label="Activity results">',
    expect: 'overflow-x-auto at the base breakpoint',
  },
  {
    name: 'finish01-d the fare table\'s header row is drawn on a phone again',
    file: `${T}/FlightPickerView.tsx`,
    find: '<thead className={PHONE_CARD.head}>\n                                          <tr className="text-left">\n                                            <th className={`px-2 py-1 ${DATA.columnHeader}`}>{FARE_COLUMNS.fare}</th>',
    replace: '<thead>\n                                          <tr className="text-left">\n                                            <th className={`px-2 py-1 ${DATA.columnHeader}`}>{FARE_COLUMNS.fare}</th>',
    expect: 'a <thead> without PHONE_CARD.head',
  },
  {
    name: 'finish01-e the tour option table is a table on a phone again',
    file: `${T}/PublicActivitySearch.tsx`,
    find: '<table className={`${PHONE_CARD.table} w-full text-xs`} data-activity-option-table>',
    replace: '<table className="w-full text-xs" data-activity-option-table>',
    expect: 'a <table> without PHONE_CARD.table',
  },
  {
    name: 'finish01-f a hotel\'s rates row is a table row on a phone again',
    file: `${T}/HotelResultsView.tsx`,
    find: '<tr key={`${card.hotelId}:rates`} className={`${PHONE_CARD.wideRow} bg-white`}>',
    replace: '<tr key={`${card.hotelId}:rates`} className="bg-white">',
    expect: 'a body <tr> that is not PHONE_CARD.row or .wideRow',
  },
  {
    name: 'finish01-g a new result table on the strip that the phone card does not cover',
    file: `${T}/PublicVisaCheck.tsx`,
    find: '      <form onSubmit={check} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">',
    replace: '      <table className="w-full text-sm"><tbody><tr><td className="whitespace-nowrap">rule</td></tr></tbody></table>\n      <form onSubmit={check} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">',
    expect: 'draws a <table> the phone card does not cover',
  },
  {
    name: 'finish01-h the action strip is a table row on a phone again',
    file: `${T}/RowActionStrip.tsx`,
    find: 'className={`${PHONE_CARD.wideRow} bg-brand-purple-wash/20`}',
    replace: 'className="bg-brand-purple-wash/20"',
    expect: 'the action strip is not a wide row of one card cell',
  },
  {
    name: 'finish01-i the results box loses `relative` — an sr-only header widens the page again',
    file: 'src/lib/travel/phoneCard.ts',
    find: "box: 'relative sm:overflow-x-auto',",
    replace: "box: 'sm:overflow-x-auto',",
    expect: 'PHONE_CARD.box is',
  },
  {
    name: 'finish01-j a card cell never restores its table cell at sm',
    file: 'src/lib/travel/phoneCard.ts',
    find: "cell: 'block min-w-0 [overflow-wrap:anywhere] sm:table-cell sm:[overflow-wrap:normal]',",
    replace: "cell: 'block min-w-0 [overflow-wrap:anywhere]',",
    expect: 'PHONE_CARD.cell is',
  },
  // ── the words ──
  {
    name: 'finish01-k a flight header cell types its word instead of the constant the card reads',
    file: `${T}/FlightPickerView.tsx`,
    find: '>{COLUMNS.dep}</th>',
    replace: '>Dep</th>',
    expect: 'a header cell renders "Dep"',
  },
  {
    name: 'finish01-l a hotel card label types its word',
    file: `${T}/HotelResultsView.tsx`,
    find: '<span className={PHONE_CARD.label}>{COLUMNS.stars}</span>',
    replace: '<span className={PHONE_CARD.label}>Stars</span>',
    expect: 'a card label renders "Stars"',
  },
  {
    name: 'finish01-m a tour card label that is no header word',
    file: `${T}/ActivityPickerView.tsx`,
    find: '<span className={PHONE_CARD.label}>{COLUMNS.cancellation}</span>',
    replace: '<span className={PHONE_CARD.label}>{COLUMNS.note}</span>',
    expect: 'is no header cell’s word',
  },
  // ── the filters ──
  {
    name: 'finish01-n the transfers filters go back after the Search button (the ruling\'s seed)',
    file: `${T}/PublicTransferSearch.tsx`,
    find: "        <div className=\"col-span-full\">\n          <ResultsFilterBar\n            sort={sort}\n            minRating={minRating}\n            onSortChange={setSort}\n            onMinRatingChange={setMinRating}\n          />\n        </div>\n",
    replace: "        <div className=\"col-span-full\"><button type=\"submit\">Search</button></div>\n        <div className=\"col-span-full\">\n          <ResultsFilterBar\n            sort={sort}\n            minRating={minRating}\n            onSortChange={setSort}\n            onMinRatingChange={setMinRating}\n          />\n        </div>\n",
    expect: '<ResultsFilterBar sits outside its form or after the Search button',
  },
  {
    name: 'finish01-o the transfers results view draws the filter bar itself again',
    file: `${T}/ActivityResultsView.tsx`,
    find: '      <ResultsShownNote\n',
    replace: '      <ResultsFilterBar sort={sort} minRating={minRating} onSortChange={() => {}} onMinRatingChange={() => {}} />\n      <ResultsShownNote\n',
    expect: 'draws <ResultsFilterBar> itself',
  },
  {
    name: 'finish01-p a filter change runs a search (an effect on the sort)',
    file: `${T}/PublicTransferSearch.tsx`,
    find: '  const [minRating, setMinRating] = useState(0);\n',
    replace: '  const [minRating, setMinRating] = useState(0);\n  useEffect(() => { if (searched) runSearch(city, country); }, [sort]);\n',
    expect: 'an effect runs on the filter state',
  },
  {
    name: 'finish01-q the transfers request sends the sort',
    file: `${T}/PublicTransferSearch.tsx`,
    find: '        country: countryVal.trim(),\n      });',
    replace: '        country: countryVal.trim(),\n        sort,\n      });',
    expect: 'the transfers request is no longer city and country alone',
  },
  {
    name: 'finish01-r a submit sits before the hotel filter bar',
    file: `${T}/PublicHotelSearch.tsx`,
    find: '        <div className="col-span-full">\n          <HotelFiltersBar',
    replace: '        <button type="submit" hidden />\n        <div className="col-span-full">\n          <HotelFiltersBar',
    expect: '<HotelFiltersBar sits outside its form or after the Search button',
  },
  {
    name: 'finish01-s a flight filter control after the leg\'s SEARCH',
    file: `${T}/FlightPickerView.tsx`,
    find: '<button onClick={() => onSearchLeg(leg.id)} disabled={leg.loading}',
    replace: '<button onClick={() => onSearchLeg(leg.id)} data-flight-filter="late" disabled={leg.loading}',
    expect: 'a leg’s filter controls are not all before its SEARCH',
  },
];

export default SEEDS;
