// PR-ELEV-2d: the "Built on" wall data, extracted to a shared LEAF module
// (zero imports, server-safe AND client-safe — the modulePillars.ts/
// tabDescriptors.ts precedent). Two consumers import the ONE source:
// app/page.tsx (server — it fs-checks public/logos/<slug>.svg per logo slot
// and passes the availability map down, so a DROPPED FILE ALONE lights its
// card at the next request; no code change) and Landing.tsx (client — the
// wall render). Names/tags are byte-identical to the ELEV-2b wall.
//
// WORDING LAW (locked, ELEV-2+3): "Built on" / "integrates with" ONLY —
// never "partners", "trusted by", or any endorsement framing. CLAIMABILITY
// RULE: wired clients only.
//
// LOGO RULES (PR-ELEV-2d — a `logo` slot exists ONLY for vendors whose live
// brand terms were read and cleared; everyone else stays text-only):
//   • Stripe — stripe.com/legal/marks: the mark may identify Stripe as the
//     payments provider, and the LOGO MUST LINK TO stripe.com → href set;
//     the whole card becomes the link when the logo is live.
//   • Plaid — plaid.com/legal/terms-of-use: mutual trademark license — use
//     the mark only to identify the relationship (which "bank data" states).
//     No link mandate → no href.
//   • Viator — approved-affiliate assets from the Viator Partner Resource
//     Center ONLY (we are an affiliate — VIATOR_PARTNER_ID, affiliates.ts).
//     The file dropped at public/logos/viator.svg must come from there,
//     never a mark scraped elsewhere.
//   • OpenAI — openai.com/brand: badge use ONLY, NO partnership
//     implication, NO alterations, and their badge may never render more
//     prominent than our own marks. Image slot DEFERRED: its wall card
//     names TWO vendors ("Anthropic + OpenAI") and a solo OpenAI badge
//     there would misattribute the card. Activates if/when the card splits
//     (a ruled wall change).
//   • Vercel — vercel.com/geist/brands: unmodified marks only, and
//     ATTRIBUTION IS REQUIRED when their marks are used — the exact
//     required wording renders under the wall grid (Landing.tsx).
//     PR-ELEV-2d (re-issue): geist/brands sanctions the UNICODE TRIANGLE
//     ▲ (U+25B2) as the mark in text / multi-brand rows — so Vercel is
//     LIVE NOW with zero image files: the ▲ precedes "Vercel" inline in
//     the infrastructure card's name below. The IMAGE slot stays deferred
//     for the shared-card reason (a five-name card).
// NOT cleared (text-only, untouched): Duffel, Nuitée, tastytrade, Finnhub,
// Resend, Anthropic, Prisma, Inngest, Azure.
//
// DROP CONVENTION: land the official file at public/logos/<slug>.svg
// (white/monochrome variant preferred on the dark cards) — the card lights
// on the next request, sized h-7 (~28px) object-contain above the name.
// No file → today's exact text card; never a placeholder or broken image.

export interface BuiltOnEntry {
  name: string;
  tag: string;
  /** Present ONLY on brand-terms-cleared vendors (rules above). `href`
   *  makes the whole lit card an outbound link (Stripe's marks mandate). */
  logo?: { slug: string; alt: string; href?: string };
}

export const BUILT_ON: BuiltOnEntry[] = [
  { name: 'Plaid', tag: 'bank data', logo: { slug: 'plaid', alt: 'Plaid logo' } },
  { name: 'Stripe', tag: 'payments', logo: { slug: 'stripe', alt: 'Stripe logo', href: 'https://stripe.com' } },
  { name: 'Duffel + LiteAPI (Nuitée)', tag: 'flights & stays' },
  { name: 'Viator', tag: 'tours & transfers', logo: { slug: 'viator', alt: 'Viator logo' } },
  { name: 'tastytrade', tag: 'brokerage data' },
  { name: 'Finnhub', tag: 'market data' },
  { name: 'Anthropic + OpenAI', tag: 'AI' },
  { name: 'Resend', tag: 'email' },
  // ▲ = Vercel's sanctioned unicode mark (U+25B2) for text/multi-brand
  // contexts (vercel.com/geist/brands) — the required attribution line
  // renders under the wall grid.
  { name: 'Next.js + Prisma + Azure PostgreSQL + ▲ Vercel + Inngest', tag: 'infrastructure' },
];
