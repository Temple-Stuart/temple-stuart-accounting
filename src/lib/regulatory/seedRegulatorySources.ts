import { PrismaClient } from '@prisma/client';
import seedData from '../../../prisma/seed-data/regulatory_sources.json';

const prisma = new PrismaClient();

async function seed() {
  const items = seedData as Array<Record<string, unknown>>;
  console.log(`Seeding ${items.length} regulatory sources...`);

  let created = 0;
  let updated = 0;

  for (const source of items) {
    await prisma.regulatory_sources.upsert({
      where: { domain: source.domain as string },
      create: {
        domain: source.domain as string,
        source_name: source.source_name as string,
        source_tier: source.source_tier as 'primary_law' | 'subregulatory_guidance' | 'agency_enforcement' | 'secondary_authoritative' | 'secondary_practitioner',
        authority_rank: source.authority_rank as number,
        jurisdictions: source.jurisdictions as string[],
        regulators: source.regulators as string[],
        practice_areas: source.practice_areas as Array<'tax_federal' | 'tax_state' | 'bookkeeping_accounting'>,
        module_relevance: source.module_relevance as string[],
        primary_content_types: source.primary_content_types as string[],
        refresh_cadence: source.refresh_cadence as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'event_driven',
        api_or_bulk_data: (source.api_or_bulk_data as string) || null,
        notes: (source.notes as string) || null,
        last_verified: new Date(source.last_verified as string),
        last_verified_by: source.last_verified_by as string,
        is_active: true,
      },
      update: {
        source_name: source.source_name as string,
        source_tier: source.source_tier as 'primary_law' | 'subregulatory_guidance' | 'agency_enforcement' | 'secondary_authoritative' | 'secondary_practitioner',
        authority_rank: source.authority_rank as number,
        jurisdictions: source.jurisdictions as string[],
        regulators: source.regulators as string[],
        practice_areas: source.practice_areas as Array<'tax_federal' | 'tax_state' | 'bookkeeping_accounting'>,
        module_relevance: source.module_relevance as string[],
        primary_content_types: source.primary_content_types as string[],
        refresh_cadence: source.refresh_cadence as 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual' | 'event_driven',
        api_or_bulk_data: (source.api_or_bulk_data as string) || null,
        notes: (source.notes as string) || null,
        last_verified: new Date(source.last_verified as string),
        last_verified_by: source.last_verified_by as string,
      },
    });
    created++;
  }

  const total = await prisma.regulatory_sources.count();
  console.log(`Seed complete. Processed: ${created}, Total in DB: ${total}`);
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
