/**
 * EVENTS-02 (Alex, 2026-11-08; board K tag 5) — ten new event categories join the I'M INTO
 * chips after the nine, each with its marquee events of the twelve months from the run date,
 * every row dated from the event's own calendar with the day it was read.
 *
 *   T1 the categories — the ten, appended after the nine in K's order; surfing stays first;
 *   T2 the rows — every new category has a row (at most six); every new row passes the leaf's
 *      law, carries the run date as checkedOn, links an https page that was opened (pinned
 *      below, one by one), and falls inside the twelve months; no two share an edition.
 * No live call, no database, no clock: the run date is written down, not read.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXPERIENCES, EXPERIENCE_CATEGORIES, experiencesLaw, type Experience } from '../experiences';

const RUN_DATE = '2026-11-08';
const TWELVE_MONTHS_ON = '2027-11-08';

const NEW_CATEGORIES = [
  ['football', 'Football'], ['basketball', 'Basketball'], ['cycling', 'Cycling'], ['running', 'Running'],
  ['sailing', 'Sailing'], ['horse_racing', 'Horse racing'], ['rugby', 'Rugby'], ['cricket', 'Cricket'],
  ['culture_holidays', 'Culture & holidays'], ['food_drink', 'Food & drink'],
] as const;

const NEW_IDS: readonly string[] = NEW_CATEGORIES.map(([id]) => id);
const isNew = (r: Experience): boolean => NEW_IDS.includes(r.category);
const NEW_ROWS = EXPERIENCES.filter(isNew);

/** Every page a new row links — each opened on 2026-11-08 and its dates read there (the PR's report lists them). */
const OPENED: readonly string[] = [
  'https://www.conmebol.com/noticias/inicia-la-venta-de-entradas-para-la-final-de-la-conmebol-libertadores-2026-en-montevideo/',
  'https://www.thefa.com/news/2026/jun/05/round-dates',
  'https://www.uefa.com/uefaeuropaleague/news/02a6-20d7a0ce22a3-00fac1a69d7f-1000--2027-uefa-europa-league-final-frankfurt/',
  'https://www.uefa.com/uefaconferenceleague/news/02a6-20d7a01c1842-c736fd0f40c0-1000--2027-uefa-conference-league-final-istanbul/',
  'https://www.uefa.com/uefachampionsleague/news/02a6-20d57cfcd03e-407c22a7f465-1000/',
  'https://inside.fifa.com/news/womens-world-cup-brazil-2027-play-off-draw-sarai-bareman',
  'https://pr.nba.com/pelicans-spurs-paris-manchester/',
  'https://nbaevents.nba.com/nba-all-star-2027',
  'https://detroitsports.org/news/2025/12/19/general-ncaa-and-detroit-local-organizing-committee-reveal-logo-for-2027-mens-final-four.aspx',
  'https://www.mediaoffice.abudhabi/en/sport/euroleague-final-four-to-return-to-abu-dhabi-in-2027-and-2029-bringing-leading-european-club-basketball-to-the-emirate/',
  'https://www.fiba.basketball/en/events/fiba-basketball-world-cup-2027/news/get-ready-world-cup-2027-venues-confirmed-with-exactly-two-years-to-go',
  'https://www.tourdownunder.com.au/festival/tour-village',
  'https://www.paris-roubaix.fr/en/',
  'https://www.giroditalia.it/en/',
  'https://www.letour.fr/en/',
  'https://www.uci.org/pressrelease/discover-the-calendar-for-the-2027-uci-cycling-world-championships-in-haute-savoie-mont-blanc/1tEIUtEoRq13aaef4p3bdx',
  'https://www.lavuelta.es/en',
  'https://www.marathon.tokyo/en/',
  'https://www.baa.org/races/boston-marathon',
  'https://www.londonmarathonevents.co.uk/london-marathon',
  'https://comrades.com/blogs/the-greatest-story-ever-run-comrades-marathon-launches-2027-centenary-edition',
  'https://www.bmw-berlin-marathon.com/en/',
  'https://www.chicagomarathon.com/',
  'https://sailgp.com/general/2027/calendar/',
  'https://www.rolexsydneyhobart.com/',
  'https://sailingweek.com/the-countdown-to-antigua-sailing-week-2027-begins/',
  'https://www.sailingscuttlebutt.com/2026/01/21/dates-confirmed-for-38th-americas-cup/',
  'https://www.rolexfastnetrace.com/',
  'https://www.cowesweek.co.uk/',
  'https://japanracing.jp/en/japancup/jc/2026.html',
  'https://www.thejockeyclub.co.uk/cheltenham/',
  'https://www.dubairacingclub.com/',
  'https://www.kentuckyderby.com/',
  'https://www.ascot.com/royal-ascot',
  'https://www.breederscup.com/2027',
  'https://www.world.rugby/news/1045878/hsbc-svns-series-and-world-championship-2027-schedule-confirmed-as-road-to-los-angeles-2028-gathers-pace',
  'https://www.wru.wales/2026/03/wales-mens-2027-six-nations-fixtures-confirmed/',
  'https://epcrugby.com/challenge-cup/content/epcr-confirms-lyon-2027-finals-and-202627-season-dates-with-investec-champions-cup-and-epcr-challenge-cup',
  'https://www.rugbyworldcup.com/2027',
  'https://www.mcg.org.au/news/2026/march/international-cricket-schedule-confirmed-for-202627',
  'https://www.cricket.com.au/news/4476875/australia-v-india-test-series-border-gavaskar-trophy-2027-schedule-venues-revealed',
  'https://www.icc-cricket.com/news/england-unveil-schedule-for-blockbuster-2027-home-summer',
  'https://www.icc-cricket.com/news/icc-men-s-cricket-world-cup-2027-schedule-revealed-and-ballot-system-opens',
  'https://noel.strasbourg.eu/',
  'https://www.carnevale.venezia.it/',
  'https://www.snowfes.com/',
  'https://liesa.org.br/noticias/260416.html',
  'https://www.edfringe.com/',
  'https://www.oktoberfest.de/en',
  'https://www.sothebys.com/en/about/locations/beaune?locale=en',
  'https://sobewff.org/',
  'https://www.melbournefoodandwine.com.au/industry/special-event-submissions',
  'https://www.vinitaly.com/en/',
  'https://london.tastefestivals.com/',
];

// ── T1 · THE CATEGORIES ──────────────────────────────────────────────────────

test('T1 the ten new categories follow the nine, in K\'s order, with their labels; surfing stays first', () => {
  // SEASONS-01 (2026-11-08): the seven season categories follow the ten — twenty-six in all; the ten are positions 9 to 18.
  assert.equal(EXPERIENCE_CATEGORIES.length, 26);
  assert.deepEqual(EXPERIENCE_CATEGORIES.slice(9, 19).map((c) => [c.id, c.label]), NEW_CATEGORIES.map(([id, label]) => [id, label]));
  assert.equal(EXPERIENCE_CATEGORIES[0].id, 'surfing', 'the default does not change');
});

// ── T2 · THE ROWS ────────────────────────────────────────────────────────────

test('T2 every new category has at least one row and at most six', () => {
  for (const [id] of NEW_CATEGORIES) {
    const n = NEW_ROWS.filter((r) => r.category === id).length;
    assert.ok(n >= 1, `${id}: no row`);
    assert.ok(n <= 6, `${id}: ${n} rows — three to six marquee events, never padded`);
  }
});

test('T2 every new row passes the leaf\'s law on its own and carries the run date as checkedOn', () => {
  assert.deepEqual(experiencesLaw({ throwOnFail: false, rows: NEW_ROWS }), []);
  for (const r of NEW_ROWS) assert.equal(r.checkedOn, RUN_DATE, `${r.id}: checkedOn`);
});

test('T2 every new row links an https page that was opened, and every opened page is linked', () => {
  for (const r of NEW_ROWS) {
    assert.ok(r.sourceUrl.startsWith('https://'), `${r.id}: ${r.sourceUrl}`);
    assert.ok(OPENED.includes(r.sourceUrl), `${r.id}: ${r.sourceUrl} is not in the opened list`);
  }
  assert.equal(new Set(OPENED).size, OPENED.length, 'no page listed twice');
  for (const url of OPENED) assert.ok(NEW_ROWS.some((r) => r.sourceUrl === url), `${url}: opened but linked by no row`);
});

test('T2 every dated new row falls in the twelve months from the run date: it ends on or after it and starts by 2027-11-08', () => {
  for (const r of NEW_ROWS) {
    if (r.start === null || r.end === null) {
      assert.equal(r.status, 'not_announced', `${r.id}: undated means not announced`);
      continue;
    }
    assert.ok(r.end >= RUN_DATE, `${r.id}: ended ${r.end}, before the run date`);
    assert.ok(r.start <= TWELVE_MONTHS_ON, `${r.id}: starts ${r.start}, after the twelve months`);
  }
});

test('T2 no new row shares an edition (category, name, start) or an id with another row', () => {
  const editions = NEW_ROWS.map((r) => `${r.category} · ${r.name} · ${r.start ?? 'null'}`);
  assert.equal(new Set(editions).size, editions.length);
  const ids = EXPERIENCES.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('T2 a secondary row names in its notes why the organizer\'s own page did not give the dates', () => {
  for (const r of NEW_ROWS.filter((x) => x.sourceKind === 'secondary')) {
    assert.ok(r.notes !== null && r.notes.trim() !== '', `${r.id}: a secondary row with no reason`);
  }
});
