import { prisma } from '@/lib/prisma';

/**
 * Phase 5: Update a scan snapshot with actual outcome data.
 * Called by a scheduled job after DTE expiry to measure prediction quality.
 *
 * Enables:
 * - Hit rate per gate / sub-score
 * - Empirical threshold calibration
 * - P&L attribution to specific signal components
 * - IV mean-reversion validation
 */
export async function updateSnapshotOutcome(
  snapshotId: string,
  outcome: {
    pnl?: number;
    spotPrice?: number;
    iv?: number;
    ivCompressed?: boolean;
    stayedInRange?: boolean;
  },
): Promise<void> {
  await prisma.scan_snapshots.update({
    where: { id: snapshotId },
    data: {
      outcomeDate: new Date(),
      outcomePnl: outcome.pnl ?? null,
      outcomeSpotPrice: outcome.spotPrice ?? null,
      outcomeIV: outcome.iv ?? null,
      ivCompressed: outcome.ivCompressed ?? null,
      stayedInRange: outcome.stayedInRange ?? null,
    },
  });
}
