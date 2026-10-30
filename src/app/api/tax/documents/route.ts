import { NextResponse } from 'next/server';
import { failClosedResponse } from '@/lib/http/failClosedResponse';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { requireTabAccess } from '@/lib/auth-helpers';
import { TAX_DOC_TYPES, isTaxDocType } from '@/lib/tax/documentFields';

export async function GET(request: Request) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } }
    });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // TAB-SERVER-GATE: tab:tax entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:tax');
    if (tabGate) return tabGate;

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
    // TAB-SERVER-GATE: tab:tax entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:tax');
    if (tabGate) return tabGate;

    const { tax_year, doc_type, label, data } = await request.json();

    if (!tax_year || !doc_type || !data) {
      return NextResponse.json(
        { error: 'Required: tax_year, doc_type, data' },
        { status: 400 }
      );
    }

    // TAX-WAGES-01: the seven types, from the one vocabulary (src/lib/tax/documentFields.ts TAX_DOC_TYPES).
    if (!isTaxDocType(doc_type)) {
      return NextResponse.json(
        { error: `doc_type must be one of: ${TAX_DOC_TYPES.join(', ')}` },
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
    return failClosedResponse('Tax documents POST', 'Failed to save document', error);
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
    // TAB-SERVER-GATE: tab:tax entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:tax');
    if (tabGate) return tabGate;

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
