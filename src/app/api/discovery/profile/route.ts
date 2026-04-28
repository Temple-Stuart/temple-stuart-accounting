import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { writeAuditLog } from '@/lib/audit/writeAuditLog';

export async function GET(_request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const profile = await prisma.user_profiles.findUnique({ where: { user_id: user.id } });
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('[Discovery Profile GET]', error);
    return NextResponse.json({ error: 'Failed to load profile' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const user = await prisma.users.findFirst({ where: { email: { equals: userEmail, mode: 'insensitive' } } });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

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
      primary_entity_id: primary_entity_id ?? null,
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
    return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
  }
}
