import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';
import { requireTabAccess } from '@/lib/auth-helpers';

export async function GET(_request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // TAB-SERVER-GATE: tab:compliance entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:compliance');
    if (tabGate) return tabGate;

    const profile = await prisma.user_profiles.findUnique({ where: { user_id: user.id } });
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[Discovery Profile GET]', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

const REVENUE_STAGES = [
  'pre_revenue',
  'pre_charging',
  'charging_under_50k',
  'charging_50k_500k',
  'charging_500k_5m',
  'charging_over_5m',
] as const;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    // TAB-SERVER-GATE: tab:compliance entitlement (bundle:all included; admin bypass inside).
    const tabGate = await requireTabAccess(user.id, 'tab:compliance');
    if (tabGate) return tabGate;

    const body = await request.json();
    const {
      business_description,
      operating_jurisdictions,
      customer_jurisdictions,
      products_services,
      ai_use_in_product,
      ai_use_description,
      handles_personal_data,
      handles_financial_data,
      handles_health_data,
      revenue_stage,
      employee_count,
      planned_actions_24mo,
      known_completed_filings,
      notes,
      primary_entity_id,
    } = body;

    // Validation — return 400 with structured field errors so the UI can show them inline.
    if (typeof business_description !== 'string' || business_description.trim().length < 10) {
      return NextResponse.json(
        {
          error: 'Business description must be at least 10 characters.',
          field: 'business_description',
          message: 'Business description must be at least 10 characters.',
        },
        { status: 400 },
      );
    }

    if (!revenue_stage || !REVENUE_STAGES.includes(revenue_stage as (typeof REVENUE_STAGES)[number])) {
      return NextResponse.json(
        {
          error: `Revenue stage is required and must be one of: ${REVENUE_STAGES.join(', ')}.`,
          field: 'revenue_stage',
          message: 'Please select a revenue stage.',
        },
        { status: 400 },
      );
    }

    const normalizedPrimaryEntityId =
      typeof primary_entity_id === 'string' && primary_entity_id.trim() !== ''
        ? primary_entity_id.trim()
        : null;

    if (normalizedPrimaryEntityId !== null && !UUID_RE.test(normalizedPrimaryEntityId)) {
      return NextResponse.json(
        {
          error: 'Primary entity ID must be a valid UUID, or left blank.',
          field: 'primary_entity_id',
          message: 'Primary entity ID must be a valid UUID (e.g. 550e8400-e29b-41d4-a716-446655440000), or left blank.',
        },
        { status: 400 },
      );
    }

    const existing = await prisma.user_profiles.findUnique({ where: { user_id: user.id } });
    const isCreate = !existing;

    const profileData = {
      business_description,
      operating_jurisdictions: operating_jurisdictions ?? [],
      customer_jurisdictions: customer_jurisdictions ?? [],
      products_services: products_services ?? [],
      ai_use_in_product: ai_use_in_product ?? false,
      ai_use_description: ai_use_description ?? null,
      handles_personal_data: handles_personal_data ?? false,
      handles_financial_data: handles_financial_data ?? false,
      handles_health_data: handles_health_data ?? false,
      revenue_stage,
      employee_count: employee_count ?? 1,
      planned_actions_24mo: planned_actions_24mo ?? [],
      known_completed_filings: known_completed_filings ?? [],
      notes: notes ?? null,
      primary_entity_id: normalizedPrimaryEntityId,
    };

    const profile = await prisma.user_profiles.upsert({
      where: { user_id: user.id },
      create: {
        user_id: user.id,
        ...profileData,
      },
      update: profileData,
    });

    await writeAuditLog({
      actor: { user_id: user.id, email: userEmail, type: 'human_user' },
      action: {
        type: 'system_other',
        description: isCreate
          ? 'Created user compliance profile'
          : 'Updated user compliance profile',
      },
      target: { table: 'user_profiles', id: profile.id },
      payload: { before: existing ?? undefined, after: profile },
    });

    return NextResponse.json({ profile }, { status: isCreate ? 201 : 200 });
  } catch (error) {
    console.error('[Discovery Profile POST]', error);
    const message = error instanceof Error ? error.message : 'Failed to save profile';
    return NextResponse.json({ error: message, message }, { status: 500 });
  }
}
