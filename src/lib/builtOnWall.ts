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
//     PR-WALL-LOGOS-2: the five-name infra card SPLIT into per-vendor
//     cards, so the shared-card deferral died — the image slot is ARMED
//     and the interim unicode ▲ (U+25B2, the ELEV-2d re-issue mechanism)
//     retired with the shared card.
// VERDICTS (2026-08-09, live policies read — WALL-LOGOS-2/3 rulings):
//   CLEARED — Vercel + Next.js (geist/brands customer + symbol-wall
//   clauses), Prisma (presskit badge invitation), Resend (resend.com/brand
//   kit; white-on-dark is their own dark-theme treatment), Leaflet
//   (BSD-2-licensed free-software logo).
//   KILLED — PostgreSQL (trademark policy: no-modify / no-co-present /
//   standard-forms — a white-fill mark on a vendor wall fails it);
//   Stripe stays excluded (terms — standing ruling; slot inert, no file).
//   PARKED — Anthropic (license unverified; one-command re-harvest when
//   cleared). PENDING — Plaid (permission pending — standing; slot inert).
//   Text-only, no marks ruling: Duffel, Nuitée, tastytrade, Finnhub,
//   Azure, Inngest, xAI, FRED, SEC EDGAR, Google. OpenAI: usage verified
//   live (WALL-LOGOS-3 audit) — badge deferred, shared-card rule above.
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
  // WALL-LOGOS-3 OpenAI truth audit: the claim is TRUE — live client
  // (src/lib/openai.ts singleton + openai@6 dep) and four calling routes
  // (api/ai/spending-insights, meal-plan, cart-plan, meal-planner). Card
  // stays; the badge slot stays deferred per the shared-card rule above.
  { name: 'Anthropic + OpenAI', tag: 'AI' },
  { name: 'Resend', tag: 'email', logo: { slug: 'resend', alt: 'Resend logo' } },
  // PR-WALL-LOGOS-2: the shared 'infrastructure' five-name card SPLIT into
  // per-vendor cards (tags derive its one role into per-vendor facts). The
  // required Vercel/Next.js attribution line under the wall grid
  // (Landing.tsx) is unchanged and still binds — their marks render above.
  { name: 'Next.js', tag: 'web framework', logo: { slug: 'nextdotjs', alt: 'Next.js logo' } },
  { name: 'Prisma', tag: 'database ORM', logo: { slug: 'prisma', alt: 'Prisma logo' } },
  { name: 'Vercel', tag: 'hosting & deploys', logo: { slug: 'vercel', alt: 'Vercel logo' } },
  { name: 'Azure PostgreSQL', tag: 'database' },
  { name: 'Inngest', tag: 'background jobs' },
  // PR-WALL-LOGOS-2: the five wired stack vendors the wall was missing
  // (ruled additions, text-only — no marks cleared). Claimability cites:
  // grok.ts (api.x.ai client), convergence/data-fetchers.ts (FRED macro +
  // SEC EDGAR XBRL fetchers), placesCache.ts, Leaflet (package.json dep —
  // HotelMap/DestinationMap render it).
  { name: 'xAI Grok', tag: 'AI' },
  { name: 'FRED', tag: 'economic data' },
  { name: 'SEC EDGAR', tag: 'filings data' },
  { name: 'Google Places', tag: 'location data' },
  { name: 'Leaflet', tag: 'maps', logo: { slug: 'leaflet', alt: 'Leaflet logo' } },
];
