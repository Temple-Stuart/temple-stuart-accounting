/**
 * POST-01 (2026-09-26) — THE DOCUMENT GATE. Which booking a bank row's posting
 * documents, decided from the transaction_reservation_links a human reviewed.
 *
 * THE RULING. The only thing that posts to the books is a Plaid transaction. A
 * booking is the SOURCE DOCUMENT of that posting, never a posting of its own. The
 * accept on a link (src/app/api/runway/match/review/route.ts — the ONLY writer of
 * 'accepted') IS the authorization: an accepted link's booking rides onto the
 * posting as its document. A link still 'proposed' is a decision nobody has made,
 * so the batch it sits in is REFUSED before anything posts — a proposed link never
 * posts silently, and never posts without its document.
 *
 * THIS FILE IS PURE. No Prisma, no fetch, no clock. The commit route
 * (src/app/api/transactions/commit-to-ledger/route.ts) reads the user's links for
 * the batch and hands them here BEFORE its posting loop; the retro
 * (scripts/post-01-retro-documents.ts) asks the same question of one transaction.
 *
 * NO FALLBACK. Two accepted links on one transaction is a contradiction this file
 * names and refuses; it never picks one. No link (or only rejected ones) is a
 * posting of no booking: document null, said as such, never guessed.
 */

/** The document a plaid_txn posting carries — pre-validated by this gate, written by commitPlaidTransaction. */
export interface PostingDocument {
  reservationId: string;
  /** NULL = the booking's charge; set = that money event, a refund. */
  moneyEventId: string | null;
}

/** The columns of a transaction_reservation_links row this gate reads. */
export interface GateLink {
  id: string;
  /** transactions.id — the bank row's own id, which the commit body also names. */
  transactionId: string;
  reservationId: string;
  moneyEventId: string | null;
  status: string;
}

export type DocumentDecision =
  | { kind: 'document'; document: PostingDocument; linkId: string }
  | { kind: 'none' }
  | { kind: 'proposed'; linkIds: string[] }
  | { kind: 'many_accepted'; linkIds: string[] };

/** One transaction's document from its links: proposed → refused; exactly one accepted → the document; more → refused; none/rejected → none. */
export function documentFromLinks(links: readonly GateLink[]): DocumentDecision {
  const proposed = links.filter((l) => l.status === 'proposed');
  if (proposed.length > 0) return { kind: 'proposed', linkIds: proposed.map((l) => l.id) };
  const accepted = links.filter((l) => l.status === 'accepted');
  if (accepted.length > 1) return { kind: 'many_accepted', linkIds: accepted.map((l) => l.id) };
  if (accepted.length === 1) {
    const l = accepted[0];
    return { kind: 'document', document: { reservationId: l.reservationId, moneyEventId: l.moneyEventId }, linkId: l.id };
  }
  return { kind: 'none' };
}

export type BatchRefusal = {
  reason: 'proposed' | 'many_accepted';
  transactionIds: string[];
  linkIds: string[];
  /** The words the route answers with, at 409. */
  message: string;
};

export type BatchDecision =
  | { ok: true; documents: ReadonlyMap<string, PostingDocument | null> }
  | { ok: false; refusal: BatchRefusal };

/**
 * The whole batch, before any posting. Every transaction is decided; a single
 * proposed link anywhere refuses the WHOLE batch (nothing posts), and so does a
 * transaction with two accepted links. The map holds one entry per transaction id
 * given, null for a posting of no booking.
 */
export function documentsForBatch(transactionIds: readonly string[], links: readonly GateLink[]): BatchDecision {
  const byTxn = new Map<string, GateLink[]>();
  for (const l of links) {
    const arr = byTxn.get(l.transactionId) ?? [];
    arr.push(l);
    byTxn.set(l.transactionId, arr);
  }
  const documents = new Map<string, PostingDocument | null>();
  const proposedTxns: string[] = [];
  const proposedLinks: string[] = [];
  const manyTxns: string[] = [];
  const manyLinks: string[] = [];
  for (const id of transactionIds) {
    const d = documentFromLinks(byTxn.get(id) ?? []);
    if (d.kind === 'proposed') { proposedTxns.push(id); proposedLinks.push(...d.linkIds); continue; }
    if (d.kind === 'many_accepted') { manyTxns.push(id); manyLinks.push(...d.linkIds); continue; }
    documents.set(id, d.kind === 'document' ? d.document : null);
  }
  if (proposedTxns.length > 0) {
    return {
      ok: false,
      refusal: {
        reason: 'proposed',
        transactionIds: proposedTxns,
        linkIds: proposedLinks,
        message: `POST-01 a proposed booking match is undecided — review it (accept or reject) before committing: transaction${proposedTxns.length === 1 ? '' : 's'} ${proposedTxns.join(', ')} (link${proposedLinks.length === 1 ? '' : 's'} ${proposedLinks.join(', ')}). Nothing was posted.`,
      },
    };
  }
  if (manyTxns.length > 0) {
    return {
      ok: false,
      refusal: {
        reason: 'many_accepted',
        transactionIds: manyTxns,
        linkIds: manyLinks,
        message: `POST-01 more than one accepted booking match on one bank row — a posting documents one booking, and this file never picks: transaction${manyTxns.length === 1 ? '' : 's'} ${manyTxns.join(', ')} (links ${manyLinks.join(', ')}). Nothing was posted.`,
      },
    };
  }
  return { ok: true, documents };
}
