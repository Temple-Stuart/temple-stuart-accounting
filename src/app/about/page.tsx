import type { Metadata } from 'next';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import StopZeroSection from '@/components/landing/StopZeroSection';
import WasHereSection from '@/components/landing/WasHereSection';
import { ABOUT_TITLE } from '@/lib/homePages';
import { STOP_ZERO_STORY } from '@/lib/stopZeroWords';

/**
 * /about (HOME-PAGES-01 — Alex's brief, 2026-11-14 19:11 Manila; his approval of the boards on the design canvas, 20:01
 * Manila) — ABOUT US AND, UNDER IT, OUR STORY, ON A PAGE OF THEIR OWN: the filled top bar, the two sections whole, the footer.
 * The home page keeps its own mount of Our Story, unchanged; of About Us it kept one until HOME-TRIM-01 (2026-11-15: "The home page keeps its own mount of each, unchanged." until then) and draws one band in that seat now, AboutBand.tsx, whose button opens this page. Its door: the footer's OUR STORY column, "Stop 0 | Los Angeles"
 * (src/lib/footerWords.ts) — to the page's top, with no fragment (Alex's answer to the audit, 2026-11-14).
 *
 * THE RULINGS BUILT HERE (Alex's brief, 2026-11-14):
 *   a. "NOTHING IS REDRAWN. Each page mounts the section's own component: no copy, no second stylesheet." — the two sections
 *      are StopZeroSection and WasHereSection, mounted one under the other as the home page stacked them until HOME-TRIM-01 (2026-11-15: a band stands over Our Story there now, and the letter is mounted here alone), and nothing here wears
 *      a class of either port.
 *   b. "THE SHELL is /how-it-works's: the min-h-screen wrapper, <LandingHeader /> filled, <main>, <LandingFooter />." — below,
 *      as src/app/how-it-works/page.tsx has it.
 *   c. "WORDS. Nothing is typed in a page." — the title from src/lib/homePages.ts (the heading, then the ending), the
 *      description the first quote of STOP_ZERO_STORY as its leaf writes it (src/lib/stopZeroWords.ts), imported and never
 *      retyped.
 *   e. "THE DAY. /about computes it once per request, on the server, with the front door's own expression, and hands it to
 *      WasHereSection. No component reads the clock." — `dynamic` and `today`, below: the two lines src/app/page.tsx carries.
 *      Without the first, Next would draw this page once, at build, and every stop's I'M HERE / COMING UP would keep the day of
 *      the deploy; with it the page is rendered on every request, as the front door is. `today` stands inside the page
 *      function: at the module's top it would be computed once per server instance, not once per request. The build's trip
 *      log law (scripts/assert-tool-registry.ts) holds both lines and the one mount; a build runs the laws.
 *
 * PUBLIC (middleware PUBLIC_PATHS '/about'; ruling f): no route handler, no fetch, no paid call, no database read, no env
 * read, no session read — it calls neither cookies() nor headers(). The one thing it reads is the server's clock, once per
 * request. Its imports are the bar, the two sections, the footer and the pure leaves they read. It exports what a page may:
 * `dynamic`, its metadata and itself.
 */
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: ABOUT_TITLE,
  description: STOP_ZERO_STORY[0].quote,
};

export default function AboutPage() {
  const today = new Date().toISOString().slice(0, 10);
  return (
    <div className="min-h-screen bg-bg-terminal text-text-primary">
      <LandingHeader />
      <main>
        <StopZeroSection />
        <WasHereSection today={today} />
      </main>
      <LandingFooter />
    </div>
  );
}
