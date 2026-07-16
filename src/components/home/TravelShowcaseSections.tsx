'use client';

/**
 * TRAVEL-SHOWCASE-BLOOMBERG — the INVERTED deck. Dark hero → 6 causal slides →
 * the inverted connective line — and then, unlike every prior deck, NO mounted
 * sample section: the live section IS the existing real guest search stack that
 * ModuleLauncher already renders below this component. This deck WRAPS the live
 * surfaces and replaces NOTHING (the try-it ruling, TRAVEL-FULL-INVENTORY §8:
 * mirrors would DELETE real guest functionality). Grounded in
 * audit-reports/TRAVEL-FULL-INVENTORY.md (merged 4de1b394).
 *
 * ── ⚠️ STRUCTURAL GUARD — DO NOT LOGIN-WALL THE GUEST SURFACE ────────────────
 * The guest access this deck describes is STRUCTURAL, not promotional:
 *   (1) Per vendor API terms of service, free guest access to the search
 *       surfaces is a COMPLIANCE OBLIGATION, not a marketing choice (provenance:
 *       per Alex's ruling — the obligation is not independently verifiable from
 *       repo code/comments; a repo-wide sweep found no vendor-terms citation).
 *   (2) The guest surface is REVENUE-BEARING: a guest hotel booking writes a
 *       real commission_ledger row (bookingType:'guest' — liteapi/book/
 *       route.ts:166-204). Guests are customers here, not leads.
 * Future changes MUST NOT put the guest search/booking surfaces behind login
 * without a vendor-terms review. The deck copy frames free access as by-design
 * and permanent — never a promo, trial, or teaser.
 *
 * ── CLAIMS CALIBRATION (inventory §4 booking-reality table) ──────────────────
 *   Hotels (LiteAPI): the ONE complete flow — search → prebook → hosted card →
 *     book → reservations + commission_ledger in one transaction
 *     (liteapi/book/route.ts:166-204). Sandbox by default (liteapiClient.ts:35-37);
 *     no in-app confirmation email → the deck claims neither live-charging nor
 *     emails. Env-honest banner verbatim (CheckoutPanel.tsx:268-274).
 *   Flights (Duffel): search live; a REAL @duffel/components card element
 *     (FlightCheckoutPanel.tsx:24-30) — but TEST-pinned (flights/book:75,
 *     payment-intent:35) and NO order persistence (the book route's only Prisma
 *     call is the user lookup). TEST label verbatim (FlightCheckoutPanel.tsx:206).
 *     → NEVER "book flights now".
 *   Activities/Transfers (Viator): search live; affiliate model — public Book is
 *     a sign-up nudge, URLs stripped (activities/search/route.ts:80-84).
 *   Visa (RapidAPI Travel Buddy): live, capped 5/day (travelSearchQuota.ts:45).
 *   Places (Google): auth+entitlement-gated categories, cache-first, 5k/mo cap.
 *
 * ── COST-SAFETY (why the live stack below is safe to hand to guests) ─────────
 *   13 public routes (middleware.ts:64-87); per-IP rate limit (rateLimit.ts,
 *   default 5/60s); atomic per-provider daily caps (travelSearchQuota.ts:41-61 —
 *   travelbuddy 5, hotelbooking 25, flightbooking 25, hotelprebook 100…); honest
 *   503 pause strings; Duffel live double-flag block; LiteAPI sandbox default;
 *   locked category cards mount no fetch (PublicCategorySearch.tsx:68-77).
 *   THIS FILE ADDS ZERO FETCH PATHS — hero, slides, and labeled static mirrors
 *   only. The live components are mounted by ModuleLauncher, untouched.
 *
 * ── THE CARRIED EXAMPLE (inventory §8 example-data ruling) ───────────────────
 *   The Portland food-truck festival trip — 3 days, Portland OR, $450 budget —
 *   carried verbatim from the Runway deck's calendar seed
 *   (RunwayShowcaseSections.tsx:143: demo-trip-festival, ymd(3)→ymd(5),
 *   budgetAmount 450). Its committed line renders as activity COA 9400 (the
 *   verified vendor-commit map, vendor-commit/route.ts:11-17; activity icon 🎯,
 *   :402-405). No other trip figures are invented; the hotel/flight flow panels
 *   show FIELD NAMES and steps, not made-up prices.
 *
 * ── VERBATIM STRINGS CARRIED ─────────────────────────────────────────────────
 *   "Flight search is temporarily paused. Please try again later."
 *                                          flights/search/route.ts:90
 *   "Test mode — no real charge. Use a Duffel test card."
 *                                          FlightCheckoutPanel.tsx:206
 *   "Test mode — use card 4242 4242 4242 4242, any future date, any CVV. No
 *    real charge."                         CheckoutPanel.tsx:269-270
 *   "Subscribe to see top-rated <label> with prices." / "Subscribe to unlock"
 *                                          PublicCategorySearch.tsx:146,149
 *   "Search real flights — free, no account needed."  PublicFlightSearch.tsx:231
 *   commission row 'estimated' on book     liteapi/book/route.ts:189-197
 *
 * ── BANNED (inventory §9 — zero rendered hits in DECK copy) ──────────────────
 * "book flights now" (real money) · in-app activity/transfer booking ·
 * "AI trip planner" / "AI trip & flight planning" (the existing MODULES blurb's
 * own tension, ModuleLauncher.tsx:99 — flagged, not propagated here) · eSIM/
 * Mozio/insurance/events as features (their honest coming-soon rows below stay
 * untouched) · the pro_plus trip scan as available · travelers persistence ·
 * Booked/Project columns · ledger auto-posting · confirmation emails · a Travel
 * paywall/trial framing (free access is permanent, by design).
 */

import TabShowcaseTemplate, { ExampleTag } from '@/components/home/TabShowcaseTemplate';

interface Props {
  /** Opens the existing home register/login modal. Never fetches. */
  onRequireAuth: () => void;
}

// ── the carried example trip (derivations in the header comment) ─────────────

const EX = {
  trip: { name: 'Portland food-truck festival', days: 3, location: 'Portland, OR', budget: 450 },
  committedLine: { type: 'activity', coa: '9400', icon: '🎯', amount: 450 },
};

const usd0 = (n: number) => `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;

// ── dark slide shell (panel token family — same look as the seven prior decks) ─

function DarkSlide({ title, tag = 'Example / mirror', children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-panel-border bg-panel p-4 font-mono text-[11px] leading-relaxed">
      <div className="flex items-center justify-between gap-2 border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">{title}</span>
        <ExampleTag text={tag} />
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

// ── HERO ─────────────────────────────────────────────────────────────────────

/** The five verticals with their real vendors (inventory §2) + the guest line.
 *  All labels are the real integrations; nothing here is aspirational. */
function TravelHeroTerminal() {
  return (
    <div className="rounded-lg border border-panel-border bg-panel/90 p-4 font-mono text-[11px] leading-relaxed shadow-2xl">
      <div className="flex items-center justify-between border-b border-panel-border pb-2">
        <span className="font-bold uppercase tracking-wider text-white/60">Travel · the real product</span>
        <ExampleTag text="Real vendors" />
      </div>
      <div className="mt-2 space-y-0.5 text-white/70">
        <p><span className="text-white/40">FLIGHTS</span> real offers <span className="float-right text-white/80">Duffel</span></p>
        <p><span className="text-white/40">HOTELS</span> search + guest booking <span className="float-right text-white/80">LiteAPI</span></p>
        <p><span className="text-white/40">ACTIVITIES + TRANSFERS</span> real tours &amp; rides <span className="float-right text-white/80">Viator</span></p>
        <p><span className="text-white/40">PLACES</span> premium local picks <span className="float-right text-white/80">Google</span></p>
        <p><span className="text-white/40">VISA</span> entry rules, free <span className="float-right text-white/80">Travel Buddy</span></p>
      </div>
      <p className="mt-2 border-t border-panel-border pt-2 text-white/70">
        13 public routes · per-IP + daily caps · <span className="text-brand-green">the searches below are REAL</span>
      </p>
      <p className="text-[10px] italic text-white/50">
        Free to search — by design and by our vendor agreements. Not a trial.
      </p>
    </div>
  );
}

// ── THE 6 SLIDE PANELS (the approved sequence) ───────────────────────────────

/** 1. REAL SEARCHES, FREE BY DESIGN — the cost-safety story (inventory §1
 *  guards): rateLimit.ts default 5/60s; travelSearchQuota.ts:41-61 caps;
 *  honest 503 verbatim (flights/search/route.ts:90). */
function GuardsPanel() {
  return (
    <DarkSlide title="The guardrails — capped, honest, permanent" tag="Real config">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">per-IP rate limit <span className="float-right text-white/80">5 searches / 60s (default)</span></p>
        <p className="text-white/40">daily provider caps <span className="float-right text-white/80">durable, atomic, per-vendor</span></p>
        <p className="border-t border-panel-border pt-1">visa checks <span className="float-right text-white">5 / day</span></p>
        <p>hotel bookings <span className="float-right text-white">25 / day</span></p>
        <p>flight bookings <span className="float-right text-white">25 / day</span></p>
        <p className="border-t border-panel-border pt-1 text-white/50">over the cap, the truth:</p>
        <p className="text-amber-300">&ldquo;Flight search is temporarily paused. Please try again later.&rdquo;</p>
        <p className="pt-1 text-[10px] italic text-white/50">
          Never fake results, never a silent fallback — a paused search says so. And free guest
          access is structural (our vendor agreements), not a promotion that expires.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 2. HOTELS: BOOK AS A GUEST — mirrors the real LiteAPI flow: CheckoutPanel
 *  hosted card SDK (:34,213), env-honest banner (:268-274), book route's
 *  reservation + commission transaction (liteapi/book/route.ts:166-204).
 *  Sandbox-labeled per reality; no confirmation-email claim. */
function HotelBookingPanel() {
  return (
    <DarkSlide title="Hotel booking — the complete flow" tag="Mirror · labeled">
      <div className="space-y-1 text-white/70">
        <p><span className="text-white/40">1</span> search <span className="float-right text-white/80">real LiteAPI rates</span></p>
        <p><span className="text-white/40">2</span> prebook <span className="float-right text-white/80">locked quote</span></p>
        <p><span className="text-white/40">3</span> hosted card <span className="float-right text-white/80">LiteAPI payment SDK — card never touches our server</span></p>
        <p><span className="text-white/40">4</span> book <span className="float-right text-white/80">one transaction, two rows:</span></p>
        <p className="border-t border-panel-border pt-1 text-white">
          reservations <span className="float-right text-white/80">bookingType: &lsquo;guest&rsquo; · guestEmail · confirmation code</span>
        </p>
        <p className="text-white">
          commission_ledger <span className="float-right text-white/80">&lsquo;estimated&rsquo; on book</span>
        </p>
        <p className="mt-1 rounded border border-brand-amber/40 bg-brand-amber/10 px-2 py-1 text-[10px] text-brand-amber">
          Test mode — use card 4242 4242 4242 4242, any future date, any CVV. No real charge.
        </p>
        <p className="text-[10px] italic text-white/50">
          The environment banner above is the real one — sandbox says test card, production says
          real charge. Booked-but-not-persisted fails loud, never silently.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 3. FLIGHTS: SEARCH REAL, CHECKOUT IN TEST — mirrors FlightCheckoutPanel:
 *  payment-intent → client_token → @duffel/components card (:24-30,304), TEST
 *  label verbatim (:206), live double-flag block (flights/book:75), and the
 *  no-persistence truth (book route writes no order row). */
function FlightCheckoutMirror() {
  return (
    <DarkSlide title="Flight checkout — real card element, test rails" tag="Mirror · labeled">
      <div className="space-y-1 text-white/70">
        <p><span className="text-white/40">search</span> <span className="float-right text-white/80">real Duffel offers, real prices</span></p>
        <p><span className="text-white/40">passenger</span> <span className="float-right text-white/80">name · DOB · passport (intl)</span></p>
        <p><span className="text-white/40">payment intent</span> <span className="float-right text-white/80">→ client_token</span></p>
        <p><span className="text-white/40">card element</span> <span className="float-right text-white/80">Duffel&rsquo;s own — PCI, never our server</span></p>
        <p><span className="text-white/40">order</span> <span className="float-right text-white/80">server verifies intent, then books</span></p>
        <p className="mt-1 rounded border border-brand-amber/40 bg-brand-amber/10 px-2 py-1 text-[10px] text-brand-amber">
          Test mode — no real charge. Use a Duffel test card.
        </p>
        <p className="text-[10px] italic text-white/50">
          Honest stops: live charging is double-flag-blocked, and orders don&rsquo;t persist to your
          account yet — the page says so instead of pretending.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 4. THE TRIP IS THE CONTAINER — the trip model (trips + budget_line_items,
 *  schema :515-564, :1050-1075) with the carried Portland example
 *  (RunwayShowcaseSections.tsx:143). Save = the register gate
 *  (gateGuestCreate, ModuleLauncher.tsx:370-377). */
function TripContainerPanel() {
  return (
    <DarkSlide title="The trip — where finds become a plan" tag="Example set">
      <div className="space-y-1 text-white/70">
        <p className="text-white">{EX.trip.name}</p>
        <p className="text-white/50">{EX.trip.days} days · {EX.trip.location} <span className="float-right text-white">{usd0(EX.trip.budget)} budget</span></p>
        <p className="border-t border-panel-border pt-1 text-white/40">saved into it:</p>
        <p><span className="text-cyan-300">{EX.committedLine.icon} festival tickets</span> <span className="float-right text-white/80">{EX.committedLine.coa} · {usd0(EX.committedLine.amount)} · Saved</span></p>
        <p className="pt-1 text-white/50">
          guest → <span className="text-white/80">&ldquo;Sign up free to save trips here&rdquo;</span>
        </p>
        <p className="text-[10px] italic text-white/50">
          Searching is free forever; SAVING what you found into a trip is the account line —
          honestly drawn there and nowhere earlier.
        </p>
      </div>
    </DarkSlide>
  );
}

/** 5. EVERY BOOKING FEEDS THE BOOKS — the verified vendor-commit wiring:
 *  budget_line_items (9xxx map, vendor-commit/route.ts:11-17) + trip_itinerary
 *  + cyan calendar_events (:401-425). Actuals arrive via Plaid/Books
 *  categorization — never auto-posted (inventory §3). */
function CommitWiringPanel() {
  return (
    <DarkSlide title="One save, three rows" tag="Real wiring · example values">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">save &ldquo;festival tickets&rdquo; to the trip →</p>
        <p className="border-t border-panel-border pt-1"><span className="text-white/40">budget line</span> <span className="float-right text-white/80">{EX.committedLine.coa} Activities · {usd0(EX.committedLine.amount)} · source &lsquo;trip&rsquo;</span></p>
        <p><span className="text-white/40">itinerary row</span> <span className="float-right text-white/80">day · time · vendor</span></p>
        <p><span className="text-white/40">calendar event</span> <span className="float-right text-cyan-300">{EX.committedLine.icon} cyan tile · budget riding on it</span></p>
        <p className="border-t border-panel-border pt-1 text-white/50">
          → the Runway tab&rsquo;s travel budget reads these lines; actuals reconcile from your
          bank feed in Books.
        </p>
        <p className="text-[10px] italic text-white/50">
          A booking isn&rsquo;t a receipt in your email — it&rsquo;s a budget line, an itinerary row,
          and a calendar tile. (Planned ≠ posted: the ledger fills from your real transactions.)
        </p>
      </div>
    </DarkSlide>
  );
}

/** 6. THE PREMIUM CATEGORIES — the locked card verbatim
 *  (PublicCategorySearch.tsx:146,149) + the working checkout chain (Stripe
 *  session → signature-verified webhook → entitlement row; inventory §6).
 *  9 keys system-wide (categoryKeys.ts:6-16), 6 sold on this page (:41-48). */
function PremiumCategoriesPanel() {
  return (
    <DarkSlide title="Premium categories — the real paywall" tag="Mirror · labeled">
      <div className="space-y-1 text-white/70">
        <p className="text-white/40">🔒 Dinner spots</p>
        <p className="text-white/60">&ldquo;Subscribe to see top-rated dinner spots with prices.&rdquo;</p>
        <p><span className="rounded border border-panel-border px-1.5 py-0.5 text-white/50">Subscribe to unlock</span> <span className="float-right text-[10px] text-white/50">the button below is the real one</span></p>
        <p className="border-t border-panel-border pt-1 text-white/40">behind the button:</p>
        <p className="text-white/70">Stripe checkout <span className="float-right text-white/80">per-category subscription</span></p>
        <p className="text-white/70">signature-verified webhook <span className="float-right text-white/80">grants the entitlement row</span></p>
        <p className="text-white/70">locked card <span className="float-right text-white/80">mounts NO search, spends nothing</span></p>
        <p className="pt-1 text-[10px] italic text-white/50">
          Nine premium searches system-wide, six sold here, unlocked per category — the one tab
          where the paywall is real today, wired end to end.
        </p>
      </div>
    </DarkSlide>
  );
}

// ── CTA + the inverted connective line ───────────────────────────────────────

/** This tab's REAL gating, reused: register-to-save (the same onRequireAuth
 *  modal gateGuestCreate uses) — and the premium cards below carry their own
 *  real "Subscribe to unlock" checkout CTAs (PublicCategorySearch). */
function TravelCta({ onRequireAuth }: Props) {
  return (
    <div className="rounded-lg border border-brand-purple/30 bg-brand-purple/5 p-5 text-center">
      <p className="text-sm font-semibold text-text-primary">
        Searching is free forever. Saving is the account.
      </p>
      <p className="mx-auto mt-1 max-w-xl text-xs text-text-secondary">
        Make a free account to save what you find into trips — and the premium categories below
        carry their own real per-category unlock.
      </p>
      <button
        type="button"
        onClick={onRequireAuth}
        className="mt-3 rounded bg-brand-purple px-5 py-2 text-sm font-semibold text-white hover:opacity-90"
      >
        Make my free account
      </button>
    </div>
  );
}

// ── THE DECK (hero + slides only — the live section is BELOW this component) ─

export default function TravelShowcase({ onRequireAuth }: Props) {
  return (
    <TabShowcaseTemplate
      darkHero={{
        eyebrow: 'Travel — the real product, no account required',
        headline: 'Search it. Price it. Book it. No account required to look.',
        subcopy:
          'Every other tab shows you a demo — this one hands you the product. Real flight, hotel, activity, and visa searches against real vendors, free by design and by our vendor agreements, quota-capped and honest about every limit.',
        cta: (
          <button
            type="button"
            onClick={onRequireAuth}
            className="rounded bg-white px-5 py-2 text-sm font-semibold text-brand-purple hover:opacity-90"
          >
            Make my free account
          </button>
        ),
        panel: <TravelHeroTerminal />,
      }}
      editorialTitle="What's real here — and exactly where each flow stops"
      editorialRows={[
        {
          title: 'Real searches, free by design.',
          copy:
            'Guests search real vendors — Duffel flights, LiteAPI hotels, Viator tours and rides, visa rules — with no account. It stays free because it has to: our vendor agreements require it, and the caps keep it safe. When a limit is hit, the page says "temporarily paused" instead of showing you something fake.',
          panel: <GuardsPanel />,
          panelSide: 'left',
        },
        {
          title: 'Hotels: book as a guest — the one complete flow.',
          copy:
            'Search, lock a quote, pay on the vendor’s hosted card form, and a real reservation row is written with your confirmation code — plus a commission row. Bookings earn a commission — guests are customers here, not leads. Today it runs on test rails and the banner says so; flipping to production is an environment switch, not a rebuild.',
          panel: <HotelBookingPanel />,
          panelSide: 'right',
        },
        {
          title: 'Flights: real prices, real card element — honest about the rest.',
          copy:
            'The search is live Duffel inventory. The checkout is the real thing too — Duffel’s own card element, payment verified server-side before any order. And the page tells you the truth: test mode, no real charge, and orders don’t persist to an account yet. No pretending.',
          panel: <FlightCheckoutMirror />,
          panelSide: 'left',
        },
        {
          title: 'The trip is the container.',
          copy:
            'Everything you find can be saved into a trip — dates, destination, a budget, and the lines you committed. That save is the register gate, drawn honestly: search free forever, sign up when you want it kept.',
          panel: <TripContainerPanel />,
          panelSide: 'right',
        },
        {
          title: 'Every booking feeds the books.',
          copy:
            'Saving a find writes three rows at once: a travel budget line on its real category, an itinerary row, and a cyan tile on the master calendar with the cost riding on it. The Runway tab reads those budget lines; your bank feed reconciles the actuals in Books. Travel isn’t a silo here — it’s an input.',
          panel: <CommitWiringPanel />,
          panelSide: 'left',
        },
        {
          title: 'The premium categories — the one real paywall.',
          copy:
            'Local discovery — dinner, coffee, gyms, coworking, sports, groceries — is the paid layer. Locked cards spend nothing and say exactly what subscribing buys; the unlock button starts a real per-category checkout, and the entitlement lands only through the verified webhook. No fake walls, no "coming soon" pretending to be paid.',
          panel: <PremiumCategoriesPanel />,
          panelSide: 'right',
        },
      ]}
      /* Slot note: `sample` carries the CTA and `cta` carries the inverted
         connective line so the LAST rendered element of the deck sits directly
         above ModuleLauncher's live guest stack — the line points at real
         components, not at a mirror section (there is none in this deck). */
      sample={<TravelCta onRequireAuth={onRequireAuth} />}
      cta={
        <p className="text-center text-sm text-text-secondary">
          Below this line, nothing is a mirror — these searches are the real product, quota-capped,
          free to try right now. The booking panels and trip budget shown in the slides above are
          labeled mirrors; everything you can click below is live.
        </p>
      }
    />
  );
}
