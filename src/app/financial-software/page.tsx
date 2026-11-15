import type { Metadata } from 'next';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import HowToSection from '@/components/landing/HowToSection';
import { FINANCIAL_SOFTWARE_TITLE } from '@/lib/homePages';
import { PLANS_SUBHEAD } from '@/lib/offer/plans';

/**
 * /financial-software (HOME-PAGES-01 — Alex's brief, 2026-11-14 19:11 Manila; his approval of the boards on the design canvas,
 * 20:01 Manila) — THE FINANCIAL SOFTWARE SECTION ON A PAGE OF ITS OWN: the filled top bar, the section whole (its title and
 * line, the map, the three plan cards, the all-three band, the link to /pricing), the footer. The home page keeps its own mount of the same component — "unchanged" until HOME-TRIM-02 (Alex's brief, 2026-11-14 19:11 Manila; built 2026-11-15), and its short view since: ruling a, "Landing.tsx mounts it with view="short", /financial-software with view="whole"." This page keeps the whole view, as main drew it · ruling k: "NOTHING ELSE CHANGES: not the hero, the other sections, About Us, Our Story, the footer, /pricing or /financial-software."
 * Its doors: the footer's SERVICES column, "Financial Software" (src/lib/footerWords.ts), and — since HOME-TRIM-02 — the home page's short view, "See all 25 tools →".
 *
 * THE RULINGS BUILT HERE (Alex's brief, 2026-11-14):
 *   a. "NOTHING IS REDRAWN. Each page mounts the section's own component: no copy, no second stylesheet. One value is new. On
 *      /financial-software the section's inner top padding is clamp(44px, 5.6vw, 80px), the value .ts-ps__inner and
 *      .ts-tm__inner carry, where the home page has 12px under the What We Do box. The page draws no "What We Do"." — the
 *      section is HowToSection, mounted; <main> wears ts-fs-page, the hook the one new rule is keyed to (src/app/globals.css,
 *      inside the section's port: .ts-fs-page .ts-fs__inner). Nothing else on this page wears a class of the port.
 *   b. "THE SHELL is /how-it-works's: the min-h-screen wrapper, <LandingHeader /> filled, <main>, <LandingFooter />." — below,
 *      as src/app/how-it-works/page.tsx has it.
 *   c. "WORDS. Nothing is typed in a page." — the title from src/lib/homePages.ts (the pillar's heading, then the ending), the
 *      description the section's own line, PLANS_SUBHEAD (src/lib/offer/plans.ts), imported and never retyped.
 *   d. "THE JOIN BUTTON on /financial-software is /pricing's door: a link to the front door (PlansSection.tsx: "The door is the
 *      caller's: /pricing hands a link, the home page a button that opens sign-up."). No second sign-up modal and no new auth
 *      code." — the door handed in is src/app/pricing/page.tsx's own, { kind: 'link', href: '/' }: each plan's button is a
 *      link to the front door here. A server page could not hand the section a function.
 *
 * PUBLIC (middleware PUBLIC_PATHS '/financial-software'; ruling f): a static page — no route handler, no fetch, no paid call,
 * no database read, no env read, no session read. Its imports are the bar, the section, the footer and the pure leaves they
 * read. It exports what a page may: its metadata and itself.
 */
export const metadata: Metadata = {
  title: FINANCIAL_SOFTWARE_TITLE,
  description: PLANS_SUBHEAD,
};

export default function FinancialSoftwarePage() {
  return (
    <div className="min-h-screen bg-bg-terminal text-text-primary">
      <LandingHeader />
      <main className="ts-fs-page">
        <HowToSection view="whole" onRequireAuth={{ kind: 'link', href: '/' }} />
      </main>
      <LandingFooter />
    </div>
  );
}
