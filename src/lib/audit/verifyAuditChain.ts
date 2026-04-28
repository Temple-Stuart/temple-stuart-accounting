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

    const reconstructed_content = JSON.stringify({
      prev_hash: curr.prev_hash,
      actor_user_id: curr.actor_user_id,
      actor_email: curr.actor_email,
      actor_type: curr.actor_type,
      action_type: curr.action_type,
      action_description: curr.action_description,
      target_table: curr.target_table,
      target_id: curr.target_id,
      payload_before: curr.payload_before,
      payload_after: curr.payload_after,
      payload_metadata: curr.payload_metadata,
      request_id: curr.request_id,
    });
    const expected_hash = createHash('sha256').update(reconstructed_content).digest('hex');

    if (curr.content_hash !== expected_hash) {
      result.is_valid = false;
      result.break_points.push({
        sequence_number: curr.sequence_number,
        expected_hash,
        actual_hash: curr.content_hash,
        reason: `content_hash does not match row content — possible tampering or schema drift`,
      });
    }
  }

  if (result.break_points.length === 0 && result.is_valid) {
    result.notes.push('chain integrity verified — all rows hash-linked correctly');
  }

  return result;
}
