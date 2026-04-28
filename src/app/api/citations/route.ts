import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const documentType = searchParams.get('document_type');
    const regulatorySourceId = searchParams.get('regulatory_source_id');
    const search = searchParams.get('search');

    const where: Record<string, unknown> = { is_active: true };
    if (status) where.status = status;
    if (documentType) where.document_type = documentType;
    if (regulatorySourceId) where.regulatory_source_id = regulatorySourceId;
    if (search) {
      where.OR = [
        { citation_string: { contains: search, mode: 'insensitive' } },
        { stable_uri: { contains: search, mode: 'insensitive' } },
      ];
    }

    const citations = await prisma.citations.findMany({
      where,
      include: {
        regulatory_source: {
          select: { source_name: true, domain: true },
        },
      },
      orderBy: [{ created_at: 'desc' }],
      take: 200,
    });

    return NextResponse.json({ count: citations.length, citations });
  } catch (error) {
    console.error('[Citations]', error);
    return NextResponse.json({ error: 'Failed to load citations' }, { status: 500 });
  }
}
