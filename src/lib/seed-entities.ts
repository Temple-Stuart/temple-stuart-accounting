import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

interface EntityDef {
  name: string;
  entity_type: string;
  is_default: boolean;
  template_name: string;
}

const ENTITY_DEFS: EntityDef[] = [
  { name: 'Personal Finances', entity_type: 'personal', is_default: true, template_name: 'Personal Standard' },
  { name: 'Trading', entity_type: 'personal', is_default: false, template_name: 'Trading Standard' },
  { name: 'Business', entity_type: 'sole_prop', is_default: false, template_name: 'Sole Proprietor Standard' },
];

function parseTaxFormLine(taxFormLine: string): { tax_form: string; form_line: string } {
  // "schedule_c_line_24b" → tax_form="schedule_c", form_line="line_24b"
  // "form_1040_line_1a"   → tax_form="form_1040",  form_line="line_1a"
  // "form_8949"           → tax_form="form_8949",   form_line="all"
  const lineIdx = taxFormLine.indexOf('_line_');
  if (lineIdx === -1) {
    return { tax_form: taxFormLine, form_line: 'all' };
  }
  return {
    tax_form: taxFormLine.substring(0, lineIdx),
    form_line: taxFormLine.substring(lineIdx + 1), // "line_24b"
  };
}

export async function seedEntities(prisma: PrismaClient, userId: string) {
  const results: { entity: string; coaCount: number; taxMappings: number }[] = [];

  for (const def of ENTITY_DEFS) {
    // Upsert entity (idempotent by [userId, name] unique constraint)
    const entity = await prisma.entities.upsert({
      where: {
        userId_name: {
          userId,
          name: def.name,
        },
      },
      create: {
        userId,
        name: def.name,
        entity_type: def.entity_type,
        is_default: def.is_default,
      },
      update: {
        entity_type: def.entity_type,
        is_default: def.is_default,
      },
    });

    // Look up the template by name (not just entity_type, since Trading and Personal both use "personal")
    const template = await prisma.coa_templates.findFirst({
      where: { name: def.template_name, is_active: true },
      include: { accounts: true },
    });

    if (!template) {
      throw new Error(`Template "${def.template_name}" not found. Run seedCoaTemplates first.`);
    }

    let coaCount = 0;
    let taxMappingCount = 0;

    for (const tmplAcct of template.accounts) {
      // Check if COA account already exists for this entity
      const existing = await prisma.chart_of_accounts.findUnique({
        where: {
          userId_entity_id_code: {
            userId,
            entity_id: entity.id,
            code: tmplAcct.code,
          },
        },
      });

      let coaId: string;
      if (existing) {
        coaId = existing.id;
      } else {
        coaId = randomUUID();
        await prisma.chart_of_accounts.create({
          data: {
            id: coaId,
            userId,
            entity_id: entity.id,
            code: tmplAcct.code,
            name: tmplAcct.name,
            account_type: tmplAcct.account_type,
            balance_type: tmplAcct.balance_type,
            sub_type: tmplAcct.sub_type,
            tax_form_line: tmplAcct.tax_form_line,
            entity_type: def.entity_type,
          },
        });
        coaCount++;
      }

      // Create tax mappings for accounts with tax_form_line
      if (tmplAcct.tax_form_line) {
        const { tax_form, form_line } = parseTaxFormLine(tmplAcct.tax_form_line);

        // Meals (Business) gets 0.5 multiplier per IRS rules
        const multiplier = tmplAcct.name === 'Meals (Business)' ? 0.5 : 1.0;

        await prisma.account_tax_mappings.upsert({
          where: {
            account_id_tax_form_form_line_tax_year: {
              account_id: coaId,
              tax_form,
              form_line,
              tax_year: 2025,
            },
          },
          create: {
            account_id: coaId,
            tax_form,
            form_line,
            tax_year: 2025,
            multiplier,
          },
          update: {
            multiplier,
          },
        });
        taxMappingCount++;
      }
    }

    results.push({ entity: def.name, coaCount, taxMappings: taxMappingCount });
  }

  return results;
}
