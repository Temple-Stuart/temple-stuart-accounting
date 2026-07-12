'use client';

/**
 * TRADE-SHOWCASE-BUILD: the reusable, Plaid-style logged-out tab showcase —
 * the TEMPLATE the paid tabs share. Trade composes it first; tabs 2–9 drop in
 * their own hero line, pipe steps, concept cards, honest sample, and CTA.
 *
 * SHOW discipline (unchanged from TabShowcases.tsx): this component is
 * STATIC — zero fetches, zero paid calls, nothing personal, no auth/gate
 * logic. Everything it renders arrives via props from the composing showcase;
 * illustrative values must arrive ALREADY labeled (the template renders the
 * EXAMPLE tags it is given and adds a rail-level tag of its own).
 *
 * Styling: the app's real brand tokens only (bg-brand-purple hero band like
 * the homepage hero, bg-white cards, border-border, text-text-* scale,
 * brand-amber example tags) — no invented colors.
 */

import type { ReactNode } from 'react';

export interface ShowcaseStep {
  /** The real step code as the product names it (e.g. "A", "B" … "T"). */
  code: string;
  /** The real step label, verbatim from the pipe. */
  label: string;
  /** Short summary line; illustrative counts must say so (e.g. "(example)"). */
  summary?: string;
}

export interface ShowcaseConceptCard {
  name: string;
  /** Plain-language "what it asks" line. */
  asks: string;
  /** What it really measures — drawn from the real component, not invented. */
  measures: string;
}

export interface ShowcaseDarkHero {
  /** Small uppercase eyebrow (e.g. "Trade — the scanner"). */
  eyebrow: string;
  headline: string;
  subcopy: string;
  /** The unlock button (routes to the existing signup/checkout flow). */
  cta: ReactNode;
  /** The dark terminal panel — REAL payload rows, example-tagged. */
  panel: ReactNode;
}

export interface ShowcaseEditorialRow {
  title: string;
  copy: string;
  panel: ReactNode;
  /** Which side the dark panel sits on (rows alternate, Bloomberg-style). */
  panelSide: 'left' | 'right';
}

export interface ShowcaseProductTile {
  title: string;
  line: string;
  /** id of the real section below to scroll to. */
  anchorId: string;
}

export interface TabShowcaseTemplateProps {
  /** Small uppercase chip above the headline (e.g. "The Trade tab").
   *  Used by the DEFAULT light hero — ignored when darkHero is set. */
  heroBadge?: string;
  /** Post-ready headline (default hero). Keep it honest — real numbers only. */
  headline?: string;
  /** Teaching subcopy (default hero): real data sources + what the pipe does. */
  subcopy?: string;
  /** TRADE-SHOWCASE-BLOOMBERG: the dark cinematic hero (near-black base,
   *  brand-purple radial glow). When set, it REPLACES the default purple band.
   *  Optional — tabs not passing it render exactly as before. */
  darkHero?: ShowcaseDarkHero;
  /** Centered section header over the editorial rows (e.g. "Go further…"). */
  editorialTitle?: string;
  /** Alternating dark-panel + copy rows (Bloomberg Terminal-in-Action). */
  editorialRows?: ShowcaseEditorialRow[];
  /** Dark product tiles, each anchoring to a real section below. */
  productTiles?: ShowcaseProductTile[];
  /** Optional section(s) rendered BETWEEN the hero and the pipe rail — for
   *  content that precedes the pipe in the real product flow (e.g. Trade's
   *  filter panel: you set filters and hit Scan, THEN the pipe runs). */
  preSteps?: ReactNode;
  /** Title over the pipe rail (e.g. "The pipe — 20 steps, A to T"). */
  stepsTitle: string;
  /** Rail-level honesty tag (e.g. "Example scan — real steps, sample counts"). */
  stepsTag: string;
  steps: ShowcaseStep[];
  /** Optional footer inside the pipe card (e.g. the funnel/runtime line). */
  stepsFooter?: ReactNode;
  /** Title over the concept cards (e.g. "The four gates"). Optional — a tab
   *  may teach its concepts inside richer sections instead. */
  cardsTitle?: string;
  cards?: ShowcaseConceptCard[];
  /** The honest sample block (tab-specific; engine-derived where possible). */
  sample: ReactNode;
  /** One teaching line under the sample (e.g. the no-manufactured-trades line). */
  teachingLine?: string;
  /** The unlock/signup CTA block (LockedTabCard — the existing checkout path). */
  cta: ReactNode;
}

export function ExampleTag({ text }: { text: string }) {
  return (
    <span className="inline-block rounded border border-brand-amber/40 bg-brand-amber/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-amber">
      {text}
    </span>
  );
}

export default function TabShowcaseTemplate({
  heroBadge,
  headline,
  subcopy,
  darkHero,
  editorialTitle,
  editorialRows,
  productTiles,
  preSteps,
  stepsTitle,
  stepsTag,
  steps,
  stepsFooter,
  cardsTitle,
  cards,
  sample,
  teachingLine,
  cta,
}: TabShowcaseTemplateProps) {
  return (
    <div className="space-y-6">
      {darkHero ? (
        /* ── TRADE-SHOWCASE-BLOOMBERG hero: near-black base, brand-purple
              radial glow (rgb(59 45 107) = --ts-purple; rgb(45 27 78) =
              --ts-purple-deep). No new palette — the brand family, deepened. ── */
        <div
          className="overflow-hidden rounded-lg px-6 py-10 text-white sm:px-10"
          style={{
            background:
              'radial-gradient(ellipse 80% 90% at 85% 10%, rgb(59 45 107 / 0.65), transparent 60%), radial-gradient(ellipse 60% 70% at 100% 80%, rgb(45 27 78 / 0.5), transparent 55%), #0b0a14',
          }}
        >
          <div className="grid items-center gap-8 lg:grid-cols-2">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded border border-white/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  {darkHero.eyebrow}
                </span>
                <ExampleTag text="Example data" />
              </div>
              <h3 className="mt-4 text-3xl font-light tracking-tight sm:text-5xl">{darkHero.headline}</h3>
              <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/65">{darkHero.subcopy}</p>
              <div className="mt-6">{darkHero.cta}</div>
            </div>
            <div>{darkHero.panel}</div>
          </div>
        </div>
      ) : (
        /* ── Default hero band — the homepage hero's own tokens ── */
        <div className="rounded-lg bg-brand-purple px-6 py-8 text-white sm:px-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded border border-white/25 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white/80">
              {heroBadge}
            </span>
            <ExampleTag text="Example data" />
          </div>
          <h3 className="mt-3 text-3xl font-light tracking-tight sm:text-4xl">{headline}</h3>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/75">{subcopy}</p>
        </div>
      )}

      {/* ── Editorial "in action" rows — alternating dark panel + copy ── */}
      {editorialRows && editorialRows.length > 0 && (
        <div className="space-y-6 py-2">
          {editorialTitle && (
            <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-text-muted">{editorialTitle}</p>
          )}
          {editorialRows.map((row) => (
            <div key={row.title} className="grid items-center gap-5 lg:grid-cols-2">
              <div className={row.panelSide === 'left' ? 'lg:order-1' : 'lg:order-2'}>{row.panel}</div>
              <div className={row.panelSide === 'left' ? 'lg:order-2' : 'lg:order-1'}>
                <h4 className="text-xl font-light tracking-tight text-text-primary sm:text-2xl">{row.title}</h4>
                <p className="mt-2 max-w-lg text-sm leading-relaxed text-text-secondary">{row.copy}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Dark product tiles — each anchors to its real section below ── */}
      {productTiles && productTiles.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {productTiles.map((t) => (
            <button
              key={t.title}
              type="button"
              onClick={() => document.getElementById(t.anchorId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
              className="rounded-lg border border-panel-border bg-panel p-4 text-left transition-colors hover:bg-panel-hover"
            >
              <p className="font-semibold text-white">{t.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-white/55">{t.line}</p>
              <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-brand-amber">See it below ↓</p>
            </button>
          ))}
        </div>
      )}

      {/* ── Pre-pipe section(s) — the real flow's first act (optional) ── */}
      {preSteps}

      {/* ── The real pipe, as a compact rail ── */}
      <div className="rounded-lg border border-border bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-text-muted">{stepsTitle}</p>
          <ExampleTag text={stepsTag} />
        </div>
        <ol className="grid gap-x-6 px-4 py-3 sm:grid-cols-2">
          {steps.map((s) => (
            <li key={s.code} className="flex gap-3 border-b border-border-light py-1.5 last:border-0 sm:[&:nth-last-child(2)]:border-0">
              <span className="w-5 shrink-0 pt-px text-right font-mono text-xs font-bold text-brand-purple">{s.code}</span>
              <span className="min-w-0 text-sm">
                <span className="font-medium text-text-primary">{s.label}</span>
                {s.summary && <span className="text-text-muted"> — {s.summary}</span>}
              </span>
            </li>
          ))}
        </ol>
        {stepsFooter && <div className="border-t border-border px-4 py-2.5">{stepsFooter}</div>}
      </div>

      {/* ── Concept cards (optional — a tab may teach inside richer sections) ── */}
      {cards && cards.length > 0 && (
        <div>
          {cardsTitle && <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">{cardsTitle}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {cards.map((c) => (
              <div key={c.name} className="rounded-lg border border-border bg-white p-4">
                <p className="font-semibold text-brand-purple">{c.name}</p>
                <p className="mt-1 text-sm text-text-primary">{c.asks}</p>
                <p className="mt-2 text-xs leading-relaxed text-text-muted">{c.measures}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── The honest sample ── */}
      {sample}
      {teachingLine && <p className="text-sm text-text-secondary">{teachingLine}</p>}

      {/* ── CTA ── */}
      {cta}
    </div>
  );
}
