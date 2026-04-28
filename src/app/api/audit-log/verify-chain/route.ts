import { NextResponse } from 'next/server';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { verifyAuditChain } from '@/lib/audit/verifyAuditChain';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

export async function POST() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await verifyAuditChain();

    await writeAuditLog({
      actor: {
        email: userEmail,
        type: 'human_user',
      },
      action: {
        type: result.is_valid ? 'ai_verification_passed' : 'ai_verification_failed',
        description: `Audit chain verification: ${result.total_rows} rows, ${result.is_valid ? 'valid' : 'BROKEN'}`,
      },
      target: {
        table: 'audit_log',
      },
      payload: {
        metadata: {
          total_rows: result.total_rows,
          break_point_count: result.break_points.length,
          is_valid: result.is_valid,
        },
      },
    });

    const serialized = {
      ...result,
      break_points: result.break_points.map((bp) => ({
        ...bp,
        sequence_number: bp.sequence_number.toString(),
      })),
    };

    return NextResponse.json(serialized);
  } catch (error) {
    console.error('[Audit Chain Verify]', error);
    return NextResponse.json({ error: 'Chain verification failed' }, { status: 500 });
  }
}
