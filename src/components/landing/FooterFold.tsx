'use client';

/**
 * FooterFold — HOME-PHONE-01 (Alex's brief, 2026-11-16 01:42 Manila — his ask: "ok i sent it now what about the footer"; the phone footer
 * approved on the design canvas with the home page's boards, 2026-11-14 at 20:01 and, corrected, at 20:41 Manila) — A FOOTER COLUMN'S FOLD.
 *
 * The spec is design-refs/home-phone-01/Footer-Reference.html, with its README beside it. Under 1024px Our Story, Services and The Record
 * each stand as a row that opens their links: the column's name in the label's gold mono capitals at the left, a caret at the right. A
 * press opens the links under it, and a second press closes them. From 1024px the row is never drawn, and every column draws its links
 * whether its fold is open or not (the rules: src/app/globals.css, at the foot of FOOTER-02's block). LandingFooter.tsx draws one in each
 * of the three columns, after the column's own label.
 *
 * THE BRIEF'S RULINGS BUILT HERE:
 *   a. "THREE COLUMNS FOLD UNDER 1024PX. In Our Story, Services and The Record, a button of type button stands between the column's name
 *      and its list. It holds the name in a span of the label's class and the reference's caret, with aria-expanded, and aria-controls
 *      naming its list: ts-ft-story, ts-ft-services and ts-ft-record. A press opens that column's links and a second press closes them.
 *      All three start closed, and any number can be open. Under 1024px the row stands in for the name; from 1024px the row is never
 *      drawn and the name stands as it does today." — FooterFoldView draws the <button>, its span and its caret, aria-expanded saying
 *      whether the links are open and aria-controls naming the list by the id handed in; then the list. FooterFold holds one boolean,
 *      false at first, and each press turns it; each of the three columns draws its own FooterFold, so each holds its own.
 *   c. "THE FOOTER STAYS A SERVER COMPONENT, WITH ONE CLIENT ISLAND. A fold's state lives in FooterFold.tsx, a client component that draws
 *      the row and the list it opens. LandingFooter.tsx hands it the column's name, the list's id and class, and the links, which
 *      LandingFooter.tsx still draws. That state is React's alone: nothing is kept in storage or in the URL. A folded list carries
 *      data-folded, which the stylesheet reads under 1024px only. The tests reach each open state through a pure view that the stateful
 *      fold draws, so it renders on the server; the audit names that view's shape, the smallest by the pins it moves." — this file is the
 *      island: 'use client', importing React alone. Its default export is the stateful fold, which LandingFooter.tsx draws; FooterFoldView
 *      is the pure view it draws, handed the state and the press. A folded list carries data-folded, and an open one carries none
 *      (React writes data-folded={false} as data-folded="false", which [data-folded] would still match, so an open list is handed
 *      undefined).
 *
 * THE PUBLIC PAGES' IMPORT CLOSURE (HOME-PHONE-01, 2026-11-16, Alex's answer to the audit): this file joins the import closure of the public
 * pages that mount the footer — it imports React alone and reads no data — and the seven notes that describe that closure stand as written
 * (src/middleware.ts:78-80, :89-90, :99-100 and :110-111; src/app/financial-software/page.tsx:30-31, src/app/professional-services/page.tsx:24-25
 * and src/app/about/page.tsx:33).
 *
 * The caret is the reference's, as it draws it: 14px, its 16-unit box, stroked in currentColor, aria-hidden. It does not turn (the
 * README: "No motion").
 */

import { useState, type ReactNode } from 'react';

/** What a fold draws for a given state: the row, then the list it opens. Pure — what it draws is what it is handed. */
export interface FooterFoldViewProps {
  /** The column's name: its label from src/lib/footerWords.ts, read by LandingFooter.tsx where it reads it for the column's own <p>. */
  readonly label: string;
  /** The list's id, which the row's aria-controls names. */
  readonly id: string;
  /** The list's class, as the column wears it. */
  readonly listClassName: string;
  /** The column's links, as LandingFooter.tsx draws them. */
  readonly children: ReactNode;
  /** Whether the links are open. */
  readonly open: boolean;
  /** A press of the row. */
  readonly onToggle: () => void;
}

export function FooterFoldView({ label, id, listClassName, children, open, onToggle }: FooterFoldViewProps) {
  return (
    <>
      <button className="ts-ft-fold" type="button" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span className="ts-ft-label">{label}</span>
        <svg className="ts-ft-fold__caret" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 6l4 4 4-4" /></svg>
      </button>
      <ul className={listClassName} id={id} data-folded={open ? undefined : true}>{children}</ul>
    </>
  );
}

/** What LandingFooter.tsx hands a fold: the column's name, the list's id and class, and the links. */
export type FooterFoldProps = Omit<FooterFoldViewProps, 'open' | 'onToggle'>;

/** A fold: closed at first; each press of its row turns its own state. React's state alone — nothing is stored, nothing goes in the URL. */
export default function FooterFold(props: FooterFoldProps) {
  const [open, setOpen] = useState(false);
  return <FooterFoldView {...props} open={open} onToggle={() => setOpen((wasOpen) => !wasOpen)} />;
}
