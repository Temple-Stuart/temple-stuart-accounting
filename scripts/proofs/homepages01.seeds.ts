/**
 * The trip log law's seeded regressions for its /about clause (HOME-PAGES-01 — Alex's brief, 2026-11-14, ruling e: "THE DAY.
 * /about computes it once per request, on the server, with the front door's own expression, and hands it to WasHereSection. No
 * component reads the clock.").
 *
 * The clause rides the trip log law's mount line (scripts/assert-tool-registry.ts: the line that refuses a wrong count of
 * Landing.tsx's mount): /about mounts the log too (src/app/about/page.tsx), so the law holds its day as it holds the front
 * door's — the page is force-dynamic, it computes `today` once, inside its page function (read from `export default function` to
 * the first closing brace that stands alone at the start of a line: its own, as the page is typed), with the front door's own
 * expression, and it mounts <WasHereSection today={today} /> exactly once. A build runs the laws and no test, so without the
 * clause a later edit could freeze the day at a deploy and nothing would say so. The ten seeds are ten ways the page stops
 * being one the clause can hold to the ruling, while it still draws — each a change to the text of the one file, each stopping
 * the law suite BY NAME:
 *
 *   · a — force-dynamic leaves: Next draws the page once, at build, and every stop's I'M HERE keeps the day of the deploy;
 *   · b — the day is typed another way than the front door types it;
 *   · c — the day moves to the module's top, above the page function: computed once per server instance, not once per request;
 *   · d — the page reads the clock a second time;
 *   · e — the log is handed a typed day, not the one the page computed;
 *   · f — the day moves to the module's top, below the page function: once per server instance again, from the other side;
 *   · g — the clock is read a second time another way, by Date.now();
 *   · h — the log is mounted a second time, handed a typed day: the first mount still reads the page's day, the second does not;
 *   · i — the page becomes an arrow component: the day is where it was, and the law has no page function left to read it in;
 *   · j — the page function is closed by a brace and a semicolon, a helper under it: the law's reading would run past the
 *     function's end to the helper's brace, and the law says so instead of reading on.
 *
 * In b, d and g the log still receives the right day: what breaks is the expression being the front door's own (b) and the clock
 * being read once (d, g). In i and j nothing the visitor sees changes at all: the law says it can no longer read the page, and
 * that is its catch.
 *
 * Each expect names the clause's own words, so a seed some other law caught would not count as caught.
 */
import type { Seed } from '../prove';

const ABOUT = 'src/app/about/page.tsx';
const THE_DAY = '  const today = new Date().toISOString().slice(0, 10);';
/** The page function's body under the day's line, to its closing brace and the file's end — seed f moves the day past it, and seed i closes it as an arrow. */
const PAGE_BODY = [
  '  return (',
  '    <div className="min-h-screen bg-bg-terminal text-text-primary">',
  '      <LandingHeader />',
  '      <main>',
  '        <StopZeroSection />',
  '        <WasHereSection today={today} />',
  '      </main>',
  '      <LandingFooter />',
  '    </div>',
  '  );',
  '}',
  '',
].join('\n');
const NOT_THE_FRONT_DOORS = 'was here: src/app/about/page.tsx does not compute today once, inside its page function, as new Date().toISOString().slice(0, 10)';

export const SEEDS: Seed[] = [
  {
    name: 'homepages01-a /about is no longer force-dynamic (the day would freeze at the build)',
    file: ABOUT,
    find: "export const dynamic = 'force-dynamic';\n",
    replace: '',
    expect: 'was here: src/app/about/page.tsx does not export dynamic = force-dynamic',
  },
  {
    name: 'homepages01-b the day is typed another way than the front door types it',
    file: ABOUT,
    find: THE_DAY,
    replace: "  const today = new Date().toISOString().split('T')[0];",
    expect: NOT_THE_FRONT_DOORS,
  },
  {
    name: 'homepages01-c the day moves to the top of the module (once per server instance, not once per request)',
    file: ABOUT,
    find: `export default function AboutPage() {\n${THE_DAY}\n`,
    replace: `${THE_DAY.trim()}\n\nexport default function AboutPage() {\n`,
    expect: NOT_THE_FRONT_DOORS,
  },
  {
    name: 'homepages01-d the page reads the clock a second time',
    file: ABOUT,
    find: `${THE_DAY}\n  return (`,
    replace: `${THE_DAY}\n  const year = new Date().getFullYear();\n  return (`,
    expect: NOT_THE_FRONT_DOORS,
  },
  {
    name: 'homepages01-e the log is handed a typed day, not the one the page computed',
    file: ABOUT,
    find: '<WasHereSection today={today} />',
    replace: '<WasHereSection today="2026-11-14" />',
    expect: 'was here: src/app/about/page.tsx mounts <WasHereSection today={today} /> 0 time(s)',
  },
  {
    name: 'homepages01-f the day moves below the page function (once per server instance, from the other side)',
    file: ABOUT,
    find: `export default function AboutPage() {\n${THE_DAY}\n${PAGE_BODY}`,
    replace: `export default function AboutPage() {\n${PAGE_BODY}\n${THE_DAY.trim()}\n`,
    expect: NOT_THE_FRONT_DOORS,
  },
  {
    name: 'homepages01-g the clock is read a second time another way, by Date.now()',
    file: ABOUT,
    find: `${THE_DAY}\n  return (`,
    replace: `${THE_DAY}\n  const now = Date.now();\n  return (`,
    expect: NOT_THE_FRONT_DOORS,
  },
  {
    name: 'homepages01-h the log is mounted a second time, handed a typed day',
    file: ABOUT,
    find: '        <WasHereSection today={today} />\n',
    replace: '        <WasHereSection today={today} />\n        <WasHereSection today="2026-11-14" />\n',
    expect: 'was here: src/app/about/page.tsx mounts <WasHereSection today={today} /> 1 time(s) and the log 2 time(s) in all',
  },
  {
    name: 'homepages01-i the page becomes an arrow component (the law has no page function to read the day in)',
    file: ABOUT,
    find: `export default function AboutPage() {\n${THE_DAY}\n${PAGE_BODY}`,
    replace: `const AboutPage = () => {\n${THE_DAY}\n${PAGE_BODY.replace(/\n\}\n$/, '\n};\n')}\nexport default AboutPage;\n`,
    expect: 'was here: src/app/about/page.tsx has no page function the law can read',
  },
  {
    name: 'homepages01-j the page function is closed by a brace and a semicolon, a helper under it (the law would read past its end)',
    file: ABOUT,
    find: '  );\n}\n',
    replace: '  );\n};\n\nfunction helper(): number {\n  return 1;\n}\n',
    expect: 'was here: src/app/about/page.tsx has no page function the law can read',
  },
];
