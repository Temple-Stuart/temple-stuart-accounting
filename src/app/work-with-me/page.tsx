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
const REFERRAL_SOURCES = ['Reddit', 'Instagram', 'TikTok', 'X', 'YouTube', 'Referral', 'Other'] as const;

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
  const [otherModuleText, setOtherModuleText] = useState('');
  // FORM-V2: the detail block is EXPANDED BY DEFAULT (collapse still works,
  // aria kept — the DISCLOSURE precedent's mechanics, inverted default).
  const [moreOpen, setMoreOpen] = useState(true);
  const [hardDeadline, setHardDeadline] = useState('');
  const [noDeadline, setNoDeadline] = useState(false);
  const [deadlineDriver, setDeadlineDriver] = useState('');
  const [linkRows, setLinkRows] = useState<string[]>(['']);
  const [teamSize, setTeamSize] = useState<string | null>(null);
  const [referralSource, setReferralSource] = useState<string | null>(null);
  const [referralDetail, setReferralDetail] = useState('');
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
      const links = linkRows.map((l) => l.trim()).filter(Boolean);
      // FORM-V2 assembly — NO new columns. The Other-module description
      // PREPENDS to the done-looks-like answer:
      //   'OTHER MODULE: {text}\n\n' + notes  → notesFromThem
      // and the referral follow-ups fold into the one referral_source string:
      //   base token, or 'referral: {name}' / 'other: {text}'.
      const notesAssembled =
        modules.includes('other') && otherModuleText.trim()
          ? `OTHER MODULE: ${otherModuleText.trim()}\n\n${notes}`
          : notes;
      const referralAssembled =
        referralSource === 'Referral'
          ? `referral: ${referralDetail.trim()}`
          : referralSource === 'Other'
            ? `other: ${referralDetail.trim()}`
            : referralSource;
      const res = await fetch('/api/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          business,
          ...(currentStack.trim() ? { currentStack: currentStack.trim() } : {}),
          need,
          modules,
          startWindow,
          budgetRange,
          notesFromThem: notesAssembled,
          // The exploring toggle means an honest NULL, never a fake date.
          ...(!noDeadline && hardDeadline ? { hardDeadline } : {}),
          ...(deadlineDriver.trim() ? { deadlineDriver: deadlineDriver.trim() } : {}),
          ...(links.length > 0 ? { links } : {}),
          ...(teamSize ? { teamSize } : {}),
          ...(referralAssembled ? { referralSource: referralAssembled } : {}),
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
      <div className={`mx-auto max-w-2xl ${SURFACE.card}`}>
        <div className={SECTION_HEADER}>PROFESSIONAL SERVICES</div>
        <div className="p-4 sm:p-6">
          {/* Lead line REUSED from the deck's Services panel (Landing.tsx). */}
          <p className="text-xs leading-relaxed text-text-muted">
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
                  {"What's your business? (or: it's just for me)"}
                </label>
                <textarea
                  id="p-business"
                  required
                  maxLength={5000}
                  placeholder="e.g. I run a 12-unit property management company in Austin — we collect rent, pay vendors, file 1099s"
                  value={business}
                  onChange={(e) => setBusiness(e.target.value)}
                  className={`${TEXTAREA_CLASS} mt-1`}
                />
                <p className="mt-1 text-xs text-text-faint">One or two sentences: what you do, who pays you.</p>
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
                  {/* FORM-V2: the escape hatch — 'other' rides the modules
                      array (route enum extended); its description prepends to
                      notesFromThem at submit, no new column. */}
                  <button
                    type="button"
                    onClick={() => toggleModule('other')}
                    aria-pressed={modules.includes('other')}
                    className={toggleChip(modules.includes('other'))}
                  >
                    Other
                  </button>
                </div>
                <p className="mt-1 text-xs text-text-faint">
                  {"Pick Other if you need something custom-built that isn't listed."}
                </p>
                {modules.includes('other') && (
                  <div className="mt-3">
                    <label htmlFor="p-other-module" className={CONTROL.label}>
                      What is it?
                    </label>
                    <textarea
                      id="p-other-module"
                      required
                      maxLength={1900}
                      placeholder="Describe what you need built."
                      value={otherModuleText}
                      onChange={(e) => setOtherModuleText(e.target.value)}
                      className={`${TEXTAREA_CLASS} mt-1`}
                    />
                  </div>
                )}
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
                  What does done look like?
                </label>
                <textarea
                  id="p-notes"
                  required
                  maxLength={3000}
                  placeholder="e.g. By March I can see all my rentals' income in one dashboard and my CPA gets a clean export."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={`${TEXTAREA_CLASS} mt-1`}
                />
                <p className="mt-1 text-xs text-text-faint">
                  {"Describe the finish line — what's true when this project is done?"}
                </p>
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
                  className="font-mono text-xs text-text-muted underline decoration-border hover:text-text-primary"
                >
                  Project details
                </button>
                {moreOpen && (
                  <div className="mt-4 flex flex-col gap-5 rounded bg-bg-row p-4">
                    <div>
                      <label htmlFor="p-stack" className={CONTROL.label}>
                        What tools do you use today? (optional)
                      </label>
                      <textarea
                        id="p-stack"
                        maxLength={5000}
                        placeholder="e.g. QuickBooks, Excel, Shopify, a custom site"
                        value={currentStack}
                        onChange={(e) => setCurrentStack(e.target.value)}
                        className={`${TEXTAREA_CLASS} mt-1`}
                      />
                      <p className="mt-1 text-xs text-text-faint">
                        {"The apps your business runs on. 'None / spreadsheets' is a real answer."}
                      </p>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                      <div>
                        <label htmlFor="p-deadline" className={CONTROL.label}>
                          Hard deadline
                        </label>
                        <input
                          id="p-deadline"
                          type="date"
                          disabled={noDeadline}
                          value={hardDeadline}
                          onChange={(e) => setHardDeadline(e.target.value)}
                          className={`${CONTROL.input} mt-1 w-full disabled:opacity-50`}
                        />
                        {/* FORM-V2: exploring = an honest NULL — the toggle
                            clears + disables the date; submit needs one of
                            the two. */}
                        <button
                          type="button"
                          onClick={() =>
                            setNoDeadline((v) => {
                              if (!v) setHardDeadline('');
                              return !v;
                            })
                          }
                          aria-pressed={noDeadline}
                          className={`${toggleChip(noDeadline)} mt-2`}
                        >
                          No deadline — exploring
                        </button>
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
                      <span className={CONTROL.label}>Links</span>
                      {linkRows.map((row, i) => (
                        <div key={i} className="mt-1 flex items-center gap-2">
                          <input
                            type="url"
                            maxLength={500}
                            placeholder="https:// — your site, a Google Doc, a Loom…"
                            value={row}
                            onChange={(e) =>
                              setLinkRows((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))
                            }
                            className={`${CONTROL.input} w-full`}
                          />
                          {linkRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setLinkRows((prev) => prev.filter((_, j) => j !== i))}
                              aria-label="Remove link"
                              className="shrink-0 text-text-faint hover:text-text-primary"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      ))}
                      {linkRows.length < 5 && (
                        <button
                          type="button"
                          onClick={() => setLinkRows((prev) => [...prev, ''])}
                          className={`${CONTROL.ghostButton} mt-2 px-3 py-1 text-xs`}
                        >
                          ＋ Add link
                        </button>
                      )}
                      <p className="mt-1 text-xs text-text-faint">
                        {"Anything that shows what you're working with."}
                      </p>
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
                            onClick={() => {
                              setReferralSource((prev) => (prev === r ? null : r));
                              setReferralDetail('');
                            }}
                            className={SEGMENT.item(referralSource === r)}
                          >
                            {r}
                          </button>
                        ))}
                      </div>
                      {(referralSource === 'Referral' || referralSource === 'Other') && (
                        <div className="mt-3">
                          <label htmlFor="p-referral-detail" className={CONTROL.label}>
                            {referralSource === 'Referral' ? 'Who referred you? (name)' : "Where'd you find me?"}
                          </label>
                          <input
                            id="p-referral-detail"
                            type="text"
                            required
                            maxLength={90}
                            value={referralDetail}
                            onChange={(e) => setReferralDetail(e.target.value)}
                            className={`${CONTROL.input} mt-1 w-full`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {error && <div className={STATE.errorCard}>{error}</div>}

              <div className="flex items-center gap-4">
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    // FORM-V2 client blocks: Other picked needs its description;
                    // the deadline question needs ONE of date/exploring; a
                    // Referral/Other source needs its follow-up.
                    (modules.includes('other') && otherModuleText.trim() === '') ||
                    (!noDeadline && hardDeadline === '') ||
                    ((referralSource === 'Referral' || referralSource === 'Other') &&
                      referralDetail.trim() === '')
                  }
                  className="px-8 py-2 bg-brand-gold text-white font-bold text-sm rounded transition-colors hover:bg-brand-gold/90 whitespace-nowrap disabled:opacity-50"
                >
                  {submitting ? 'Sending…' : 'Send proposal'}
                </button>
                <span className="ml-auto font-mono text-xs italic text-text-faint">Scoped by proposal</span>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
