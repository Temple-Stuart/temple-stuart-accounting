import Link from 'next/link';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import PlansSection from '@/components/offer/PlansSection';

/**
 * /pricing — THE OFFER, rendered; no redirect. A public server page (middleware
 * PUBLIC_PATHS keeps the entry).
 *
 * OFFER-01 (2026-09-23): this page showed the SAME builder's view the landing
 * did — heroCountsLine's "Twenty-five tools, counted: …" over two <OfferCard/>s
 * whose tools wore the loop's beat vocabulary, and a "FREE WITH AN ACCOUNT" grid
 * of registry rows. It now renders the ONE plans section the landing renders, so
 * the two public selling surfaces show one offer in one anatomy: three cumulative
 * plans, an audience and a relationship line each, a real-but-empty price slot,
 * and one comparison table of collapsed capability groups. Every word and every
 * cell derives from src/lib/offer/plans.ts and the tool registry.
 *
 * The door here is a LINK (a server component cannot hand a click handler to a
 * client one): "Join early access" goes to the front door, whose hero opens
 * account creation. Zero authed calls, zero paid calls, zero database reads, and
 * — now that no Stripe price id is read here — zero env reads.
 */
export default function PricingPage() {
  return (
    <div className="min-h-screen bg-bg-terminal text-text-primary">
      <LandingHeader />
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-10" data-pricing>
        <PlansSection door={{ kind: 'link', href: '/' }} headingId="plans" />
        <p className="mt-8 text-xs text-text-muted">
          <Link href="/how-pricing-works" className="text-brand-purple hover:text-brand-purple-hover">What it costs to run each module →</Link>
        </p>
      </main>
      <LandingFooter />
    </div>
  );
}
