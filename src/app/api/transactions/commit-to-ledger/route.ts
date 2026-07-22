import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { commitPlaidTransaction, type CommitLink } from '@/lib/journal-entry-service';
import { getVerifiedEmail } from '@/lib/cookie-auth';
import { ensureBookkeepingInitialized } from '@/lib/ensure-bookkeeping';
import { PeriodClosedError } from '@/lib/period-close-guard';
import { TAB_DESCRIPTORS } from '@/lib/tabDescriptors';

// DIM-3: the canonical module_key vocabulary = the pillar ids (the
// tabDescriptors leaf — one source, client-safe). Anything else → 400.
const MODULE_KEYS = new Set(Object.keys(TAB_DESCRIPTORS));

interface LinkInput {
  targetType?: unknown;
  targetId?: unknown;
  moduleKey?: unknown;
  percent?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const userEmail = await getVerifiedEmail();
    if (!userEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.users.findFirst({
      where: { email: { equals: userEmail, mode: 'insensitive' } },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await ensureBookkeepingInitialized(user);

    const body = await request.json();
    // DIM-3: vendorId + links are OPTIONAL — absent means the entries post
    // dimensionless (the legacy-epoch semantic). Present → validated FAIL-LOUD
    // below BEFORE any write; the same dimensions apply to every entry in the
    // batch (the batch is one coding decision).
    const { transactionIds, accountCode, entityId, subAccount, vendorId, links } = body;

    if (!transactionIds || !accountCode) {
      return NextResponse.json(
        { error: 'transactionIds and accountCode required' },
        { status: 400 }
      );
    }

    // ─── DIM-3 validation chain — all of it BEFORE any write ─────────────────
    // Vendor: user-scoped ownership, defensive 404 (never confirms a foreign
    // vendor exists).
    if (vendorId !== undefined && vendorId !== null) {
      if (typeof vendorId !== 'string' || vendorId.length === 0) {
        return NextResponse.json({ error: 'vendorId must be a string' }, { status: 400 });
      }
      const vendor = await prisma.operations_vendor_directory.findFirst({
        where: { id: vendorId, user_id: user.id },
        select: { id: true },
      });
      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
      }
    }

    // Links: each row → exactly-one owned target + a 2-decimal percent in
    // (0, 100]; the set → no duplicate targets + sum EXACTLY 100.00. Percents
    // are compared as INTEGER CENTIPERCENT (percent × 100, exact) — no float
    // tolerance games; 33.333 is rejected as >2 decimals, 33.33+33.33+33.34
    // sums to exactly 10000.
    let validatedLinks: CommitLink[] | undefined;
    if (links !== undefined && links !== null) {
      if (!Array.isArray(links) || links.length === 0) {
        return NextResponse.json(
          { error: 'links must be a non-empty array when provided' },
          { status: 400 }
        );
      }
      const out: CommitLink[] = [];
      const seenTargets = new Set<string>();
      let centiSum = 0;
      for (const raw of links as LinkInput[]) {
        const t = raw?.targetType;
        if (t !== 'project' && t !== 'routine' && t !== 'trip' && t !== 'module') {
          return NextResponse.json(
            { error: `link targetType must be project | routine | trip | module` },
            { status: 400 }
          );
        }
        const p = raw?.percent;
        if (typeof p !== 'number' || !Number.isFinite(p) || p <= 0 || p > 100) {
          return NextResponse.json(
            { error: 'each link percent must be a number in (0, 100]' },
            { status: 400 }
          );
        }
        const centi = Math.round(p * 100);
        if (Math.abs(p * 100 - centi) > 1e-9) {
          return NextResponse.json(
            { error: `link percent ${p} has more than 2 decimal places` },
            { status: 400 }
          );
        }
        centiSum += centi;

        if (t === 'module') {
          const key = raw?.moduleKey;
          if (typeof key !== 'string' || !MODULE_KEYS.has(key)) {
            return NextResponse.json(
              { error: `moduleKey must be one of: ${[...MODULE_KEYS].join(', ')}` },
              { status: 400 }
            );
          }
          const dupKey = `module:${key}`;
          if (seenTargets.has(dupKey)) {
            return NextResponse.json({ error: `duplicate link target ${dupKey}` }, { status: 400 });
          }
          seenTargets.add(dupKey);
          out.push({ module_key: key, percent: centi / 100 });
          continue;
        }

        const targetId = raw?.targetId;
        if (typeof targetId !== 'string' || targetId.length === 0) {
          return NextResponse.json(
            { error: `link targetId required for targetType ${t}` },
            { status: 400 }
          );
        }
        const dupKey = `${t}:${targetId}`;
        if (seenTargets.has(dupKey)) {
          return NextResponse.json({ error: `duplicate link target ${dupKey}` }, { status: 400 });
        }
        seenTargets.add(dupKey);

        // Ownership per target — user-scoped findFirst, defensive 404.
        if (t === 'project') {
          const row = await prisma.operations_projects.findFirst({
            where: { id: targetId, user_id: user.id }, select: { id: true },
          });
          if (!row) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
          out.push({ project_id: targetId, percent: centi / 100 });
        } else if (t === 'routine') {
          const row = await prisma.operations_routines.findFirst({
            where: { id: targetId, user_id: user.id }, select: { id: true },
          });
          if (!row) return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
          out.push({ routine_id: targetId, percent: centi / 100 });
        } else {
          const row = await prisma.trips.findFirst({
            where: { id: targetId, userId: user.id }, select: { id: true },
          });
          if (!row) return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
          out.push({ trip_id: targetId, percent: centi / 100 });
        }
      }
      if (centiSum !== 10000) {
        return NextResponse.json(
          { error: `Links must total exactly 100% — got ${(centiSum / 100).toFixed(2)}%` },
          { status: 400 }
        );
      }
      validatedLinks = out;
    }

    // Resolve entityId: use provided or fall back to user's default entity
    let resolvedEntityId = entityId;
    if (!resolvedEntityId) {
      const defaultEntity = await prisma.entities.findFirst({
        where: { userId: user.id, is_default: true },
      });
      if (!defaultEntity) {
        return NextResponse.json(
          { error: 'No entityId provided and no default entity found' },
          { status: 400 }
        );
      }
      resolvedEntityId = defaultEntity.id;
    }

    // SECURITY: Verify all transactions belong to this user
    const ownedTxns = await prisma.transactions.findMany({
      where: { id: { in: transactionIds }, accounts: { userId: user.id } },
      select: { id: true },
    });

    if (ownedTxns.length !== transactionIds.length) {
      return NextResponse.json(
        { error: 'Some transactions do not belong to your account' },
        { status: 403 }
      );
    }

    const batchRequestId = randomUUID();
    const results = [];
    const errors = [];

    for (const txnId of transactionIds) {
      try {
        const plaidTxn = await prisma.transactions.findUnique({
          where: { id: txnId },
          include: { accounts: true },
        });

        if (!plaidTxn) {
          errors.push({ txnId, error: 'Transaction not found' });
          continue;
        }

        // Look up bank COA account dynamically from the linked Plaid account
        const linkedAccount = plaidTxn.accounts;
        const bankAccountCode = linkedAccount.accountCode;

        if (!bankAccountCode) {
          errors.push({
            txnId,
            error: `Linked account "${linkedAccount.name}" has no accountCode mapped. Set accountCode on the accounts table first.`,
          });
          continue;
        }

        // Resolve the bank account's entity from the linked account's entityType.
        // This may differ from resolvedEntityId when cross-entity categorization
        // is used (e.g., personal bank account paying a business expense).
        let bankEntityId = resolvedEntityId;
        if (linkedAccount.entityType) {
          const bankEntity = await prisma.entities.findFirst({
            where: { userId: user.id, entity_type: linkedAccount.entityType },
          });
          if (bankEntity) {
            bankEntityId = bankEntity.id;
          }
        }

        // Per-transaction request_id: batch prefix + transaction ID
        // Enables individual idempotency checks while preserving batch traceability
        const requestId = `${batchRequestId}-${plaidTxn.transactionId}`;

        const journalEntry = await commitPlaidTransaction(prisma, {
          userId: user.id,
          entityId: resolvedEntityId,
          bankEntityId,
          transactionId: plaidTxn.transactionId,
          accountCode,
          bankAccountCode,
          date: new Date(plaidTxn.date),
          amount: plaidTxn.amount,
          description: plaidTxn.name,
          merchantName: plaidTxn.merchantName || undefined,
          requestId,
          createdBy: userEmail,
          // DIM-3: validated above — born WITH the entry, atomically.
          vendorId: typeof vendorId === 'string' ? vendorId : undefined,
          links: validatedLinks,
        });

        // Track whether the user overrode the auto-categorization prediction
        const wasOverridden = !!(
          plaidTxn.predicted_coa_code && plaidTxn.predicted_coa_code !== accountCode
        );

        // Update override metadata on the transaction
        await prisma.transactions.update({
          where: { id: txnId },
          data: {
            subAccount: subAccount || null,
            entity_id: resolvedEntityId,
            manually_overridden: wasOverridden,
            overridden_at: wasOverridden ? new Date() : null,
          },
        });

        // Merchant memory feedback loop
        if (plaidTxn.merchantName) {
          const merchantName = plaidTxn.merchantName;
          const categoryPrimary =
            (plaidTxn.personal_finance_category as Record<string, string>)?.primary || null;
          const categoryDetailed =
            (plaidTxn.personal_finance_category as Record<string, string>)?.detailed || null;

          // Penalize wrong prediction
          if (wasOverridden) {
            const wrongMapping = await prisma.merchant_coa_mappings.findUnique({
              where: {
                userId_merchant_name_plaid_category_primary: {
                  userId: user.id,
                  merchant_name: merchantName,
                  plaid_category_primary: categoryPrimary || '',
                },
              },
            });

            if (wrongMapping && wrongMapping.coa_code === plaidTxn.predicted_coa_code) {
              const newConfidence = Math.max(0, wrongMapping.confidence_score.toNumber() - 0.2);
              if (newConfidence < 0.3) {
                await prisma.merchant_coa_mappings.delete({
                  where: { id: wrongMapping.id },
                });
              } else {
                await prisma.merchant_coa_mappings.update({
                  where: { id: wrongMapping.id },
                  data: { confidence_score: newConfidence, last_used_at: new Date() },
                });
              }
            }
          }

          // Reinforce or create correct mapping
          const existing = await prisma.merchant_coa_mappings.findUnique({
            where: {
              userId_merchant_name_plaid_category_primary: {
                userId: user.id,
                merchant_name: merchantName,
                plaid_category_primary: categoryPrimary || '',
              },
            },
          });

          if (existing && existing.coa_code === accountCode) {
            await prisma.merchant_coa_mappings.update({
              where: { id: existing.id },
              data: {
                usage_count: { increment: 1 },
                confidence_score: Math.min(0.99, existing.confidence_score.toNumber() + 0.1),
                last_used_at: new Date(),
              },
            });
          } else if (!existing) {
            await prisma.merchant_coa_mappings.create({
              data: {
                id: randomUUID(),
                userId: user.id,
                entity_id: resolvedEntityId,
                merchant_name: merchantName,
                plaid_category_primary: categoryPrimary,
                plaid_category_detailed: categoryDetailed,
                coa_code: accountCode,
                sub_account: subAccount || null,
                confidence_score: wasOverridden ? 0.6 : 0.5,
              },
            });
          }
        }

        results.push({ txnId, journalEntryId: journalEntry.id, success: true, alreadyExisted: journalEntry.alreadyExisted || false });
      } catch (error: unknown) {
        if (error instanceof PeriodClosedError) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }

        const message = error instanceof Error ? error.message : 'Unknown error';

        // Handle duplicate commit (unique constraint on source_type + source_id)
        if (
          message.includes('Unique constraint') ||
          message.includes('unique constraint') ||
          message.includes('idx_unique_source_commit')
        ) {
          errors.push({ txnId, error: 'Transaction already committed' });
          continue;
        }

        console.error('Error committing transaction:', txnId, error);
        errors.push({ txnId, error: message });
      }
    }

    const status = errors.length > 0 && results.length === 0 ? 409 : 200;

    return NextResponse.json(
      {
        success: results.length > 0,
        committed: results.length,
        errorCount: errors.length,
        results,
        errors,
      },
      { status }
    );
  } catch (error: unknown) {
    console.error('Commit API error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
