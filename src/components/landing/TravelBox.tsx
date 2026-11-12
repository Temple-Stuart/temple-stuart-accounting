'use client';

/**
 * TravelBox (HOME-TRAVEL-01, Alex's brief, 2026-11-12 16:08 Manila: "this one is basically set, not much to change, just need to
 * match astehetics of the site to make it follow along"; the board approved on the design canvas at 20:26: "ok I approve the
 * travel market place") — THE BOX, AS DRAWN: one white card holding the eight tabs as tiles, one rule, then the open tab's panel.
 * The spec is design-refs/home-travel-01/Section-Reference.html; its classes, behind the house prefix, are ruled in
 * src/app/globals.css (the HOME-TRAVEL-01 block).
 *
 * A LANDING-ONLY VIEW OF THE SAME MODES. It is handed the list LandingBookingSection.tsx builds from the one builder
 * (src/components/trips/travelStripModes.tsx — frozen, never edited here) in the same order, Events first, and draws it in the
 * landing's own look. The app's travel tab keeps ToggleStrip, DS.iconTab and its band exactly as they are: this file is their
 * neighbour, not their edit, so the app's output cannot move. Why a view and not an opt-in prop on ToggleStrip: the strip's every
 * path (the text chips, the icon tabs, the band, the explainer line, the block/hidden panels) would have carried a branch for a
 * look only one surface wears; here the shared primitive keeps zero diff, and the landing's markup is the reference's own.
 *
 *   · A TAB is the mode's icon over its label — the mode's own icon node, drawn at 22px here (the app's strip keeps 20px) — and,
 *     under the two coming-soon labels, the mode's own badge in this look (its word, "Soon", is the builder's SOON_BADGE). A tab
 *     carrying a badge is a coming-soon tab: grey until it is open (data-soon). The open tab is pressed (aria-pressed), filled
 *     violet. A click asks the caller to open it; the caller holds the open tab (LandingBookingSection's React state).
 *   · ONE RULE between the tabs and the panel (.ts-tm-panels), and no panel draws its own.
 *   · EVERY PANEL STAYS MOUNTED; the closed ones are hidden (the `hidden` attribute, which the section's one hiding rule obeys), so
 *     a search's dates and results survive a tab change, as they did in the strip.
 *   · Every panel but the one named `bare` (Events — it opens with its own "I'M INTO…") opens with its mode's headline, the
 *     builder's `headline`. The strip's explainer line is not drawn here: the headline says it, shorter.
 * A mode with no icon, a badge that is not an element, or a panel that needs a headline and has none, is refused by name — never
 * drawn without.
 */

import { cloneElement, isValidElement, type ReactElement, type Ref } from 'react';
import type { ToggleMode } from '@/components/ui/ToggleStrip';

/** The tab's icon: the mode's own node, in this look — its class, at 22px. */
function iconOf(m: ToggleMode): ReactElement {
  if (!isValidElement<{ className?: string; width?: number; height?: number }>(m.icon)) throw new Error(`TravelBox: the '${m.key}' mode has no icon node — this look draws every tab as its mode's icon over its label`);
  return cloneElement(m.icon, { className: 'ts-tm-tab__icon', width: 22, height: 22 });
}

/** A coming-soon tab's badge: the mode's own node, in this look. */
function badgeOf(m: ToggleMode): ReactElement | null {
  if (m.badge === undefined) return null;
  if (!isValidElement<{ className?: string }>(m.badge)) throw new Error(`TravelBox: the '${m.key}' mode's badge is not an element — this look draws it under the label`);
  return cloneElement(m.badge, { className: 'ts-tm-tab__soon' });
}

/** A panel's headline: the builder's own. */
function headlineOf(m: ToggleMode): string {
  if (m.headline === undefined) throw new Error(`TravelBox: the '${m.key}' mode has no headline — every panel but the bare one opens with its mode's headline`);
  return m.headline;
}

export default function TravelBox({ modes, activeKey, onActiveChange, bare, boxRef }: {
  /** The modes, in the order the tabs stand — LandingBookingSection's list, Events first. */
  modes: readonly ToggleMode[];
  /** The open tab's key — held by the caller (ToggleStrip's own name for it, HOME-BRIEF-05). */
  activeKey: string;
  /** A click on a tab: the caller opens it. */
  onActiveChange: (key: string) => void;
  /** The one mode whose panel opens with its own first line, not its headline (Events). */
  bare: string;
  /** The box itself — what "Stay near it →" and "Search flights →" bring into view. */
  boxRef: Ref<HTMLDivElement>;
}) {
  if (!modes.some((m) => m.key === activeKey)) throw new Error(`TravelBox: the open tab '${activeKey}' is none of the box's tabs (${modes.map((m) => m.key).join(', ')})`);
  return (
    <div ref={boxRef} className="ts-tm-box" data-box>
      <div className="ts-tm-tabs">
        {modes.map((m) => (
          <button key={m.key} className="ts-tm-tab" type="button" aria-pressed={activeKey === m.key} data-tab={m.key} data-soon={m.badge === undefined ? undefined : true} onClick={() => onActiveChange(m.key)}>
            {iconOf(m)}
            <span className="ts-tm-tab__label">{m.label}</span>
            {badgeOf(m)}
          </button>
        ))}
      </div>
      <div className="ts-tm-panels">
        {modes.map((m) => (
          <div key={m.key} className="ts-tm-panel" data-panel={m.key} hidden={activeKey !== m.key}>
            {m.key !== bare && <p className="ts-tm-panel__headline">{headlineOf(m)}</p>}
            {m.panel}
          </div>
        ))}
      </div>
    </div>
  );
}
