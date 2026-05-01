/**
 * src/lib/corpus/ingest/uscode-persist.ts
 *
 * Orchestrated insertion layer for U.S. Code documents. Given a set
 * of ParsedDocument objects from one title, writes them to
 * regulatory_documents and regulatory_document_chunks, supersedes
 * prior versions, and pairs each write with a writeAuditLog entry.
 *
 * This module is the only place inside the USC pipeline that touches
 * Prisma. Fetch and parse modules are pure.
 *
 * Mirrors ecfr-persist.ts; differences:
 *   - source domain: uscode.house.gov
 *   - doc_type: statute (eCFR uses regulation)
 *   - citation_key: NN-USC-NNN format
 *   - canonical_url: uscode.house.gov per-section URL
 *   - stable_uri: urn:cite:usc:NN-USC-NNN:date
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.4
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { insertDocument, insertChunk } from '../db';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import type { ParsedDocument, TitleIngestSummary } from './types';

const prisma = new PrismaClient();

function sha256(input: Buffer | string): Buffer {
  const data = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return crypto.createHash('sha256').update(data).digest();
}

async function getUscodeSourceId(): Promise<string> {
  const source = await prisma.regulatory_sources.findUnique({
    where: { domain: 'uscode.house.gov' },
    select: { id: true, is_active: true },
  });

  if (!source) {
    throw new Error(
      'USC source row not found in regulatory_sources. ' +
        'Run `npm run seed:regulatory` to populate the registry.'
    );
  }
  if (!source.is_active) {
    throw new Error('USC source row exists but is_active=false. Aborting ingest.');
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

async function markSuperseded(oldId: string, newId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE regulatory_documents
    SET superseded_by = ${newId}::uuid,
        superseded_at = now()
    WHERE id = ${oldId}::uuid
  `;
}

/**
 * Persist one title's parsed USC documents.
 *
 * @param documents parsed documents from parseUscTitleToDocuments()
 * @param titleNumber USC title number
 * @param titleName USC title name (for audit log description)
 * @param rawXml the raw XML bytes for raw_xml column + raw_hash
 * @param effectiveDate the Last-Modified date this XML represents
 * @returns counts and outcome for the audit/return summary
 */
export async function persistUscTitleDocuments(
  documents: ParsedDocument[],
  titleNumber: number,
  titleName: string,
  rawXml: Buffer,
  effectiveDate: string
): Promise<Pick<TitleIngestSummary, 'documents_inserted' | 'chunks_inserted' | 'documents_superseded'>> {
  const sourceId = await getUscodeSourceId();
  const rawHash = sha256(rawXml);
  const retrievedAt = new Date();
  const publishedDate = new Date(effectiveDate);

  let documentsInserted = 0;
  let chunksInserted = 0;
  let documentsSuperseded = 0;

  for (const doc of documents) {
    const concatenatedText = doc.chunks.map((c) => c.text).join('\n\n');
    const contentHash = sha256(concatenatedText);

    const current = await findCurrentVersion(doc.citation_key);

    if (current && Buffer.compare(current.content_hash, contentHash) === 0) {
      continue;
    }

    const newVersion = current ? current.version + 1 : 1;
    const stableUri = `urn:cite:usc:${doc.citation_key}:${effectiveDate}`;
    const sectionId = String(doc.metadata.section_id ?? '');
    const canonicalUrl = sectionId
      ? `https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title${titleNumber}-section${sectionId}`
      : `https://uscode.house.gov/`;
    const rawStorageUri = `postgres://regulatory_documents#raw_xml`;

    const inserted = await insertDocument({
      source_id: sourceId,
      doc_type: 'statute',
      jurisdiction: 'US-FED',
      citation_key: doc.citation_key,
      title: doc.title,
      version: newVersion,
      effective_date: doc.effective_date ? new Date(doc.effective_date) : null,
      published_date: publishedDate,
      retrieved_at: retrievedAt,
      canonical_url: canonicalUrl,
      stable_uri: stableUri,
      content_hash: contentHash,
      raw_hash: rawHash,
      raw_storage_uri: rawStorageUri,
      raw_xml: rawXml,
      metadata: {
        ...doc.metadata,
        ingest_pr: 'PR-H',
        last_modified: effectiveDate,
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
        embedding_model: 'pending',
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
        description: `USC document ingested: ${doc.citation_key} v${newVersion}`,
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
          source: 'uscode.house.gov',
          title_number: titleNumber,
          title_name: titleName,
          last_modified: effectiveDate,
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
