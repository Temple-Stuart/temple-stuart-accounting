import { NextResponse } from 'next/server';
import { runPipeline } from '@/lib/convergence/pipeline';
import { getCurrentUser } from '@/lib/auth-helpers';

export const maxDuration = 300;

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const rawLimit = searchParams.get('limit');
    let limit = rawLimit ? parseInt(rawLimit, 10) : 20;

    // Clamp limit to valid range
    if (isNaN(limit) || limit < 4) limit = 4;
    if (limit > 150) limit = 150;

    console.log(`[Pipeline Route] Starting pipeline with limit=${limit}`);
    const result = await runPipeline(limit);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Pipeline Route] Error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
