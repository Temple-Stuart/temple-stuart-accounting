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
//     so the misattribution deferral died — the slot is ARMED. WALL-
//     HARVEST-ALL (2026-08-09): the mirror blossom shipped under the
//     SHIP-tier clearance; the official badge from their brand page
//     (white version is their own dark-bg recommendation) remains the
//     gold path — Alex's file overwrites at the same slug any time.
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
//   (BSD-2-licensed free-software logo), React + TypeScript + Tailwind CSS
//   (open-source referential norm, simple-icons marks).
//   SHIPPED via WALL-HARVEST-ALL (2026-08-09 SHIP-tier clearance —
//   referential customer marks, no written prohibition found; supersedes
//   the older Anthropic-PARKED and OpenAI-official-asset-only lines):
//   Anthropic, OpenAI (mirror blossom, fidelity-checked — Alex's official
//   badge remains the gold overwrite at the same path), xAI.
//   NEVER-LIGHT — Stripe (terms — standing; slot uniformity-only),
//   Azure PostgreSQL (the PostgreSQL mark stays killed: no-modify /
//   no-co-present / standard-forms), SEC EDGAR (agency seal).
//   PENDING — Plaid (permission pending — standing; slot inert).
//   ARMED-INERT awaiting permission/asset: Duffel, Nuitée, Viator (portal
//   file only), tastytrade, Finnhub, Inngest, FRED, Google Places.
//
// DROP CONVENTION: land the official file at public/logos/<slug>.svg
// (white/monochrome variant preferred on the dark cards) — the card lights
// on the next request, sized h-7 (~28px) object-contain above the name.
// No file → today's exact text card; never a placeholder or broken image.

export interface BuiltOnEntry {
  name: string;
  tag: string;
  /** PR-WALL-TEACH → BUILTON-MARQUEE: the entry's grouping — the grouped
   *  runs below fix the marquee's flattened display order. */
  category: 'banking' | 'travel' | 'markets' | 'ai' | 'infra';
  /** Present ONLY on brand-terms-cleared vendors (rules above). `href`
   *  makes the whole lit card an outbound link (Stripe's marks mandate). */
  logo?: { slug: string; alt: string; href?: string };
}

// BUILTON-MARQUEE: WALL_SECTIONS (the five category headers + explainers)
// DELETED — its only consumer was the Landing card grid, which became the
// one marquee strip. The `category` field below stays: it documents each
// entry's grouping and fixes the flattened display order (grouped runs,
// WALL-TEACH ordering — unchanged).

// PR-WALL-PURE: EVERY card carries a logo slot now — the grid renders
// lit-only (file exists) and everyone else rides the auto-derived
// "Also built on" line (Landing.tsx), so a vendor graduates to the grid on
// a bare file drop, zero code. Armed-inert costs nothing; the marks
// RULINGS (verdict block above) still govern which files may EVER land —
// slots marked NEVER-LIGHT exist for uniformity only, do not ship files.
// PR-WALL-TEACH: entries grouped by category in WALL_SECTIONS order — the
// render filters per section, so within-category order here IS display
// order. Names/tags/slots carried over unchanged from WALL-PURE (splits,
// claimability cites, and NEVER-LIGHT rules all stand).
export const BUILT_ON: BuiltOnEntry[] = [
  // ── banking ───────────────────────────────────────────────────────────
  { name: 'Plaid', tag: 'bank data', category: 'banking', logo: { slug: 'plaid', alt: 'Plaid logo' } },
  // NEVER-LIGHT per ruling (Stripe terms — standing): slot for uniformity
  // only, do not ship a file.
  { name: 'Stripe', tag: 'payments', category: 'banking', logo: { slug: 'stripe', alt: 'Stripe logo', href: 'https://stripe.com' } },
  // ── travel (armed-inert marks come via the pending permission emails) ──
  { name: 'Duffel', tag: 'flights', category: 'travel', logo: { slug: 'duffel', alt: 'Duffel logo' } },
  { name: 'Nuitée liteAPI', tag: 'stays', category: 'travel', logo: { slug: 'nuitee', alt: 'Nuitée liteAPI logo' } },
  { name: 'Viator', tag: 'tours & transfers', category: 'travel', logo: { slug: 'viator', alt: 'Viator logo' } },
  { name: 'Google Places', tag: 'location data', category: 'travel', logo: { slug: 'googleplaces', alt: 'Google Places logo' } },
  { name: 'Leaflet', tag: 'maps', category: 'travel', logo: { slug: 'leaflet', alt: 'Leaflet logo' } },
  // ── markets (claimability: grok.ts api.x.ai client; convergence/
  //    data-fetchers.ts FRED macro + SEC EDGAR XBRL fetchers) ─────────────
  { name: 'tastytrade', tag: 'brokerage data', category: 'markets', logo: { slug: 'tastytrade', alt: 'tastytrade logo' } },
  { name: 'Finnhub', tag: 'market data', category: 'markets', logo: { slug: 'finnhub', alt: 'Finnhub logo' } },
  { name: 'FRED', tag: 'economic data', category: 'markets', logo: { slug: 'fred', alt: 'FRED logo' } },
  // NEVER-LIGHT per ruling (SEC — a government agency seal never lands on a
  // vendor wall): slot for uniformity only, do not ship a file.
  { name: 'SEC EDGAR', tag: 'filings data', category: 'markets', logo: { slug: 'secedgar', alt: 'SEC EDGAR logo' } },
  // ── ai (WALL-PURE split; LOGOS-3 truth audit stands: Anthropic =
  //    src/lib/ai/client.ts family, OpenAI = src/lib/openai.ts + 4 routes.
  //    WALL-HARVEST-ALL 2026-08-09 SHIP clearance superseded the old
  //    Anthropic PARKED / OpenAI official-asset-only lines: all three AI
  //    marks shipped from mirrors, fidelity-checked; Alex's official
  //    OpenAI badge remains the gold overwrite at the same path.) ─────────
  { name: 'Anthropic', tag: 'AI', category: 'ai', logo: { slug: 'anthropic', alt: 'Anthropic logo' } },
  { name: 'OpenAI', tag: 'AI', category: 'ai', logo: { slug: 'openai', alt: 'OpenAI logo' } },
  { name: 'xAI Grok', tag: 'AI', category: 'ai', logo: { slug: 'xai', alt: 'xAI Grok logo' } },
  // ── infra (LOGOS-2 five-way split + the WALL-PURE core trio; the
  //    required Vercel/Next.js attribution line under the wall grid is
  //    unchanged and still binds — their marks render above it) ───────────
  { name: 'Next.js', tag: 'web framework', category: 'infra', logo: { slug: 'nextdotjs', alt: 'Next.js logo' } },
  { name: 'React', tag: 'UI', category: 'infra', logo: { slug: 'react', alt: 'React logo' } },
  { name: 'TypeScript', tag: 'language', category: 'infra', logo: { slug: 'typescript', alt: 'TypeScript logo' } },
  { name: 'Tailwind CSS', tag: 'styling', category: 'infra', logo: { slug: 'tailwindcss', alt: 'Tailwind CSS logo' } },
  { name: 'Prisma', tag: 'database ORM', category: 'infra', logo: { slug: 'prisma', alt: 'Prisma logo' } },
  // NEVER-LIGHT per ruling (PostgreSQL trademark policy — the mark stays
  // killed): slot for uniformity only, do not ship a file.
  { name: 'Azure PostgreSQL', tag: 'database', category: 'infra', logo: { slug: 'azurepostgresql', alt: 'Azure PostgreSQL logo' } },
  { name: 'Vercel', tag: 'hosting & deploys', category: 'infra', logo: { slug: 'vercel', alt: 'Vercel logo' } },
  { name: 'Inngest', tag: 'background jobs', category: 'infra', logo: { slug: 'inngest', alt: 'Inngest logo' } },
  { name: 'Resend', tag: 'email', category: 'infra', logo: { slug: 'resend', alt: 'Resend logo' } },
];
