/**
 * BANK-01b AUDIT — which linked institutions are OAuth.
 *
 * A READ: one /institutions/get_by_id per distinct stored institutionId
 * (Institution.oauth — "Indicates that the institution has an OAuth login
 * flow", node_modules/plaid/dist/api.d.ts:12044). No link token is created,
 * no item call is made, no access token is selected from the database.
 *
 * Run locally by Alex (Claude Code cannot reach Azure Postgres or Plaid):
 *   DATABASE_URL=… PLAID_CLIENT_ID=… PLAID_SECRET=… npx tsx scripts/plaid-institutions-oauth.ts
 *
 * Prints one row per plaid_items row: institution, institutionId, oauth,
 * last_error_code. Exits 1 on any failure (fail loud, no partial table).
 */
import { PrismaClient } from '@prisma/client';
import { CountryCode } from 'plaid';
import { plaidClient } from '../src/lib/plaid';

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL must be set (run locally)');
  const prisma = new PrismaClient();
  try {
    const items = await prisma.plaid_items.findMany({
      select: { id: true, userId: true, institutionId: true, institutionName: true, last_error_code: true, last_error_at: true },
      orderBy: { createdAt: 'asc' },
    });
    const ids = [...new Set(items.map((i) => i.institutionId).filter((v): v is string => typeof v === 'string' && v !== '' && v !== 'unknown'))];
    const oauthById = new Map<string, boolean>();
    for (const institution_id of ids) {
      const res = await plaidClient.institutionsGetById({ institution_id, country_codes: [CountryCode.Us] });
      oauthById.set(institution_id, res.data.institution.oauth);
    }
    const rows = items.map((i) => ({
      item: i.id,
      user: i.userId,
      institution: i.institutionName ?? '(none)',
      institutionId: i.institutionId ?? '(none)',
      oauth: i.institutionId && oauthById.has(i.institutionId) ? oauthById.get(i.institutionId) : '(no institutionId stored)',
      last_error_code: i.last_error_code ?? null,
      last_error_at: i.last_error_at?.toISOString() ?? null,
    }));
    console.table(rows);
    console.log(`${items.length} items · ${ids.length} distinct institutions read · ${rows.filter((r) => r.oauth === true).length} OAuth`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('plaid-institutions-oauth failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
