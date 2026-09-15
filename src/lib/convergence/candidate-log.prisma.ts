/**
 * LOG-01 — the Prisma- and TastyTrade-backed ports for candidate-log.ts.
 * Kept apart so the pure logic and its tests import no database and no SDK.
 */
import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import { fetchTTCandlesBatch } from './data-fetchers';
import type { CandidateLogStore, CandidateRow, ScanRunRow, SettlePorts } from './candidate-log';

export const prismaCandidateLogStore: CandidateLogStore = {
  async write(run: ScanRunRow, candidates: CandidateRow[]): Promise<number> {
    return prisma.$transaction(async (tx) => {
      await tx.scan_runs.create({ data: run });
      if (candidates.length === 0) return 0;
      const res = await tx.scan_candidates.createMany({
        data: candidates.map((c) => ({ ...c, legs: c.legs as unknown as Prisma.InputJsonValue, excluded_fields: c.excluded_fields as unknown as Prisma.InputJsonValue, catalyst: c.catalyst as unknown as Prisma.InputJsonValue })),
      });
      return res.count;
    });
  },
};

export const prismaSettlePorts: SettlePorts = {
  now: () => new Date(),
  async loadDue(userId, today) {
    const dayEnd = new Date(`${today.toISOString().slice(0, 10)}T23:59:59.999Z`);
    const due = await prisma.scan_candidates.findMany({
      where: { run: { userId }, outcome_at: null, expiration: { lte: dayEnd } },
      select: { id: true, symbol: true, legs: true, expiration: true, taken: true },
      orderBy: { expiration: 'asc' },
    });
    const pending = await prisma.scan_candidates.count({ where: { run: { userId }, outcome_at: null, expiration: { gt: dayEnd } } });
    return { due, pending };
  },
  async loadTakenOutcome(candidateId) {
    const card = await prisma.trade_cards.findFirst({ where: { candidate_id: candidateId }, select: { link: { select: { actual_pl: true } } } });
    if (!card) return { state: 'no_card' };
    if (!card.link) return { state: 'no_link' };
    if (card.link.actual_pl === null) return { state: 'open' };
    return { state: 'closed', pl: Number(card.link.actual_pl) };
  },
  async fetchCandles(symbols, lookbackDays) {
    const r = await fetchTTCandlesBatch(symbols, lookbackDays);
    return r.data;
  },
  async writeOutcome(candidateId, data) {
    await prisma.scan_candidates.update({ where: { id: candidateId }, data });
  },
};
