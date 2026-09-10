import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as React from 'react';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
Object.assign(globalThis, { React });
import RoomLock, { LockedNote } from '@/components/shell/RoomLock';
import { isTabLocked } from '../categoryLock';

// LOCK-01 — a locked step shows its ROOM, not a sales pitch, and every paid
// surface asks for its key.

const src = (f: string) => readFileSync(`${process.cwd()}/${f}`, 'utf8');

test('an unentitled viewer on /dashboard/tax-filing gets the locked room — the wizard is wrapped, never bare', () => {
  const page = src('src/app/dashboard/tax-filing/page.tsx');
  // The leak: this page mounted TaxFilingWizard with no check at all.
  assert.match(page, /roomGate\('tab:tax'\)/, 'it asks the Tax tab\'s own question');
  assert.match(page, /<RoomLock locked=\{locked\}/, 'and the answer wraps the room');
  // The wizard is INSIDE the lock, not beside it.
  const lockAt = page.indexOf('<RoomLock');
  const wizardAt = page.indexOf('<TaxFilingWizard');
  const closeAt = page.indexOf('</RoomLock>');
  assert.ok(lockAt < wizardAt && wizardAt < closeAt, 'the wizard renders inside RoomLock');
});

test('a locked room renders its children in full, frozen, with one note and no offer', () => {
  const html = renderToStaticMarkup(
    createElement(RoomLock, { locked: true, stepName: 'Accounts' },
      createElement('button', { 'data-connect': true }, '+ Connect an account')),
  );
  // The ROOM is there — a locked viewer sees the product.
  assert.match(html, /\+ Connect an account/, 'the room renders in full');
  assert.match(html, /data-room-locked="true"/);
  // Frozen: the subtree is inert, so nothing inside can be clicked or focused.
  assert.match(html, /aria-label="Locked — read-only"/);
  // ONE note, ONE link, and nothing that sells.
  assert.match(html, /data-locked-note/);
  assert.match(html, /\/pricing/);
  assert.equal((html.match(/\/pricing/g) ?? []).length, 1, 'one unlock link, not a card of them');
  for (const pitch of ['BILLED MONTHLY', 'CANCEL ANYTIME', 'Billed monthly', 'Not for sale yet', 'Subscribe', '$']) {
    assert.ok(!html.includes(pitch), `a locked room must not print "${pitch}"`);
  }
});

test('an UNLOCKED room is untouched — no note, no wrapper behaviour', () => {
  const html = renderToStaticMarkup(
    createElement(RoomLock, { locked: false, stepName: 'Accounts' },
      createElement('button', null, 'Sync')),
  );
  assert.match(html, /Sync/);
  assert.doesNotMatch(html, /data-room-locked/);
  assert.doesNotMatch(html, /data-locked-note/);
  assert.doesNotMatch(html, /\/pricing/);
});

test('an unentitled viewer on /accounts sees the accounts ROOM — its empty state — and no offer card', () => {
  const client = src('src/components/accounts/AccountsClient.tsx');
  // The room renders for a locked viewer, wrapped — not replaced by a card.
  assert.match(client, /<RoomLock locked=\{state === 'locked'\}/);
  assert.ok(!/<LockedTabCard/.test(client), 'no offer card inside the app');
  // Connect and Sync still RENDER (frozen by the wrapper), so the room is the room.
  assert.match(client, /data-connect/);
  assert.match(client, /data-sync\b/);
  // A 403 shows the EMPTY state, never an error and never an HTTP status.
  assert.match(client, /const shown = state === 'ok' \|\| state === 'locked';/);
  assert.match(client, /\{shown && \(/);
  const at403 = client.indexOf("if (res.status === 403)");
  assert.ok(at403 > 0, 'a 403 is caught before the error path');
  assert.ok(at403 < client.indexOf('setFailure(`HTTP ${res.status}'), 'and returns before any HTTP status is stored');
});

test('the lapse line survived the offer card — a lapsed subscriber still reads when and why', () => {
  const html = renderToStaticMarkup(
    createElement(LockedNote, { stepName: 'Books', lapsed: { endedAt: '2026-08-01T00:00:00.000Z', reason: 'canceled' } }),
  );
  assert.match(html, /data-lapsed="canceled"/);
  assert.match(html, /\/pricing/);
});

test('the two gate twins ask the same question — keysGranting decides both', () => {
  // The client twin the tabs use. Books grants Trade, Tax and Compliance.
  assert.equal(isTabLocked('tab:tax', ['tab:books'], false), false, 'a Books key opens Tax');
  assert.equal(isTabLocked('tab:tax', [], false), true, 'no key, no entry');
  assert.equal(isTabLocked('tab:tax', [], true), false, 'the server said admin');
  // And the pages use one of the two twins — the law checks this, the census pins it.
  for (const [page, mark] of [
    ['src/app/dashboard/tax-filing/page.tsx', /roomGate\('tab:tax'\)/],
    ['src/app/trading/page.tsx', /useTabLock\('tab:trade'\)/],
    ['src/app/chart-of-accounts/page.tsx', /useTabLock\('tab:books'\)/],
    // /compliance is a SERVER component, so it uses the server twin.
    ['src/app/compliance/page.tsx', /roomGate\('tab:compliance'\)/],
  ] as const) {
    assert.match(src(page), mark, `${page} asks for its key`);
  }
});
