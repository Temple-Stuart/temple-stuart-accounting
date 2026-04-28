import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

function serializeBigIntAndDecimal(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'bigint') return Number(obj);
  if (
    typeof obj === 'object' &&
    obj !== null &&
    'toNumber' in obj &&
    typeof (obj as { toNumber: () => number }).toNumber === 'function'
  ) {
    return (obj as { toNumber: () => number }).toNumber();
  }
  if (Array.isArray(obj)) return obj.map(serializeBigIntAndDecimal);
  if (typeof obj === 'object' && obj !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = serializeBigIntAndDecimal(value);
    }
    return result;
  }
  return obj;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const run = await prisma.discovery_runs.findUnique({
      where: { id },
      include: {
        proposals: {
          include: {
            children: true,
          },
          orderBy: { display_order: 'asc' },
        },
      },
    });

    if (!run || run.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const serialized = serializeBigIntAndDecimal(run);
    return NextResponse.json(serialized);
  } catch (error) {
    console.error('[Discovery Run GET]', error);
    return NextResponse.json({ error: 'Failed to load discovery run' }, { status: 500 });
  }
}
