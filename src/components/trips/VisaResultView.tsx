/**
 * VisaResultView — PURE, color-coded visa-requirement card (PR-V3).
 *
 * Renders a VisaRequirement (PR-V1 shape, travelBuddyClient.ts:34) from the public
 * /api/travel/visa/check route: the headline rule as a color-coded status badge
 * (the API's per-rule color → a brand-token badge), the destination essentials
 * (capital / currency / passport-validity), a mandatory-registration notice when
 * present, and an "Apply" action linking to the OFFICIAL government/eVisa link
 * FROM THE API (secondary.link → registration.link → embassyUrl) — never a
 * constructed or affiliate URL. Visa data is free public value, so the official
 * link is the honest handoff (the deliberate opposite of the activity
 * affiliate-URL drop).
 *
 * PURE VIEW: props only. NO fetch, NO context, NO data-loading. PR-V4's container
 * does the lookup and feeds `result`/`loading`/`error` down.
 *
 * A "verify with official sources" disclaimer is always shown for a non-empty
 * result — the API is informational, not compliance-grade (their terms require it).
 */

import type { VisaRequirement, VisaRule } from '@/lib/travelBuddyClient';

interface Props {
  result: VisaRequirement | null;
  loading: boolean;
  error: string;
}

/** Map the API's per-rule color (red/blue/green/yellow) → a brand-token badge.
 *  ONLY brand tokens (alpha-compatible) — never the raw API color/hex. Unknown
 *  colors fall back to a neutral token badge. */
function badgeClass(color?: string): string {
  switch ((color || '').toLowerCase()) {
    case 'green':
      return 'bg-brand-green/10 text-brand-green border-brand-green/30';
    case 'red':
      return 'bg-brand-red/10 text-brand-red border-brand-red/30';
    case 'yellow':
      return 'bg-brand-amber/10 text-brand-amber border-brand-amber/30';
    case 'blue':
      return 'bg-brand-purple/10 text-brand-purple border-brand-purple/30';
    default:
      return 'bg-white/10 text-white/70 border-white/20';
  }
}

function StatusBadge({ rule, label }: { rule: VisaRule; label?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-semibold ${badgeClass(rule.color)}`}>
      {label ?? rule.name}
    </span>
  );
}

/** One labelled destination essential — rendered only when the value exists. */
function Essential({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wider text-white/40">{label}</span>
      <span className="text-sm text-white">{value}</span>
    </div>
  );
}

export default function VisaResultView({ result, loading, error }: Props) {
  if (loading) {
    return (
      <div className="rounded-lg border border-panel-border bg-panel-surface p-4" aria-busy="true">
        <div className="h-6 w-40 animate-pulse rounded-full bg-white/10" />
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-white/10" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-panel-border bg-panel-surface p-3 text-sm text-brand-red">
        {error}
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-lg border border-dashed border-panel-border bg-panel-surface p-4 text-center">
        <p className="text-sm font-medium text-white">Check visa requirements</p>
        <p className="mt-1 text-xs text-white/50">
          Pick your passport and where you&apos;re headed to see if you need a visa, how long you can stay, and the official place to apply.
        </p>
      </div>
    );
  }

  const { passport, destination, primary, secondary, mandatoryRegistration } = result;

  // Combined rule line: "Visa on arrival / eVisa". Duration prefers the primary
  // rule, falling back to the secondary when only it carries one.
  const ruleLine = secondary?.name ? `${primary.name} / ${secondary.name}` : primary.name;
  const duration = primary.duration ?? secondary?.duration;

  // "Apply" → the OFFICIAL link FROM THE API only: a bookable/official rule link,
  // else the registration link, else the embassy URL. Never constructed.
  const officialLink = secondary?.link ?? mandatoryRegistration?.link ?? destination.embassyUrl;

  return (
    <div className="rounded-lg border border-panel-border bg-panel-surface">
      <div className="space-y-3 p-4">
        {/* Header: passport → destination */}
        <div>
          <p className="text-xs text-white/50">
            {passport.name} passport → {destination.name}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <StatusBadge rule={primary} label={ruleLine} />
            {duration && (
              <span className="text-sm text-white/70">
                Stay up to <span className="font-semibold text-white">{duration}</span>
              </span>
            )}
          </div>
        </div>

        {/* Destination essentials (each renders only when present) */}
        {(destination.capital || destination.currency || destination.passportValidity) && (
          <div className="grid grid-cols-2 gap-2 border-t border-panel-border pt-3 sm:grid-cols-3">
            <Essential label="Capital" value={destination.capital} />
            <Essential label="Currency" value={destination.currency} />
            <Essential label="Passport valid for" value={destination.passportValidity} />
          </div>
        )}

        {/* Mandatory registration / authorization notice (e.g. eTA, ETIAS) */}
        {mandatoryRegistration && (
          <div className={`rounded-md border p-3 ${badgeClass(mandatoryRegistration.color)}`}>
            <p className="text-sm font-semibold">Required before you go: {mandatoryRegistration.name}</p>
            {mandatoryRegistration.link && (
              <a
                href={mandatoryRegistration.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-xs font-medium underline"
              >
                Official registration site
              </a>
            )}
          </div>
        )}

        {/* Apply → the API's official link (real anchor; only when a link exists) */}
        {officialLink && (
          <a
            href={officialLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded bg-brand-purple px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-purple sm:w-auto"
          >
            Apply / official site
          </a>
        )}

        {/* Required disclaimer — informational, not compliance-grade. */}
        <p className="border-t border-panel-border pt-3 text-xs text-white/40">
          Visa rules change — always confirm with the official embassy/government source before you travel.
        </p>
      </div>
    </div>
  );
}
