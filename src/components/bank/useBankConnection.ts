'use client';

/**
 * ACCOUNTS-01 — the ONE bank-connection glue: link a new account, sync, and
 * reconnect an item Plaid has flagged. Extracted VERBATIM from the two places
 * that owned it — the cockpit bar (ModuleLauncher: the link token, Plaid Link,
 * exchange-token, sync-complete) and Books' Source Accounts (BooksPipeline:
 * update-mode Link, reconnect-complete) — so step 1's screen, the cockpit bar
 * and Books' phase all drive the SAME code against the SAME routes.
 *
 * NO new Plaid code and NO new route: every call here already existed
 * (/api/plaid/link-token · /api/plaid/exchange-token · /api/plaid/reconnect-complete ·
 * /api/plaid/link-exit · /api/transactions/sync-complete), and every envelope is
 * read by the shared helpers (readSyncOutcome, linkExitOutcome, postLinkExit,
 * keepLinkFlow / forgetLinkFlow / takeReturnOutcome).
 *
 * Fail-loud, unchanged: a failed or partial sync is SHOWN (never swallowed); a
 * link token with no expiration is refused rather than opened; a Link exit that
 * carries an error is reported to the log and said out loud; a cancel is a plain
 * note, not an error. Nothing here retries and nothing defaults.
 *
 * The caller passes what to re-read after a change; the hook owns no data.
 */
import { useCallback, useEffect, useState } from 'react';
import { readSyncOutcome, syncLine, type SyncOutcome } from '@/lib/plaid/failLoud';
import { LINK_CANCELLED, RECONNECT_CANCELLED, linkExitOutcome, notLoggedSuffix, postLinkExit, type LinkExitError, type LinkExitMetadata } from '@/lib/plaid/linkExit';
import { forgetLinkFlow, keepLinkFlow, takeReturnOutcome } from '@/lib/plaid/oauth';

/** Plaid Link, as the browser exposes it once the CDN script has loaded. */
type PlaidGlobal = { create: (config: Record<string, unknown>) => { open(): void } } | undefined;
const plaidGlobal = (): PlaidGlobal => (window as unknown as { Plaid?: PlaidGlobal }).Plaid;

export interface ReconnectNote {
  itemId: string;
  text: string;
  /** 'note' is BANK-01b's third tone: a plain outcome (a cancel) that is neither ok nor an error. */
  tone: 'ok' | 'error' | 'note';
}

export interface BankConnection {
  /** True once a link token (and its expiration) is in hand — the connect button no-ops until then, never fakes. */
  ready: boolean;
  linkAccount: () => void;
  syncAccounts: () => Promise<void>;
  syncing: boolean;
  /** The declared outcome of the last sync / link — shown, never swallowed. */
  message: SyncOutcome | null;
  setMessage: (m: SyncOutcome | null) => void;
  reconnect: (itemId: string, institution: string) => Promise<void>;
  /** The item whose reconnect is opening, or null. */
  reconnecting: string | null;
  reconnectNote: ReconnectNote | null;
}

export function useBankConnection({ onChanged, enabled = true }: {
  /** Re-read whatever the caller shows, after a link, a sync or a reconnect. */
  onChanged: () => void | Promise<void>;
  /** False while the viewer may not see this surface at all (a locked cockpit tab) — no token is fetched. */
  enabled?: boolean;
}): BankConnection {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linkExpiration, setLinkExpiration] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<SyncOutcome | null>(null);
  const [reconnecting, setReconnecting] = useState<string | null>(null);
  const [reconnectNote, setReconnectNote] = useState<ReconnectNote | null>(null);

  // The link token, and the outcome line an OAuth round trip left behind.
  useEffect(() => {
    if (!enabled) return;
    // BANK-01c: an OAuth round trip that ended on /plaid/oauth-return left its outcome line
    // for this surface (the 'new' flow; a reconnect's line goes to its own row).
    const back = takeReturnOutcome(window.localStorage, 'new');
    if (back) setMessage(back.outcome);
    const backReconnect = takeReturnOutcome(window.localStorage, 'reconnect');
    if (backReconnect && backReconnect.flow.kind === 'reconnect') {
      setReconnectNote({
        itemId: backReconnect.flow.itemId,
        text: backReconnect.outcome.text,
        tone: backReconnect.outcome.tone === 'ok' ? 'ok' : backReconnect.outcome.tone === 'error' ? 'error' : 'note',
      });
    }
    fetch('/api/plaid/link-token', { method: 'POST' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        // BANK-01c: the token is usable only with its expiration — the round-trip entry
        // must expire with it; a token without one is a contract break, not a link.
        if (d?.link_token && typeof d.expiration === 'string') {
          setLinkToken(d.link_token);
          setLinkExpiration(d.expiration);
        }
      })
      .catch(() => { /* no token → linkAccount guards on it, fail-loud (the button no-ops until ready) */ });
  }, [enabled]);

  // POST the auth-gated /api/transactions/sync-complete, then re-read. No auth weakened.
  const syncAccounts = useCallback(async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const res = await fetch('/api/transactions/sync-complete', { method: 'POST' });
      // HYG-01: read the declared outcome — a failed or partial sync is shown, never swallowed.
      setMessage(await readSyncOutcome(res));
      await onChanged();
    } finally {
      setSyncing(false);
    }
  }, [onChanged]);

  // Open Plaid Link with the auth-gated link token; on success POST the auth-gated
  // /api/plaid/exchange-token then re-read. Guards on token + window.Plaid (no fallback).
  const linkAccount = useCallback(() => {
    const plaid = plaidGlobal();
    if (!linkToken || !linkExpiration || !plaid) return;
    // BANK-01c: keep the token + flow for the OAuth return page before Link opens (Plaid's
    // guide: the same link_token must re-open Link after the bank's redirect).
    keepLinkFlow(window.localStorage, { linkToken, flow: { kind: 'new' }, expiresAt: linkExpiration });
    plaid.create({
      token: linkToken,
      onSuccess: async (publicToken: string, metadata: { institution?: { institution_id?: string; name?: string } }) => {
        forgetLinkFlow(window.localStorage, linkToken);
        await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            publicToken,
            institutionId: metadata.institution?.institution_id,
            institutionName: metadata.institution?.name,
            entityId: 'personal',
          }),
        });
        await onChanged();
      },
      // BANK-01b: an error → the line under the bar ("Plaid Link: CODE — message") and the
      // report to the log; a cancel → "Account link cancelled". No itemId: there is no item yet.
      onExit: async (error: LinkExitError | null, metadata: LinkExitMetadata) => {
        forgetLinkFlow(window.localStorage, linkToken);
        const exit = linkExitOutcome(error, metadata ?? {}, LINK_CANCELLED);
        if (exit.kind === 'connected') return;
        if (exit.kind === 'cancelled') {
          setMessage(syncLine('ok', exit.note));
          return;
        }
        setMessage(syncLine('error', exit.note));
        const posted = await postLinkExit(exit.report);
        if (!posted.logged) setMessage(syncLine('error', exit.note + notLoggedSuffix(posted.status)));
      },
    }).open();
  }, [linkToken, linkExpiration, onChanged]);

  // BANK-01: Plaid Link in UPDATE MODE for an existing item. The server mints the
  // update-mode token from the stored (encrypted) access token; the browser sees the link
  // token only. After onSuccess there is NO public-token exchange — reconnect-complete asks
  // /item/get whether the item is healthy and answers with the HYG-01 envelope.
  const reconnect = useCallback(async (itemId: string, institution: string) => {
    const plaid = plaidGlobal();
    if (!plaid) {
      setReconnectNote({ itemId, text: 'Plaid Link has not loaded yet — try again in a moment.', tone: 'error' });
      return;
    }
    setReconnecting(itemId);
    setReconnectNote(null);
    try {
      const res = await fetch('/api/plaid/link-token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId }),
      });
      if (!res.ok) {
        const out = await readSyncOutcome(res);
        setReconnectNote({ itemId, text: out.text, tone: 'error' });
        return;
      }
      const { link_token: token, expiration } = (await res.json()) as { link_token: string; expiration?: unknown };
      if (typeof expiration !== 'string') {
        setReconnectNote({ itemId, text: 'The link token answer carried no expiration — not opening Plaid Link.', tone: 'error' });
        return;
      }
      keepLinkFlow(window.localStorage, { linkToken: token, flow: { kind: 'reconnect', itemId, institution }, expiresAt: expiration });
      plaid.create({
        token,
        onSuccess: async () => {
          forgetLinkFlow(window.localStorage, token);
          const done = await fetch('/api/plaid/reconnect-complete', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ itemId }),
          });
          const out = await readSyncOutcome(done);
          setReconnectNote({ itemId, text: out.text, tone: out.tone === 'ok' ? 'ok' : 'error' });
          await onChanged();
        },
        onExit: async (error: LinkExitError | null, metadata: LinkExitMetadata) => {
          setReconnecting(null);
          forgetLinkFlow(window.localStorage, token);
          const exit = linkExitOutcome(error, metadata ?? {}, RECONNECT_CANCELLED, itemId);
          if (exit.kind === 'connected') return;
          if (exit.kind === 'cancelled') {
            setReconnectNote({ itemId, text: exit.note, tone: 'note' });
            return;
          }
          setReconnectNote({ itemId, text: exit.note, tone: 'error' });
          const posted = await postLinkExit(exit.report);
          if (!posted.logged) setReconnectNote({ itemId, text: exit.note + notLoggedSuffix(posted.status), tone: 'error' });
        },
      }).open();
    } finally {
      setReconnecting(null);
    }
  }, [onChanged]);

  return {
    ready: Boolean(linkToken && linkExpiration),
    linkAccount,
    syncAccounts,
    syncing,
    message,
    setMessage,
    reconnect,
    reconnecting,
    reconnectNote,
  };
}
