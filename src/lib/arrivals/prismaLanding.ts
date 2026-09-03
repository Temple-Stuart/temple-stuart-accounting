/**
 * REBUILD-01 PR-2 — the Prisma-backed LandingDb, bound to ONE transaction
 * client so a page lands, parses and marks read atomically (sync-complete).
 * The arrivals insert is raw SQL for the one thing the Prisma client cannot say:
 * ON CONFLICT (provider, their_id, fingerprint) DO NOTHING … RETURNING.
 */
import { Prisma } from '@prisma/client';
import type { ArrivalRow, LandedArrival, LandingDb, ProviderResponseRow } from './land';

type Tx = Prisma.TransactionClient;

function textArray(values: string[]): Prisma.Sql {
  return values.length === 0 ? Prisma.sql`'{}'::text[]` : Prisma.sql`ARRAY[${Prisma.join(values)}]::text[]`;
}

export function prismaLanding(tx: Tx): LandingDb {
  return {
    async insertResponse(row: ProviderResponseRow) {
      await tx.provider_responses.create({
        data: {
          id: row.id,
          provider: row.provider as Prisma.provider_responsesCreateInput['provider'],
          resource: row.resource,
          user_id: row.user_id,
          guest_ref: row.guest_ref,
          http_status: row.http_status,
          body: row.body,
          body_sha256: row.body_sha256,
          asked: row.asked,
          arrived: row.arrived,
        },
      });
    },
    async insertArrivalsIgnoringDuplicates(rows: ArrivalRow[]) {
      if (rows.length === 0) return [];
      const values = rows.map(
        (r) => Prisma.sql`(${r.id}, ${r.provider}::arrival_provider, ${r.connection}, ${r.resource}, ${r.their_id}, ${r.their_id_kind}::their_id_kind, ${JSON.stringify(r.payload)}::jsonb, ${r.fingerprint}, ${textArray(r.redactions)}, ${r.asked}, ${r.arrived}, 'pending'::arrival_status, ${r.response_id}, ${r.user_id}, ${r.guest_ref})`,
      );
      const inserted = await tx.$queryRaw<Array<{ their_id: string; fingerprint: Buffer }>>(Prisma.sql`
        INSERT INTO arrivals (id, provider, connection, resource, their_id, their_id_kind, payload, fingerprint, redactions, asked, arrived, status, response_id, user_id, guest_ref)
        VALUES ${Prisma.join(values)}
        ON CONFLICT (provider, their_id, fingerprint) DO NOTHING
        RETURNING their_id, fingerprint`);
      return inserted.map((r) => ({ their_id: r.their_id, fingerprint: Buffer.from(r.fingerprint) }));
    },
    async findArrivals(provider: string, theirIds: string[]): Promise<LandedArrival[]> {
      if (theirIds.length === 0) return [];
      const rows = await tx.arrivals.findMany({
        where: { provider: provider as Prisma.arrivalsWhereInput['provider'], their_id: { in: theirIds } },
        select: { id: true, their_id: true, fingerprint: true, payload: true, status: true, arrived: true },
      });
      return rows.map((r) => ({ id: r.id, their_id: r.their_id, fingerprint: Buffer.from(r.fingerprint), payload: r.payload, status: r.status, arrived: r.arrived }));
    },
    async markRead(ids: string[], at: Date) {
      if (ids.length === 0) return;
      await tx.arrivals.updateMany({ where: { id: { in: ids } }, data: { read: at, status: 'done' } });
    },
  };
}
