import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { isAdminUser } from '@/lib/admin';
import { verifyAuditChain } from '@/lib/audit/verifyAuditChain';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { AUDIT_CHAIN_OWNER_ONLY_BODY } from '@/lib/operations/ownerOnly';

export async function POST() {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
      select: { id: true },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    // SEC-TASKS-01: the chain spans every user's audit_log rows (verifyAuditChain
    // reads them all), so only the owner verifies it — refused before it runs.
    if (!isAdminUser(user.id)) return NextResponse.json(AUDIT_CHAIN_OWNER_ONLY_BODY, { status: 403 });

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

    // Response contract emits BOTH the researcher-flavored fields used by
    // diagnostic tooling (is_valid, total_rows, break_points, notes) AND the
    // UI-flavored fields consumed by section components (ok, rows_checked,
    // message). Single source of truth so consumers don't drift from the
    // producer. SectionK_AuditTail and the future-fixed SectionI_AuditTail
    // both read the UI-flavored fields.
    const ui_message = result.is_valid
      ? undefined
      : result.notes[0] ?? (
          result.break_points.length > 0
            ? `${result.break_points.length} break point(s) — see /api/audit-log/verify-chain for details`
            : 'chain invalid (no diagnostic notes available)'
        );

    const serialized = {
      ...result,
      break_points: result.break_points.map((bp) => ({
        ...bp,
        sequence_number: bp.sequence_number.toString(),
      })),
      // UI-flavored contract:
      ok: result.is_valid,
      rows_checked: result.total_rows,
      message: ui_message,
    };

    return NextResponse.json(serialized);
  } catch (error) {
    console.error('[Audit Chain Verify]', error);
    return NextResponse.json({ error: 'Chain verification failed' }, { status: 500 });
  }
}
