import Link from 'next/link';
import LandingHeader from '@/components/landing/LandingHeader';
import LandingFooter from '@/components/landing/LandingFooter';
import OfferCard from '@/components/OfferCard';
import { FREE_TOOLS, OFFERS, heroCountsLine, offerAvailabilityFromEnv, offerCard } from '@/lib/offer';

/**
 * /pricing (SELL-02) — THE OFFER, rendered; no redirect. A public server page
 * (middleware PUBLIC_PATHS keeps the entry): every card comes from
 * src/lib/offer.ts and the tool registry — the tools with their registry claim
 * lines, the price only when it is live (the const AND the Stripe price id,
 * read here server-side as presence only), and a door that links
 * /?module=<slug>#modules: the deck's offer act, where the sign-up modal opens
 * with the key pending and checkout runs after sign-up (GuestLanding), or
 * straight to checkout for a signed-in viewer (HomeClient). No live price →
 * the declared line and no door. The free set is the registry's LIVE tools with
 * no tab gate. Zero authed calls, zero paid calls, zero database reads.
 *
 * force-dynamic: the price-id presence is read per request, never baked into a
 * static shell.
 */
export const dynamic = 'force-dynamic';

export default function PricingPage() {
  const availability = offerAvailabilityFromEnv(process.env);
  return (
    <div className="min-h-screen bg-bg-terminal text-text-primary">
      <LandingHeader />
      <main className="max-w-7xl mx-auto px-4 lg:px-8 py-10" data-pricing>
        <p className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint">
          THE OFFER <span className="text-brand-gold">·</span> WHAT IS SOLD, WHAT IS FREE
        </p>
        <h1 className="mt-3 text-2xl sm:text-3xl font-medium tracking-tight text-brand-purple">What you can buy, and what is free.</h1>
        <p className="mt-2 text-[12px] lg:text-[14px] text-text-secondary">{heroCountsLine()}</p>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {OFFERS.map((o) => (
            <OfferCard key={o.key} card={offerCard(o, availability)} door={{ kind: 'link', href: `/?module=${o.slug}#modules` }} />
          ))}
        </div>
        <section className="mt-8" aria-label="Free with an account" data-free-set>
          <p className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-text-faint">FREE WITH AN ACCOUNT</p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {FREE_TOOLS.map((t) => (
              <li key={t.name} className="rounded-lg border border-border bg-white p-3 text-sm" data-tool={t.name}>
                <span className="font-semibold">{t.name}</span>
                <span className="ml-2 text-xs text-text-muted">{t.family.toLowerCase()} · no module to buy</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-text-muted">Travel&apos;s search and booking are public — no account needed. Everything else above needs a free account to save.</p>
        </section>
        <p className="mt-8 text-xs text-text-muted">
          <Link href="/how-pricing-works" className="text-brand-purple hover:text-brand-purple-hover">What it costs to run each module →</Link>
        </p>
      </main>
      <LandingFooter />
    </div>
  );
}
