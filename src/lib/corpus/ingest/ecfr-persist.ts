/**
 * src/lib/corpus/ingest/ecfr-persist.ts
 *
 * Orchestrated insertion layer. Given a set of ParsedDocument objects
 * for one title, writes them to regulatory_documents and
 * regulatory_document_chunks, supersedes prior versions, and pairs each
 * write with a writeAuditLog entry.
 *
 * This module is the only place inside the ingest pipeline that touches
 * Prisma. Fetch and parse modules are pure.
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.4
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { insertDocument, insertChunk } from '../db';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import type { ParsedDocument, TitleIngestSummary } from './types';

const prisma = new PrismaClient();

/**
 * Compute SHA-256 of a buffer or string.
 */
function sha256(input: Buffer | string): Buffer {
  const data = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return crypto.createHash('sha256').update(data).digest();
}

/**
 * Look up the eCFR source row from regulatory_sources.
 * Throws if not found — registry must be seeded before ingestion runs.
 */
async function getEcfrSourceId(): Promise<string> {
  const source = await prisma.regulatory_sources.findUnique({
    where: { domain: 'ecfr.gov' },
    select: { id: true, is_active: true },
  });

  if (!source) {
    throw new Error(
      'eCFR source row not found in regulatory_sources. ' +
        'Run `npm run seed:regulatory` to populate the registry.'
    );
  }
  if (!source.is_active) {
    throw new Error('eCFR source row exists but is_active=false. Aborting ingest.');
  }

  return source.id;
}

/**
 * Find the most recent version of a citation_key.
 * Returns null if no prior version exists.
 */
async function findCurrentVersion(
  citationKey: string
): Promise<{ id: string; version: number; content_hash: Buffer } | null> {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; version: number; content_hash: Buffer }>
  >`
    SELECT id, version, content_hash
    FROM regulatory_documents
    WHERE citation_key = ${citationKey}
      AND superseded_by IS NULL
    ORDER BY version DESC
    LIMIT 1
  `;
  return rows[0] ?? null;
}

/**
 * Mark a document version as superseded by a new version.
 */
async function markSuperseded(
  oldId: string,
  newId: string
): Promise<void> {
  await prisma.$executeRaw`
    UPDATE regulatory_documents
    SET superseded_by = ${newId}::uuid,
        superseded_at = now()
    WHERE id = ${oldId}::uuid
  `;
}

/**
 * Persist one title's parsed documents.
 *
 * For each ParsedDocument:
 *   1. Compute content_hash from the chunk text
 *   2. If a prior version exists with the same hash, skip (no-op)
 *   3. Otherwise insert new document, insert all chunks, supersede prior
 *   4. Write one audit log entry per document inserted
 *
 * @param documents parsed documents from parseTitleToDocuments()
 * @param titleNumber CFR title number — used in audit log target
 * @param titleName CFR title name — used in audit log description
 * @param rawXml the raw XML bytes for raw_xml column + raw_hash
 * @param ecfrUpToDateAsOf the version anchor from eCFR API
 * @returns counts and outcome for the audit/return summary
 */
export async function persistTitleDocuments(
  documents: ParsedDocument[],
  titleNumber: number,
  titleName: string,
  rawXml: Buffer,
  ecfrUpToDateAsOf: string
): Promise<Pick<TitleIngestSummary, 'documents_inserted' | 'chunks_inserted' | 'documents_superseded'>> {
  const sourceId = await getEcfrSourceId();
  const rawHash = sha256(rawXml);
  const retrievedAt = new Date();
  const publishedDate = new Date(ecfrUpToDateAsOf);

  let documentsInserted = 0;
  let chunksInserted = 0;
  let documentsSuperseded = 0;

  for (const doc of documents) {
    // Compute content_hash from concatenated chunk text — stable across runs.
    const concatenatedText = doc.chunks.map((c) => c.text).join('\n\n');
    const contentHash = sha256(concatenatedText);

    const current = await findCurrentVersion(doc.citation_key);

    // No-op if content hash matches the current version.
    if (current && Buffer.compare(current.content_hash, contentHash) === 0) {
      continue;
    }

    const newVersion = current ? current.version + 1 : 1;
    const stableUri = `urn:cite:cfr:${doc.citation_key}:${ecfrUpToDateAsOf}`;
    const rawStorageUri = `postgres://regulatory_documents#raw_xml`; // bytea-inline for v1

    const inserted = await insertDocument({
      source_id: sourceId,
      doc_type: 'regulation',
      jurisdiction: 'US-FED',
      citation_key: doc.citation_key,
      title: doc.title,
      version: newVersion,
      effective_date: doc.effective_date ? new Date(doc.effective_date) : null,
      published_date: publishedDate,
      retrieved_at: retrievedAt,
      canonical_url: `https://www.ecfr.gov/current/title-${titleNumber}/${doc.citation_key.replace('-CFR-', '/section-')}`,
      stable_uri: stableUri,
      content_hash: contentHash,
      raw_hash: rawHash,
      raw_storage_uri: rawStorageUri,
      raw_xml: rawXml,
      metadata: {
        ...doc.metadata,
        ecfr_up_to_date_as_of: ecfrUpToDateAsOf,
        ingest_pr: 'PR-G',
      },
    });

    for (const chunk of doc.chunks) {
      await insertChunk({
        document_id: inserted.id,
        ordinal: chunk.ordinal,
        structural_path: chunk.structural_path,
        pinpoint: chunk.pinpoint,
        text: chunk.text,
        text_hash: sha256(chunk.text),
        token_count: chunk.token_count,
        embedding_model: 'pending', // populated in PR-J Voyage pipeline
        // embedding intentionally omitted — populated in PR-J
      });
      chunksInserted++;
    }

    documentsInserted++;

    if (current) {
      await markSuperseded(current.id, inserted.id);
      documentsSuperseded++;

      await writeAuditLog({
        actor: { type: 'system_automation' },
        action: {
          type: 'regulatory_document_superseded',
          description: `Prior version superseded: ${doc.citation_key} v${current.version} → v${newVersion}`,
        },
        target: { table: 'regulatory_documents', id: current.id },
        payload: {
          before: { version: current.version, superseded_by: null },
          after: { version: current.version, superseded_by: inserted.id },
          metadata: {
            new_document_id: inserted.id,
            citation_key: doc.citation_key,
          },
        },
      });
    }

    await writeAuditLog({
      actor: { type: 'system_automation' },
      action: {
        type: 'regulatory_document_ingested',
        description: `eCFR document ingested: ${doc.citation_key} v${newVersion}`,
      },
      target: { table: 'regulatory_documents', id: inserted.id },
      payload: {
        after: {
          citation_key: doc.citation_key,
          version: newVersion,
          chunks: doc.chunks.length,
          superseded_prior: !!current,
        },
        metadata: {
          source: 'ecfr.gov',
          title_number: titleNumber,
          title_name: titleName,
          ecfr_up_to_date_as_of: ecfrUpToDateAsOf,
        },
      },
    });
  }

  return {
    documents_inserted: documentsInserted,
    chunks_inserted: chunksInserted,
    documents_superseded: documentsSuperseded,
  };
}
