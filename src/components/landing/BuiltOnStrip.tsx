/**
 * BUILTON-01 (Alex, ruled 2026-10-30 — HOME-04's WHAT IS COMING; PIPELINE-PAGE-01's judgement calls 2, 3 and 6; board K;
 * 2026-11-09) — BUILT ON, MOVED WHOLE.
 *
 * The strip stood at the foot of the home page (src/components/landing/Landing.tsx, under the door to the 14 steps). It
 * renders now under the 14 steps on their own page (src/app/how-it-works/page.tsx), unchanged: every word, every class,
 * the two runs (the second aria-hidden), the two-state mark, the href only when lit, the eslint line over the <img> —
 * and the BUILTON-MARQUEE note below moved with it, word for word.
 *
 * NO DIRECTIVE: no state, no handler, no effect — the motion is CSS only (the ts-marquee keyframes, globals.css) — so
 * it renders on that server page as HTML, with no JavaScript of its own. BUILT_ON comes from the pure leaf,
 * src/lib/builtOnWall.ts.
 */
import { BUILT_ON } from '@/lib/builtOnWall';

type Props = {
  /** PR-ELEV-2d: per logo slug, does public/logos/<slug>.svg exist? SERVER-
   *  computed (page.tsx fs check over BUILT_ON's logo slots). Missing/false
   *  → the text-only card, exactly as before — never a broken <img>.
   *  BUILTON-01 (2026-11-09): moved here from Landing.tsx's Props with the strip — the page that computes it is
   *  src/app/how-it-works/page.tsx now, once, at build. */
  logoAvailability: Record<string, boolean>;
};

export default function BuiltOnStrip({ logoAvailability }: Props) {
  return (
    /* ── BUILTON-MARQUEE: the "Built on" wall's five-category card grid
          became ONE auto-scrolling text-mark strip (professional-site
          style). WORDING LAW (locked): "Built on" / "integrates with"
          ONLY — never "partners", "trusted by", or any endorsement
          framing. CLAIMABILITY RULE unchanged: wired clients only —
          BUILT_ON is the same leaf data, every entry a chip, none
          invented, none dropped. REAL-MARKS: each chip leads with the
          vendor's mark on a mini aubergine plate (the wall's own ground —
          the shipped files are white dark-bg variants, rendered AS-IS,
          never recolored); a missing file renders the letter tile
          (relocated two-state logic, cite at the render). The leaf's
          marks rulings (NEVER-LIGHT / pending slots) still govern which
          files may ever land.
          MECHANICS: CSS-only — the ts-marquee keyframes (globals.css,
          the repo's first) slide a DOUBLED chip run by -50% in 50s;
          hover pauses via animation-play-state; prefers-reduced-motion
          kills the animation and the wrapper becomes a contained
          horizontal scroll (overflow-x-auto). Hard edges — the house has
          no CSS mask precedent (audit-cited), none invented. The second
          run is aria-hidden (screen readers read each vendor once).
          Vercel attribution: kept verbatim per the ruling — with
          text-only chips no Vercel/Next.js image marks render, so the
          line now over-attributes harmlessly (declared). ─────────────── */
    <section className="w-full border-y border-border bg-bg-terminal">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-10">
        <p className="font-mono text-xs lg:text-[10px] font-semibold uppercase tracking-wider text-brand-purple">
          Built on
        </p>
        <p className="text-sm text-text-secondary mt-1">Every tool this platform runs on.</p>
        <div className="group mt-6 overflow-hidden motion-reduce:overflow-x-auto">
          <div className="flex w-max animate-[ts-marquee_50s_linear_infinite] group-hover:[animation-play-state:paused] motion-reduce:animate-none">
            {[0, 1].map((run) => (
              <div key={run} aria-hidden={run === 1 || undefined} className="flex w-max items-center gap-3 pr-3">
                {BUILT_ON.map((e) => {
                  // REAL-MARKS: the old wall's two-state logic RELOCATED
                  // verbatim (271d60b1 Landing.tsx:1125 — lit mark vs
                  // letter tile; :1150 — the Stripe href-when-lit
                  // mandate), not new fallback. The mark plate is the old
                  // wall's own ground, miniaturized: every shipped file is
                  // the white dark-bg variant (builtOnWall.ts drop
                  // convention), so the mark renders AS-IS on aubergine —
                  // never recolored. Letter tile = the old white/80 ink on
                  // the same plate. A file dropped at
                  // public/logos/<slug>.svg lights its chip, zero code.
                  const logoLive = e.logo !== undefined && logoAvailability[e.logo.slug] === true;
                  const chipClass = 'flex items-center gap-2 whitespace-nowrap rounded border border-border bg-white py-1.5 pl-1.5 pr-3 font-mono text-xs';
                  const chipBody = (
                    <>
                      <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded bg-brand-purple px-1.5">
                        {logoLive && e.logo ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={`/logos/${e.logo.slug}.svg`} alt={e.logo.alt} className="h-5 w-auto max-w-[72px] object-contain" />
                        ) : (
                          <span className="text-xs font-semibold leading-none text-white/80">{e.name[0]}</span>
                        )}
                      </span>
                      <span className="font-semibold text-brand-purple">{e.name}</span>
                      <span className="text-text-muted">· {e.tag}</span>
                    </>
                  );
                  return logoLive && e.logo?.href ? (
                    <a
                      key={`${run}-${e.name}`}
                      href={e.logo.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={chipClass}
                    >
                      {chipBody}
                    </a>
                  ) : (
                    <span key={`${run}-${e.name}`} className={chipClass}>
                      {chipBody}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
