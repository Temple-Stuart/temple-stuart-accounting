'use client';

/**
 * LandingHeader — THE GUEST'S TOP BAR, on every page that mounts it: the landing, /pricing, /how-it-works, the
 * /modules pages, a trip page and the signed-out cockpit tabs.
 *
 * HERO-CREST-01 (Alex, design canvas, 2026-11-11) — ONE PILL, TWO FILLS. The bar is the reference's pill
 * (design-refs/hero-crest-01/Hero-Reference.html — "every value in its stylesheet is the design"): the gold crest
 * mark and the wordmark · Financial Software | Professional Services | Travel Marketplace · Pricing · Log in. Its
 * classes are the reference's own with the house prefix (.bar__pill → .ts-bar__pill …), and their rules are the
 * reference's own, ported to the foot of src/app/globals.css; no colour is typed in this file.
 *   · FILLED IS THE DEFAULT — the pill filled with the hero's violet, in the page's flow, on that page's own cream.
 *     Five mounts take it by passing nothing new.
 *   · GLASS IS THE LANDING'S — `glass` lays the same pill over the hero (Landing.tsx), where it scrolls away with it.
 *   · THE THREE LINKS are the home page's three pillars: each wears its pillar's own name — the pillar's heading,
 *     src/lib/homeActWords.ts (PILLAR-NAMES-01, 2026-11-11) — and lands on that pillar's section by the section's own
 *     anchor from src/lib/homeAnchors.ts (MODULES_ANCHOR · SERVICES_ANCHOR · DEMO_ANCHOR). No name and no id is typed
 *     here. They are absolute (/#…), so they land from every page the bar is on.
 *   · LOG IN KEEPS ITS TWO MODES (ROUTE-1, below): a button calling onRequireLogin where a login modal exists, a link
 *     to '/' where none does.
 *   · UNDER 1024px the links fold into a menu behind one 44px button. Open or closed is React state, and nothing
 *     else: no storage, no cookie, no URL. It closes on a link, on Log in, on Escape and on the button.
 * GONE, BY ALEX'S RULING (2026-11-11):
 *   · "GitHub ↗" — "remove github, the icon is enough, we dont need it 2x": the hero's "Clone it on GitHub" carries
 *     GitHub's mark, and the footer's THE RECORD keeps the code's link on every page that mounts the footer. (The
 *     signed-out cockpit tabs mount none: this link was their one link to the code.)
 *   · "CREATE FREE ACCOUNT" — "create free account top right, that can be login… we dont need it twice": the hero
 *     keeps the register ask, and Log in opens the one LoginBox, whose own switch reaches "create account". The
 *     onRequireAuth prop left with its last reader (it fed that button alone).
 * GONE WITH THE DESIGN: the white box with the crest in it (public/brand/temple-stuart-crest.png — one dark-gold ink on a white ground). The bar's
 * mark is the gold crest the handoff ships, public/brand/temple-stuart-crest-gold.png — that file with its white
 * knocked out and its ink gold. This bar was the older file's one reader; it stays in public/brand, read by nothing.
 * Every note below is history: it says how the cream bar stood until this design.
 *
 * LandingHeader (FD-1d) — the Bloomberg header extracted from Landing.tsx so
 * the /modules pages share it verbatim. Token-native, zero hex. REPAINT-2
 * (Direction C): the nav sits on cream with the lavender border-b hairline,
 * aubergine ink; the Create-account CTA wears the MONEY_ACTION gold colors
 * (geometry preserved — the header buttons keep their own padding and carry
 * no rounding).
 *
 * ROUTE-1 (Alex's ruling b): the top-right CTA is now "Log in" — the hero
 * already carries "Create free account", so the header stops duplicating the
 * register ask and serves returning users. Two honest modes:
 *   • onRequireLogin provided (the Landing; GuestLanding passes the LoginBox
 *     opener in LOGIN mode) → a button calling it;
 *   • absent (the /modules pages, which have no login modal) → a LINK to
 *     '/' — PR-PRICE-3: /pricing (the old ask surface) is a redirect now, so
 *     the front door is the real one: its header renders THIS component in
 *     button mode (working Log in modal) and its hero carries the register
 *     ask.
 *
 * LANDING-V3 (spec :34-47) → THREE-TRIMS: the nav anatomy, minus the retired anchor links (Live demo → /#demo and
 * Modules → /#modules died — the #modules id now marks THE OFFER act, SELL-02, the target of the checkout cancel_url
 * and the /?module= doors). Outlined TS mark (:37) — HOME-BRIEF-02 (Alex, 2026-11-10): his crest took that square
 * (public/brand/temple-stuart-crest.png — the file he attached, cropped to the crest, nothing redrawn), a plain <img>
 * as BuiltOnStrip.tsx draws one. HOME-BRIEF-04 (Alex, 2026-11-10 19:00): the box is larger, rounded and white, the
 * crest centred in it by object-contain inside even padding (multiply went with the cream ground), the box never
 * squeezed by the row (shrink-0 — without it a phone drew it 30px wide), and the wordmark is larger from sm;
 * HOME-BRIEF-05 (Alex, 2026-11-10 20:53: "meet the top and bottom at a min … truly centered on left right spacing"):
 * the box's padding went, so the crest runs from the border's inner top edge to its inner bottom edge, never stretched
 * (object-contain) and centred left to right — the file is cropped to the crest on all four sides; the corner is
 * rounded-md; the name is bold and larger from sm; the row's and the link's gaps are narrower below sm, so a 360px
 * phone no longer scrolls sideways ("even padding" and "rounded" above are HOME-BRIEF-04's, until then). Pricing keeps
 * /how-pricing-works; GitHub ↗ = the repo link; Log in = the spec's text link, SAME dual-mode handlers; CREATE FREE
 * ACCOUNT = the spec's mono uppercase gold button, SAME dual-mode handlers. V3 FLAGS: Contact dropped — the mailto
 * survives in the footer. (This note stood inside the component, over its <header>, until HERO-CREST-01.)
 */

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { DEMO_ANCHOR, MODULES_ANCHOR, SERVICES_ANCHOR } from '@/lib/homeAnchors';
import { BUILD_PILLAR, EXPLORE_PILLAR, PLAN_PILLAR } from '@/lib/homeActWords';

/**
 * HERO-CREST-01: the bar's three product links — the home page's three pillars. Each is its pillar's heading (Financial
 * Software · Professional Services · Travel Marketplace, since PILLAR-NAMES-01) on its pillar's section, by that
 * section's own anchor: the design's three words are the pillars' names, so they are read, not typed a third time
 * (the footer's SERVICES column types them once more, and footer01 holds those to the same headings). ONE LIST, DRAWN
 * TWICE: the bar's row from 1024px, the menu's rows under it — so the two cannot drift.
 */
export const BAR_PRODUCT_LINKS = [
  { label: PLAN_PILLAR.heading, href: `/#${MODULES_ANCHOR}` },
  { label: BUILD_PILLAR.heading, href: `/#${SERVICES_ANCHOR}` },
  { label: EXPLORE_PILLAR.heading, href: `/#${DEMO_ANCHOR}` },
] as const;

/** Pricing keeps its page — /how-pricing-works (the reachability law's GUEST_ROUTES cites this line as that page's door). */
export const BAR_PRICING = { label: 'Pricing', href: '/how-pricing-works' } as const;

/** The mark the design ships for the bar: public/brand/temple-stuart-crest.png with its white knocked out and its ink gold. */
export const BAR_MARK_SRC = '/brand/temple-stuart-crest-gold.png';

/**
 * The phone menu's id — what the menu button's aria-controls names. ONE FIXED ID, as the reference types its own
 * ("menu-hero"): a page mounts one top bar, never two. Not React's useId: tried first, and on the landing the server and
 * the browser disagreed about the generated id on some dev loads and not others (5, 14 and 11 of 21 in three runs — React's hydration warning named
 * aria-controls and id; the fixed id gave none in 21), so the pair is typed.
 */
export const BAR_MENU_ID = 'ts-bar-menu';

export default function LandingHeader({ onRequireLogin, glass = false }: {
  /** ROUTE-1: the login modal's opener, where the page has one. Absent → Log in is a link to '/'. */
  onRequireLogin?: () => void;
  /** HERO-CREST-01: the landing lays the bar over its hero as glass. Every other mount leaves it out and gets the pill filled, in the page's flow. */
  glass?: boolean;
}) {
  // The menu under 1024px: open or closed, in React state only.
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [menuOpen]);

  return (
    <header className={glass ? 'ts-bar ts-bar--overlay' : 'ts-bar ts-bar--solid'}>
      <div className="ts-bar__pill">
        <Link className="ts-brand" href="/">
          <img className="ts-brand__mark" src={BAR_MARK_SRC} alt="" />{/* eslint-disable-line @next/next/no-img-element */}
          <span className="ts-brand__name">TEMPLE STUART</span>
        </Link>
        <nav className="ts-bar__products" aria-label="Products">
          {BAR_PRODUCT_LINKS.map((link, i) => (
            <Fragment key={link.href}>
              {i > 0 && <span className="ts-bar__rule" aria-hidden="true" />}
              <Link href={link.href}>{link.label}</Link>
            </Fragment>
          ))}
        </nav>
        <nav className="ts-bar__account" aria-label="Account">
          <Link className="ts-bar__link" href={BAR_PRICING.href}>{BAR_PRICING.label}</Link>
          {onRequireLogin ? (
            <button type="button" onClick={onRequireLogin} className="ts-pill-gold ts-bar__login">Log in</button>
          ) : (
            <Link href="/" className="ts-pill-gold ts-bar__login">Log in</Link>
          )}
        </nav>
        <button
          type="button"
          className="ts-bar__menu-button"
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls={BAR_MENU_ID}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="M3 8h16M3 14h16" /></svg>
        </button>
      </div>
      {/* THE OPEN MENU — the README's first proposal (the 390 artboard draws the bar closed): a dark glass panel under the
          bar with the three links, a rule, Pricing and a full-width Log in. A press on any link in it closes it. */}
      <nav
        className="ts-menu"
        id={BAR_MENU_ID}
        aria-label="Menu"
        hidden={!menuOpen}
        onClick={(e) => { if ((e.target as HTMLElement).closest('a')) setMenuOpen(false); }}
      >
        {BAR_PRODUCT_LINKS.map((link) => (
          <Link key={link.href} className="ts-menu__row" href={link.href}>{link.label}</Link>
        ))}
        <span className="ts-menu__rule" aria-hidden="true" />
        <Link className="ts-menu__row" href={BAR_PRICING.href}>{BAR_PRICING.label}</Link>
        {onRequireLogin ? (
          <button type="button" onClick={() => { setMenuOpen(false); onRequireLogin(); }} className="ts-pill-gold ts-menu__login">Log in</button>
        ) : (
          <Link href="/" className="ts-pill-gold ts-menu__login">Log in</Link>
        )}
      </nav>
    </header>
  );
}
