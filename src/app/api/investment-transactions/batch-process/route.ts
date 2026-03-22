import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { classifyAndPreview } from '@/lib/batch-trade-processor';

export async function POST(request: Request) {
  try {
    // Auth: same pattern as commit-to-ledger/route.ts
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const { mode, year } = body;

    if (!mode || !year) {
      return NextResponse.json(
        { error: 'Required: mode ("preview" or "commit") and year (e.g. 2025)' },
        { status: 400 }
      );
    }

    if (mode !== 'preview' && mode !== 'commit') {
      return NextResponse.json(
        { error: 'mode must be "preview" or "commit"' },
        { status: 400 }
      );
    }

    if (typeof year !== 'number' || year < 2020 || year > 2030) {
      return NextResponse.json(
        { error: 'year must be a number between 2020 and 2030' },
        { status: 400 }
      );
    }

    if (mode === 'preview') {
      const result = await classifyAndPreview(user.id, year);
      return NextResponse.json(result);
    }

    // Commit mode — not yet implemented
    return NextResponse.json(
      { error: 'Commit mode not yet implemented' },
      { status: 501 }
    );

  } catch (error: unknown) {
    console.error('Batch process error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
