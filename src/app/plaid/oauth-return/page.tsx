'use client';

/**
 * /plaid/oauth-return — Plaid's OAuth return URL (BANK-01c).
 *
 * The link token carried PLAID_REDIRECT_URI; an OAuth institution sends the
 * user back here with `?oauth_state_id=…`. Per Plaid's OAuth guide the page
 * retrieves the link_token kept before Link opened (localStorage, same
 * browser session) and re-opens Link with the SAME token and
 * `receivedRedirectUri` = the full received URL (window.location.href).
 *
 *   onSuccess → 'new'       → /api/plaid/exchange-token (as the cockpit does)
 *             → 'reconnect' → /api/plaid/reconnect-complete (NO exchange — update
 *                              mode keeps the item, its accounts and history)
 *   onExit    → the BANK-01b handling: the reason shown here, the report to
 *               /api/plaid/link-exit, then back to Books with the line.
 *
 * Missing, unknown, or expired kept state is a DECLARED error on this page —
 * never a silent redirect. Not in PUBLIC_PATHS: the middleware requires the
 * signed-in cookie (SameSite=Lax rides the bank's top-level redirect).
 */

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  completeOauthReturn,
  forgetLinkFlow,
  keepReturnOutcome,
  linkReopenConfig,
  planOauthReturn,
  type OauthReturnPlan,
} from '@/lib/plaid/oauth';
import {
  LINK_CANCELLED,
  RECONNECT_CANCELLED,
  linkExitOutcome,
  notLoggedSuffix,
  postLinkExit,
  type LinkExitError,
  type LinkExitMetadata,
} from '@/lib/plaid/linkExit';
// HYG-03: every outcome carries `lines`; a page-built one is the one-line form, like the link-exit notes.
import { syncLine, type SyncOutcome } from '@/lib/plaid/failLoud';

const PLAID_LINK_SCRIPT = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';

type Phase =
  | { kind: 'reading' }
  | { kind: 'error'; message: string }
  | { kind: 'reopening'; plan: Extract<OauthReturnPlan, { kind: 'reopen' }> }
  | { kind: 'done'; outcome: SyncOutcome };

interface PlaidLinkHandler { open(): void }
interface PlaidGlobal { create(config: Record<string, unknown>): PlaidLinkHandler }

const ERROR_CARD = 'rounded-lg border border-status-danger/30 bg-status-danger/10 p-3 text-xs text-status-danger';
const NOTE_CARD = 'rounded-lg border border-border bg-bg-row p-3 text-xs text-text-secondary';

const postJson = (path: string, body: Record<string, unknown>) =>
  fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

function flowLabel(plan: Extract<OauthReturnPlan, { kind: 'reopen' }>): string {
  return plan.flow.kind === 'reconnect' ? `reconnecting ${plan.flow.institution}` : 'linking a new account';
}

export default function PlaidOauthReturnPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ kind: 'reading' });
  const [plaidReady, setPlaidReady] = useState(false);
  const opened = useRef(false);

  // Step 1 — read oauth_state_id and the kept link_token + flow. Declared errors, no redirect.
  useEffect(() => {
    const plan = planOauthReturn(window.location.href, window.localStorage);
    if (plan.kind === 'error') {
      setPhase({ kind: 'error', message: plan.message });
      return;
    }
    setPhase({ kind: 'reopening', plan });
    if ((window as unknown as { Plaid?: PlaidGlobal }).Plaid) setPlaidReady(true);
  }, []);

  // Step 2 — re-open Link with the SAME token and the received URI, once the script is here.
  useEffect(() => {
    if (phase.kind !== 'reopening' || !plaidReady || opened.current) return;
    const plaid = (window as unknown as { Plaid?: PlaidGlobal }).Plaid;
    if (!plaid) return;
    opened.current = true;
    const { plan } = phase;
    const { flow, linkToken } = plan;
    const itemId = flow.kind === 'reconnect' ? flow.itemId : undefined;

    const finish = (outcome: SyncOutcome) => {
      forgetLinkFlow(window.localStorage, linkToken);
      keepReturnOutcome(window.localStorage, { flow, outcome });
      setPhase({ kind: 'done', outcome });
      router.replace('/books');
    };

    plaid.create({
      ...linkReopenConfig(plan),
      onSuccess: async (publicToken: string, metadata: { institution?: { name?: string | null; institution_id?: string | null } | null }) => {
        const { outcome } = await completeOauthReturn(flow, publicToken, metadata, postJson);
        finish(outcome);
      },
      onExit: async (error: LinkExitError | null, metadata: LinkExitMetadata) => {
        const exit = linkExitOutcome(error, metadata ?? {}, flow.kind === 'reconnect' ? RECONNECT_CANCELLED : LINK_CANCELLED, itemId);
        if (exit.kind === 'connected') return;
        if (exit.kind === 'cancelled') {
          finish(syncLine(flow.kind === 'reconnect' ? 'partial' : 'ok', exit.note));
          return;
        }
        const posted = await postLinkExit(exit.report);
        finish(syncLine('error', posted.logged ? exit.note : exit.note + notLoggedSuffix(posted.status)));
      },
    }).open();
  }, [phase, plaidReady, router]);

  return (
    <main className="mx-auto max-w-xl p-6 space-y-4">
      <Script src={PLAID_LINK_SCRIPT} strategy="afterInteractive" onLoad={() => setPlaidReady(true)} onError={() => setPhase({ kind: 'error', message: 'Plaid Link\'s script did not load, so the OAuth return cannot resume. Open Books and start again.' })} />
      <h1 className="font-mono text-[10px] uppercase tracking-wider text-text-secondary">Plaid · OAuth return</h1>

      {phase.kind === 'reading' && <p className={NOTE_CARD} role="status">Reading the return…</p>}

      {phase.kind === 'reopening' && (
        <p className={NOTE_CARD} role="status" data-flow={phase.plan.flow.kind}>
          Resuming Plaid Link — {flowLabel(phase.plan)}. Finish in the Plaid window.
        </p>
      )}

      {phase.kind === 'done' && (
        <p className={phase.outcome.tone === 'error' ? ERROR_CARD : NOTE_CARD} role={phase.outcome.tone === 'error' ? 'alert' : 'status'}>
          {phase.outcome.text} — returning to Books.
        </p>
      )}

      {phase.kind === 'error' && (
        <div className={ERROR_CARD} role="alert" data-oauth-return="error">
          <p>{phase.message}</p>
        </div>
      )}

      <p className="text-xs">
        <Link href="/books" className="underline text-brand-purple">Back to Books</Link>
      </p>
    </main>
  );
}
