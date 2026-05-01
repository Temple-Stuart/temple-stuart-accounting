/**
 * src/lib/corpus/ingest/irb-persist.ts
 *
 * Orchestrated insertion layer for IRB-published guidance documents.
 *
 * Each IRB issue produces multiple ParsedDocuments (Rev. Rulings,
 * Rev. Procs, Notices, Announcements, etc.). All share the same
 * issue HTML as raw bytes, but each becomes its own row in
 * regulatory_documents with its own citation_key.
 *
 * Mirrors fedreg-persist.ts. Differences:
 *   - source domain: irs.gov
 *   - doc_type: derived from parser-set metadata.doc_type_inferred
 *   - citation_key: REV-RUL-2026-9 form (no agency prefix per arch
 *     doc § 1.5 examples)
 *   - canonical_url: issue HTML URL plus #anchor fragment
 *   - stable_uri: urn:cite:irs:{citation_key}:{issue_id}
 *
 * Reference: docs/architecture/discovery-engine-institutional-grade.md § 1.4
 */

import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { insertDocument, insertChunk } from '../db';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import type { ParsedDocument } from './types';

const prisma = new PrismaClient();

function sha256(input: Buffer | string): Buffer {
  const data = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return crypto.createHash('sha256').update(data).digest();
}

async function getIrsSourceId(): Promise<string> {
  const source = await prisma.regulatory_sources.findUnique({
    where: { domain: 'irs.gov' },
    select: { id: true, is_active: true },
  });

  if (!source) {
    throw new Error(
      'IRS source row not found in regulatory_sources. ' +
        'Run `npm run seed:regulatory` to populate the registry.'
    );
  }
  if (!source.is_active) {
    throw new Error('IRS source row exists but is_active=false. Aborting ingest.');
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

export interface IrbPersistResult {
  documents_inserted: number;
  chunks_inserted: number;
  documents_superseded: number;
  documents_unchanged: number;
}

/**
 * Persist all parsed documents from one IRB issue.
 *
 * @param documents parsed documents from parseIrbIssue()
 * @param issueId IRB issue identifier (e.g. "2026-19")
 * @param htmlUrl per-issue HTML URL (used for canonical_url + anchor)
 * @param rawHtml the full IRB issue HTML bytes (stored per-document
 *                in raw_xml for content-hash auditability)
 * @returns aggregate counts across all documents in the issue
 */
export async function persistIrbDocuments(
  documents: ParsedDocument[],
  issueId: string,
  htmlUrl: string,
  rawHtml: string
): Promise<IrbPersistResult> {
  const sourceId = await getIrsSourceId();
  const rawBuffer = Buffer.from(rawHtml, 'utf-8');
  const rawHash = sha256(rawBuffer);
  const retrievedAt = new Date();

  const result: IrbPersistResult = {
    documents_inserted: 0,
    chunks_inserted: 0,
    documents_superseded: 0,
    documents_unchanged: 0,
  };

  for (const doc of documents) {
    const concatenatedText = doc.chunks.map((c) => c.text).join('\n\n');
    const contentHash = sha256(concatenatedText);

    const current = await findCurrentVersion(doc.citation_key);

    if (current && Buffer.compare(current.content_hash, contentHash) === 0) {
      result.documents_unchanged++;
      continue;
    }

    const newVersion = current ? current.version + 1 : 1;
    const docType = String(doc.metadata.doc_type_inferred ?? 'irs_guidance');
    const publicationDate = String(doc.metadata.irb_publication_date ?? '');
    const stableUri = `urn:cite:irs:${doc.citation_key}:${issueId}`;
    const canonicalUrl = `${htmlUrl}#${doc.metadata.anchor_raw ?? doc.citation_key}`;
    const rawStorageUri = `postgres://regulatory_documents#raw_xml`;

    const inserted = await insertDocument({
      source_id: sourceId,
      doc_type: docType,
      jurisdiction: 'US-FED',
      citation_key: doc.citation_key,
      title: doc.title,
      version: newVersion,
      effective_date: doc.effective_date ? new Date(doc.effective_date) : null,
      published_date: publicationDate ? new Date(publicationDate) : retrievedAt,
      retrieved_at: retrievedAt,
      canonical_url: canonicalUrl,
      stable_uri: stableUri,
      content_hash: contentHash,
      raw_hash: rawHash,
      raw_storage_uri: rawStorageUri,
      raw_xml: rawBuffer,
      metadata: {
        ...doc.metadata,
        ingest_pr: 'PR-J',
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
      result.chunks_inserted++;
    }

    result.documents_inserted++;

    if (current) {
      await markSuperseded(current.id, inserted.id);
      result.documents_superseded++;

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
            irb_issue_id: issueId,
          },
        },
      });
    }

    await writeAuditLog({
      actor: { type: 'system_automation' },
      action: {
        type: 'regulatory_document_ingested',
        description: `IRB document ingested: ${doc.citation_key} v${newVersion} from issue ${issueId}`,
      },
      target: { table: 'regulatory_documents', id: inserted.id },
      payload: {
        after: {
          citation_key: doc.citation_key,
          version: newVersion,
          chunks: doc.chunks.length,
          superseded_prior: !!current,
          doc_type: docType,
        },
        metadata: {
          source: 'irs.gov',
          irb_issue_id: issueId,
          publication_date: publicationDate,
        },
      },
    });
  }

  return result;
}
