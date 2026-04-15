import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth-helpers';

// ═══════════════════════════════════════════════════════════════════
// /api/account-tax-mappings
//
// GET    — list COA accounts (optionally scoped to an entity) with their
//          current mapping for a given tax year/form (null if unmapped).
// POST   — upsert a mapping on (account_id, tax_form, form_line, tax_year).
// DELETE — remove a single mapping by id.
//
// All three verbs verify account ownership via chart_of_accounts.userId.
// ═══════════════════════════════════════════════════════════════════

interface AccountRow {
  id: string;
  code: string;
  name: string;
  account_type: string;
  entity_id: string;
  entity_name: string | null;
  mapping_id: string | null;
  tax_form: string | null;
  form_line: string | null;
  tax_year: number | null;
  multiplier: string | null; // Decimal → text
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year');
    const entityId = searchParams.get('entity_id');
    const taxForm = searchParams.get('tax_form') || 'schedule_c';

    if (!yearParam) {
      return NextResponse.json({ error: 'year query param required' }, { status: 400 });
    }
    const taxYear = parseInt(yearParam, 10);
    if (isNaN(taxYear) || taxYear < 2000 || taxYear > 2100) {
      return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
    }

    if (entityId) {
      const entity = await prisma.entities.findFirst({
        where: { id: entityId, userId: user.id },
      });
      if (!entity) {
        return NextResponse.json({ error: 'Entity not found' }, { status: 404 });
      }
    }

    // One-shot query: all user's accounts (optionally entity-scoped) LEFT JOIN
    // account_tax_mappings filtered by the specific tax_form + tax_year.
    const rows: AccountRow[] = await prisma.$queryRawUnsafe(
      `
        SELECT
          coa.id::text            AS id,
          coa.code,
          coa.name,
          coa.account_type,
          coa.entity_id,
          e.name                  AS entity_name,
          atm.id                  AS mapping_id,
          atm.tax_form,
          atm.form_line,
          atm.tax_year,
          atm.multiplier::text    AS multiplier
        FROM chart_of_accounts coa
        LEFT JOIN entities e ON coa.entity_id = e.id
        LEFT JOIN account_tax_mappings atm
          ON atm.account_id = coa.id
          AND atm.tax_form = $3
          AND atm.tax_year = $4
        WHERE coa."userId" = $1
          AND coa.is_archived = false
          AND ($2::text IS NULL OR coa.entity_id = $2)
        ORDER BY coa.code
      `,
      user.id,
      entityId,
      taxForm,
      taxYear
    );

    const accounts = rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      accountType: r.account_type,
      entityId: r.entity_id,
      entityName: r.entity_name,
      mapping: r.mapping_id
        ? {
            id: r.mapping_id,
            tax_form: r.tax_form as string,
            form_line: r.form_line as string,
            tax_year: r.tax_year as number,
            multiplier: r.multiplier ? parseFloat(r.multiplier) : 1.0,
          }
        : null,
    }));

    return NextResponse.json({
      year: taxYear,
      tax_form: taxForm,
      entity_id: entityId || null,
      accounts,
    });
  } catch (error) {
    console.error('Account tax mappings GET error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { account_id, tax_form, form_line, tax_year, multiplier } = body as {
      account_id?: string;
      tax_form?: string;
      form_line?: string;
      tax_year?: number;
      multiplier?: number;
    };

    if (!account_id || !tax_form || !form_line || !tax_year) {
      return NextResponse.json(
        { error: 'Required: account_id, tax_form, form_line, tax_year' },
        { status: 400 }
      );
    }

    // SECURITY: confirm the account belongs to this user before writing.
    const account = await prisma.chart_of_accounts.findFirst({
      where: { id: account_id, userId: user.id },
      select: { id: true },
    });
    if (!account) {
      return NextResponse.json(
        { error: 'Account not found or does not belong to this user' },
        { status: 404 }
      );
    }

    const mult =
      typeof multiplier === 'number' && multiplier > 0 && multiplier <= 10
        ? multiplier
        : 1.0;

    const mapping = await prisma.account_tax_mappings.upsert({
      where: {
        account_id_tax_form_form_line_tax_year: {
          account_id,
          tax_form,
          form_line,
          tax_year,
        },
      },
      create: {
        account_id,
        tax_form,
        form_line,
        tax_year,
        multiplier: mult,
        created_by: user.email || null,
      },
      update: {
        multiplier: mult,
      },
    });

    return NextResponse.json({
      success: true,
      mapping: {
        id: mapping.id,
        account_id: mapping.account_id,
        tax_form: mapping.tax_form,
        form_line: mapping.form_line,
        tax_year: mapping.tax_year,
        multiplier: Number(mapping.multiplier),
      },
    });
  } catch (error) {
    console.error('Account tax mappings POST error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Accept id from body or query param
    let id: string | null = null;
    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      id = (body?.id as string | undefined) ?? null;
    }
    if (!id) {
      id = new URL(request.url).searchParams.get('id');
    }
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    // SECURITY: only delete if the mapping's account belongs to this user.
    const mapping = await prisma.account_tax_mappings.findFirst({
      where: { id },
      include: { account: { select: { userId: true } } },
    });
    if (!mapping) {
      return NextResponse.json({ error: 'Mapping not found' }, { status: 404 });
    }
    if (mapping.account.userId !== user.id) {
      return NextResponse.json(
        { error: 'Mapping does not belong to this user' },
        { status: 403 }
      );
    }

    await prisma.account_tax_mappings.delete({ where: { id } });

    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    console.error('Account tax mappings DELETE error:', error);
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
