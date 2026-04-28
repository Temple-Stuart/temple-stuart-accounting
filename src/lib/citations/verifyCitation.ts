import { createHash } from 'crypto';
import { citations, VerificationCheckResult } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export interface VerificationResult {
  citation_id: string;
  ran_at: Date;
  checks: {
    existence: VerificationCheckResult;
    currency: VerificationCheckResult;
    groundedness: VerificationCheckResult;
    pinpoint: VerificationCheckResult;
    supersession: VerificationCheckResult;
    jurisdiction_match: VerificationCheckResult;
    source_authority_match: VerificationCheckResult;
    content_hash: VerificationCheckResult;
  };
  overall_status: 'verified' | 'failed' | 'partial';
  notes: string[];
}

const HTTP_TIMEOUT_MS = 10_000;

async function checkExistence(url: string): Promise<{ result: VerificationCheckResult; note?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
    if (res.status === 200 || res.status === 301 || res.status === 302) {
      return { result: 'passed' };
    }
    if (res.status === 404 || res.status === 410) {
      return { result: 'failed', note: `Existence check: HTTP ${res.status}` };
    }
    return { result: 'error', note: `Existence check: unexpected HTTP ${res.status}` };
  } catch (err) {
    return { result: 'error', note: `Existence check: ${err instanceof Error ? err.message : 'network error'}` };
  } finally {
    clearTimeout(timeout);
  }
}

function checkCurrency(citation: citations): { result: VerificationCheckResult; note?: string } {
  if (citation.superseded_by_citation_id) {
    return { result: 'failed', note: 'Currency check: citation has been superseded' };
  }
  if (!citation.effective_date) {
    return { result: 'failed', note: 'Currency check: no effective_date set' };
  }
  return { result: 'passed' };
}

function checkPinpoint(citation: citations): { result: VerificationCheckResult; note?: string } {
  if (!citation.pinpoint || citation.pinpoint.trim() === '') {
    return { result: 'not_applicable' };
  }
  return { result: 'passed' };
}

function checkSupersession(citation: citations): { result: VerificationCheckResult; note?: string } {
  if (!citation.superseded_by_citation_id) {
    return { result: 'passed' };
  }
  return { result: 'failed', note: 'Supersession check: citation has a superseding reference' };
}

async function checkSourceAuthorityMatch(sourceId: string): Promise<{ result: VerificationCheckResult; note?: string }> {
  const source = await prisma.regulatory_sources.findUnique({ where: { id: sourceId } });
  if (!source) {
    return { result: 'error', note: 'Source authority check: regulatory source not found' };
  }
  if (source.is_active) {
    return { result: 'passed' };
  }
  return { result: 'failed', note: 'Source authority check: regulatory source is inactive' };
}

async function checkContentHash(url: string, expectedHash: string): Promise<{ result: VerificationCheckResult; note?: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HTTP_TIMEOUT_MS);
  try {
    const res = await fetch(url, { method: 'GET', signal: controller.signal, redirect: 'follow' });
    if (!res.ok) {
      return { result: 'error', note: `Content hash check: HTTP ${res.status}` };
    }
    const body = await res.text();
    const hash = createHash('sha256').update(body).digest('hex');
    if (hash === expectedHash) {
      return { result: 'passed' };
    }
    return { result: 'failed', note: 'Content hash check: hash mismatch — content may have changed' };
  } catch (err) {
    return { result: 'error', note: `Content hash check: ${err instanceof Error ? err.message : 'network error'}` };
  } finally {
    clearTimeout(timeout);
  }
}

export async function verifyCitation(citation: citations): Promise<VerificationResult> {
  const notes: string[] = [];
  const ran_at = new Date();

  const [existence, sourceAuthority, contentHash] = await Promise.all([
    checkExistence(citation.retrieved_url),
    checkSourceAuthorityMatch(citation.regulatory_source_id),
    checkContentHash(citation.retrieved_url, citation.retrieved_content_hash),
  ]);

  const currency = checkCurrency(citation);
  const pinpoint = checkPinpoint(citation);
  const supersession = checkSupersession(citation);

  const checks = {
    existence: existence.result,
    currency: currency.result,
    groundedness: 'not_applicable' as VerificationCheckResult,
    pinpoint: pinpoint.result,
    supersession: supersession.result,
    jurisdiction_match: 'not_applicable' as VerificationCheckResult,
    source_authority_match: sourceAuthority.result,
    content_hash: contentHash.result,
  };

  for (const r of [existence, currency, pinpoint, supersession, sourceAuthority, contentHash]) {
    if (r.note) notes.push(r.note);
  }
  notes.push('Groundedness check: deferred to PR-E (requires AI text analysis)');
  notes.push('Jurisdiction match check: deferred to PR-E (requires task context)');

  const implementedChecks = [
    checks.existence,
    checks.currency,
    checks.pinpoint,
    checks.supersession,
    checks.source_authority_match,
    checks.content_hash,
  ].filter((c) => c !== 'not_applicable');

  let overall_status: 'verified' | 'failed' | 'partial';
  if (implementedChecks.length === 0) {
    overall_status = 'partial';
  } else if (implementedChecks.every((c) => c === 'passed')) {
    overall_status = 'verified';
  } else if (implementedChecks.some((c) => c === 'passed')) {
    overall_status = 'partial';
  } else {
    overall_status = 'failed';
  }

  return {
    citation_id: citation.id,
    ran_at,
    checks,
    overall_status,
    notes,
  };
}
