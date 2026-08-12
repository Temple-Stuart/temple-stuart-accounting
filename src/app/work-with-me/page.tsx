'use client';

/**
 * PROPOSAL-FORM: /work-with-me — the public project-proposal intake form.
 * The SOW mailto's structured sibling: same questions (the mailto template's
 * fields, README:63-72 vocabulary), but landing in the proposals table via
 * POST /api/proposals (public BY RULING: DB-write only, rate-limited +
 * honeypot) instead of an email draft. README keeps its mailto — email folks
 * still exist; this page serves everyone else.
 *
 * House shell throughout: SURFACE.page canvas, SURFACE.card panel,
 * SECTION_HEADER bar, CONTROL input family, SEGMENT single-picks, toggleChip
 * multi-pick, STATE.errorCard for failures (success card = errorCard with the
 * success tokens — the CheckoutResultBanner idiom). The optional block rides
 * the DISCLOSURE precedent (CoverageDeclaration.tsx:42,92-93 — useState +
 * aria-expanded button, default collapsed).
 */

import { useState } from 'react';
import { CONTROL, SECTION_HEADER, SEGMENT, STATE, SURFACE, toggleChip } from '@/lib/ds';

// The 9 modules — ids + labels REUSED from Landing.tsx PILLAR_CARDS
// (:241-313), the deck's one module vocabulary. Literals because PILLAR_CARDS
// lives inside the Landing client component; the POST route validates against
// the same 9 ids (api/proposals/route.ts MODULE_IDS) — drift rejects loudly.
const MODULES = [
  { id: 'travel', label: 'Travel' },
  { id: 'runway', label: 'Runway' },
  { id: 'books', label: 'Books' },
  { id: 'trade', label: 'Trade' },
  { id: 'tax', label: 'Tax' },
  { id: 'compliance', label: 'Compliance' },
  { id: 'routines', label: 'Routines' },
  { id: 'projects', label: 'Projects' },
  { id: 'content', label: 'Content' },
] as const;

// Stored values mirror the table's CHECK constraints exactly (the OWNER-DASH
// v2 canonical DDL); display labels derive from the mailto template's own
// vocabulary ('setup / maintenance / custom build / embed a module').
const NEEDS = [
  { value: 'setup', label: 'Setup' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'custom', label: 'Custom build' },
  { value: 'embed', label: 'Embed a module' },
  { value: 'unsure', label: 'Not sure' },
] as const;

const START_WINDOWS = [
  { value: 'now', label: 'Now' },
  { value: '2-4wk', label: '2–4 weeks' },
  { value: '1-3mo', label: '1–3 months' },
  { value: 'exploring', label: 'Exploring' },
] as const;

const BUDGET_RANGES = ['<$2k', '$2–10k', '$10–50k', '$50k+', 'not sure'] as const;
const TEAM_SIZES = ['Just me', '2–10', '11–50', '50+'] as const;
const REFERRAL_SOURCES = ['Reddit', 'X', 'NYT', 'referral', 'other'] as const;

const TEXTAREA_CLASS = `${CONTROL.input} min-h-[72px] w-full resize-y`;

export default function WorkWithMePage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [business, setBusiness] = useState('');
  const [currentStack, setCurrentStack] = useState('');
  const [need, setNeed] = useState<string | null>(null);
  const [modules, setModules] = useState<string[]>([]);
  const [startWindow, setStartWindow] = useState('exploring');
  const [budgetRange, setBudgetRange] = useState('not sure');
  const [notes, setNotes] = useState('');
  // The optional block (collapsed by default — DISCLOSURE precedent).
  const [moreOpen, setMoreOpen] = useState(false);
  const [hardDeadline, setHardDeadline] = useState('');
  const [deadlineDriver, setDeadlineDriver] = useState('');
  const [linksText, setLinksText] = useState('');
  const [teamSize, setTeamSize] = useState<string | null>(null);
  const [referralSource, setReferralSource] = useState<string | null>(null);
  // Honeypot — humans never see or fill this.
  const [website, setWebsite] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleModule = (id: string) =>
    setModules((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const links = linksText
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          business,
          currentStack,
          need,
          modules,
          startWindow,
          budgetRange,
          notesFromThem: notes,
          ...(hardDeadline ? { hardDeadline } : {}),
          ...(deadlineDriver.trim() ? { deadlineDriver: deadlineDriver.trim() } : {}),
          ...(links.length > 0 ? { links } : {}),
          ...(teamSize ? { teamSize } : {}),
          ...(referralSource ? { referralSource } : {}),
          website,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const issues = Array.isArray(data?.issues) ? ` (${data.issues.join('; ')})` : '';
        setError(`${data?.error ?? `Request failed (${res.status})`}${issues}`);
        return;
      }
      setSubmittedEmail(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen ${SURFACE.page} px-4 py-10 lg:px-8`}>
      <div className={`mx-auto max-w-2xl ${SURFACE.card} text-white`}>
        <div className={SECTION_HEADER}>PROFESSIONAL SERVICES</div>
        <div className="p-4 sm:p-6">
          {/* Lead line REUSED from the deck's Services panel (Landing.tsx). */}
          <p className="text-xs leading-relaxed text-white/60">
            Your own hosted copy — every API wired, custom to your business, you own everything.
          </p>

          {submittedEmail ? (
            <div
              role="status"
              className="mt-4 rounded-lg border border-status-success/30 bg-status-success/10 p-3 text-xs text-status-success"
            >
              Got it — I read every one of these myself. You&apos;ll hear from me at {submittedEmail}.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="p-name" className={CONTROL.label}>
                    Name
                  </label>
                  <input
                    id="p-name"
                    type="text"
                    required
                    maxLength={255}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`${CONTROL.input} mt-1 w-full`}
                  />
                </div>
                <div>
                  <label htmlFor="p-email" className={CONTROL.label}>
                    Email
                  </label>
                  <input
                    id="p-email"
                    type="email"
                    required
                    maxLength={255}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${CONTROL.input} mt-1 w-full`}
                  />
                </div>
              </div>

              <div>
                <span className={CONTROL.label}>What do you need?</span>
                <div className={`${SEGMENT.wrap} mt-1 max-w-full flex-wrap`}>
                  {NEEDS.map((n) => (
                    <button
                      key={n.value}
                      type="button"
                      onClick={() => setNeed(n.value)}
                      className={SEGMENT.item(need === n.value)}
                    >
                      {n.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="p-business" className={CONTROL.label}>
                  Your business
                </label>
                <textarea
                  id="p-business"
                  required
                  maxLength={5000}
                  value={business}
                  onChange={(e) => setBusiness(e.target.value)}
                  className={`${TEXTAREA_CLASS} mt-1`}
                />
              </div>

              <div>
                <label htmlFor="p-stack" className={CONTROL.label}>
                  Current stack
                </label>
                <textarea
                  id="p-stack"
                  required
                  maxLength={5000}
                  value={currentStack}
                  onChange={(e) => setCurrentStack(e.target.value)}
                  className={`${TEXTAREA_CLASS} mt-1`}
                />
              </div>

              <div>
                <span className={CONTROL.label}>Which modules interest you</span>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {MODULES.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleModule(m.id)}
                      aria-pressed={modules.includes(m.id)}
                      className={toggleChip(modules.includes(m.id))}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <span className={CONTROL.label}>Timeline</span>
                  <div className={`${SEGMENT.wrap} mt-1 max-w-full flex-wrap`}>
                    {START_WINDOWS.map((w) => (
                      <button
                        key={w.value}
                        type="button"
                        onClick={() => setStartWindow(w.value)}
                        className={SEGMENT.item(startWindow === w.value)}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <span className={CONTROL.label}>Budget range</span>
                  <div className={`${SEGMENT.wrap} mt-1 max-w-full flex-wrap`}>
                    {BUDGET_RANGES.map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => setBudgetRange(b)}
                        className={SEGMENT.item(budgetRange === b)}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="p-notes" className={CONTROL.label}>
                  Anything else
                </label>
                <textarea
                  id="p-notes"
                  maxLength={5000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${TEXTAREA_CLASS} mt-1`}
                />
              </div>

              {/* Honeypot — off-screen, unreachable by keyboard, invisible to
                  screen readers. A filled value marks the submit as a bot. */}
              <div aria-hidden="true" className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
                <label htmlFor="p-website">Website</label>
                <input
                  id="p-website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setMoreOpen((v) => !v)}
                  aria-expanded={moreOpen}
                  className="font-mono text-xs text-white/60 underline decoration-white/30 hover:text-white/80"
                >
                  More detail — optional, helps me scope faster
                </button>
                {moreOpen && (
                  <div className="mt-4 flex flex-col gap-5 rounded bg-white/5 p-4">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="p-deadline" className={CONTROL.label}>
                          Hard deadline
                        </label>
                        <input
                          id="p-deadline"
                          type="date"
                          value={hardDeadline}
                          onChange={(e) => setHardDeadline(e.target.value)}
                          className={`${CONTROL.input} mt-1 w-full`}
                        />
                      </div>
                      <div>
                        <label htmlFor="p-driver" className={CONTROL.label}>
                          What&apos;s driving it?
                        </label>
                        <input
                          id="p-driver"
                          type="text"
                          maxLength={2000}
                          value={deadlineDriver}
                          onChange={(e) => setDeadlineDriver(e.target.value)}
                          className={`${CONTROL.input} mt-1 w-full`}
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor="p-links" className={CONTROL.label}>
                        Links — one URL per line
                      </label>
                      <textarea
                        id="p-links"
                        value={linksText}
                        onChange={(e) => setLinksText(e.target.value)}
                        className={`${TEXTAREA_CLASS} mt-1`}
                      />
                    </div>
                    <div>
                      <span className={CONTROL.label}>Team size</span>
                      <div className={`${SEGMENT.wrap} mt-1 max-w-full flex-wrap`}>
                        {TEAM_SIZES.map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTeamSize((prev) => (prev === t ? null : t))}
                            className={SEGMENT.item(teamSize === t)}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className={CONTROL.label}>How did you find me?</span>
                      <div className={`${SEGMENT.wrap} mt-1 max-w-full flex-wrap`}>
                        {REFERRAL_SOURCES.map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => setReferralSource((prev) => (prev === r ? null : r))}
                            className={SEGMENT.item(referralSource === r)}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {error && <div className={STATE.errorCard}>{error}</div>}

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-8 py-2 ts-cta-gradient text-white font-bold text-sm rounded transition-colors hover:brightness-110 whitespace-nowrap disabled:opacity-50"
                >
                  {submitting ? 'Sending…' : 'Send proposal'}
                </button>
                <span className="ml-auto font-mono text-xs italic text-white/50">Scoped by proposal</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
