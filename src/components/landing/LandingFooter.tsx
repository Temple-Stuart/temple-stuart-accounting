/**
 * LandingFooter (FD-1d) — extracted from Landing.tsx; REPAINT-2 (Direction C):
 * a SOLID aubergine band (bg-brand-purple, cream ink) closing the cream page —
 * the panel base retired with the dark landing. Mono micro-labels,
 * token-native, zero hex. Shared by the Landing and every /modules page.
 *
 * Carries the CPA disclaimer (copy verbatim from page.tsx :202-207) — legal
 * boilerplate that belongs on every marketing surface, including the Tax
 * module page. Legal links + Pricing carry over.
 *
 * Social row reused from Footer.tsx :14-29 (app footer) — icons, hrefs,
 * rel/target byte-identical; REPAINT-2 re-inks the socials cream/70 with
 * hover to full cream on the aubergine band.
 *
 * FOOTER-01 (Alex, 2026-11-08 15:11 + 16:18; board K tag 17): two columns join the footer ABOVE the disclaimer —
 * THE BLOG (the home page's four sections, then every written trip post) and THE RECORD (the 14 steps; the code,
 * built in public). Every word and href from src/lib/footerWords.ts; the posts from src/lib/tripPosts.ts, in their
 * order, so a new post adds its own link. The disclaimer, ©, the five social icons and PRICING · TERMS · PRIVACY ·
 * the email are unchanged — in their order, with their classes. This file is a server component under /pricing,
 * /my-trip/[id] and /how-it-works, and part of the client bundle under / (Landing.tsx) and the /modules pages
 * (ModulePageClient.tsx), both 'use client' — so the post list ships to the browser there.
 *
 * HOME-FINISH-02 (Alex's brief "HOME-FINISH | Temple Stuart Homepage Copy, Layout & Footer", 2026-11-10 20:56, with his footer
 * note of 20:53 — "Less text. Higher impact. A clean, professional presentation."): THE FOOTER IN FOUR COLUMNS, above the
 * disclaimer — two by two on a phone, four across from lg:
 *   · OUR STORY  — Stop 0, then one link per stop in the trip log, in trip order (the list passed in is WAS_HERE,
 *                  src/lib/wasHere.ts — every stop has a page, written up or not; a stop added to the log adds itself);
 *   · SERVICES   — the three pillars under "What We Do", each landing on its section of the home page;
 *   · SOCIALS    — the five accounts, each icon beside its name: the same five hrefs, the same SVGs and the same
 *                  target/rel as the icon-only row the bar held until now (that row and its "·" left the bar);
 *   · THE RECORD — the 14 steps, the code, the licence.
 * Every word and href is src/lib/footerWords.ts's; this file types the icons (an icon is not a word) and the bar. THE BLOG
 * left: its links to Book travel, Events and My trip and the post titles are not in the footer now, and src/lib/tripPosts.ts
 * is no longer imported here. BELOW the columns: the disclaimer, word for word; then one row — © and PRICING · TERMS ·
 * PRIVACY · CONTACT, on their existing targets (the mailto reads CONTACT; it read the address until now). The column
 * link wears lg:min-h-0 lg:py-1: eleven 44px rows would stand 484px tall on a desktop — the 44px touch height stays
 * below lg. The solid purple stays.
 */

import Link from 'next/link';
import { WAS_HERE } from '@/lib/wasHere';
import {
  FOOTER_RECORD_LABEL, FOOTER_RECORD_LINKS, FOOTER_SERVICES_LABEL, FOOTER_SERVICES_LINKS, FOOTER_SOCIALS, FOOTER_SOCIALS_LABEL, FOOTER_STORY_LABEL,
  footerStoryLinks, type FooterLink, type SocialName,
} from '@/lib/footerWords';

/** The columns' classes — each label in the house's mono eyebrow; each link a 44px tap row below lg, a tight row from lg. */
const COLUMN = {
  label: 'font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-white/60',
  link: 'inline-flex min-h-[44px] items-center text-sm text-white/85 hover:text-white lg:min-h-0 lg:py-1',
  // A social's link: the same row, its icon beside its name.
  social: 'inline-flex min-h-[44px] items-center gap-2 text-sm text-white/85 hover:text-white lg:min-h-0 lg:py-1',
} as const;

/**
 * The five socials' icons — each SVG's path, moved here byte for byte from the bar's icon row. The one <svg> around a path
 * (w-4 h-4, currentColor, the 24-unit box — the same on all five there) is drawn where the link is drawn. Keyed by the
 * name the words leaf gives each account (SocialName), so an account with no icon here does not compile. Plain strings:
 * this module builds no markup when it loads.
 */
const SOCIAL_ICON_PATHS: Readonly<Record<SocialName, string>> = {
  Instagram: 'M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z',
  TikTok: 'M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z',
  YouTube: 'M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z',
  X: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
  LinkedIn: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
};

/** A column's link: one that stays on the site through next/link; one that leaves it in a new tab. */
const columnLink = (link: FooterLink) => (
  <li key={link.href}>
    {link.external ? (
      <a href={link.href} target="_blank" rel="noopener noreferrer" className={COLUMN.link}>{link.label}</a>
    ) : (
      <Link href={link.href} className={COLUMN.link}>{link.label}</Link>
    )}
  </li>
);

export default function LandingFooter() {
  return (
    <footer className="bg-brand-purple text-white">
      {/* HOME-FINISH-02: the four columns, above the disclaimer — every word and href from src/lib/footerWords.ts. */}
      <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-10 grid gap-8 grid-cols-2 lg:grid-cols-4">
        <div data-footer-story>
          <p className={COLUMN.label}>{FOOTER_STORY_LABEL}</p>
          <ul className="mt-2">{footerStoryLinks(WAS_HERE).map(columnLink)}</ul>
        </div>
        <div data-footer-services>
          <p className={COLUMN.label}>{FOOTER_SERVICES_LABEL}</p>
          <ul className="mt-2">{FOOTER_SERVICES_LINKS.map(columnLink)}</ul>
        </div>
        <div data-footer-socials>
          <p className={COLUMN.label}>{FOOTER_SOCIALS_LABEL}</p>
          <ul className="mt-2">
            {FOOTER_SOCIALS.map((social) => (
              <li key={social.href}>
                <a href={social.href} target="_blank" rel="noopener noreferrer" className={COLUMN.social}>
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={SOCIAL_ICON_PATHS[social.name]}/></svg>
                  <span>{social.name}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
        <div data-footer-record>
          <p className={COLUMN.label}>{FOOTER_RECORD_LABEL}</p>
          <ul className="mt-2">{FOOTER_RECORD_LINKS.map(columnLink)}</ul>
        </div>
      </div>
      <div className="max-w-3xl mx-auto px-4 lg:px-8 pt-8 text-center">
        <p className="text-xs text-white/50 leading-relaxed">
          Temple Stuart is not a CPA firm, tax preparer, or licensed financial advisor.
          All tax figures generated by this platform are estimates for informational purposes only
          and must be verified by a qualified tax professional before filing.
          Use of this software does not constitute tax advice.
        </p>
      </div>
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8">
        {/* LANDING-V3 (spec :335-343): the hybrid mono row — © left; socials
            (Alex's standing ruling: KEPT, re-seated in the row's rhythm) +
            the spec's mono links right. The TS tile died (spec has none);
            link labels are the spec's own strings. Spec inks: © #9C90C2 →
            text-white/60; links #E0D9F2 → text-white/80 hover:text-white.
            HOME-FINISH-02 (2026-11-10): the socials left this row for their own column above, each with its name (the five
            icon-only links and the "·" after them stood here, before PRICING); the last link reads CONTACT — the same mailto,
            which read ASTUART@TEMPLESTUART.COM until now. */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="font-mono text-xs lg:text-[10px] uppercase tracking-wider text-white/60">© 2026 TEMPLE STUART, LLC</div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/how-pricing-works" className="inline-block py-3.5 lg:py-0 font-mono text-xs lg:text-[10px] tracking-wider text-white/80 hover:text-white">PRICING</Link>
            <a href="/terms" className="inline-block py-3.5 lg:py-0 font-mono text-xs lg:text-[10px] tracking-wider text-white/80 hover:text-white">TERMS</a>
            <a href="/privacy" className="inline-block py-3.5 lg:py-0 font-mono text-xs lg:text-[10px] tracking-wider text-white/80 hover:text-white">PRIVACY</a>
            <a href="mailto:astuart@templestuart.com" className="inline-block py-3.5 lg:py-0 font-mono text-xs lg:text-[10px] tracking-wider text-white/80 hover:text-white">CONTACT</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
