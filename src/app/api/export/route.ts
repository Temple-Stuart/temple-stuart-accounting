import { NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getVerifiedEmail } from '@/lib/cookie-auth';

/**
 * GET /api/export — EXPORT-1: one-click full data export (the anti-lock-in
 * guarantee). CSV per table, zipped, temple-stuart-export-YYYY-MM-DD.zip.
 *
 * NEVER PAYWALLED — CONSTITUTIONAL. This route has NO tier gate and NO
 * entitlement gate, deliberately and permanently: a paywalled export is the
 * Bench disease (Bench's collapse locked customers out of their own books).
 * The bar is verified email + user scoping ONLY — the same bar as every
 * DB-only read (the /api/runway precedent). Do not add requireTier or
 * requireTabAccess here, ever. Users can always take their data and leave.
 *
 * READ-ONLY — findMany only; zero writes anywhere on this path.
 *
 * SCOPE — every query is user-scoped (WHERE userId = authed user, directly or
 * through the owning parent relation; the relation paths are enforced by the
 * Prisma types). Tables without a user-ownership path are not exportable
 * per-user and are excluded by construction. Full inclusion/exclusion
 * enumeration with reasons in the EXPORT-1 report.
 *
 * VALUES render honestly (the accountant-friendly shape):
 *   • BigInt cents (the house doctrine: every BigInt amount is cents) render
 *     as BOTH `<col>_cents` (raw) and `<col>_dollars` (decimal, 2dp);
 *     Int columns named *Cents get the same twin treatment.
 *   • Timestamps → ISO 8601. Prisma Decimals → decimal strings. Json →
 *     JSON strings. Foreign-key ids are exported as-is, so the relational
 *     structure survives and an accountant can rebuild the picture.
 *
 * SIZE — adm-zip (existing dependency) is buffer-based, not streaming; at
 * personal-ledger scale the whole archive is a few MB, so buffering is the
 * right call (a streaming zip would need a new dependency for no user win).
 * FAIL-LOUD oversize behavior: if the finished archive exceeds MAX_ZIP_BYTES
 * (under Vercel's ~4.5 MB serverless response-body limit) the route returns
 * an honest 413 naming the size — NEVER a silently truncated archive.
 */

export const dynamic = 'force-dynamic';

const MAX_ZIP_BYTES = 4 * 1024 * 1024; // stay under Vercel's ~4.5 MB response cap — fail loud, never truncate

/** CSV-escape one cell (RFC 4180: quote when needed, double inner quotes). */
function csvCell(s: string): string {
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row → a flat string record, applying the honest-value rules. */
function flattenRow(row: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v === null || v === undefined) {
      out[k] = '';
    } else if (typeof v === 'bigint') {
      // House doctrine: BigInt amounts are cents — render both shapes.
      out[`${k}_cents`] = v.toString();
      out[`${k}_dollars`] = (Number(v) / 100).toFixed(2);
    } else if (typeof v === 'number' && /Cents$/.test(k)) {
      // Int cents columns (e.g. reservations.finalPriceCents) get the same twin.
      out[k] = String(v);
      out[k.replace(/Cents$/, 'Dollars')] = (v / 100).toFixed(2);
    } else if (v instanceof Date) {
      out[k] = v.toISOString();
    } else if (Prisma.Decimal.isDecimal(v)) {
      out[k] = v.toString();
    } else if (typeof v === 'object') {
      out[k] = JSON.stringify(v);
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

/** Rows → CSV. Column set = union across all flattened rows (nullable BigInt
 *  twins appear even when the first row is null-heavy). Empty → '(no rows)'. */
function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '(no rows)\n';
  const flat = rows.map(flattenRow);
  const cols = Array.from(new Set(flat.flatMap((r) => Object.keys(r))));
  const lines = [cols.map(csvCell).join(',')];
  for (const r of flat) lines.push(cols.map((c) => csvCell(r[c] ?? '')).join(','));
  return lines.join('\n') + '\n';
}

export async function GET() {
  // Gate FIRST — 401 before any DB work. Verified email + user scoping only
  // (never a tier/entitlement gate — see the header).
  const email = await getVerifiedEmail();
  if (!email) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const user = await prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const uid = user.id;

  // The user's financial spine + travel — every query user-scoped, read-only.
  // Ordered roughly parent → child so an accountant reads the manifest top-down.
  const tables: { name: string; rows: Record<string, unknown>[] }[] = [
    // ── Bookkeeping spine ────────────────────────────────────────────────
    { name: 'entities', rows: await prisma.entities.findMany({ where: { userId: uid } }) },
    { name: 'chart_of_accounts', rows: await prisma.chart_of_accounts.findMany({ where: { userId: uid } }) },
    { name: 'journal_entries', rows: await prisma.journal_entries.findMany({ where: { userId: uid } }) },
    { name: 'ledger_entries', rows: await prisma.ledger_entries.findMany({ where: { journal_entry: { userId: uid } } }) },
    { name: 'ledger_line_links', rows: await prisma.ledger_line_links.findMany({ where: { ledger_entry: { journal_entry: { userId: uid } } } }) },
    { name: 'merchant_coa_mappings', rows: await prisma.merchant_coa_mappings.findMany({ where: { userId: uid } }) },
    { name: 'closing_periods', rows: await prisma.closing_periods.findMany({ where: { userId: uid } }) },
    { name: 'bank_reconciliations', rows: await prisma.bank_reconciliations.findMany({ where: { userId: uid } }) },
    // ── Bank + brokerage feed ────────────────────────────────────────────
    { name: 'accounts', rows: await prisma.accounts.findMany({ where: { userId: uid } }) },
    { name: 'transactions', rows: await prisma.transactions.findMany({ where: { accounts: { userId: uid } } }) },
    { name: 'investment_transactions', rows: await prisma.investment_transactions.findMany({ where: { accounts: { userId: uid } } }) },
    // ── Budgets ──────────────────────────────────────────────────────────
    { name: 'budgets', rows: await prisma.budgets.findMany({ where: { userId: uid } }) },
    { name: 'budget_line_items', rows: await prisma.budget_line_items.findMany({ where: { userId: uid } }) },
    // ── Trading cost basis + tax ─────────────────────────────────────────
    { name: 'stock_lots', rows: await prisma.stock_lots.findMany({ where: { user_id: uid } }) },
    { name: 'lot_dispositions', rows: await prisma.lot_dispositions.findMany({ where: { lot: { user_id: uid } } }) },
    { name: 'lot_adjustments', rows: await prisma.lot_adjustments.findMany({ where: { lot: { user_id: uid } } }) },
    { name: 'corporate_actions', rows: await prisma.corporate_actions.findMany({ where: { user_id: uid } }) },
    { name: 'trade_journal_entries', rows: await prisma.trade_journal_entries.findMany({ where: { userId: uid } }) },
    { name: 'tax_overrides', rows: await prisma.tax_overrides.findMany({ where: { userId: uid } }) },
    { name: 'tax_documents', rows: await prisma.tax_documents.findMany({ where: { userId: uid } }) },
    // ── Standalone expense registers ─────────────────────────────────────
    { name: 'home_expenses', rows: await prisma.home_expenses.findMany({ where: { user_id: uid } }) },
    { name: 'module_expenses', rows: await prisma.module_expenses.findMany({ where: { user_id: uid } }) },
    // ── Travel ───────────────────────────────────────────────────────────
    { name: 'trips', rows: await prisma.trips.findMany({ where: { userId: uid } }) },
    { name: 'trip_expenses', rows: await prisma.trip_expenses.findMany({ where: { trip: { userId: uid } } }) },
    { name: 'expense_splits', rows: await prisma.expense_splits.findMany({ where: { expense: { trip: { userId: uid } } } }) },
    { name: 'reservations', rows: await prisma.reservations.findMany({ where: { userId: uid } }) },
    // ── Vendors ──────────────────────────────────────────────────────────
    { name: 'operations_vendor_directory', rows: await prisma.operations_vendor_directory.findMany({ where: { user_id: uid } }) },
  ];

  const today = new Date().toISOString().slice(0, 10);
  const zip = new AdmZip();

  // manifest.csv — coverage declared up front: table, row count, file.
  const manifest = ['table,row_count,file'];
  for (const t of tables) {
    manifest.push(`${t.name},${t.rows.length},${t.name}.csv`);
    zip.addFile(`${t.name}.csv`, Buffer.from(toCsv(t.rows), 'utf8'));
  }
  zip.addFile('manifest.csv', Buffer.from(manifest.join('\n') + '\n', 'utf8'));

  const buffer = zip.toBuffer();
  if (buffer.byteLength > MAX_ZIP_BYTES) {
    // FAIL-LOUD: an honest refusal, never a silently truncated archive.
    return NextResponse.json(
      {
        error: `Export is ${(buffer.byteLength / 1048576).toFixed(1)} MB — over the ${(MAX_ZIP_BYTES / 1048576).toFixed(1)} MB response limit. Nothing was truncated. Contact astuart@templestuart.com for an out-of-band export.`,
      },
      { status: 413 },
    );
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="temple-stuart-export-${today}.zip"`,
      'Cache-Control': 'no-store',
    },
  });
}
