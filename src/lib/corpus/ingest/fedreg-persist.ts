/**
 * src/lib/corpus/ingest/fedreg-persist.ts
 *
 * Orchestrated insertion layer for Federal Register documents. Given
 * a ParsedDocument plus its raw text bytes and original detail
 * response, writes the document and chunks to the corpus, supersedes
 * any prior version, and pairs each write with a writeAuditLog entry.
 *
 * Mirrors ecfr-persist.ts. Differences:
 *   - source domain: federalregister.gov
 *   - doc_type: per-document via mapFedregTypeToDocType
 *   - citation_key: FR-{document_number}
 *   - stable_uri: urn:cite:fr:{document_number}:{publication_date}
 *   - raw bytes: UTF-8 plain text from raw_text_url (no XML)
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.4
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { insertDocument, insertChunk } from '../db';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import type { ParsedDocument } from './types';
import type { FedregDocumentDetail } from './fedreg-fetch';
import { mapFedregTypeToDocType } from './fedreg-parse';

const prisma = new PrismaClient();

function sha256(input: Buffer | string): Buffer {
  const data = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return crypto.createHash('sha256').update(data).digest();
}

async function getFedregSourceId(): Promise<string> {
  const source = await prisma.regulatory_sources.findUnique({
    where: { domain: 'federalregister.gov' },
    select: { id: true, is_active: true },
  });

  if (!source) {
    throw new Error(
      'Federal Register source row not found in regulatory_sources. ' +
        'Run `npm run seed:regulatory` to populate the registry.'
    );
  }
  if (!source.is_active) {
    throw new Error(
      'Federal Register source row exists but is_active=false. Aborting ingest.'
    );
  }

  return source.id;
}

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

export interface FedregPersistResult {
  documents_inserted: number;
  chunks_inserted: number;
  documents_superseded: number;
  documents_unchanged: number;
}

/**
 * Persist one FR document into the corpus.
 *
 * @param parsed the ParsedDocument from parseFedregDocument
 * @param detail the original FR detail JSON (for doc_type mapping)
 * @param rawText the raw UTF-8 text body
 * @returns counts for the run summary
 */
export async function persistFedregDocument(
  parsed: ParsedDocument,
  detail: FedregDocumentDetail,
  rawText: string
): Promise<FedregPersistResult> {
  const sourceId = await getFedregSourceId();
  const rawBuffer = Buffer.from(rawText, 'utf-8');
  const rawHash = sha256(rawBuffer);
  const retrievedAt = new Date();

  const result: FedregPersistResult = {
    documents_inserted: 0,
    chunks_inserted: 0,
    documents_superseded: 0,
    documents_unchanged: 0,
  };

  const concatenatedText = parsed.chunks.map((c) => c.text).join('\n\n');
  const contentHash = sha256(concatenatedText);

  const current = await findCurrentVersion(parsed.citation_key);

  if (current && Buffer.compare(current.content_hash, contentHash) === 0) {
    result.documents_unchanged = 1;
    return result;
  }

  const newVersion = current ? current.version + 1 : 1;
  const docType = mapFedregTypeToDocType(detail.type);
  const stableUri = `urn:cite:fr:${detail.document_number}:${detail.publication_date}`;
  const rawStorageUri = `postgres://regulatory_documents#raw_xml`;

  const inserted = await insertDocument({
    source_id: sourceId,
    doc_type: docType,
    jurisdiction: 'US-FED',
    citation_key: parsed.citation_key,
    title: parsed.title,
    version: newVersion,
    effective_date: parsed.effective_date ? new Date(parsed.effective_date) : null,
    published_date: new Date(detail.publication_date),
    retrieved_at: retrievedAt,
    canonical_url: detail.html_url,
    stable_uri: stableUri,
    content_hash: contentHash,
    raw_hash: rawHash,
    raw_storage_uri: rawStorageUri,
    raw_xml: rawBuffer,
    metadata: {
      ...parsed.metadata,
      ingest_pr: 'PR-I',
    },
  });

  for (const chunk of parsed.chunks) {
    await insertChunk({
      document_id: inserted.id,
      ordinal: chunk.ordinal,
      structural_path: chunk.structural_path,
      pinpoint: chunk.pinpoint,
      text: chunk.text,
      text_hash: sha256(chunk.text),
      token_count: chunk.token_count,
      embedding_model: 'pending',
    });
    result.chunks_inserted++;
  }

  result.documents_inserted = 1;

  if (current) {
    await markSuperseded(current.id, inserted.id);
    result.documents_superseded = 1;

    await writeAuditLog({
      actor: { type: 'system_automation' },
      action: {
        type: 'regulatory_document_superseded',
        description: `Prior version superseded: ${parsed.citation_key} v${current.version} → v${newVersion}`,
      },
      target: { table: 'regulatory_documents', id: current.id },
      payload: {
        before: { version: current.version, superseded_by: null },
        after: { version: current.version, superseded_by: inserted.id },
        metadata: {
          new_document_id: inserted.id,
          citation_key: parsed.citation_key,
        },
      },
    });
  }

  await writeAuditLog({
    actor: { type: 'system_automation' },
    action: {
      type: 'regulatory_document_ingested',
      description: `FR document ingested: ${parsed.citation_key} v${newVersion} (${detail.type})`,
    },
    target: { table: 'regulatory_documents', id: inserted.id },
    payload: {
      after: {
        citation_key: parsed.citation_key,
        version: newVersion,
        chunks: parsed.chunks.length,
        superseded_prior: !!current,
        doc_type: docType,
      },
      metadata: {
        source: 'federalregister.gov',
        fr_type: detail.type,
        publication_date: detail.publication_date,
      },
    },
  });

  return result;
}
