import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

export async function GET(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    if (!yearParam) return NextResponse.json({ error: 'year query param required' }, { status: 400 });
    const year = parseInt(yearParam, 10);

    const documents = await prisma.tax_documents.findMany({
      where: { userId: user.id, tax_year: year },
      orderBy: [{ doc_type: 'asc' }, { label: 'asc' }],
    });

    return NextResponse.json({ tax_year: year, documents });
  } catch (error) {
    console.error('Tax documents GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { tax_year, doc_type, label, data } = await request.json();

    if (!tax_year || !doc_type || !data) {
      return NextResponse.json(
        { error: 'Required: tax_year, doc_type, data' },
        { status: 400 }
      );
    }

    const validTypes = ['w2', '1099r', '1098t', '1098e', '1099b', '1099int', '1099div'];
    if (!validTypes.includes(doc_type)) {
      return NextResponse.json(
        { error: `doc_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Upsert: create or update based on unique constraint
    const document = await prisma.tax_documents.upsert({
      where: {
        userId_tax_year_doc_type_label: {
          userId: user.id,
          tax_year,
          doc_type,
          label: label || '',
        },
      },
      create: {
        userId: user.id,
        tax_year,
        doc_type,
        label: label || '',
        data,
      },
      update: {
        data,
      },
    });

    return NextResponse.json({ success: true, document });
  } catch (error) {
    console.error('Tax documents POST error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to save document',
    }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

    // Verify ownership
    const doc = await prisma.tax_documents.findFirst({
      where: { id, userId: user.id },
    });
    if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });

    await prisma.tax_documents.delete({ where: { id } });

    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    console.error('Tax documents DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
