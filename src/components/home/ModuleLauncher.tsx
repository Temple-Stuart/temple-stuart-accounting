'use client';

import { useState, useEffect } from 'react';
import CreateTripForm from '@/components/trips/CreateTripForm';

// HOME-PR-1: the home-page module launcher. A pill row (Travel + 5 paid stubs)
// over the selected module's card. Travel is LIVE + free + guest-usable (the
// shared CreateTripForm; saving is register-gated). The 5 paid modules are stubs
// that prompt sign-in / "coming soon". Pills match the trip-type pill style
// (budgets/trips/page.tsx:313-326).

interface ModuleDef {
  key: string;
  label: string;
  live: boolean;
  blurb: string;
}

const MODULES: ModuleDef[] = [
  { key: 'travel',     label: 'Travel',     live: true,  blurb: 'AI trip & flight planning — free to use.' },
  { key: 'bookkeeping', label: 'Bookkeeping', live: false, blurb: 'GAAP accounting engine, Plaid bank sync, period close.' },
  { key: 'tax',        label: 'Tax',        live: false, blurb: 'Form 1040, Schedule C/D/SE, Form 8949.' },
  { key: 'trading',    label: 'Trading',    live: false, blurb: 'AI vol scanner + options strategy builder.' },
  { key: 'operations', label: 'Operations', live: false, blurb: 'Routines, daily plan, command center.' },
  { key: 'compliance', label: 'Compliance', live: false, blurb: 'Monitoring, attestations, audit trail.' },
];

interface Props {
  /** Opens the existing register/login modal on the home page. Called when a
   *  guest tries to save a trip, or selects a paid module's CTA. */
  onRequireAuth: () => void;
}

export default function ModuleLauncher({ onRequireAuth }: Props) {
  const [active, setActive] = useState('travel');
  // Auth state: null = unknown (initial), true/false once /api/auth/me resolves.
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me')
      .then(res => { if (!cancelled) setAuthed(res.ok); })
      .catch(() => { if (!cancelled) setAuthed(false); });
    return () => { cancelled = true; };
  }, []);

  const activeMod = MODULES.find(m => m.key === active) || MODULES[0];

  // Travel register-gate: guests fill the form freely, but "Create trip" while
  // unauthenticated opens the register modal instead of POSTing. Returns true
  // ("handled — don't POST") for guests. POST /api/trips is unchanged.
  const gateGuestCreate = (): boolean => {
    if (authed === false) {
      onRequireAuth();
      return true;
    }
    return false; // authed (or unknown→optimistic): let CreateTripForm POST; a
                  // 401 there surfaces as its inline error (fail-loud).
  };

  return (
    <section className="py-10 bg-bg-terminal">
      <div className="max-w-7xl mx-auto px-4 lg:px-8">
        <div className="mb-4">
          <div className="text-[10px] text-text-muted uppercase tracking-wider mb-1">Start here</div>
          <h2 className="text-sm font-light text-text-primary">Launch a module</h2>
        </div>

        {/* Pill row — matches the trip-type pill style. */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {MODULES.map(m => (
            <button
              key={m.key}
              type="button"
              onClick={() => setActive(m.key)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                active === m.key
                  ? 'bg-brand-purple text-white border-brand-purple'
                  : 'bg-white text-text-secondary border-border hover:bg-bg-row'
              }`}
            >
              {m.label}
              {!m.live && (
                <span className="ml-1.5 text-[9px] uppercase tracking-wider opacity-70">Paid</span>
              )}
            </button>
          ))}
        </div>

        {/* Selected module's card. */}
        {activeMod.live ? (
          // Travel — the shared create-trip card. Guests can fill it; saving is
          // register-gated via gateGuestCreate.
          <CreateTripForm onUnauthenticated={gateGuestCreate} />
        ) : (
          // Paid module stub.
          <div className="rounded-lg overflow-hidden border border-gray-200/50 shadow-sm mb-4">
            <div className="bg-brand-purple/80 text-white px-4 py-2.5 text-sm font-semibold">
              {activeMod.label}
            </div>
            <div className="bg-white p-6">
              <p className="text-sm text-text-primary mb-1">{activeMod.label} — coming soon.</p>
              <p className="text-xs text-text-muted mb-4">{activeMod.blurb} Requires an account.</p>
              <button
                type="button"
                onClick={onRequireAuth}
                className="px-6 py-2 bg-brand-gold hover:bg-brand-gold-bright text-white font-semibold text-sm rounded"
              >
                Sign in to get started
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
