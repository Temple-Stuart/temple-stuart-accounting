import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma';

export interface ChainVerificationResult {
  total_rows: number;
  verified_at: Date;
  is_valid: boolean;
  break_points: Array<{
    sequence_number: bigint;
    expected_hash: string;
    actual_hash: string;
    reason: string;
  }>;
  notes: string[];
}

export async function verifyAuditChain(): Promise<ChainVerificationResult> {
  const rows = await prisma.audit_log.findMany({
    orderBy: { sequence_number: 'asc' },
  });

  const result: ChainVerificationResult = {
    total_rows: rows.length,
    verified_at: new Date(),
    is_valid: true,
    break_points: [],
    notes: [],
  };

  if (rows.length === 0) {
    result.is_valid = false;
    result.notes.push('audit_log is empty — genesis row missing');
    return result;
  }

  const genesis = rows[0];
  if (genesis.prev_hash !== 'GENESIS') {
    result.is_valid = false;
    result.break_points.push({
      sequence_number: genesis.sequence_number,
      expected_hash: 'GENESIS',
      actual_hash: genesis.prev_hash,
      reason: 'first row prev_hash is not GENESIS',
    });
  }

  const expected_genesis_hash = createHash('sha256')
    .update('TEMPLE_STUART_AUDIT_LOG_GENESIS_v1')
    .digest('hex');

  if (genesis.content_hash !== expected_genesis_hash) {
    result.is_valid = false;
    result.notes.push(
      `genesis content_hash mismatch — expected ${expected_genesis_hash}, got ${genesis.content_hash}`
    );
  }

  let content_verified_count = 0;
  let legacy_linkage_only_count = 0;

  for (let i = 1; i < rows.length; i++) {
    const prev = rows[i - 1];
    const curr = rows[i];

    if (curr.prev_hash !== prev.content_hash) {
      result.is_valid = false;
      result.break_points.push({
        sequence_number: curr.sequence_number,
        expected_hash: prev.content_hash,
        actual_hash: curr.prev_hash,
        reason: `chain broken: row ${curr.sequence_number} prev_hash does not match row ${prev.sequence_number} content_hash`,
      });
    }

    const reconstructed_content = curr.hash_input && curr.hash_input.length > 0
      ? curr.hash_input
      : null;

    if (reconstructed_content !== null) {
      const expected_hash = createHash('sha256').update(reconstructed_content).digest('hex');

      if (curr.content_hash !== expected_hash) {
        result.is_valid = false;
        result.break_points.push({
          sequence_number: curr.sequence_number,
          expected_hash,
          actual_hash: curr.content_hash,
          reason: `content_hash does not match hash_input — possible tampering`,
        });
      } else {
        content_verified_count++;
      }
    } else {
      legacy_linkage_only_count++;
    }
  }

  if (result.is_valid) {
    result.notes.push(
      `chain integrity verified — ${result.total_rows} rows total, ` +
      `${content_verified_count} content-verified, ` +
      `${legacy_linkage_only_count} linkage-only (pre-PR-Audit-Hash-Input legacy rows)`
    );
  }

  return result;
}
