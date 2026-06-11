/**
 * ComingSoonSection — a STATIC "coming soon" placeholder for a future public
 * travel surface (PR-T-Placeholders). It matches the live travel sections'
 * header family (the PR-T-Headers style: text-lg font-bold text-brand-purple, a
 * border-t divider, mt-10 pt-8 spacing) + the same gray explainer, plus a subtle
 * "Coming soon" badge so it reads as an intentional promise, not an empty slot.
 *
 * Purely presentational: NO state, NO fetch, NO provider. The whole travel stack
 * (live searches + these placeholders) reads as one matched set.
 */

interface Props {
  /** Feature name shown as the bold purple header (the "Coming soon" badge sits
   *  beside it — so the title itself stays a clean feature name, not "X — coming
   *  soon"). */
  title: string;
  /** One plain-language line describing what this surface will do. */
  explainer: string;
}

export default function ComingSoonSection({ title, explainer }: Props) {
  return (
    <div className="mt-10 pt-8 border-t border-border">
      <div className="mb-1 flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-lg font-bold text-brand-purple">{title}</p>
        <span className="inline-flex items-center rounded-full bg-bg-row px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          Coming soon
        </span>
      </div>
      <p className="text-xs text-text-muted">{explainer}</p>
    </div>
  );
}
