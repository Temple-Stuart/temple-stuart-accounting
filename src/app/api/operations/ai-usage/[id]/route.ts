/**
 * GET /api/operations/ai-usage/[id]
 *
 * Returns the full operations_ai_usage row by id. Used by the audit
 * tail (Section K) row-expansion feature to fetch full prompt/response
 * content for AI inference rows on demand (lazy fetch with session-
 * scoped cache on the client side).
 *
 * Auth: user must own the row (filter by user_id). Returning another
 * user's AI inference row would leak prompt content + cost data —
 * non-negotiable user-scoping per the security mandate.
 *
 * Returns 404 (not 403) when row exists but doesn't belong to caller —
 * standard pattern matches how operations_projects/[id] handles it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await params;
    const row = await prisma.operations_ai_usage.findFirst({
      where: { id, user_id: user.id },
    });
    if (!row) return NextResponse.json({ error: 'AI usage row not found' }, { status: 404 });

    return NextResponse.json({
      id: row.id,
      model: row.model,
      purpose: row.purpose,
      target_table: row.target_table,
      target_id: row.target_id,
      input_tokens: row.input_tokens,
      output_tokens: row.output_tokens,
      cost_usd: row.cost_usd.toString(),
      inputs_summary: row.inputs_summary,
      output_summary: row.output_summary,
      full_system_prompt: row.full_system_prompt,
      full_user_message: row.full_user_message,
      full_response: row.full_response,
      created_at: row.created_at.toISOString(),
      created_by: row.created_by,
    });
  } catch (error) {
    console.error('[AI Usage GET]', error);
    return NextResponse.json(
      { error: 'Failed to load AI usage row', message: error instanceof Error ? error.message : 'unknown' },
      { status: 500 }
    );
  }
}
