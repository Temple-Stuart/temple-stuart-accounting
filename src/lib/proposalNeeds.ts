/**
 * ONE-FORM-01 (Alex, 2026-11-06) — THE PROPOSAL FORM'S "WHAT DO YOU NEED?" VOCABULARY, typed once.
 *
 * The proposals table holds the answer to six words, CHECK-enforced in SQL (proposals_need_chk,
 * prisma/migrations/20261106120000_one_form_01_close_need): the five service words, and the close
 * offer's own word from its leaf (src/lib/offer/close.ts — CLOSE_OFFER.need). Before ONE-FORM-01 the
 * five were typed twice (the form's chips and the route's enum); now the route's enum, the form's
 * chips and the home page's doors all read them here. PURE: no fetch, no env, no clock, no React —
 * the one import is the pure leaf.
 *
 *   SERVICE_NEEDS         the five service words, in the form's order;
 *   SERVICE_NEED_LABELS   each one's chip on the form;
 *   PROPOSAL_NEEDS        every word the table holds — the five, then the close's — the route's enum
 *                         (a tuple, so zod's enum takes it as is).
 */

import { CLOSE_OFFER } from './offer/close';

export const SERVICE_NEEDS = ['setup', 'maintenance', 'custom', 'embed', 'unsure'] as const;
export type ServiceNeed = (typeof SERVICE_NEEDS)[number];

export const SERVICE_NEED_LABELS: Readonly<Record<ServiceNeed, string>> = {
  setup: 'Setup',
  maintenance: 'Maintenance',
  custom: 'Custom build',
  embed: 'Embed a module',
  unsure: 'Not sure',
};

/** Every word proposals.need may hold: the five service words, then the close offer's. */
export const PROPOSAL_NEEDS: readonly [string, ...string[]] = [...SERVICE_NEEDS, CLOSE_OFFER.need];
