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
//     prominent than our own marks. PR-WALL-PURE: the shared card SPLIT,
//     so the misattribution deferral died — the slot is ARMED. The file
//     must be the official badge from their brand page (white version is
//     their own dark-bg recommendation); Alex supplies it — never a
//     harvested mark.
//   • Vercel — vercel.com/geist/brands: unmodified marks only, and
//     ATTRIBUTION IS REQUIRED when their marks are used — the exact
//     required wording renders under the wall grid (Landing.tsx).
//     PR-WALL-LOGOS-2: the five-name infra card SPLIT into per-vendor
//     cards, so the shared-card deferral died — the image slot is ARMED
//     and the interim unicode ▲ (U+25B2, the ELEV-2d re-issue mechanism)
//     retired with the shared card.
// VERDICTS (2026-08-09, live policies read — WALL-LOGOS-2/3 + WALL-PURE):
//   CLEARED — Vercel + Next.js (geist/brands customer + symbol-wall
//   clauses), Prisma (presskit badge invitation), Resend (resend.com/brand
//   kit; white-on-dark is their own dark-theme treatment), Leaflet
//   (BSD-2-licensed free-software logo), OpenAI (openai.com/brand customer
//   badge program — official asset only, Alex supplies; usage verified
//   live, LOGOS-3 audit), React + TypeScript + Tailwind CSS (open-source
//   referential norm, simple-icons marks).
//   NEVER-LIGHT — Stripe (terms — standing; slot uniformity-only),
//   Azure PostgreSQL (the PostgreSQL mark stays killed: no-modify /
//   no-co-present / standard-forms), SEC EDGAR (agency seal).
//   PARKED — Anthropic (license unverified; one-command re-harvest when
//   cleared). PENDING — Plaid (permission pending — standing; slot inert).
//   ARMED-INERT awaiting permission/asset: Duffel, Nuitée, Viator (portal
//   file only), tastytrade, Finnhub, Inngest, xAI, FRED, Google Places.
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

// PR-WALL-PURE: EVERY card carries a logo slot now — the grid renders
// lit-only (file exists) and everyone else rides the auto-derived
// "Also built on" line (Landing.tsx), so a vendor graduates to the grid on
// a bare file drop, zero code. Armed-inert costs nothing; the marks
// RULINGS (verdict block above) still govern which files may EVER land —
// slots marked NEVER-LIGHT exist for uniformity only, do not ship files.
export const BUILT_ON: BuiltOnEntry[] = [
  { name: 'Plaid', tag: 'bank data', logo: { slug: 'plaid', alt: 'Plaid logo' } },
  // NEVER-LIGHT per ruling (Stripe terms — standing): slot for uniformity
  // only, do not ship a file.
  { name: 'Stripe', tag: 'payments', logo: { slug: 'stripe', alt: 'Stripe logo', href: 'https://stripe.com' } },
  // PR-WALL-PURE: the combined flights & stays card SPLIT per vendor
  // (armed-inert — files come via the pending permission emails).
  { name: 'Duffel', tag: 'flights', logo: { slug: 'duffel', alt: 'Duffel logo' } },
  { name: 'Nuitée liteAPI', tag: 'stays', logo: { slug: 'nuitee', alt: 'Nuitée liteAPI logo' } },
  { name: 'Viator', tag: 'tours & transfers', logo: { slug: 'viator', alt: 'Viator logo' } },
  { name: 'tastytrade', tag: 'brokerage data', logo: { slug: 'tastytrade', alt: 'tastytrade logo' } },
  { name: 'Finnhub', tag: 'market data', logo: { slug: 'finnhub', alt: 'Finnhub logo' } },
  // PR-WALL-PURE: the 'Anthropic + OpenAI' card SPLIT per vendor — the
  // LOGOS-3 truth audit stands for both (Anthropic: src/lib/ai/client.ts
  // family; OpenAI: src/lib/openai.ts singleton + four api/ai routes).
  // Anthropic armed-inert (permission pending); OpenAI CLEARED 2026-08-09
  // (openai.com/brand customer badge program) — its file must come from
  // their OFFICIAL page (Alex supplies), never a harvested mark.
  { name: 'Anthropic', tag: 'AI', logo: { slug: 'anthropic', alt: 'Anthropic logo' } },
  { name: 'OpenAI', tag: 'AI', logo: { slug: 'openai', alt: 'OpenAI logo' } },
  { name: 'Resend', tag: 'email', logo: { slug: 'resend', alt: 'Resend logo' } },
  // PR-WALL-LOGOS-2: the shared 'infrastructure' five-name card SPLIT into
  // per-vendor cards (tags derive its one role into per-vendor facts). The
  // required Vercel/Next.js attribution line under the wall grid
  // (Landing.tsx) is unchanged and still binds — their marks render above.
  { name: 'Next.js', tag: 'web framework', logo: { slug: 'nextdotjs', alt: 'Next.js logo' } },
  { name: 'Prisma', tag: 'database ORM', logo: { slug: 'prisma', alt: 'Prisma logo' } },
  { name: 'Vercel', tag: 'hosting & deploys', logo: { slug: 'vercel', alt: 'Vercel logo' } },
  // NEVER-LIGHT per ruling (PostgreSQL trademark policy — the mark stays
  // killed): slot for uniformity only, do not ship a file.
  { name: 'Azure PostgreSQL', tag: 'database', logo: { slug: 'azurepostgresql', alt: 'Azure PostgreSQL logo' } },
  { name: 'Inngest', tag: 'background jobs', logo: { slug: 'inngest', alt: 'Inngest logo' } },
  // PR-WALL-PURE: the core front-of-stack trio joins, CLEARED 2026-08-09
  // (open-source referential norm, simple-icons marks).
  { name: 'React', tag: 'UI', logo: { slug: 'react', alt: 'React logo' } },
  { name: 'TypeScript', tag: 'language', logo: { slug: 'typescript', alt: 'TypeScript logo' } },
  { name: 'Tailwind CSS', tag: 'styling', logo: { slug: 'tailwindcss', alt: 'Tailwind CSS logo' } },
  // PR-WALL-LOGOS-2: the five wired stack vendors the wall was missing
  // (ruled additions). Claimability cites: grok.ts (api.x.ai client),
  // convergence/data-fetchers.ts (FRED macro + SEC EDGAR XBRL fetchers),
  // placesCache.ts, Leaflet (package.json dep — HotelMap/DestinationMap
  // render it).
  { name: 'xAI Grok', tag: 'AI', logo: { slug: 'xai', alt: 'xAI Grok logo' } },
  { name: 'FRED', tag: 'economic data', logo: { slug: 'fred', alt: 'FRED logo' } },
  // NEVER-LIGHT per ruling (SEC — a government agency seal never lands on a
  // vendor wall): slot for uniformity only, do not ship a file.
  { name: 'SEC EDGAR', tag: 'filings data', logo: { slug: 'secedgar', alt: 'SEC EDGAR logo' } },
  { name: 'Google Places', tag: 'location data', logo: { slug: 'googleplaces', alt: 'Google Places logo' } },
  { name: 'Leaflet', tag: 'maps', logo: { slug: 'leaflet', alt: 'Leaflet logo' } },
];
