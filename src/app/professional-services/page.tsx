import type { Metadata } from 'next';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import ServicesSection from '@/components/landing/ServicesSection';
import { BUILD_PILLAR } from '@/lib/homeActWords';
import { PROFESSIONAL_SERVICES_TITLE } from '@/lib/homePages';

/**
 * /professional-services (HOME-PAGES-01 — Alex's brief, 2026-11-14 19:11 Manila; his approval of the boards on the design
 * canvas, 20:01 Manila) — THE PROFESSIONAL SERVICES SECTION ON A PAGE OF ITS OWN: the filled top bar, the section whole, the
 * footer. The home page keeps its own mount of the same component, unchanged. Its door: the footer's SERVICES column,
 * "Professional Services" (src/lib/footerWords.ts).
 *
 * THE RULINGS BUILT HERE (Alex's brief, 2026-11-14):
 *   a. "NOTHING IS REDRAWN. Each page mounts the section's own component: no copy, no second stylesheet." — the section is
 *      ServicesSection, mounted, and nothing here wears a class of its port: it stands directly under <main>, as it stands
 *      directly under the home page's root.
 *   b. "THE SHELL is /how-it-works's: the min-h-screen wrapper, <LandingHeader /> filled, <main>, <LandingFooter />." — below,
 *      as src/app/how-it-works/page.tsx has it.
 *   c. "WORDS. Nothing is typed in a page." — the title from src/lib/homePages.ts (the pillar's heading, then the ending), the
 *      description the pillar's own line, BUILD_PILLAR.paragraphs[0] (src/lib/homeActWords.ts), imported and never retyped.
 *
 * PUBLIC (middleware PUBLIC_PATHS '/professional-services'; ruling f): a static page — no route handler, no fetch, no paid
 * call, no database read, no env read, no session read. Its imports are the bar, the section, the footer and the pure leaves
 * they read. It exports what a page may: its metadata and itself.
 */
export const metadata: Metadata = {
  title: PROFESSIONAL_SERVICES_TITLE,
  description: BUILD_PILLAR.paragraphs[0],
};

export default function ProfessionalServicesPage() {
  return (
    <div className="min-h-screen bg-bg-terminal text-text-primary">
      <LandingHeader />
      <main>
        <ServicesSection />
      </main>
      <LandingFooter />
    </div>
  );
}
